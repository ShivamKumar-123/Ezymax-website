"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Bell, Clock, GitBranch, Mail, Pause, Play, Plus, RefreshCw, Send, Trash2, Users, Workflow } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, DataTable, IconButton, KpiCard, PageHeader, Reveal, Tabs, cn, type ChipTone, type Column } from "@ezymex/ui";
import { FilterSelect, Pager, TableSkeleton, qs, useApi, when } from "@/components/live/kit";
import { M, mkSend } from "./api";
import { AreaF, ClientCell, EmptyNote, FormDialog, FormSection, MkError, NumF, ReadOnlyNote, SelectF, TextF, Tile, int, useAction, usePerms } from "./kit";

/* ------------------------------------------------------------------ */
/* Types (services/growth/src/journeys.rs)                              */
/* ------------------------------------------------------------------ */

type TriggerKind = "signed_up" | "email_verified" | "kyc_approved" | "first_deposit" | "no_deposit" | "inactive" | "account_opened" | "first_trade" | "birthday";
type Trigger = { kind: TriggerKind; days?: number };
type WaitUnit = "minutes" | "hours" | "days";
type Step =
  | { kind: "wait"; id: string; amount: number; unit: WaitUnit }
  | { kind: "email"; id: string; subject: string; preheader: string; heading: string; body: string; buttonLabel: string; buttonUrl: string }
  | { kind: "inapp"; id: string; title: string; body: string; link: string }
  | { kind: "condition"; id: string; check: string; expect: boolean };
type JStatus = "draft" | "live" | "paused" | "archived";
type Stats = { enrolled: number; active: number; completed: number; exited: number; failed: number; emails: number; inapp: number; suppressed: number; lastEnrolledAt?: string | null };
type Journey = { id: number; name: string; description: string; trigger: Trigger; steps: Step[]; status: JStatus; liveSince: string | null; createdBy: string; updatedBy: string | null; createdAt: string; updatedAt: string; stats: Stats };
type StepStat = { stepId: string; kind: Step["kind"]; counts: Record<string, number>; pending: number };
type Enrollment = {
  id: number;
  userId: number;
  name: string;
  email: string;
  status: "active" | "completed" | "exited" | "failed";
  stepIndex: number;
  stepCount: number;
  currentStep: { id: string; kind: Step["kind"] } | null;
  nextRunAt: string;
  triggerAt: string;
  enrolledAt: string;
  finishedAt: string | null;
  lastError: string | null;
  lastEvent: { kind: string; detail: string; step_id: string | null; at: string } | null;
};
type JEvent = { id: number; enrollmentId: number; userId: number; name: string; stepId: string | null; kind: string; detail: string; at: string };

const TRIGGERS: { value: TriggerKind; label: string; days?: boolean; hint: string }[] = [
  { value: "signed_up", label: "Signed up", hint: "When a client creates an account" },
  { value: "email_verified", label: "Email verified", hint: "When the client confirms their email address" },
  { value: "kyc_approved", label: "KYC approved", hint: "When identity verification is approved" },
  { value: "first_deposit", label: "First deposit", hint: "When the first real-money deposit lands" },
  { value: "no_deposit", label: "No deposit after N days", days: true, hint: "N days after sign-up with no deposit yet" },
  { value: "inactive", label: "Inactive for N days", days: true, hint: "N days after the last sign-in (again after each new sign-in)" },
  { value: "account_opened", label: "Live account opened", hint: "When the first live trading account is opened" },
  { value: "first_trade", label: "First trade", hint: "When the first live trade closes" },
  { value: "birthday", label: "Birthday", hint: "On the client's birthday (UTC), once a year" },
];
const CHECKS: { value: string; label: string }[] = [
  { value: "has_deposit", label: "Has deposited" },
  { value: "kyc_approved", label: "KYC approved" },
  { value: "email_verified", label: "Email verified" },
  { value: "has_live_account", label: "Has a live account" },
  { value: "has_traded", label: "Has traded" },
  { value: "marketing_consent", label: "Allows marketing emails" },
];
const J_STATUS: Record<JStatus, { label: string; tone: ChipTone }> = { draft: { label: "Draft", tone: "neutral" }, live: { label: "Live", tone: "up" }, paused: { label: "Paused", tone: "warn" }, archived: { label: "Archived", tone: "neutral" } };
const E_STATUS: Record<Enrollment["status"], { label: string; tone: ChipTone }> = { active: { label: "In journey", tone: "info" }, completed: { label: "Completed", tone: "up" }, exited: { label: "Exited", tone: "neutral" }, failed: { label: "Failed", tone: "down" } };
const EVENT: Record<string, { label: string; tone: ChipTone }> = {
  enrolled: { label: "Enrolled", tone: "info" },
  waiting: { label: "Waiting", tone: "neutral" },
  email_sent: { label: "Email sent", tone: "up" },
  email_logged: { label: "Email logged", tone: "up" },
  email_suppressed: { label: "Email suppressed", tone: "warn" },
  inapp_sent: { label: "In-app sent", tone: "up" },
  condition_met: { label: "Condition met", tone: "neutral" },
  condition_not_met: { label: "Condition not met", tone: "warn" },
  completed: { label: "Completed", tone: "up" },
  exited: { label: "Exited", tone: "neutral" },
  failed: { label: "Failed", tone: "down" },
  error: { label: "Retrying", tone: "down" },
};

const triggerLabel = (t: Trigger) => {
  const d = TRIGGERS.find((x) => x.value === t.kind);
  if (!d) return t.kind;
  return d.days ? d.label.replace("N", String(t.days ?? "N")) : d.label;
};
const unitShort: Record<WaitUnit, string> = { minutes: "min", hours: "h", days: "d" };
const stepLabel = (s: Step) =>
  s.kind === "wait" ? `Wait ${s.amount}${unitShort[s.unit]}` : s.kind === "email" ? "Email" : s.kind === "inapp" ? "In-app" : `If ${s.expect ? "" : "not "}${CHECKS.find((c) => c.value === s.check)?.label.toLowerCase() ?? s.check}`;
const STEP_ICON = { wait: Clock, email: Mail, inapp: Bell, condition: GitBranch } as const;

function Pill({ map, status }: { map: Record<string, { label: string; tone: ChipTone }>; status: string }) {
  const s = map[status] ?? { label: status, tone: "neutral" as ChipTone };
  return (
    <Chip size="sm" dot tone={s.tone}>
      {s.label}
    </Chip>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export function LiveJourneys() {
  const perms = usePerms();
  const act = useAction();
  const list = useApi<{ items: Journey[]; archived: number }>(M("journeys"), { refreshMs: 30_000 });
  const [sel, setSel] = React.useState<number | null>(null);
  const [edit, setEdit] = React.useState<Journey | "new" | null>(null);
  const [running, setRunning] = React.useState(false);
  const items = list.data?.items ?? [];
  React.useEffect(() => {
    if (sel === null && items.length) setSel(items[0]!.id);
  }, [items, sel]);
  const live = items.filter((j) => j.status === "live");
  const sum = (k: keyof Stats) => items.reduce((s, j) => s + (Number(j.stats[k]) || 0), 0);

  const runNow = async () => {
    setRunning(true);
    const r = await mkSend<{ result: { facts: number; enrolled: number; processed: number } }>("run/journeys", {});
    setRunning(false);
    if (!r.ok) return toast.error("Run failed", { description: r.error.message });
    const x = r.data.result ?? (r.data as unknown as { facts: number; enrolled: number; processed: number });
    toast.success("Journeys processed", { description: `${int(x.enrolled)} enrolled · ${int(x.processed)} steps run` });
    list.reload();
    setTick((n) => n + 1);
  };
  const [tick, setTick] = React.useState(0);

  const switchTo = (j: Journey, status: JStatus) =>
    act.ask({
      title: status === "live" ? (j.status === "paused" ? `Resume ${j.name}` : `Launch ${j.name}`) : status === "paused" ? `Pause ${j.name}` : `Archive ${j.name}`,
      description:
        status === "live"
          ? j.status === "paused"
            ? "Clients carry on from the step they were on. Triggers that fired while paused enrol now."
            : "Clients whose trigger fires from now on are enrolled. Nobody from before is mailed."
          : status === "paused"
            ? "Nobody moves to the next step and nobody new is enrolled until you resume."
            : "Everyone still in the journey exits. Archived journeys can't be edited or relaunched.",
      confirmLabel: status === "live" ? (j.status === "paused" ? "Resume" : "Launch") : status === "paused" ? "Pause" : "Archive",
      confirmVariant: status === "archived" ? "sell" : status === "paused" ? "surface" : "ember",
      confirmTestId: "journey-status-confirm",
      note: "none",
      run: () => mkSend(`journeys/${j.id}/status`, { status }),
      success: status === "live" ? `${j.name} is live` : status === "paused" ? `${j.name} paused` : `${j.name} archived`,
      onDone: () => (list.reload(), setTick((n) => n + 1)),
    });

  const cols: Column<Journey>[] = [
    {
      key: "name",
      header: "Journey",
      cell: (j) => (
        <div className="min-w-0 max-w-64">
          <div className="truncate text-[13px] font-medium text-fg">{j.name}</div>
          <div className="truncate text-[11.5px] text-fg-3">{j.steps.map(stepLabel).join(" → ")}</div>
        </div>
      ),
      sort: (j) => j.name,
      csv: (j) => j.name,
    },
    { key: "tr", header: "Trigger", cell: (j) => <span className="whitespace-nowrap text-[12.5px] text-fg-2">{triggerLabel(j.trigger)}</span>, csv: (j) => triggerLabel(j.trigger) },
    { key: "en", header: "Enrolled", align: "right", cell: (j) => <span className="k-num">{int(j.stats.enrolled)}</span>, sort: (j) => j.stats.enrolled, csv: (j) => j.stats.enrolled },
    { key: "ac", header: "In journey", align: "right", hideOn: "md", cell: (j) => <span className="k-num">{int(j.stats.active)}</span>, sort: (j) => j.stats.active, csv: (j) => j.stats.active },
    { key: "co", header: "Completed", align: "right", hideOn: "md", cell: (j) => <span className="k-num">{int(j.stats.completed)}</span>, sort: (j) => j.stats.completed, csv: (j) => j.stats.completed },
    { key: "ms", header: "Sent", align: "right", hideOn: "lg", cell: (j) => <span className="k-num text-fg-2">{int(j.stats.emails)} email · {int(j.stats.inapp)} in-app</span>, csv: (j) => j.stats.emails + j.stats.inapp },
    { key: "st", header: "Status", cell: (j) => <Pill map={J_STATUS} status={j.status} />, sort: (j) => j.status, csv: (j) => j.status },
    ...(perms.write
      ? [
          {
            key: "x",
            header: "",
            align: "right" as const,
            cell: (j: Journey) =>
              j.status === "live" ? (
                <Button size="xs" variant="surface" onClick={(e) => (e.stopPropagation(), switchTo(j, "paused"))}>
                  <Pause /> Pause
                </Button>
              ) : (
                <Button size="xs" variant={j.status === "draft" ? "ember" : "surface"} data-testid={`journey-launch-${j.id}`} onClick={(e) => (e.stopPropagation(), switchTo(j, "live"))}>
                  <Play /> {j.status === "paused" ? "Resume" : "Launch"}
                </Button>
              ),
          },
        ]
      : []),
  ];

  const selected = items.find((j) => j.id === sel) ?? null;

  return (
    <div className="pb-16">
      <PageHeader
        title="Automation"
        subtitle="Trigger-based journeys: branded emails and in-app messages from sign-up to first trade."
        actions={
          <>
            {perms.loaded && !perms.write && <ReadOnlyNote what="edit journeys" />}
            <Button variant="surface" onClick={() => (list.reload(), setTick((n) => n + 1))}>
              <RefreshCw /> Refresh
            </Button>
            {perms.write && (
              <Button variant="surface" onClick={runNow} disabled={running} data-testid="journeys-run">
                <Play /> {running ? "Running…" : "Run now"}
              </Button>
            )}
            {perms.write && (
              <Button variant="ember" onClick={() => setEdit("new")} data-testid="new-journey">
                <Plus /> New journey
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Live journeys" icon={<Workflow />} value={<span className="k-num">{list.data ? int(live.length) : "—"}</span>} chip={list.data ? `${items.length} total` : "Loading"} />
        <KpiCard label="Clients in a journey" icon={<Users />} value={<span className="k-num">{list.data ? int(sum("active")) : "—"}</span>} chip={`${int(sum("enrolled"))} enrolled all time`} delay={0.05} />
        <KpiCard label="Messages sent" icon={<Send />} value={<span className="k-num">{list.data ? int(sum("emails") + sum("inapp")) : "—"}</span>} chip={`${int(sum("suppressed"))} suppressed (unsubscribed)`} chipTone="gold" delay={0.1} />
        <KpiCard label="Completed" icon={<Workflow />} value={<span className="k-num">{list.data ? int(sum("completed")) : "—"}</span>} chip={`${int(sum("exited"))} exited on a condition`} chipTone="up" delay={0.15} />
      </div>

      <Reveal delay={0.05} className="mt-4">
        <Card>
          <CardHeader title="Journeys" subtitle="Select a journey to see its steps, enrolments and event log" />
          <div className="mt-4 px-4 pb-5 sm:px-6">
            {list.error && !list.data ? (
              <MkError error={list.error} onRetry={list.reload} />
            ) : !list.data ? (
              <TableSkeleton />
            ) : (
              <DataTable
                columns={cols}
                rows={items}
                pageSize={15}
                dense
                rowKey={(j) => String(j.id)}
                onRowClick={(j) => setSel(j.id)}
                search={(j) => `${j.name} ${triggerLabel(j.trigger)}`}
                searchPlaceholder="Search journeys…"
                exportName="journeys"
                empty={
                  <EmptyNote
                    className="mt-3"
                    title="No journeys yet"
                    text="Create a journey: pick a trigger such as Signed up or No deposit after 3 days, then add emails, in-app messages, waits and conditions."
                    action={perms.write ? <Button size="sm" variant="ember" onClick={() => setEdit("new")}><Plus /> New journey</Button> : undefined}
                  />
                }
              />
            )}
          </div>
        </Card>
      </Reveal>

      {selected && (
        <Reveal delay={0.08} className="mt-4">
          <JourneyDetail key={selected.id} j={selected} canWrite={perms.write} tick={tick} onEdit={() => setEdit(selected)} onStatus={(s) => switchTo(selected, s)} />
        </Reveal>
      )}

      <JourneyEditor
        open={edit !== null}
        journey={edit === "new" ? null : edit}
        onOpenChange={(o) => !o && setEdit(null)}
        onSaved={(j) => (list.reload(), setSel(j.id), setTick((n) => n + 1))}
      />
      {act.node}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Detail: steps with stats, enrolments, event log                      */
/* ------------------------------------------------------------------ */

function JourneyDetail({ j, canWrite, tick, onEdit, onStatus }: { j: Journey; canWrite: boolean; tick: number; onEdit: () => void; onStatus: (s: JStatus) => void }) {
  const d = useApi<{ journey: Journey & { stepStats: StepStat[] } }>(M(`journeys/${j.id}`), { refreshMs: 20_000 });
  const [tab, setTab] = React.useState<"enrolments" | "events">("enrolments");
  const [testing, setTesting] = React.useState(false);
  React.useEffect(() => {
    if (tick) d.reload();
  }, [tick, d.reload]); // eslint-disable-line react-hooks/exhaustive-deps
  const stats = d.data?.journey.stepStats ?? [];
  const s = d.data?.journey.stats ?? j.stats;

  const test = async () => {
    setTesting(true);
    const r = await mkSend<{ results: { stepId: string; kind: string; status: string; to?: string }[] }>(`journeys/${j.id}/test`, {});
    setTesting(false);
    if (!r.ok) return toast.error("Test not sent", { description: r.error.message });
    const emails = r.data.results.filter((x) => x.kind === "email");
    const inapp = r.data.results.filter((x) => x.kind === "inapp");
    toast.success("Test sent to you", {
      description: [emails.length ? `${emails.length} email${emails.length > 1 ? "s" : ""} to ${emails[0]?.to ?? "your address"} (${emails[0]?.status})` : "", inapp.length ? `${inapp.length} in-app to your bell` : ""].filter(Boolean).join(" · "),
    });
  };

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3 px-6 pt-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[17px] font-medium tracking-tight" data-testid="journey-title">{j.name}</h3>
            <Pill map={J_STATUS} status={j.status} />
          </div>
          <p className="mt-0.5 text-[12.5px] text-fg-3">
            {triggerLabel(j.trigger)}
            {j.liveSince ? ` · live since ${when(j.liveSince)}` : ""} · updated {when(j.updatedAt)} by {j.updatedBy ?? j.createdBy}
          </p>
          {j.description && <p className="mt-1 max-w-2xl text-[13px] text-fg-2">{j.description}</p>}
        </div>
        {canWrite && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="surface" onClick={test} disabled={testing} data-testid="journey-test">
              <Send /> {testing ? "Sending…" : "Test send to me"}
            </Button>
            <Button size="sm" variant="surface" onClick={onEdit} data-testid="journey-edit">
              Edit
            </Button>
            {j.status === "live" ? (
              <Button size="sm" variant="surface" onClick={() => onStatus("paused")}>
                <Pause /> Pause
              </Button>
            ) : (
              <Button size="sm" variant="ember" onClick={() => onStatus("live")}>
                <Play /> {j.status === "paused" ? "Resume" : "Launch"}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => onStatus("archived")}>
              Archive
            </Button>
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 px-6 sm:grid-cols-3 lg:grid-cols-6">
        <Tile label="Enrolled" value={int(s.enrolled)} />
        <Tile label="In journey" value={int(s.active)} />
        <Tile label="Completed" value={int(s.completed)} tone="up" />
        <Tile label="Exited" value={int(s.exited)} />
        <Tile label="Failed" value={int(s.failed)} tone={s.failed ? "down" : undefined} />
        <Tile label="Suppressed emails" value={int(s.suppressed)} sub="Unsubscribed clients" tone={s.suppressed ? "warn" : undefined} />
      </div>

      <div className="mt-5 px-6">
        <div className="k-label mb-2.5">Steps</div>
        <ol className="space-y-2" data-testid="journey-steps">
          <li className="k-row flex items-center gap-3 px-3.5 py-2.5">
            <span className="grid size-7 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-fg-2">
              <Play className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium">Trigger: {triggerLabel(j.trigger)}</div>
              <div className="text-[11.5px] text-fg-3">{TRIGGERS.find((t) => t.value === j.trigger.kind)?.hint}</div>
            </div>
            <span className="k-num text-[12px] text-fg-2">{int(s.enrolled)} enrolled</span>
          </li>
          {j.steps.map((st, i) => {
            const Icon = STEP_ICON[st.kind];
            const x = stats.find((y) => y.stepId === st.id);
            const c = x?.counts ?? {};
            const out =
              st.kind === "email"
                ? `${int((c.email_sent ?? 0) + (c.email_logged ?? 0))} sent${c.email_suppressed ? ` · ${int(c.email_suppressed)} suppressed` : ""}`
                : st.kind === "inapp"
                  ? `${int(c.inapp_sent ?? 0)} sent`
                  : st.kind === "condition"
                    ? `${int(c.condition_met ?? 0)} passed · ${int(c.condition_not_met ?? 0)} exited`
                    : `${int(c.waiting ?? 0)} waited`;
            return (
              <li key={st.id} className="k-row flex items-center gap-3 px-3.5 py-2.5">
                <span className="grid size-7 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-fg-2">
                  <Icon className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[13px] font-medium">
                    <span className="k-num text-fg-3">{i + 1}.</span> {stepLabel(st)}
                    {c.error ? <Chip size="sm" tone="down">{int(c.error)} retries</Chip> : null}
                  </div>
                  <div className="truncate text-[11.5px] text-fg-3">
                    {st.kind === "email" ? st.subject : st.kind === "inapp" ? st.title : st.kind === "condition" ? "Clients who don't match exit the journey" : "Parks the client, then carries on"}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="k-num text-[12px] text-fg-2">{out}</div>
                  {x && x.pending > 0 && <div className="k-num text-[11px] text-fg-3">{int(x.pending)} due here</div>}
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="mt-5 px-6">
        <Tabs
          tabs={[
            { value: "enrolments", label: "Enrolments", count: s.enrolled },
            { value: "events", label: "Event log" },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>
      <div className="px-4 pb-5 pt-4 sm:px-6">{tab === "enrolments" ? <Enrolments j={j} tick={tick} /> : <Events j={j} tick={tick} />}</div>
    </Card>
  );
}

const PER = 25;

function Enrolments({ j, tick }: { j: Journey; tick: number }) {
  const [status, setStatus] = React.useState("all");
  const [page, setPage] = React.useState(1);
  React.useEffect(() => setPage(1), [status]);
  const { data, error, loading, reload } = useApi<{ items: Enrollment[]; total: number }>(`${M(`journeys/${j.id}/enrollments`)}${qs({ status, page, limit: PER })}`, { refreshMs: 20_000 });
  React.useEffect(() => {
    if (tick) reload();
  }, [tick, reload]);
  const cols: Column<Enrollment>[] = [
    { key: "c", header: "Client", cell: (r) => <ClientCell id={r.userId} name={r.name} sub={r.email} />, csv: (r) => `${r.userId} ${r.email}` },
    { key: "st", header: "Status", cell: (r) => <Pill map={E_STATUS} status={r.status} />, csv: (r) => r.status },
    {
      key: "step",
      header: "Step",
      cell: (r) => (
        <span className="k-num whitespace-nowrap text-[12.5px] text-fg-2">
          {r.status === "active" ? `${Math.min(r.stepIndex + 1, r.stepCount)} of ${r.stepCount}` : "—"}
          {r.status === "active" && r.currentStep ? ` · ${r.currentStep.kind === "inapp" ? "in-app" : r.currentStep.kind}` : ""}
        </span>
      ),
      csv: (r) => r.stepIndex,
    },
    { key: "next", header: "Next run", hideOn: "md", cell: (r) => <span className="k-num whitespace-nowrap text-[12.5px] text-fg-2">{r.status === "active" ? when(r.nextRunAt) : "—"}</span>, csv: (r) => r.nextRunAt },
    {
      key: "last",
      header: "Last event",
      cell: (r) =>
        r.lastEvent ? (
          <span className="flex min-w-0 items-center gap-2">
            <Pill map={EVENT} status={r.lastEvent.kind} />
            <span className="max-w-48 truncate text-[11.5px] text-fg-3" title={r.lastError ?? r.lastEvent.detail}>{r.lastError ?? r.lastEvent.detail}</span>
          </span>
        ) : (
          <span className="text-fg-3">—</span>
        ),
      csv: (r) => r.lastEvent?.kind ?? "",
    },
    { key: "en", header: "Enrolled", hideOn: "lg", cell: (r) => <span className="k-num whitespace-nowrap text-[12.5px] text-fg-2">{when(r.enrolledAt)}</span>, sort: (r) => r.enrolledAt, csv: (r) => r.enrolledAt },
  ];
  if (error && !data) return <MkError error={error} onRetry={reload} />;
  if (!data) return <TableSkeleton />;
  return (
    <div className={loading ? "opacity-60 transition-opacity" : undefined} data-testid="journey-enrolments">
      <DataTable
        columns={cols}
        rows={data.items}
        pageSize={PER}
        dense
        rowKey={(r) => String(r.id)}
        exportName={`journey-${j.id}-enrolments`}
        toolbar={
          <FilterSelect
            label="Status"
            value={status}
            onChange={setStatus}
            options={[{ value: "all", label: "All" }, { value: "active", label: "In journey" }, { value: "completed", label: "Completed" }, { value: "exited", label: "Exited" }, { value: "failed", label: "Failed" }]}
          />
        }
        empty={<EmptyNote className="mt-3" title="Nobody enrolled yet" text={j.status === "live" ? "Clients enrol as soon as their trigger fires." : "Launch the journey to start enrolling clients."} />}
      />
      <Pager page={page} perPage={PER} total={data.total} onPage={setPage} />
    </div>
  );
}

function Events({ j, tick }: { j: Journey; tick: number }) {
  const [page, setPage] = React.useState(1);
  const { data, error, loading, reload } = useApi<{ items: JEvent[]; total: number }>(`${M(`journeys/${j.id}/events`)}${qs({ page, limit: 50 })}`, { refreshMs: 20_000 });
  React.useEffect(() => {
    if (tick) reload();
  }, [tick, reload]);
  const stepName = (id: string | null) => {
    if (!id) return "Journey";
    const i = j.steps.findIndex((s) => s.id === id);
    return i < 0 ? "Removed step" : `${i + 1}. ${stepLabel(j.steps[i]!)}`;
  };
  const cols: Column<JEvent>[] = [
    { key: "at", header: "Time", cell: (r) => <span className="k-num whitespace-nowrap text-[12.5px] text-fg-2">{when(r.at, true)}</span>, csv: (r) => r.at },
    { key: "c", header: "Client", cell: (r) => <ClientCell id={r.userId} name={r.name} />, csv: (r) => r.userId },
    { key: "s", header: "Step", cell: (r) => <span className="whitespace-nowrap text-[12.5px] text-fg-2">{stepName(r.stepId)}</span>, csv: (r) => r.stepId ?? "" },
    { key: "k", header: "Event", cell: (r) => <Pill map={EVENT} status={r.kind} />, csv: (r) => r.kind },
    { key: "d", header: "Detail", hideOn: "md", cell: (r) => <span className="block max-w-72 truncate text-[12px] text-fg-3" title={r.detail}>{r.detail || "—"}</span>, csv: (r) => r.detail },
  ];
  if (error && !data) return <MkError error={error} onRetry={reload} />;
  if (!data) return <TableSkeleton />;
  return (
    <div className={loading ? "opacity-60 transition-opacity" : undefined} data-testid="journey-events">
      <DataTable columns={cols} rows={data.items} pageSize={50} dense rowKey={(r) => String(r.id)} exportName={`journey-${j.id}-events`} empty={<EmptyNote className="mt-3" title="No events yet" />} />
      <Pager page={page} perPage={50} total={data.total} onPage={setPage} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Editor                                                               */
/* ------------------------------------------------------------------ */

let seq = 0;
const newId = () => `n${Date.now().toString(36)}${(seq++).toString(36)}`;
const blank = (kind: Step["kind"]): Step =>
  kind === "wait"
    ? { kind, id: newId(), amount: 1, unit: "days" }
    : kind === "email"
      ? { kind, id: newId(), subject: "", preheader: "", heading: "", body: "", buttonLabel: "", buttonUrl: "" }
      : kind === "inapp"
        ? { kind, id: newId(), title: "", body: "", link: "" }
        : { kind, id: newId(), check: "has_deposit", expect: false };

const TEMPLATE: Step[] = [
  { kind: "email", id: "welcome", subject: "Welcome to your new account, {{first_name}}", preheader: "Three steps to your first trade", heading: "Welcome, {{first_name}}", body: "Your account is ready. Verify your identity, fund your wallet and open a live account to start trading.\n\nOur support team is here 24/5 if you need a hand.", buttonLabel: "Fund your wallet", buttonUrl: "/wallet/deposit" },
  { kind: "wait", id: "wait1", amount: 2, unit: "days" },
  { kind: "condition", id: "nodeposit", check: "has_deposit", expect: false },
  { kind: "inapp", id: "nudge", title: "Ready to fund your account?", body: "Deposit USDT in minutes and open your first live account.", link: "/wallet/deposit" },
];

function JourneyEditor({ open, journey, onOpenChange, onSaved }: { open: boolean; journey: Journey | null; onOpenChange: (o: boolean) => void; onSaved: (j: Journey) => void }) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [trigger, setTrigger] = React.useState<TriggerKind>("signed_up");
  const [days, setDays] = React.useState("3");
  const [steps, setSteps] = React.useState<Step[]>([]);
  const [focus, setFocus] = React.useState(0);
  React.useEffect(() => {
    if (!open) return;
    setName(journey?.name ?? "");
    setDescription(journey?.description ?? "");
    setTrigger(journey?.trigger.kind ?? "signed_up");
    setDays(String(journey?.trigger.days ?? 3));
    setSteps(journey ? journey.steps.map((s) => ({ ...s })) : TEMPLATE.map((s) => ({ ...s, id: newId() })));
    setFocus(0);
  }, [open, journey]);

  const tdef = TRIGGERS.find((t) => t.value === trigger)!;
  const set = (i: number, patch: Partial<Step>) => setSteps((xs) => xs.map((s, k) => (k === i ? ({ ...s, ...patch } as Step) : s)));
  const move = (i: number, d: -1 | 1) =>
    setSteps((xs) => {
      const j = i + d;
      if (j < 0 || j >= xs.length) return xs;
      const c = [...xs];
      [c[i], c[j]] = [c[j]!, c[i]!];
      setFocus(j);
      return c;
    });
  const add = (k: Step["kind"]) => setSteps((xs) => (xs.length >= 20 ? xs : (setFocus(xs.length), [...xs, blank(k)])));
  const remove = (i: number) => setSteps((xs) => (setFocus(Math.max(0, i - 1)), xs.filter((_, k) => k !== i)));
  const preview = steps[focus] ?? steps.find((s) => s.kind === "email");

  const submit = () => {
    if (name.trim().length < 2) return "Give the journey a name.";
    if (!steps.length) return "Add at least one step.";
    if (!steps.some((s) => s.kind === "email" || s.kind === "inapp")) return "Add at least one email or in-app message.";
    if (tdef.days && !(Number(days) >= 1 && Number(days) <= 365)) return "Days must be 1–365.";
    for (const [i, s] of steps.entries()) {
      if (s.kind === "email" && (!s.subject.trim() || !s.heading.trim() || !s.body.trim())) return `Step ${i + 1}: an email needs a subject, heading and message.`;
      if (s.kind === "email" && !!s.buttonLabel.trim() !== !!s.buttonUrl.trim()) return `Step ${i + 1}: give the button both a label and a link, or neither.`;
      if (s.kind === "inapp" && !s.title.trim()) return `Step ${i + 1}: an in-app message needs a title.`;
      if (s.kind === "wait" && !(s.amount >= 1)) return `Step ${i + 1}: wait at least 1 ${s.unit.replace(/s$/, "")}.`;
    }
    const body = { name: name.trim(), description: description.trim(), trigger: { kind: trigger, ...(tdef.days ? { days: Number(days) } : {}) }, steps };
    return journey ? mkSend<{ journey: Journey }>(`journeys/${journey.id}`, body, "PATCH") : mkSend<{ journey: Journey }>("journeys", body);
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={journey ? `Edit ${journey.name}` : "New journey"}
      description={journey?.status === "live" ? "The journey is live: clients mid-journey continue from their current step number." : "Saved as a draft. Launch it when you're ready; only triggers from then on enrol."}
      width={1040}
      submitLabel={journey ? "Save changes" : "Create journey"}
      submitTestId="journey-form-submit"
      submit={submit}
      success={(d: { journey: Journey }) => `${d.journey.name} saved`}
      onDone={(d: { journey: Journey }) => onSaved(d.journey)}
      footerNote="Placeholders: {{first_name}} {{name}} {{country}} {{referral_code}}"
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-5">
          <FormSection title="Journey">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextF label="Name" value={name} onChange={setName} maxLength={80} placeholder="e.g. Welcome series" />
              <TextF label="Description" value={description} onChange={setDescription} maxLength={300} placeholder="Internal note" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
              <SelectF label="Trigger" value={trigger} onChange={setTrigger} options={TRIGGERS.map((t) => ({ value: t.value, label: t.label }))} hint={tdef.hint} />
              {tdef.days && <NumF label="Days" value={days} onChange={setDays} step={1} suffix="days" />}
            </div>
          </FormSection>

          <FormSection title="Steps" hint="Run top to bottom. A condition that doesn't match ends the journey for that client.">
            <ol className="space-y-2.5">
              {steps.map((s, i) => {
                const Icon = STEP_ICON[s.kind];
                return (
                  <li key={s.id} className={cn("rounded-[14px] border bg-surface-2 p-3", i === focus ? "border-ember/40" : "border-line")} onFocusCapture={() => setFocus(i)} onClick={() => setFocus(i)}>
                    <div className="mb-2.5 flex items-center gap-2">
                      <span className="grid size-6 place-items-center rounded-full border border-line bg-surface text-fg-2">
                        <Icon className="size-3" />
                      </span>
                      <span className="text-[12.5px] font-medium">
                        {i + 1}. {s.kind === "email" ? "Send email" : s.kind === "inapp" ? "In-app notification" : s.kind === "wait" ? "Wait" : "Condition"}
                      </span>
                      <span className="ml-auto flex items-center gap-0.5">
                        <IconButton size="sm" type="button" aria-label="Move up" title="Move up" onClick={() => move(i, -1)} disabled={i === 0}>
                          <ArrowUp />
                        </IconButton>
                        <IconButton size="sm" type="button" aria-label="Move down" title="Move down" onClick={() => move(i, 1)} disabled={i === steps.length - 1}>
                          <ArrowDown />
                        </IconButton>
                        <IconButton size="sm" type="button" aria-label="Remove step" title="Remove step" onClick={() => remove(i)}>
                          <Trash2 />
                        </IconButton>
                      </span>
                    </div>
                    {s.kind === "wait" && (
                      <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
                        <NumF label="Wait" value={String(s.amount)} onChange={(v) => set(i, { amount: Math.max(0, Math.round(Number(v) || 0)) })} step={1} />
                        <SelectF label="Unit" value={s.unit} onChange={(v) => set(i, { unit: v })} options={[{ value: "minutes", label: "Minutes" }, { value: "hours", label: "Hours" }, { value: "days", label: "Days" }]} />
                      </div>
                    )}
                    {s.kind === "email" && (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <TextF label="Subject" value={s.subject} onChange={(v) => set(i, { subject: v })} maxLength={200} />
                        <TextF label="Preview text" value={s.preheader} onChange={(v) => set(i, { preheader: v })} maxLength={200} hint="optional" />
                        <TextF className="sm:col-span-2" label="Heading" value={s.heading} onChange={(v) => set(i, { heading: v })} maxLength={200} />
                        <AreaF className="sm:col-span-2" label="Message" value={s.body} onChange={(v) => set(i, { body: v })} rows={4} hint="Blank line = new paragraph" />
                        <TextF label="Button label" value={s.buttonLabel} onChange={(v) => set(i, { buttonLabel: v })} maxLength={60} hint="optional" />
                        <TextF label="Button link" value={s.buttonUrl} onChange={(v) => set(i, { buttonUrl: v })} mono placeholder="/wallet/deposit" />
                      </div>
                    )}
                    {s.kind === "inapp" && (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <TextF className="sm:col-span-2" label="Title" value={s.title} onChange={(v) => set(i, { title: v })} maxLength={200} />
                        <TextF label="Text" value={s.body} onChange={(v) => set(i, { body: v })} maxLength={1000} />
                        <TextF label="Link" value={s.link} onChange={(v) => set(i, { link: v })} mono placeholder="/wallet/deposit" hint="optional" />
                      </div>
                    )}
                    {s.kind === "condition" && (
                      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
                        <SelectF label="Continue only if" value={s.expect ? "yes" : "no"} onChange={(v) => set(i, { expect: v === "yes" })} options={[{ value: "yes", label: "Client has" }, { value: "no", label: "Client has not" }]} />
                        <SelectF label="Check" value={s.check} onChange={(v) => set(i, { check: v })} options={CHECKS.map((c) => ({ value: c.value, label: c.label.replace(/^Has /, "").replace(/^Allows /, "allowed ") }))} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
            <div className="flex flex-wrap gap-2">
              <Button size="xs" variant="surface" onClick={() => add("email")} data-testid="add-email">
                <Mail /> Email
              </Button>
              <Button size="xs" variant="surface" onClick={() => add("inapp")} data-testid="add-inapp">
                <Bell /> In-app
              </Button>
              <Button size="xs" variant="surface" onClick={() => add("wait")}>
                <Clock /> Wait
              </Button>
              <Button size="xs" variant="surface" onClick={() => add("condition")}>
                <GitBranch /> Condition
              </Button>
            </div>
          </FormSection>
        </div>

        <div className="lg:sticky lg:top-0 lg:self-start">
          <div className="k-label mb-2.5">Preview · step {Math.min(focus + 1, steps.length)}</div>
          <StepPreview step={preview} />
          <p className="mt-3 text-[11.5px] leading-relaxed text-fg-3">
            Emails use your brand&apos;s email design with an unsubscribe link. Clients who unsubscribed are skipped for emails; in-app messages follow their News and offers setting. Transactional emails are never affected.
          </p>
        </div>
      </div>
    </FormDialog>
  );
}

const sample = (t: string) => t.replaceAll("{{first_name}}", "Alex").replaceAll("{{last_name}}", "Morgan").replaceAll("{{name}}", "Alex Morgan").replaceAll("{{country}}", "GB").replaceAll("{{referral_code}}", "ALEX4821");

function StepPreview({ step }: { step: Step | undefined }) {
  if (!step || step.kind === "wait" || step.kind === "condition")
    return <div className="rounded-[16px] border border-dashed border-line px-4 py-8 text-center text-[12.5px] text-fg-3">Select an email or in-app step to preview it.</div>;
  if (step.kind === "inapp")
    return (
      <div className="rounded-[16px] border border-line bg-surface-2 p-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-1 size-2 shrink-0 rounded-full bg-ember" />
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-fg">{sample(step.title) || "Notification title"}</div>
            {step.body && <div className="mt-0.5 text-[12px] text-fg-2">{sample(step.body)}</div>}
            <div className="mt-1 text-[11px] text-fg-3">just now{step.link ? ` · opens ${step.link}` : ""}</div>
          </div>
        </div>
      </div>
    );
  const paras = sample(step.body).split(/\n\s*\n/).filter(Boolean);
  return (
    <div className="overflow-hidden rounded-[16px] border border-line bg-[#0b0b0e] p-3 text-left">
      <div className="mb-1 truncate text-[11px] text-[#8e8e98]">
        <span className="text-[#c7c7cf]">{sample(step.subject) || "Subject"}</span>
        {step.preheader ? ` — ${sample(step.preheader)}` : ""}
      </div>
      <div className="rounded-[12px] border border-[#26262e] bg-[#141418]">
        <div className="h-[3px] bg-ember" />
        <div className="p-4">
          <div className="text-[15px] font-bold leading-snug text-[#f5f5f7]">{sample(step.heading) || "Heading"}</div>
          {paras.map((p, i) => (
            <p key={i} className="mt-2 whitespace-pre-line text-[12px] leading-relaxed text-[#c7c7cf]">
              {p}
            </p>
          ))}
          {step.buttonLabel && <div className="mt-3 inline-block rounded-[8px] bg-ember px-3 py-1.5 text-[12px] font-semibold text-white">{sample(step.buttonLabel)}</div>}
        </div>
      </div>
      <div className="mt-2 text-[10.5px] text-[#8e8e98]">You get this email because you allowed news and offers. Unsubscribe</div>
    </div>
  );
}
