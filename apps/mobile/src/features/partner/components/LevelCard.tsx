// The partner level and the progress toward the next one (D58): both monthly targets (active clients and network
// lots) must be met on the 1st of the month for a promotion; the ladder shows every level of the programme.
import * as React from "react";
import { View } from "react-native";
import { useT } from "@/i18n";
import { Card, Display, Mono, Text } from "@/ui";
import { colors, space } from "@/theme/tokens";
import { date, lots as fmtLots, month, pct as fmtPct, scheduleLabel } from "../format";
import type { Dashboard, Level } from "../types";
import { Bar, Label, Tag } from "./Chrome";

function Target({ label, value, target, pct, nextName, hint, digits }: { label: string; value: number; target: number | null; pct: number; nextName?: string; hint: string; digits: number }) {
  const t = useT();
  const done = pct >= 100;
  const fmt = (v: number) => (digits ? fmtLots(v, digits) : String(Math.round(v)));
  return (
    <View style={{ gap: space[2] }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: space[3] }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Label>{label}</Label>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
            <Mono size={24} weight="bold">
              {fmt(value)}
            </Mono>
            {target !== null ? (
              <Mono size={14} tone="tertiary">
                / {fmt(target)}
              </Mono>
            ) : null}
          </View>
        </View>
        {target !== null && nextName ? (
          <Text variant="caption" tone={done ? "gold" : "tertiary"} numberOfLines={1}>
            {t("mobilePartner.level.pctTo", { pct: Math.min(100, Math.floor(pct)), name: nextName })}
          </Text>
        ) : null}
      </View>
      {target !== null ? <Bar pct={pct} color={done ? colors.gold : colors.ember} height={8} /> : null}
      <Text variant="caption" tone="tertiary">
        {hint}
      </Text>
    </View>
  );
}

export const LevelCard = React.memo(function LevelCard({ d }: { d: Dashboard }) {
  const t = useT();
  const levels = React.useMemo(() => [...d.progress.levels].sort((a, b) => a.rank - b.rank), [d.progress.levels]);
  const cur: Level | null = d.member.level ?? levels[0] ?? null;
  const curIdx = Math.max(0, levels.findIndex((l) => l.key === cur?.key));
  const next = d.progress.next;
  const { activeClients, monthlyLots, monthEnds } = d.progress;
  const clientsPct = next ? (next.minActiveClients > 0 ? (activeClients / next.minActiveClients) * 100 : 100) : 100;
  const lotsPct = next ? (next.minMonthlyLots > 0 ? (monthlyLots / next.minMonthlyLots) * 100 : 100) : 100;
  const resets = date(monthEnds, false);
  const suspended = d.member.status !== "active";
  const ladder = levels.length > 1 ? ((curIdx + (next ? Math.min(clientsPct, lotsPct, 100) / 100 : 0)) / (levels.length - 1)) * 100 : 100;

  return (
    <Card style={{ gap: space[5] }}>
      <View style={{ gap: space[1] }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[2] }}>
          <Text variant="label" tone="ember">
            {t("mobilePartner.level.of", { n: curIdx + 1, total: levels.length || 1 })}
          </Text>
          {suspended ? <Tag label={t("mobilePartner.level.suspended")} tone="warn" /> : <Tag label={t("mobilePartner.level.payouts", { schedule: scheduleLabel(t, d.programme.payout.schedule) })} tone="gold" />}
        </View>
        <Display size="lg" numberOfLines={1}>
          {cur?.name ?? t("mobilePartner.level.fallback")}
        </Display>
        <Text variant="caption" tone="tertiary">
          {t("mobilePartner.level.since", { date: month(d.member.joinedAt) })} · {t("mobilePartner.level.rebateSplit", { rebate: fmtPct(d.member.rebatePct), split: fmtPct(d.member.splitPct) })}
        </Text>
      </View>

      {levels.length > 1 ? (
        <View accessible accessibilityLabel={t("mobilePartner.level.ladderA11y", { name: cur?.name ?? "", n: curIdx + 1, total: levels.length })}>
          <View style={{ height: 14, justifyContent: "center", marginHorizontal: `${50 / levels.length}%` }}>
            {/* a row, so the progress grows from the start edge in right-to-left languages too */}
            <View style={{ height: 2, backgroundColor: colors.surface3, borderRadius: 1, flexDirection: "row" }}>
              <View style={{ width: `${Math.min(100, ladder)}%`, backgroundColor: colors.gold, borderRadius: 1 }} />
            </View>
          </View>
          <View style={{ flexDirection: "row", marginTop: -14 }}>
            {levels.map((l, i) => {
              const done = i < curIdx;
              const on = i === curIdx;
              return (
                <View key={l.key} style={{ flex: 1, alignItems: "center", gap: 6 }}>
                  <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: on ? colors.ember : done ? colors.gold : colors.surface3, borderWidth: on ? 3 : 0, borderColor: colors.surface }} />
                  <Text variant="caption" color={on ? colors.text : done ? colors.gold : colors.text3} numberOfLines={1} style={{ fontSize: 11 }}>
                    {l.name}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      <Target
        label={t("mobilePartner.level.activeClients")}
        value={activeClients}
        target={next?.minActiveClients ?? null}
        pct={clientsPct}
        nextName={next?.name}
        digits={0}
        hint={next ? (next.minActiveClients > activeClients ? t("mobilePartner.level.moreClients", { count: next.minActiveClients - activeClients }) : t("mobilePartner.level.targetMet")) : t("mobilePartner.level.clientsTraded")}
      />
      <Target
        label={t("mobilePartner.level.networkLots")}
        value={monthlyLots}
        target={next?.minMonthlyLots ?? null}
        pct={lotsPct}
        nextName={next?.name}
        digits={1}
        hint={next ? (next.minMonthlyLots > monthlyLots ? t("mobilePartner.level.lotsToGo", { lots: fmtLots(next.minMonthlyLots - monthlyLots, 1), date: resets }) : t("mobilePartner.level.targetMetResets", { date: resets })) : t("mobilePartner.level.allTiersResets", { date: resets })}
      />

      <View style={{ gap: space[2], paddingTop: space[4], borderTopWidth: 1, borderTopColor: colors.line }}>
        <Label>{next ? t("mobilePartner.level.unlockAt", { name: next.name }) : t("mobilePartner.level.topReached")}</Label>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
          {(next ? next.perks : cur?.perks ?? []).length ? (
            (next ? next.perks : cur?.perks ?? []).map((p) => <Tag key={p} label={p} tone="outline" />)
          ) : (
            <Text variant="caption" tone="tertiary">
              {t("mobilePartner.level.higherRates")}
            </Text>
          )}
        </View>
      </View>
    </Card>
  );
});
