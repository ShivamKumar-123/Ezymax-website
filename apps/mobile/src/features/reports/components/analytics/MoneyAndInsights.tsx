// Analytics, lower sections: money flow (deposits → P&L → charges → withdrawals, equity now), the charges paid and
// the behaviour insights as a swipeable row of colour blocks (overtrading, revenge trades, risk per trade…).
import * as React from "react";
import { FlatList, useWindowDimensions, View, type ListRenderItem } from "react-native";
import { useT } from "@/i18n";
import { Card, ColorBlock, Display, Mono, Text } from "@/ui";
import { colors, GUTTER, radius, space, type BlockColor } from "@/theme/tokens";
import { insightView, usd, type InsightView } from "../../format";
import type { Analytics } from "../../types";
import { SectionTitle, Tag } from "../Chrome";

const tone = (v: number): "up" | "down" | "tertiary" => (v > 0 ? "up" : v < 0 ? "down" : "tertiary");

export const MoneyFlow = React.memo(function MoneyFlow({ f, periodLabel }: { f: Analytics["moneyFlow"]; periodLabel: string }) {
  const t = useT();
  const rows: { k: string; v: number; money?: boolean }[] = [
    { k: t("portfolio.an.flow.deposits"), v: f.deposits },
    { k: t("portfolio.an.flow.tradingPnl"), v: f.tradingPnl, money: true },
    ...(f.bonus ? [{ k: t("portfolio.an.flow.bonus"), v: f.bonus, money: true }] : []),
    ...(f.earnings ? [{ k: t("portfolio.an.flow.earnings"), v: f.earnings, money: true }] : []),
    { k: t("portfolio.an.flow.charges"), v: f.commission + f.performanceFees, money: true },
    ...(f.adjustments ? [{ k: t("portfolio.an.flow.adjustments"), v: f.adjustments, money: true }] : []),
    { k: t("portfolio.an.flow.withdrawals"), v: f.withdrawals },
  ];
  const net = rows.reduce((a, r) => a + r.v, 0);
  return (
    <View style={{ paddingHorizontal: GUTTER }}>
      <SectionTitle title={t("portfolio.an.flow.title")} subtitle={t("portfolio.an.flow.subtitle", { period: periodLabel })} />
      <Card padded={false} style={{ paddingHorizontal: space[4], paddingVertical: space[2] }}>
        {rows.map((r, i) => (
          <View key={r.k} style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: space[3], borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
            <Text variant="callout" tone="secondary" style={{ flex: 1 }} numberOfLines={1}>
              {r.k}
            </Text>
            <Mono size={14} weight="medium" tone={r.money ? tone(r.v) : r.v ? "primary" : "tertiary"}>
              {usd(r.v, true)}
            </Mono>
          </View>
        ))}
        <View style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: space[3], borderTopWidth: 1, borderTopColor: colors.lineStrong }}>
          <Text variant="callout" weight="700" style={{ flex: 1 }}>
            {t("portfolio.an.flow.net")}
          </Text>
          <Mono size={15} weight="bold">
            {usd(net, true)}
          </Mono>
        </View>
      </Card>
      <ColorBlock color="cream" padded={false} style={{ marginTop: space[3], paddingHorizontal: space[5], paddingVertical: space[4], flexDirection: "row", alignItems: "center", gap: space[3] }}>
        <Text variant="label" color={colors.ink2} style={{ flex: 1 }}>
          {t("mobileReports.an.flow.equityNow")}
        </Text>
        <Display size="md" color={colors.ink} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
          {usd(f.equityNow)}
        </Display>
      </ColorBlock>
    </View>
  );
});

export const Charges = React.memo(function Charges({ c }: { c: Analytics["charges"] }) {
  const t = useT();
  const parts = [
    { k: t("portfolio.an.charges.commission"), note: t("portfolio.an.charges.commissionNote"), v: c.commission, color: colors.ember },
    { k: t("portfolio.an.charges.swapPaid"), note: `${t("portfolio.an.charges.swapNote")}${c.swapEarned ? ` · ${t("portfolio.an.charges.swapEarned", { amount: usd(c.swapEarned) })}` : ""}`, v: c.swapPaid, color: colors.gold },
    { k: t("portfolio.an.charges.perfFees"), note: t("portfolio.an.charges.perfNote"), v: c.performanceFees, color: colors.periwinkle },
    { k: t("portfolio.an.charges.walletFees"), note: t("portfolio.an.charges.walletNote"), v: c.walletFees, color: colors.mint },
  ].filter((p) => p.v > 0);
  const total = parts.reduce((a, p) => a + p.v, 0);
  return (
    <View style={{ paddingHorizontal: GUTTER }}>
      <SectionTitle title={t("portfolio.an.charges.title")} subtitle={t("portfolio.an.charges.subtitle")} />
      <Card padded={false} style={{ padding: space[4], gap: space[3] }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
          <Text variant="label" tone="tertiary" style={{ fontSize: 10.5 }}>
            {t("mobileReports.an.charges.total")}
          </Text>
          <Display size="md">{usd(total)}</Display>
        </View>
        {parts.length ? (
          <>
            <View style={{ height: 12, borderRadius: radius.pill, overflow: "hidden", flexDirection: "row", gap: 2 }}>
              {parts.map((p) => (
                <View key={p.k} style={{ flex: p.v / total, backgroundColor: p.color }} />
              ))}
            </View>
            {parts.map((p) => (
              <View key={p.k} style={{ flexDirection: "row", alignItems: "flex-start", gap: space[3] }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: p.color, marginTop: 5 }} />
                <View style={{ flex: 1, gap: 1 }}>
                  <Text variant="callout">{p.k}</Text>
                  <Text variant="caption" tone="tertiary">
                    {p.note}
                  </Text>
                </View>
                <Mono size={14} weight="medium">
                  {usd(p.v)}
                </Mono>
              </View>
            ))}
          </>
        ) : (
          <Text variant="callout" tone="tertiary">
            {t("portfolio.an.charges.empty")}
          </Text>
        )}
        <View style={{ borderWidth: 1, borderStyle: "dashed", borderColor: colors.lineStrong, borderRadius: radius.md, padding: space[3], flexDirection: "row", alignItems: "center", gap: space[3] }}>
          <View style={{ flex: 1 }}>
            <Text variant="callout" tone="secondary">
              {t("portfolio.an.charges.spread")}
            </Text>
            <Text variant="caption" tone="tertiary">
              {t("portfolio.an.charges.spreadNote")}
            </Text>
          </View>
          <Mono size={14} weight="medium" tone="secondary">
            {usd(c.spreadEstimate)}
          </Mono>
        </View>
      </Card>
    </View>
  );
});

/* ------------------------------------------------------------------ */
/* Behaviour insights                                                  */
/* ------------------------------------------------------------------ */

const TONE_BLOCK: Record<InsightView["tone"], BlockColor> = { up: "mint", info: "periwinkle", warn: "gold", down: "ember" };

export const Insights = React.memo(function Insights({ d, periodLabel }: { d: Analytics; periodLabel: string }) {
  const t = useT();
  const { width } = useWindowDimensions();
  const cardW = Math.min(360, width - GUTTER * 2 - space[8]);
  const items = React.useMemo(() => d.behaviour.insights.map((i) => insightView(t, i, d)), [d, t]);
  const renderItem = React.useCallback<ListRenderItem<InsightView>>(({ item }) => <InsightCard v={item} width={cardW} />, [cardW]);
  return (
    <View>
      <SectionTitle
        title={t("portfolio.an.insights.title")}
        subtitle={t("portfolio.an.insights.subtitle", { period: periodLabel })}
        right={items.length ? <Tag label={t("portfolio.an.insights.count", { count: items.length })} tone="outline" /> : undefined}
        style={{ paddingHorizontal: GUTTER }}
      />
      {items.length === 0 ? (
        <Card style={{ marginHorizontal: GUTTER }}>
          <Text variant="callout" tone="tertiary">
            {t("portfolio.an.insights.empty")}
          </Text>
        </Card>
      ) : (
        <FlatList
          data={items}
          horizontal
          renderItem={renderItem}
          keyExtractor={(i) => i.id}
          showsHorizontalScrollIndicator={false}
          snapToInterval={cardW + space[3]}
          decelerationRate="fast"
          disableIntervalMomentum
          contentContainerStyle={{ paddingHorizontal: GUTTER, gap: space[3] }}
        />
      )}
    </View>
  );
});

function InsightCard({ v, width }: { v: InsightView; width: number }) {
  const t = useT();
  return (
    <ColorBlock color={TONE_BLOCK[v.tone]} style={{ width, minHeight: 236, justifyContent: "space-between" }} accessible accessibilityLabel={`${v.title}. ${v.stat}. ${v.text} ${v.tip}`}>
      <View style={{ gap: space[3] }}>
        <Display size="sm" color={colors.ink} numberOfLines={2}>
          {v.title}
        </Display>
        <Display size="xl" color={colors.ink} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
          {v.stat}
        </Display>
        <Text variant="callout" color={colors.ink} style={{ fontWeight: "500" }}>
          {v.text}
        </Text>
      </View>
      <View style={{ marginTop: space[4], paddingTop: space[3], borderTopWidth: 1, borderTopColor: "rgba(14,14,16,0.16)", flexDirection: "row", gap: space[2] }}>
        <Text variant="label" color={colors.ink2} style={{ fontSize: 10, marginTop: 2 }}>
          {t("mobileReports.insight.tip")}
        </Text>
        <Text variant="caption" color={colors.ink} style={{ flex: 1 }}>
          {v.tip}
        </Text>
      </View>
    </ColorBlock>
  );
}
