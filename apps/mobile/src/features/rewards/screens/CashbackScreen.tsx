// /rewards/cashback: cash back per closed live lot — what is accrued and not yet paid (paid to the USDT wallet after
// the hold), this month, paid and lifetime; the last 30 days; the programmes (automatic or opt-in, with the monthly
// cap) with enrolment; payouts and the latest accruals. Same data and rules as the Client Area's /rewards/cashback.
import * as React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { FlashList, type ListRenderItem } from "@shopify/flash-list";
import { Wallet } from "lucide-react-native";
import { useT } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { useReadOnly } from "@/features/partner/api";
import { Button, Card, ColorBlock, Mono, Text, toast, useBottomInset } from "@/ui";
import { colors, GUTTER, space } from "@/theme/tokens";
import { Bar, Page, PageTitle, SectionTitle, StackBar, Tag, useRefresh, useScrollY } from "../../partner/components/Chrome";
import { BlockSkeleton, RowsSkeleton, ScreenState } from "../../partner/components/States";
import { enrolCashback, rewardsError, useCashback } from "../api";
import { DayBars } from "../../partner/components/DayBars";
import { ago, date, day, lots, statusLabel, titleCase, usd } from "../format";
import type { CashbackAccrual, CashbackMe, CashbackProgramme } from "../types";
import { tint } from "../../partner/tint";
import { viewerGated } from "../components/ViewerGate";
import { RewardsBanners } from "../components/Banners";

const ROW_HEIGHT = 64;
const EMPTY: CashbackAccrual[] = [];
const keyOf = (x: CashbackAccrual) => String(x.id);

const AccrualRow = React.memo(function AccrualRow({ x }: { x: CashbackAccrual }) {
  const t = useT();
  return (
    <View style={{ height: ROW_HEIGHT, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: GUTTER }} accessible accessibilityLabel={`${x.symbol}, ${usd(x.amount, true)}, ${statusLabel(t, x.status)}`}>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text variant="callout" weight="700" numberOfLines={1}>
          {x.symbol} · {t("mobileRewards.value.lots", { lots: lots(x.lots) })}
        </Text>
        <Text variant="caption" tone="tertiary" numberOfLines={1}>
          {x.programme} · #{x.login} · {ago(t, x.createdAt)}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        <Mono size={14} weight="bold" color={x.status === "void" || x.status === "voided" ? colors.text3 : colors.up}>
          {usd(x.amount, true)}
        </Mono>
        <Tag label={statusLabel(t, x.status)} tone={x.status === "paid" ? "ok" : x.status === "accrued" ? "outline" : "muted"} />
      </View>
    </View>
  );
});

function Separator() {
  return <View style={{ height: 1, backgroundColor: colors.line, marginHorizontal: GUTTER }} />;
}

function scope(t: ReturnType<typeof useT>, p: CashbackProgramme) {
  const parts = [...p.assetClasses.map((c) => titleCase(t.dyn(`mobilePartner.prog.class.${c}`, c))), ...p.symbols];
  const what = parts.length ? parts.join(", ") : t("mobileRewards.cashback.allInstruments");
  return p.accountGroups.length ? `${what} · ${p.accountGroups.join(", ")}` : what;
}

const Programme = React.memo(function Programme({ p, readOnly }: { p: CashbackProgramme; readOnly: boolean }) {
  const t = useT();
  const [busy, setBusy] = React.useState(false);
  const cap = p.maxPerMonth;
  const capPct = cap ? Math.min(100, (p.earnedMonth / cap) * 100) : null;
  const on = !p.optIn || p.enrolled;
  const enrol = async () => {
    setBusy(true);
    const r = await enrolCashback(p.id);
    setBusy(false);
    if (!r.ok) {
      haptic.error();
      toast.show({ title: t("mobileRewards.cashback.enrolFailed"), body: rewardsError(r.error), tone: "error" });
      return;
    }
    haptic.success();
    toast.show({ title: t("mobileRewards.cashback.enrolled", { name: p.name }), body: t("mobileRewards.cashback.enrolledBody", { amount: usd(p.usdPerLot) }), tone: "success" });
  };
  return (
    <Card style={{ gap: space[3], borderColor: on ? tint.mintBorder : colors.line }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space[3] }}>
        <View style={{ flex: 1, gap: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], flexWrap: "wrap" }}>
            <Text variant="headline" weight="700">
              {p.name}
            </Text>
            {p.optIn ? <Tag label={p.enrolled ? t("mobileRewards.cashback.tagEnrolled") : t("mobileRewards.cashback.tagOptIn")} tone={p.enrolled ? "mint" : "warn"} /> : <Tag label={t("mobileRewards.cashback.tagAuto")} tone="outline" />}
          </View>
          <Text variant="caption" tone="tertiary" numberOfLines={2}>
            {scope(t, p)}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Mono size={22} weight="bold">
            {usd(p.usdPerLot)}
          </Mono>
          <Text variant="caption" tone="tertiary">
            {t("mobileRewards.cashback.perLot")}
          </Text>
        </View>
      </View>
      {p.description ? (
        <Text variant="caption" tone="secondary">
          {p.description}
        </Text>
      ) : null}
      <Text variant="caption" tone="tertiary">
        {t("mobileRewards.cashback.thisMonth", { amount: usd(p.earnedMonth), lots: lots(p.lotsMonth) })}
        {p.endsAt ? ` · ${t("mobileRewards.cashback.ends", { date: date(p.endsAt) })}` : ""}
      </Text>
      {capPct !== null ? (
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text variant="caption" tone="tertiary">
              {t("mobileRewards.cashback.cap")}
            </Text>
            <Mono size={12.5} tone="secondary">
              {usd(p.earnedMonth)} / {usd(cap!)}
            </Mono>
          </View>
          <Bar pct={capPct} color={capPct >= 100 ? colors.gold : colors.mint} />
        </View>
      ) : null}
      {p.optIn && !p.enrolled && !readOnly ? <Button label={t("mobileRewards.cashback.enrol")} size="md" loading={busy} onPress={() => void enrol()} testID={`cashback-enrol-${p.id}`} /> : null}
    </Card>
  );
});

function Hero({ d }: { d: CashbackMe }) {
  const t = useT();
  return (
    <ColorBlock color="mint" style={{ gap: space[4] }}>
      <Text variant="label" color={colors.ink2}>
        {t("mobileRewards.cashback.pending")}
      </Text>
      <Mono size={44} weight="bold" color={colors.ink} numberOfLines={1} adjustsFontSizeToFit>
        {usd(d.totals.accrued)}
      </Mono>
      <Text variant="caption" color={colors.ink2}>
        {t("mobileRewards.cashback.pendingBody")}
      </Text>
      <View style={{ flexDirection: "row", gap: space[4], paddingTop: space[3], borderTopWidth: 1, borderTopColor: tint.inkLine }}>
        {[
          [t("mobileRewards.cashback.month"), usd(d.totals.month)],
          [t("mobileRewards.cashback.paid"), usd(d.totals.paid)],
          [t("mobileRewards.cashback.lifetime"), usd(d.totals.lifetime)],
        ].map(([k, v]) => (
          <View key={k} style={{ flex: 1, gap: 2 }}>
            <Text variant="label" color={colors.ink2} numberOfLines={1} style={{ fontSize: 10.5 }}>
              {k}
            </Text>
            <Mono size={15} weight="bold" color={colors.ink} numberOfLines={1} adjustsFontSizeToFit>
              {v}
            </Mono>
          </View>
        ))}
      </View>
    </ColorBlock>
  );
}

function Cashback() {
  const t = useT();
  const router = useRouter();
  const readOnly = useReadOnly();
  const q = useCashback();
  const d = q.data;
  const { scrollY, onScroll } = useScrollY();
  const bottom = useBottomInset(false);
  const refreshControl = useRefresh(() => q.refresh());
  const renderItem = React.useCallback<ListRenderItem<CashbackAccrual>>(({ item }) => <AccrualRow x={item} />, []);
  const series = React.useMemo(() => (d?.series ?? []).map((s) => ({ key: s.day, value: s.amount })), [d]);
  const total30 = series.reduce((s, x) => s + x.value, 0);

  const header = (
    <View>
      <PageTitle eyebrow={t("mobileRewards.eyebrow.cashback")} title={t("mobileRewards.title.cashback")} />
      <RewardsBanners style={{ marginHorizontal: GUTTER, marginBottom: space[4] }} />
      {!d ? (
        q.error ? (
          <ScreenState ns="mobileRewards" error={q.error} onRetry={() => void q.refresh()} />
        ) : (
          <View style={{ gap: space[3] }}>
            <BlockSkeleton height={240} />
            <RowsSkeleton rows={3} />
          </View>
        )
      ) : (
        <View style={{ gap: space[8] }}>
          <View style={{ paddingHorizontal: GUTTER, gap: space[3] }}>
            <Hero d={d} />
            <Button label={t("mobileRewards.cashback.wallet")} variant="secondary" size="md" icon={<Wallet size={17} color={colors.text} />} onPress={() => router.push("/wallet")} />
          </View>
          <View style={{ paddingHorizontal: GUTTER }}>
            <SectionTitle title={t("mobileRewards.section.last30")} subtitle={t("mobileRewards.cashback.in30", { amount: usd(total30) })} />
            <Card>
              {total30 > 0 ? (
                <DayBars data={series} format={(v) => usd(v)} label={(k) => day(`${k}T12:00:00Z`)} color={colors.mint} a11y={t("mobileRewards.cashback.in30", { amount: usd(total30) })} />
              ) : (
                <Text tone="tertiary">{t("mobileRewards.cashback.noneYet")}</Text>
              )}
            </Card>
          </View>
          <View style={{ paddingHorizontal: GUTTER, gap: space[3] }}>
            <SectionTitle title={t("mobileRewards.section.programmes")} style={{ marginBottom: 0 }} />
            {d.programmes.length === 0 ? (
              <Text tone="tertiary">{t("mobileRewards.cashback.noProgrammes")}</Text>
            ) : (
              d.programmes.map((p) => <Programme key={p.id} p={p} readOnly={readOnly} />)
            )}
          </View>
          {d.payouts.length ? (
            <View style={{ paddingHorizontal: GUTTER }}>
              <SectionTitle title={t("mobileRewards.section.payouts")} />
              <Card padded={false}>
                {d.payouts.slice(0, 5).map((p, i) => (
                  <View key={p.id} style={{ minHeight: 56, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[5], borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
                    <Text variant="callout" style={{ flex: 1 }}>
                      {p.paidAt ? t("mobileRewards.cashback.paidOn", { date: date(p.paidAt) }) : t("mobileRewards.cashback.createdOn", { date: date(p.createdAt) })}
                    </Text>
                    <Mono size={14} weight="bold" color={p.status === "paid" ? colors.up : colors.text}>
                      {usd(p.amount)}
                    </Mono>
                    <Tag label={statusLabel(t, p.status)} tone={p.status === "paid" ? "ok" : p.status === "failed" ? "risk" : "warn"} />
                  </View>
                ))}
              </Card>
            </View>
          ) : null}
          <SectionTitle title={t("mobileRewards.section.accruals")} style={{ paddingHorizontal: GUTTER, marginBottom: 0 }} />
        </View>
      )}
    </View>
  );

  return (
    <Page bar={<StackBar title={t("mobileRewards.title.cashback")} scrollY={scrollY} />}>
      <FlashList
        data={d?.accruals ?? EMPTY}
        renderItem={renderItem}
        keyExtractor={keyOf}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={header}
        ListEmptyComponent={d ? <Text tone="tertiary" style={{ paddingHorizontal: GUTTER, paddingTop: space[3] }}>{t("mobileRewards.cashback.noAccruals")}</Text> : null}
        ListFooterComponent={<View style={{ height: bottom + space[6] }} />}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
      />
    </Page>
  );
}

/** A view-only login gets the "not shared" state (rewards are never part of its access). */
export const CashbackScreen = viewerGated(Cashback, "mobileRewards.title.cashback");
