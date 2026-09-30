// /rewards/contests/[id]: one trading contest — prize pool and time left, the reader's entry (rank, score, trades
// still needed to rank) or the way in, the prize bands, the rules and anti-cheat terms, and the live leaderboard
// (top 100, refreshed every 15 s while the contest runs). Opens on the contest from the list at once.
import * as React from "react";
import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { FlashList, type ListRenderItem } from "@shopify/flash-list";
import { useT } from "@/i18n";
import { useReadOnly } from "@/features/partner/api";
import { getQueryData } from "@/lib/query";
import { Button, Card, ColorBlock, EmptyState, Mono, Text, useBottomInset, type SheetRef } from "@/ui";
import { colors, GUTTER, space } from "@/theme/tokens";
import { Label, Page, SectionTitle, StackBar, Tag, useRefresh, useScrollY } from "../../partner/components/Chrome";
import { BlockSkeleton, RowsSkeleton, ScreenState } from "../../partner/components/States";
import { REWARDS_KEYS, useContest, useContestsFor } from "../api";
import { KindTag, RankBadge, STANDING_ROW_HEIGHT, StandingRow } from "../components/Contest";
import { Countdown } from "../components/Countdown";
import { JoinSheet } from "../components/JoinSheet";
import { bandLabel, canJoin, date, isFull, isPast, isRunning, isUpcoming, projectedPrize, scoreText, scoreTone, scoringLabel, statusLabel, tradesHint, usdShort } from "../format";
import type { Contest, ContestsResp, ContestDetail, Standing } from "../types";
import { viewerGated } from "../components/ViewerGate";

const EMPTY: Standing[] = [];
const keyOf = (s: Standing) => String(s.entryId);

function Separator() {
  return <View style={{ height: 1, backgroundColor: colors.line, marginStart: space[5] + 34 + space[3] }} />;
}

function MyEntry({ c, me }: { c: Contest; me: Standing }) {
  const t = useT();
  const dq = me.status === "disqualified";
  const tone = scoreTone(c, me);
  const hint = dq ? t("mobileRewards.contest.dqBody") : tradesHint(t, c, me);
  const prize = projectedPrize(c, me);
  return (
    <Card style={{ gap: space[4] }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[4] }}>
        <RankBadge rank={dq ? null : me.rank} size={56} />
        <View style={{ flex: 1, gap: 2 }}>
          <Label>{t("mobileRewards.contest.yourEntry")}</Label>
          <Mono size={24} weight="bold" color={dq ? colors.text3 : tone === "up" ? colors.up : tone === "down" ? colors.down : colors.text}>
            {scoreText(t, c, me)}
          </Mono>
          <Text variant="caption" tone="tertiary">
            {[t("mobileRewards.contest.trades", { count: me.trades }), me.login ? `#${me.login}` : null].filter(Boolean).join(" · ")}
          </Text>
        </View>
        {prize && !dq ? (
          <View style={{ alignItems: "flex-end", gap: 2 }}>
            <Label>{isPast(c) ? t("mobileRewards.contest.yourPrize") : t("mobileRewards.contest.onTrack")}</Label>
            <Mono size={18} weight="bold" color={colors.up}>
              {usdShort(prize)}
            </Mono>
          </View>
        ) : null}
      </View>
      {hint ? (
        <Text variant="caption" tone={dq ? "tertiary" : "gold"}>
          {hint}
        </Text>
      ) : null}
    </Card>
  );
}

function ContestDetailScreen() {
  const t = useT();
  const readOnly = useReadOnly();
  const { id: raw } = useLocalSearchParams<{ id: string }>();
  const param = /^[A-Za-z0-9_-]{1,64}$/.test(raw ?? "") ? raw! : null;
  // the service reads contests by id; a link by slug (a banner, a pasted Client Area URL) finds its id in the list
  const bySlug = param !== null && !/^\d{1,18}$/.test(param);
  const list = useContestsFor(bySlug);
  const listed = list.data?.items.find((c) => String(c.id) === param || c.slug === param);
  const id = bySlug ? (listed ? String(listed.id) : null) : param;
  // the list's card shows at once while the detail loads
  const fromList = React.useMemo(() => listed ?? getQueryData<ContestsResp>(REWARDS_KEYS.contests)?.items.find((c) => String(c.id) === param || c.slug === param), [listed, param]);
  const [live, setLive] = React.useState(fromList ? isRunning(fromList) : true);
  const q = useContest(id, live);
  const d: ContestDetail | undefined = q.data;
  const c: Contest | undefined = d?.contest ?? fromList;
  const me = d ? d.myEntry : (fromList?.myEntry ?? null);
  React.useEffect(() => {
    if (d) setLive(isRunning(d.contest));
  }, [d]);
  const { scrollY, onScroll } = useScrollY();
  const bottom = useBottomInset(false);
  const refreshControl = useRefresh(() => q.refresh());
  const joinRef = React.useRef<SheetRef>(null);

  const renderItem = React.useCallback<ListRenderItem<Standing>>(({ item }) => (c ? <StandingRow c={c} s={item} /> : null), [c]);

  // no such contest: a bad link, a slug the list doesn't have
  const missing = param === null || (bySlug && !!list.data && !listed);
  const error = bySlug && !list.data ? list.error : q.error;
  if (!c) {
    return (
      <Page bar={<StackBar title={t("mobileRewards.title.contest")} scrollY={scrollY} />}>
        {missing ? (
          <EmptyState illustration="rewards" title={t("mobileRewards.contest.notFoundTitle")} body={t("mobileRewards.contest.notFoundBody")} />
        ) : error ? (
          error.status === 404 || error.status === 400 ? (
            <EmptyState illustration="rewards" title={t("mobileRewards.contest.notFoundTitle")} body={t("mobileRewards.contest.notFoundBody")} />
          ) : (
            <ScreenState ns="mobileRewards" error={error} onRetry={() => void (bySlug && !list.data ? list.refresh() : q.refresh())} />
          )
        ) : (
          <View style={{ gap: space[3], paddingTop: space[4] }}>
            <BlockSkeleton height={300} />
            <RowsSkeleton rows={5} height={STANDING_ROW_HEIGHT} />
          </View>
        )}
      </Page>
    );
  }

  const running = isRunning(c);
  const joinable = canJoin(c) && !me && !readOnly;
  const rules = [
    ...c.rules
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean),
    c.antiCheat.disqualifyOnBalanceChange ? t("mobileRewards.rules.balanceDq") : t("mobileRewards.rules.balanceReview"),
    c.antiCheat.minHoldSeconds > 0 ? t("mobileRewards.rules.hold", { seconds: c.antiCheat.minHoldSeconds }) : null,
    c.antiCheat.maxSingleTradePct > 0 ? t("mobileRewards.rules.maxTrade", { pct: c.antiCheat.maxSingleTradePct }) : null,
  ].filter((x): x is string => !!x);

  const header = (
    <View>
      <View style={{ paddingHorizontal: GUTTER, paddingTop: space[1], paddingBottom: space[5], gap: space[2] }}>
        <View style={{ flexDirection: "row", gap: space[2] }}>
          <KindTag kind={c.kind} />
          {running ? null : <Tag label={statusLabel(t, c.status)} tone={isUpcoming(c) ? "outline" : "muted"} />}
        </View>
        <Text variant="title" accessibilityRole="header" style={{ fontSize: 26, lineHeight: 31 }}>
          {c.name}
        </Text>
        {c.description ? <Text tone="secondary">{c.description}</Text> : null}
      </View>

      <View style={{ paddingHorizontal: GUTTER, gap: space[3] }}>
        <ColorBlock color={c.kind === "live" ? "ember" : "periwinkle"} style={{ gap: space[4] }}>
          <View style={{ gap: 2 }}>
            <Text variant="label" color={colors.ink2}>
              {t("mobileRewards.contest.prizePool")}
            </Text>
            <Mono size={44} weight="bold" color={colors.ink} numberOfLines={1} adjustsFontSizeToFit>
              {usdShort(c.prizePool)}
            </Mono>
          </View>
          <View style={{ flexDirection: "row", gap: space[4] }}>
            <View style={{ flex: 1.3, gap: 2 }}>
              <Text variant="label" color={colors.ink2} style={{ fontSize: 10.5 }}>
                {running ? t("mobileRewards.contest.endsIn") : isUpcoming(c) ? t("mobileRewards.contest.startsIn") : t("mobileRewards.contest.ended")}
              </Text>
              {running || isUpcoming(c) ? (
                <Countdown to={running ? c.endsAt : c.startsAt} size={17} color={colors.ink} onEnd={() => void q.refresh()} />
              ) : (
                <Text variant="callout" weight="700" color={colors.ink}>
                  {date(c.endsAt)}
                </Text>
              )}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="label" color={colors.ink2} style={{ fontSize: 10.5 }}>
                {t("mobileRewards.contest.entrants")}
              </Text>
              <Text variant="callout" weight="700" color={colors.ink}>
                {c.maxEntrants ? `${d?.entrants ?? c.entrants} / ${c.maxEntrants}` : String(d?.entrants ?? c.entrants)}
              </Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="label" color={colors.ink2} style={{ fontSize: 10.5 }}>
                {t("mobileRewards.contest.rankedBy")}
              </Text>
              <Text variant="callout" weight="700" color={colors.ink} numberOfLines={1}>
                {scoringLabel(t, c.scoring)}
              </Text>
            </View>
          </View>
          <Text variant="caption" color={colors.ink2}>
            {date(c.startsAt, false)} – {date(c.endsAt)}
          </Text>
        </ColorBlock>

        {me ? (
          <MyEntry c={c} me={me} />
        ) : joinable ? (
          <Button label={isUpcoming(c) ? t("mobileRewards.join.register") : t("mobileRewards.join.join")} onPress={() => joinRef.current?.present()} testID="contest-join" />
        ) : !isPast(c) && isFull(c) ? (
          <Text variant="caption" tone="tertiary" align="center">
            {t("mobileRewards.contest.full")}
          </Text>
        ) : null}
      </View>

      {c.prizes.length ? (
        <View style={{ paddingHorizontal: GUTTER, marginTop: space[8] }}>
          <SectionTitle title={t("mobileRewards.contest.prizes")} />
          <Card padded={false}>
            {c.prizes.map((p, i) => (
              <View key={`${p.rankFrom}-${p.rankTo}`} style={{ minHeight: 56, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[5], borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
                <RankBadge rank={p.rankFrom} size={30} />
                <Text variant="callout" weight="700" style={{ flex: 1 }}>
                  {bandLabel(p)}
                </Text>
                <Text variant="caption" tone="tertiary">
                  {p.payout === "credit" ? t("mobileRewards.contest.asCredit") : t("mobileRewards.contest.toWallet")}
                </Text>
                <Mono size={16} weight="bold">
                  {usdShort(p.amount)}
                </Mono>
              </View>
            ))}
          </Card>
        </View>
      ) : null}

      <View style={{ paddingHorizontal: GUTTER, marginTop: space[8] }}>
        <SectionTitle title={t("mobileRewards.contest.rules")} />
        <Card style={{ gap: space[3] }}>
          {rules.map((r, i) => (
            <View key={i} style={{ flexDirection: "row", gap: space[3] }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.gold, marginTop: 8 }} />
              <Text variant="callout" tone="secondary" style={{ flex: 1 }}>
                {r}
              </Text>
            </View>
          ))}
          {c.kycRequired ? (
            <Text variant="caption" tone="tertiary">
              {t("mobileRewards.join.kycOnly")}
            </Text>
          ) : null}
        </Card>
      </View>

      <SectionTitle title={t("mobileRewards.contest.leaderboard")} subtitle={running ? t("mobileRewards.contest.liveBoard") : isUpcoming(c) ? t("mobileRewards.contest.boardSoon") : undefined} style={{ paddingHorizontal: GUTTER, marginTop: space[8], marginBottom: space[2] }} />
    </View>
  );

  const empty = !d ? (
    q.error ? (
      <ScreenState ns="mobileRewards" error={q.error} onRetry={() => void q.refresh()} />
    ) : (
      <RowsSkeleton rows={5} height={STANDING_ROW_HEIGHT} inset={false} />
    )
  ) : (
    <Text tone="tertiary" style={{ paddingHorizontal: GUTTER }}>
      {isUpcoming(c) ? t("mobileRewards.contest.boardEmptyUpcoming") : t("mobileRewards.contest.boardEmpty")}
    </Text>
  );

  return (
    <Page bar={<StackBar title={c.name} scrollY={scrollY} />}>
      <FlashList
        data={d?.leaderboard ?? EMPTY}
        renderItem={renderItem}
        keyExtractor={keyOf}
        extraData={c}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={<View style={{ height: bottom + space[6] }} />}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
      />
      {/* stays mounted after joining: a demo contest's credentials are shown in it once */}
      {!readOnly && !isPast(c) ? <JoinSheet sheetRef={joinRef} c={c} onJoined={() => void q.refresh()} /> : null}
    </Page>
  );
}

/** A view-only login gets the "not shared" state (rewards are never part of its access). */
export const ContestScreen = viewerGated(ContestDetailScreen, "mobileRewards.title.contest");
