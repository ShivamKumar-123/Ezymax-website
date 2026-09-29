// Translucent shades derived from the design tokens (never hex values in feature code): ink shades for fills and
// outlines on colour blocks, and the ember tint of the importance chip.
import { colors } from "@/theme/tokens";

/** A token colour (#RRGGBB) at an opacity; any other token format is returned as it is. */
export function alpha(color: string, a: number): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (!m) return color;
  return `rgba(${parseInt(m[1]!, 16)},${parseInt(m[2]!, 16)},${parseInt(m[3]!, 16)},${a})`;
}

/** Ink shades on a colour block. */
export const onBlock = {
  line: alpha(colors.ink, 0.3),
  fill: alpha(colors.ink, 0.1),
  soft: alpha(colors.ink, 0.08),
  track: alpha(colors.ink, 0.18),
} as const;

export const emberLine = alpha(colors.ember, 0.5);
