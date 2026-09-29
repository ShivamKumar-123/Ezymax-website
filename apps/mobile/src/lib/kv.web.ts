// Web preview only (react-native-web screenshots): localStorage.
const ls = (): Storage | null => (typeof localStorage === "undefined" ? null : localStorage);

export const kv = {
  get: (key: string): string | null => ls()?.getItem(key) ?? null,
  set: (key: string, value: string) => {
    try {
      ls()?.setItem(key, value);
    } catch {}
  },
  remove: (key: string) => ls()?.removeItem(key),
  getJSON<T>(key: string): T | null {
    const s = kv.get(key);
    if (!s) return null;
    try {
      return JSON.parse(s) as T;
    } catch {
      return null;
    }
  },
  setJSON: (key: string, value: unknown) => kv.set(key, JSON.stringify(value)),
  clearPrefix(prefix: string) {
    const s = ls();
    if (!s) return;
    for (const k of Object.keys(s)) if (k.startsWith(prefix)) s.removeItem(k);
  },
};
