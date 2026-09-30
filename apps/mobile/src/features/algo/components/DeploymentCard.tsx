// One deployment of a strategy as a card: status, account and version, realized P&L (money colours), closed trades,
// win rate and open positions, when it last checked a bar, its error or stop reason, and its controls (pause /
// resume, stop, kill) — each opens its confirmation. Tapping the card opens the deployment (log, trades, setup).
import * as React from "react";
import { View } from "react-native";
import { OctagonX, Pause, Play, Square } from "lucide-react-native";
import { useFormat, useT } from "@/i18n";
import { Mono, PressableScale, Text } from "@/ui";
import { colors, radius, space } from "@/theme/tokens";
import type { Deployment } from "../api";
import { DEP_TONE, ago, depLabel, isLive, kindLabel, moneyTone, pct, realizedOf, tradesOf, usd, winRateOf } from "../format";
import type { DeploymentAction } from "../sheets/DeploymentSheet";
import { Tag } from "./bits";
import { ForwardIcon } from "./chrome";

export const DeploymentCard = React.memo(function DeploymentCard({
  d,
  readOnly,
  onOpen,
  onPressIn,
  onAction,
}: {
  d: Deployment;
  readOnly: boolean;
  onOpen: (id: number) => void;
  onPressIn: (id: number) => void;
  onAction: (d: Deployment, a: DeploymentAction) => void;
}) {
  const t = useT();
  const f = useFormat();
  const pnl = realizedOf(d);
  const wr = winRateOf(d);
  const live = isLive(d.status);
  const open = d.openPositions || Number(d.stats?.open ?? 0);
  return (
    <View style={{ borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: d.status === "error" ? colors.warn : colors.line, overflow: "hidden" }} testID={`dep-card-${d.id}`}>
      <PressableScale
        onPress={() => onOpen(d.id)}
        onPressIn={() => onPressIn(d.id)}
        scaleTo={0.985}
        accessibilityLabel={[depLabel(t, d.status), `${kindLabel(t, d.accountType)} ${d.login}`, `v${d.version}`, `${t("mobileAlgo.dep.realized")} ${usd(pnl, true)}`].join(", ")}
        style={{ padding: space[5], gap: space[4] }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <Tag compact label={depLabel(t, d.status)} tone={DEP_TONE[d.status] ?? "neutral"} dot={d.status === "running"} />
          <Text variant="callout" weight="700" numberOfLines={1} style={{ flex: 1 }}>
            {`${kindLabel(t, d.accountType)} ${d.login} · v${d.version}`}
          </Text>
          <ForwardIcon />
        </View>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space[3] }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="label" tone="tertiary" style={{ fontSize: 10.5 }}>
              {t("mobileAlgo.dep.realized")}
            </Text>
            <Mono size={26} weight="bold" tone={moneyTone(pnl)} numberOfLines={1} adjustsFontSizeToFit>
              {usd(pnl, true)}
            </Mono>
          </View>
          <Mini label={t("mobileAlgo.dep.trades")} value={String(tradesOf(d))} />
          <Mini label={t("mobileAlgo.dep.winRate")} value={wr === null ? "—" : pct(wr, 0, false)} />
          <Mini label={t("mobileAlgo.dep.open")} value={String(open)} />
        </View>
        {d.error ? (
          <Text variant="caption" color={colors.warn} numberOfLines={3}>
            {d.error}
          </Text>
        ) : !live && d.stopReason ? (
          <Text variant="caption" tone="tertiary" numberOfLines={2}>
            {t("mobileAlgo.dep.stoppedWhy", { reason: d.stopReason })}
          </Text>
        ) : (
          <Text variant="caption" tone="tertiary" numberOfLines={1}>
            {t("mobileAlgo.dep.lastCheck", { ago: ago(t, f, d.lastEvalAt) })}
          </Text>
        )}
      </PressableScale>
      {live && !readOnly ? (
        <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.line }}>
          {d.status === "running" ? (
            <Ctl testID={`dep-${d.id}-pause`} icon={<Pause size={16} color={colors.text} />} label={t("mobileAlgo.ctl.pause")} onPress={() => onAction(d, "pause")} />
          ) : (
            <Ctl testID={`dep-${d.id}-resume`} icon={<Play size={16} color={colors.text} />} label={t("mobileAlgo.ctl.resume")} onPress={() => onAction(d, "resume")} />
          )}
          <Ctl testID={`dep-${d.id}-stop`} icon={<Square size={15} color={colors.text} />} label={t("mobileAlgo.ctl.stop")} onPress={() => onAction(d, "stop")} divider />
          <Ctl testID={`dep-${d.id}-kill`} icon={<OctagonX size={16} color={colors.down} />} label={t("mobileAlgo.ctl.kill")} color={colors.down} onPress={() => onAction(d, "kill")} divider />
        </View>
      ) : null}
    </View>
  );
});

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: "flex-end", gap: 2 }}>
      <Mono size={15} weight="bold">
        {value}
      </Mono>
      <Text variant="label" tone="tertiary" style={{ fontSize: 9.5, letterSpacing: 0.6 }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function Ctl({ icon, label, onPress, color = colors.text, divider, testID }: { icon: React.ReactNode; label: string; onPress: () => void; color?: string; divider?: boolean; testID?: string }) {
  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      scaleTo={0.96}
      accessibilityLabel={label}
      style={{ flex: 1, height: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space[2], borderStartWidth: divider ? 1 : 0, borderStartColor: colors.line }}
    >
      {icon}
      <Text variant="callout" weight="700" color={color}>
        {label}
      </Text>
    </PressableScale>
  );
}
