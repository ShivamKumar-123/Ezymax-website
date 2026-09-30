// Payouts (/prop/payouts): what can be withdrawn now from funded accounts, each account's quote (profit, split,
// firm share, fee refund) with what still blocks it, the request, the profit split and scaling plan, and the
// payout history. One FlashList carries the page; history rows have a fixed height.
import * as React from "react";
import { RefreshControl, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useIsFocused, useRouter } from "expo-router";
import { ArrowLeft, ArrowRight, BadgeCheck, Clock, ShieldAlert } from "lucide-react-native";
import { useLocale, useT } from "@/i18n";
import { Banner, Button, Card, ColorBlock, Display, EmptyState, Mono, Screen, Skeleton, Text, useBottomInset } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { useChallenges, usePayouts, useReadOnly } from "../api";
import { fmtDate, fmtDateTime, sizeLabel, usd } from "../format";
import { blockerText, payoutFreqLabel } from "../rules";
import { openInTrade } from "../trade";
import type { FundedAccount, Payout, PayoutStatus, Plan } from "../types";
import { alpha, CopyValue, inkSoft, KV, LoadState, SectionHead, StackHeader, Stat, Tag, useRefresh, type TagTone } from "../components/bits";
import { PayoutSheet, type PayoutSheetHandle } from "../components/PayoutSheet";

const STATUS: Record<PayoutStatus, { key: "mobileProp.payoutStatus.pending" | "mobileProp.payoutStatus.approved" | "mobileProp.payoutStatus.paid" | "mobileProp.payoutStatus.rejected" | "mobileProp.payoutStatus.failed"; tone: TagTone }> = {
  pending: { key: "mobileProp.payoutStatus.pending", tone: "gold" },
  approved: { key: "mobileProp.payoutStatus.approved", tone: "periwinkle" },
  paid: { key: "mobileProp.payoutStatus.paid", tone: "cream" },
  rejected: { key: "mobileProp.payoutStatus.rejected", tone: "ember" },
  failed: { key: "mobileProp.payoutStatus.failed", tone: "ember" },
};

type Item =
  | { type: "kyc" }
  | { type: "kpi" }
  | { type: "label"; key: string; label: string }
  | { type: "funded"; f: FundedAccount }
  | { type: "noFunded" }
  | { type: "split"; plan: Plan; size: number }
  | { type: "row"; p: Payout }
  | { type: "noHistory" }
  | { type: "gap"; key: string };

const HISTORY_ROW = 72;

function KycNotice({ status }: { status: string }) {
  const t = useT();
  const router = useRouter();
  if (status === "verified")
    return (
      <View style={{ marginHorizontal: GUTTER, flexDirection: "row", alignItems: "center", gap: space[2] }}>
        <BadgeCheck size={16} color={colors.cream} />
        <Text variant="caption" tone="secondary">
          {t("mobileProp.kyc.verified")}
        </Text>
      </View>
    );
  return (
    <Banner
      style={{ marginHorizontal: GUTTER }}
      tone={status === "pending" ? "info" : "warn"}
      icon={<ShieldAlert size={18} color={status === "pending" ? colors.text2 : colors.gold} />}
      title={status === "pending" ? t("mobileProp.kyc.pendingTitle") : t("mobileProp.kyc.requiredTitle")}
      body={status === "pending" ? t("mobileProp.kyc.pendingText") : status === "rejected" ? t("mobileProp.kyc.rejectedText") : t("mobileProp.kyc.requiredText")}
      action={status === "pending" ? undefined : t("mobileProp.errorLink.verify")}
      onAction={status === "pending" ? undefined : () => router.push("/profile/verification")}
    />
  );
}

function Kpis({ payouts, funded }: { payouts: Payout[]; funded: FundedAccount[] }) {
  const t = useT();
  const eligible = funded.filter((f) => f.quote.eligible);
  const available = eligible.reduce((s, f) => s + f.quote.total, 0);
  const pendingList = payouts.filter((p) => p.status === "pending" || p.status === "approved");
  const paidList = payouts.filter((p) => p.status === "paid");
  return (
    <ColorBlock color="gold" style={{ marginHorizontal: GUTTER, gap: space[4] }}>
      <View>
        <Text variant="label" color={inkSoft}>
          {t("mobileProp.payouts.available")}
        </Text>
        <Display size="hero" color={colors.ink} numberOfLines={1} adjustsFontSizeToFit>
          {usd(available)}
        </Display>
        <Text variant="callout" color={inkSoft}>
          {t("mobileProp.payouts.eligibleCount", { eligible: eligible.length, count: funded.length })}
        </Text>
      </View>
      <View style={{ flexDirection: "row", gap: space[4], borderTopWidth: 1, borderTopColor: alpha(colors.ink, 0.14), paddingTop: space[3] }}>
        <Stat ink label={t("mobileProp.payoutStatus.pending")} value={usd(pendingList.reduce((s, p) => s + p.total, 0))} sub={t("mobileProp.payouts.requests", { count: pendingList.length })} style={{ flex: 1 }} />
        <Stat ink label={t("mobileProp.payouts.paidToDate")} value={usd(paidList.reduce((s, p) => s + p.total, 0))} sub={t("mobileProp.payouts.count", { count: paidList.length })} style={{ flex: 1 }} />
      </View>
    </ColorBlock>
  );
}

const FundedCard = React.memo(function FundedCard({ f, kyc, readOnly, onRequest }: { f: FundedAccount; kyc: string; readOnly: boolean; onRequest: (f: FundedAccount) => void }) {
  const t = useT();
  const router = useRouter();
  const { rtl } = useLocale();
  const q = f.quote;
  // the prop service takes a payout request only from a verified trader (kyc_required otherwise), so the button
  // says what's missing instead of sending a request that can only be refused
  const verified = kyc === "verified";
  const canRequest = q.eligible && verified && !readOnly;
  return (
    <Card style={{ marginHorizontal: GUTTER, gap: space[4] }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[2] }}>
        <View style={{ flexDirection: "row", gap: space[2], alignItems: "center", flexShrink: 1 }}>
          <Tag label={t("mobileProp.status.funded")} tone="gold" />
          <Text variant="caption" tone="tertiary" numberOfLines={1} style={{ flexShrink: 1 }}>
            {f.planName}
          </Text>
        </View>
        {f.login ? <CopyValue value={String(f.login)} label={t("mobileProp.cred.login")} /> : null}
      </View>
      <Display size="lg">{t("mobileProp.payouts.account", { size: sizeLabel(f.size) })}</Display>
      <View style={{ flexDirection: "row", gap: space[4] }}>
        <Stat label={t("mobileProp.dash.balance")} value={usd(f.balance)} style={{ flex: 1 }} />
        <Stat label={t("mobileProp.dash.equity")} value={usd(f.equity)} style={{ flex: 1 }} />
      </View>

      <View style={{ borderRadius: radius.lg, backgroundColor: colors.surface2, padding: space[4], gap: space[2] }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text variant="label" tone="tertiary">
            {t("mobileProp.payouts.quote")}
          </Text>
          <Tag label={q.eligible ? t("mobileProp.payouts.eligibleNow") : t("mobileProp.payouts.notYet")} tone={q.eligible ? "cream" : "neutral"} />
        </View>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: space[2] }}>
          <Mono size={30} weight="bold" tone={q.eligible && q.total > 0 ? "up" : "primary"}>
            {usd(q.total)}
          </Mono>
          <Text variant="caption" tone="tertiary">
            {t("mobileProp.payouts.toWallet")}
          </Text>
        </View>
        <View>
          <KV label={t("mobileProp.request.profit")} value={usd(q.profit)} />
          <KV label={t("mobileProp.payouts.yourSplit")} value={`${q.split}% · ${usd(q.traderAmount)}`} />
          <KV label={t("mobileProp.payouts.firmShare")} value={usd(q.firmAmount)} />
          <KV label={t("mobileProp.feeRefund")} value={q.feeRefund > 0 ? usd(q.feeRefund) : f.refundFee ? (f.feeRefunded ? t("mobileProp.payouts.alreadyRefunded") : t("mobileProp.payouts.withFirst")) : t("mobileProp.nonRefundable")} mono={q.feeRefund > 0} last />
        </View>
        {q.blockers.length ? (
          <View style={{ gap: space[2], marginTop: space[1] }}>
            {q.blockers.map((b) => (
              <View key={b} style={{ flexDirection: "row", gap: space[2], alignItems: "flex-start" }}>
                <Clock size={14} color={colors.text3} style={{ marginTop: 2 }} />
                <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
                  {blockerText(t, b)}
                  {b === "not_yet_eligible" && q.eligibleFrom ? ` ${t("mobileProp.payouts.opens", { date: fmtDateTime(q.eligibleFrom) })}` : ""}
                  {b === "below_minimum" ? ` ${t("mobileProp.payouts.minimum", { amount: usd(q.minPayout, 0) })}` : ""}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        {q.eligible && readOnly ? (
          <Text variant="caption" tone="secondary">
            {t("mobileProp.payouts.readOnly")}
          </Text>
        ) : q.eligible && !verified ? (
          <Text variant="caption" tone="gold" testID={`prop-kyc-note-${f.challengeId}`}>
            {kyc === "pending" ? t("mobileProp.payouts.kycPendingNote") : t("mobileProp.payouts.kycNote")}
          </Text>
        ) : null}
      </View>

      {q.eligible && !verified && kyc !== "pending" && !readOnly ? (
        <Button label={t("mobileProp.errorLink.verify")} onPress={() => router.push("/profile/verification")} testID={`prop-verify-${f.challengeId}`} />
      ) : (
        <Button label={t("mobileProp.payouts.request")} disabled={!canRequest} onPress={() => onRequest(f)} testID={`prop-request-${f.challengeId}`} />
      )}
      <View style={{ flexDirection: "row", gap: space[3] }}>
        <Button label={t("mobileProp.payouts.dashboard")} variant="secondary" size="md" style={{ flex: 1 }} onPress={() => router.push(`/prop/${f.challengeId}`)} trailing={rtl ? <ArrowLeft size={15} color={colors.text} /> : <ArrowRight size={15} color={colors.text} />} />
        {f.login ? <Button label={t("mobileProp.action.trade")} variant="secondary" size="md" style={{ flex: 1 }} onPress={() => openInTrade(f.login!)} /> : null}
      </View>
    </Card>
  );
});

function SplitCard({ plan, size }: { plan: Plan; size: number }) {
  const t = useT();
  const scales = plan.scalingIncrease > 0 && plan.scalingEvery > 0 && plan.scalingCap > size;
  const steps: number[] = [];
  let s = size;
  for (let i = 0; scales && i < 4 && s < plan.scalingCap; i++) {
    s = Math.min(plan.scalingCap, Math.round(s * (1 + plan.scalingIncrease / 100)));
    steps.push(s);
  }
  return (
    <Card style={{ marginHorizontal: GUTTER, gap: space[4] }}>
      <View style={{ flexDirection: "row", gap: space[4] }}>
        <Stat label={t("mobileProp.payouts.yourSplit")} value={`${plan.split}%`} sub={scales && plan.splitMax > plan.split ? t("mobileProp.split.upTo", { pct: plan.splitMax }) : undefined} style={{ flex: 1 }} />
        <Stat text label={t("mobileProp.split.cycle")} value={payoutFreqLabel(t, plan.payoutFreq)} sub={plan.firstPayoutDays > 0 ? t("mobileProp.split.first", { days: t("mobileProp.days", { count: plan.firstPayoutDays }) }) : t("mobileProp.split.firstNow")} style={{ flex: 1 }} />
      </View>
      {scales ? (
        <>
          <Text variant="callout" tone="secondary">
            {t("mobileProp.scaling.text", { profit: plan.scalingProfit, months: t("mobileProp.months", { count: plan.scalingEvery }), increase: plan.scalingIncrease, cap: usd(plan.scalingCap, 0) })}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
            {[size, ...steps].map((x, i) => (
              <View key={x} style={{ height: 34, paddingHorizontal: space[3], borderRadius: radius.pill, justifyContent: "center", backgroundColor: i === 0 ? colors.cream : colors.surface2 }}>
                <Mono size={13} weight="bold" color={i === 0 ? colors.ink : colors.text2}>
                  {sizeLabel(x)}
                </Mono>
              </View>
            ))}
          </View>
        </>
      ) : (
        <Text variant="callout" tone="secondary">
          {t("mobileProp.scaling.none")}
        </Text>
      )}
    </Card>
  );
}

const HistoryRow = React.memo(function HistoryRow({ p }: { p: Payout }) {
  const t = useT();
  const s = STATUS[p.status] ?? { key: "mobileProp.payoutStatus.pending" as const, tone: "neutral" as TagTone };
  return (
    <View style={{ height: HISTORY_ROW, marginHorizontal: GUTTER, flexDirection: "row", alignItems: "center", gap: space[3], borderBottomWidth: 1, borderBottomColor: colors.line }}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="callout" weight="600" numberOfLines={1}>
          {p.planName} · {sizeLabel(p.size)}
        </Text>
        <Text variant="caption" tone="tertiary" numberOfLines={1}>
          {fmtDate(p.requestedAt)}
          {p.note && (p.status === "rejected" || p.status === "failed") ? ` · ${p.note}` : ""}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        <Mono size={15} weight="bold" tone={p.status === "paid" ? "up" : "primary"}>
          {usd(p.total)}
        </Mono>
        <Tag label={t(s.key)} tone={s.tone} />
      </View>
    </View>
  );
});

export function PayoutsScreen() {
  const t = useT();
  const router = useRouter();
  const focused = useIsFocused();
  const readOnly = useReadOnly();
  const bottom = useBottomInset(false);
  const q = usePayouts(focused);
  const ch = useChallenges();
  const sheet = React.useRef<PayoutSheetHandle>(null);
  const { refreshing, onRefresh } = useRefresh(React.useCallback(() => Promise.all([q.refresh(), ch.refresh()]), [q, ch]));
  const request = React.useCallback((f: FundedAccount) => sheet.current?.open(f), []);

  const data = q.data;
  const items = React.useMemo<Item[]>(() => {
    if (!data) return [];
    const out: Item[] = [{ type: "kyc" }, { type: "gap", key: "g1" }];
    // the totals only mean something once there is a funded account or a payout
    if (data.funded.length || data.payouts.length) out.push({ type: "kpi" });
    out.push({ type: "label", key: "funded", label: t("mobileProp.payouts.funded") });
    if (data.funded.length === 0) out.push({ type: "noFunded" });
    data.funded.forEach((f, i) => {
      if (i) out.push({ type: "gap", key: `g-f-${f.challengeId}` });
      out.push({ type: "funded", f });
    });
    const first = data.funded[0];
    const plan = first ? ch.data?.challenges.find((c) => c.id === first.challengeId)?.plan : undefined;
    if (first && plan) out.push({ type: "label", key: "split", label: t("mobileProp.split.title") }, { type: "split", plan, size: first.size });
    out.push({ type: "label", key: "history", label: t("mobileProp.payouts.history") });
    if (data.payouts.length === 0) out.push({ type: "noHistory" });
    data.payouts.forEach((p) => out.push({ type: "row", p }));
    return out;
  }, [data, ch.data, t]);

  const renderItem = React.useCallback(
    ({ item }: { item: Item }) => {
      switch (item.type) {
        case "kyc":
          return <KycNotice status={data?.kycStatus ?? "unverified"} />;
        case "kpi":
          return <Kpis payouts={data?.payouts ?? []} funded={data?.funded ?? []} />;
        case "label":
          return <SectionHead label={item.label} />;
        case "funded":
          return <FundedCard f={item.f} kyc={data?.kycStatus ?? "unverified"} readOnly={readOnly} onRequest={request} />;
        case "noFunded":
          return <EmptyState illustration="propPassed" title={t("mobileProp.payouts.emptyTitle")} body={t("mobileProp.payouts.emptyBody")} action={t("mobileProp.payouts.emptyAction")} onAction={() => router.navigate("/prop")} />;
        case "split":
          return <SplitCard plan={item.plan} size={item.size} />;
        case "row":
          return <HistoryRow p={item.p} />;
        case "noHistory":
          return (
            <Text variant="callout" tone="tertiary" style={{ paddingHorizontal: GUTTER, paddingVertical: space[4] }}>
              {t("mobileProp.payouts.historyEmpty")}
            </Text>
          );
        case "gap":
          return <View style={{ height: space[3] }} />;
      }
    },
    [data, readOnly, request, router, t],
  );

  return (
    <Screen scroll={false} tabBar={false}>
      {!data && q.loading ? (
        <>
          <StackHeader eyebrow={t("mobileProp.home.eyebrow")} title={t("mobileProp.payouts.title")} fallback="/prop" />
          <View style={{ paddingHorizontal: GUTTER, gap: space[4] }}>
            <Skeleton h={190} r={radius.block} />
            <Skeleton h={380} r={radius.card} />
          </View>
        </>
      ) : !data ? (
        <>
          <StackHeader eyebrow={t("mobileProp.home.eyebrow")} fallback="/prop" />
          <LoadState error={q.error} onRetry={() => void onRefresh()} />
        </>
      ) : (
        <FlashList
          data={items}
          keyExtractor={(i) => (i.type === "funded" ? `f-${i.f.challengeId}` : i.type === "row" ? `p-${i.p.id}` : i.type === "label" || i.type === "gap" ? `${i.type}-${i.key}` : i.type)}
          getItemType={(i) => i.type}
          renderItem={renderItem}
          ListHeaderComponent={<StackHeader eyebrow={t("mobileProp.home.eyebrow")} title={t("mobileProp.payouts.title")} fallback="/prop" />}
          contentContainerStyle={{ paddingBottom: bottom + space[8] }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text3} colors={[colors.ember]} progressBackgroundColor={colors.surface} />}
        />
      )}
      <PayoutSheet ref={sheet} funded={data?.funded} />
    </Screen>
  );
}
