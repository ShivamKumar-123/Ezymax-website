/**
 * POST /api/engine/login {login, password, server?}: MT5-style terminal login (trading or investor password).
 * The engine session token goes into the HttpOnly session cookie (next to any other logins on this browser);
 * the browser gets the account view and whether the session is read-only.
 */
import type { NextRequest } from "next/server";
import { LOGIN_RE, clientAccount, csrf, engine, error, readSessions, reply, soft, withSession, writeSessions, type Obj } from "@/lib/engine/server";

export const dynamic = "force-dynamic";

const SERVERS: Record<string, "live" | "demo"> = { "Ezymex-Live": "live", "Ezymex-Demo": "demo" };

export async function POST(req: NextRequest) {
  return soft(req, await login(req));
}

async function login(req: NextRequest) {
  const blocked = csrf(req);
  if (blocked) return blocked;
  const body = (await req.json().catch(() => null)) as { login?: unknown; password?: unknown; server?: unknown } | null;
  const login = String(body?.login ?? "").trim();
  const password = typeof body?.password === "string" ? body.password : "";
  if (!LOGIN_RE.test(login)) return error(422, "validation", "Enter your 8-digit account number (login).");
  if (!password || password.length > 128) return error(422, "validation", "Enter your trading or investor password.");
  const server = typeof body?.server === "string" ? body.server : undefined;
  if (server !== undefined && !SERVERS[server]) return error(422, "validation", "Unknown server.");

  const r = await engine<{ token?: string; expiresAt?: string; readOnly?: boolean; account?: Obj; error?: Obj }>("/v1/terminal/login", { body: { login: Number(login), password }, req });
  if (r.status !== 200 || !r.data.token) return reply(r.status === 200 ? 502 : r.status, r.data.error ? { error: r.data.error } : { error: { code: "engine_error", message: "Login failed." } });

  // MT5: an account only exists on its own server
  const type = r.data.account?.type;
  if (server && type && SERVERS[server] !== type) {
    await engine("/v1/terminal/logout", { method: "POST", bearer: r.data.token, req });
    const right = type === "demo" ? "Ezymex-Demo" : "Ezymex-Live";
    return error(409, "wrong_server", `Account ${login} is on ${right}, not ${server}.`);
  }

  const readOnly = !!r.data.readOnly;
  const exp = Date.parse(r.data.expiresAt ?? "") || Date.now() + 12 * 3600e3;
  const res = reply(200, { login, readOnly, expiresAt: new Date(exp).toISOString(), account: await clientAccount(r.data.account) });
  return writeSessions(req, res, withSession(readSessions(req), { l: login, t: r.data.token, r: readOnly, e: exp }));
}
