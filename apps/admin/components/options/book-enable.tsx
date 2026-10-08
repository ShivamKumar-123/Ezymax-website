"use client";

/**
 * Options › Book rollout (docs/OPTIONS-EXCHANGE.md §11, decision O49): switching live or demo accounts from house
 * pricing to the order book. The dry run lists what the enable would do (halt house opens, cancel legacy pending
 * orders, start the actors and the MM and wait for quote coverage, novate open positions into the MM account, write
 * the venue row) with its blockers and warnings. The enable itself is FOUR-EYES and FORWARD-ONLY: there is no
 * switch-off; afterwards the kill switches are halt / cancel-only (Order books), MM pause and MM widen (Market maker).
 *
 *   GET  /api/trading/admin/options/book/enable/plan?kind=live|demo
 *        { kind, enabled, enabledAt?, mmCoverage: {pct, required}, steps: [{ key, label, detail, count? }],
 *          legacyPendingOrders, novation: { positions, clients, contracts, premiumUsd }, barriersStayHouse,
 *          warnings: string[], blockers: string[], pending?: { id, requestedBy, requestedAt, reason } }
 *   POST /api/trading/admin/options/book/enable {kind, reason, approvalId?}
 *        first call → { status: "pending_approval", approval: { id, requestedBy, requestedAt } }
 *        a different staff member with options.settle, with approvalId → { status: "enabled", enabledAt, report }
 *        (the same staff twice → 409/422 `four_eyes`)
 *   GET  /api/trading/admin/options/approvals?status=pending   (optional; a fallback for `pending`)
 */
import * as React from "react";
import Link from "next/link";
import { ArrowRight, CircleCheck, Gavel, Hourglass, OctagonAlert, RefreshCw, Rocket, TriangleAlert } from "lucide-react";
import { Button, Card, CardHeader, Chip, EmptyState, Field, Input, PageHeader, Progress, Reveal, Segmented, Tooltip, cn, formatNumber } from "@ezymex/ui";
import { IS_DEMO } from "@ezymex/mock/mode";
import { ErrorState, TableSkeleton, ago, useNow, when } from "@/components/live/kit";
import { useStaff } from "@/components/staff-session";
import type { Approval, EnableDone, EnablePlan, FourEyesPending } from "./types";
import { EnginePending, KIND_OPTIONS, REASONS, ReasonDialog, enginePending, isMe, kindLabel, optSend, usd, useKind, useOpt, useOptPerms } from "./kit";
import { ApproveDialog, Fact } from "./fill-bust";

type Step = NonNullable<EnablePlan["steps"]>[number];

/** §11 in order, for an engine that sends the counts but not the steps. */
function defaultSteps(p: EnablePlan): Step[] {
  return [
    { key: "halt_house_opens", label: "Halt house opens", detail: "New option opens against the house stop; closing keeps working." },
    { key: "cancel_legacy_orders", label: "Cancel legacy pending option orders", detail: "Clients are notified.", count: p.legacyPendingOrders ?? null },
    { key: "start_actors", label: "Start the book actors and the market maker", detail: "Wait for MM quote coverage." },
    { key: "novate", label: "Novate open positions to the book", detail: "Clients keep their positions and P&L; the house's opposite moves into the MM account.", count: p.novation?.positions ?? null },
    { key: "write_venue", label: "Write the venue row", detail: "From then on the book is the venue for these accounts." },
  ];
}

export function BookEnablePage() {
  const perms = useOptPerms();
  const staff = useStaff();
  const now = useNow(15_000);
  const [kind, setKind] = useKind();
  const plan = useOpt<EnablePlan>(`/api/trading/admin/options/book/enable/plan?kind=${kind}`, { refreshMs: 15_000 });
  const appr = useOpt<{ items: Approval[] }>("/api/trading/admin/options/approvals?status=pending", { refreshMs: 15_000 });
  const [enabling, setEnabling] = React.useState(false);
  const [approve, setApprove] = React.useState<Approval | null>(null);
  const pendingEngine = enginePending(plan.error);
  const p = plan.data && (plan.data.kind === kind || !plan.data.kind) ? plan.data : null;
  const fromList = (appr.data?.items ?? []).find((a) => a.action === "book_enable" && (a.kind ?? a.target) === kind) ?? null;
  const req = p?.pending ? { id: p.pending.id, requestedBy: p.pending.requestedBy, requestedAt: p.pending.requestedAt, reason: p.pending.reason } : fromList;
  const blockers = p?.blockers ?? [];
  const warnings = p?.warnings ?? [];
  const steps = p ? (p.steps?.length ? p.steps : defaultSteps(p)) : [];
  const mine = req ? isMe(req.requestedBy, staff) : false;
  const reload = () => (plan.reload(), appr.reload());
  const enableBlock = !perms.settle ? "Needs the options settlement permission" : blockers.length ? "Resolve the blockers first" : req ? "A request is already waiting for a second approver" : null;

  return (
    <div className="pb-10">
      <PageHeader
        title="Book rollout"
        subtitle="Move live or demo accounts from house pricing to the order book. A dry run first, then a four-eyes enable. Forward-only."
        actions={
          <>
            <Segmented size="sm" value={kind} onChange={setKind} options={KIND_OPTIONS} />
            {p && (
              <Chip tone={p.enabled ? "up" : req ? "warn" : "neutral"} dot>
                {p.enabled ? "On the book" : req ? "Waiting for approval" : "House pricing"}
              </Chip>
            )}
            <Button variant="surface" size="lg" onClick={reload}>
              <RefreshCw /> Refresh
            </Button>
          </>
        }
      />

      {pendingEngine ? (
        <EnginePending what="The book rollout" />
      ) : plan.error ? (
        <ErrorState error={plan.error} onRetry={plan.reload} />
      ) : !p ? (
        <Card className="px-6 py-6">
          <TableSkeleton rows={6} />
        </Card>
      ) : (
        <>
          {p.enabled ? (
            <Reveal>
              <Card className="flex flex-wrap items-center gap-4 border-up/30 px-6 py-5">
                <span className="grid size-11 place-items-center rounded-full border border-up/30 bg-up-soft text-up">
                  <CircleCheck className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[16px] font-medium">The order book is live for {kindLabel(kind)} accounts</div>
                  <div className="text-[13px] text-fg-3">{p.enabledAt ? `Enabled ${when(p.enabledAt)} (${ago(p.enabledAt, now)}). ` : ""}Forward-only: use the kill switches if something goes wrong.</div>
                </div>
                <Link href={`/options/books?kind=${kind}`}>
                  <Button variant="surface" size="sm">
                    Order books <ArrowRight />
                  </Button>
                </Link>
                <Link href={`/options/market-maker?kind=${kind}`}>
                  <Button variant="surface" size="sm">
                    Market maker <ArrowRight />
                  </Button>
                </Link>
              </Card>
            </Reveal>
          ) : (
            <Reveal>
              <ForwardOnly kind={kind} />
            </Reveal>
          )}

          {!p.enabled && req && (
            <Reveal delay={0.03} className="mt-4">
              <Card className="flex flex-wrap items-center gap-4 border-warn/40 px-6 py-5">
                <span className="grid size-11 place-items-center rounded-full border border-warn/30 bg-warn-soft text-warn">
                  <Hourglass className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-medium">Waiting for a second approver</div>
                  <div className="text-[12.5px] text-fg-3">
                    Approval <span className="font-mono">#{String(req.id)}</span> requested by <span className="text-fg-2">{req.requestedBy}</span> {ago(req.requestedAt, now)} · {req.reason}
                  </div>
                </div>
                {perms.settle &&
                  (mine && !IS_DEMO ? (
                    <Tooltip content="Four-eyes: a different staff member with settlement rights approves">
                      <span>
                        <Button variant="surface" size="sm" disabled>
                          <Gavel /> Approve
                        </Button>
                      </span>
                    </Tooltip>
                  ) : (
                    <Button variant="sell" size="sm" onClick={() => setApprove({ id: req.id, action: "book_enable", target: kind, kind, reason: req.reason, requestedBy: req.requestedBy, requestedAt: req.requestedAt })}>
                      <Gavel /> Approve as second approver{IS_DEMO && mine ? " (demo)" : ""}
                    </Button>
                  ))}
              </Card>
            </Reveal>
          )}

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
            <Reveal delay={0.05} className="xl:col-span-8">
              <Card className="h-full pb-5">
                <CardHeader
                  title={p.enabled ? "What the rollout did" : "Dry run"}
                  subtitle={p.enabled ? "The plan as it ran (read-only)." : "What enabling would do right now. Nothing changes until a second approver confirms."}
                  icon={<Rocket />}
                  action={p.enabled ? <Chip tone="up">Done</Chip> : <Chip>Dry run</Chip>}
                />
                <ol className="mt-4 space-y-2 px-4 sm:px-6">
                  {steps.map((s, i) => (
                    <StepRow key={s.key} n={i + 1} step={s} plan={p} done={p.enabled} />
                  ))}
                </ol>
              </Card>
            </Reveal>
            <Reveal delay={0.08} className="xl:col-span-4">
              <Card className="h-full pb-5">
                <CardHeader title="Checks" subtitle="Blockers stop the enable; warnings are for the approvers to read." icon={<OctagonAlert />} />
                <div className="mt-4 space-y-3 px-6">
                  {blockers.length ? (
                    <div className="space-y-1.5">
                      {blockers.map((b) => (
                        <div key={b} className="flex items-start gap-2 rounded-[12px] border border-down/40 bg-down-soft px-3 py-2 text-[12.5px]">
                          <OctagonAlert className="mt-0.5 size-3.5 shrink-0 text-down" />
                          {b}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-[12px] border border-up/30 bg-up-soft px-3 py-2 text-[12.5px]">
                      <CircleCheck className="size-3.5 text-up" /> No blockers
                    </div>
                  )}
                  {warnings.map((w) => (
                    <div key={w} className="flex items-start gap-2 rounded-[12px] border border-warn/30 bg-warn-soft px-3 py-2 text-[12.5px]">
                      <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warn" />
                      {w}
                    </div>
                  ))}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Fact label="Legacy orders" value={formatNumber(p.legacyPendingOrders ?? 0, 0)} />
                    <Fact label="Barriers stay house" value={formatNumber(p.barriersStayHouse ?? 0, 0)} />
                    <Fact label="Positions to novate" value={formatNumber(p.novation?.positions ?? 0, 0)} />
                    <Fact label="Clients" value={formatNumber(p.novation?.clients ?? 0, 0)} />
                    <Fact label="Contracts" value={formatNumber(p.novation?.contracts ?? 0, 0)} />
                    <Fact label="Premium" value={usd(p.novation?.premiumUsd ?? 0)} />
                  </div>
                  {!p.enabled && (
                    <div className="pt-2">
                      {enableBlock && <div className="mb-2 text-[12px] text-fg-3">{enableBlock}</div>}
                      <Button variant="sell" size="lg" className="w-full" disabled={!!enableBlock} onClick={() => setEnabling(true)}>
                        <Rocket /> Enable the order book · {kindLabel(kind)}
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            </Reveal>
          </div>
          {!p.enabled && !steps.length && <EmptyState title="No plan" text="The engine sent an empty plan." illustration="warning" />}
        </>
      )}

      <EnableDialog open={enabling} kind={kind} plan={p} onClose={() => setEnabling(false)} onDone={reload} />
      <ApproveDialog approval={approve} onClose={() => setApprove(null)} onDone={reload} />
    </div>
  );
}

function ForwardOnly({ kind }: { kind: string }) {
  const live = kind === "live";
  return (
    <div className="rounded-[20px] border-2 border-down/60 bg-down-soft px-6 py-5">
      <div className="flex items-start gap-3">
        <OctagonAlert className="mt-0.5 size-6 shrink-0 text-down" />
        <div className="space-y-1.5">
          <div className="text-[17px] font-semibold text-down">{live ? "Real money · forward-only" : "Forward-only"}</div>
          <div className="text-[13px] leading-relaxed text-fg">
            Enabling moves every {kindLabel(kind)} option account onto the order book{live ? ", where clients trade real money with each other and with the Ezymex market maker" : ""}. <span className="font-medium">There is no switch-off.</span>
          </div>
          <div className="text-[12.5px] leading-relaxed text-fg-2">
            Kill switches afterwards: halt or cancel-only per series, expiry, underlying or everything (Order books), pause the market maker, and widen its spreads (Market maker). Matching clients against each other may need an MTF / OTF-type licence in some jurisdictions: check per broker.
          </div>
        </div>
      </div>
    </div>
  );
}

function StepRow({ n, step, plan, done }: { n: number; step: Step; plan: EnablePlan; done: boolean }) {
  const cov = plan.mmCoverage ?? null;
  return (
    <li className="k-row flex gap-3 px-4 py-3">
      <span className={cn("grid size-7 shrink-0 place-items-center rounded-full border font-mono text-[12px]", done ? "border-up/40 bg-up-soft text-up" : "border-line bg-surface-3 text-fg-2")}>{done ? <CircleCheck className="size-3.5" /> : n}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13.5px] font-medium">{step.label}</span>
          {step.count !== null && step.count !== undefined && <Chip size="sm">{formatNumber(step.count, 0)}</Chip>}
        </div>
        {step.detail && <div className="mt-0.5 text-[12px] text-fg-3">{step.detail}</div>}
        {step.key === "cancel_legacy_orders" && plan.legacyPendingOrders !== null && plan.legacyPendingOrders !== undefined && <div className="mt-1 text-[12px] text-fg-2">{formatNumber(plan.legacyPendingOrders, 0)} pending option orders are cancelled; each client gets a notice.</div>}
        {step.key === "start_actors" && cov && (
          <div className="mt-2 max-w-md">
            <div className="mb-1 flex justify-between text-[11.5px]">
              <span className="text-fg-3">MM quote coverage {done ? "" : "(dry run)"}</span>
              <span className={cn("k-num font-mono", cov.pct >= cov.required ? "text-up" : "text-warn")}>
                {formatNumber(cov.pct, 1)}% / required {formatNumber(cov.required, 0)}%
              </span>
            </div>
            <div className="relative">
              <Progress value={cov.pct} tone={cov.pct >= cov.required ? "up" : "warn"} />
              <span className="absolute -top-0.5 h-2.5 w-px bg-fg" style={{ left: `${Math.min(100, Math.max(0, cov.required))}%` }} aria-hidden />
            </div>
            {!done && cov.pct < cov.required && <div className="mt-1 text-[11.5px] text-warn">The enable waits at this step until coverage reaches the required level.</div>}
          </div>
        )}
        {step.key === "novate" && plan.novation && (
          <div className="mt-1 text-[12px] text-fg-2">
            {formatNumber(plan.novation.positions, 0)} positions of {formatNumber(plan.novation.clients, 0)} clients · {formatNumber(plan.novation.contracts, 0)} contracts · premium {usd(plan.novation.premiumUsd)}
            {plan.barriersStayHouse ? <span className="text-fg-3"> · {formatNumber(plan.barriersStayHouse, 0)} barrier positions stay with the house (RFQ-only, Ezymex-quoted)</span> : null}
          </div>
        )}
      </div>
    </li>
  );
}

function EnableDialog({ open, kind, plan, onClose, onDone }: { open: boolean; kind: string; plan: EnablePlan | null; onClose: () => void; onDone: () => void }) {
  const [typed, setTyped] = React.useState("");
  React.useEffect(() => {
    if (!open) setTyped("");
  }, [open]);
  const phrase = `ENABLE ${kind.toUpperCase()}`;
  const blocked = plan?.blockers?.length ? "Resolve the blockers first" : typed.trim() !== phrase ? `Type ${phrase} to confirm` : null;
  return (
    <ReasonDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={`Enable the order book · ${kindLabel(kind)} accounts`}
      description="Four-eyes: this records your request; a different staff member with settlement rights confirms it, and the engine runs the rollout then."
      codes={REASONS.rollout}
      requireNote
      confirmLabel="Request enable"
      confirmVariant="sell"
      engine
      width={600}
      disabled={blocked}
      onConfirm={async (reason) => {
        const r = await optSend<FourEyesPending | EnableDone>("POST", "/api/trading/admin/options/book/enable", { kind, reason });
        if (r.ok) onDone();
        return r;
      }}
      success={(d) => (d?.status === "enabled" ? `Order book enabled for ${kindLabel(kind)} accounts` : `Enable requested: waiting for a second approver${d?.status === "pending_approval" ? ` (#${String(d.approval.id)})` : ""}`)}
    >
      <div className="space-y-4">
        <ForwardOnly kind={kind} />
        {plan && (
          <div className="grid grid-cols-3 gap-2">
            <Fact label="Orders cancelled" value={formatNumber(plan.legacyPendingOrders ?? 0, 0)} />
            <Fact label="Positions novated" value={formatNumber(plan.novation?.positions ?? 0, 0)} />
            <Fact label="Clients" value={formatNumber(plan.novation?.clients ?? 0, 0)} />
          </div>
        )}
        <Field label="Confirmation" hint={`type ${phrase}`}>
          <Input value={typed} onChange={(e) => setTyped(e.target.value.toUpperCase())} className="font-mono" placeholder={phrase} aria-label="Typed confirmation" />
        </Field>
      </div>
    </ReasonDialog>
  );
}
