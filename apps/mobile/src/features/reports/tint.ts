// A token colour at a given opacity ("#F04438", 0.3 -> "rgba(240,68,56,0.3)"), so every translucent fill, hairline and
// heat tint on the reports screens follows the palette in @/theme/tokens instead of hard-coded rgba values.
import { alpha } from "@/theme/alpha";
import { colors } from "@/theme/tokens";

/** The app's helper (@/theme/alpha); the opacity is rounded to 3 decimals (computed heat tints). */
export function tint(hex: string, a: number): string {
  return alpha(hex, Math.round(a * 1000) / 1000);
}

/** Secondary text on a colour block: ink at 78 %, at least 4.5:1 on every block colour (ember 4.7, light ember 5.7,
 *  gold 6.7, sand 8.0, off-white 9.3). The kit's ink2 (66 %) is 3.7:1 on ember and 4.3:1 on light ember. */
export const inkSoft = alpha(colors.ink, 0.78);
