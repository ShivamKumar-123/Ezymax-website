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

export const emberLine = alpha(colors.ember, 0.5);
