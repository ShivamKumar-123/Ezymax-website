// Kalks mobile design tokens. Dark first: near-black canvas, big saturated colour blocks, cream text.
// Rules: green / red are for money only (P&L, price direction), never decoration. No blur, glow or looping motion.

export const colors = {
  bg: "#0E0E10",
  bgRaised: "#131316",
  surface: "#18181C",
  surface2: "#202025",
  surface3: "#2A2A30",
  line: "rgba(245,239,227,0.08)",
  lineStrong: "rgba(245,239,227,0.16)",

  text: "#F5EFE3",
  text2: "rgba(245,239,227,0.66)",
  text3: "rgba(245,239,227,0.42)",
  /** Text on colour blocks */
  ink: "#0E0E10",
  ink2: "rgba(14,14,16,0.64)",
  ink3: "rgba(14,14,16,0.42)",

  ember: "#F26A3D",
  gold: "#F2B84B",
  mint: "#7FD1B9",
  periwinkle: "#8C8CF0",
  cream: "#F5EFE3",

  /** Money only: profit / buy / price up */
  up: "#34C77B",
  upSoft: "rgba(52,199,123,0.14)",
  /** Money only: loss / sell / price down */
  down: "#F05252",
  downSoft: "rgba(240,82,82,0.14)",

  warn: "#F2B84B",
  warnSoft: "rgba(242,184,75,0.12)",
  scrim: "rgba(0,0,0,0.6)",
} as const;

export type BlockColor = "ember" | "gold" | "mint" | "periwinkle" | "cream";
export const blockColors: Record<BlockColor, string> = {
  ember: colors.ember,
  gold: colors.gold,
  mint: colors.mint,
  periwinkle: colors.periwinkle,
  cream: colors.cream,
};

/** 4 / 8 pt spacing scale. */
export const space = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 28, 8: 32, 10: 40, 12: 48, 14: 56, 16: 64 } as const;
/** Horizontal screen gutter. */
export const GUTTER = 20;

export const radius = { xs: 8, sm: 12, md: 16, lg: 22, card: 28, block: 32, pill: 999 } as const;

/** Minimum touch target. */
export const HIT = 44;

export const fonts = {
  display: "Anton_400Regular",
  mono: "JetBrainsMono_400Regular",
  monoMedium: "JetBrainsMono_500Medium",
  monoBold: "JetBrainsMono_700Bold",
} as const;

/** Tall condensed uppercase display type (Anton). */
export const display = {
  hero: { fontSize: 60, lineHeight: 60 },
  xl: { fontSize: 46, lineHeight: 48 },
  lg: { fontSize: 36, lineHeight: 38 },
  md: { fontSize: 28, lineHeight: 30 },
  sm: { fontSize: 21, lineHeight: 24 },
  xs: { fontSize: 16, lineHeight: 19 },
} as const;
export type DisplaySize = keyof typeof display;

/** Body type (system font: SF Pro / Roboto). */
export const text = {
  title: { fontSize: 20, lineHeight: 26, fontWeight: "700" },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: "600" },
  body: { fontSize: 15, lineHeight: 21, fontWeight: "400" },
  callout: { fontSize: 14, lineHeight: 19, fontWeight: "500" },
  caption: { fontSize: 12.5, lineHeight: 16, fontWeight: "500" },
  label: { fontSize: 11, lineHeight: 14, fontWeight: "700", letterSpacing: 0.9, textTransform: "uppercase" },
} as const;
export type TextVariant = keyof typeof text;

export const motion = {
  /** press feedback */
  pressScale: 0.965,
  spring: { damping: 18, stiffness: 320, mass: 0.7 },
  springSoft: { damping: 22, stiffness: 180, mass: 0.9 },
  /** price flash fade */
  flashMs: 450,
} as const;

/** Floating tab bar geometry (screens pad their bottom by this). */
export const TAB_BAR = { height: 64, margin: 12 } as const;
