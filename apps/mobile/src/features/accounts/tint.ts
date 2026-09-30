// Shades of the design tokens for the accounts screens (never colour literals in feature code).
import { alpha } from "@/theme/alpha";
import { colors } from "@/theme/tokens";

/** Secondary text on a colour block: ink at 78 %, at least 4.5:1 on every block colour (ember 4.7, light ember 5.7,
 *  gold 6.7, sand 8.0, off-white 9.3). The kit's ink2 (66 %) is 3.7:1 on ember and 4.3:1 on light ember. */
export const inkSoft = alpha(colors.ink, 0.78);

/** "Done / met" marks (a password rule met): the warm off-white. Green is for money only, and "mint" is a light
 *  ember now, which reads as the brand accent rather than "done". */
export const OK = colors.cream;
