// Prop home (/prop): the client's challenges (open ones as colour blocks, finished ones as rows), payouts and
// certificates at a glance, and the plan catalogue with checkout. One FlashList carries the whole page, so it
// stays smooth however many challenges a trader has run.
import * as React from "react";
import { RefreshControl, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useIsFocused, useRouter } from "expo-router";
import { Award, Banknote, ChevronLeft, ChevronRight } from "lucide-react-native";
import { useLocale, useT } from "@/i18n";
import { Display, EmptyState, Mono, PressableScale, Screen, Skeleton, Text, useBottomInset } from "@/ui";
import { colors, GUTTER, radius, space, type BlockColor } from "@/theme/tokens";
import { isOpenChallenge, normalizePlans, prefetchCertificates, prefetchChallenge, prefetchPayouts, sortChallenges, useCertificates, useChallenges, usePayouts, usePlans } from "../api";
import { usd } from "../format";
import { PLAN_COLORS } from "../rules";
import type { Certificate, Challenge, Plan } from "../types";
import { LoadState, SectionHead, StackHeader, useRefresh } from "../components/bits";
import { CheckoutSheet, type CheckoutHandle } from "../components/CheckoutSheet";
import { OpenChallengeCard, PastChallengeRow } from "../components/ChallengeCard";
import { CertificateSheet, CertificateTile, type CertificateSheetHandle } from "../components/Certificates";
import { PlanCard } from "../components/PlanCard";

type Item =
  | { type: "label"; key: string; label: string; action?: string; onAction?: () => void }
  | { type: "open"; c: Challenge }
  | { type: "past"; c: Challenge }
  | { type: "more"; count: number }
  | { type: "plan"; plan: Plan; color: BlockColor }
  | { type: "noPlans" }
  | { type: "how" }
  | { type: "certs"; list: Certificate[] }
  | { type: "gap"; h: number; key: string };

const PAST_SHOWN = 4;

function QuickLink({ icon, label, value, onPress, onPressIn, mono }: { icon: React.ReactNode; label: string; value: string; onPress: () => void; onPressIn?: () => void; mono?: boolean }) {
  const { rtl } = useLocale();
  return (
    <PressableScale onPress={onPress} onPressIn={onPressIn} scaleTo={0.97} accessibilityLabel={`${label}: ${value}`} style={{ flex: 1, minHeight: 84, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: space[4], justifyContent: "space-between" }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        {icon}
        {rtl ? <ChevronLeft size={16} color={colors.text3} /> : <ChevronRight size={16} color={colors.text3} />}
      </View>
      <View style={{ gap: 2, marginTop: space[3] }}>
        <Text variant="label" tone="tertiary">
          {label}
        </Text>
        {mono ? (
          <Mono size={15} weight="bold" numberOfLines={1} adjustsFontSizeToFit>
            {value}
          </Mono>
        ) : (
          <Text variant="headline" weight="700" numberOfLines={1}>
            {value}
          </Text>
        )}
      </View>
    </PressableScale>
  );
}

function QuickLinks({ available, eligible, certs }: { available: number; eligible: number; certs: number }) {
  const t = useT();
  const router = useRouter();
  return (
    <View style={{ flexDirection: "row", gap: space[3], paddingHorizontal: GUTTER }}>
      <QuickLink icon={<Banknote size={20} color={colors.gold} />} label={t("mobileProp.home.payouts")} value={eligible > 0 ? t("mobileProp.home.payoutsReady", { amount: usd(available) }) : t("mobileProp.home.payoutsNone")} mono={eligible > 0} onPress={() => router.push("/prop/payouts")} onPressIn={prefetchPayouts} />
      <QuickLink icon={<Award size={20} color={colors.mint} />} label={t("mobileProp.home.certificates")} value={t("mobileProp.home.certCount", { count: certs })} onPress={() => router.push("/prop/certificates")} onPressIn={prefetchCertificates} />
    </View>
  );
}

function How() {
  const t = useT();
  const steps = [
    { n: "01", title: t("mobileProp.how.1.title"), body: t("mobileProp.how.1.body") },
    { n: "02", title: t("mobileProp.how.2.title"), body: t("mobileProp.how.2.body") },
    { n: "03", title: t("mobileProp.how.3.title"), body: t("mobileProp.how.3.body") },
    { n: "04", title: t("mobileProp.how.4.title"), body: t("mobileProp.how.4.body") },
  ];
  return (
    <View style={{ paddingHorizontal: GUTTER, gap: space[5] }}>
      {steps.map((s) => (
        <View key={s.n} style={{ flexDirection: "row", gap: space[4] }}>
          <Display size="lg" tone="ember" style={{ width: 44 }}>
            {s.n}
          </Display>
          <View style={{ flex: 1, gap: 2, paddingTop: 2 }}>
            <Text variant="headline">{s.title}</Text>
            <Text variant="callout" tone="secondary">
              {s.body}
            </Text>
          </View>
        </View>
      ))}
      <Text variant="caption" tone="tertiary">
        {t("mobileProp.how.enforce")}
      </Text>
    </View>
  );
}

function CertStrip({ list, onOpen }: { list: Certificate[]; onOpen: (c: Certificate) => void }) {
  return (
    <FlashList
      horizontal
      data={list}
      keyExtractor={(c) => c.code}
      renderItem={({ item }) => <CertificateTile c={item} onOpen={onOpen} width={260} />}
      ItemSeparatorComponent={() => <View style={{ width: space[3] }} />}
      contentContainerStyle={{ paddingHorizontal: GUTTER }}
      showsHorizontalScrollIndicator={false}
    />
  );
}

function HomeSkeleton() {
  return (
    <View style={{ paddingHorizontal: GUTTER, gap: space[4] }}>
      <View style={{ flexDirection: "row", gap: space[3] }}>
        <Skeleton w="48%" h={84} r={radius.lg} />
        <Skeleton w="48%" h={84} r={radius.lg} />
      </View>
      <Skeleton h={14} w={140} style={{ marginTop: space[6] }} />
      <Skeleton h={420} r={radius.block} />
      <Skeleton h={420} r={radius.block} />
    </View>
  );
}

export function PropHomeScreen() {
  const t = useT();
  const router = useRouter();
  const focused = useIsFocused();
  const bottom = useBottomInset(false);
  const plans = usePlans();
  const mine = useChallenges(focused);
  const payouts = usePayouts();
  const certs = useCertificates();
  const checkout = React.useRef<CheckoutHandle>(null);
  const certSheet = React.useRef<CertificateSheetHandle>(null);
  const [showAllPast, setShowAllPast] = React.useState(false);

  const open = React.useCallback((id: number) => router.push(`/prop/${id}`), [router]);
  const warm = React.useCallback((id: number) => prefetchChallenge(id), []);
  const buy = React.useCallback((plan: Plan, size: number) => checkout.current?.open(plan, size), []);
  const openCert = React.useCallback((c: Certificate) => certSheet.current?.open(c), []);

  const { refreshing, onRefresh } = useRefresh(React.useCallback(() => Promise.all([plans.refresh(), mine.refresh(), payouts.refresh(), certs.refresh()]), [plans, mine, payouts, certs]));

  const planList = React.useMemo(() => normalizePlans(plans.data?.plans), [plans.data]);
  const list = React.useMemo(() => sortChallenges(mine.data?.challenges), [mine.data]);
  const funded = payouts.data?.funded ?? [];
  const eligible = funded.filter((f) => f.quote.eligible);
  const available = eligible.reduce((s, f) => s + f.quote.total, 0);
  const certList = React.useMemo(() => (certs.data?.certificates ?? []).filter((c) => !c.revoked), [certs.data]);

  const items = React.useMemo<Item[]>(() => {
    const out: Item[] = [];
    const openOnes = list.filter(isOpenChallenge);
    const past = list.filter((c) => !isOpenChallenge(c));
    if (openOnes.length) {
      out.push({ type: "label", key: "mine", label: t("mobileProp.home.mine") });
      openOnes.forEach((c, i) => {
        if (i) out.push({ type: "gap", h: space[3], key: `g-open-${c.id}` });
        out.push({ type: "open", c });
      });
    }
    if (past.length) {
      out.push({ type: "label", key: "past", label: t("mobileProp.home.past") });
      (showAllPast ? past : past.slice(0, PAST_SHOWN)).forEach((c) => out.push({ type: "past", c }));
      if (!showAllPast && past.length > PAST_SHOWN) out.push({ type: "more", count: past.length });
    }
    if (certList.length) out.push({ type: "label", key: "certs", label: t("mobileProp.home.yourCertificates"), action: t("mobile.action.seeAll"), onAction: () => router.push("/prop/certificates") }, { type: "certs", list: certList });
    out.push({ type: "label", key: "plans", label: list.length ? t("mobileProp.home.newChallenge") : t("mobileProp.home.plans") });
    if (planList.length === 0) out.push({ type: "noPlans" });
    planList.forEach((plan, i) => {
      if (i) out.push({ type: "gap", h: space[4], key: `g-plan-${plan.id}` });
      out.push({ type: "plan", plan, color: PLAN_COLORS[i % PLAN_COLORS.length]! });
    });
    out.push({ type: "label", key: "how", label: t("mobileProp.how.title") }, { type: "how" });
    return out;
  }, [list, planList, certList, showAllPast, t, router]);

  const renderItem = React.useCallback(
    ({ item }: { item: Item }) => {
      switch (item.type) {
        case "label":
          return <SectionHead label={item.label} action={item.action} onAction={item.onAction} />;
        case "open":
          return <OpenChallengeCard c={item.c} onOpen={open} onWarm={warm} />;
        case "past":
          return <PastChallengeRow c={item.c} onOpen={open} onWarm={warm} />;
        case "more":
          return (
            <PressableScale onPress={() => setShowAllPast(true)} scaleTo={1} style={{ minHeight: 48, justifyContent: "center", paddingHorizontal: GUTTER }}>
              <Text variant="callout" weight="700" tone="ember">
                {t("mobileProp.home.showAll", { count: item.count })}
              </Text>
            </PressableScale>
          );
        case "plan":
          return <PlanCard plan={item.plan} color={item.color} onBuy={buy} />;
        case "noPlans":
          return <EmptyState illustration="propChallenge" title={t("mobileProp.home.emptyTitle")} body={t("mobileProp.home.emptyBody")} />;
        case "how":
          return <How />;
        case "certs":
          return <CertStrip list={item.list} onOpen={openCert} />;
        case "gap":
          return <View style={{ height: item.h }} />;
      }
    },
    [open, warm, buy, openCert, t],
  );

  const header = (
    <View>
      <StackHeader
        eyebrow={t("mobileProp.home.eyebrow")}
        title={t("mobileProp.home.title")}
        sub={
          <Text tone="secondary" style={{ marginTop: space[1] }}>
            {t("mobileProp.home.subtitle", { split: Math.max(80, ...planList.map((p) => p.splitMax)) })}
          </Text>
        }
      />
      <QuickLinks available={available} eligible={eligible.length} certs={certList.length} />
    </View>
  );

  const nothing = !plans.data && !mine.data;
  return (
    <Screen scroll={false} tabBar={false}>
      {nothing && (plans.loading || mine.loading) ? (
        <>
          <StackHeader eyebrow={t("mobileProp.home.eyebrow")} title={t("mobileProp.home.title")} />
          <HomeSkeleton />
        </>
      ) : nothing ? (
        <>
          <StackHeader eyebrow={t("mobileProp.home.eyebrow")} />
          <LoadState error={plans.error ?? mine.error} onRetry={() => void onRefresh()} />
        </>
      ) : (
        <FlashList
          data={items}
          keyExtractor={(i) => (i.type === "open" || i.type === "past" ? `${i.type}-${i.c.id}` : i.type === "plan" ? `plan-${i.plan.id}` : i.type === "label" ? `label-${i.key}` : i.type === "gap" ? i.key : i.type)}
          getItemType={(i) => i.type}
          renderItem={renderItem}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingBottom: bottom + space[6] }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text3} colors={[colors.ember]} progressBackgroundColor={colors.surface} />}
        />
      )}
      <CheckoutSheet ref={checkout} onOpenChallenge={open} />
      <CertificateSheet ref={certSheet} />
    </Screen>
  );
}
