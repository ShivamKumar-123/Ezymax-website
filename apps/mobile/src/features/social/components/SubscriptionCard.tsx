// A copy subscription as a card: master, status, copy account, equity (huge) and P&L, the limits as tags, and
// Pause / Settings / Stop. Memoised; the list only re-renders a card when its subscription changed.
import * as React from "react";
import { View } from "react-native";
import { Pause, Play, Settings2, Square } from "lucide-react-native";
import { useFormat, useT } from "@/i18n";
import { Mono, PressableScale, Text } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import type { SubscriptionView } from "../api";
import { pct, periodLabel, usd } from "../format";
import { Avatar, HouseBadge, RiskMeter } from "./identity";
import { Tag, type TagTone } from "./primitives";

export const statusTone = (s: SubscriptionView["status"]): TagTone => (s === "active" ? "mint" : s === "paused" ? "gold" : "neutral");

export const SubscriptionCard = React.memo(function SubscriptionCard({
  s,
  busy,
  onOpen,
  onPressIn,
  onPause,
  onSettings,
  onStop,
}: {
  s: SubscriptionView;
  busy: boolean;
  onOpen: (id: number) => void;
  onPressIn: (id: number) => void;
  onPause: (s: SubscriptionView) => void;
  onSettings: (id: number) => void;
  onStop: (s: SubscriptionView) => void;
}) {
  const t = useT();
  const fmt = useFormat();
  const stopped = s.status === "stopped";
  const tags: { label: string; tone?: TagTone }[] = [{ label: t("mobileSocial.subs.chip.fee", { fee: s.perfFeePct, period: periodLabel(s.feePeriod, t).toLowerCase() }) }];
  if (s.maxDdPct !== null) tags.push({ label: t("mobileSocial.subs.chip.dd", { dd: s.maxDdPct }), tone: "ember" });
  if (s.equityStop !== null) tags.push({ label: t("mobileSocial.subs.chip.equityStop", { amount: usd(s.equityStop, 0) }), tone: "ember" });
  if (s.maxLot !== null) tags.push({ label: t("mobileSocial.subs.chip.maxLot", { lot: s.maxLot.toFixed(2) }) });
  tags.push({
    label: s.excludedSymbols.length
      ? t("mobileSocial.subs.chip.excl", { list: s.excludedSymbols.slice(0, 2).join(", ") + (s.excludedSymbols.length > 2 ? ` +${s.excludedSymbols.length - 2}` : "") })
      : t("mobileSocial.subs.chip.all"),
  });

  return (
    <View style={{ paddingHorizontal: GUTTER, paddingBottom: space[3] }}>
      <PressableScale
        testID={`sub-card-${s.id}`}
        onPress={() => onOpen(s.id)}
        onPressIn={() => onPressIn(s.id)}
        scaleTo={0.985}
        accessibilityLabel={`${s.master.nickname}, ${t(`mobileSocial.status.${s.status}`)}, ${usd(s.equity)}, ${usd(s.profit, 2, true)}`}
        style={{ borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: space[5], gap: space[4], opacity: stopped ? 0.72 : 1 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
          <Avatar name={s.master.nickname} size={44} house={s.master.house} />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text variant="headline" weight="700" numberOfLines={1}>
              {s.master.nickname}
            </Text>
            <Text variant="caption" tone="tertiary" numberOfLines={1}>
              {t("mobileSocial.subs.copyAccount", { login: s.login })}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end", gap: 6 }}>
            <Tag tone={statusTone(s.status)} label={t(`mobileSocial.status.${s.status}`)} />
            <RiskMeter risk={s.master.riskScore} />
          </View>
        </View>
        {s.master.house ? <HouseBadge /> : null}
        {stopped && s.stopReason ? (
          <Text variant="caption" tone="secondary">
            {`${t.dyn(`mobileSocial.subs.stopReason.${s.stopReason}`, s.stopReason.replace(/_/g, " "))}${s.stoppedAt ? ` · ${fmt.date(s.stoppedAt)}` : ""}`}
          </Text>
        ) : null}
        {!stopped && s.master.frozen ? (
          <Text variant="caption" tone="gold">
            {t("mobileSocial.subs.frozen")}
          </Text>
        ) : null}
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space[3] }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="label" tone="tertiary">
              {t("common.equity")}
            </Text>
            <Mono size={30} weight="bold" numberOfLines={1} adjustsFontSizeToFit style={{ letterSpacing: -0.5 }}>
              {usd(s.equity)}
            </Mono>
          </View>
          {/* a stopped subscription's balance may have gone back to the wallet: its P&L is no longer meaningful */}
          {!stopped ? (
            <View style={{ alignItems: "flex-end", gap: 2 }}>
              <Mono size={15} weight="bold" tone={s.profit > 0 ? "up" : s.profit < 0 ? "down" : "secondary"}>
                {usd(s.profit, 2, true)}
              </Mono>
              <Mono size={12} tone={s.returnPct > 0 ? "up" : s.returnPct < 0 ? "down" : "tertiary"}>
                {pct(s.returnPct)}
              </Mono>
            </View>
          ) : null}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {tags.map((tg) => (
            <Tag key={tg.label} label={tg.label} tone={tg.tone} />
          ))}
        </View>
        {!stopped ? (
          <View style={{ flexDirection: "row", gap: space[2] }}>
            <CardAction
              testID={`sub-pause-${s.id}`}
              icon={s.status === "paused" ? <Play size={16} color={colors.text} /> : <Pause size={16} color={colors.text} />}
              label={s.status === "paused" ? t("mobileSocial.subs.resume") : t("mobileSocial.subs.pause")}
              busy={busy}
              onPress={() => onPause(s)}
            />
            <CardAction testID={`sub-settings-${s.id}`} icon={<Settings2 size={16} color={colors.text} />} label={t("mobileSocial.subs.settings")} onPress={() => onSettings(s.id)} />
            <CardAction testID={`sub-stop-${s.id}`} icon={<Square size={14} color={colors.ember} />} label={t("mobileSocial.subs.stop")} tone="ember" onPress={() => onStop(s)} />
          </View>
        ) : null}
      </PressableScale>
    </View>
  );
});

function CardAction({ icon, label, onPress, busy, tone, testID }: { icon: React.ReactNode; label: string; onPress: () => void; busy?: boolean; tone?: "ember"; testID?: string }) {
  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      disabled={busy}
      accessibilityLabel={label}
      style={{
        flex: 1,
        height: 44,
        borderRadius: radius.pill,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        backgroundColor: colors.surface2,
        borderWidth: 1,
        borderColor: tone === "ember" ? "rgba(242,106,61,0.35)" : colors.line,
      }}
    >
      {icon}
      <Text variant="callout" weight="700" color={tone === "ember" ? colors.ember : colors.text} numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  );
}
