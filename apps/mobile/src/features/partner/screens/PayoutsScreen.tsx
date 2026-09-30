// /partner/payouts: what is accruing in the current period and when its batch closes (a countdown), the minimum
// payout, how a batch gets paid (closes → the broker approves → credited to the USDT wallet), and every payout with
// its status. Same data as the Client Area's /partner/payouts.
import * as React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { FlashList, type ListRenderItem } from "@shopify/flash-list";
import { Banknote, Gavel, Layers, Wallet } from "lucide-react-native";
import { useT } from "@/i18n";
import { Button, Card, ColorBlock, EmptyState, Mono, Text, useBottomInset } from "@/ui";
import { colors, GUTTER, space } from "@/theme/tokens";
import { usePayouts, useViewer } from "../api";
import { Page, PageTitle, SectionTitle, StackBar, Stat, Tag, useRefresh, useScrollY, type TagTone } from "../components/Chrome";
import { BlockSkeleton, RowsSkeleton, ScreenState, ViewerBlocked } from "../components/States";
import { date, dateTime, day, payoutStatusLabel, period, scheduleLabel, usd, usdShort } from "../format";
import type { Payout, PayoutsResp } from "../types";
import { tint } from "../tint";

const ROW_HEIGHT = 72;
const EMPTY: Payout[] = [];
const keyOf = (p: Payout) => String(p.id);

const payoutTone = (s: string): TagTone => (s === "paid" ? "ok" : s === "rejected" ? "risk" : s === "processing" ? "periwinkle" : "warn");

/** Days, hours and minutes until the batch closes (only this text re-renders, every 30 s). */
function Countdown({ to }: { to: string }) {
  const t = useT();
  const end = React.useMemo(() => Date.parse(to), [to]);
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, end - now);
  const parts = [Math.floor(left / 86_400_000), Math.floor(left / 3_600_000) % 24, Math.floor(left / 60_000) % 60];
  const labels = [t("mobilePartner.pay.days"), t("mobilePartner.pay.hrs"), t("mobilePartner.pay.min")];
  return (
    <View style={{ flexDirection: "row", gap: space[2], direction: "ltr" }} accessible accessibilityLabel={t("mobilePartner.pay.countdownA11y", { d: parts[0]!, h: parts[1]!, m: parts[2]! })}>
      {parts.map((v, i) => (
        <View key={labels[i]} style={{ minWidth: 58, paddingVertical: space[2], borderRadius: 14, backgroundColor: tint.inkFill, alignItems: "center" }}>
          <Mono size={22} weight="bold" color={colors.ink}>
            {String(v).padStart(2, "0")}
          </Mono>
          <Text variant="label" color={colors.ink2} style={{ fontSize: 9.5 }}>
            {labels[i]}
          </Text>
        </View>
      ))}
    </View>
  );
}

const PayoutRow = React.memo(function PayoutRow({ p }: { p: Payout }) {
  const t = useT();
  const when = p.paidAt ? t("mobilePartner.pay.paidOn", { date: dateTime(p.paidAt) }) : t("mobilePartner.pay.createdOn", { date: dateTime(p.createdAt) });
  return (
    <View style={{ height: ROW_HEIGHT, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: GUTTER }} accessible accessibilityLabel={`${period(p.schedule, p.periodEnd, p.periodStart)}, ${usd(p.amount)}, ${payoutStatusLabel(t, p.status)}`}>
      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: p.status === "paid" ? colors.mint : colors.surface2, alignItems: "center", justifyContent: "center" }}>
        <Banknote size={17} color={p.status === "paid" ? colors.ink : colors.text2} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text variant="callout" weight="700" numberOfLines={1}>
          {period(p.schedule, p.periodEnd, p.periodStart)}
        </Text>
        <Text variant="caption" tone="tertiary" numberOfLines={1}>
          #{p.batchId} · {t("mobilePartner.pay.lines", { count: p.lines })} · {when}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 5 }}>
        <Mono size={15} weight="bold" color={p.status === "paid" ? colors.up : p.status === "rejected" ? colors.text3 : colors.text}>
          {usd(p.amount)}
        </Mono>
        <Tag label={payoutStatusLabel(t, p.status)} tone={payoutTone(p.status)} />
      </View>
    </View>
  );
});

function Separator() {
  return <View style={{ height: 1, backgroundColor: colors.line, marginStart: GUTTER + 38 + space[3] }} />;
}

function Hero({ d }: { d: PayoutsResp }) {
  const t = useT();
  const below = d.unbatched > 0 && d.unbatched < d.minAmount;
  return (
    <ColorBlock color="gold" style={{ gap: space[4] }}>
      <View style={{ gap: 2 }}>
        <Text variant="label" color={colors.ink2}>
          {t("mobilePartner.pay.accruingNow", { schedule: scheduleLabel(t, d.schedule) })}
        </Text>
        <Text variant="callout" weight="700" color={colors.ink} numberOfLines={1}>
          {period(d.schedule, d.nextClose)}
        </Text>
      </View>
      <Mono size={44} weight="bold" color={colors.ink} numberOfLines={1} adjustsFontSizeToFit>
        {usd(d.unbatched)}
      </Mono>
      <Text variant="caption" color={colors.ink2}>
        {below ? t("mobilePartner.pay.belowMin", { amount: usdShort(d.minAmount) }) : t("mobilePartner.pay.minNote", { amount: usdShort(d.minAmount) })}
      </Text>
      <View style={{ gap: space[2], paddingTop: space[3], borderTopWidth: 1, borderTopColor: tint.inkLine }}>
        <Text variant="label" color={colors.ink2}>
          {t("mobilePartner.pay.closesIn", { date: day(d.nextClose) })}
        </Text>
        <Countdown to={d.nextClose} />
      </View>
    </ColorBlock>
  );
}

function Steps() {
  const t = useT();
  const steps = [
    { icon: Layers, title: t("mobilePartner.pay.step1"), body: t("mobilePartner.pay.step1Body") },
    { icon: Gavel, title: t("mobilePartner.pay.step2"), body: t("mobilePartner.pay.step2Body") },
    { icon: Wallet, title: t("mobilePartner.pay.step3"), body: t("mobilePartner.pay.step3Body") },
  ];
  return (
    <Card style={{ gap: space[4] }}>
      {steps.map((s, i) => (
        <View key={s.title} style={{ flexDirection: "row", gap: space[3], alignItems: "flex-start" }}>
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: i === 0 ? colors.ember : colors.surface2, alignItems: "center", justifyContent: "center" }}>
            <s.icon size={16} color={i === 0 ? colors.ink : colors.text2} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="callout" weight="700">
              {s.title}
            </Text>
            <Text variant="caption" tone="tertiary">
              {s.body}
            </Text>
          </View>
        </View>
      ))}
    </Card>
  );
}

export function PayoutsScreen() {
  const t = useT();
  const router = useRouter();
  const viewer = useViewer();
  const q = usePayouts(!viewer);
  const d = q.data;
  const { scrollY, onScroll } = useScrollY();
  const bottom = useBottomInset(false);
  const refreshControl = useRefresh(() => q.refresh());
  const renderItem = React.useCallback<ListRenderItem<Payout>>(({ item }) => <PayoutRow p={item} />, []);

  const paid = React.useMemo(() => (d?.items ?? []).filter((p) => p.status === "paid"), [d]);
  const paidTotal = paid.reduce((s, p) => s + p.amount, 0);
  const inReview = (d?.items ?? []).filter((p) => p.status === "awaiting_approval" || p.status === "processing").reduce((s, p) => s + p.amount, 0);

  const header = (
    <View>
      <PageTitle eyebrow={t("mobilePartner.eyebrow.payouts")} title={t("mobilePartner.title.payouts")} />
      {d ? (
        <View style={{ paddingHorizontal: GUTTER, gap: space[3] }}>
          <Hero d={d} />
          <Card style={{ flexDirection: "row", gap: space[4] }}>
            <Stat label={t("mobilePartner.pay.paidTotal")} value={usd(paidTotal)} size={16} tone={paidTotal > 0 ? "up" : null} style={{ flex: 1 }} />
            <Stat label={t("mobilePartner.pay.inReview")} value={usd(inReview)} size={16} style={{ flex: 1 }} />
            <Stat label={t("mobilePartner.pay.lastPaid")} value={paid[0]?.paidAt ? date(paid[0].paidAt, false) : "—"} size={16} style={{ flex: 1 }} />
          </Card>
          <SectionTitle title={t("mobilePartner.pay.how")} style={{ marginTop: space[5] }} />
          <Steps />
          <Button label={t("mobilePartner.pay.openWallet")} variant="secondary" size="md" icon={<Wallet size={17} color={colors.text} />} onPress={() => router.push("/wallet")} style={{ marginTop: space[1] }} />
          <SectionTitle title={t("mobilePartner.pay.history")} subtitle={d.items.length ? t("mobilePartner.pay.historySub") : undefined} style={{ marginTop: space[6], marginBottom: space[1] }} />
        </View>
      ) : null}
    </View>
  );

  const empty = !d ? (
    q.error ? (
      <ScreenState ns="mobilePartner" error={q.error} onRetry={() => void q.refresh()} />
    ) : (
      <View style={{ gap: space[3] }}>
        <BlockSkeleton height={260} />
        <RowsSkeleton rows={3} height={ROW_HEIGHT} />
      </View>
    )
  ) : (
    <EmptyState illustration="withdrawalProcessing" size={180} title={t("mobilePartner.pay.emptyTitle")} body={t("mobilePartner.pay.emptyBody", { amount: usdShort(d.minAmount) })} style={{ paddingTop: space[2] }} />
  );

  if (viewer)
    return (
      <Page bar={<StackBar title={t("mobilePartner.title.payouts")} scrollY={scrollY} />}>
        <ViewerBlocked />
      </Page>
    );

  return (
    <Page bar={<StackBar title={t("mobilePartner.title.payouts")} scrollY={scrollY} />}>
      <FlashList
        data={d?.items ?? EMPTY}
        renderItem={renderItem}
        keyExtractor={keyOf}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={<View style={{ height: bottom + space[6] }} />}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
      />
    </Page>
  );
}

