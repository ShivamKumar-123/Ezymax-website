// A token colour at a given opacity ("#FF5A1F", 0.3 -> "rgba(255,90,31,0.3)"), so every translucent tint of the
// social screens (tags, boxes, borders, hairlines on colour blocks, chart fills) follows the palette in tokens.ts
// (the web colour family) instead of hard-coded rgba values. rgba() tokens (ink2, line…) are returned as they are.
// The app's helper (@/theme/alpha), re-exported for the social screens.
export { alpha } from "@/theme/alpha";
