// Equity curve of a phase with the lines that matter: the profit target, the start, the daily-loss and the
// max-drawdown floors. Samples come from the prop service (≤ 1 a minute plus every trade); the live head follows
// the engine stream on the UI thread.
import * as React from "react";
import { View } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import { useT } from "@/i18n";
import { Card, PillRow, Skeleton, Text } from "@/ui";
import { colors, GUTTER, space } from "@/theme/tokens";
import { useEquity } from "../api";
import { fmtDate, usd } from "../format";
import type { View as RuleView } from "../rules";
import type { PhaseAccount } from "../types";
import { EquityChart, type ChartLine } from "./gauges";

const H = 190;

type Mode = "equity" | "balance";

function EquityCard({ challengeId, a, v, live, active, refreshKey = 0 }: { challengeId: number; a: PhaseAccount; v: RuleView; live: SharedValue<number> | null; active: boolean; refreshKey?: number }) {
  const t = useT();
  const [mode, setMode] = React.useState<Mode>("equity");
  const [w, setW] = React.useState(0);
  const q = useEquity(challengeId, a.phaseIndex, active ? 30_000 : undefined);
  const { refresh } = q;
  // a deal adds a sample: fetch it (the live head covers the time between)
  React.useEffect(() => {
    if (refreshKey) void refresh();
  }, [refreshKey, refresh]);

  const points = React.useMemo(
    () =>
      (q.data?.points ?? [])
        .map((p) => ({ t: new Date(p.at).getTime(), v: mode === "equity" ? p.equity : p.balance }))
        .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v))
        .sort((x, y) => x.t - y.t),
    [q.data, mode],
  );

  const lines = React.useMemo(() => {
    const out: (ChartLine & { label: string })[] = [
      { value: v.ddFloor, color: colors.ember, label: t("mobileProp.chart.ddFloor") },
      { value: v.initial, color: colors.text3, label: t("mobileProp.chart.start") },
    ];
    if (active && v.dailyFloor > v.ddFloor) out.push({ value: v.dailyFloor, color: colors.gold, label: t("mobileProp.chart.dailyFloor") });
    if (!a.funded && v.targetAmount) out.push({ value: v.initial + v.targetAmount, color: colors.mint, label: t("mobileProp.chart.target") });
    return out;
  }, [v.ddFloor, v.initial, v.dailyFloor, v.targetAmount, a.funded, active, t]);

  // one domain for the curve and the line labels
  const { min, max } = React.useMemo(() => {
    const vals = [...points.map((p) => p.v), ...lines.map((l) => l.value), mode === "equity" ? v.equity : v.balance];
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const pad = (hi - lo || Math.abs(hi) * 0.01 || 1) * 0.08;
    return { min: lo - pad, max: hi + pad };
  }, [points, lines, mode, v.equity, v.balance]);
  // line labels sit just above their line, pushed apart when two lines are close
  const labels = React.useMemo(() => {
    const yOf = (value: number) => H - ((value - min) / (max - min || 1)) * H;
    const placed = lines.map((l) => ({ ...l, top: Math.min(H - 14, Math.max(0, yOf(l.value) - 16)) })).sort((a, b) => a.top - b.top);
    for (let i = 1; i < placed.length; i++) if (placed[i]!.top - placed[i - 1]!.top < 14) placed[i]!.top = placed[i - 1]!.top + 14;
    return placed;
  }, [lines, min, max]);

  return (
    <Card padded={false} style={{ marginHorizontal: GUTTER, paddingVertical: space[5] }}>
      <View style={{ paddingHorizontal: space[5], flexDirection: "row", alignItems: "center", gap: space[3] }}>
        <PillRow
          items={[
            { key: "equity" as Mode, label: t("mobileProp.dash.equity") },
            { key: "balance" as Mode, label: t("mobileProp.dash.balance") },
          ]}
          value={mode}
          onChange={setMode}
          compact
          contentPadding={0}
          style={{ flexGrow: 0 }}
        />
      </View>
      {/* time runs left to right in every language (the trading convention), so the plot area is always LTR */}
      <View style={{ height: H, marginTop: space[4], marginHorizontal: space[5], direction: "ltr" }} onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))}>
        {q.loading ? (
          <Skeleton h={H} r={16} />
        ) : points.length < 2 ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: colors.lineStrong, paddingHorizontal: space[6] }}>
            <Text variant="callout" tone="tertiary" align="center">
              {t("mobileProp.chart.empty")}
            </Text>
          </View>
        ) : w > 0 ? (
          <>
            <EquityChart width={w} height={H} points={points} min={min} max={max} lines={lines} color={colors.cream} live={mode === "equity" && active ? live : null} />
            {labels.map((l) => (
              <View key={l.label} pointerEvents="none" style={{ position: "absolute", start: 0, top: l.top, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6, backgroundColor: colors.surface }}>
                <Text variant="label" color={l.color} style={{ fontSize: 9.5, lineHeight: 12, letterSpacing: 0.4 }}>
                  {l.label} · {usd(l.value, 0)}
                </Text>
              </View>
            ))}
          </>
        ) : null}
      </View>
      {points.length >= 2 ? (
        <View style={{ paddingHorizontal: space[5], marginTop: space[3], flexDirection: "row", justifyContent: "space-between", direction: "ltr" }}>
          <Text variant="caption" tone="tertiary">
            {fmtDate(new Date(points[0]!.t).toISOString())}
          </Text>
          <Text variant="caption" tone="tertiary">
            {active ? t("mobileProp.chart.now") : fmtDate(new Date(points[points.length - 1]!.t).toISOString())}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

const EquityCardMemo = React.memo(EquityCard);
export { EquityCardMemo as EquityCard };
