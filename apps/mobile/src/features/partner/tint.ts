// Translucent colours for the partner and rewards screens, derived from the palette tokens (never hex values in
// feature code, so everything follows tokens.ts): hairlines, tracks and cells drawn on the light colour blocks, the
// borders of the state tags, and the highlight of the reader's own row.
import { colors } from "@/theme/tokens";

/** A token colour (#rrggbb) at `a` opacity. */
export function alpha(hex: string, a: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export const tint = {
  /** a hairline on a colour block (ink text sits on the blocks) */
  inkLine: alpha(colors.ink, 0.14),
  /** a quiet cell on a colour block (countdown digits) */
  inkFill: alpha(colors.ink, 0.1),
  /** a progress track on a colour block */
  inkTrack: alpha(colors.ink, 0.16),
  /** tag borders: warning, money lost / refused, money paid */
  warnBorder: alpha(colors.warn, 0.35),
  riskBorder: alpha(colors.down, 0.4),
  okBorder: alpha(colors.up, 0.35),
  /** the reader's own row (leaderboard), a chosen account */
  emberRow: alpha(colors.ember, 0.08),
  /** the reader's tier, an affordable reward */
  goldRow: alpha(colors.gold, 0.07),
  goldBorder: alpha(colors.gold, 0.4),
  /** an active programme (the light ember block tone) */
  mintBorder: alpha(colors.mint, 0.35),
} as const;
