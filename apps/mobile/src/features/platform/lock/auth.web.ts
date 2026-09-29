// Web preview: a browser has no Face ID / fingerprint prompt, so the app lock is unavailable there. A preview built
// with EXPO_PUBLIC_WEB_DEVICE_DEMO=1 pretends to be a phone with Face ID whose prompt takes a moment and confirms
// (or answers what localStorage "kalks.demo.auth" says: cancel / failed / lockout), only to exercise the lock screens
// in screenshots and end-to-end checks. Phone builds never use this file.
import type { AuthResult, Capability, LockMethod } from "./auth";

export type { AuthResult, Capability, LockMethod };

const DEMO = process.env.EXPO_PUBLIC_WEB_DEVICE_DEMO === "1";

export async function capability(): Promise<Capability> {
  return DEMO ? { available: true, method: "faceId" } : { available: false, method: null };
}

export async function authenticate(_prompt: string, _subtitle: string, _cancel: string): Promise<AuthResult> {
  if (!DEMO) return "unavailable";
  await new Promise((r) => setTimeout(r, 900));
  let answer: string | null = null;
  try {
    answer = globalThis.localStorage?.getItem("kalks.demo.auth") ?? null;
  } catch {}
  return answer === "cancel" || answer === "failed" || answer === "lockout" ? answer : "ok";
}
