// Challenge dashboard (/prop/[id]): the live rule dashboard of the account a challenge trades on, fed by the
// trading-engine account stream (equity at up to 4 frames a second, on the UI thread) and the prop evaluator's
// verdicts (polled; refetched at once when a deal closes or the account's status changes). Breach and pass
// states take over the top of the page. Past phases show their final numbers.
import * as React from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useIsFocused, useLocalSearchParams, useRouter } from "expo-router";
import { useSharedValue } from "react-native-reanimated";
import { BookOpen, CandlestickChart } from "lucide-react-native";
import { useT } from "@/i18n";
import { Button, Card, EmptyState, IconButton, PillRow, Screen, Sheet, Skeleton, Text, useBottomInset, type SheetRef } from "@/ui";
import { RestrictionBanner } from "@/shell/RestrictionBanner";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { useChallenge, useStable } from "../api";
import { fmtDate, sizeLabel, usd } from "../format";
import { useLiveStatus, usePropLive, type LiveEvent, type LiveMoney } from "../live";
import { phaseStatusLabel, planRules, stageLabel, tradable, viewOf } from "../rules";
import { openInTrade } from "../trade";
import type { Certificate, ChallengeDetail, PhaseAccount } from "../types";
import { StatsCard, EventsList, TradesSection } from "../components/Activity";
import { CopyValue, KV, LoadState, SectionHead, StackHeader, Tag, useRefresh, type TagTone } from "../components/bits";
import { CertificateSheet, CertificateTile, type CertificateSheetHandle } from "../components/Certificates";
import { EquityCard } from "../components/EquityCard";
import { EquityHero } from "../components/LiveParts";
import { RuleGauges } from "../components/RuleGauges";
import { StateHero, Warnings } from "../components/StateHero";

function stageTone(c: ChallengeDetail): TagTone {
  if (c.status === "active") return "ember";
  if (c.status === "funded") return "gold";
  if (c.status === "provisioning" || c.status === "pending_payment") return "periwinkle";
  return "neutral";
}

function DashboardSkeleton() {
  return (
    <View style={{ paddingHorizontal: GUTTER, gap: space[3] }}>
      <Skeleton h={150} r={radius.card} />
      <Skeleton h={164} r={radius.card} />
      <View style={{ flexDirection: "row", gap: space[3] }}>
        <Skeleton w="48%" h={250} r={radius.card} />
        <Skeleton w="48%" h={250} r={radius.card} />
      </View>
    </View>
  );
}

export function ChallengeScreen() {
  const t = useT();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = /^\d{1,12}$/.test(String(params.id ?? "")) ? Number(params.id) : null;
  const focused = useIsFocused();
  const bottom = useBottomInset(false);
  const [pollMs, setPollMs] = React.useState(3_000);
  const q = useChallenge(id, focused ? pollMs : undefined);
  const data = useStable(q.data);
  const c = data && data.id === id ? data : null;
  const [phaseIdx, setPhaseIdx] = React.useState<number | null>(null);
  const a = React.useMemo(() => (c ? ((phaseIdx !== null ? c.phases.find((p) => p.phaseIndex === phaseIdx) : undefined) ?? c.current ?? c.phases[c.phases.length - 1] ?? null) : null), [c, phaseIdx]);
  const isLive = !!c && !!a && tradable(c, a);
  const v = React.useMemo(() => (c && a ? viewOf(c, a) : null), [c, a]);
  const rulesSheet = React.useRef<SheetRef>(null);
  const certSheet = React.useRef<CertificateSheetHandle>(null);
  const [dealTick, setDealTick] = React.useState(0);

  const fallback = React.useMemo<LiveMoney>(() => ({ equity: v?.equity ?? 0, balance: v?.balance ?? 0, positions: a?.openPositions ?? 0, at: 0 }), [v?.equity, v?.balance, a?.openPositions]);

  // a deal or a status change on the engine: the verdict, days and trades move; refetch shortly (debounced)
  const refetchTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const { refresh } = q;
  const onEvent = React.useCallback(
    (e: LiveEvent) => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      refetchTimer.current = setTimeout(() => {
        void refresh();
        if (e !== "status") setDealTick((n) => n + 1);
      }, e === "status" ? 300 : 900);
    },
    [refresh],
  );
  React.useEffect(() => () => void (refetchTimer.current && clearTimeout(refetchTimer.current)), []);

  const live = usePropLive(isLive && a?.login ? a.login : null, focused && isLive, fallback, onEvent);
  const status = useLiveStatus(live);
  React.useEffect(() => setPollMs(status === "live" ? 8_000 : 3_000), [status]);
  React.useEffect(() => {
    if (live && v && a) live.seed(v.equity, v.balance, a.openPositions);
    // the prop service's numbers, each time they arrive
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, q.updatedAt]);

  // gauges of past phases (or before the stream connects) read the service's numbers
  const eqStatic = useSharedValue(fallback.equity);
  const balStatic = useSharedValue(fallback.balance);
  React.useEffect(() => {
    eqStatic.value = fallback.equity;
    balStatic.value = fallback.balance;
  }, [fallback.equity, fallback.balance, eqStatic, balStatic]);
  const equity = live?.equity ?? eqStatic;
  const balance = live?.balance ?? balStatic;

  const { refreshing, onRefresh } = useRefresh(
    React.useCallback(async () => {
      await refresh();
      setDealTick((n) => n + 1);
    }, [refresh]),
  );
  const openCert = React.useCallback((cert: Certificate) => certSheet.current?.open(cert), []);

  if (id === null || (!c && q.error?.status === 404)) {
    return (
      <Screen tabBar={false}>
        <StackHeader />
        <EmptyState illustration="propChallenge" title={t("mobileProp.dash.notFound")} body={t("mobileProp.dash.notFoundBody")} action={t("mobileProp.dash.backToProp")} onAction={() => router.navigate("/prop")} />
      </Screen>
    );
  }
  if (!c || !a || !v) {
    return (
      <Screen tabBar={false}>
        <StackHeader eyebrow={t("mobileProp.home.eyebrow")} />
        {q.error && !q.data ? <LoadState error={q.error} onRetry={() => void refresh()} /> : c && !a ? <StateHero c={c} a={{ ...placeholderAccount, challengeId: c.id }} onCertificate={openCert} onPhase={setPhaseIdx} /> : <DashboardSkeleton />}
      </Screen>
    );
  }

  const events = eventsOf(c, a.id);
  const certs = certsOf(c);
  const at = v.at || a.lastEvalAt;

  return (
    <Screen scroll={false} tabBar={false}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: bottom + space[8] }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text3} colors={[colors.ember]} progressBackgroundColor={colors.surface} />}
      >
        <StackHeader
          eyebrow={c.planName}
          title={`${sizeLabel(c.size)} · ${a.phase}`}
          right={<IconButton accessibilityLabel={t("mobileProp.dash.rules")} icon={<BookOpen size={19} color={colors.text} />} onPress={() => rulesSheet.current?.present()} />}
          sub={
            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: space[3], marginTop: space[2] }}>
              <Tag label={stageLabel(t, c)} tone={stageTone(c)} />
              {a.login ? <CopyValue value={String(a.login)} label={t("mobileProp.cred.login")} /> : null}
            </View>
          }
        />

        {c.phases.length > 1 ? (
          <PillRow
            items={c.phases.map((p) => ({ key: String(p.phaseIndex), label: `${p.phase} · ${phaseStatusLabel(t, p.status)}` }))}
            value={String(a.phaseIndex)}
            onChange={(k) => setPhaseIdx(Number(k))}
            compact
            style={{ flexGrow: 0, marginBottom: space[4] }}
          />
        ) : null}

        <View style={{ gap: space[3] }}>
          <StateHero c={c} a={a} onCertificate={openCert} onPhase={setPhaseIdx} />
          <Warnings c={c} a={a} v={v} />
          {a.status !== "provisioning" ? (
            <Card style={{ marginHorizontal: GUTTER }}>
              <EquityHero live={live} fallback={fallback} initial={v.initial} at={isLive ? at : a.endedAt ?? at} final={!!a.endedAt} />
            </Card>
          ) : null}
          {a.status !== "provisioning" ? <RuleGauges c={c} a={a} v={v} live={live} fallback={fallback} equity={equity} balance={balance} active={isLive} /> : null}
        </View>

        <View style={{ paddingHorizontal: GUTTER, marginTop: space[5], gap: space[3] }}>
          {isLive ? <RestrictionBanner kinds={["trading", "close_only"]} /> : null}
          {isLive && a.login ? (
            <Button label={t("mobileProp.action.openTrade")} icon={<CandlestickChart size={19} color={colors.ink} />} onPress={() => openInTrade(a.login!)} testID="prop-open-trade" />
          ) : a.status === "active" || a.status === "passed" ? (
            <Text variant="caption" tone="tertiary" align="center">
              {t("mobileProp.action.tradeBlocked")}
            </Text>
          ) : null}
          {a.funded ? <Button label={t("mobileProp.action.payouts")} variant="secondary" onPress={() => router.push("/prop/payouts")} /> : null}
        </View>

        {a.status !== "provisioning" ? (
          <>
            <SectionHead label={t("mobileProp.chart.title")} />
            <EquityCard key={`${c.id}-${a.phaseIndex}`} challengeId={c.id} a={a} v={v} live={live?.equity ?? null} active={isLive} refreshKey={dealTick} />
            <SectionHead label={t("mobileProp.stats.title")} />
            <StatsCard a={a} />
            <SectionHead label={t("mobileProp.events.title")} />
            <EventsList events={events} />
            <TradesSection key={`${c.id}-${a.phaseIndex}`} challengeId={c.id} a={a} active={isLive} refreshKey={dealTick} />
          </>
        ) : null}

        {certs.length ? (
          <>
            <SectionHead label={t("mobileProp.certs.title")} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: GUTTER, gap: space[3] }}>
              {certs.map((x) => (
                <CertificateTile key={x.code} c={x} onOpen={openCert} width={260} />
              ))}
            </ScrollView>
          </>
        ) : null}

        <SectionHead label={t("mobileProp.account.title")} />
        <AccountCard c={c} a={a} deadline={v.deadline} />
        <Button label={t("mobileProp.action.support")} variant="ghost" size="md" full={false} onPress={() => router.push("/support")} style={{ alignSelf: "center", marginTop: space[5] }} />
      </ScrollView>

      <Sheet ref={rulesSheet} scroll enableDynamicSizing={false} snapPoints={["80%"]}>
        <RulesList c={c} />
      </Sheet>
      <CertificateSheet ref={certSheet} />
    </Screen>
  );
}

// sections only re-render when their own data changes (see useStable)
const eventsMemo = new WeakMap<ChallengeDetail, Map<number, ChallengeDetail["events"]>>();
function eventsOf(c: ChallengeDetail, accountId: number) {
  let m = eventsMemo.get(c);
  if (!m) eventsMemo.set(c, (m = new Map()));
  let list = m.get(accountId);
  if (!list) m.set(accountId, (list = c.events.filter((e) => e.accountId === accountId)));
  return list;
}
const certsMemo = new WeakMap<ChallengeDetail, Certificate[]>();
function certsOf(c: ChallengeDetail) {
  let list = certsMemo.get(c);
  if (!list) certsMemo.set(c, (list = c.certificates.filter((x) => !x.revoked)));
  return list;
}

const AccountCard = React.memo(function AccountCard({ c, a, deadline }: { c: ChallengeDetail; a: PhaseAccount; deadline: string | null }) {
  const t = useT();
  return (
    <>
      <Card style={{ marginHorizontal: GUTTER, paddingVertical: space[2] }}>
        <KV label={t("mobileProp.cred.login")} value={a.login ? <CopyValue value={String(a.login)} label={t("mobileProp.cred.login")} /> : "—"} />
        <KV label={t("mobileProp.cred.server")} value="Kalks-Live" />
        <KV label={t("mobileProp.leverage")} value={`1:${c.leverage}`} />
        <KV label={t("mobileProp.account.split")} value={`${c.split}%`} />
        <KV label={t("mobileProp.account.initial")} value={usd(a.initialBalance, 0)} />
        <KV label={t("mobileProp.account.started")} value={fmtDate(a.startedAt)} mono={false} />
        <KV label={a.endedAt ? t("mobileProp.account.ended") : t("mobileProp.account.deadline")} value={a.endedAt ? fmtDate(a.endedAt) : deadline ? fmtDate(deadline) : t("mobileProp.noTimeLimit")} mono={false} last />
      </Card>
      <Text variant="caption" tone="tertiary" style={{ paddingHorizontal: GUTTER, marginTop: space[3] }}>
        {t("mobileProp.account.passwordNote")}
      </Text>
    </>
  );
});

function RulesList({ c }: { c: ChallengeDetail }) {
  const t = useT();
  const bottom = useBottomInset(false);
  const rows = planRules(t, c.plan, { size: c.size, leverage: c.leverage });
  return (
    <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: bottom }} showsVerticalScrollIndicator={false}>
      <Text variant="label" tone="ember">
        {c.planName}
      </Text>
      <Text variant="headline" style={{ marginTop: space[1], marginBottom: space[3] }}>
        {t("mobileProp.dash.rulesTitle")}
      </Text>
      {rows.map(([k, val], i) => (
        <KV key={k} label={k} value={val} last={i === rows.length - 1} mono={false} />
      ))}
      <Text variant="caption" tone="tertiary" style={{ marginTop: space[3] }}>
        {t("mobileProp.checkout.limitsNote")}
      </Text>
    </BottomSheetScrollView>
  );
}

/** A challenge that has no phase account yet (payment or account opening). */
const placeholderAccount = {
  id: 0,
  challengeId: 0,
  phaseIndex: 0,
  phase: "",
  funded: false,
  login: null,
  status: "provisioning" as const,
  initialBalance: 0,
  targetPct: null,
  minDays: 0,
  timeLimitDays: 0,
  startedAt: new Date(0).toISOString(),
  endedAt: null,
  endReason: null,
  balance: null,
  equity: null,
  openPositions: 0,
  tradingDays: 0,
  lastEvalAt: null,
  lastPayoutAt: null,
  scaledAt: null,
  rules: null,
  stats: null,
};
