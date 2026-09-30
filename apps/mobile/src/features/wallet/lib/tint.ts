// Translucent shades derived from the design tokens (never colour literals in feature code), so the wallet follows
// the palette whenever the tokens change.
import { alpha } from "@/theme/alpha";
import { colors } from "@/theme/tokens";

/** A token colour (#RRGGBB) at an opacity: the app's helper (@/theme/alpha), re-exported for the wallet screens. */
export { alpha };

/** Ink shades on a light colour block (dividers, tracks). */
export const onBlock = {
  line: alpha(colors.ink, 0.12),
  track: alpha(colors.ink, 0.14),
} as const;

/** Secondary text on a colour block: ink at 78 %, at least 4.5:1 on every block colour (ember 4.7, light ember 5.7,
 *  gold 6.7, sand 8.0, off-white 9.3). The kit's ink2 (66 %) is 3.7:1 on ember and 4.3:1 on light ember. */
export const inkSoft = alpha(colors.ink, 0.78);
