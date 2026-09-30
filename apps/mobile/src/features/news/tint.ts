// Translucent shades derived from the design tokens (never hex values in feature code): ink shades for fills and
// outlines on colour blocks, and the ember tint of the importance chip.
import { alpha } from "@/theme/alpha";
import { colors } from "@/theme/tokens";

/** A token colour (#RRGGBB) at an opacity: the app's helper (@/theme/alpha), re-exported for the news screens. */
export { alpha };

/** Ink shades on a colour block. */
export const onBlock = {
  line: alpha(colors.ink, 0.3),
  fill: alpha(colors.ink, 0.1),
  soft: alpha(colors.ink, 0.08),
  track: alpha(colors.ink, 0.18),
} as const;

/** Secondary text on a colour block: ink at 78 %, at least 4.5:1 on every block colour (ember 4.7, light ember 5.7,
 *  gold 6.7, sand 8.0, off-white 9.3). The kit's ink2 (66 %) is 3.7:1 on ember and 4.3:1 on light ember. */
export const inkSoft = alpha(colors.ink, 0.78);

export const emberLine = alpha(colors.ember, 0.5);
