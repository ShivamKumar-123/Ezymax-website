// The trading account the app trades on: the Trade tab, Home and Portfolio read it; the Accounts screens set it
// ("Trade on this account"). It holds only the login number. The Trade tab decides the fallback when it is null or
// no longer one of the client's accounts (first live, else first demo) and writes its pick back with
// setActiveLogin; it also owns the quote group (feed.setGroup) and the trading-engine session.
//
// Kept per user on this phone (kv "kalks.activeLogin.<userId>") so the app reopens on the same account; the
// signed-in user's choice is loaded as soon as the session knows who it is, and cleared on sign-out.
import { kv } from "@/lib/kv";
import { createStore, useStore } from "@/lib/store";
import { onSignOut, sessionStore } from "./index";

export type ActiveAccountState = { login: number | null };

export const activeAccountStore = createStore<ActiveAccountState>({ login: null });

const keyOf = (userId: number) => `kalks.activeLogin.${userId}`;
const valid = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v > 0;

/** The user whose choice the store holds (null until the session knows the user). */
let owner: number | null = null;

function put(login: number | null) {
  if (activeAccountStore.get().login !== login) activeAccountStore.set({ login });
}

function save(userId: number, login: number | null) {
  if (login === null) kv.remove(keyOf(userId));
  else kv.set(keyOf(userId), String(login));
}

/** Loads the signed-in user's saved choice whenever the session's user changes. */
function hydrate() {
  const id = sessionStore.get().user?.id ?? null;
  if (id === owner) return;
  const prev = owner;
  owner = id;
  if (id === null) {
    put(null);
    return;
  }
  const current = activeAccountStore.get().login;
  // chosen before the profile arrived (offline start without a cached profile): keep it for this user
  if (prev === null && current !== null) {
    save(id, current);
    return;
  }
  const saved = Number(kv.get(keyOf(id)));
  put(valid(saved) ? saved : null);
}

hydrate();
sessionStore.subscribe(hydrate);

onSignOut(() => {
  const id = sessionStore.get().user?.id ?? owner;
  if (id !== null) kv.remove(keyOf(id));
  owner = null;
  put(null);
});

const selectLogin = (s: ActiveAccountState) => s.login;

/** The active trading account's login (re-renders only when it changes). */
export function useActiveLogin(): number | null {
  return useStore(activeAccountStore, selectLogin);
}

/** The active login outside React. */
export function getActiveLogin(): number | null {
  hydrate();
  return activeAccountStore.get().login;
}

/** Makes `login` the account the app trades on (null clears the choice). */
export function setActiveLogin(login: number | null): void {
  const next = valid(login) ? login : null;
  hydrate();
  if (owner !== null) save(owner, next);
  put(next);
}
