// The copy-settings form pieces shared by the follow wizard and "Copy settings": sizing mode + value with a live
// sizing example, and the follower's risk limits (drawdown stop, equity stop, max lot).
import * as React from "react";
import { View } from "react-native";
import { Coins, Layers, Percent, Scale } from "lucide-react-native";
import { useT } from "@/i18n";
import { Text } from "@/ui";
import { colors, radius, space } from "@/theme/tokens";
import type { SizingMode } from "../api";
import { exampleLot, parseAmount, sizingLabel, SIZING_MODES, usd } from "../format";
import { AmountField, RadioCard, Slider, SwitchRow } from "./controls";

const ICON: Record<SizingMode, React.ComponentType<{ size?: number; color?: string }>> = { equity: Scale, fixed_lot: Layers, multiplier: Percent, allocation: Coins };
const TEXT = {
  equity: "mobileSocial.follow.mode.equity",
  fixed_lot: "mobileSocial.follow.mode.fixedLot",
  multiplier: "mobileSocial.follow.mode.multiplier",
  allocation: "mobileSocial.follow.mode.allocation",
} as const;

/** Default value when switching to a sizing mode (same as the web). */
export const defaultSizingValue = (mode: SizingMode, allocation: number, minAllocation: number) =>
  mode === "fixed_lot" ? "0.1" : mode === "multiplier" ? "1" : mode === "allocation" ? String(Math.max(minAllocation, allocation || 1000)) : "1";

export function sizingError(mode: SizingMode, raw: string, t: ReturnType<typeof useT>): string | undefined {
  if (mode === "equity") return undefined;
  const v = parseAmount(raw);
  if (v === null || !(v > 0)) return t("mobileSocial.follow.err.aboveZero");
  if (mode === "fixed_lot" && v < 0.01) return t("mobileSocial.follow.err.minLot");
  return undefined;
}

export function SizingPicker({
  mode,
  onMode,
  raw,
  onRaw,
  error,
  example,
}: {
  mode: SizingMode;
  onMode: (m: SizingMode) => void;
  raw: string;
  onRaw: (v: string) => void;
  error?: string;
  example?: { name: string; masterEquity: number; allocation: number; maxLot: number | null };
}) {
  const t = useT();
  const val = mode === "equity" ? 1 : (parseAmount(raw) ?? 0);
  return (
    <View style={{ gap: space[3] }}>
      <View style={{ gap: space[2] }} accessibilityRole="radiogroup">
        {SIZING_MODES.map((k) => {
          const Icon = ICON[k];
          return (
            <RadioCard
              key={k}
              testID={`sizing-${k}`}
              selected={mode === k}
              onPress={() => onMode(k)}
              title={sizingLabel(k, t)}
              text={t(TEXT[k])}
              icon={<Icon size={20} color={mode === k ? colors.ember : colors.text3} />}
            />
          );
        })}
      </View>
      {mode !== "equity" ? (
        <AmountField
          testID="sizing-value"
          label={mode === "fixed_lot" ? t("mobileSocial.follow.lotPerTrade") : mode === "multiplier" ? t("mobileSocial.follow.multiplier") : t("mobileSocial.follow.allocForSizing")}
          value={raw}
          onChange={onRaw}
          prefix={mode === "allocation" ? "$" : undefined}
          unit={mode === "fixed_lot" ? t("mobileSocial.lotsUnit") : mode === "multiplier" ? "×" : "USD"}
          decimals={2}
          error={error}
        />
      ) : null}
      {example && example.masterEquity > 0 ? <SizingExample mode={mode} value={val} {...example} /> : null}
    </View>
  );
}

function SizingExample({ mode, value, name, masterEquity, allocation, maxLot }: { mode: SizingMode; value: number; name: string; masterEquity: number; allocation: number; maxLot: number | null }) {
  const t = useT();
  const lot = exampleLot(mode, value, allocation, masterEquity, maxLot);
  const why =
    mode === "equity"
      ? t("mobileSocial.follow.example.equity", { alloc: usd(allocation, 0), equity: usd(masterEquity, 0) })
      : mode === "allocation"
        ? t("mobileSocial.follow.example.allocation", { alloc: usd(value, 0), equity: usd(masterEquity, 0) })
        : mode === "multiplier"
          ? t("mobileSocial.follow.example.multiplier", { value })
          : "";
  return (
    <View testID="sizing-example" style={{ borderRadius: radius.lg, padding: space[4], gap: space[2], backgroundColor: "rgba(242,184,75,0.10)", borderWidth: 1, borderColor: "rgba(242,184,75,0.28)" }}>
      <Text variant="callout" weight="700">
        {t("mobileSocial.follow.example", { name, lot: lot.toFixed(2) })}
      </Text>
      <Text variant="caption" tone="secondary" style={{ lineHeight: 17 }}>
        {[why, maxLot !== null && lot === maxLot ? t("mobileSocial.follow.example.capped") : "", t("mobileSocial.follow.example.rounding")].filter(Boolean).join(" ")}
      </Text>
    </View>
  );
}

export function limitErrors(maxLotRaw: string, equityStopRaw: string, allocation: number | null, t: ReturnType<typeof useT>) {
  const ml = parseAmount(maxLotRaw);
  const es = parseAmount(equityStopRaw);
  const maxLot = maxLotRaw && !(ml !== null && ml >= 0.01) ? t("mobileSocial.follow.err.maxLot") : undefined;
  const equityStop =
    equityStopRaw && !(es !== null && es >= 0)
      ? t("mobileSocial.follow.err.enterAmount")
      : es !== null && allocation !== null && allocation > 0 && es >= allocation
        ? t("mobileSocial.follow.err.belowAllocation")
        : undefined;
  return { maxLot, equityStop };
}

export function RiskLimits({
  ddOn,
  onDdOn,
  dd,
  onDd,
  ddHint,
  equityStop,
  onEquityStop,
  maxLot,
  onMaxLot,
  errors,
  equityHint,
  maxLotHint,
}: {
  ddOn: boolean;
  onDdOn: (v: boolean) => void;
  dd: number;
  onDd: (v: number) => void;
  ddHint: string;
  equityStop: string;
  onEquityStop: (v: string) => void;
  maxLot: string;
  onMaxLot: (v: string) => void;
  errors: { maxLot?: string; equityStop?: string };
  equityHint: string;
  maxLotHint: string;
}) {
  const t = useT();
  return (
    <View style={{ gap: space[5] }}>
      <View style={{ borderRadius: radius.lg, padding: space[4], gap: space[3], backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
        <SwitchRow testID="dd-switch" title={t("mobileSocial.follow.ddStop")} hint={ddHint} value={ddOn} onChange={onDdOn} />
        <View style={{ gap: space[1], opacity: ddOn ? 1 : 0.4 }} pointerEvents={ddOn ? "auto" : "none"}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text variant="caption" tone="tertiary">
              {t("mobileSocial.follow.trigger")}
            </Text>
            <Text variant="callout" weight="700" style={{ fontFamily: "JetBrainsMono_700Bold" }}>
              {t("mobileSocial.follow.fromPeak", { dd })}
            </Text>
          </View>
          <Slider value={dd} onChange={onDd} min={5} max={90} ticks={[5, 20, 30, 50, 90]} disabled={!ddOn} accessibilityLabel={t("mobileSocial.follow.ddStop")} format={(v) => `${v}%`} />
        </View>
      </View>
      <AmountField
        testID="equity-stop"
        label={t("mobileSocial.follow.equityStop")}
        value={equityStop}
        onChange={onEquityStop}
        prefix="$"
        unit="USD"
        placeholder={t("common.off")}
        hint={equityHint}
        error={errors.equityStop}
      />
      <AmountField
        testID="max-lot"
        label={t("mobileSocial.follow.maxLot")}
        value={maxLot}
        onChange={onMaxLot}
        unit={t("mobileSocial.lotsUnit")}
        placeholder={t("mobileSocial.noCap")}
        hint={maxLotHint}
        error={errors.maxLot}
      />
      <Text variant="caption" tone="tertiary" style={{ lineHeight: 17 }}>
        {t("mobileSocial.follow.limitsNote")}
      </Text>
    </View>
  );
}
