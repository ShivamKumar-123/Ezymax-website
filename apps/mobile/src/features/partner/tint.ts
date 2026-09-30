// Translucent colours for the partner and rewards screens, derived from the palette tokens (never hex values in
// feature code, so everything follows tokens.ts): hairlines, tracks and cells drawn on the light colour blocks, the
// state tags, and the highlight of the reader's own row. States use the brand palette like the wallet and social
// screens (settled = warm off-white, waiting = gold, refused / failed = ember); green and red stay for money amounts.
import { alpha } from "@/theme/alpha";
import { colors } from "@/theme/tokens";

export { alpha };

export const tint = {
  /** a hairline on a colour block (ink text sits on the blocks) */
  inkLine: alpha(colors.ink, 0.14),
  /** a quiet cell on a colour block (countdown digits) */
  inkFill: alpha(colors.ink, 0.1),
  /** a progress track on a colour block */
  inkTrack: alpha(colors.ink, 0.16),
  /** a state that waits for someone (pending, awaiting approval, opt-in, a reason a deal earned nothing) */
  waitBg: colors.goldSoft,
  waitBorder: alpha(colors.gold, 0.35),
  /** refused / failed (a rejected line, a failed payout, a refused code) */
  failBg: colors.emberSoft,
  failBorder: alpha(colors.ember, 0.38),
  /** settled (paid, completed, applied, claimed) */
  doneBg: alpha(colors.cream, 0.1),
  doneBorder: alpha(colors.cream, 0.26),
  /** the reader's own row (leaderboard), a chosen account */
  emberRow: alpha(colors.ember, 0.08),
  /** the reader's tier, an affordable reward */
  goldRow: alpha(colors.gold, 0.07),
  goldBorder: alpha(colors.gold, 0.4),
  /** an active programme (the light ember block tone) */
  mintBorder: alpha(colors.mint, 0.35),
} as const;
