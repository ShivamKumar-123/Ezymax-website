// App lock rules, pure (scripts/platform-links.test.mts): the lock-after choices and when the lock is due.

export type LockSettings = {
  /** ask for Face ID / fingerprint / the phone's passcode */
  enabled: boolean;
  /** how long the app may stay in the background before it asks again (seconds; 0 = immediately) */
  timeoutSec: number;
};

/** "Lock again after" choices (seconds). */
export const TIMEOUTS = [0, 60, 300, 900, 3600] as const;

export const DEFAULT_LOCK: LockSettings = { enabled: false, timeoutSec: 60 };

export function cleanSettings(v: unknown): LockSettings {
  const o = (v && typeof v === "object" ? v : {}) as Partial<LockSettings>;
  const timeoutSec = (TIMEOUTS as readonly number[]).includes(Number(o.timeoutSec)) ? Number(o.timeoutSec) : DEFAULT_LOCK.timeoutSec;
  return { enabled: o.enabled === true, timeoutSec };
}

/**
 * Whether coming back to the app needs an unlock: the lock is on and the app spent at least `timeoutSec` in the
 * background. A clock that moved backwards (the user changed the time) locks instead of trusting it.
 */
export function lockDue(s: LockSettings, backgroundAt: number | null, now: number): boolean {
  if (!s.enabled || backgroundAt === null) return false;
  const away = now - backgroundAt;
  return away < 0 || away >= s.timeoutSec * 1000;
}
