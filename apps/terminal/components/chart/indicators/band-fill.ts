import type { IChartApi, IPrimitivePaneRenderer, IPrimitivePaneView, ISeriesApi, ISeriesPrimitive, Logical, SeriesAttachedParameter, SeriesType, Time } from "lightweight-charts";

type Target = Parameters<IPrimitivePaneRenderer["draw"]>[0];

export interface BandData {
  a: number[];
  b: number[];
  /** Plot shift in bars (value i is drawn at logical i + shift). */
  shift: number;
  /** Fill where a ≥ b. */
  up: string;
  /** Fill where a < b. */
  down: string;
  visible: boolean;
}

/**
 * Translucent fill between two value arrays (Bollinger / Keltner / Donchian bands, Ichimoku cloud), drawn under the series.
 * Only the visible logical range is walked each frame; colour changes at crossings are split exactly.
 */
export class BandFill implements ISeriesPrimitive<Time> {
  private chart: IChartApi | null = null;
  private series: ISeriesApi<SeriesType> | null = null;
  private req: (() => void) | null = null;
  private readonly get: () => BandData;
  private readonly renderer: IPrimitivePaneRenderer;
  private readonly view: IPrimitivePaneView;

  constructor(get: () => BandData) {
    this.get = get;
    this.renderer = { draw: (t) => this.paint(t) };
    this.view = { zOrder: () => "bottom", renderer: () => this.renderer };
  }

  attached(p: SeriesAttachedParameter<Time>) {
    this.chart = p.chart as IChartApi;
    this.series = p.series;
    this.req = p.requestUpdate;
  }

  detached() {
    this.chart = null;
    this.series = null;
    this.req = null;
  }

  redraw() {
    this.req?.();
  }

  paneViews() {
    return [this.view];
  }

  private paint(target: Target) {
    const chart = this.chart;
    const series = this.series;
    if (!chart || !series) return;
    const d = this.get();
    if (!d.visible) return;
    const ts = chart.timeScale();
    const r = ts.getVisibleLogicalRange();
    if (!r) return;
    target.useMediaCoordinateSpace(({ context: ctx }) => {
      const pu = new Path2D();
      const pd = new Path2D();
      const from = Math.max(0, Math.floor(r.from) - 1);
      const to = Math.ceil(r.to) + 1;
      let prev: { x: number; ya: number; yb: number; up: boolean } | null = null;
      for (let j = from; j <= to; j++) {
        const i = j - d.shift;
        const va = d.a[i];
        const vb = d.b[i];
        if (va === undefined || vb === undefined || Number.isNaN(va) || Number.isNaN(vb)) {
          prev = null;
          continue;
        }
        const x = ts.logicalToCoordinate(j as Logical);
        const ya = series.priceToCoordinate(va);
        const yb = series.priceToCoordinate(vb);
        if (x === null || ya === null || yb === null) {
          prev = null;
          continue;
        }
        const cur = { x, ya, yb, up: va >= vb };
        if (prev) {
          if (prev.up === cur.up) {
            const p = cur.up ? pu : pd;
            p.moveTo(prev.x, prev.ya);
            p.lineTo(cur.x, cur.ya);
            p.lineTo(cur.x, cur.yb);
            p.lineTo(prev.x, prev.yb);
            p.closePath();
          } else {
            const d0 = prev.ya - prev.yb;
            const d1 = cur.ya - cur.yb;
            const t = d0 / (d0 - d1);
            const xc = prev.x + (cur.x - prev.x) * t;
            const yc = prev.ya + (cur.ya - prev.ya) * t;
            const p1 = prev.up ? pu : pd;
            p1.moveTo(prev.x, prev.ya);
            p1.lineTo(xc, yc);
            p1.lineTo(prev.x, prev.yb);
            p1.closePath();
            const p2 = cur.up ? pu : pd;
            p2.moveTo(xc, yc);
            p2.lineTo(cur.x, cur.ya);
            p2.lineTo(cur.x, cur.yb);
            p2.closePath();
          }
        }
        prev = cur;
      }
      ctx.fillStyle = d.up;
      ctx.fill(pu);
      ctx.fillStyle = d.down;
      ctx.fill(pd);
    });
  }
}
