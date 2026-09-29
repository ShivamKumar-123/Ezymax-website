// After submission: the "checking your documents" sequence, the live status tracker (submitted -> automatic checks
// -> review -> decision, with the rejection reason and the team's note) and the verification levels card.
import * as React from "react";
import { View } from "react-native";
import { AlertTriangle, BadgeCheck, Check, Clock, FileSearch, Lock, Mail, RotateCcw, ShieldCheck, UserCheck, X } from "lucide-react-native";
import { useT, type T } from "@/i18n";
import { Button, ColorBlock, Display, Illustration, PressableScale, Text } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { StatusChip } from "../components/bits";
import { when } from "../format";
import { hoursLabel } from "./api";
import type { KycDocument, KycState, TimelineEvent } from "./types";

/* ------------------------------------------------------------------ */
/* "Checking your documents…"                                          */
/* ------------------------------------------------------------------ */

export type CheckStep = { key: string; label: string; detail: string; warn?: boolean };

/** Summary of the automatic checks across the current documents (what the reviewer will also see). */
export function submissionChecks(state: KycState, t: T): CheckStep[] {
  const docs = state.documents.filter((d) => d.status === "uploaded" || d.status === "accepted");
  const client = docs.map((d) => d.checks.client).filter(Boolean) as NonNullable<KycDocument["checks"]["client"]>[];
  const all = <K extends keyof NonNullable<KycDocument["checks"]["client"]>>(k: K, pred: (v: NonNullable<NonNullable<KycDocument["checks"]["client"]>[K]>) => boolean) =>
    client.filter((c) => c[k] !== undefined).every((c) => pred(c[k] as never));
  const qualityOk = all("blur", (b) => b.ok) && all("brightness", (b) => b.ok);
  const steps: CheckStep[] = [
    { key: "received", label: t("kyc.checking.received"), detail: t("kyc.checking.receivedDetail", { count: docs.length }) },
    { key: "quality", label: t("kyc.checking.quality"), detail: qualityOk ? t("kyc.checking.qualityOk") : t("kyc.checking.qualityWarn"), warn: !qualityOk },
    { key: "resolution", label: t("kyc.checking.resolution"), detail: docs.every((d) => d.checks.resolution?.ok !== false) ? t("kyc.checking.resolutionOk") : t("kyc.checking.resolutionWarn"), warn: docs.some((d) => d.checks.resolution?.ok === false) },
  ];
  if (client.some((c) => c.glare)) steps.push({ key: "glare", label: t("kyc.checking.glare"), detail: all("glare", (g) => g.ok) ? t("kyc.checking.glareOk") : t("kyc.checking.glareWarn"), warn: !all("glare", (g) => g.ok) });
  if (client.some((c) => c.fill)) steps.push({ key: "framing", label: t("kyc.checking.framing"), detail: all("fill", (f) => f.ok) ? t("kyc.checking.framingOk") : t("kyc.checking.framingWarn"), warn: !all("fill", (f) => f.ok) });
  if (client.some((c) => c.mrz)) steps.push({ key: "mrz", label: t("kyc.checking.mrz"), detail: all("mrz", (m) => m.found) ? t("kyc.checking.mrzOk") : t("kyc.checking.mrzWarn"), warn: !all("mrz", (m) => m.found) });
  if (docs.some((d) => d.kind === "proof_of_address" || d.kind === "company_address")) steps.push({ key: "poa", label: t("kyc.checking.poa"), detail: t("kyc.checking.poaDetail") });
  if (client.some((c) => c.face)) steps.push({ key: "face", label: t("kyc.checking.face"), detail: all("face", (f) => f.found) ? t("kyc.checking.faceOk") : t("kyc.checking.faceWarn"), warn: !all("face", (f) => f.found) });
  steps.push({ key: "send", label: t("kyc.checking.send"), detail: t("kyc.checking.sendDetail") });
  return steps;
}

export function CheckingSequence({ steps, serverDone, onFinish }: { steps: CheckStep[]; serverDone: boolean; onFinish: () => void }) {
  const t = useT();
  const [n, setN] = React.useState(0);
  const last = steps.length - 1;
  React.useEffect(() => {
    if (n < last) {
      const id = setTimeout(() => setN((x) => x + 1), 480);
      return () => clearTimeout(id);
    }
    if (n === last && serverDone) {
      const id = setTimeout(() => setN(last + 1), 400);
      return () => clearTimeout(id);
    }
  }, [n, last, serverDone]);
  React.useEffect(() => {
    if (n > last) {
      const id = setTimeout(onFinish, 450);
      return () => clearTimeout(id);
    }
  }, [n, last, onFinish]);
  return (
    <View style={{ paddingHorizontal: GUTTER, gap: space[4] }} testID="kyc-checking">
      <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(242,106,61,0.14)", alignItems: "center", justifyContent: "center" }}>
        <FileSearch size={26} color={colors.ember} />
      </View>
      <View style={{ gap: space[1] }}>
        <Display size="lg">{t("kyc.checking.title")}</Display>
        <Text tone="secondary">{t("kyc.checking.text")}</Text>
      </View>
      <View style={{ gap: space[2] }}>
        {steps.map((s, i) => {
          const done = i < n;
          const active = i === n;
          return (
            <View
              key={s.key}
              style={{ flexDirection: "row", alignItems: "center", gap: space[3], padding: space[3], borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: active ? "rgba(242,106,61,0.45)" : colors.line, opacity: i <= n ? 1 : 0.45 }}
              accessibilityState={{ busy: active }}
            >
              <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: done ? (s.warn ? "rgba(242,184,75,0.16)" : "rgba(127,209,185,0.16)") : colors.surface2 }}>
                {done ? s.warn ? <AlertTriangle size={14} color={colors.gold} /> : <Check size={14} color={colors.mint} strokeWidth={3} /> : <Text variant="caption" weight="700" tone={active ? "ember" : "tertiary"}>{i + 1}</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="callout" weight="700">
                  {s.label}
                </Text>
                <Text variant="caption" tone="tertiary" numberOfLines={1}>
                  {done ? s.detail : active ? t("kyc.checking.active") : t("kyc.checking.waiting")}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Live status tracker                                                  */
/* ------------------------------------------------------------------ */

type Stage = { key: string; icon: typeof Check; title: string; text: string; state: "done" | "current" | "todo" | "failed" | "action" };

function stages(s: KycState, t: T): Stage[] {
  const c = s.case!;
  const typical = hoursLabel(t, s.review.typical_hours);
  const decided = c.status === "approved" || c.status === "rejected";
  const firstSubmit = s.timeline.find((e) => e.kind === "submitted")?.at ?? c.submitted_at;
  return [
    { key: "submitted", icon: Check, title: t("kyc.tracker.stage.submitted"), text: when(firstSubmit) + (c.submissions > 1 ? t("kyc.tracker.stage.resubmitted", { date: when(c.submitted_at) }) : ""), state: "done" },
    { key: "auto", icon: ShieldCheck, title: t("kyc.tracker.stage.auto"), text: t("kyc.tracker.stage.autoDetail"), state: "done" },
    {
      key: "review",
      icon: UserCheck,
      title: t("kyc.tracker.stage.review"),
      text: decided ? t("kyc.tracker.stage.completed", { date: when(c.decided_at) }) : c.status === "more_info" ? t("kyc.tracker.stage.waitingDocs") : c.status === "in_review" ? t("kyc.tracker.stage.inReviewSince", { date: when(c.review_started_at) }) : t("kyc.tracker.stage.usuallyWithin", { hours: typical }),
      state: decided ? "done" : c.status === "more_info" ? "action" : "current",
    },
    {
      key: "decision",
      icon: c.status === "rejected" ? X : BadgeCheck,
      title: c.status === "approved" ? t("kyc.tracker.stage.verified") : c.status === "rejected" ? t("kyc.tracker.stage.notApproved") : t("kyc.tracker.stage.decision"),
      text: c.status === "approved" ? t("kyc.tracker.stage.unlocked") : c.status === "rejected" ? (c.decision?.label ?? t("kyc.tracker.stage.seeReason")) : t("kyc.tracker.stage.emailResult"),
      state: c.status === "approved" ? "done" : c.status === "rejected" ? "failed" : "todo",
    },
  ];
}

const STAGE: Record<Stage["state"], { bg: string; fg: string }> = {
  done: { bg: "rgba(127,209,185,0.16)", fg: colors.mint },
  current: { bg: "rgba(242,106,61,0.16)", fg: colors.ember },
  action: { bg: "rgba(242,184,75,0.16)", fg: colors.gold },
  failed: { bg: "rgba(242,106,61,0.16)", fg: colors.ember },
  todo: { bg: colors.surface2, fg: colors.text3 },
};

const eventLabel = (e: TimelineEvent, t: T) => t.dyn(`kyc.event.${e.kind}`, e.kind.replace(/_/g, " "));

export function StatusTracker({ state, justSubmitted, onRestart, readOnly }: { state: KycState; justSubmitted?: boolean; onRestart?: () => void; readOnly?: boolean }) {
  const t = useT();
  const [activity, setActivity] = React.useState(false);
  const c = state.case!;
  const typical = hoursLabel(t, state.review.typical_hours);
  const approved = c.status === "approved";
  const rejected = c.status === "rejected";
  const head = approved
    ? { color: "mint" as const, title: t("kyc.tracker.approved.title"), text: t("kyc.tracker.approved.text"), ill: "kycApproved" as const }
    : rejected
      ? { color: "cream" as const, title: t("kyc.tracker.rejected.title"), text: c.decision?.label ? `${c.decision.label}.` : t("kyc.tracker.rejected.text"), ill: null }
      : c.status === "in_review"
        ? { color: "gold" as const, title: t("kyc.tracker.inReview.title"), text: t("kyc.tracker.inReview.text", { hours: typical }), ill: "kycPending" as const }
        : { color: "gold" as const, title: justSubmitted ? t("kyc.tracker.submitted.title", { hours: typical }) : t("kyc.tracker.queued.title", { hours: typical }), text: t("kyc.tracker.queued.text"), ill: "kycPending" as const };

  return (
    <View style={{ gap: space[5] }} testID="kyc-tracker">
      <ColorBlock color={head.color} style={{ marginHorizontal: GUTTER, gap: space[3] }}>
        {head.ill ? <Illustration name={head.ill} width={170} height={150} style={{ alignSelf: "center" }} /> : (
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(14,14,16,0.08)", alignItems: "center", justifyContent: "center" }}>
            <AlertTriangle size={26} color={colors.ember} />
          </View>
        )}
        <Display size={head.title.length > 26 ? "md" : "lg"} color={colors.ink}>
          {head.title}
        </Display>
        <Text color={colors.ink2}>{head.text}</Text>
        {rejected && c.decision?.message ? (
          <View style={{ marginTop: space[1], padding: space[3], borderRadius: radius.md, backgroundColor: "rgba(14,14,16,0.06)", gap: 2 }}>
            <Text variant="label" color={colors.ink2}>
              {t("kyc.wizard.noteFromTeam")}
            </Text>
            <Text color={colors.ink}>{c.decision.message}</Text>
          </View>
        ) : null}
        {rejected && state.can_start && onRestart && !readOnly ? <Button label={t("kyc.tracker.startAgain")} variant="primary" icon={<RotateCcw size={18} color={colors.ink} />} onPress={onRestart} style={{ marginTop: space[1] }} testID="kyc-restart" /> : null}
      </ColorBlock>

      <View style={{ marginHorizontal: GUTTER, gap: 0 }} accessibilityLabel={t("kyc.tracker.progressAria")}>
        {stages(state, t).map((s, i, all) => {
          const tone = STAGE[s.state];
          const Icon = s.state === "done" ? Check : s.icon;
          return (
            <View key={s.key} style={{ flexDirection: "row", gap: space[4] }} testID={`stage-${s.key}`}>
              <View style={{ alignItems: "center" }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: tone.bg, alignItems: "center", justifyContent: "center" }}>
                  <Icon size={17} color={tone.fg} strokeWidth={s.state === "done" ? 2.6 : 2} />
                </View>
                {i < all.length - 1 ? <View style={{ width: 2, flex: 1, minHeight: 18, backgroundColor: s.state === "done" ? "rgba(127,209,185,0.35)" : colors.line, marginVertical: 4 }} /> : null}
              </View>
              <View style={{ flex: 1, paddingTop: 6, paddingBottom: space[5], gap: 2 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], flexWrap: "wrap" }}>
                  <Text variant="headline" weight="700">
                    {s.title}
                  </Text>
                  {s.state === "current" ? <StatusChip label={t("kyc.tracker.inProgress")} tone="ember" /> : null}
                </View>
                <Text variant="caption" tone="tertiary">
                  {s.text}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      <View style={{ marginHorizontal: GUTTER, flexDirection: "row", alignItems: "center", gap: space[3], padding: space[4], borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
        <Mail size={18} color={colors.text3} />
        <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
          {approved || rejected ? t("kyc.tracker.emailedDecision", { email: state.profile.email }) : t("kyc.tracker.willEmail", { email: state.profile.email })}
        </Text>
      </View>

      {approved ? (
        <View style={{ marginHorizontal: GUTTER, flexDirection: "row", gap: space[2], alignItems: "center" }}>
          <Lock size={14} color={colors.text3} />
          <Text variant="caption" tone="tertiary" style={{ flex: 1 }}>
            {t("kyc.tracker.locked")}
          </Text>
        </View>
      ) : null}

      {state.timeline.length > 1 ? (
        <View style={{ marginHorizontal: GUTTER, gap: space[2] }}>
          <PressableScale onPress={() => setActivity((v) => !v)} scaleTo={1} accessibilityState={{ expanded: activity }} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: space[2] }}>
            <Clock size={16} color={colors.text3} />
            <Text variant="callout" tone="secondary" weight="600">
              {activity ? t("mobileProfile.kyc.activityHide") : t("mobileProfile.kyc.activityShow")}
            </Text>
          </PressableScale>
          {activity
            ? state.timeline
                .slice()
                .reverse()
                .map((e) => (
                  <View key={e.id} style={{ flexDirection: "row", justifyContent: "space-between", gap: space[3] }}>
                    <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
                      {eventLabel(e, t)}
                    </Text>
                    <Text variant="caption" tone="tertiary">
                      {when(e.at)}
                    </Text>
                  </View>
                ))
            : null}
        </View>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Levels                                                               */
/* ------------------------------------------------------------------ */

export function Levels({ state, emailVerified }: { state: KycState | null; emailVerified: boolean }) {
  const t = useT();
  const verified = state?.kyc_status === "verified";
  const pending = !!state?.case && ["submitted", "in_review", "more_info"].includes(state.case.status);
  const levels = [
    { n: 0, name: t("kyc.levels.registered"), unlocks: [t("kyc.levels.unlock.demoAccounts"), t("kyc.levels.unlock.platformTools")], done: true },
    { n: 1, name: t("kyc.levels.contactVerified"), unlocks: [t("kyc.levels.unlock.liveAccounts"), t("kyc.levels.unlock.deposits"), t("kyc.levels.unlock.copyPamm")], done: emailVerified },
    { n: 2, name: t("kyc.levels.identityVerified"), unlocks: [t("kyc.levels.unlock.withdrawals"), t("kyc.levels.unlock.partnerPayouts"), t("kyc.levels.unlock.higherLimits")], done: verified },
  ];
  return (
    <View style={{ marginHorizontal: GUTTER, gap: space[2] }} testID="kyc-levels">
      {levels.map((l) => (
        <View key={l.n} style={{ padding: space[4], borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: !l.done && l.n === 2 ? "rgba(242,106,61,0.4)" : colors.line, gap: space[3] }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
            <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: l.done ? "rgba(127,209,185,0.16)" : colors.surface2 }}>
              {l.done ? <Check size={16} color={colors.mint} strokeWidth={2.6} /> : <Text variant="callout" weight="700" tone="secondary">{l.n}</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="callout" weight="700">
                {t("kyc.levels.level", { n: l.n })}
              </Text>
              <Text variant="caption" tone="tertiary">
                {l.name}
              </Text>
            </View>
            {l.done ? (
              <StatusChip label={t("kyc.levels.complete")} tone="mint" />
            ) : l.n === 2 && pending ? (
              <StatusChip label={state?.case?.status === "more_info" ? t("kyc.levels.actionNeeded") : t("kyc.levels.inReview")} tone="gold" />
            ) : (
              <StatusChip label={t("kyc.levels.notStarted")} tone="neutral" dot={false} />
            )}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {l.unlocks.map((u) => (
              <View key={u} style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, height: 26, borderRadius: radius.pill, backgroundColor: colors.surface2 }}>
                {!l.done ? <Lock size={11} color={colors.text3} /> : null}
                <Text variant="caption" tone="secondary">
                  {u}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ))}
      <Text variant="caption" tone="tertiary" style={{ paddingHorizontal: space[1], marginTop: space[1], lineHeight: 18 }}>
        {t("kyc.levels.privacy")}
      </Text>
    </View>
  );
}
