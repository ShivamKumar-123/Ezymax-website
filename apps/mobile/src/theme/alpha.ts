// A token colour at a given opacity ("#FF5A1F", 0.3 -> "rgba(255,90,31,0.3)"), so translucent tints (flash, hairline
// borders, pending-order lines) always follow the palette in tokens.ts instead of hard-coded rgba values.
export function alpha(hex: string, a: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
