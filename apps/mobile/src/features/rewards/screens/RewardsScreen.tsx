// /rewards: the rewards hub. Loyalty points as the hero (tier, value, progress to the next tier), then cashback,
// promotions and the share card as big tiles, and the trading contests: the featured one (running first) with its
// prize pool and time left, the others live, upcoming and past, and the reader's record. Opens on the last answers
// kept on the phone; pull to refresh. Same data and rules as the Client Area's /rewards pages.
import * as React from "react";
import { ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useT } from "@/i18n";
import { useReadOnly } from "@/features/partner/api";
import { Banner, Button, ColorBlock, Display, EmptyState, PressableScale, Text, useBottomInset } from "@/ui";
import { colors, GUTTER, space } from "@/theme/tokens";
import { Bar, Page, PageTitle, SectionTitle, StackBar, useRefresh, useScrollY } from "../../partner/components/Chrome";
import { BlockSkeleton, RowsSkeleton, ScreenState, TilesSkeleton } from "../../partner/components/States";
import { TileGrid, type TileSpec } from "../../partner/components/Tiles";
import { prefetchRewards, refreshRewards, useCashback, useContests, usePromotions, useRewards } from "../api";
import { ContestBlock, ContestRow, CONTEST_ROW_HEIGHT } from "../components/Contest";
import { isPast, isRunning, isUpcoming, pts, usd, usdShort } from "../format";
import type { ContestCard, Rewards } from "../types";
import { tint } from "../../partner/tint";
import { viewerGated } from "../components/ViewerGate";
import { RewardsBanners } from "../components/Banners";

/** Same rule as the Client Area: a running contest the reader entered, else the biggest pool; else the next to start. */
function pickFeatured(items: ContestCard[]): ContestCard | undefined {
  const running = items.filter(isRunning).sort((a, b) => Number(!!b.myEntry) - Number(!!a.myEntry) || b.prizePool - a.prizePool);
  return running[0] ?? items.filter(isUpcoming).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))[0];
}

const PointsHero = React.memo(function PointsHero({ r, onOpen }: { r: Rewards; onOpen: () => void }) {
  const t = useT();
  const next = r.nextTier;
  const pct = next ? Math.min(100, ((next.minPoints - next.pointsToGo) / Math.max(1, next.minPoints)) * 100) : 100;
  return (
    <ColorBlock color="gold" padded={false}>
      <PressableScale onPress={onOpen} onPressIn={prefetchRewards.loyalty} accessibilityLabel={`${t("mobileRewards.points.title")}: ${pts(r.points.balance)}, ${r.tier.name}`} testID="points-hero" style={{ padding: space[6], gap: space[4] }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[2] }}>
          <Text variant="label" color={colors.ink2}>
            {t("mobileRewards.points.title")}
          </Text>
          <View style={{ height: 24, paddingHorizontal: 10, borderRadius: 12, backgroundColor: colors.ink, justifyContent: "center" }}>
            <Text variant="label" color={colors.gold} style={{ fontSize: 10.5 }}>
              {t("mobileRewards.points.tier", { name: r.tier.name })}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: space[2] }}>
          <Display size="hero" color={colors.ink} numberOfLines={1} adjustsFontSizeToFit style={{ flexShrink: 1 }}>
            {pts(r.points.balance)}
          </Display>
          <Display size="sm" color={colors.ink2}>
            {t("mobileRewards.points.unit")}
          </Display>
        </View>
        <Text variant="caption" color={colors.ink2}>
          {t("mobileRewards.points.worth", { amount: usd(r.points.balance * r.pointValue) })} · {t("mobileRewards.points.multiplier", { x: r.tier.multiplier })}
        </Text>
        <View style={{ gap: space[2] }}>
          <Bar pct={pct} color={colors.ink} track={tint.inkTrack} height={8} />
          <Text variant="caption" color={colors.ink2}>
            {next ? t("mobileRewards.points.toNext", { points: pts(next.pointsToGo), name: next.name }) : t("mobileRewards.points.topTier")}
          </Text>
        </View>
      </PressableScale>
    </ColorBlock>
  );
});

function RewardsHub() {
  const t = useT();
  const router = useRouter();
  const readOnly = useReadOnly();
  const rewards = useRewards();
  const contests = useContests();
  const cashback = useCashback();
  const promos = usePromotions();
  const { scrollY, onScroll } = useScrollY();
  const bottom = useBottomInset(false);
  const refreshControl = useRefresh(async () => {
    refreshRewards();
    await Promise.all([rewards.refresh(), contests.refresh(), cashback.refresh(), promos.refresh()]);
  });
  const [showPast, setShowPast] = React.useState(false);

  const go = React.useCallback((path: string) => router.push(path as never), [router]);
  const openContest = React.useCallback((id: number) => router.push(`/rewards/contests/${id}`), [router]);
  const warmContest = React.useCallback((id: number) => prefetchRewards.contest(id), []);

  const items = contests.data?.items;
  const featured = React.useMemo(() => (items ? pickFeatured(items) : undefined), [items]);
  const current = React.useMemo(() => (items ?? []).filter((c) => (isRunning(c) || isUpcoming(c)) && c.id !== featured?.id).sort((a, b) => Number(isUpcoming(a)) - Number(isUpcoming(b)) || Date.parse(a.startsAt) - Date.parse(b.startsAt)), [items, featured]);
  const past = React.useMemo(() => (items ?? []).filter(isPast).sort((a, b) => Date.parse(b.endsAt) - Date.parse(a.endsAt)), [items]);
  const stats = contests.data?.stats;

  const tiles = React.useMemo<TileSpec[]>(() => {
    const cb = cashback.data;
    const pr = promos.data;
    const offers = pr ? pr.campaigns.filter((c) => c.eligible && !c.claimed).length : null;
    const activeGrants = pr ? pr.grants.filter((g) => g.status === "active" || g.status === "pending" || g.status === "awaiting_deposit").length : null;
    return [
      { key: "cashback", color: "mint", label: t("mobileRewards.tile.cashback"), value: cb ? usd(cb.totals.accrued) : "—", money: true, sub: cb ? t("mobileRewards.tile.cashbackSub", { amount: usd(cb.totals.month) }) : " ", onPress: () => go("/rewards/cashback"), onPressIn: prefetchRewards.cashback, testID: "tile-cashback" },
      { key: "promotions", color: "periwinkle", label: t("mobileRewards.tile.promotions"), value: offers === null ? "—" : String(offers), sub: activeGrants ? t("mobileRewards.tile.activeBonuses", { count: activeGrants }) : t("mobileRewards.tile.enterCode"), onPress: () => go("/rewards/promotions"), onPressIn: prefetchRewards.promotions, testID: "tile-promotions" },
      { key: "share", color: "cream", label: t("mobileRewards.tile.share"), value: t("mobileRewards.tile.shareValue"), sub: t("mobileRewards.tile.shareSub"), onPress: () => go("/rewards/share"), onPressIn: prefetchRewards.shares, testID: "tile-share" },
      { key: "record", color: "ember", label: t("mobileRewards.tile.record"), value: stats ? String(stats.entered) : "—", sub: stats ? (stats.prizesWon > 0 ? t("mobileRewards.tile.won", { amount: usdShort(stats.prizesWon) }) : stats.bestRank ? t("mobileRewards.tile.best", { rank: stats.bestRank }) : t("mobileRewards.tile.noPrizes")) : " " },
    ];
  }, [cashback.data, promos.data, stats, t, go]);

  const nothing = !rewards.data && !contests.data;
  const firstError = rewards.error ?? contests.error;

  return (
    <Page bar={<StackBar title={t("mobileRewards.title")} scrollY={scrollY} />}>
      <ScrollView onScroll={onScroll} scrollEventThrottle={16} refreshControl={refreshControl} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottom + space[6] }}>
        <PageTitle eyebrow={t("mobileRewards.eyebrow")} title={t("mobileRewards.title")} />
        {readOnly ? <Banner tone="info" title={t("mobile.viewOnly")} body={t("mobileRewards.viewOnlyBody")} style={{ marginHorizontal: GUTTER, marginBottom: space[4] }} /> : null}
        <RewardsBanners style={{ marginHorizontal: GUTTER, marginBottom: space[4] }} />

        {nothing && firstError ? (
          <ScreenState ns="mobileRewards" error={firstError} onRetry={() => void Promise.all([rewards.refresh(), contests.refresh()])} />
        ) : (
          <>
            <View style={{ paddingHorizontal: GUTTER }}>{rewards.data ? <PointsHero r={rewards.data} onOpen={() => go("/rewards/loyalty")} /> : <BlockSkeleton height={250} style={{ marginHorizontal: 0 }} />}</View>
            {cashback.data || promos.data || contests.data ? <TileGrid tiles={tiles} style={{ paddingHorizontal: GUTTER, marginTop: space[3] }} /> : <View style={{ marginTop: space[3] }}><TilesSkeleton /></View>}

            <View style={{ paddingHorizontal: GUTTER, marginTop: space[8], gap: space[3] }}>
              <SectionTitle title={t("mobileRewards.section.contests")} subtitle={stats ? t("mobileRewards.contests.stats", { entered: stats.entered, finishes: stats.prizeFinishes }) : undefined} style={{ marginBottom: 0 }} />
              {!contests.data ? (
                contests.error ? (
                  <ScreenState ns="mobileRewards" error={contests.error} onRetry={() => void contests.refresh()} />
                ) : (
                  <>
                    <BlockSkeleton height={280} style={{ marginHorizontal: 0 }} />
                    <RowsSkeleton rows={2} height={CONTEST_ROW_HEIGHT} inset={false} />
                  </>
                )
              ) : !featured && past.length === 0 ? (
                <EmptyState illustration="rewards" size={180} title={t("mobileRewards.contests.emptyTitle")} body={t("mobileRewards.contests.emptyBody")} style={{ paddingHorizontal: 0, paddingVertical: space[4] }} />
              ) : (
                <>
                  {featured ? <ContestBlock c={featured} onOpen={openContest} onWarm={warmContest} /> : null}
                  {current.map((c) => (
                    <ContestRow key={c.id} c={c} onOpen={openContest} onWarm={warmContest} />
                  ))}
                  {past.length ? (
                    <>
                      <Text variant="label" tone="tertiary" style={{ marginTop: space[3] }}>
                        {t("mobileRewards.contests.past")}
                      </Text>
                      {(showPast ? past : past.slice(0, 3)).map((c) => (
                        <ContestRow key={c.id} c={c} onOpen={openContest} onWarm={warmContest} />
                      ))}
                      {past.length > 3 ? <Button label={showPast ? t("common.showLess") : t("mobileRewards.contests.showPast", { count: past.length })} variant="ghost" size="sm" onPress={() => setShowPast((v) => !v)} /> : null}
                    </>
                  ) : null}
                </>
              )}
            </View>

            {rewards.data?.points.expiringSoon ? (
              <View style={{ paddingHorizontal: GUTTER, marginTop: space[6] }}>
                <Banner tone="warn" title={t("mobileRewards.points.expiring", { points: pts(rewards.data.points.expiringSoon.points) })} body={t("mobileRewards.points.expiringBody", { months: rewards.data.pointsExpiryMonths })} />
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </Page>
  );
}

/** A view-only login gets the "not shared" state (rewards are never part of its access). */
export const RewardsScreen = viewerGated(RewardsHub, "mobileRewards.title");
