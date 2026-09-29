// Translucent tints of the palette tokens (callout, pill and state backgrounds), e.g. tint(colors.mint, 0.12).
// Takes #rrggbb or rgba()/rgb() tokens (e.g. colors.text2) and returns the same colour at `alpha`.
const cache = new Map<string, string>();

export function tint(color: string, alpha: number): string {
  const key = `${color}:${alpha}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let rgb: [number, number, number] | null = null;
  const hex = /^#([0-9a-f]{6})$/i.exec(color);
  if (hex) {
    const n = parseInt(hex[1]!, 16);
    rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  } else {
    const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(color);
    if (m) rgb = [Number(m[1]), Number(m[2]), Number(m[3])];
  }
  const out = rgb ? `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})` : color;
  cache.set(key, out);
  return out;
}
