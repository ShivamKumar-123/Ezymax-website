"use client";

import * as React from "react";
import { AlertTriangle, BadgeCheck, Check, Clock, FileSearch, Lock, Mail, RotateCcw, ShieldCheck, UserCheck, X } from "lucide-react";
import { motion } from "motion/react";
import { Button, Chip, cn } from "@kalks/ui";
import type { KycDocument, KycState, TimelineEvent } from "./api";

function fmt(iso: string | null | undefined, withTime = true) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) });
}

export function hoursLabel(h: number) {
  return h <= 1 ? "1 hour" : `${h} hours`;
}

/* ------------------------------------------------------------------ */
/* "Checking your documents…"                                          */
/* ------------------------------------------------------------------ */

export type CheckStep = { key: string; label: string; detail: string; warn?: boolean };

/** Summary of the automatic checks across every current document (what the reviewer will also see). */
export function submissionChecks(state: KycState): CheckStep[] {
  const docs = state.documents.filter((d) => d.status === "uploaded" || d.status === "accepted");
  const client = docs.map((d) => d.checks.client).filter(Boolean) as NonNullable<KycDocument["checks"]["client"]>[];
  const all = <K extends keyof NonNullable<KycDocument["checks"]["client"]>>(k: K, pred: (v: NonNullable<NonNullable<KycDocument["checks"]["client"]>[K]>) => boolean) =>
    client.filter((c) => c[k] !== undefined).every((c) => pred(c[k] as never));
  const steps: CheckStep[] = [
    { key: "received", label: "Documents received", detail: `${docs.length} file${docs.length === 1 ? "" : "s"}, type and size verified` },
    { key: "quality", label: "Image quality", detail: all("blur", (b) => b.ok) && all("brightness", (b) => b.ok) ? "Sharp and well lit" : "Some photos flagged for a closer look", warn: !(all("blur", (b) => b.ok) && all("brightness", (b) => b.ok)) },
    { key: "resolution", label: "Resolution", detail: docs.every((d) => d.checks.resolution?.ok !== false) ? "Every image meets the minimum" : "Low resolution flagged", warn: docs.some((d) => d.checks.resolution?.ok === false) },
  ];
  if (client.some((c) => c.glare)) steps.push({ key: "glare", label: "Glare and reflections", detail: all("glare", (g) => g.ok) ? "No glare on your ID" : "Reflections flagged for review", warn: !all("glare", (g) => g.ok) });
  if (client.some((c) => c.fill)) steps.push({ key: "framing", label: "Document framing", detail: all("fill", (f) => f.ok) ? "Documents fill the frame" : "Framing flagged for review", warn: !all("fill", (f) => f.ok) });
  if (client.some((c) => c.mrz)) steps.push({ key: "mrz", label: "Passport machine-readable zone", detail: all("mrz", (m) => m.found) ? "Both MRZ lines found" : "MRZ flagged for review", warn: !all("mrz", (m) => m.found) });
  if (docs.some((d) => d.kind === "proof_of_address" || d.kind === "company_address")) steps.push({ key: "poa", label: "Proof of address date", detail: "Issued within the last 3 months" });
  if (client.some((c) => c.face)) steps.push({ key: "face", label: "Face in selfie", detail: all("face", (f) => f.found) ? "Face detected" : "Selfie flagged for review", warn: !all("face", (f) => f.found) });
  steps.push({ key: "send", label: "Sending to our verification team", detail: "Encrypted end to end" });
  return steps;
}

export function CheckingSequence({ steps, serverDone, onFinish }: { steps: CheckStep[]; serverDone: boolean; onFinish: () => void }) {
  const [n, setN] = React.useState(0);
  const last = steps.length - 1;
  React.useEffect(() => {
    if (n < last) {
      const t = setTimeout(() => setN((x) => x + 1), 520);
      return () => clearTimeout(t);
    }
    if (n === last && serverDone) {
      const t = setTimeout(() => setN(last + 1), 450);
      return () => clearTimeout(t);
    }
  }, [n, last, serverDone]);
  React.useEffect(() => {
    if (n > last) {
      const t = setTimeout(onFinish, 500);
      return () => clearTimeout(t);
    }
  }, [n, last, onFinish]);
  return (
    <div className="mx-auto max-w-lg py-6" data-testid="checking">
      <div className="text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full border border-ember/30 bg-ember-soft text-ember">
          <FileSearch className="size-6" />
        </span>
        <h3 className="mt-4 text-xl font-medium tracking-tight">Checking your documents…</h3>
        <p className="mt-1 text-[13px] text-fg-3">This takes a few seconds. Please keep this page open.</p>
      </div>
      <ul className="mt-6 space-y-2">
        {steps.map((s, i) => {
          const done = i < n;
          const active = i === n;
          return (
            <motion.li
              key={s.key}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: i <= n ? 1 : 0.45, y: 0 }}
              transition={{ duration: 0.2, delay: i * 0.03 }}
              className={cn("k-row flex items-center gap-3 px-4 py-3", active && "border-ember/40")}
              data-step={s.key}
              data-done={done}
            >
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full border text-[11px] transition-colors",
                  done ? (s.warn ? "border-warn/40 bg-warn-soft text-warn" : "border-up/40 bg-up-soft text-up") : active ? "border-ember/50 text-ember" : "border-line text-fg-3",
                )}
              >
                {done ? s.warn ? <AlertTriangle className="size-3.5" /> : <Check className="size-3.5" strokeWidth={2.5} /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-medium">{s.label}</span>
                <span className="block truncate text-[12px] text-fg-3">{done ? s.detail : active ? "Checking…" : "Waiting"}</span>
              </span>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Live status tracker                                                  */
/* ------------------------------------------------------------------ */

type Stage = { key: string; icon: React.ReactNode; title: string; text: string; state: "done" | "current" | "todo" | "failed" | "action" };

function stages(s: KycState): Stage[] {
  const c = s.case!;
  const typical = hoursLabel(s.review.typical_hours);
  const reviewing = c.status === "in_review";
  const decided = c.status === "approved" || c.status === "rejected";
  const firstSubmit = s.timeline.find((e) => e.kind === "submitted")?.at ?? c.submitted_at;
  return [
    { key: "submitted", icon: <Check />, title: "Documents submitted", text: fmt(firstSubmit) + (c.submissions > 1 ? ` · resubmitted ${fmt(c.submitted_at)}` : ""), state: "done" },
    { key: "auto", icon: <ShieldCheck />, title: "Automatic checks", text: "Format, quality and dates passed", state: "done" },
    {
      key: "review",
      icon: <UserCheck />,
      title: "Review by our verification team",
      text: decided ? `Completed ${fmt(c.decided_at)}` : c.status === "more_info" ? "Waiting for your documents" : reviewing ? `In review since ${fmt(c.review_started_at)}` : `Usually within ${typical}`,
      state: decided ? "done" : c.status === "more_info" ? "action" : "current",
    },
    {
      key: "decision",
      icon: c.status === "rejected" ? <X /> : <BadgeCheck />,
      title: c.status === "approved" ? "Identity verified" : c.status === "rejected" ? "Not approved" : "Decision",
      text: c.status === "approved" ? "Withdrawals are unlocked" : c.status === "rejected" ? (c.decision?.label ?? "See the reason above") : "We'll email you the result",
      state: c.status === "approved" ? "done" : c.status === "rejected" ? "failed" : "todo",
    },
  ];
}

const STAGE_TONE: Record<Stage["state"], string> = {
  done: "border-up/40 bg-up-soft text-up",
  current: "border-ember/50 bg-ember-soft text-ember",
  action: "border-warn/50 bg-warn-soft text-warn",
  failed: "border-down/40 bg-down-soft text-down",
  todo: "border-line text-fg-3",
};

function eventLabel(e: TimelineEvent) {
  switch (e.kind) {
    case "started":
      return "Verification started";
    case "submitted":
      return "Documents submitted";
    case "resubmitted":
      return "Requested documents submitted";
    case "review_started":
      return "Review started";
    case "more_info_requested":
      return "More information requested";
    case "approved":
      return "Identity verified";
    case "rejected":
      return "Verification not approved";
    default:
      return e.kind.replace(/_/g, " ");
  }
}

export function StatusTracker({ state, justSubmitted, onRestart }: { state: KycState; justSubmitted?: boolean; onRestart?: () => void }) {
  const c = state.case!;
  const typical = hoursLabel(state.review.typical_hours);
  const head =
    c.status === "approved"
      ? { icon: <BadgeCheck className="size-7" />, tone: "border-up/30 bg-up-soft text-up", title: "You're verified", text: "Your identity is confirmed. Withdrawals, partner payouts and higher limits are unlocked." }
      : c.status === "rejected"
        ? { icon: <AlertTriangle className="size-7" />, tone: "border-down/30 bg-down-soft text-down", title: "We couldn't verify your identity", text: c.decision?.label ? `${c.decision.label}.` : "Your documents could not be approved." }
        : c.status === "in_review"
          ? { icon: <UserCheck className="size-7" />, tone: "border-ember/30 bg-ember-soft text-ember", title: "Your documents are being reviewed", text: `A member of our verification team is looking at your documents now. Most reviews finish within ${typical}.` }
          : { icon: <Clock className="size-7" />, tone: "border-ember/30 bg-ember-soft text-ember", title: justSubmitted ? `Submitted: usually reviewed within ${typical}` : `In the queue: usually reviewed within ${typical}`, text: "Your documents passed our automatic checks and are with our verification team. You can keep trading and depositing meanwhile." };
  return (
    <div data-testid="tracker" data-status={c.status}>
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <span className={cn("grid size-14 shrink-0 place-items-center rounded-full border", head.tone)}>{head.icon}</span>
        <div className="min-w-0">
          <h3 className="text-xl font-medium tracking-tight">{head.title}</h3>
          <p className="mt-1 text-[13.5px] text-fg-2">{head.text}</p>
        </div>
      </div>

      {c.status === "rejected" && c.decision?.message && (
        <div className="mt-4 rounded-[14px] border border-line border-l-[3px] border-l-gold bg-surface-2 px-4 py-3 text-[13px] text-fg-2">
          <div className="mb-0.5 text-[11px] font-medium uppercase tracking-wider text-fg-3">Note from our team</div>
          {c.decision.message}
        </div>
      )}

      <ol className="mt-6 space-y-0" aria-label="Verification progress">
        {stages(state).map((s, i, all) => (
          <li key={s.key} className="relative flex gap-4 pb-5 last:pb-0" data-stage={s.key} data-state={s.state}>
            {i < all.length - 1 && <span className={cn("absolute left-[17px] top-9 h-[calc(100%-28px)] w-px", s.state === "done" ? "bg-up/40" : "bg-line")} />}
            <span className={cn("relative grid size-9 shrink-0 place-items-center rounded-full border [&_svg]:size-4", STAGE_TONE[s.state])}>{s.state === "done" ? <Check strokeWidth={2.5} /> : s.icon}</span>
            <div className="min-w-0 pt-1.5">
              <div className="flex flex-wrap items-center gap-2 text-[14px] font-medium">
                {s.title}
                {s.state === "current" && (
                  <Chip size="sm" tone="ember" dot>
                    In progress
                  </Chip>
                )}
              </div>
              <div className="mt-0.5 text-[12.5px] text-fg-3">{s.text}</div>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-line bg-surface-2 px-4 py-3 text-[12.5px] text-fg-3">
        <span className="inline-flex items-center gap-2">
          <Mail className="size-4" />{" "}
          {c.status === "approved" || c.status === "rejected" ? `We emailed the decision to ${state.profile.email}.` : `We'll email ${state.profile.email} when there's a decision.`}
        </span>
        <span className="font-mono">{c.reference}</span>
      </div>

      {c.status === "rejected" && state.can_start && onRestart && (
        <div className="mt-5 flex justify-end">
          <Button variant="ember" onClick={onRestart}>
            <RotateCcw /> Start again
          </Button>
        </div>
      )}
      {c.status === "approved" && (
        <div className="mt-4 flex items-center gap-2 text-[12.5px] text-fg-3">
          <Lock className="size-3.5" /> Your name and date of birth are now locked to your verified documents.
        </div>
      )}

      {state.timeline.length > 1 && (
        <details className="mt-5 text-[12.5px]">
          <summary className="cursor-pointer text-fg-3 hover:text-fg">Activity</summary>
          <ul className="mt-2 space-y-1.5">
            {state.timeline
              .slice()
              .reverse()
              .map((e) => (
                <li key={e.id} className="flex justify-between gap-3 text-fg-2">
                  <span>{eventLabel(e)}</span>
                  <span className="shrink-0 text-fg-3">{fmt(e.at)}</span>
                </li>
              ))}
          </ul>
        </details>
      )}
    </div>
  );
}
