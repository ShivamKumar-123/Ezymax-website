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
