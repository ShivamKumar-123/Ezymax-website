"use client";

import * as React from "react";
import {
  AreaSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineStyle,
  createChart,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { useTheme } from "next-themes";
import { cn } from "../lib/cn";

function cssVar(name: string) {
  if (typeof window === "undefined") return "#000";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export interface SeriesPoint {
  time: number;
  value: number;
  volume?: number;
}

/**
 * Gold line over a dotted grid with thin volume bars at the bottom and a
 * dashed crosshair — the FX-reference chart style.
 */
export function EquityChart({
  data,
  height = 280,
  color = "gold",
  className,
  showVolume = true,
  onHover,
  lines,
  intraday = false,
}: {
  /** Show hours/minutes on the time axis (intraday series). */
  intraday?: boolean;
  data: SeriesPoint[];
  /** Horizontal reference lines, e.g. max-loss or profit-target levels. */
  lines?: { price: number; label: string; tone?: "up" | "down" | "gold" | "ember" | "fg-3" }[];
  height?: number;
  color?: "gold" | "ember" | "up" | "down";
  className?: string;
  showVolume?: boolean;
  onHover?: (p: SeriesPoint | null) => void;
}) {
  const el = React.useRef<HTMLDivElement>(null);
  const chartRef = React.useRef<IChartApi | null>(null);
  const { resolvedTheme } = useTheme();

  React.useEffect(() => {
    if (!el.current) return;
    const line = cssVar(`--k-${color}`) || "#e9b949";
    const fg3 = cssVar("--k-fg-3");
    const fg2 = cssVar("--k-fg-2");
    const chart = createChart(el.current, {
      height,
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: fg3, fontFamily: "var(--font-geist-mono), monospace", fontSize: 11, attributionLogo: false },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.12, bottom: showVolume ? 0.22 : 0.06 } },
      timeScale: { borderVisible: false, timeVisible: intraday, secondsVisible: false, fixLeftEdge: true, fixRightEdge: true },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: { color: fg2, width: 1, style: LineStyle.Dashed, labelBackgroundColor: cssVar("--k-surface-3") },
        horzLine: { visible: false, labelVisible: false },
      },
      handleScroll: false,
      handleScale: false,
    });
    chartRef.current = chart;

    const area = chart.addSeries(AreaSeries, {
      lineColor: line,
      lineWidth: 2,
      topColor: `${line}33`,
      bottomColor: `${line}00`,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerRadius: 5,
      crosshairMarkerBorderColor: line,
      crosshairMarkerBackgroundColor: cssVar("--k-bg"),
    });
    area.setData(data.map((d) => ({ time: d.time as UTCTimestamp, value: d.value })));
    for (const l of lines ?? []) {
      area.createPriceLine({ price: l.price, color: cssVar(`--k-${l.tone ?? "down"}`), lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: l.label });
    }

    if (showVolume) {
      const vol = chart.addSeries(HistogramSeries, { priceScaleId: "vol", priceLineVisible: false, lastValueVisible: false });
      chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      vol.setData(
        data.map((d, i) => ({
          time: d.time as UTCTimestamp,
          value: d.volume ?? 0,
          color: i > 0 && d.value < data[i - 1]!.value ? `${fg3}99` : `${fg2}66`,
        })),
      );
    }
    chart.timeScale().fitContent();

    if (onHover) {
      chart.subscribeCrosshairMove((p) => {
        if (!p.time) return onHover(null);
        const hit = data.find((d) => d.time === p.time);
        onHover(hit ?? null);
      });
    }
    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [data, height, color, showVolume, resolvedTheme, onHover, lines, intraday]);

  return (
    <div className={cn("relative", className)} style={{ height }}>
      <div className="k-dotgrid absolute inset-0 rounded-xl opacity-70" />
      <div ref={el} className="absolute inset-0" />
    </div>
  );
}
