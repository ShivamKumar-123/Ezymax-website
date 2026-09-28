"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { Avatar, Field, Flag, Input, Segmented, cn, formatMoney } from "@kalks/ui";
import { CLIENTS, REASON_CODES, type AdminClient } from "@kalks/mock/admin-clients";
import { ReasonDialog } from "./kit";

/** Balance / credit adjustment with a mandatory reason code (audited). */
export function AdjustmentDialog({
  open,
  onOpenChange,
  trigger,
  client: fixed,
}: {
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
  trigger?: React.ReactNode;
  client?: AdminClient;
}) {
  const [q, setQ] = React.useState("");
  const [client, setClient] = React.useState<AdminClient>(fixed ?? CLIENTS[0]!);
  const [login, setLogin] = React.useState(client.logins[0] ?? "");
  const [kind, setKind] = React.useState<"balance" | "credit">("balance");
  const [dir, setDir] = React.useState<"in" | "out">("in");
  const [amount, setAmount] = React.useState("250.00");
  React.useEffect(() => setLogin(client.logins[0] ?? ""), [client]);
  const matches = q.length > 1 ? CLIENTS.filter((c) => (c.name + c.id + c.email + c.logins.join(" ")).toLowerCase().includes(q.toLowerCase())).slice(0, 5) : [];
  const amt = Number(amount.replace(/,/g, "")) || 0;

  return (
    <ReasonDialog
      open={open}
      onOpenChange={onOpenChange}
      trigger={trigger}
      title="Create adjustment"
      description="Manual balance or credit change on a trading account. Requires a reason code."
      codes={REASON_CODES.adjustment}
      confirmLabel={`${dir === "in" ? "Credit" : "Debit"} ${formatMoney(amt)}`}
      confirmVariant={dir === "in" ? "ember" : "sell"}
      successMessage={`${kind === "balance" ? "Balance" : "Credit"} ${dir === "in" ? "+" : "-"}${formatMoney(amt)} applied to ${login}`}
    >
      {!fixed && (
        <div className="relative">
          <Field label="Client">
            <Input leading={<Search />} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, client ID, login or email…" />
          </Field>
          {matches.length > 0 && (
            <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-[min(18rem,40vh)] overflow-y-auto overscroll-contain rounded-[14px] border border-line bg-surface p-1 shadow-2xl">
              {matches.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setClient(c);
                    setQ("");
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-surface-3"
                >
                  <Avatar src={c.photo} name={c.name} size={26} />
                  <span className="flex-1 text-[13px]">{c.name}</span>
                  <span className="font-mono text-[11px] text-fg-3">#{c.id}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="k-row flex items-center gap-3 px-3.5 py-2.5">
        <Avatar src={client.photo} name={client.name} size={34} verified={client.kyc === "verified"} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[13.5px] font-medium">
            {client.name} <Flag country={client.country} className="size-3.5" />
          </div>
          <div className="font-mono text-[11.5px] text-fg-3">
            #{client.id} · {client.group}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-fg-3">Equity</div>
          <div className="k-num text-[13px] font-medium">{formatMoney(client.equity)}</div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="mb-1.5 text-[12.5px] font-medium text-fg-2">Account</div>
          {client.logins.length ? (
            <div className="flex flex-wrap gap-1.5">
              {client.logins.map((l) => (
                <button key={l} type="button" onClick={() => setLogin(l)} className={cn("rounded-full border px-3 py-1.5 font-mono text-[12px]", l === login ? "border-ember/50 bg-ember-soft text-fg" : "border-line bg-surface-2 text-fg-2")}>
                  {l}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-[12.5px] text-fg-3">No live accounts</div>
          )}
        </div>
        <div>
          <div className="mb-1.5 text-[12.5px] font-medium text-fg-2">Type</div>
          <Segmented size="xs" value={kind} onChange={setKind} options={[{ value: "balance", label: "Balance" }, { value: "credit", label: "Credit" }]} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-end">
        <div>
          <div className="mb-1.5 text-[12.5px] font-medium text-fg-2">Direction</div>
          <Segmented size="sm" value={dir} onChange={setDir} options={[{ value: "in", label: "+ Credit" }, { value: "out", label: "− Debit" }]} />
        </div>
        <Field label="Amount (USD)">
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="font-mono" trailing={<span className="text-[12px]">USD</span>} />
        </Field>
      </div>
    </ReasonDialog>
  );
}
