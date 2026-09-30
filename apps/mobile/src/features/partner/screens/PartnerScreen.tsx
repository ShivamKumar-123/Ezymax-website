// /partner: the IB dashboard. The referral link is the hero (share, copy, QR), then the month in big numbers
// (clients, active clients, network lots, commission), what is due and when it pays, the last 12 weeks, the level
// and the progress toward the next one, the latest commission lines and the top clients, and the way into every
// partner screen. A partner with no clients yet gets how the programme pays instead of empty lists.
// Opens on the last dashboard kept on the phone; pull to refresh. Same data and rules as the Client Area's /partner
// (a view-only login sees the dashboard, clients and commission, but not payouts or campaign links).
import * as React from "react";
import { ScrollView, useWindowDimensions, View } from "react-native";
import { useRouter } from "expo-router";
import { Banknote, Layers, Link2, Percent, Share2, Users } from "lucide-react-native";
import { useT } from "@/i18n";
import { API_BASE } from "@/lib/config";
import { cachedConfig } from "@/market/config";
import { useMe } from "@/session";
import { RestrictionBanner } from "@/shell/RestrictionBanner";
import { Banner, Button, Card, Display, IconButton, Illustration, Mono, PressableScale, Text, useBottomInset, type SheetRef } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { prefetchPartner, refreshPartner, useReadOnly, usePartnerDashboard, useViewer } from "../api";
import { Bar, Initials, Label, NavRow, Page, PageTitle, SectionLink, SectionTitle, StackBar, Stat, Tag, useRefresh, useScrollY } from "../components/Chrome";
import { CommissionLine } from "../components/CommissionRow";
import { DayBars } from "../components/DayBars";
import { LevelCard } from "../components/LevelCard";
import { QrSheet, type QrTarget } from "../components/QrSheet";
import { ReferralHero } from "../components/ReferralHero";
import { BlockSkeleton, RowsSkeleton, ScreenState, TilesSkeleton } from "../components/States";
import { TileGrid, type TileSpec } from "../components/Tiles";
import { count, day, lastWeeks, lots, monthName, rate, referralLink, scheduleLabel, usd, usdShort, utcDay } from "../format";
import { shareLink } from "../share";
import type { Dashboard } from "../types";

/** Answers that mean there is no partner programme to show, not a dashboard that failed to load. */
const BLOCKING = new Set(["module_disabled", "maintenance", "viewer_scope"]);

function useLinkBase(d: Dashboard | undefined) {
  return d?.linkBase || cachedConfig()?.clientAreaUrl || API_BASE;
}

export function PartnerScreen() {
  const t = useT();
  const router = useRouter();
  const me = useMe();
  const readOnly = useReadOnly();
  // view-only logins: the Client Area keeps payouts and campaign links out of their reach (lib/viewer.ts)
  const viewer = useViewer();
  const q = usePartnerDashboard();
  const d = q.data;
  const { scrollY, onScroll } = useScrollY();
  const bottom = useBottomInset(false);
  const refreshControl = useRefresh(async () => {
    refreshPartner();
    await q.refresh();
  });
  const qrRef = React.useRef<SheetRef>(null);
  const [qr, setQr] = React.useState<QrTarget | null>(null);
  const brand = me?.tenant?.name || "Kalks";

  const code = d?.member.code ?? me?.referral_code ?? null;
  const base = useLinkBase(d);
  const link = code ? referralLink(base, code) : null;

  const share = React.useCallback(() => {
    if (link && code) void shareLink(link, t("mobilePartner.share.message", { brand, code }), t("mobilePartner.share.title", { brand }));
  }, [link, code, brand, t]);

  const openQr = React.useCallback(() => {
    if (!link || !code) return;
    setQr({ url: link, title: t("mobilePartner.qr.referralTitle"), fileBase: `${brand.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${code}-qr`, message: t("mobilePartner.share.message", { brand, code }) });
    qrRef.current?.present();
  }, [link, code, brand, t]);

  const go = React.useCallback((path: string) => router.push(path as never), [router]);
  const openLedger = React.useCallback(() => go("/partner/commissions"), [go]);

  const tiles = React.useMemo<TileSpec[] | null>(() => {
    if (!d) return null;
    const mon = monthName(d.progress.month);
    return [
      { key: "clients", color: "periwinkle", label: t("mobilePartner.kpi.clients"), value: count(d.counts.referrals), sub: d.counts.referralsThisMonth > 0 ? t("mobilePartner.kpi.newThisMonth", { n: d.counts.referralsThisMonth }) : t("mobilePartner.kpi.funded", { n: d.counts.funded }), onPress: () => go("/partner/clients"), onPressIn: prefetchPartner.clients, testID: "kpi-clients" },
      { key: "active", color: "cream", label: t("mobilePartner.kpi.active", { month: mon }), value: count(d.progress.activeClients), sub: d.progress.next ? t("mobilePartner.kpi.neededFor", { n: d.progress.next.minActiveClients, name: d.progress.next.name }) : t("mobilePartner.kpi.topLevel"), onPress: () => go("/partner/clients?status=active"), onPressIn: prefetchPartner.clients, testID: "kpi-active" },
      { key: "lots", color: "gold", label: t("mobilePartner.kpi.lots", { month: mon }), value: lots(d.progress.monthlyLots, d.progress.monthlyLots >= 1000 ? 0 : 1), sub: t("mobilePartner.kpi.lotsPrev", { lots: lots(d.progress.prevMonthLots, 1), month: monthName(d.progress.month, -1) }), onPress: () => go("/partner/clients"), onPressIn: prefetchPartner.clients, testID: "kpi-lots" },
      { key: "commission", color: "mint", label: t("mobilePartner.kpi.commission", { month: mon }), value: usd(d.earnings.month), money: true, sub: t("mobilePartner.kpi.lifetime", { amount: usd(d.earnings.lifetime) }), onPress: openLedger, onPressIn: prefetchPartner.commissions, testID: "kpi-commission" },
    ];
  }, [d, t, go, openLedger]);

  const shareButton = link ? <IconButton tone="ghost" accessibilityLabel={t("mobilePartner.action.shareLink")} icon={<Share2 size={21} color={colors.text} />} onPress={share} /> : null;
  const fresh = !!d && d.counts.referrals === 0;

  return (
    <Page bar={<StackBar title={t("mobilePartner.title")} scrollY={scrollY} right={shareButton} />}>
      <ScrollView onScroll={onScroll} scrollEventThrottle={16} refreshControl={refreshControl} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottom + space[6] }}>
        <PageTitle eyebrow={t("mobilePartner.eyebrow")} title={t("mobilePartner.title")} />

        <View style={{ paddingHorizontal: GUTTER, gap: space[3], marginBottom: space[4] }}>
          <RestrictionBanner kinds={["ib"]} onContact={viewer ? undefined : () => router.push("/support")} />
          {readOnly ? <Banner tone="info" title={t("mobile.viewOnly")} body={t("mobilePartner.viewOnlyBody")} /> : null}
          {d && d.member.status !== "active" ? <Banner tone="warn" title={t("mobilePartner.suspended.title")} body={t("mobilePartner.suspended.body")} /> : null}
        </View>

        {/* the referral link (from the session) shows while the dashboard loads or fails, but not when the broker switched
            the programme off, is in maintenance or doesn't share it with this login */}
        {!d && q.error && (!code || BLOCKING.has(q.error.code)) ? (
          <ScreenState ns="mobilePartner" error={q.error} onRetry={() => void q.refresh()} />
        ) : (
          <>
            <View style={{ paddingHorizontal: GUTTER }}>{code && link ? <ReferralHero code={code} link={link} funnel={d?.funnel ?? null} onQr={openQr} brand={brand} /> : <BlockSkeleton style={{ marginHorizontal: 0 }} />}</View>

            {!d && q.error ? (
              <ScreenState ns="mobilePartner" error={q.error} onRetry={() => void q.refresh()} />
            ) : !d ? (
              <View style={{ gap: space[3], marginTop: space[3] }}>
                <TilesSkeleton />
                <View style={{ height: space[3] }} />
                <BlockSkeleton height={180} />
                <RowsSkeleton rows={4} />
              </View>
            ) : (
              <>
                {tiles ? <TileGrid tiles={tiles} style={{ paddingHorizontal: GUTTER, marginTop: space[3] }} /> : null}
                <Earnings d={d} onOpen={viewer ? undefined : () => go("/partner/payouts")} onPressIn={prefetchPartner.payouts} />
                {fresh ? <StartCard d={d} onShare={link ? share : undefined} /> : <Weekly d={d} />}
                <View style={{ paddingHorizontal: GUTTER, marginTop: space[8] }}>
                  <SectionTitle title={t("mobilePartner.section.level")} />
                  <LevelCard d={d} />
                </View>
                {fresh ? null : (
                  <>
                    <Recent d={d} onAll={openLedger} />
                    <TopClients d={d} onAll={() => go("/partner/clients")} onOpen={(id) => go(`/partner/clients/${id}`)} />
                  </>
                )}
                <View style={{ paddingHorizontal: GUTTER, marginTop: space[8] }}>
                  <SectionTitle title={t("mobilePartner.section.more")} />
                  <Card padded={false}>
                    <NavRow first icon={<Users size={18} color={colors.text2} />} title={t("mobilePartner.nav.clients")} subtitle={t("mobilePartner.nav.clientsSub")} value={count(d.counts.referrals)} onPress={() => go("/partner/clients")} onPressIn={prefetchPartner.clients} />
                    <NavRow icon={<Layers size={18} color={colors.text2} />} title={t("mobilePartner.nav.commissions")} subtitle={t("mobilePartner.nav.commissionsSub")} onPress={openLedger} onPressIn={prefetchPartner.commissions} />
                    {viewer ? null : <NavRow icon={<Banknote size={18} color={colors.text2} />} title={t("mobilePartner.nav.payouts")} subtitle={t("mobilePartner.nav.payoutsSub", { date: day(d.programme.payout.nextClose) })} onPress={() => go("/partner/payouts")} onPressIn={prefetchPartner.payouts} />}
                    {viewer ? null : <NavRow icon={<Link2 size={18} color={colors.text2} />} title={t("mobilePartner.nav.links")} subtitle={t("mobilePartner.nav.linksSub")} onPress={() => go("/partner/links")} onPressIn={prefetchPartner.campaigns} />}
                    <NavRow icon={<Percent size={18} color={colors.text2} />} title={t("mobilePartner.nav.programme")} subtitle={t("mobilePartner.nav.programmeSub")} onPress={() => go("/partner/programme")} />
                  </Card>
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
      <QrSheet ref={qrRef} target={qr} />
    </Page>
  );
}

/** What is due (pending + approved), when the next batch closes, and the money so far. Opens Payouts. */
const Earnings = React.memo(function Earnings({ d, onOpen, onPressIn }: { d: Dashboard; onOpen?: () => void; onPressIn?: () => void }) {
  const t = useT();
  const due = d.earnings.pending + d.earnings.approved;
  const body = (
    <>
      {/* the label and the batch tag share a row, and the tag drops under the label on a narrow phone */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", columnGap: space[2], rowGap: space[2] }}>
        <Label>{t("mobilePartner.earnings.due")}</Label>
        <Tag label={t("mobilePartner.earnings.closes", { date: day(d.programme.payout.nextClose) })} tone="ember" />
      </View>
      <View style={{ gap: 2 }}>
        <Mono size={36} weight="bold" numberOfLines={1} adjustsFontSizeToFit>
          {usd(due)}
        </Mono>
        <Text variant="caption" tone="tertiary">
          {t("mobilePartner.earnings.split", { pending: usd(d.earnings.pending), approved: usd(d.earnings.approved) })}
        </Text>
      </View>
      <View style={{ flexDirection: "row", gap: space[4], paddingTop: space[4], borderTopWidth: 1, borderTopColor: colors.line }}>
        <Stat label={t("mobilePartner.earnings.paid")} value={usd(d.earnings.paid)} size={15} style={{ flex: 1 }} />
        <Stat label={t("mobilePartner.earnings.cpa")} value={usd(d.earnings.cpaEarned)} size={15} style={{ flex: 1 }} />
        <Stat label={t("mobilePartner.earnings.prevMonth")} value={usd(d.earnings.prevMonth)} size={15} style={{ flex: 1 }} />
      </View>
      {d.earnings.cpaWaiting > 0 ? (
        <Text variant="caption" tone="tertiary">
          {t("mobilePartner.earnings.cpaWaiting", { count: d.earnings.cpaWaiting })}
        </Text>
      ) : null}
    </>
  );
  return (
    <View style={{ paddingHorizontal: GUTTER, marginTop: space[3] }}>
      {onOpen ? (
        // a Card that opens Payouts and warms its data on press-in
        <PressableScale onPress={onOpen} onPressIn={onPressIn} accessibilityLabel={`${t("mobilePartner.earnings.due")}: ${usd(due)}`} testID="partner-earnings" style={{ backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, padding: space[5], gap: space[4] }}>
          {body}
        </PressableScale>
      ) : (
        <Card style={{ gap: space[4] }}>{body}</Card>
      )}
    </View>
  );
});

/** Commission of the last 12 weeks (all tiers, CPA included; rejected and void lines left out, as the server sums). */
const Weekly = React.memo(function Weekly({ d }: { d: Dashboard }) {
  const t = useT();
  const weeks = React.useMemo(() => lastWeeks(d.weekly), [d.weekly]);
  const total = weeks.reduce((s, w) => s + w.value, 0);
  if (total <= 0) return null;
  return (
    <View style={{ paddingHorizontal: GUTTER, marginTop: space[8] }}>
      <SectionTitle title={t("mobilePartner.section.weekly")} subtitle={t("mobilePartner.weekly.total", { amount: usd(total) })} />
      <Card>
        <DayBars data={weeks} height={96} format={(v) => usd(v)} label={(k) => t("mobilePartner.weekly.weekOf", { date: utcDay(Date.parse(k)) })} color={colors.ember} a11y={t("mobilePartner.weekly.a11y", { amount: usd(total) })} />
      </Card>
    </View>
  );
});

/** A partner without clients yet: how the programme pays, from the broker's own rate card, and the way to start. */
const StartCard = React.memo(function StartCard({ d, onShare }: { d: Dashboard; onShare?: () => void }) {
  const t = useT();
  const level = d.member.level;
  const best = level ? Math.max(0, ...Object.values(level.rates)) : 0;
  const cpa = d.programme.cpa.enabled && level && level.cpaAmount > 0 ? level.cpaAmount : 0;
  const schedule = scheduleLabel(t, d.programme.payout.schedule);
  // the CPA with the broker's own conditions: a first live deposit of at least the minimum (and a first trade)
  const cpaText = d.programme.cpa.requireFirstTrade ? "mobilePartner.start.step3CpaTrade" : "mobilePartner.start.step3Cpa";
  const steps = [
    { n: "1", title: t("mobilePartner.start.step1"), body: t("mobilePartner.start.step1Body", { code: d.member.code }) },
    { n: "2", title: t("mobilePartner.start.step2"), body: best > 0 ? t("mobilePartner.start.step2Body", { rate: rate(best), level: level?.name ?? "" }) : t("mobilePartner.start.step2Plain") },
    { n: "3", title: t("mobilePartner.start.step3"), body: cpa > 0 ? t(cpaText, { schedule, cpa: usdShort(cpa), min: usdShort(d.programme.cpa.minFirstDeposit) }) : t("mobilePartner.start.step3Body", { schedule }) },
  ];
  // the founder's partner art across the card (inside the gutters, the card's padding and its hairline border)
  const artWidth = useWindowDimensions().width - 2 * GUTTER - 2 * space[5] - 2;
  return (
    <View style={{ paddingHorizontal: GUTTER, marginTop: space[8] }}>
      <Card style={{ gap: space[5] }} testID="partner-start">
        <Illustration name="partnerIb" width={artWidth} />
        <View style={{ gap: space[1] }}>
          <Display size="sm">{t("mobilePartner.start.title")}</Display>
          <Text variant="caption" tone="secondary">
            {t("mobilePartner.start.body")}
          </Text>
        </View>
        <View style={{ gap: space[4] }}>
          {steps.map((s, i) => (
            <View key={s.n} style={{ flexDirection: "row", gap: space[3], alignItems: "flex-start" }}>
              <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: i === 0 ? colors.ember : colors.surface2, alignItems: "center", justifyContent: "center" }}>
                <Mono size={13} weight="bold" color={i === 0 ? colors.ink : colors.text2}>
                  {s.n}
                </Mono>
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
        </View>
        {onShare ? <Button label={t("mobilePartner.action.shareLink")} size="md" icon={<Share2 size={18} color={colors.ink} />} onPress={onShare} testID="partner-start-share" /> : null}
      </Card>
    </View>
  );
});

const Recent = React.memo(function Recent({ d, onAll }: { d: Dashboard; onAll: () => void }) {
  const t = useT();
  const rows = d.recent.slice(0, 5);
  return (
    <View style={{ paddingHorizontal: GUTTER, marginTop: space[8] }}>
      <SectionTitle title={t("mobilePartner.section.recent")} right={rows.length ? <SectionLink label={t("mobile.action.seeAll")} onPress={onAll} onPressIn={prefetchPartner.commissions} /> : undefined} />
      <Card padded={false}>
        {rows.length === 0 ? (
          <View style={{ padding: space[5], gap: space[1] }}>
            <Text variant="headline" weight="700">
              {t("mobilePartner.recent.emptyTitle")}
            </Text>
            <Text variant="caption" tone="tertiary">
              {t("mobilePartner.recent.emptyBody")}
            </Text>
          </View>
        ) : (
          rows.map((e, i) => <CommissionLine key={e.id} e={e} first={i === 0} compact onOpen={onAll} />)
        )}
      </Card>
    </View>
  );
});

/** The month's top clients by lots; a row opens the client when the broker shares client details (full visibility). */
const TopClients = React.memo(function TopClients({ d, onAll, onOpen }: { d: Dashboard; onAll: () => void; onOpen: (id: number) => void }) {
  const t = useT();
  const top = d.topClients.slice(0, 5);
  const full = d.programme.clientVisibility === "full";
  const max = Math.max(0.0001, ...top.map((c) => c.lotsMonth));
  return (
    <View style={{ paddingHorizontal: GUTTER, marginTop: space[8] }}>
      <SectionTitle title={t("mobilePartner.section.top")} subtitle={t("mobilePartner.top.subtitle", { month: monthName(d.progress.month) })} right={<SectionLink label={t("mobilePartner.top.all")} onPress={onAll} onPressIn={prefetchPartner.clients} />} />
      <Card padded={false}>
        {top.length === 0 ? (
          <View style={{ padding: space[5], gap: space[1] }}>
            <Text variant="headline" weight="700">
              {t("mobilePartner.top.emptyTitle")}
            </Text>
            <Text variant="caption" tone="tertiary">
              {t("mobilePartner.top.emptyBody")}
            </Text>
          </View>
        ) : (
          top.map((c, i) => (
            <PressableScale
              key={c.id}
              onPress={full ? () => onOpen(c.id) : onAll}
              onPressIn={() => {
                prefetchPartner.clients();
                if (full) prefetchPartner.trades(c.id);
              }}
              scaleTo={0.985} accessibilityLabel={`${i + 1}. ${c.name}, ${t("mobilePartner.top.lots", { lots: lots(c.lotsMonth) })}`} style={{ height: 64, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[5], borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
              <Mono size={13} tone="tertiary" style={{ width: 18, textAlign: "center" }}>
                {i + 1}
              </Mono>
              <Initials name={c.name} />
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text variant="callout" weight="700" numberOfLines={1}>
                  {c.name}
                </Text>
                <Text variant="caption" tone="tertiary" numberOfLines={1}>
                  {c.country.toUpperCase()}
                </Text>
              </View>
              <View style={{ width: 96, gap: 6, alignItems: "flex-end" }}>
                <Mono size={13} weight="medium" numberOfLines={1}>
                  {t("mobilePartner.top.lots", { lots: lots(c.lotsMonth) })}
                </Mono>
                <Bar pct={(c.lotsMonth / max) * 100} color={colors.gold} height={4} style={{ alignSelf: "stretch" }} />
              </View>
            </PressableScale>
          ))
        )}
      </Card>
    </View>
  );
});
