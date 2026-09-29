// Trading-engine access for the active account, obtained like Kalks Trader: an SSO token for the client's own
// account is redeemed by the BFF for a terminal session (POST /api/mobile/trade/session). The session token is
// kept in the secure store per login until it expires, and sent as X-Kalks-Trade with every trade call.
import { api, type ApiOptions, type ApiResult } from "@/lib/api";
import { kv } from "@/lib/kv";
import { secure } from "@/lib/secure";
import { onSignOut } from "@/session";
import type { EngAccount } from "./types";

type Stored = { token: string; expiresAt: string; readOnly: boolean };
const INDEX_KEY = "kalks.tradeLogins";
const keyOf = (login: number) => `kalks.trade.${login}`;
const memory = new Map<number, Stored>();
const pending = new Map<number, Promise<ApiResult<{ token: string; expiresAt: string; readOnly: boolean; account: EngAccount }>>>();

function remember(login: number) {
  const list = new Set(kv.getJSON<number[]>(INDEX_KEY) ?? []);
  list.add(login);
  kv.setJSON(INDEX_KEY, [...list]);
}

async function stored(login: number): Promise<Stored | null> {
  const hit = memory.get(login);
  if (hit && Date.parse(hit.expiresAt) - Date.now() > 60_000) return hit;
  const raw = await secure.get(keyOf(login));
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Stored;
    if (Date.parse(s.expiresAt) - Date.now() > 60_000) {
      memory.set(login, s);
      return s;
    }
  } catch {}
  return null;
}

/** A fresh terminal session for `login` (SSO through the BFF). */
async function open(login: number) {
  let p = pending.get(login);
  if (!p) {
    p = api<{ token: string; expiresAt: string; readOnly: boolean; account: EngAccount }>("trade/session", { method: "POST", body: { login: String(login) } }).then(async (r) => {
      pending.delete(login);
      if (r.ok) {
        const s = { token: r.data.token, expiresAt: r.data.expiresAt ?? new Date(Date.now() + 8 * 3600e3).toISOString(), readOnly: !!r.data.readOnly };
        memory.set(login, s);
        remember(login);
        await secure.set(keyOf(login), JSON.stringify(s));
      }
      return r;
    });
    pending.set(login, p);
  }
  return p;
}

export async function tradeToken(login: number): Promise<{ ok: true; token: string; readOnly: boolean } | { ok: false; error: { code: string; message: string; status: number } }> {
  const s = await stored(login);
  if (s) return { ok: true, token: s.token, readOnly: s.readOnly };
  const r = await open(login);
  if (!r.ok) return { ok: false, error: { code: r.error.code, message: r.error.message, status: r.status } };
  return { ok: true, token: r.data.token, readOnly: !!r.data.readOnly };
}

export async function dropTradeSession(login: number) {
  memory.delete(login);
  await secure.remove(keyOf(login));
}

/** A trade call for `login`; a stale terminal session is replaced once, transparently. */
export async function tradeApi<T>(login: number, path: string, opts: ApiOptions = {}): Promise<ApiResult<T>> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const s = await tradeToken(login);
    if (!s.ok) return { ok: false, status: s.error.status, error: s.error };
    const r = await api<T>(`trade/${path}`, { ...opts, headers: { ...opts.headers, "x-kalks-trade": s.token } });
    if (!r.ok && r.status === 401 && r.error.code === "session_expired" && attempt === 0) {
      await dropTradeSession(login);
      continue;
    }
    return r;
  }
  return { ok: false, status: 401, error: { code: "session_expired", message: "Session expired" } };
}

// sign-out ends this phone's terminal sessions on the engine too (while the gateway session still counts)
onSignOut(async ({ remote }) => {
  const list = kv.getJSON<number[]>(INDEX_KEY) ?? [];
  for (const login of list) {
    const s = await stored(login);
    if (s && remote) await api("trade/logout", { method: "POST", body: {}, headers: { "x-kalks-trade": s.token } }).catch(() => null);
    await dropTradeSession(login);
  }
  kv.remove(INDEX_KEY);
});
