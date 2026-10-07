import type { IPanePrimitive, IPanePrimitivePaneView, IPrimitivePaneRenderer, PaneAttachedParameter, Time } from "lightweight-charts";

/**
 * Broker branding inside a chart pane: only the small Kalks K in the bottom-left corner of the plot (as TradingView
 * shows its logo); no symbol watermark, so the plot stays clean (docs/TERMINAL-DESIGN.md §2.2). Drawn on the chart
 * canvas (bottom z-order): never takes pointer events, stays inside the pane (never on the axes) and is part of
 * `chart.takeScreenshot()`. The symbol / timeframe / name options are kept for callers but no longer drawn.
 */

/** Kalks mark (public/assets/brand/kalks-mark.svg), viewBox 653 x 541. */
const MARK_D = "M 403.113 2.545 C 382.191 7.084, 370.755 13.650, 346.500 35.052 C 338.250 42.332, 320.925 57.415, 308 68.571 C 295.075 79.727, 271.225 100.410, 255 114.535 C 238.775 128.659, 217.888 146.794, 208.584 154.835 C 184.119 175.980, 178.518 183.282, 173.512 200.554 L 171 209.224 171 273.457 C 171 343.176, 170.712 339.361, 176.125 341.269 C 179.126 342.326, 187.413 337.402, 223.546 313.086 C 299.928 261.683, 352.834 224.527, 423.005 173 C 436.861 162.825, 455.241 149.385, 463.849 143.133 C 472.457 136.882, 484.450 128.070, 490.500 123.551 C 496.550 119.032, 506.225 111.857, 512 107.606 C 525.694 97.526, 590.533 48.622, 602.811 39.112 C 608.057 35.049, 617.783 27.637, 624.425 22.642 C 631.066 17.647, 640.031 10.734, 644.346 7.280 L 652.192 1 530.846 1.079 C 431.400 1.145, 408.347 1.409, 403.113 2.545 M 135.134 63.542 C 106.181 79.766, 63.818 105.655, 49.568 115.834 C 39.269 123.191, 23.932 137.825, 18.510 145.470 C 12.674 153.699, 7.552 164.207, 4.257 174.712 L 1.500 183.500 1.232 338.325 L 0.963 493.151 5.232 490.175 C 7.579 488.539, 21.875 478.983, 37 468.941 C 102.832 425.232, 131.171 400.632, 140.735 378.892 C 146.852 364.986, 146.500 375.277, 146.500 210.500 L 146.500 60.500 144 60.238 C 142.583 60.089, 138.744 61.520, 135.134 63.542 M 320 284.624 C 300.125 288.511, 288.493 295.042, 231.500 334.316 C 199.923 356.077, 192.902 361.250, 193.199 362.540 C 193.731 364.854, 322.089 498.457, 338.940 514.237 C 351.464 525.965, 366.500 534.233, 382.107 537.974 C 390.252 539.927, 393.740 539.986, 500.250 539.993 C 560.612 539.997, 610 539.747, 610 539.437 C 610 538.507, 567.999 494.055, 509.045 432.590 C 478.495 400.739, 447.695 368.564, 440.599 361.090 C 415.222 334.357, 386.390 305.726, 380 300.913 C 366.069 290.420, 351.004 285.163, 333 284.514 C 327.225 284.306, 321.375 284.355, 320 284.624";
const MARK_W = 653;
const MARK_H = 541;

export interface BrandWatermarkOptions {
  symbol: string;
  tf: string;
  name: string;
  dark: boolean;
  font: string;
}

type Target = Parameters<IPrimitivePaneRenderer["draw"]>[0];

let markPath: Path2D | null = null;
const mark = () => (markPath ??= new Path2D(MARK_D));

class Renderer implements IPrimitivePaneRenderer {
  constructor(private o: BrandWatermarkOptions) {}
  draw() {}
  drawBackground(target: Target) {
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      const { width: w, height: h } = mediaSize;
      if (w < 120 || h < 80) return;
      // the Kalks K in the plot's bottom-left corner, the way TradingView shows its logo: small, subtle, inside the
      // pane (never on the price or time scale), drawn on the canvas so screenshots carry it
      const markH = h < 220 ? 14 : 18;
      const markW = (markH * MARK_W) / MARK_H;
      const pad = 10;
      ctx.save();
      ctx.translate(pad, h - pad - markH);
      ctx.scale(markW / MARK_W, markH / MARK_H);
      ctx.fillStyle = this.o.dark ? "rgba(255,255,255,0.28)" : "rgba(15,15,20,0.26)";
      ctx.fill(mark(), "evenodd");
      ctx.restore();
    });
  }
}

class View implements IPanePrimitivePaneView {
  constructor(private src: BrandWatermark) {}
  zOrder() {
    return "bottom" as const;
  }
  renderer() {
    return new Renderer(this.src.options);
  }
}

export class BrandWatermark implements IPanePrimitive<Time> {
  private views: readonly IPanePrimitivePaneView[];
  private requestUpdate: (() => void) | null = null;
  constructor(public options: BrandWatermarkOptions) {
    this.views = [new View(this)];
  }
  attached(p: PaneAttachedParameter<Time>) {
    this.requestUpdate = p.requestUpdate;
  }
  detached() {
    this.requestUpdate = null;
  }
  paneViews() {
    return this.views;
  }
  applyOptions(patch: Partial<BrandWatermarkOptions>) {
    this.options = { ...this.options, ...patch };
    this.requestUpdate?.();
  }
}
