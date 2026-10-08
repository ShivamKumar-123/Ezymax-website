"use client";

import * as React from "react";
import { FileText, Minus, Plus, ShieldAlert, UploadCloud, X } from "lucide-react";
import { Button, Dialog, Segmented, cn } from "@ezymex/ui";
import { FIN_ADJ_REASONS, FIN_ADJ_THRESHOLD, FIN_CLIENTS, type FinAdjustment } from "@ezymex/mock/admin-finance";
import { MiniField, NumInput, PersonCell, Select, TextArea } from "@/components/config/kit";
import { usd } from "./shared";

/** Non-label field wrapper (a <label> would forward clicks to the first button inside). */
function DivField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="flex items-center justify-between gap-2 text-[12px] font-medium text-fg-2">
        {label}
        {hint && <span className="font-normal text-fg-3">{hint}</span>}
      </span>
      {children}
    </div>
  );
}

export type NewAdjustment = Pick<FinAdjustment, "client" | "account" | "kind" | "direction" | "amount" | "reason" | "note" | "attachment">;

export function AdjustmentCreate({ open, onOpenChange, onCreate }: { open: boolean; onOpenChange: (o: boolean) => void; onCreate: (a: NewAdjustment) => void }) {
  const [clientLogin, setClientLogin] = React.useState(FIN_CLIENTS[0]!.login);
  const [account, setAccount] = React.useState("wallet");
  const [kind, setKind] = React.useState<"balance" | "credit">("balance");
  const [direction, setDirection] = React.useState<"add" | "deduct">("add");
  const [amount, setAmount] = React.useState(250);
  const [reason, setReason] = React.useState(FIN_ADJ_REASONS[0]!);
  const [note, setNote] = React.useState("");
  const [file, setFile] = React.useState<string | null>(null);
  const [drag, setDrag] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setAmount(250);
      setNote("");
      setFile(null);
      setDirection("add");
      setKind("balance");
    }
  }, [open]);

  const client = FIN_CLIENTS.find((c) => c.login === clientLogin)!;
  const needsChecker = amount > FIN_ADJ_THRESHOLD;
  const valid = amount > 0 && note.trim().length >= 5;
  const accounts = [
    { value: "wallet", label: "Wallet (USD)" },
    { value: client.login, label: `MT5 ${client.login} · ${client.group}` },
    { value: String(+client.login + 17), label: `MT5 ${+client.login + 17} · Standard` },
  ];

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      width={620}
      title="New manual adjustment"
      description="Balance and credit changes are posted to the ledger with a reason code and full audit trail."
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={direction === "add" ? "ember" : "sell"}
            size="sm"
            disabled={!valid}
            onClick={() => {
              onCreate({ client, account: account === "wallet" ? "Wallet" : account, kind, direction, amount, reason, note, attachment: file ?? undefined });
              onOpenChange(false);
            }}
          >
            {needsChecker ? "Submit for approval" : `${direction === "add" ? "Credit" : "Deduct"} ${usd(amount)}`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MiniField label="Client">
            <Select value={clientLogin} onChange={setClientLogin} options={FIN_CLIENTS.map((c) => ({ value: c.login, label: `${c.person.name} · ${c.login}` }))} />
          </MiniField>
          <MiniField label="Account">
            <Select value={account} onChange={setAccount} options={accounts} />
          </MiniField>
        </div>
        <div className="k-row flex items-center justify-between gap-3 px-3 py-2.5">
          <PersonCell name={client.person.name} photo={client.person.photo} country={client.person.country} sub={`${client.person.email} · KYC L${client.kycLevel}`} size={30} />
          <span className="text-right text-[12px] text-fg-3">
            Balance <span className="k-num block text-[13.5px] font-medium text-fg">{usd(1_240 + (+client.login % 9_000))}</span>
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DivField label="Type">
            <Segmented value={kind} onChange={setKind} className="w-full [&>button]:flex-1" options={[{ value: "balance", label: "Balance" }, { value: "credit", label: "Credit (bonus)" }]} />
          </DivField>
          <DivField label="Direction">
            <Segmented
              value={direction}
              onChange={setDirection}
              className="w-full [&>button]:flex-1"
              options={[
                { value: "add", label: <><Plus className="size-3.5 text-up" /> Add</> },
                { value: "deduct", label: <><Minus className="size-3.5 text-down" /> Deduct</> },
              ]}
            />
          </DivField>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MiniField label="Amount" hint="USD">
            <NumInput value={amount} onChange={setAmount} min={0.01} step={50} prefix="$" decimals={2} />
          </MiniField>
          <MiniField label="Reason code">
            <Select value={reason} onChange={setReason} options={FIN_ADJ_REASONS} />
          </MiniField>
        </div>

        {needsChecker && (
          <div className="flex items-start gap-2 rounded-[12px] border border-warn/30 bg-warn-soft px-3 py-2.5 text-[12.5px] text-warn">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            Maker-checker: adjustments above {usd(FIN_ADJ_THRESHOLD, 0)} require a second approver from Finance before they post. You cannot approve your own request.
          </div>
        )}

        <DivField label="Evidence" hint="PDF, PNG, JPG, LOG · max 10 MB">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              const f = e.dataTransfer.files[0];
              if (f) setFile(f.name);
            }}
            onClick={(e) => {
              e.preventDefault();
              inputRef.current?.click();
            }}
            className={cn("flex cursor-pointer items-center gap-3 rounded-[14px] border border-dashed px-4 py-3.5 transition-colors", drag ? "border-ember bg-ember-soft" : "border-line bg-surface-2 hover:border-fg-3")}
          >
            <input ref={inputRef} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0].name)} />
            {file ? (
              <>
                <span className="grid size-9 place-items-center rounded-[10px] bg-ember-soft text-ember">
                  <FileText className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{file}</span>
                  <span className="text-[11.5px] text-up">Uploaded · virus scan passed</span>
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                  className="grid size-7 place-items-center rounded-full text-fg-3 hover:bg-surface-3 hover:text-fg"
                  aria-label="Remove file"
                >
                  <X className="size-3.5" />
                </button>
              </>
            ) : (
              <>
                <UploadCloud className="size-5 text-fg-3" />
                <span className="text-[12.5px] text-fg-3">
                  Drop a file or <span className="text-ember">browse</span> — ticket screenshot, acquirer notice, outage report
                </span>
              </>
            )}
          </div>
        </DivField>
        <MiniField label="Maker note" hint={note.trim().length < 5 ? "Required" : undefined}>
          <TextArea value={note} onChange={setNote} placeholder="Why is this adjustment needed? Reference the support ticket." />
        </MiniField>
      </div>
    </Dialog>
  );
}
