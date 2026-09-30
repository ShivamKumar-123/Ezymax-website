// A random id per installation (X-Kalks-Device): the gateway uses it to recognise this phone and to ask for an
// email code on new devices. Kept in the secure store so it survives app updates but not a reinstall.
import { getRandomBytes } from "expo-crypto";
import { secure } from "./secure";

const KEY = "kalks.device";
let cached: string | null = null;
let loading: Promise<string> | null = null;

function base64url(bytes: Uint8Array): string {
  const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    const left = bytes.length - i;
    out += abc[(n >> 18) & 63]! + abc[(n >> 12) & 63]! + (left > 1 ? abc[(n >> 6) & 63]! : "") + (left > 2 ? abc[n & 63]! : "");
  }
  return out;
}

export function deviceId(): Promise<string> {
  if (cached) return Promise.resolve(cached);
  // one read for every request of the first moment: concurrent first calls must not mint different ids (the gateway
  // would see two devices, and the stored one might not be the one the sign-in used)
  loading ??= (async () => {
    let id = await secure.get(KEY);
    if (!id || !/^[A-Za-z0-9_-]{16,64}$/.test(id)) {
      id = base64url(getRandomBytes(24));
      await secure.set(KEY, id);
    }
    return (cached ??= id);
  })().finally(() => {
    loading = null;
  });
  return loading;
}

/** The server minted one for us (first request before ours was stored). */
export async function adoptDeviceId(id: unknown) {
  if (typeof id === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(id) && !cached) {
    cached = id;
    await secure.set(KEY, id);
  }
}

export const randomId = (bytes = 12) => base64url(getRandomBytes(bytes));
