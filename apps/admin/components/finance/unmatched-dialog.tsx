"use client";

import * as React from "react";
import { ArrowRightLeft, PauseCircle, Search, ShieldCheck, Undo2, UserPlus } from "lucide-react";
import { Button, Chip, Dialog, Segmented, cn } from "@ezymex/ui";
import { FIN_CLIENTS, finAgo, type FinClient, type FinDeposit } from "@ezymex/mock/admin-finance";
import { Addr, MiniField, PersonCell, Select, TextArea, TxHash } from "@/components/config/kit";
import { CoinAmount, Line, NetworkChip, usd } from "./shared";

export type ResolveAction = "assign" | "refund" | "hold";

const REASONS: Record<ResolveAction, string[]> = {
  assign: ["Client confirmed via support ticket", "Matched by sender address history", "Address re-assigned after account merge", "Proof of transfer provided"],
  refund: ["Sender unknown – return to origin", "Below chain minimum", "Unsupported token", "Compliance – source of funds rejected"],
  hold: ["Pending compliance review", "Awaiting client proof of transfer", "Chain analytics flag – escalate to MLRO"],
};

export function UnmatchedDialog({
  deposit,
  onOpenChange,
  onResolve,
}: {
  deposit: FinDeposit | null;
  onOpenChange: (o: boolean) => void;
  onResolve: (d: FinDeposit, action: ResolveAction, client: FinClient | null, reason: string) => void;
}) {
  const [action, setAction] = React.useState<ResolveAction>("assign");
  const [q, setQ] = React.useState("");
  const [picked, setPicked] = React.useState<FinClient | null>(null);
  const [reason, setReason] = React.useState(REASONS.assign[0]!);
  const [note, setNote] = React.useState("");
  const [hold, setHold] = React.useState("72 hours");

  React.useEffect(() => {
    if (deposit) {
      setAction("assign");
      setQ("");
      setPicked(null);
      setNote("");
    }
  }, [deposit]);
  React.useEffect(() => setReason(REASONS[action][0]!), [action]);

  const list = FIN_CLIENTS.filter((c) => !q || c.person.name.toLowerCase().includes(q.toLowerCase()) || c.login.includes(q) || c.person.email.includes(q.toLowerCase())).slice(0, 6);
  const fee = deposit?.network === "TRC20" ? 1 : deposit?.network === "BTC" ? 0.00002 * 63412 : 3.2;
  const canConfirm = action !== "assign" || !!picked;

  return (
    <Dialog
      open={!!deposit}
      onOpenChange={onOpenChange}
      side="right"
      title="Resolve unmatched deposit"
      description={deposit ? `${deposit.id} · received ${finAgo(deposit.minutesAgo)}` : undefined}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={action === "refund" ? "sell" : "ember"}
            size="sm"
            disabled={!canConfirm}
            onClick={() => {
              if (!deposit) return;
              onResolve(deposit, action, picked, reason);
              onOpenChange(false);
            }}
          >
            {action === "assign" ? <UserPlus /> : action === "refund" ? <Undo2 /> : <PauseCircle />}
            {action === "assign" ? (picked ? `Credit ${picked.person.name.split(" ")[0]}` : "Select a client") : action === "refund" ? "Queue refund" : "Place on hold"}
          </Button>
        </>
      }
    >
      {deposit && (
        <div className="space-y-5">
          <div className="k-row p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="k-label">Received</div>
                <CoinAmount amount={deposit.amount} asset={deposit.asset} usdValue={deposit.usd} className="mt-1 [&_.k-num]:text-[20px]" />
              </div>
              <NetworkChip network={deposit.network} />
            </div>
            <div className="mt-3 divide-y divide-line border-t border-line">
              <Line k="Tx hash" v={<TxHash hash={deposit.hash} chain={deposit.network === "BTC" ? "btc" : deposit.network === "TRC20" ? "tron" : "eth"} head={10} tail={8} />} />
              <Line k="From (sender)" v={<Addr value={deposit.from} head={8} tail={6} />} />
              <Line k="To (our address)" v={<Addr value={deposit.to} head={8} tail={6} />} />
              <Line k="Confirmations" v={`${deposit.confirmations.toLocaleString()} / ${deposit.required} · final`} tone="up" />
              <Line k="Why unmatched" v={<Chip size="sm" tone="warn">{deposit.unmatchedReason}</Chip>} />
            </div>
          </div>

          <Segmented
            value={action}
            onChange={setAction}
            className="w-full [&>button]:flex-1"
            options={[
              { value: "assign", label: <><UserPlus className="size-3.5" /> Assign</> },
              { value: "refund", label: <><Undo2 className="size-3.5" /> Refund</> },
              { value: "hold", label: <><PauseCircle className="size-3.5" /> Hold</> },
            ]}
          />

          {action === "assign" && (
            <div>
              <div className="flex h-10 items-center gap-2 rounded-[12px] border border-line bg-surface-2 px-3 focus-within:border-ember/50">
                <Search className="size-4 text-fg-3" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, login or email…" className="h-full flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-fg-3" />
              </div>
              <div className="mt-2 space-y-1.5">
                {list.map((c) => (
                  <button
                    key={c.login}
                    type="button"
                    onClick={() => setPicked(c)}
                    className={cn("k-row flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-surface-3/60", picked?.login === c.login && "border-ember/50 bg-ember-soft")}
                  >
                    <PersonCell name={c.person.name} photo={c.person.photo} country={c.person.country} sub={<span className="font-mono">{c.login} · {c.person.email}</span>} size={28} />
                    <Chip size="sm" tone={c.kycLevel >= 2 ? "up" : "warn"}>KYC L{c.kycLevel}</Chip>
                  </button>
                ))}
                {list.length === 0 && <div className="py-6 text-center text-[13px] text-fg-3">No client matches “{q}”.</div>}
              </div>
            </div>
          )}

          {action === "refund" && (
            <div className="k-row divide-y divide-line px-4 py-1">
              <Line k="Return to" v={<Addr value={deposit.from} head={8} tail={6} />} />
              <Line k="Network fee (deducted)" v={`- ${usd(fee)}`} tone="down" />
              <Line k="Refund amount" v={usd(deposit.usd - fee)} />
              <Line k="Sent from" v="Hot wallet · batch 18:00" />
            </div>
          )}

          {action === "hold" && (
            <MiniField label="Hold duration" hint="Funds stay in the deposit address">
              <Select value={hold} onChange={setHold} options={["24 hours", "72 hours", "7 days", "Until compliance clears"]} />
            </MiniField>
          )}

          <MiniField label="Reason code">
            <Select value={reason} onChange={setReason} options={REASONS[action]} />
          </MiniField>
          <MiniField label="Internal note" hint="Visible to staff only">
            <TextArea value={note} onChange={setNote} placeholder="Ticket number, client confirmation, evidence…" />
          </MiniField>
          <div className="flex items-center gap-2 rounded-[12px] border border-line bg-surface-2 px-3 py-2.5 text-[12px] text-fg-3">
            <ShieldCheck className="size-4 shrink-0 text-ember" />
            Resolution is written to the wallet ledger and admin audit log. {action === "assign" && <span className="inline-flex items-center gap-1 text-fg-2"><ArrowRightLeft className="size-3" /> Credits the client wallet instantly.</span>}
          </div>
        </div>
      )}
    </Dialog>
  );
}
