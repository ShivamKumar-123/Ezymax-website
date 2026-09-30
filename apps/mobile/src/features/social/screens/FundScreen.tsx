// /social/pamm/[id] — one PAMM fund: NAV and returns, the NAV history (Skia), terms (rollover, fee above the
// high-water mark, lock-in, minimum, drawdown freeze, master's share), rollovers, and my position in it (units,
// value, stop-loss, pending requests, unit ledger). Invest / Redeem in the action bar.
import * as React from "react";
import { RefreshControl, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { Snowflake } from "lucide-react-native";
import { useFormat, useT } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { useQuery } from "@/lib/query";
import { Banner, Button, Card, Display, Mono, PressableScale, Screen, Skeleton, Text, type SheetRef } from "@/ui";
import { colors, GUTTER, space } from "@/theme/tokens";
import { fetchers, keys, validId, type FundDetail, type InvestmentView, type RequestView, type Statement } from "../api";
import { compactUsd, ddText, nav4, pct, periodLabel, shownTone, units4, usd } from "../format";
import { ActionBar, ForwardIcon, TopBar, useBack } from "../components/chrome";
import { HoldingCard, fundTone } from "../components/FundCard";
import { GrowthCard, type Point } from "../components/GrowthCard";
import { Avatar } from "../components/identity";
import { KeyValues, SectionTitle, StatGrid, Tag } from "../components/primitives";
import { ROW, RequestRow } from "../components/rows";
import { LoadError } from "../components/states";
import { CancelRequestSheet, StopLossSheet } from "../sheets/PammSheets";

type Rollover = FundDetail["rollovers"][number];
type Ledger = Statement["items"][number];
type Item =
  { k: "top" } | { k: "rollHead" } | { k: "roll"; r: Rollover } | { k: "noRoll" } | { k: "ledgerHead" } | { k: "ledger"; l: Ledger; i: number } | { k: "reqHead" } | { k: "req"; r: RequestView };

export function FundScreen() {
  const t = useT();
  const router = useRouter();
  const back = useBack("/social/pamm");
  const { id } = useLocalSearchParams<{ id: string }>();
  const ok = validId(id);
  const q = useQuery(ok ? keys.fund(id) : null, fetchers.fund(id ?? ""), { persist: true, intervalMs: 60_000 });
  const inv = useQuery(keys.investments, fetchers.investments, { persist: true });
  const mine = inv.data?.items.find((i) => String(i.fundId) === id) ?? null;
  const involved = !!mine || !!inv.data?.requests.some((r) => String(r.fundId) === id);
  const stmt = useQuery(ok && involved ? keys.statement(id) : null, fetchers.statement(id ?? ""), { staleMs: 15_000 });
  const [titled, setTitled] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [slInv, setSlInv] = React.useState<InvestmentView | null>(null);
  const [cancelReq, setCancelReq] = React.useState<RequestView | null>(null);
  const slSheet = React.useRef<SheetRef>(null);
  const cancelSheet = React.useRef<SheetRef>(null);
  const d = q.data;

  const items = React.useMemo<Item[]>(() => {
    if (!d) return [];
    const out: Item[] = [{ k: "top" }];
    if (stmt.data?.items.length) {
      out.push({ k: "ledgerHead" });
      stmt.data.items.forEach((l, i) => out.push({ k: "ledger", l, i }));
    }
    const reqs = stmt.data?.requests.filter((r) => r.status !== "pending") ?? [];
    if (reqs.length) {
      out.push({ k: "reqHead" });
      for (const r of [...reqs].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) out.push({ k: "req", r });
    }
    out.push({ k: "rollHead" });
    if (d.rollovers.length) for (const r of [...d.rollovers].sort((a, b) => b.at.localeCompare(a.at))) out.push({ k: "roll", r });
    else out.push({ k: "noRoll" });
    return out;
  }, [d, stmt.data]);

  const onScroll = React.useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const past = e.nativeEvent.contentOffset.y > 120;
    setTitled((v) => (v === past ? v : past));
  }, []);
  const onRefresh = React.useCallback(async () => {
    haptic.select();
    setRefreshing(true);
    try {
      await Promise.all([q.refresh(), inv.refresh(), involved ? stmt.refresh() : Promise.resolve()]);
    } finally {
      setRefreshing(false);
    }
  }, [q, inv, stmt, involved]);
  const stopLoss = React.useCallback((i: InvestmentView) => {
    setSlInv(i);
    requestAnimationFrame(() => slSheet.current?.present());
  }, []);
  const cancel = React.useCallback((r: RequestView) => {
    setCancelReq(r);
    requestAnimationFrame(() => cancelSheet.current?.present());
  }, []);

  if (!ok || (!d && q.error)) {
    return (
      <Screen scroll={false} tabBar={false}>
        <TopBar onBack={back} />
        <LoadError error={ok ? q.error : { code: "not_found", message: "", status: 404 }} onRetry={() => void q.refresh()} onBack={back} />
      </Screen>
    );
  }
  if (!d) {
    return (
      <Screen scroll={false} tabBar={false}>
        <TopBar onBack={back} />
        <View style={{ paddingHorizontal: GUTTER, gap: space[4] }}>
          <Skeleton w="70%" h={36} />
          <Skeleton w="40%" h={14} />
          <Skeleton h={120} r={28} />
          <Skeleton h={300} r={28} />
        </View>
      </Screen>
    );
  }
  const f = d.fund;

  return (
    <Screen scroll={false} tabBar={false}>
      <TopBar onBack={back} title={titled ? f.name : undefined} />
      <FlashList
        data={items}
        keyExtractor={itemKey}
        getItemType={(i) => i.k}
        onScroll={onScroll}
        scrollEventThrottle={32}
        renderItem={({ item }) => {
          switch (item.k) {
            case "top":
              return (
                <Top d={d} mine={mine} onAdd={() => router.push(`/social/pamm/${f.id}/invest`)} onRedeem={() => router.push(`/social/pamm/${f.id}/redeem`)} onStopLoss={stopLoss} onCancel={cancel} />
              );
            case "ledgerHead":
              return <Head title={t("mobileSocial.fund.statement")} />;
            case "ledger":
              return <LedgerRow l={item.l} />;
            case "reqHead":
              return <Head title={t("mobileSocial.fund.requests")} />;
            case "req":
              return <RequestRow r={item.r} />;
            case "rollHead":
              return <Head title={t("mobileSocial.fund.rollovers")} />;
            case "roll":
              return <RollRow r={item.r} />;
            case "noRoll":
              return (
                <Text tone="tertiary" style={{ paddingHorizontal: GUTTER, paddingVertical: space[3] }}>
                  {t("mobileSocial.fund.noRollovers")}
                </Text>
              );
          }
        }}
        contentContainerStyle={{ paddingBottom: space[8] }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text3} colors={[colors.ember]} progressBackgroundColor={colors.surface} />}
      />
      <ActionBar>
        {mine && mine.units > 0 ? (
          <Button testID="fund-redeem" label={t("mobileSocial.inv.redeem")} variant="secondary" style={{ flex: 1 }} onPress={() => router.push(`/social/pamm/${f.id}/redeem`)} />
        ) : null}
        <Button testID="fund-invest" label={t("mobileSocial.fund.invest")} style={{ flex: 1 }} disabled={f.status !== "active"} onPress={() => router.push(`/social/pamm/${f.id}/invest`)} />
      </ActionBar>
      <StopLossSheet ref={slSheet} inv={slInv} />
      <CancelRequestSheet ref={cancelSheet} req={cancelReq} />
    </Screen>
  );
}

const itemKey = (i: Item, n: number) => (i.k === "roll" ? `r${i.r.at}` : i.k === "ledger" ? `l${i.i}` : i.k === "req" ? `q${i.r.id}` : `${i.k}${n}`);

function Head({ title }: { title: string }) {
  return (
    <View style={{ paddingHorizontal: GUTTER, paddingTop: space[8] }}>
      <SectionTitle title={title} />
    </View>
  );
}

function Top({
  d,
  mine,
  onAdd,
  onRedeem,
  onStopLoss,
  onCancel,
}: {
  d: FundDetail;
  mine: InvestmentView | null;
  onAdd: () => void;
  onRedeem: () => void;
  onStopLoss: (i: InvestmentView) => void;
  onCancel: (r: RequestView) => void;
}) {
  const t = useT();
  const fmt = useFormat();
  const router = useRouter();
  const f = d.fund;
  const points = React.useMemo<Point[]>(
    () =>
      d.navHistory
        .map((p) => ({ t: Date.parse(p.at), v: p.nav }))
        .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v))
        .sort((a, b) => a.t - b.t)
        .filter((p, i, arr) => i === 0 || p.t > arr[i - 1]!.t),
    [d.navHistory],
  );
  return (
    <View style={{ gap: space[5] }}>
      <View style={{ paddingHorizontal: GUTTER, gap: space[3] }}>
        <View style={{ flexDirection: "row", gap: space[2], alignItems: "center" }}>
          <Tag tone={fundTone(f.status)} label={t(`mobileSocial.fund.status.${f.status}`)} icon={f.status === "frozen" ? <Snowflake size={12} color={colors.gold} /> : undefined} />
        </View>
        <Display size="xl" accessibilityRole="header">
          {f.name}
        </Display>
        <PressableScale
          testID="fund-master"
          onPress={() => router.push(`/social/masters/${f.masterId}`)}
          scaleTo={0.985}
          accessibilityRole="link"
          style={{ flexDirection: "row", alignItems: "center", gap: space[3], minHeight: 48 }}
        >
          <Avatar name={f.master.nickname} size={36} />
          <View style={{ flex: 1 }}>
            <Text variant="callout" weight="700">
              {f.master.nickname}
            </Text>
            <Text variant="caption" tone="tertiary">
              {t("mobileSocial.fund.masterProfile")}
            </Text>
          </View>
          <ForwardIcon />
        </PressableScale>
        {f.status !== "active" ? (
          <Banner tone="warn" icon={<Snowflake size={18} color={colors.gold} />} title={f.status === "closed" ? t("mobileSocial.fund.closedText") : t("mobileSocial.fund.frozenText")} />
        ) : null}
      </View>
      <View style={{ paddingHorizontal: GUTTER, gap: space[4] }}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space[4] }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="label" tone="tertiary">
              {t("mobileSocial.navPerUnit")}
            </Text>
            <Mono size={44} weight="bold" style={{ letterSpacing: -1 }}>
              {nav4(f.nav)}
            </Mono>
          </View>
          <View style={{ alignItems: "flex-end", gap: 2 }}>
            <Mono size={16} weight="bold" tone={shownTone(f.return1m)}>{`${pct(f.return1m)} · ${t("mobileSocial.fund.return1m")}`}</Mono>
            <Mono size={13} tone={shownTone(f.returnAll, 2, "tertiary")}>{`${pct(f.returnAll)} · ${t("mobileSocial.fund.returnAll")}`}</Mono>
          </View>
        </View>
        <StatGrid
          columns={3}
          items={[
            { label: t("mobileSocial.aum"), value: compactUsd(f.aum) },
            { label: t("mobileSocial.investors"), value: fmt.number(f.investors, 0) },
            { label: t("mobileSocial.fund.drawdown"), value: ddText(f.drawdownPct), tone: f.drawdownPct > 0 ? "down" : undefined },
          ]}
        />
      </View>
      {mine ? (
        <View style={{ gap: space[3] }}>
          <Display size="sm" style={{ paddingHorizontal: GUTTER }}>
            {t("mobileSocial.fund.yours")}
          </Display>
          <HoldingCard inv={mine} onAdd={onAdd} onRedeem={onRedeem} onStopLoss={onStopLoss} onCancel={onCancel} />
        </View>
      ) : null}
      <View style={{ paddingHorizontal: GUTTER }}>
        <GrowthCard
          testID="fund-nav"
          title={t("mobileSocial.fund.navHistory")}
          hint={t("mobileSocial.pamm.explain.navS")}
          points={points}
          format={nav4}
          emptyTitle={t("mobileSocial.fund.navHistory")}
          emptyText={t("mobileSocial.fund.navEmpty")}
        />
      </View>
      <View style={{ paddingHorizontal: GUTTER }}>
        <Card>
          <SectionTitle title={t("mobileSocial.fund.terms")} />
          <KeyValues
            rows={[
              [t("mobileSocial.fund.rollover"), t("mobileSocial.fund.rolloverNext", { period: periodLabel(f.period, t), next: f.nextRolloverAt ? fmt.dateTime(f.nextRolloverAt) : "—" })],
              [t("mobileSocial.fund.lastRollover"), f.lastRolloverAt ? fmt.dateTime(f.lastRolloverAt) : "—"],
              [t("mobileSocial.fund.performanceFee"), t("mobileSocial.fund.feeAboveHwm", { fee: f.perfFeePct })],
              [t("mobileSocial.fund.lockIn"), f.lockInDays ? t("mobileSocial.fund.lockDays", { count: f.lockInDays }) : t("common.none")],
              [t("mobileSocial.fund.minInvestment"), usd(f.minInvestment, 0)],
              [t("mobileSocial.fund.freeze"), t("mobileSocial.fund.freezeValue", { dd: f.maxDdPct, peak: nav4(f.navPeak) })],
              [t("mobileSocial.fund.masterShare"), t("mobileSocial.fund.masterShareValue", { pct: f.masterSharePct.toFixed(1), min: f.minOwnPct })],
              [t("mobileSocial.fund.created"), fmt.date(f.createdAt)],
            ]}
          />
          <Text variant="caption" tone="tertiary" style={{ marginTop: space[3] }}>
            {t("mobileSocial.serverTime")}
          </Text>
        </Card>
      </View>
    </View>
  );
}

const RollRow = React.memo(function RollRow({ r }: { r: Rollover }) {
  const t = useT();
  const fmt = useFormat();
  return (
    <View style={{ height: ROW, marginHorizontal: GUTTER, flexDirection: "row", alignItems: "center", gap: space[3], borderBottomWidth: 1, borderBottomColor: colors.line }}>
      <View style={{ flex: 1, gap: 3 }}>
        <Text variant="callout" weight="700">
          {fmt.dateTime(r.at)}
        </Text>
        <Mono size={11.5} tone="tertiary" numberOfLines={1}>
          {`${t("mobileSocial.fund.in")} ${usd(r.invested, 0)} · ${t("mobileSocial.fund.out")} ${usd(r.redeemed, 0)} · ${t("mobileSocial.fees")} ${usd(r.fees)}`}
        </Mono>
      </View>
      <Mono size={15} weight="bold">
        {nav4(r.nav)}
      </Mono>
    </View>
  );
});

const LedgerRow = React.memo(function LedgerRow({ l }: { l: Ledger }) {
  const t = useT();
  const fmt = useFormat();
  return (
    <View style={{ height: ROW, marginHorizontal: GUTTER, flexDirection: "row", alignItems: "center", gap: space[3], borderBottomWidth: 1, borderBottomColor: colors.line }}>
      <View style={{ flex: 1, gap: 3 }}>
        <Text variant="callout" weight="700">
          {t.dyn(`mobileSocial.inv.kind.${l.kind}`, l.kind)}
        </Text>
        <Text variant="caption" tone="tertiary">
          {`${fmt.dateTime(l.at)} · ${t("mobileSocial.nav")} ${nav4(l.nav)}`}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 2 }}>
        <Mono size={14} weight="bold" color={l.units > 0 ? colors.text : colors.text2}>
          {`${l.units > 0 ? "+" : ""}${units4(l.units)}`}
        </Mono>
        <Mono size={12} tone="tertiary">
          {usd(l.amount)}
        </Mono>
      </View>
    </View>
  );
});
