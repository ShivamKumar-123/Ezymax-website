// What happened on a phase account: trading statistics, the rule log (warnings, violations, breaches) and closed
// trades (the latest inline, all of them in a sheet on FlashList with fixed-height rows).
import * as React from "react";
import { View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useBottomSheetScrollableCreator } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useT } from "@/i18n";
import { Card, Mono, Sheet, Skeleton, Text, type SheetRef } from "@/ui";
import { colors, GUTTER, space } from "@/theme/tokens";
import { useTrades } from "../api";
import { fmtDate, fmtDateTime, fmtDuration, usd, usdSigned } from "../format";
import { bannedLabel, ruleLabel } from "../rules";
import type { PhaseAccount, RuleEvent, Trade } from "../types";
import { SectionHead, Stat, Tag, type TagTone } from "./bits";

/* ------------------------------------------------------------------ */
/* Stats                                                               */
/* ------------------------------------------------------------------ */

function StatsCard({ a }: { a: PhaseAccount }) {
  const t = useT();
  const s = a.stats;
  const cells: { l: string; v: string; tone?: "up" | "down" }[] = [
    { l: t("mobileProp.stats.trades"), v: String(s?.trades ?? 0) },
    { l: t("mobileProp.stats.winRate"), v: s?.winRate !== null && s?.winRate !== undefined ? `${s.winRate}%` : "—" },
    { l: t("mobileProp.stats.profitFactor"), v: s?.profitFactor !== null && s?.profitFactor !== undefined ? s.profitFactor.toFixed(2) : "—" },
    { l: t("mobileProp.stats.avgWin"), v: usd(s?.avgWin ?? 0), tone: (s?.avgWin ?? 0) > 0 ? "up" : undefined },
    { l: t("mobileProp.stats.avgLoss"), v: usd(s?.avgLoss ?? 0), tone: (s?.avgLoss ?? 0) < 0 ? "down" : undefined },
    { l: t("mobileProp.stats.lots"), v: (s?.lots ?? 0).toFixed(2) },
  ];
  return (
    <Card style={{ marginHorizontal: GUTTER, gap: space[4] }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: space[4] }}>
        {cells.map((c) => (
          <Stat key={c.l} label={c.l} value={c.v} tone={c.tone} style={{ width: "50%", paddingEnd: space[3] }} />
        ))}
      </View>
      {s?.bestDay ? (
        <Text variant="caption" tone="tertiary">
          {t("mobileProp.stats.bestDay", { date: fmtDate(s.bestDay.day), amount: usd(s.bestDay.profit) })}
        </Text>
      ) : null}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Rule log                                                            */
/* ------------------------------------------------------------------ */

const SEV_TONE: Record<string, TagTone> = { breach: "ember", violation: "gold", warning: "gold", info: "periwinkle" };

function EventsList({ events }: { events: RuleEvent[] }) {
  const t = useT();
  return (
    <Card padded={false} style={{ marginHorizontal: GUTTER, paddingHorizontal: space[5] }}>
      {events.length === 0 ? (
        <Text variant="callout" tone="tertiary" style={{ paddingVertical: space[6] }} align="center">
          {t("mobileProp.events.empty")}
        </Text>
      ) : (
        events.map((e, i) => {
          const kind = e.rule === "banned_strategy" && e.details && typeof e.details === "object" && "kind" in e.details ? bannedLabel(t, String((e.details as { kind: unknown }).kind)) : null;
          const meta = [fmtDateTime(e.at), e.equity !== null ? t("mobileProp.events.equity", { amount: usd(e.equity) }) : null, e.threshold !== null ? t("mobileProp.events.limit", { amount: usd(e.threshold) }) : null].filter(Boolean).join(" · ");
          return (
            <View key={e.id} style={{ paddingVertical: space[4], gap: space[2], borderBottomWidth: i === events.length - 1 ? 0 : 1, borderBottomColor: colors.line }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
                <Tag label={t.dyn(`mobileProp.severity.${e.severity}`, e.severity)} tone={SEV_TONE[e.severity] ?? "neutral"} />
                <Text variant="callout" weight="600" numberOfLines={1} style={{ flexShrink: 1 }}>
                  {ruleLabel(t, e.rule)}
                  {kind ? ` · ${kind}` : ""}
                </Text>
              </View>
              <Text variant="caption" tone="secondary">
                {e.message}
              </Text>
              <Text variant="caption" tone="tertiary">
                {meta}
              </Text>
            </View>
          );
        })
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Closed trades                                                       */
/* ------------------------------------------------------------------ */

export const TRADE_ROW_HEIGHT = 64;

export const TradeRow = React.memo(function TradeRow({ r }: { r: Trade }) {
  const t = useT();
  return (
    <View style={{ height: TRADE_ROW_HEIGHT, flexDirection: "row", alignItems: "center", gap: space[3], borderBottomWidth: 1, borderBottomColor: colors.line }}>
      <View style={{ width: 4, height: 32, borderRadius: 2, backgroundColor: r.side === "buy" ? colors.up : colors.down }} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: space[2] }}>
          <Text variant="callout" weight="700">
            {r.symbol}
          </Text>
          <Text variant="caption" tone={r.side === "buy" ? "up" : "down"} weight="700">
            {r.side === "buy" ? t("mobileProp.trades.buy") : t("mobileProp.trades.sell")} {r.volume.toFixed(2)}
          </Text>
        </View>
        <Text variant="caption" tone="tertiary" numberOfLines={1}>
          {fmtDateTime(r.closeTime)} · {fmtDuration(t, r.durationSecs)}
        </Text>
      </View>
      <Mono size={15} weight="bold" tone={r.profit > 0 ? "up" : r.profit < 0 ? "down" : "secondary"}>
        {usdSigned(r.profit)}
      </Mono>
    </View>
  );
});

function TradesSheetList({ trades }: { trades: Trade[] }) {
  const insets = useSafeAreaInsets();
  const scroll = useBottomSheetScrollableCreator();
  return (
    <FlashList
      data={trades}
      keyExtractor={(r) => String(r.ticket)}
      renderItem={({ item }) => <TradeRow r={item} />}
      renderScrollComponent={scroll}
      contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: insets.bottom + space[6] }}
      showsVerticalScrollIndicator={false}
    />
  );
}

function TradesSection({ challengeId, a, active, refreshKey }: { challengeId: number; a: PhaseAccount; active: boolean; refreshKey: number }) {
  const t = useT();
  const q = useTrades(challengeId, a.phaseIndex, active ? 20_000 : undefined);
  const sheet = React.useRef<SheetRef>(null);
  const trades = q.data?.trades ?? [];
  const net = trades.reduce((s, r) => s + r.profit, 0);
  const { refresh } = q;
  React.useEffect(() => {
    if (refreshKey) void refresh();
  }, [refreshKey, refresh]);
  return (
    <>
      <SectionHead label={t("mobileProp.trades.title")} action={trades.length > 6 ? t("mobileProp.trades.all", { count: trades.length }) : undefined} onAction={() => sheet.current?.present()} />
      <Card padded={false} style={{ marginHorizontal: GUTTER, paddingHorizontal: space[5] }}>
        {q.loading ? (
          <View style={{ paddingVertical: space[4], gap: space[3] }}>
            <Skeleton h={40} />
            <Skeleton h={40} />
          </View>
        ) : trades.length === 0 ? (
          <Text variant="callout" tone="tertiary" style={{ paddingVertical: space[6] }} align="center">
            {q.error && !q.data ? q.error.message : t("mobileProp.trades.empty")}
          </Text>
        ) : (
          <>
            {trades.slice(0, 6).map((r) => (
              <TradeRow key={r.ticket} r={r} />
            ))}
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: space[4] }}>
              <Text variant="caption" tone="tertiary">
                {t("mobileProp.trades.count", { count: trades.length })}
              </Text>
              <Mono size={13} weight="bold" tone={net > 0 ? "up" : net < 0 ? "down" : "secondary"}>
                {usdSigned(net)}
              </Mono>
            </View>
          </>
        )}
      </Card>
      <Sheet ref={sheet} enableDynamicSizing={false} snapPoints={["88%"]} scroll>
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: GUTTER, paddingTop: space[1], paddingBottom: space[3], flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
            <Text variant="label" tone="tertiary">
              {t("mobileProp.trades.title")}
            </Text>
            <Mono size={13} weight="bold" tone={net > 0 ? "up" : net < 0 ? "down" : "secondary"}>
              {usdSigned(net)}
            </Mono>
          </View>
          <TradesSheetList trades={trades} />
        </View>
      </Sheet>
    </>
  );
}

const StatsCardMemo = React.memo(StatsCard);
export { StatsCardMemo as StatsCard };

const EventsListMemo = React.memo(EventsList);
export { EventsListMemo as EventsList };

const TradesSectionMemo = React.memo(TradesSection);
export { TradesSectionMemo as TradesSection };
