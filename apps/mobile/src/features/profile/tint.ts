// Translucent shades derived from the design tokens (never fixed rgba values in feature code), so status chips,
// icon discs and outlines follow the palette when the tokens change.
import { alpha } from "@/theme/alpha";
import { colors } from "@/theme/tokens";

export { alpha };

/** "Done / on / verified" marks: the warm off-white. Green is for money only, and the block tones (ember, light
 *  ember, gold) are one family now, so a light-ember "verified" next to an ember "not approved" would not read. */
export const OK = colors.cream;

/** Soft fills behind a coloured label or icon, and the matching outlines. */
export const tint = {
  ok: alpha(OK, 0.1),
  okLine: alpha(OK, 0.3),
  gold: alpha(colors.gold, 0.14),
  goldLine: alpha(colors.gold, 0.4),
  ember: alpha(colors.ember, 0.14),
  emberLine: alpha(colors.ember, 0.45),
  periwinkle: alpha(colors.periwinkle, 0.14),
  /** shades of ink on a colour block */
  inkFill: alpha(colors.ink, 0.08),
  inkChip: alpha(colors.ink, 0.12),
} as const;

/** Secondary text on a colour block: ink at 78 %, at least 4.5:1 on every block colour (ember 4.7, light ember 5.7,
 *  gold 6.7, sand 8.0, off-white 9.3). The kit's ink2 (66 %) is 3.7:1 on ember and 4.3:1 on light ember. */
export const inkSoft = alpha(colors.ink, 0.78);
