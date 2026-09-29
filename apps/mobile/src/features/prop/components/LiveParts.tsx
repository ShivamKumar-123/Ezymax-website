// Leaf components fed by the live stream. Each one subscribes on its own and re-renders alone (at most once a
// frame), so equity frames never re-render the dashboard around them.
import * as React from "react";
import { View, type StyleProp, type TextStyle } from "react-native";
import { useT } from "@/i18n";
import { Mono, Text, type Tone } from "@/ui";
import { colors, space } from "@/theme/tokens";
import { fmtDateTime, usd, usdSigned } from "../format";
import { useLiveMoney, useLiveStatus, type LiveMoney, type PropLive } from "../live";
import { Tag } from "./bits";

export type Render = (m: LiveMoney) => { text: string; tone?: Tone };

/** One live number. `render` turns the latest money into text (and a tone for P&L). */
export const LiveText = React.memo(function LiveText({ live, fallback, render, size = 15, weight = "medium", style, numberOfLines = 1 }: { live: PropLive | null; fallback: LiveMoney; render: Render; size?: number; weight?: "regular" | "medium" | "bold"; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  const m = useLiveMoney(live) ?? fallback;
  const { text, tone } = render(m);
  return (
    <Mono size={size} weight={weight} tone={tone ?? "primary"} style={style} numberOfLines={numberOfLines} adjustsFontSizeToFit={numberOfLines === 1}>
      {text}
    </Mono>
  );
});

/** Where the numbers come from: the engine stream, or the prop evaluator's last look (with its time). */
export function LiveBadge({ live, at, final }: { live: PropLive | null; at: string | null; final?: boolean }) {
  const t = useT();
  const s = useLiveStatus(live);
  if (s === "live") return <Tag label={t("mobileProp.live.live")} tone="mint" />;
  if (s === "connecting") return <Tag label={t("mobileProp.live.connecting")} tone="neutral" />;
  if (s === "offline") return <Tag label={t("mobileProp.live.offline")} tone="neutral" />;
  if (!at) return null;
  return <Tag label={t(final ? "mobileProp.live.final" : "mobileProp.live.updated", { time: fmtDateTime(at) })} tone="neutral" />;
}

/** The hero of a live account: equity, its move since the phase started, balance and floating P&L. */
function EquityHero({ live, fallback, initial, at, final }: { live: PropLive | null; fallback: LiveMoney; initial: number; at: string | null; final?: boolean }) {
  const t = useT();
  const equity = React.useCallback<Render>((m) => ({ text: usd(m.equity) }), []);
  const delta = React.useCallback<Render>(
    (m) => {
      const d = m.equity - initial;
      const p = initial ? (d / initial) * 100 : 0;
      return { text: `${usdSigned(d)} (${p > 0 ? "+" : p < 0 ? "−" : ""}${Math.abs(p).toFixed(2)}%)`, tone: d > 0 ? "up" : d < 0 ? "down" : "tertiary" };
    },
    [initial],
  );
  const balance = React.useCallback<Render>((m) => ({ text: usd(m.balance) }), []);
  const floating = React.useCallback<Render>((m) => {
    const f = m.equity - m.balance;
    return { text: usdSigned(f), tone: f > 0 ? "up" : f < 0 ? "down" : "secondary" };
  }, []);
  const open = React.useCallback<Render>((m) => ({ text: String(m.positions), tone: "secondary" }), []);
  return (
    <View style={{ gap: space[3] }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text variant="label" tone="tertiary">
          {t("mobileProp.dash.equity")}
        </Text>
        <LiveBadge live={live} at={at} final={final} />
      </View>
      <View>
        <LiveText live={live} fallback={fallback} render={equity} size={38} weight="bold" />
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], marginTop: 2 }}>
          <LiveText live={live} fallback={fallback} render={delta} size={14} weight="medium" />
          <Text variant="caption" tone="tertiary">
            {t("mobileProp.dash.sinceStart")}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: space[3], borderTopWidth: 1, borderTopColor: colors.line, paddingTop: space[3] }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="label" tone="tertiary">
            {t("mobileProp.dash.balance")}
          </Text>
          <LiveText live={live} fallback={fallback} render={balance} size={15} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="label" tone="tertiary">
            {t("mobileProp.dash.floating")}
          </Text>
          <LiveText live={live} fallback={fallback} render={floating} size={15} />
        </View>
        <View style={{ width: 64, gap: 2, alignItems: "flex-end" }}>
          <Text variant="label" tone="tertiary">
            {t("mobileProp.dash.open")}
          </Text>
          <LiveText live={live} fallback={fallback} render={open} size={15} />
        </View>
      </View>
    </View>
  );
}

const EquityHeroMemo = React.memo(EquityHero);
export { EquityHeroMemo as EquityHero };
