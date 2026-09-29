// The signed-in client. The gateway session token lives in the secure store; the profile (`/auth/me`) is cached
// so a cold start opens straight into the app, then refreshed in the background. A 401 anywhere signs out.
// Presence and restrictions follow the Client Area: a heartbeat every 45 s while the app is in the foreground.
import { AppState } from "react-native";
import { api, apiPost, onApiUnauthorized, setApiSession } from "@/lib/api";
import { kv } from "@/lib/kv";
import { clearQueries, setQueryScope } from "@/lib/query";
import { secure } from "@/lib/secure";
import { createStore, useStore } from "@/lib/store";

export type Restriction = { kind: string; label?: string; expires_at: string | null };
export type ViewerScope = { id: number; label: string; accounts: string[]; sections: string[] };

export type Me = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  name: string;
  phone_dial?: string;
  phone?: string;
  country?: string;
  date_of_birth?: string;
  kyc_status: "unverified" | "pending" | "verified" | "rejected";
  kyc_case_status?: string | null;
  email_verified?: boolean;
  referral_code?: string;
  created_at?: string;
  tenant?: { slug: string; name: string };
  restrictions?: Restriction[];
  restricted?: string[];
};

export type SessionState = {
  status: "loading" | "signedOut" | "signedIn";
  user: Me | null;
  viewer: ViewerScope | null;
  restricted: string[];
  restrictions: Restriction[];
  /** set when the server ended the session (shown once on the sign-in screen) */
  expired?: boolean;
};

const TOKEN_KEY = "kalks.session";
const ME_KEY = "kalks.me";

export const sessionStore = createStore<SessionState>({ status: "loading", user: null, viewer: null, restricted: [], restrictions: [] });

export const useSession = <S>(select: (s: SessionState) => S) => useStore(sessionStore, select);
export const useMe = () => useStore(sessionStore, (s) => s.user);

/** Callbacks run on sign-out (feature modules drop their own state: trading sessions, streams…). */
const signOutHooks = new Set<() => void | Promise<void>>();
export function onSignOut(fn: () => void | Promise<void>) {
  signOutHooks.add(fn);
  return () => signOutHooks.delete(fn);
}

type MeResponse = { user?: Me; viewer?: ViewerScope | null; restrictions?: Restriction[]; restricted?: string[] };

function applyMe(d: MeResponse) {
  if (!d.user) return;
  kv.setJSON(ME_KEY, d);
  sessionStore.set((s) => ({
    ...s,
    status: "signedIn",
    user: d.user!,
    viewer: d.viewer ?? null,
    restricted: d.user!.restricted ?? d.restricted ?? [],
    restrictions: d.user!.restrictions ?? d.restrictions ?? [],
    expired: false,
  }));
}

/** App start: restore the session from the secure store (before the splash hides). */
export async function bootSession() {
  onApiUnauthorized(() => void endSession(true));
  const token = await secure.get(TOKEN_KEY);
  if (!token) {
    sessionStore.set((s) => ({ ...s, status: "signedOut" }));
    return;
  }
  setApiSession(token);
  const cached = kv.getJSON<MeResponse>(ME_KEY);
  if (cached?.user) {
    setQueryScope(cached.user.id);
    applyMe(cached);
    void refreshMe();
  } else {
    const ok = await refreshMe();
    if (!ok && sessionStore.get().status === "loading") sessionStore.set((s) => ({ ...s, status: "signedIn" }));
  }
  startHeartbeat();
}

export async function refreshMe(): Promise<boolean> {
  const r = await api<MeResponse>("auth/me");
  if (r.ok && r.data.user) {
    setQueryScope(r.data.user.id);
    applyMe(r.data);
    return true;
  }
  return false;
}

/** After sign-in / sign-up verification: keep the token, load the profile. */
export async function completeSignIn(session: { token: string; expires_at?: string }, user?: Me) {
  await secure.set(TOKEN_KEY, session.token);
  setApiSession(session.token);
  if (user) {
    setQueryScope(user.id);
    applyMe({ user });
  }
  await refreshMe();
  startHeartbeat();
}

/** Sign out on this phone (and end the session on the server unless it is already gone). */
export async function signOut() {
  await apiPost("auth/logout", {});
  await endSession(false);
}

async function endSession(expired: boolean) {
  if (sessionStore.get().status === "signedOut") return;
  stopHeartbeat();
  setApiSession(null);
  await secure.remove(TOKEN_KEY);
  kv.remove(ME_KEY);
  for (const fn of signOutHooks) {
    try {
      await fn();
    } catch {}
  }
  clearQueries();
  sessionStore.set({ status: "signedOut", user: null, viewer: null, restricted: [], restrictions: [], expired });
}

/* ---- presence + restrictions (same as the Client Area's open tab) ---- */

let beat: ReturnType<typeof setInterval> | null = null;
let appSub: { remove(): void } | null = null;

async function heartbeat() {
  if (AppState.currentState !== "active" || sessionStore.get().status !== "signedIn" || sessionStore.get().viewer) return;
  const r = await apiPost<{ restrictions?: Restriction[]; restricted?: string[] }>("auth/heartbeat", {});
  if (r.ok && (r.data.restricted || r.data.restrictions)) {
    sessionStore.set((s) => ({ ...s, restricted: r.data.restricted ?? s.restricted, restrictions: r.data.restrictions ?? s.restrictions }));
  }
}

function startHeartbeat() {
  if (beat) return;
  void heartbeat();
  beat = setInterval(() => void heartbeat(), 45_000);
  appSub = AppState.addEventListener("change", (s) => s === "active" && void heartbeat());
}

function stopHeartbeat() {
  if (beat) clearInterval(beat);
  beat = null;
  appSub?.remove();
  appSub = null;
}

/** Restriction kinds that block an action (e.g. "trading", "withdrawals"). */
export const isRestricted = (kind: string) => sessionStore.get().restricted.includes(kind);
