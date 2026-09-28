/** Deterministic PRNG so mock data is stable between server and client renders. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seeded(seed: number) {
  const r = mulberry32(seed);
  return {
    next: r,
    range: (min: number, max: number) => min + r() * (max - min),
    int: (min: number, max: number) => Math.floor(min + r() * (max - min + 1)),
    pick: <T,>(arr: readonly T[]): T => arr[Math.floor(r() * arr.length)]!,
    bool: (p = 0.5) => r() < p,
    normal: () => {
      const u = Math.max(r(), 1e-9);
      const v = r();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
  };
}

export function hashString(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
