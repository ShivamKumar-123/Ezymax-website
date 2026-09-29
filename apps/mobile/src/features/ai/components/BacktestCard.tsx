// A backtest started from the conversation: progress while the service simulates (the stage it reports), then the
// result as a huge net profit with a small equity line and the key ratios, the tested range and the simulation
// note. Green / red only for the money figures. "Full report" opens the Algo module's backtest screen.
import * as React from "react";
import { useWindowDimensions, View } from "react-native";
import { useRouter } from "expo-router";
import Svg, { Polyline } from "react-native-svg";
import { ArrowUpRight, X } from "lucide-react-native";
import { useFormat, useT, type MessageKey } from "@/i18n";
import { fmtMoney, fmtPct } from "@/lib/format";
import { Card, Display, Text } from "@/ui";
import { colors, space } from "@/theme/tokens";
import type { BacktestMessage } from "../thread";
import { BlockButton, Cell, ProgressBar } from "./parts";

const STAGES: [RegExp, MessageKey][] = [
  [/^loading history|^loading data/, "mobileAi.bt.stage.loading"],
  [/^loading M1/, "mobileAi.bt.stage.m1"],
  [/^simulating/, "mobileAi.bt.stage.simulating"],
  [/^requeued/, "mobileAi.bt.stage.queued"],
];

/** Profit factor / Sharpe: two decimals, a real minus sign, a dash when there is none. */
const ratio = (v: number | null) => (v === null || !Number.isFinite(v) ? "—" : `${v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)}`);

function Sparkline({ values, color, width, height }: { values: number[]; color: string; width: number; height: number }) {
  if (values.length < 2 || width <= 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * width).toFixed(1)},${(height - 2 - ((v - min) / span) * (height - 4)).toFixed(1)}`).join(" ");
  return (
    <Svg width={width} height={height} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

export const BacktestCard = React.memo(function BacktestCard({ m, onDeploy, onCancel, canDeploy }: { m: BacktestMessage; onDeploy?: () => void; onCancel: (id: string) => void; canDeploy: boolean }) {
  const t = useT();
  const fmt = useFormat();
  const router = useRouter();
  // the card spans the list minus its gutters (16) and its own padding (20): no layout pass needed for the line
  const w = useWindowDimensions().width - 2 * 16 - 2 * space[5];
  const running = m.status === "queued" || m.status === "running";
  const s = m.summary;
  const range = `${fmt.date(m.params.from * 1000, { day: "numeric", month: "short", year: "numeric" })} – ${fmt.date(m.params.to * 1000, { day: "numeric", month: "short", year: "numeric" })}`;
  const stageKey = m.stage ? STAGES.find(([re]) => re.test(m.stage!))?.[1] : undefined;
  const openReport = () => router.push(`/algo/backtests/${m.backtestId}`);

  return (
    <Card padded={false} style={{ padding: space[5], gap: space[4] }} testID={`ai-backtest-${m.backtestId}`}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
        <Text variant="label" tone="tertiary" style={{ flex: 1 }} numberOfLines={1}>
          {t("mobileAi.bt.label", { version: m.version, symbol: m.params.symbol, tf: m.params.timeframe })}
        </Text>
        {running ? (
          <BlockButton label={t("common.cancel")} tone="surface" icon={<X size={15} color={colors.text} />} onPress={() => onCancel(m.id)} style={{ height: 36 }} testID="ai-bt-cancel" />
        ) : null}
      </View>

      {running ? (
        <View style={{ gap: space[3] }}>
          <Display size="sm">{m.status === "queued" ? t("mobileAi.bt.queued") : stageKey ? t(stageKey) : t("mobileAi.bt.running")}</Display>
          <ProgressBar value={m.status === "queued" ? 0.03 : m.progress} />
          <Text variant="caption" tone="tertiary">
            {`${range} · ${t("mobileAi.bt.start", { amount: fmtMoney(m.params.initialBalance, { decimals: 0, currency: "USD" }) })}`}
          </Text>
        </View>
      ) : m.status === "done" && s ? (
        <View style={{ gap: space[4] }}>
          <View style={{ gap: 2 }}>
            <Text variant="label" tone="tertiary" style={{ fontSize: 10.5 }}>
              {t("mobileAi.bt.net")}
            </Text>
            <Display size="xl" color={s.netProfit > 0 ? colors.up : s.netProfit < 0 ? colors.down : colors.text} numberOfLines={1} adjustsFontSizeToFit testID="ai-bt-net">
              {fmtMoney(s.netProfit, { signed: true, currency: "USD" })}
            </Display>
            <Text variant="callout" weight="700" color={s.returnPct > 0 ? colors.up : s.returnPct < 0 ? colors.down : colors.text2}>
              {t("mobileAi.bt.return", { pct: fmtPct(s.returnPct, 2) })}
            </Text>
          </View>
          {m.equity && m.equity.length > 1 ? <Sparkline values={m.equity} color={s.netProfit >= 0 ? colors.up : colors.down} width={w} height={44} /> : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: space[3] }}>
            <Cell mono label={t("mobileAi.bt.trades")} value={String(s.trades)} style={{ width: "33.3%" }} />
            <Cell mono label={t("mobileAi.bt.winRate")} value={fmtPct(s.winRate, 1, false)} style={{ width: "33.3%" }} />
            <Cell mono label={t("mobileAi.bt.pf")} value={ratio(s.profitFactor)} style={{ width: "33.3%" }} />
            <Cell mono label={t("mobileAi.bt.dd")} value={fmtPct(s.maxDrawdownPct, 2, false)} style={{ width: "50%" }} />
            <Cell mono label={t("mobileAi.bt.sharpe")} value={ratio(s.sharpe)} style={{ width: "50%" }} />
          </View>
          <View style={{ gap: 2 }}>
            <Text variant="caption" tone="tertiary">
              {`${range} · ${t("mobileAi.bt.start", { amount: fmtMoney(m.params.initialBalance, { decimals: 0, currency: "USD" }) })}`}
            </Text>
            <Text variant="caption" tone="tertiary">
              {t("mobileAi.bt.simNote")}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: space[2] }}>
            <BlockButton label={t("mobileAi.bt.fullReport")} tone="surface" icon={<ArrowUpRight size={16} color={colors.text} />} onPress={openReport} style={{ flex: 1 }} testID="ai-bt-report" />
            {canDeploy && onDeploy ? <BlockButton label={t("mobileAi.card.deploy")} tone="ember" onPress={onDeploy} style={{ flex: 1 }} testID="ai-bt-deploy" /> : null}
          </View>
        </View>
      ) : (
        <View style={{ gap: space[2] }}>
          <Display size="sm">{m.status === "cancelled" ? t("mobileAi.bt.cancelled") : t("mobileAi.bt.failed")}</Display>
          {m.error ? (
            <Text variant="callout" tone="secondary">
              {m.error}
            </Text>
          ) : null}
        </View>
      )}
    </Card>
  );
});
