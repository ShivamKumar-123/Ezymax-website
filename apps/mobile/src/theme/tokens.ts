// Kalks mobile design tokens. Same colour family as the web platform (packages/ui/src/styles.css, dark theme):
// near-black canvas, graphite surfaces, neutral white text, Kalks ember + gold, and warm light tones for blocks.
// MATTE FINISH: every surface is a flat solid fill. No gradients, gloss, sheen, glass, drop shadows or glows.
// Rules: green / red are for money only (P&L, price direction), never decoration. No blur or looping motion.

export const colors = {
  bg: "#07070A",
  bgRaised: "#0C0C0F",
  surface: "#111114",
  surface2: "#17171C",
  surface3: "#1E1E24",
  line: "rgba(255,255,255,0.07)",
  lineStrong: "rgba(255,255,255,0.14)",

  text: "#F5F5F7",
  text2: "#A1A1AA",
  text3: "#63636E",
  /** Text on colour blocks (every block colour is light enough for ink text) */
  ink: "#0E0E12",
  ink2: "rgba(14,14,18,0.66)",
  ink3: "rgba(14,14,18,0.44)",

  /** Kalks ember (web --k-ember) */
  ember: "#FF5A1F",
  /** Lighter ember (web --k-ember-2) */
  ember2: "#FF8A3D",
  emberSoft: "rgba(255,90,31,0.12)",
  /** Kalks gold (web --k-gold) */
  gold: "#E9B949",
  goldSoft: "rgba(233,185,73,0.12)",
  /** Block tone "mint" (kept for compatibility): now the lighter ember, same family as the web */
  mint: "#FF8A3D",
  /** Block tone "periwinkle" (kept for compatibility): now a warm sand tint of Kalks gold */
  periwinkle: "#EAD9B8",
  /** Warm off-white (web light theme --k-bg) */
  cream: "#F6F4F1",

  /** Money only: profit / buy / price up (web --k-up) */
  up: "#22C55E",
  upSoft: "rgba(34,197,94,0.12)",
  /** Money only: loss / sell / price down (web --k-down) */
  down: "#F04438",
  downSoft: "rgba(240,68,56,0.12)",

  warn: "#F59E0B",
  warnSoft: "rgba(245,158,11,0.12)",
  info: "#38BDF8",
  infoSoft: "rgba(56,189,248,0.12)",
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
