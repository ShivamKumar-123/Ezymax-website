"use client";

// "Statistics" card of the dashboard: a segmented Equity | P&L switch, Weekly · Monthly · Last year text tabs, and
// the period's line against the previous period (dashed). The parent supplies the series for the chosen view.

import * as React from "react";
import { Card, ChangeChip, Segmented, Skeleton, Tabs, formatMoney } from "@/components/kit";
import { useFormat, useT } from "@kalks/i18n/react";
import { TrendChart, type TrendPoint } from "./trend-chart";

export type StatMode = "equity" | "pnl";
export type StatRange = "week" | "month" | "year";
export const RANGE_DAYS: Record<StatRange, number> = { week: 7, month: 30, year: 365 };

export function compactMoney(v: number) {
  const a = Math.abs(v);
  const s = v < 0 ? "-" : "";
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M`;
  if (a >= 1e4) return `${s}$${(a / 1e3).toFixed(0)}k`;
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(1)}k`;
  return `${s}$${a.toFixed(0)}`;
}

export function StatisticCard({
  mode,
  onMode,
  range,
  onRange,
  points,
  compare,
  loading,
  emptyText,
  className,
}: {
  mode: StatMode;
  onMode: (m: StatMode) => void;
  range: StatRange;
  onRange: (r: StatRange) => void;
  points: TrendPoint[] | null;
  compare?: number[] | null;
  loading?: boolean;
  emptyText?: string;
  className?: string;
}) {
  const t = useT();
  const f = useFormat();
  const has = !!points && points.length > 1;
  const first = has ? points![0]!.v : 0;
  const last = has ? points![points!.length - 1]!.v : 0;
  const change = mode === "equity" ? last - first : last;
  const pct = mode === "equity" && first ? (change / Math.abs(first)) * 100 : null;
  const fmtT = (ms: number) => f.date(ms, range === "year" ? { month: "short" } : { day: "numeric", month: "short" });
  return (
    <Card className={className}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 sm:px-6 sm:pt-6">
        <h3 className="k-display text-[20px] font-semibold tracking-[-0.015em] sm:text-[22px]">{t("dashboard.home.statistics")}</h3>
        <Segmented
          size="md"
          value={mode}
          onChange={onMode}
          options={[
            { value: "equity", label: t("common.equity") },
            { value: "pnl", label: t("dashboard.home.pnl") },
          ]}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2 px-5 sm:px-6">
        <Tabs
          className="border-transparent"
          value={range}
          onChange={onRange}
          tabs={[
            { value: "week", label: t("dashboard.home.weekly") },
            { value: "month", label: t("dashboard.home.monthly") },
            { value: "year", label: t("dashboard.home.lastYear") },
          ]}
        />
        {has && (
          <div className="flex items-center gap-2 pb-3">
            <ChangeChip tone={change >= 0 ? "up" : "down"}>
              <span dir="ltr">
                {change >= 0 ? "+" : "-"}
                {formatMoney(Math.abs(change))}
                {pct !== null && ` (${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%)`}
              </span>
            </ChangeChip>
          </div>
        )}
      </div>
      <div className="px-2 pb-4 pt-1 sm:px-4">
        {loading && !has ? (
          <Skeleton className="mx-3 h-[260px] rounded-[18px]" />
        ) : has ? (
          <TrendChart
            points={points!}
            compare={compare}
            height={268}
            formatValue={(v) => formatMoney(v)}
            formatAxis={compactMoney}
            formatTime={fmtT}
            label={t("dashboard.home.statistics")}
          />
        ) : (
          <div className="grid h-[260px] place-items-center px-6 text-center text-[13.5px] text-fg-3">{emptyText ?? t("dashboard.home.noHistory")}</div>
        )}
        {has && compare && compare.length > 1 && (
          <div className="flex items-center gap-4 px-4 pt-1 text-[12px] text-fg-3">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-[3px] w-4 rounded-full bg-ember" /> {t("dashboard.home.thisPeriod")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-4 border-t-2 border-dashed border-fg-3/70" /> {t("dashboard.home.previousPeriod")}
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}
