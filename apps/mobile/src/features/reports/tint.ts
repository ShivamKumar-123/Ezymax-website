// A token colour at a given opacity ("#F04438", 0.3 -> "rgba(240,68,56,0.3)"), so every translucent fill, hairline and
// heat tint on the reports screens follows the palette in @/theme/tokens instead of hard-coded rgba values.
export function tint(hex: string, a: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.round(a * 1000) / 1000})`;
}
