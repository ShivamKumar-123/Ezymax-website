"use client";

// One client's deposit turnover requirements, on their page in the Back Office.
//
// It answers the two questions the desk is asked when a client writes in about a held-up withdrawal: how much
// volume do they still owe, and which deposit is holding it. Deposit by deposit, with the trades that paid
// each one down, so an answer can be given from the record rather than from a guess.
//
// It also carries the exception path. A requirement that must not apply - a client the restriction cannot
// lawfully be used against, or one a review has cleared - is lifted here with a reason, which goes on the row
// and into the audit trail. Lifting one moves no money: it only stops that requirement holding the gate shut.

import * as React from "react";
import { BadgeCheck, Target } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, Dialog, Field, Skeleton, cn } from "@ezymex/ui";
import { TextArea } from "@/components/config/kit";
import { useCan } from "@/components/staff-session";
import { ErrorState, sendJson, useApi, when } from "@/components/live/kit";

type Requirement = {
  id: number;
  deposit_amount: string;
  multiplier: string;
  required_volume: string;
  completed_volume: string;
  remaining_volume: string;
  completion_percentage: number;
  status: "pending" | "completed" | "waived";
  waived_reason: string | null;
  created_at: string;
  completed_at: string | null;
};

type Allocation = { id: number; deal_id: number; kind: "credit" | "reversal"; amount: string; symbol: string; lots: string; closed_at: string };

type Turnover = {
  total_deposits: string;
  required_volume: string;
  completed_volume: string;
  remaining_volume: string;
  completion_percentage: number;
  eligible: boolean;
  deposits: Requirement[];
  history: Allocation[];
  policy: { enabled: boolean; multiplier: string; min_deposit: string };
};

const usd = (v: string) => `$${Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

const TONE: Record<Requirement["status"], "up" | "warn" | "neutral"> = { completed: "up", pending: "warn", waived: "neutral" };

function Bar({ pct }: { pct: number }) {
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
      <span className="block h-full rounded-full bg-ember" style={{ width: `${Math.max(pct, 2)}%` }} />
    </span>
  );
}

function WaiveDialog({ req, onClose, onDone }: { req: Requirement | null; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => setReason(""), [req]);
  if (!req) return null;
  async function submit() {
    if (!req) return;
    if (reason.trim().length < 3) return toast.error("Give a reason", { description: "At least 3 characters." });
    setBusy(true);
    const r = await sendJson(`/api/wallet/turnover/requirements/${req.id}/waive`, { reason: reason.trim() });
    setBusy(false);
    if (!r.ok) return toast.error("Couldn't waive this requirement", { description: r.error.message });
    toast.success("Requirement waived", { description: "The client can withdraw against this deposit. Recorded in the audit trail." });
    onDone();
  }
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      width={480}
      title={`Waive the requirement on a ${usd(req.deposit_amount)} deposit`}
      description={`${usd(req.remaining_volume)} of volume is still owed on it. Waiving lifts that: no money moves, and the client can withdraw against this deposit.`}
      footer={
        <>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" variant="ember" onClick={submit} disabled={busy} data-testid="waive-confirm">
            {busy ? "Saving…" : "Waive requirement"}
          </Button>
        </>
      }
    >
      <Field label="Reason" hint="Required · kept on the requirement and in the audit log">
        <TextArea value={reason} onChange={setReason} rows={3} placeholder="e.g. Compliance review 4412 — restriction not applicable to this client" />
      </Field>
    </Dialog>
  );
}

export function ClientTurnoverCard({ userId }: { userId: number }) {
  const { data, error, loading, reload } = useApi<Turnover>(`/api/wallet/turnover/${userId}`);
  const [waiving, setWaiving] = React.useState<Requirement | null>(null);
  const canWaive = useCan("finance.approve");

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading && !data) return <Skeleton className="h-40 w-full rounded-[20px]" />;
  // nothing to show for a broker who has not switched the policy on, or a client who never owed anything
  if (!data || (!data.policy.enabled && data.deposits.length === 0)) return null;

  return (
    <Card>
      <CardHeader
        title="Deposit turnover"
        subtitle={data.policy.enabled ? `${data.policy.multiplier}x each deposit${Number(data.policy.min_deposit) > 0 ? ` over ${usd(data.policy.min_deposit)}` : ""}` : "Policy is off — these are requirements raised while it was on"}
        icon={<Target />}
        action={
          data.eligible ? (
            <Chip size="sm" tone="up">
              <BadgeCheck className="size-3" /> Can withdraw
            </Chip>
          ) : (
            <Chip size="sm" tone="warn">{usd(data.remaining_volume)} to trade</Chip>
          )
        }
      />
      <div className="space-y-4 px-6 pb-6 pt-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Deposits", usd(data.total_deposits)],
            ["Required", usd(data.required_volume)],
            ["Completed", usd(data.completed_volume)],
            ["Remaining", usd(data.remaining_volume)],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0">
              <div className="truncate text-[11.5px] text-fg-3">{label}</div>
              <div className="k-num mt-0.5 truncate text-[15px]">{value}</div>
            </div>
          ))}
        </div>

        {data.deposits.length > 0 && (
          <div className="space-y-2.5">
            {data.deposits.map((r) => (
              <div key={r.id} className="k-row px-3.5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="k-num text-[13.5px] font-medium">{usd(r.deposit_amount)}</span>
                  <span className="text-[12px] text-fg-3">× {r.multiplier} → {usd(r.required_volume)}</span>
                  <Chip size="sm" tone={TONE[r.status]}>{r.status}</Chip>
                  <span className="ms-auto text-[11.5px] text-fg-3">{when(r.created_at)}</span>
                </div>
                {r.status === "pending" && (
                  <div className="mt-2">
                    <Bar pct={r.completion_percentage} />
                    <div className="mt-1 flex items-center justify-between text-[11.5px] text-fg-3">
                      <span>
                        {usd(r.completed_volume)} of {usd(r.required_volume)} · {r.completion_percentage}%
                      </span>
                      {canWaive && (
                        <button type="button" onClick={() => setWaiving(r)} className="text-ember hover:underline" data-testid={`waive-${r.id}`}>
                          Waive
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {r.waived_reason && <p className="mt-1.5 text-[11.5px] text-fg-3">Waived: {r.waived_reason}</p>}
              </div>
            ))}
          </div>
        )}

        {data.history.length > 0 && (
          <details className="border-t border-line pt-3">
            <summary className="cursor-pointer text-[12.5px] text-fg-2 hover:text-fg">Volume allocated ({data.history.length})</summary>
            <ul className="mt-2.5 space-y-1.5">
              {data.history.map((h) => (
                <li key={h.id} className="flex flex-wrap items-center gap-2 text-[12px]">
                  <span className="w-20 shrink-0 text-fg-3">deal {h.deal_id}</span>
                  <span className="w-20 shrink-0">{h.symbol}</span>
                  <span className="w-16 shrink-0 text-fg-3">{h.lots} lots</span>
                  <span className={cn("k-num", h.kind === "reversal" ? "text-down" : "text-fg")}>{usd(h.amount)}</span>
                  <span className="ms-auto text-fg-3">{when(h.closed_at)}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <WaiveDialog
        req={waiving}
        onClose={() => setWaiving(null)}
        onDone={() => {
          setWaiving(null);
          reload();
        }}
      />
    </Card>
  );
}
