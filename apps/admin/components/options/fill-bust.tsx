"use client";

/**
 * Options › four-eyes actions on the order book (docs/OPTIONS-EXCHANGE.md §11, §12): busting a book fill, and the
 * pending-approvals list where a second staff member confirms a bust or a book rollout. Used by Order books, Clearing
 * & liquidations and Book rollout.
 *
 * FOUR-EYES protocol (engine): the first call answers `pending_approval`; a DIFFERENT staff member with
 * options.settle confirms by posting again with `{approvalId, reason}`. The same staff member twice gets a 409/422
 * `four_eyes` error (shown as is). In the demo build one browser may approve: labelled "(demo: second approver
 * simulated)".
 *
 *   POST /api/trading/admin/options/fills/{id}/bust {reason, approvalId?}
 *        → 200/202 { status: "pending_approval", approval: { id, requestedBy, requestedAt } }
 *        → 200 { status: "busted", fill, reversed: [{ login, amountUsd }], approvedBy? }
 *   GET  /api/trading/admin/options/approvals?status=pending   { items: [{ id, action: fill_bust|book_enable, target,
 *        kind?, reason, requestedBy, requestedAt }] }   optional route: the panel hides itself on 404
 *   POST /api/trading/admin/options/book/enable {kind, reason, approvalId}   approving a rollout (book-enable.tsx)
 */
import * as React from "react";
import { CircleCheck, Gavel, Hourglass, ShieldAlert, UsersRound } from "lucide-react";
import { Button, Card, CardHeader, Chip, Dialog, DialogClose, EmptyState, Field, Input, Tooltip, cn, formatNumber } from "@kalks/ui";
import { IS_DEMO } from "@kalks/mock/mode";
import { ErrorState, TableSkeleton, ago, useNow, when } from "@/components/live/kit";
import { useStaff } from "@/components/staff-session";
import type { Approval, BookTrade, BustDone, EnableDone, FourEyesPending } from "./types";
import { LoginLink, REASONS, ReasonDialog, enginePending, isMe, kindLabel, num, optSend, signedUsd, useOpt, useOptPerms, type SendResult } from "./kit";

export const FILL_KIND: Record<string, { label: string; tone: "neutral" | "info" | "warn" | "down" | "gold" | "ember" }> = {
  book: { label: "Book", tone: "neutral" },
  rfq: { label: "RFQ", tone: "info" },
  liquidation: { label: "Liquidation", tone: "warn" },
  backstop: { label: "Backstop", tone: "down" },
  novation: { label: "Novation", tone: "gold" },
};
export function FillKindChip({ kind }: { kind: string }) {
  const k = FILL_KIND[kind] ?? { label: kind, tone: "neutral" as const };
  return (
    <Chip size="sm" tone={k.tone}>
      {k.label}
    </Chip>
  );
}

type BustAnswer = FourEyesPending | BustDone;
/** What either four-eyes route answers, loosely (for the toast). */
type AnyAnswer = (FourEyesPending | BustDone | EnableDone) | null;

/** Plain fill details (prefilled from a trade print when the caller knows it). */
export type BustTarget = { fillId: number; trade?: (BookTrade & { series?: string }) | null };

function BustWarning({ fillId }: { fillId: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-[14px] border border-down/40 bg-down-soft px-3.5 py-3 text-[12.5px] leading-relaxed text-fg">
      <ShieldAlert className="mt-0.5 size-4 shrink-0 text-down" />
      <div>
        <div className="font-medium text-down">Reverses both sides of the fill</div>
        Premium, fees / rebates and positions of the maker and the taker are reversed with keys{" "}
        <span className="font-mono text-[11.5px]">bust:{fillId || "{fillId}"}:{"{login}"}:*</span>. Both clients see a correction. Four-eyes: nothing moves until a second staff member with settlement rights confirms.
      </div>
    </div>
  );
}

function TradeFacts({ trade }: { trade: BustTarget["trade"] }) {
  if (!trade) return null;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {trade.series && <Fact label="Series" value={<span className="font-mono text-[12px]">{trade.series}</span>} className="col-span-2 sm:col-span-3" />}
      <Fact label="Price × qty" value={`${num(trade.price, 6)} × ${formatNumber(trade.qty, 0)}`} />
      <Fact label="Kind" value={<FillKindChip kind={trade.kind} />} />
      <Fact label="Time" value={when(trade.at, true)} />
      <Fact label="Maker" value={<LoginLink login={trade.maker.login} userId={trade.maker.userId} mm={trade.maker.mm} />} />
      <Fact label={`Taker (${trade.takerSide})`} value={<LoginLink login={trade.taker.login} userId={trade.taker.userId} mm={trade.taker.mm} />} />
      {trade.busted && <Fact label="State" value={<span className="text-down">already busted</span>} />}
    </div>
  );
}

export function Fact({ label, value, tone, className }: { label: string; value: React.ReactNode; tone?: "up" | "warn" | "down"; className?: string }) {
  return (
    <div className={cn("k-row min-w-0 px-3 py-2", className)}>
      <div className="text-[10px] uppercase tracking-wider text-fg-3">{label}</div>
      <div className={cn("k-num mt-0.5 truncate text-[13px]", tone === "up" && "text-up", tone === "warn" && "text-warn", tone === "down" && "text-down")}>{value}</div>
    </div>
  );
}

/**
 * Bust a fill: reason + note → the first four-eyes call. Shows "Waiting for a second approver" afterwards (or the
 * reversal when the engine busts at once). `target = null` closes it; `fillId: 0` opens it with an empty id field.
 */
export function FillBustDialog({ target, onClose, onDone }: { target: BustTarget | null; onClose: () => void; onDone?: () => void }) {
  const perms = useOptPerms();
  const [id, setId] = React.useState("");
  const [phase, setPhase] = React.useState<"form" | "pending" | "busted">("form");
  const [answer, setAnswer] = React.useState<BustAnswer | null>(null);
  const [reason, setReason] = React.useState("");
  const [approve, setApprove] = React.useState<Approval | null>(null);
  const got = React.useRef<BustAnswer | null>(null);
  React.useEffect(() => {
    if (!target) return;
    setId(target.fillId ? String(target.fillId) : "");
    setPhase("form");
    setAnswer(null);
    got.current = null;
  }, [target]);
  if (!target) return null;
  const valid = /^\d{1,18}$/.test(id);
  const close = () => {
    got.current = null;
    setPhase("form");
    setAnswer(null);
    setApprove(null);
    onClose();
  };

  if (phase === "form")
    return (
      <ReasonDialog
        open
        onOpenChange={(o) => {
          if (o) return;
          const a = got.current;
          if (!a) return close();
          setAnswer(a);
          setPhase(a.status === "busted" ? "busted" : "pending");
          onDone?.();
        }}
        title={valid ? `Bust fill #${id}` : "Bust a fill"}
        description="For a fill that should never have happened (off-market price, mark or matching error). Busts are four-eyes and can't be undone."
        codes={REASONS.bust}
        requireNote
        confirmLabel="Request bust"
        confirmVariant="sell"
        engine
        width={600}
        disabled={!perms.settle ? "Needs the options settlement permission" : !valid ? "Enter the fill id" : target.trade?.busted ? "This fill is already busted" : null}
        onConfirm={async (r) => {
          setReason(r);
          const res = await optSend<BustAnswer>("POST", `/api/trading/admin/options/fills/${id}/bust`, { reason: r });
          if (res.ok) got.current = res.data?.status ? res.data : { status: "pending_approval", approval: { id: "—", requestedBy: "you", requestedAt: new Date().toISOString() } };
          return res;
        }}
        success={(d) => (d?.status === "busted" ? `Fill #${id} busted` : `Bust of #${id} requested: waiting for a second approver`)}
      >
        <div className="space-y-4">
          {!target.fillId && (
            <Field label="Fill id" hint="from the trade tape or the client's deal">
              <Input value={id} onChange={(e) => setId(e.target.value.replace(/\D/g, "").slice(0, 18))} className="font-mono" placeholder="e.g. 8400123" aria-label="Fill id" autoFocus />
            </Field>
          )}
          <TradeFacts trade={target.trade} />
          <BustWarning fillId={id} />
        </div>
      </ReasonDialog>
    );

  const pending = answer?.status === "pending_approval" ? answer.approval : null;
  const done = answer?.status === "busted" ? answer : null;
  return (
    <>
      <Dialog
        open={!approve}
        onOpenChange={(o) => !o && close()}
        title={done ? `Fill #${id} busted` : "Waiting for a second approver"}
        description={done ? "Both sides were reversed and the clients see a correction." : `Bust of fill #${id} · four-eyes`}
        width={540}
        footer={
          <>
            {pending && IS_DEMO && (
              <Button
                variant="sell"
                size="sm"
                className="mr-auto"
                onClick={() => setApprove({ id: pending.id, action: "fill_bust", target: id, reason, requestedBy: pending.requestedBy, requestedAt: pending.requestedAt })}
              >
                <Gavel /> Approve as second approver
              </Button>
            )}
            <DialogClose asChild>
              <Button variant="surface" size="sm">
                Close
              </Button>
            </DialogClose>
          </>
        }
      >
        {pending ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-[14px] border border-warn/30 bg-warn-soft px-3.5 py-3 text-[13px]">
              <Hourglass className="mt-0.5 size-4 shrink-0 text-warn" />
              <div>
                Waiting for a second approver (approval <span className="font-mono">#{String(pending.id)}</span>, requested by <span className="font-medium">{pending.requestedBy}</span>
                {pending.requestedAt ? ` at ${when(pending.requestedAt, true)}` : ""}).
                <div className="mt-1 text-[12px] text-fg-3">A different staff member with settlement rights confirms it under Pending approvals on Order books or Clearing & liquidations. Nothing is reversed until then.</div>
              </div>
            </div>
            {IS_DEMO && <div className="text-[12px] text-fg-3">Demo build: you can approve it yourself (demo: second approver simulated).</div>}
          </div>
        ) : done ? (
          <Reversal done={done} />
        ) : null}
      </Dialog>
      <ApproveDialog
        approval={approve}
        onClose={() => setApprove(null)}
        onDone={(d) => {
          if (d?.status === "busted") {
            setAnswer(d);
            setPhase("busted");
          }
          onDone?.();
        }}
      />
    </>
  );
}

function Reversal({ done }: { done: BustDone }) {
  const rev = done.reversed ?? [];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[13px] text-up">
        <CircleCheck className="size-4" /> Reversed{done.approvedBy ? ` · approved by ${done.approvedBy}` : ""}
      </div>
      {rev.length ? (
        <div className="space-y-1.5">
          {rev.map((r, i) => (
            <div key={`${r.login}-${i}`} className="k-row flex items-center justify-between px-3 py-2 text-[12.5px]">
              <LoginLink login={r.login} />
              <span className={cn("k-num font-mono", r.amountUsd >= 0 ? "text-up" : "text-down")}>{signedUsd(r.amountUsd, 2)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-[12.5px] text-fg-3">The engine didn't list the reversed amounts.</div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Approving                                                            */
/* ------------------------------------------------------------------ */

const ACTION_LABEL = (a: Approval) => (a.action === "fill_bust" ? `Bust fill #${a.target}` : a.action === "book_enable" ? `Enable the order book · ${kindLabel(a.kind ?? a.target)}` : `${a.action} · ${a.target}`);

/** Second approver: re-posts the request with its approval id. */
export function ApproveDialog({ approval, onClose, onDone }: { approval: Approval | null; onClose: () => void; onDone?: (d: AnyAnswer) => void }) {
  const perms = useOptPerms();
  const staff = useStaff();
  const [typed, setTyped] = React.useState("");
  React.useEffect(() => setTyped(""), [approval]);
  if (!approval) return null;
  const mine = isMe(approval.requestedBy, staff);
  const enable = approval.action === "book_enable";
  const kind = approval.kind ?? approval.target;
  const phrase = `ENABLE ${String(kind).toUpperCase()}`;
  const block = !perms.settle ? "Needs the options settlement permission" : mine && !IS_DEMO ? "You requested this: a different staff member must approve (four-eyes)" : enable && typed.trim() !== phrase ? `Type ${phrase} to confirm` : null;
  return (
    <ReasonDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Approve: ${ACTION_LABEL(approval)}`}
      description={`Second approver (four-eyes)${IS_DEMO && mine ? " · demo: second approver simulated" : ""}. The engine executes the request as soon as you confirm.`}
      codes={enable ? REASONS.rollout : REASONS.bust}
      requireNote
      confirmLabel={`Approve as second approver${IS_DEMO && mine ? " (demo)" : ""}`}
      confirmVariant="sell"
      engine
      width={600}
      disabled={block}
      onConfirm={async (reason): Promise<SendResult<AnyAnswer>> => {
        const r = enable
          ? await optSend<AnyAnswer>("POST", "/api/trading/admin/options/book/enable", { kind, reason, approvalId: approval.id })
          : await optSend<AnyAnswer>("POST", `/api/trading/admin/options/fills/${approval.target}/bust`, { reason, approvalId: approval.id });
        if (r.ok) onDone?.(r.data ?? null);
        return r;
      }}
      success={(d) =>
        d?.status === "busted" ? `Fill #${approval.target} busted${d.reversed?.length ? ` · ${d.reversed.length} accounts reversed` : ""}` : d?.status === "enabled" ? `Order book enabled for ${kindLabel(kind)} accounts` : d?.status === "pending_approval" ? "Still waiting for another approver" : "Approved"
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <Fact label="Requested by" value={approval.requestedBy} />
          <Fact label="Requested" value={when(approval.requestedAt, true)} />
          <Fact label="Their reason" value={<span title={approval.reason}>{approval.reason || "—"}</span>} className="col-span-2" />
        </div>
        {enable ? (
          <>
            <div className="rounded-[14px] border-2 border-down/50 bg-down-soft px-3.5 py-3 text-[12.5px] leading-relaxed">
              <div className="font-medium text-down">{kind === "live" ? "Real money · forward-only" : "Forward-only"}</div>
              {kindLabel(kind)} options move to the order book for good: house opens halt, legacy pending orders are cancelled, positions are novated. There is no switch-off.
            </div>
            <Field label="Confirmation" hint={`type ${phrase}`}>
              <Input value={typed} onChange={(e) => setTyped(e.target.value.toUpperCase())} className="font-mono" placeholder={phrase} aria-label="Typed confirmation" />
            </Field>
          </>
        ) : (
          <BustWarning fillId={approval.target} />
        )}
        {mine && IS_DEMO && <div className="text-[12px] text-fg-3">Demo build: the same browser may approve its own request (demo: second approver simulated). A live engine refuses this with a four-eyes error.</div>}
      </div>
    </ReasonDialog>
  );
}

/**
 * Pending four-eyes approvals (optional engine route): hidden entirely when the engine doesn't serve it.
 * `actions` filters what this page cares about; `kind` narrows rollout requests.
 */
export function ApprovalsPanel({ actions, kind, refreshKey, onChanged, className }: { actions: string[]; kind?: string; refreshKey?: number; onChanged?: () => void; className?: string }) {
  const perms = useOptPerms();
  const staff = useStaff();
  const now = useNow(15_000);
  const list = useOpt<{ items: Approval[] }>("/api/trading/admin/options/approvals?status=pending", { refreshMs: 10_000 });
  const [approve, setApprove] = React.useState<Approval | null>(null);
  const { reload } = list;
  React.useEffect(() => {
    if (refreshKey) reload();
  }, [refreshKey, reload]);
  if (list.error && (enginePending(list.error) || list.error.code === "not_found")) return null;
  const items = (list.data?.items ?? []).filter((a) => actions.includes(a.action) && (!kind || a.action !== "book_enable" || (a.kind ?? a.target) === kind));
  return (
    <Card className={cn("pb-5", className)}>
      <CardHeader title="Pending approvals" subtitle="Four-eyes requests waiting for a second staff member with settlement rights." icon={<UsersRound />} action={items.length ? <Chip tone="warn">{items.length} waiting</Chip> : undefined} />
      <div className="mt-4 space-y-2 px-4 sm:px-6">
        {list.error ? (
          <ErrorState error={list.error} onRetry={list.reload} />
        ) : !list.data ? (
          <TableSkeleton rows={2} />
        ) : !items.length ? (
          <EmptyState title="Nothing waiting" text="New busts and rollouts appear here until a second approver confirms them." illustration="check_mark_button" />
        ) : (
          items.map((a) => {
            const mine = isMe(a.requestedBy, staff);
            const blocked = !perms.settle ? "Needs the options settlement permission" : mine && !IS_DEMO ? "You requested this: a different staff member must approve" : null;
            return (
              <div key={String(a.id)} className="k-row flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-medium">{ACTION_LABEL(a)}</span>
                    <span className="font-mono text-[11px] text-fg-3">#{String(a.id)}</span>
                    {mine && <Chip size="sm">yours</Chip>}
                  </div>
                  <div className="mt-0.5 truncate text-[12px] text-fg-3" title={a.reason}>
                    {a.requestedBy} · {ago(a.requestedAt, now)} · {a.reason}
                  </div>
                </div>
                {blocked ? (
                  <Tooltip content={blocked}>
                    <span>
                      <Button size="xs" variant="surface" disabled>
                        <Gavel /> Approve
                      </Button>
                    </span>
                  </Tooltip>
                ) : (
                  <Button size="xs" variant="sell" onClick={() => setApprove(a)}>
                    <Gavel /> Approve as second approver{IS_DEMO && mine ? " (demo)" : ""}
                  </Button>
                )}
              </div>
            );
          })
        )}
      </div>
      <ApproveDialog
        approval={approve}
        onClose={() => setApprove(null)}
        onDone={() => {
          list.reload();
          onChanged?.();
        }}
      />
    </Card>
  );
}

/** "Bust a fill" card: fill id → FillBustDialog. */
export function BustFillCard({ onDone, className }: { onDone?: () => void; className?: string }) {
  const perms = useOptPerms();
  const [id, setId] = React.useState("");
  const [target, setTarget] = React.useState<BustTarget | null>(null);
  const ok = /^\d{1,18}$/.test(id);
  return (
    <Card className={cn("pb-5", className)}>
      <CardHeader title="Bust a fill" subtitle="Reverse a book fill on both sides (premium, fees / rebates, positions). Four-eyes." icon={<Gavel />} />
      <div className="mt-4 space-y-3 px-6">
        {perms.settle ? (
          <>
            <Field label="Fill id">
              <Input value={id} onChange={(e) => setId(e.target.value.replace(/\D/g, "").slice(0, 18))} className="font-mono" placeholder="e.g. 8400123" aria-label="Fill id" />
            </Field>
            <Button variant="down-outline" size="sm" disabled={!ok} onClick={() => setTarget({ fillId: Number(id) })}>
              <Gavel /> Bust fill…
            </Button>
          </>
        ) : (
          <div className="text-[12.5px] text-fg-3">Busts need the options settlement permission (and a second approver).</div>
        )}
      </div>
      <FillBustDialog
        target={target}
        onClose={() => setTarget(null)}
        onDone={() => {
          setId("");
          onDone?.();
        }}
      />
    </Card>
  );
}
