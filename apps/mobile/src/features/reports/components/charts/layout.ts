// Chart geometry shared by the Skia chart and its placeholders (no Skia import: safe before CanvasKit loads on web).
export const CURVE = { tip: 46, main: 170, gap: 26, dd: 58 } as const;
export const CURVE_H = CURVE.tip + CURVE.main + CURVE.gap + CURVE.dd;
