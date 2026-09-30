// /algo/marketplace/[id] — one marketplace strategy: the verified track record (closed deals of the author's own
// deployment on Kalks, with the day-by-day curve), the house disclosure and the house backtest (labelled as a
// simulation, never mixed into the track record), description, risk settings, the rules when the author allows
// cloning, reviews. The sticky bar subscribes (free or paid, per the listing), shows an active subscription with its
// deployment / cloned strategy, or cancels it (a paid one runs to the end of its period).
import * as React from "react";
import { useWindowDimensions, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { BadgeCheck } from "lucide-react-native";
import { useFormat, useT } from "@/i18n";
import { useQuery } from "@/lib/query";
import { Button, Card, Display, Screen, Text, toast, type SheetRef } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { algoPost, fetchers, keys, prefetchDeployment, prefetchStrategy, refreshAlgo, validId, type HouseBacktest, type ListingDetail } from "../api";
import { HouseBadge, HouseDisclosure, Note, SectionTitle, StatGrid, Stars, Tag, tint } from "../components/bits";
import { ActionBar, TopBar, Title } from "../components/chrome";
import { Curve } from "../components/chart/Curve";
import { curveHeight, isoDay, LINE_LAYOUT, type CurveData } from "../components/chart/types";
import { RiskRows, RulesBody } from "../components/Rules";
import { BlockSkeleton, ChartSkeleton, LoadError } from "../components/states";
import { day, kindLabel, moneyTone, pct, range, usd, verifiedLine } from "../format";
import { useBack, usePoll, useReadOnly } from "../hooks";
import { ConfirmSheet, type ConfirmSpec } from "../sheets/ConfirmSheet";
import { ReviewSheet, type ReviewSheetRef } from "../sheets/ReviewSheet";
import { openClientArea } from "../web";

export function ListingScreen() {
  const t = useT();
  const f = useFormat();
  const router = useRouter();
  const back = useBack("/algo/marketplace");
  const readOnly = useReadOnly();
  const { id: raw } = useLocalSearchParams<{ id: string }>();
  const id = validId(raw) ? raw : null;
  const q = useQuery(id ? keys.listing(id) : null, fetchers.listing(id ?? "0"), { persist: true, staleMs: 10_000, intervalMs: usePoll(60_000) });
  const reviewRef = React.useRef<ReviewSheetRef>(null);
  const confirmRef = React.useRef<SheetRef>(null);
  const [confirm, setConfirm] = React.useState<ConfirmSpec | null>(null);
  const l = q.data;

  if (!id || (!l && q.error)) {
    return (
      <Screen scroll={false} tabBar={false}>
        <TopBar onBack={back} />
        <LoadError error={q.error ?? { code: "not_found", message: "", status: 404 }} onRetry={() => void q.refresh()} onBack={back} style={{ flex: 1, justifyContent: "center" }} />
      </Screen>
    );
  }

  const sub = l?.subscription ?? null;
  const active = sub?.status === "active";
  const mineReview = l?.reviews.find((r) => r.mine);

  const askCancel = () => {
    if (!l || !sub) return;
    const paid = l.priceMonthly > 0;
    setConfirm({
      title: t("mobileAlgo.listing.cancelTitle"),
      body: paid ? t("mobileAlgo.listing.cancelPaid", { date: sub.periodEnd ? f.date(sub.periodEnd) : "—" }) : sub.mode === "copy" ? t("mobileAlgo.listing.cancelCopy") : t("mobileAlgo.listing.cancelClone"),
      confirm: t("mobileAlgo.listing.cancelConfirm"),
      dismiss: t("mobileAlgo.listing.keep"),
      danger: true,
      testID: "cancel-sub",
      run: () => algoPost(`market/subscriptions/${sub.id}/cancel`, {}),
      onDone: () => {
        refreshAlgo();
        toast.show({ title: paid ? t("mobileAlgo.listing.cancelledPaid") : t("mobileAlgo.listing.cancelled"), tone: "success" });
      },
    });
    requestAnimationFrame(() => confirmRef.current?.present());
  };

  const bar = !l || readOnly ? null : l.isAuthor ? (
    <ActionBar>
      <View style={{ flex: 1, justifyContent: "center", gap: 2 }}>
        <Text variant="callout" weight="700">
          {t("mobileAlgo.listing.yours")}
        </Text>
        <Text variant="caption" tone="tertiary">
          {t.dyn(`mobileAlgo.listing.${l.status}`, l.status)}
        </Text>
      </View>
      <Button label={t("mobileAlgo.listing.manageWeb")} variant="secondary" size="md" full={false} onPress={() => openClientArea("/developer/marketplace")} />
    </ActionBar>
  ) : active && sub ? (
    <ActionBar style={{ flexDirection: "column" }}>
      <Text variant="callout" weight="700" testID="listing-subscribed">
        {sub.mode === "copy" ? t("mobileAlgo.listing.copying", { login: sub.login ?? "—" }) : t("mobileAlgo.listing.clonedTo")}
        {sub.periodEnd ? ` · ${sub.autoRenew ? t("mobileAlgo.sub.renews", { date: f.date(sub.periodEnd) }) : t("mobileAlgo.sub.ends", { date: f.date(sub.periodEnd) })}` : ""}
      </Text>
      <View style={{ flexDirection: "row", gap: space[3] }}>
        {sub.deploymentId ? (
          <Button testID="listing-open-dep" label={t("mobileAlgo.listing.openDeployment")} size="md" full={false} style={{ flex: 1.7 }} onPress={() => (prefetchDeployment(sub.deploymentId!), router.push(`/algo/deployments/${sub.deploymentId}`))} />
        ) : sub.clonedStrategyId ? (
          <Button testID="listing-open-strategy" label={t("mobileAlgo.listing.openStrategy")} size="md" full={false} style={{ flex: 1.7 }} onPress={() => (prefetchStrategy(sub.clonedStrategyId!), router.push(`/algo/strategies/${sub.clonedStrategyId}`))} />
        ) : null}
        {sub.autoRenew ? <Button testID="listing-cancel" label={t("mobileAlgo.listing.cancel")} variant="danger" size="md" full={false} style={{ flex: 1 }} onPress={askCancel} /> : null}
      </View>
    </ActionBar>
  ) : l.status === "approved" ? (
    <ActionBar>
      <Button
        testID="listing-subscribe"
        label={l.priceMonthly > 0 ? t("mobileAlgo.listing.subscribePaid", { price: l.priceMonthly }) : t("mobileAlgo.listing.subscribeFree")}
        style={{ flex: 1 }}
        onPress={() => router.push(`/algo/marketplace/${l.id}/subscribe`)}
      />
    </ActionBar>
  ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen tabBar={false} onRefresh={q.refresh} header={<TopBar onBack={back} />}>
        {!l ? (
          <View style={{ gap: space[5] }}>
            <View style={{ height: 120 }} />
            <BlockSkeleton height={260} />
          </View>
        ) : (
          <View style={{ gap: space[8], paddingBottom: space[6] }} testID="listing-screen">
            <Title eyebrow={t("mobileAlgo.listing.eyebrow", { symbol: l.symbol, tf: l.timeframe })} title={l.title}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: space[3], rowGap: space[1], marginTop: space[2] }}>
                <Text variant="callout" tone="secondary" numberOfLines={1} style={{ flexShrink: 1 }}>
                  {t("mobileAlgo.market.by", { author: l.author })}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
                  <Stars value={l.rating} />
                  <Text variant="caption" tone="tertiary" numberOfLines={1}>
                    {`${t("mobileAlgo.market.ratings", { count: l.ratings })} · ${t("mobileAlgo.market.subscribers", { count: l.subscribers })}`}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2], marginTop: space[3] }}>
                {l.house ? <HouseBadge /> : null}
                <Tag icon={<BadgeCheck size={13} color={colors.text2} />} label={t("mobileAlgo.listing.verified", { type: kindLabel(t, l.track.accountType).toLowerCase() })} />
                <Tag tone={l.priceMonthly > 0 ? "gold" : "cream"} label={l.priceMonthly > 0 ? t("mobileAlgo.market.perMonth", { price: l.priceMonthly }) : t("mobileAlgo.market.free")} />
                {l.status !== "approved" ? <Tag tone="warn" label={t.dyn(`mobileAlgo.listing.${l.status}`, l.status)} /> : null}
                {l.allowClone ? <Tag tone="sand" label={t("mobileAlgo.listing.cloneAllowed")} /> : null}
              </View>
            </Title>

            <View style={{ paddingHorizontal: GUTTER, gap: space[4] }}>
              {l.house ? <HouseDisclosure /> : null}
              <TrackCard l={l} />
              {l.house && l.backtest ? <HouseBacktestCard b={l.backtest} /> : null}
            </View>

            {l.description ? (
              <View style={{ gap: space[3] }}>
                <SectionTitle title={t("mobileAlgo.listing.about")} />
                <Text style={{ paddingHorizontal: GUTTER, lineHeight: 22 }} tone="secondary">
                  {l.description}
                </Text>
              </View>
            ) : null}

            {l.risk ? (
              <View style={{ gap: space[3] }}>
                <SectionTitle title={t("mobileAlgo.listing.risk")} />
                <Card style={{ marginHorizontal: GUTTER, paddingVertical: space[2] }}>
                  <RiskRows risk={l.risk} />
                </Card>
              </View>
            ) : null}

            <View style={{ gap: space[3] }}>
              <SectionTitle title={t("mobileAlgo.listing.rules")} />
              <Card style={{ marginHorizontal: GUTTER, gap: space[3] }}>
                {l.summary ? <RulesBody summary={l.summary} kind="code" /> : <Text tone="secondary">{t("mobileAlgo.listing.rulesPrivate")}</Text>}
              </Card>
            </View>

            <View style={{ gap: space[3] }}>
              <SectionTitle
                title={t("mobileAlgo.listing.reviews", { n: l.ratings })}
                action={sub && !l.isAuthor && !readOnly ? (mineReview ? t("mobileAlgo.review.edit") : t("mobileAlgo.review.rate")) : undefined}
                onAction={() => reviewRef.current?.open(l.id, l.title, mineReview?.rating, mineReview?.comment)}
                testID="listing-rate"
              />
              <View style={{ paddingHorizontal: GUTTER, gap: space[3] }}>
                {l.reviews.length ? (
                  l.reviews.map((r) => (
                    <View key={r.id} style={{ gap: space[1], paddingBottom: space[3], borderBottomWidth: 1, borderBottomColor: colors.line }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
                        <Stars value={r.rating} />
                        <Text variant="callout" weight="700" numberOfLines={1} style={{ flex: 1 }}>
                          {r.mine ? t("mobileAlgo.review.you") : r.user}
                        </Text>
                        <Text variant="caption" tone="tertiary">
                          {day(f, r.createdAt)}
                        </Text>
                      </View>
                      {r.comment ? <Text tone="secondary">{r.comment}</Text> : null}
                    </View>
                  ))
                ) : (
                  <Text tone="tertiary">{t("mobileAlgo.listing.noReviews")}</Text>
                )}
              </View>
            </View>

            <View style={{ paddingHorizontal: GUTTER, gap: space[2] }}>
              <Note>{t("mobileAlgo.market.disclaimer", { pct: l.platformCutPct })}</Note>
            </View>
          </View>
        )}
      </Screen>
      {bar}
      <ReviewSheet ref={reviewRef} />
      <ConfirmSheet ref={confirmRef} spec={confirm} />
    </View>
  );
}

/** The verified live (or demo) track record: return, the day-by-day curve, win rate, drawdown, trades, net. */
function TrackCard({ l }: { l: ListingDetail }) {
  const t = useT();
  const f = useFormat();
  const width = useWindowDimensions().width - GUTTER * 2 - space[5] * 2;
  const tr = l.track;
  const data = React.useMemo<CurveData | null>(() => {
    const curve = Array.isArray(tr.curve) ? (tr.curve as { day: string; equity: number }[]).filter((p) => p && typeof p === "object") : [];
    if (curve.length < 2) return null;
    const main = curve.map((p) => p.equity);
    const start = tr.startBalance ?? main[0]!;
    return {
      main,
      baseline: start,
      tipDate: curve.map((p) => p.day),
      tipMain: main.map((v) => usd(v)),
      hi: usd(Math.max(...main, start), false, 0),
      lo: usd(Math.min(...main, start), false, 0),
      color: colors.gold,
      a11y: t("mobileAlgo.listing.curveA11y", { days: curve.length, ret: pct(tr.returnPct, 2) }),
    };
  }, [tr, t]);
  return (
    <Card style={{ gap: space[4] }} testID="listing-track">
      <View style={{ gap: 2 }}>
        <Text variant="label" tone="tertiary">
          {t("mobileAlgo.listing.trackReturn")}
        </Text>
        <Display size="xl" color={tr.returnPct > 0 ? colors.up : tr.returnPct < 0 ? colors.down : colors.text} numberOfLines={1} adjustsFontSizeToFit>
          {pct(tr.returnPct, 2)}
        </Display>
        <Text variant="caption" tone="tertiary">
          {verifiedLine(t, tr.accountType, tr.days)}
        </Text>
      </View>
      {data ? (
        <View style={{ marginHorizontal: -4 }}>
          <Curve d={data} width={width + 8} layout={LINE_LAYOUT} fallback={<ChartSkeleton height={curveHeight(LINE_LAYOUT, false)} />} testID="listing-curve" />
        </View>
      ) : (
        <View style={{ padding: space[4], borderRadius: radius.md, backgroundColor: colors.bgRaised }}>
          <Text variant="caption" tone="tertiary">
            {t("mobileAlgo.listing.noCurve")}
          </Text>
        </View>
      )}
      <StatGrid
        columns={4}
        size={15}
        items={[
          { label: t("mobileAlgo.market.winRate"), value: pct(tr.winRate, 1, false) },
          { label: t("mobileAlgo.market.maxDd"), value: pct(tr.maxDrawdownPct, 1, false), tone: Math.round(tr.maxDrawdownPct * 10) !== 0 ? "down" : undefined },
          { label: t("mobileAlgo.market.trades"), value: String(tr.trades) },
          { label: t("mobileAlgo.listing.net"), value: usd(tr.netProfit ?? 0, true), tone: moneyTone(tr.netProfit) },
        ]}
      />
      <Note>{t("mobileAlgo.listing.trackNote", { since: tr.since ? f.date(tr.since) : "—" })}</Note>
    </Card>
  );
}

/** A house strategy's backtest: simulated on history, always labelled as such and kept apart from the track. */
function HouseBacktestCard({ b }: { b: HouseBacktest }) {
  const t = useT();
  const f = useFormat();
  const width = useWindowDimensions().width - GUTTER * 2 - space[5] * 2;
  const s = b.summary ?? {};
  const data = React.useMemo<CurveData | null>(() => {
    const pts = b.curve.filter((p) => Number.isFinite(p.t) && Number.isFinite(p.equity));
    if (pts.length < 2) return null;
    const main = pts.map((p) => p.equity);
    return {
      main,
      baseline: main[0],
      tipDate: pts.map((p) => isoDay(p.t * 1000)),
      tipMain: main.map((v) => usd(v)),
      hi: usd(Math.max(...main), false, 0),
      lo: usd(Math.min(...main), false, 0),
      color: colors.text2,
      a11y: t("mobileAlgo.listing.btA11y"),
    };
  }, [b.curve, t]);
  return (
    <View style={{ borderRadius: radius.card, backgroundColor: colors.warnSoft, borderWidth: 1, borderColor: tint(colors.warn, 0.3), padding: space[5], gap: space[4] }} testID="house-backtest">
      <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: space[2] }}>
        <Tag tone="warn" label={t("mobileAlgo.listing.btSimulated")} />
        {s.firstBar && s.lastBar ? (
          <Text variant="caption" tone="secondary">
            {range(f, s.firstBar, s.lastBar)}
          </Text>
        ) : null}
      </View>
      <Text variant="caption" tone="secondary" style={{ lineHeight: 18 }}>
        {t("mobileAlgo.listing.btNote")}
      </Text>
      <StatGrid
        columns={4}
        size={14}
        labelTone="secondary"
        items={[
          { label: t("mobileAlgo.market.return"), value: s.returnPct !== undefined ? pct(s.returnPct, 1) : "—" },
          { label: t("mobileAlgo.market.winRate"), value: s.winRate !== undefined ? pct(s.winRate, 1, false) : "—" },
          { label: t("mobileAlgo.market.maxDd"), value: s.maxDrawdownPct !== undefined ? pct(s.maxDrawdownPct, 1, false) : "—" },
          { label: t("mobileAlgo.market.trades"), value: s.trades !== undefined ? String(s.trades) : "—" },
        ]}
      />
      {data ? <Curve d={data} width={width} layout={LINE_LAYOUT} fallback={<View style={{ height: curveHeight(LINE_LAYOUT, false) }} />} testID="house-bt-curve" /> : null}
    </View>
  );
}

export default ListingScreen;
