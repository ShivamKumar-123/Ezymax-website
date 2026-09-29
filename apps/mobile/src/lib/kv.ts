// Small synchronous key-value store for cached screen data and preferences (not secrets: those go to secure.ts).
// Native: expo-sqlite's kv-store (works in Expo Go, synchronous reads so screens open on cached content).
import Storage from "expo-sqlite/kv-store";

export const kv = {
  get(key: string): string | null {
    try {
      return Storage.getItemSync(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      Storage.setItemSync(key, value);
    } catch {
      // storage full / unavailable: the cache is an optimisation only
    }
  },
  remove(key: string) {
    try {
      Storage.removeItemSync(key);
    } catch {}
  },
  getJSON<T>(key: string): T | null {
    const s = kv.get(key);
    if (!s) return null;
    try {
      return JSON.parse(s) as T;
    } catch {
      return null;
    }
  },
  setJSON(key: string, value: unknown) {
    kv.set(key, JSON.stringify(value));
  },
  /** Removes every key starting with `prefix` (sign-out clears the user's cache). */
  clearPrefix(prefix: string) {
    try {
      for (const k of Storage.getAllKeysSync()) if (k.startsWith(prefix)) Storage.removeItemSync(k);
    } catch {}
  },
};
