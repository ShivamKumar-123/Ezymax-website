// App lock state for this phone (Settings › App lock). When it is on:
// - a cold start with a saved session opens locked (the lock covers the first frame; nothing shows behind it);
// - coming back after the chosen time in the background locks again ("immediately" = any trip to the background);
// - while the app is in the app switcher (iOS inactive, background) a cover hides balances.
// A fresh sign-in with the password never asks again straight away. Signing out clears the lock (nothing to hide).
// The setting belongs to the phone (kv), not the account.
import { AppState, type AppStateStatus } from "react-native";
import { i18n } from "@/i18n";
import { kv } from "@/lib/kv";
import { createStore, useStore } from "@/lib/store";
import { sessionStore, type SessionState } from "@/session";
import { toast } from "@/ui";
import { authenticate, capability, type AuthResult, type Capability } from "./auth";
import { cleanSettings, lockDue, type LockSettings } from "./policy";

const KEY = "kalks.appLock";

export type LockState = {
  settings: LockSettings;
  /** an unlock is needed */
  locked: boolean;
  /** the app is in the app switcher: hide what is on screen */
  cover: boolean;
};

const saved = cleanSettings(kv.getJSON(KEY));
// a session restored at start opens locked; the session subscription below unlocks after a password sign-in
export const lockStore = createStore<LockState>({ settings: saved, locked: saved.enabled && sessionStore.get().status !== "signedOut", cover: false });

const selectLocked = (s: LockState) => s.locked;
const selectCover = (s: LockState) => s.cover;
const selectSettings = (s: LockState) => s.settings;
export const useLocked = () => useStore(lockStore, selectLocked);
export const useCover = () => useStore(lockStore, selectCover);
export const useLockSettings = () => useStore(lockStore, selectSettings);

let backgroundAt: number | null = null;
/** a system prompt of ours is up */
let prompting = false;
/** until then, foreground / background changes come from that prompt (it makes the app inactive and active again) */
let quietUntil = 0;
const settle = () => {
  prompting = false;
  quietUntil = Date.now() + 700;
};

function patch(p: Partial<LockState>) {
  lockStore.set((s) => {
    const next = { ...s, ...p };
    return next.locked === s.locked && next.cover === s.cover && next.settings === s.settings ? s : next;
  });
}

// session: restored at start -> stays locked; signed in with the password now -> no second check; signed out -> off
let lastStatus: SessionState["status"] = sessionStore.get().status;
sessionStore.subscribe(() => {
  const status = sessionStore.get().status;
  if (status === lastStatus) return;
  const from = lastStatus;
  lastStatus = status;
  if (status === "signedOut" || (from === "signedOut" && status === "signedIn")) {
    backgroundAt = null;
    patch({ locked: false, cover: false });
  }
  // a phone whose screen lock was removed can never confirm the owner: after the password sign-in (the owner's proof)
  // the lock is switched off instead of locking them out again at the next start
  if (from === "signedOut" && status === "signedIn" && lockStore.get().settings.enabled) {
    void capability().then((c) => {
      if (c.available || !lockStore.get().settings.enabled) return;
      saveLockSettings({ ...lockStore.get().settings, enabled: false });
      toast.show({ title: i18n.t("mobilePlatform.settings.off"), body: i18n.t("mobilePlatform.settings.turnedOffNoScreenLock") });
    });
  }
});

function onAppState(next: AppStateStatus) {
  const { settings } = lockStore.get();
  if (!settings.enabled || prompting || Date.now() < quietUntil || sessionStore.get().status !== "signedIn") return;
  if (next === "background") {
    if (backgroundAt === null) backgroundAt = Date.now();
    patch({ cover: true });
  } else if (next === "inactive") {
    patch({ cover: true });
  } else if (next === "active") {
    const due = lockDue(settings, backgroundAt, Date.now());
    backgroundAt = null;
    patch({ locked: lockStore.get().locked || due, cover: false });
  }
}

let watching = false;
/** Follows the app's foreground / background state (once, from PlatformRoot). */
export function watchAppState() {
  if (watching) return;
  watching = true;
  AppState.addEventListener("change", onAppState);
}

export function saveLockSettings(next: LockSettings) {
  const clean = cleanSettings(next);
  kv.setJSON(KEY, clean);
  patch({ settings: clean, ...(clean.enabled ? {} : { locked: false, cover: false }) });
}

/** Locks at once (Settings › Lock now, /lock). */
export function lockNow() {
  if (lockStore.get().settings.enabled) patch({ locked: true });
}

/** Shows the system prompt; unlocks on success. */
export async function confirmOwner(prompt = i18n.t("mobilePlatform.lock.prompt")): Promise<AuthResult> {
  if (prompting) return "cancel";
  prompting = true;
  try {
    return await authenticate(prompt, i18n.t("mobilePlatform.lock.promptSubtitle"), i18n.t("common.cancel"));
  } finally {
    settle();
  }
}

/** Runs a system dialog of our own (the notification permission prompt) without the app switcher cover flashing
 *  behind it. */
export async function withSystemDialog<T>(fn: () => Promise<T>): Promise<T> {
  prompting = true;
  try {
    return await fn();
  } finally {
    settle();
  }
}

export async function unlock(): Promise<AuthResult> {
  const r = await confirmOwner();
  if (r === "ok") {
    backgroundAt = null;
    patch({ locked: false, cover: false });
  }
  return r;
}

export { capability, type Capability };
