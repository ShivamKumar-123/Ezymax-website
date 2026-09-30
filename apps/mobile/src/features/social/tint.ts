// A token colour at a given opacity ("#FF5A1F", 0.3 -> "rgba(255,90,31,0.3)"), so every translucent tint of the
// social screens (tags, boxes, borders, hairlines on colour blocks, chart fills) follows the palette in tokens.ts
// (the web colour family) instead of hard-coded rgba values. rgba() tokens (ink2, line…) are returned as they are.
// The app's helper (@/theme/alpha), re-exported for the social screens.
import { alpha } from "@/theme/alpha";
import { colors } from "@/theme/tokens";

export { alpha };

/** Secondary text on a colour block: ink at 78 %, at least 4.5:1 on every block colour (ember 4.7, light ember 5.7,
 *  gold 6.7, sand 8.0, off-white 9.3). The kit's ink2 (66 %) is 3.7:1 on ember and 4.3:1 on light ember. */
export const inkSoft = alpha(colors.ink, 0.78);
