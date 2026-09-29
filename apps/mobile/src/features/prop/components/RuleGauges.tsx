// The live rule dashboard: the profit target as the hero ring, the two loss limits as rings, then bars for trading
// days, time left and consistency, and the daily reset countdown. Gauges read live equity / balance on the UI
// thread (shared values + the rule maths in ../rules.ts); the numbers beside them are leaf texts.
import * as React from "react";
import { View } from "react-native";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import { useLocale, useT } from "@/i18n";
import { Card, Display, Mono, Text } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { clamp01, fmtDate, fmtDateTime, hms, nextNyClose, usd } from "../format";
import type { LiveMoney, PropLive } from "../live";
import { blockerText, dailyShare, dailyUsedOf, ddFloorOf, ddShare, ddUsedOf, liveParams, targetShare, type LiveParams, type View as RuleView } from "../rules";
import type { ChallengeDetail, PhaseAccount } from "../types";
import { Tag, type TagTone } from "./bits";
import { Bar, Ring } from "./gauges";
import { LiveText, type Render } from "./LiveParts";

export type RuleState = "ok" | "passed" | "failed" | "off";

function StateTag({ state }: { state: RuleState }) {
  const t = useT();
  const m: Record<RuleState, { label: string; tone: TagTone }> = {
    ok: { label: t("mobileProp.ruleState.ok"), tone: "neutral" },
    passed: { label: t("mobileProp.ruleState.passed"), tone: "mint" },
    failed: { label: t("mobileProp.ruleState.failed"), tone: "ember" },
    off: { label: t("mobileProp.ruleState.off"), tone: "neutral" },
  };
  return <Tag label={m[state].label} tone={m[state].tone} />;
}

type Props = {
  c: ChallengeDetail;
  a: PhaseAccount;
  v: RuleView;
  live: PropLive | null;
  fallback: LiveMoney;
  equity: SharedValue<number>;
  balance: SharedValue<number>;
  /** the account trades now (the reset countdown and warnings only matter then) */
  active: boolean;
};

/* ------------------------------------------------------------------ */
/* Profit target (hero ring) / funded payout window                    */
/* ------------------------------------------------------------------ */

function TargetHero({ a, v, live, fallback, balance, params }: Props & { params: LiveParams }) {
  const t = useT();
  const ended = a.status !== "active";
  const reached = a.status === "passed" || v.targetReached;
  const share = useDerivedValue(() => targetShare(params, balance.value), [params, balance]);
  const pctText = React.useCallback<Render>((m) => ({ text: `${Math.floor(clamp01(params.target > 0 ? Math.max(0, m.balance - params.initial) / params.target : 0) * 100)}%` }), [params]);
  const profitText = React.useCallback<Render>((m) => {
    const p = m.balance - params.initial;
    return { text: usd(p), tone: p > 0 ? "up" : p < 0 ? "down" : "primary" };
  }, [params]);
  const leftText = React.useCallback<Render>((m) => {
    const left = params.target - (m.balance - params.initial);
    return { text: left > 0 ? t("mobileProp.target.left", { amount: usd(left) }) : t("mobileProp.target.reachedBy", { amount: usd(-left) }), tone: "secondary" };
  }, [params, t]);
  const state: RuleState = a.status === "failed" ? "off" : reached ? "passed" : ended ? "off" : "ok";
  return (
    <Card style={{ marginHorizontal: GUTTER, flexDirection: "row", alignItems: "center", gap: space[5] }}>
      <View style={{ width: 132, height: 132, alignItems: "center", justifyContent: "center" }}>
        <Ring size={132} stroke={12} progress={share} color={colors.mint} />
        <View style={{ position: "absolute", alignItems: "center" }}>
          <LiveText live={live} fallback={fallback} render={pctText} size={26} weight="bold" />
          <Text variant="label" tone="tertiary" style={{ fontSize: 9.5 }}>
            {t("mobileProp.target.ofTarget")}
          </Text>
        </View>
      </View>
      <View style={{ flex: 1, gap: space[2] }}>
        <Text variant="label" tone="tertiary" numberOfLines={1}>
          {t("mobileProp.rule.profitTarget")}
        </Text>
        <LiveText live={live} fallback={fallback} render={profitText} size={22} weight="bold" />
        <Text variant="caption" tone="tertiary">
          {t("mobileProp.target.of", { amount: usd(v.targetAmount ?? 0), pct: a.targetPct ?? 0 })}
        </Text>
        {ended ? null : <LiveText live={live} fallback={fallback} render={leftText} size={12.5} weight="regular" numberOfLines={2} />}
        <StateTag state={state} />
      </View>
    </Card>
  );
}

function PayoutHero({ c, a }: Props) {
  const t = useT();
  const q = c.payout;
  const start = new Date(a.lastPayoutAt ?? a.startedAt).getTime();
  const end = q?.eligibleFrom ? new Date(q.eligibleFrom).getTime() : NaN;
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const waiting = Number.isFinite(end) && end > now;
  const daysLeft = waiting ? Math.max(1, Math.ceil((end - now) / 86_400_000)) : 0;
  // the ring fills over the payout cycle; full once the window is open
  const share = q?.eligible || !waiting ? 1 : end > start ? clamp01((now - start) / (end - start)) : 0;
  const blocker = q && !q.eligible ? q.blockers.find((b) => b !== "not_yet_eligible") : undefined;
  return (
    <Card style={{ marginHorizontal: GUTTER, flexDirection: "row", alignItems: "center", gap: space[5] }}>
      <View style={{ width: 132, height: 132, alignItems: "center", justifyContent: "center" }}>
        <Ring size={132} stroke={12} progress={share} color={q?.eligible || waiting ? colors.gold : colors.periwinkle} />
        <View style={{ position: "absolute", alignItems: "center", paddingHorizontal: space[2] }}>
          <Display size="md" align="center">
            {q?.eligible ? t("mobileProp.payoutHero.ready") : waiting ? t("mobileProp.payoutHero.days", { count: daysLeft }) : t("mobileProp.payoutHero.open")}
          </Display>
        </View>
      </View>
      <View style={{ flex: 1, gap: space[2] }}>
        <Text variant="label" tone="tertiary">
          {q?.eligible ? t("mobileProp.payoutHero.title") : t("mobileProp.payoutHero.share")}
        </Text>
        <Mono size={22} weight="bold" tone={q?.eligible && q.total > 0 ? "up" : "primary"}>
          {usd(q ? (q.eligible ? q.total : q.traderAmount) : 0)}
        </Mono>
        <Text variant="caption" tone="tertiary">
          {q?.eligible
            ? t("mobileProp.payoutHero.eligible", { split: c.split })
            : waiting && q?.eligibleFrom
              ? t("mobileProp.payoutHero.opens", { date: fmtDate(q.eligibleFrom) })
              : blocker
                ? blockerText(t, blocker)
                : t("mobileProp.payoutHero.later")}
        </Text>
      </View>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Loss limits (rings)                                                 */
/* ------------------------------------------------------------------ */

function LimitRing({ title, share, state, used, floor, left, live, fallback }: { title: string; share: SharedValue<number>; state: RuleState; used: Render; floor: Render; left: Render; live: PropLive | null; fallback: LiveMoney }) {
  return (
    <Card padded={false} style={{ flex: 1, padding: space[4], gap: space[3] }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[1] }}>
        <Text variant="label" tone="tertiary" numberOfLines={1} style={{ flexShrink: 1 }}>
          {title}
        </Text>
      </View>
      <View style={{ alignItems: "center", justifyContent: "center", height: 96 }}>
        <Ring size={96} stroke={10} progress={share} color={colors.gold} colorFull={colors.ember} />
        <View style={{ position: "absolute" }}>
          <LiveText live={live} fallback={fallback} render={used} size={18} weight="bold" />
        </View>
      </View>
      <View style={{ gap: 2 }}>
        <LiveText live={live} fallback={fallback} render={left} size={13} weight="medium" />
        <LiveText live={live} fallback={fallback} render={floor} size={11.5} weight="regular" />
      </View>
      <StateTag state={state} />
    </Card>
  );
}

function LimitRings({ a, live, fallback, equity, balance, params }: Props & { params: LiveParams }) {
  const t = useT();
  const failedRule = a.status === "failed" ? (a.endReason ?? "").toLowerCase() : "";
  const ended = a.status !== "active";
  const daily = useDerivedValue(() => dailyShare(params, equity.value), [params, equity]);
  const dd = useDerivedValue(() => ddShare(params, equity.value, balance.value), [params, equity, balance]);

  const dailyPct = React.useCallback<Render>((m) => ({ text: `${Math.round((params.dailyLimit > 0 ? Math.min(1, dailyUsedOf(params, m.equity) / params.dailyLimit) : 0) * 100)}%` }), [params]);
  const dailyLeft = React.useCallback<Render>((m) => ({ text: t("mobileProp.limit.left", { amount: usd(Math.max(0, params.dailyLimit - dailyUsedOf(params, m.equity))) }) }), [params, t]);
  const dailyFloor = React.useCallback<Render>(() => ({ text: t("mobileProp.limit.breachAt", { amount: usd(params.dailyRef - params.dailyLimit) }), tone: "tertiary" }), [params, t]);
  const ddPct = React.useCallback<Render>((m) => ({ text: `${Math.round((params.ddLimit > 0 ? Math.min(1, ddUsedOf(params, m.equity, m.balance) / params.ddLimit) : 0) * 100)}%` }), [params]);
  const ddLeft = React.useCallback<Render>((m) => ({ text: t("mobileProp.limit.left", { amount: usd(Math.max(0, m.equity - ddFloorOf(params, m.equity, m.balance))) }) }), [params, t]);
  const ddFloorText = React.useCallback<Render>((m) => ({ text: t("mobileProp.limit.breachAt", { amount: usd(ddFloorOf(params, m.equity, m.balance)) }), tone: "tertiary" }), [params, t]);

  return (
    <View style={{ flexDirection: "row", gap: space[3], marginHorizontal: GUTTER }}>
      <LimitRing title={t("mobileProp.rule.dailyLoss")} share={daily} state={failedRule.includes("daily") ? "failed" : ended ? "off" : "ok"} used={dailyPct} left={dailyLeft} floor={dailyFloor} live={live} fallback={fallback} />
      <LimitRing title={t("mobileProp.rule.maxDrawdown")} share={dd} state={failedRule.includes("drawdown") ? "failed" : ended ? "off" : "ok"} used={ddPct} left={ddLeft} floor={ddFloorText} live={live} fallback={fallback} />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Bars: trading days, time left, consistency; the daily reset         */
/* ------------------------------------------------------------------ */

function BarRow({ label, value, sub, share, color, colorFull, tag, text }: { label: string; value: string; sub?: string; share: number; color: string; colorFull?: string; tag?: React.ReactNode; text?: boolean }) {
  const { rtl } = useLocale();
  const [w, setW] = React.useState(0);
  return (
    <View style={{ gap: space[2], paddingVertical: space[3] }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[2] }}>
        <Text variant="label" tone="tertiary" numberOfLines={1} style={{ flexShrink: 1 }}>
          {label}
        </Text>
        {tag}
      </View>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: space[2] }}>
        {text ? (
          <Text variant="headline">{value}</Text>
        ) : (
          <Mono size={16} weight="bold">
            {value}
          </Mono>
        )}
        {sub ? (
          <Text variant="caption" tone="tertiary" numberOfLines={1} style={{ flexShrink: 1 }}>
            {sub}
          </Text>
        ) : null}
      </View>
      <View onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))} style={{ height: 8 }}>
        {w > 0 ? <Bar width={w} height={8} progress={share} color={color} colorFull={colorFull} rtl={rtl} /> : null}
      </View>
    </View>
  );
}

function useNow(ms: number) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/** "05:12:33" to 17:00 New York, ticking once a second (a leaf: only this text re-renders). */
function ResetCountdown({ nextReset }: { nextReset: string }) {
  const now = useNow(1000);
  let to = nextReset ? new Date(nextReset).getTime() : NaN;
  if (!Number.isFinite(to) || to <= now) to = nextNyClose(new Date(now)).getTime();
  return (
    <Mono size={16} weight="bold">
      {hms(to - now)}
    </Mono>
  );
}

function TimeLeft({ a, v }: { a: PhaseAccount; v: RuleView }) {
  const t = useT();
  const now = useNow(60_000);
  if (!v.deadline || !a.timeLimitDays) return <BarRow label={t("mobileProp.rule.timeLimit")} value={t("mobileProp.noTimeLimit")} text share={0} color={colors.gold} tag={<StateTag state="off" />} />;
  const end = new Date(v.deadline).getTime();
  const total = a.timeLimitDays * 86_400_000;
  const left = Math.max(0, end - (a.endedAt ? new Date(a.endedAt).getTime() : now));
  const failed = a.status === "failed" && (a.endReason ?? "").toLowerCase().includes("time");
  return (
    <BarRow
      label={t("mobileProp.rule.timeLimit")}
      value={t("mobileProp.time.left", { d: Math.floor(left / 86_400_000), h: Math.floor((left % 86_400_000) / 3_600_000) })}
      sub={t("mobileProp.time.deadline", { date: fmtDateTime(v.deadline) })}
      share={clamp01((total - left) / total)}
      color={colors.gold}
      colorFull={colors.ember}
      tag={<StateTag state={failed ? "failed" : a.status !== "active" ? "off" : "ok"} />}
    />
  );
}

function Bars({ c, a, v, active }: Props) {
  const t = useT();
  const ended = a.status !== "active";
  const cons = c.plan.consistency > 0;
  const daysShare = v.minDays > 0 ? clamp01(v.tradingDays / v.minDays) : 0;
  return (
    <Card style={{ marginHorizontal: GUTTER, paddingVertical: space[2] }}>
      <BarRow
        label={t("mobileProp.rule.tradingDays")}
        value={v.minDays > 0 ? t("mobileProp.days.of", { v: v.tradingDays, min: v.minDays }) : t("mobileProp.days.count", { count: v.tradingDays })}
        sub={v.minDays > 0 ? (v.daysOk ? t("mobileProp.days.met") : t("mobileProp.days.toGo", { count: Math.max(0, v.minDays - v.tradingDays) })) : t("mobileProp.days.noMinimum")}
        share={daysShare}
        color={colors.periwinkle}
        tag={<StateTag state={v.minDays === 0 ? "off" : v.daysOk || a.status === "passed" ? "passed" : ended ? "off" : "ok"} />}
      />
      <View style={{ height: 1, backgroundColor: colors.line }} />
      <TimeLeft a={a} v={v} />
      {cons ? (
        <>
          <View style={{ height: 1, backgroundColor: colors.line }} />
          <BarRow
            label={t("mobileProp.rule.consistency")}
            value={v.consistencyLimit ? `${usd(v.bestDay ?? 0, 0)} / ${usd(v.consistencyLimit, 0)}` : t("mobileProp.consistency.noProfit")}
            sub={t("mobileProp.consistency.rule", { pct: c.plan.consistency })}
            share={v.consistencyLimit ? clamp01(Math.max(0, v.bestDay ?? 0) / v.consistencyLimit) : 0}
            color={colors.mint}
            colorFull={colors.gold}
            tag={<StateTag state={v.consistencyOk ? (v.profit > 0 ? "passed" : "ok") : "failed"} />}
          />
        </>
      ) : null}
      {active ? (
        <>
          <View style={{ height: 1, backgroundColor: colors.line }} />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: space[4], gap: space[3] }}>
            <View style={{ flexShrink: 1, gap: 2 }}>
              <Text variant="label" tone="tertiary">
                {t("mobileProp.reset.title")}
              </Text>
              <Text variant="caption" tone="tertiary">
                {t("mobileProp.reset.note")}
              </Text>
            </View>
            <View style={{ borderRadius: radius.sm, backgroundColor: colors.surface2, paddingHorizontal: space[3], paddingVertical: space[2] }}>
              <ResetCountdown nextReset={v.nextReset} />
            </View>
          </View>
        </>
      ) : null}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* All together                                                        */
/* ------------------------------------------------------------------ */

function RuleGauges(p: Props) {
  const { v, c } = p;
  const params = React.useMemo(
    () => liveParams(v, c.plan),
    // the fields the maths uses (a new object from each poll must not rebuild the worklets)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [v.initial, v.dailyRef, v.dailyLimit, v.ddLimit, v.hwm, v.targetAmount, c.plan.ddType, c.plan.trailingLock],
  );
  return (
    <View style={{ gap: space[3] }}>
      {p.a.funded ? <PayoutHero {...p} /> : <TargetHero {...p} params={params} />}
      <LimitRings {...p} params={params} />
      <Bars {...p} />
    </View>
  );
}

const RuleGaugesMemo = React.memo(RuleGauges);
export { RuleGaugesMemo as RuleGauges };
