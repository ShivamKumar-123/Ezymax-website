// /social/masters/[id] — a master's public profile: identity (house disclosure in full), returns, the growth of
// $10,000 on the Skia chart, risk score and statistics, monthly returns, instruments, fee terms and the delayed
// trade history. Copy / Invest sit in a sticky bar. The screen is one FlashList, so 100 trades stay smooth.
import * as React from "react";
import { RefreshControl, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { CalendarClock, Clock, Copy as CopyIcon, Landmark, Lock, Snowflake, Users } from "lucide-react-native";
import { useFormat, useT } from "@/i18n";
import { fmtPrice } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { prefetch, useQuery } from "@/lib/query";
import { instrument } from "@/market/instruments";
import { Button, Card, ColorBlock, Display, Mono, Pill, Screen, Skeleton, Text, useBottomInset } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { fetchers, keys, validId, type MasterProfile, type MasterTrade } from "../api";
import { compactUsd, ddText, formatAge, nav4, pct, periodLabel, shownTone, usd } from "../format";
import { ActionBar, TopBar, useBack } from "../components/chrome";
import { GrowthCard, type Point } from "../components/GrowthCard";
import { Avatar, HouseDisclosure, ProgramTags, RiskMeter } from "../components/identity";
import { MonthlyGrid } from "../components/MonthlyGrid";
import { KeyValues, Note, SectionTitle, StatGrid, Tag } from "../components/primitives";
import { BlockSkeleton, LoadError } from "../components/states";
import { inkSoft } from "../tint";

type Item =
  | { type: "hero" }
  | { type: "returns" }
  | { type: "growth" }
  | { type: "risk" }
  | { type: "monthly" }
  | { type: "symbols" }
  | { type: "fees" }
  | { type: "tradesHead" }
  | { type: "trade"; trade: MasterTrade }
  | { type: "more"; count: number }
  | { type: "tradesEmpty" }
  | { type: "disclaimer" };

const FIRST_TRADES = 15;
const TRADE_ROW = 68;

export function MasterScreen() {
  const t = useT();
  const router = useRouter();
  const back = useBack();
  const { id } = useLocalSearchParams<{ id: string }>();
  const ok = validId(id);
  const q = useQuery(ok ? keys.master(id) : null, fetchers.master(id ?? ""), { persist: true, intervalMs: 60_000 });
  const p = q.data;
  const [allTrades, setAllTrades] = React.useState(false);
  const [titled, setTitled] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const bottom = useBottomInset(false);

  // the follow wizard opens instantly: its symbols and the wallet balance are warmed with the profile
  React.useEffect(() => {
    prefetch(keys.symbols, fetchers.symbols, { persist: true, staleMs: 3_600_000 });
    prefetch(keys.wallet, fetchers.wallet, { staleMs: 5_000 });
  }, []);

  const onScroll = React.useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const past = e.nativeEvent.contentOffset.y > 140;
    setTitled((v) => (v === past ? v : past));
  }, []);

  const items = React.useMemo<Item[]>(() => {
    if (!p) return [];
    const out: Item[] = [{ type: "hero" }, { type: "returns" }, { type: "growth" }, { type: "risk" }, { type: "monthly" }];
    if (p.symbols.length) out.push({ type: "symbols" });
    out.push({ type: "fees" }, { type: "tradesHead" });
    if (!p.trades.length) out.push({ type: "tradesEmpty" });
    const shown = allTrades ? p.trades : p.trades.slice(0, FIRST_TRADES);
    for (const trade of shown) out.push({ type: "trade", trade });
    if (!allTrades && p.trades.length > FIRST_TRADES) out.push({ type: "more", count: p.trades.length });
    out.push({ type: "disclaimer" });
    return out;
  }, [p, allTrades]);

  const onRefresh = React.useCallback(async () => {
    haptic.select();
    setRefreshing(true);
    try {
      await q.refresh();
    } finally {
      setRefreshing(false);
    }
  }, [q]);

  const renderItem = React.useCallback(
    ({ item }: { item: Item }) => {
      if (!p) return null;
      switch (item.type) {
        case "hero":
          return <Hero p={p} />;
        case "returns":
          return <Returns p={p} />;
        case "growth":
          return <Growth p={p} />;
        case "risk":
          return <RiskCard p={p} />;
        case "monthly":
          return (
            <Section>
              <Card>
                <SectionTitle title={t("mobileSocial.master.monthly")} sub={t("mobileSocial.master.monthlySub")} />
                <MonthlyGrid monthly={p.monthly} />
              </Card>
            </Section>
          );
        case "symbols":
          return <Symbols p={p} />;
        case "fees":
          return <Fees p={p} />;
        case "tradesHead":
          return (
            <View style={{ paddingHorizontal: GUTTER, paddingTop: space[8], paddingBottom: space[2] }}>
              <SectionTitle
                title={t("mobileSocial.master.history")}
                sub={t("mobileSocial.master.historySub")}
                right={p.tradeDelayMinutes > 0 ? <Tag tone="warn" label={t("mobileSocial.master.delay", { n: p.tradeDelayMinutes })} icon={<Clock size={12} color={colors.gold} />} /> : null}
              />
            </View>
          );
        case "trade":
          return <TradeRow trade={item.trade} />;
        case "more":
          return (
            <View style={{ paddingHorizontal: GUTTER, paddingTop: space[4] }}>
              <Button testID="master-all-trades" label={t("mobileSocial.master.showAllTrades", { count: item.count })} variant="secondary" size="md" onPress={() => setAllTrades(true)} />
            </View>
          );
        case "tradesEmpty":
          return (
            <Text variant="callout" tone="tertiary" style={{ paddingHorizontal: GUTTER, paddingVertical: space[4] }}>
              {p.tradeDelayMinutes > 0 ? t("mobileSocial.master.historyEmptyDelay", { n: p.tradeDelayMinutes }) : t("mobileSocial.master.historyEmpty")}
            </Text>
          );
        case "disclaimer":
          return (
            <View style={{ paddingHorizontal: GUTTER, paddingTop: space[8] }}>
              <Note>{t("mobileSocial.master.disclaimer")}</Note>
            </View>
          );
      }
    },
    [p, t],
  );

  if (!ok || (!p && q.error)) {
    return (
      <Screen scroll={false} tabBar={false}>
        <TopBar onBack={back} />
        <LoadError error={ok ? q.error : { code: "not_found", message: "", status: 404 }} onRetry={() => void q.refresh()} onBack={() => router.replace("/social")} />
      </Screen>
    );
  }

  const m = p?.master;
  const canCopy = !!m && m.program !== "pamm" && m.status === "approved" && !m.frozen && !(m.house && m.hidden);
  const canInvest = !!m?.fund && m.program !== "copy" && m.fund.status === "active";
  const hasBar = !!m && (m.program !== "pamm" || canInvest);

  return (
    <Screen scroll={false} tabBar={false}>
      <TopBar onBack={back} title={titled ? m?.nickname : undefined} />
      {!p ? (
        <View style={{ gap: space[4], paddingTop: space[2] }}>
          <View style={{ paddingHorizontal: GUTTER, flexDirection: "row", gap: space[4], alignItems: "center" }}>
            <Skeleton w={72} h={72} r={24} />
            <View style={{ flex: 1, gap: space[2] }}>
              <Skeleton w="70%" h={28} />
              <Skeleton w="45%" h={14} />
            </View>
          </View>
          <BlockSkeleton height={120} />
          <BlockSkeleton height={300} />
        </View>
      ) : (
        <FlashList
          data={items}
          renderItem={renderItem}
          keyExtractor={itemKey}
          getItemType={(it) => it.type}
          onScroll={onScroll}
          scrollEventThrottle={32}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: hasBar ? space[8] : bottom + space[8] }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text3} colors={[colors.ember]} progressBackgroundColor={colors.surface} />}
        />
      )}
      {m && m.program !== "pamm" ? (
        <ActionBar style={{ flexDirection: "column", gap: space[2] }}>
          {/* a disabled Copy says why (frozen by the risk team, a hidden house strategy, not approved any more) */}
          {!canCopy ? (
            <Text testID="master-copy-unavailable" variant="caption" tone="tertiary" align="center">
              {t("mobileSocial.master.copyUnavailable")}
            </Text>
          ) : null}
          <View style={{ flexDirection: "row", gap: space[3] }}>
            <Button
              testID="master-copy"
              label={t("mobileSocial.master.copy")}
              icon={<CopyIcon size={18} color={colors.ink} />}
              disabled={!canCopy}
              style={{ flex: 1 }}
              onPress={() => router.push(`/social/follow/${m.id}`)}
            />
            {canInvest ? (
              <Button
                testID="master-invest"
                label={t("mobileSocial.master.invest")}
                variant="cream"
                icon={<Landmark size={18} color={colors.ink} />}
                style={{ flex: 1 }}
                onPress={() => router.push(`/social/pamm/${m.fund!.id}/invest`)}
              />
            ) : null}
          </View>
        </ActionBar>
      ) : canInvest && m ? (
        <ActionBar>
          <Button
            testID="master-invest"
            label={t("mobileSocial.master.invest")}
            icon={<Landmark size={18} color={colors.ink} />}
            style={{ flex: 1 }}
            onPress={() => router.push(`/social/pamm/${m.fund!.id}/invest`)}
          />
        </ActionBar>
      ) : null}
    </Screen>
  );
}

const itemKey = (it: Item, i: number) => (it.type === "trade" ? `t${it.trade.id}` : `${it.type}${i}`);

function Section({ children }: { children: React.ReactNode }) {
  return <View style={{ paddingHorizontal: GUTTER, paddingTop: space[4] }}>{children}</View>;
}

function Hero({ p }: { p: MasterProfile }) {
  const t = useT();
  const fmt = useFormat();
  const m = p.master;
  const s = m.stats;
  const [more, setMore] = React.useState(false);
  const long = (m.description?.length ?? 0) > 180;
  return (
    <View style={{ paddingHorizontal: GUTTER, gap: space[4] }}>
      <View style={{ flexDirection: "row", gap: space[4], alignItems: "center" }}>
        <Avatar name={m.nickname} size={72} house={m.house} />
        <View style={{ flex: 1, gap: space[1] }}>
          <Display size="lg" accessibilityRole="header" numberOfLines={2}>
            {m.nickname}
          </Display>
          <Text variant="callout" tone="secondary" numberOfLines={2}>
            {m.strategy}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
        {m.house ? null : <Tag tone="good" label={t("mobileSocial.master.approved")} />}
        <ProgramTags program={m.program} hasFund={!!m.fund} />
        {m.frozen ? <Tag tone="warn" label={t("mobileSocial.master.frozen")} icon={<Snowflake size={12} color={colors.gold} />} /> : null}
      </View>
      {m.house ? <HouseDisclosure /> : null}
      {m.description ? (
        <View>
          <Text tone="secondary" numberOfLines={more || !long ? undefined : 4} style={{ lineHeight: 22 }}>
            {m.description}
          </Text>
          {long && !more ? <Pill compact label={t("mobileSocial.master.readMore")} onPress={() => setMore(true)} style={{ alignSelf: "flex-start", marginTop: space[2] }} /> : null}
        </View>
      ) : null}
      <View style={{ gap: 6 }}>
        <Meta icon={<CalendarClock size={14} color={colors.text3} />} text={t("mobileSocial.master.since", { date: m.since ? fmt.date(m.since) : "—", age: formatAge(m.ageDays, t) })} />
        <Meta
          icon={<Users size={14} color={colors.text3} />}
          text={[
            t("mobileSocial.master.followers", { count: s.followers, n: fmt.number(s.followers, 0) }),
            m.fund ? t("mobileSocial.master.investors", { count: s.investors, n: fmt.number(s.investors, 0) }) : null,
            t("mobileSocial.master.aumLine", { value: compactUsd(s.aum) }),
          ]
            .filter(Boolean)
            .join(" · ")}
        />
      </View>
    </View>
  );
}

function Meta({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
      {icon}
      <Text variant="caption" tone="tertiary" style={{ flex: 1 }}>
        {text}
      </Text>
    </View>
  );
}

/** Three huge returns (money colours) with small labels. */
function Returns({ p }: { p: MasterProfile }) {
  const t = useT();
  const s = p.master.stats;
  const cells: [string, number][] = [
    [t("mobileSocial.lb.returnLabel", { period: t("mobileSocial.lb.period.1m") }), s.return1m],
    [t("mobileSocial.lb.returnLabel", { period: t("mobileSocial.lb.period.1y") }), s.return1y],
    [t("mobileSocial.master.returnAll"), s.returnAll],
  ];
  return (
    <Section>
      <View style={{ flexDirection: "row", marginTop: space[2], paddingVertical: space[5], borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line }}>
        {cells.map(([label, v], i) => (
          <View key={label} style={{ flex: 1, gap: 2, paddingStart: i ? space[3] : 0, borderStartWidth: i ? 1 : 0, borderColor: colors.line }}>
            <Mono size={24} weight="bold" tone={shownTone(v, 1)} numberOfLines={1} adjustsFontSizeToFit>
              {pct(v, 1)}
            </Mono>
            <Text variant="label" tone="tertiary" numberOfLines={1}>
              {label}
            </Text>
          </View>
        ))}
      </View>
    </Section>
  );
}

function Growth({ p }: { p: MasterProfile }) {
  const t = useT();
  const points = React.useMemo<Point[]>(
    () =>
      p.equity
        .map((e) => ({ t: Date.parse(e.day.length === 10 ? `${e.day}T00:00:00Z` : e.day), v: +(e.index * 10000).toFixed(2) }))
        .filter((e) => Number.isFinite(e.t) && Number.isFinite(e.v))
        .sort((a, b) => a.t - b.t),
    [p.equity],
  );
  return (
    <Section>
      <GrowthCard
        testID="master-growth"
        title={t("mobileSocial.master.growth")}
        hint={t("mobileSocial.master.growthHint")}
        points={points}
        format={(v) => usd(v)}
        emptyTitle={t("mobileSocial.master.growthEmptyTitle")}
        emptyText={t("mobileSocial.master.growthEmptyText")}
      />
    </Section>
  );
}

function RiskCard({ p }: { p: MasterProfile }) {
  const t = useT();
  const fmt = useFormat();
  const s = p.master.stats;
  return (
    <Section>
      <Card>
        <SectionTitle title={t("mobileSocial.master.risk")} sub={t("mobileSocial.master.riskSub")} />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: space[5] }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
            <Display size="hero" style={{ fontSize: 64, lineHeight: 66 }}>
              {String(Math.max(1, Math.min(10, Math.round(s.riskScore || 1))))}
            </Display>
            <Text variant="headline" tone="tertiary">
              /10
            </Text>
          </View>
          <RiskMeter risk={s.riskScore} size="lg" showLabel />
        </View>
        <StatGrid
          columns={3}
          items={[
            { label: t("mobileSocial.master.winRate"), value: s.trades ? `${s.winRate.toFixed(1)}%` : "—" },
            { label: t("mobileSocial.master.trades"), value: fmt.number(s.trades, 0) },
            { label: t("mobileSocial.maxDd"), value: ddText(s.maxDd), tone: s.maxDd > 0 ? "down" : undefined },
            { label: t("mobileSocial.master.currentDd"), value: ddText(s.currentDd), tone: s.currentDd > 10 ? "down" : undefined },
            { label: t("mobileSocial.master.volatility"), value: `${s.volatility.toFixed(1)}%` },
            { label: t("mobileSocial.master.equityShort"), value: compactUsd(s.equity) },
          ]}
        />
      </Card>
    </Section>
  );
}

const BAR_COLORS = [colors.ember, colors.gold, colors.mint, colors.periwinkle, colors.cream, colors.text3];

function Symbols({ p }: { p: MasterProfile }) {
  const t = useT();
  const rows = React.useMemo(() => {
    const sorted = [...p.symbols].sort((a, b) => b.share - a.share);
    const top = sorted.slice(0, 5).map((x) => ({ label: x.symbol, share: x.share }));
    const rest = sorted.slice(5).reduce((a, x) => a + x.share, 0);
    return rest > 0 ? [...top, { label: t("mobileSocial.master.other"), share: rest }] : top;
  }, [p.symbols, t]);
  const total = rows.reduce((a, r) => a + r.share, 0) || 1;
  return (
    <Section>
      <Card>
        <SectionTitle title={t("mobileSocial.master.instruments")} sub={t("mobileSocial.master.instrumentsSub")} />
        <View style={{ gap: space[3] }}>
          {rows.map((r, i) => {
            const share = (r.share / total) * 100;
            return (
              <View key={r.label} style={{ gap: 6 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text variant="callout" weight="700">
                    {r.label}
                  </Text>
                  <Mono size={13} tone="secondary">
                    {`${share.toFixed(1)}%`}
                  </Mono>
                </View>
                <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.surface2, overflow: "hidden" }}>
                  <View style={{ width: `${Math.max(2, share)}%`, height: 8, borderRadius: 4, backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }} />
                </View>
              </View>
            );
          })}
        </View>
      </Card>
    </Section>
  );
}

/** Gold block: the fee terms, huge performance fee. */
function Fees({ p }: { p: MasterProfile }) {
  const t = useT();
  const f = p.master.fund;
  const terms = p.terms;
  const rows: [string, React.ReactNode][] = [
    [t("mobileSocial.master.hwm"), t("common.yes")],
    [t("mobileSocial.master.settlement"), periodLabel(terms.feePeriod, t)],
    [t("mobileSocial.master.minAllocation"), usd(terms.minAllocation, 0)],
  ];
  if (f) {
    rows.push(
      [t("mobileSocial.master.fund"), f.name],
      [t("mobileSocial.navPerUnit"), nav4(f.nav)],
      [t("mobileSocial.master.rollover"), periodLabel(f.period, t)],
      [t("mobileSocial.master.fundFee"), `${f.perfFeePct}%`],
      [
        t("mobileSocial.master.lockIn"),
        f.lockInDays ? (
          <View key="l" style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Lock size={13} color={colors.ink} />
            <Text variant="callout" weight="600" color={colors.ink}>
              {t("mobileSocial.master.days", { count: f.lockInDays })}
            </Text>
          </View>
        ) : (
          t("common.none")
        ),
      ],
      [t("mobileSocial.master.minInvestment"), usd(f.minInvestment, 0)],
    );
  }
  return (
    <Section>
      <ColorBlock color="gold" style={{ marginTop: space[4] }}>
        <Text variant="label" color={inkSoft}>
          {t("mobileSocial.master.fees")}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: space[2], marginTop: space[1] }}>
          <Display size="hero" color={colors.ink} style={{ fontSize: 72, lineHeight: 74 }}>
            {`${terms.perfFeePct}%`}
          </Display>
          <Text variant="headline" color={colors.ink} weight="700">
            {t("mobileSocial.master.perfFee")}
          </Text>
        </View>
        <Text variant="caption" color={inkSoft} style={{ marginBottom: space[3] }}>
          {t("mobileSocial.master.feesSub")}
        </Text>
        <KeyValues ink rows={rows} />
        <Text variant="caption" color={inkSoft} style={{ marginTop: space[3], lineHeight: 17 }}>
          {t.dyn(`mobileSocial.master.feeNote.${terms.feePeriod}`, "")}
        </Text>
      </ColorBlock>
    </Section>
  );
}

const TradeRow = React.memo(function TradeRow({ trade }: { trade: MasterTrade }) {
  const t = useT();
  const fmt = useFormat();
  const digits = instrument(trade.symbol).digits;
  return (
    <View style={{ height: TRADE_ROW, marginHorizontal: GUTTER, flexDirection: "row", alignItems: "center", gap: space[3], borderBottomWidth: 1, borderBottomColor: colors.line }}>
      <View style={{ width: 44, height: 24, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: trade.side === "buy" ? colors.upSoft : colors.downSoft }}>
        <Text variant="caption" weight="700" color={trade.side === "buy" ? colors.up : colors.down}>
          {t(trade.side === "buy" ? "mobileSocial.side.buy" : "mobileSocial.side.sell")}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <View style={{ flexDirection: "row", gap: space[2], alignItems: "baseline" }}>
          <Text variant="callout" weight="700">
            {trade.symbol}
          </Text>
          <Mono size={12} tone="tertiary">
            {`${trade.volume.toFixed(2)} ${t("mobileSocial.lotsUnit")}`}
          </Mono>
        </View>
        <Mono size={11.5} tone="tertiary" numberOfLines={1}>
          {`${fmtPrice(trade.openPrice, digits)} → ${fmtPrice(trade.closePrice, digits)}`}
        </Mono>
      </View>
      <View style={{ alignItems: "flex-end", gap: 3 }}>
        <Mono size={15} weight="bold" tone={shownTone(trade.profit)}>
          {usd(trade.profit, 2, true)}
        </Mono>
        <Text variant="caption" tone="tertiary" style={{ fontSize: 11 }}>
          {fmt.dateTime(trade.closeTime)}
        </Text>
      </View>
    </View>
  );
});
