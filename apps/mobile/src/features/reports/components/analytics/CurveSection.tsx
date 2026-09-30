// Analytics › Equity vs balance: the Skia chart (equity, balance, drawdown) with its legend and hint. The series
// and every tooltip line are built once per answer on the JS side, then the chart only reads them.
import * as React from "react";
import { useWindowDimensions, View } from "react-native";
import { useFormat, useT, type T } from "@/i18n";
import { Card, Skeleton, Text } from "@/ui";
import { colors, GUTTER, space } from "@/theme/tokens";
import { pct, usd } from "../../format";
import { tint } from "../../tint";
import type { Analytics, CurvePoint } from "../../types";
import { SectionTitle } from "../Chrome";
import { Curve, CURVE_H, type CurveSeries } from "../charts/Curve";

const PAD = space[4];

/** Keeps at most ~one point per 1.5 px: the last day of each bucket, with the bucket's deepest drawdown. */
function downsample(points: CurvePoint[], max: number): CurvePoint[] {
  if (points.length <= max) return points;
  const out: CurvePoint[] = [];
  const size = points.length / max;
  for (let b = 0; b < max; b++) {
    const lo = Math.floor(b * size);
    const hi = Math.min(points.length, Math.floor((b + 1) * size));
    if (hi <= lo) continue;
    let dd = 0;
    for (let i = lo; i < hi; i++) dd = Math.min(dd, points[i]!.drawdown);
    out.push({ ...points[hi - 1]!, drawdown: dd });
  }
  return out;
}

/** Short money for axis and tooltip: whole dollars from 100k. */
const short = (v: number) => (Math.abs(v) >= 100_000 ? usd(Math.round(v)).replace(/\.00$/, "") : usd(v));

/** Skia text has no font fallback: tooltip dates stay in Latin script (ISO date for other scripts), ASCII minus. */
const latin = (x: string) => /^[\u0020-\u024F]*$/.test(x);
const ascii = (x: string) => x.replace(/\u2212/g, "-");

function buildSeries(points: CurvePoint[], width: number, t: T, fmt: ReturnType<typeof useFormat>, maxDd: number): CurveSeries {
  const pts = downsample(points, Math.max(24, Math.floor(width / 1.5)));
  const date = (day: string) => fmt.date(`${day}T00:00:00Z`, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const tipDate = (day: string) => {
    const d = date(day);
    return latin(d) ? d : day;
  };
  const ddWord = t("mobileReports.an.curve.drawdown");
  let hi = -Infinity;
  let lo = Infinity;
  for (const p of pts) {
    hi = Math.max(hi, p.equity, p.balance);
    lo = Math.min(lo, p.equity, p.balance);
  }
  const last = pts[pts.length - 1]!;
  return {
    eq: pts.map((p) => p.equity),
    bal: pts.map((p) => p.balance),
    dd: pts.map((p) => p.drawdown),
    tipDate: pts.map((p) => tipDate(p.day)),
    tipEq: pts.map((p) => ascii(short(p.equity))),
    tipBal: pts.map((p) => ascii(short(p.balance))),
    tipDd: pts.map((p) => ascii(pct(p.drawdown))),
    hiLabel: ascii(short(hi)),
    loLabel: ascii(short(lo)),
    ddTitle: ddWord,
    ddLabel: t("portfolio.an.curves.max", { value: maxDd.toFixed(2) }),
    a11y: t("mobileReports.an.curve.a11y", { equity: usd(last.equity), balance: usd(last.balance), date: date(last.day), drawdown: pct(maxDd) }),
  };
}

export const CurveSection = React.memo(function CurveSection({ d, label }: { d: Analytics; label: string }) {
  const t = useT();
  const fmt = useFormat();
  const { width } = useWindowDimensions();
  const chartW = width - GUTTER * 2 - PAD * 2;
  const points = d.curve.points;
  const series = React.useMemo(() => (points.length >= 2 ? buildSeries(points, chartW, t, fmt, d.curve.maxDrawdown) : null), [points, chartW, t, fmt, d.curve.maxDrawdown]);
  return (
    <View style={{ paddingHorizontal: GUTTER }}>
      <SectionTitle title={t("portfolio.an.curves.title")} subtitle={t("portfolio.an.curves.subtitle", { label })} />
      <Card padded={false} style={{ padding: PAD, gap: space[3] }}>
        {series ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[4] }}>
            <Legend swatch={<View style={{ width: 16, height: 3, borderRadius: 2, backgroundColor: colors.gold }} />} label={t("common.equity")} />
            <Legend swatch={<View style={{ width: 16, height: 0, borderTopWidth: 2, borderStyle: "dashed", borderColor: tint(colors.cream, 0.6) }} />} label={t("common.balance")} />
            <Legend swatch={<View style={{ width: 12, height: 8, borderRadius: 2, backgroundColor: tint(colors.down, 0.5) }} />} label={t("mobileReports.an.curve.drawdown")} />
          </View>
        ) : null}
        {series ? (
          <Curve s={series} width={chartW} fallback={<Skeleton h={CURVE_H} r={12} />} />
        ) : (
          <View style={{ minHeight: 96, justifyContent: "center" }}>
            <Text variant="callout" tone="tertiary">
              {t("portfolio.an.curves.empty")}
            </Text>
          </View>
        )}
        {series ? (
          <Text variant="caption" tone="tertiary">
            {t("mobileReports.an.curve.hint")}
          </Text>
        ) : null}
      </Card>
    </View>
  );
});

function Legend({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
      {swatch}
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
    </View>
  );
}
