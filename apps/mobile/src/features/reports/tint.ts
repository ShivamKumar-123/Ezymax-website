// A token colour at a given opacity ("#F04438", 0.3 -> "rgba(240,68,56,0.3)"), so every translucent fill, hairline and
// heat tint on the reports screens follows the palette in @/theme/tokens instead of hard-coded rgba values.
import { alpha } from "@/theme/alpha";

/** The app's helper (@/theme/alpha); the opacity is rounded to 3 decimals (computed heat tints). */
export function tint(hex: string, a: number): string {
  return alpha(hex, Math.round(a * 1000) / 1000);
}
