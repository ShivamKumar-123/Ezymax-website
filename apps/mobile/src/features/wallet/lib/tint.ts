// Translucent shades derived from the design tokens (never colour literals in feature code), so the wallet follows
// the palette whenever the tokens change.
import { colors } from "@/theme/tokens";

/** A token colour (#RRGGBB) at an opacity; any other format is returned as it is. */
export function alpha(color: string, a: number): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (!m) return color;
  return `rgba(${parseInt(m[1]!, 16)},${parseInt(m[2]!, 16)},${parseInt(m[3]!, 16)},${a})`;
}

/** Ink shades on a light colour block (dividers, tracks). */
export const onBlock = {
  line: alpha(colors.ink, 0.12),
  track: alpha(colors.ink, 0.14),
} as const;
