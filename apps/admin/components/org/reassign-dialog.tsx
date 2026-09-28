"use client";

import * as React from "react";
import { ArrowRight, Shuffle } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, Dialog, DialogClose, Field, Toggle, cn } from "@kalks/ui";
import type { DskDesk } from "@kalks/mock/admin-desks";
import { RangeSlider } from "@/components/brokers/kit";

export interface ReassignResult {
  fromDesk: string;
  fromId: string;
  toDesk: string;
  toId: string;
  count: number;
}

function Sel({ value, onChange, children, label }: { value: string; onChange: (v: string) => void; children: React.ReactNode; label: string }) {
  return (
    <div className="relative flex h-11 items-center rounded-[14px] border border-line bg-surface-2 px-3.5 text-sm">
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="h-full w-full cursor-pointer appearance-none bg-transparent text-fg outline-none [&>option]:bg-surface">
        {children}
      </select>
    </div>
  );
}

const RULES = [
  { key: "no_ftd", label: "Leads without FTD" },
  { key: "dormant", label: "Dormant 30d+" },
  { key: "funded", label: "Funded clients" },
  { key: "vip", label: "VIP (NDA > $25k)" },
] as const;

export function ReassignDialog({ open, onOpenChange, desks, initialDesk, onConfirm }: { open: boolean; onOpenChange: (o: boolean) => void; desks: DskDesk[]; initialDesk?: string; onConfirm: (r: ReassignResult) => void }) {
  const owning = desks.filter((d) => d.capacity > 0);
  const [fromDesk, setFromDesk] = React.useState<string>(initialDesk ?? owning[0]!.key);
  const fd = owning.find((d) => d.key === fromDesk) ?? owning[0]!;
  const [fromId, setFromId] = React.useState(fd.members[1]?.person.id ?? fd.members[0]!.person.id);
  const [toDesk, setToDesk] = React.useState<string>(owning[1]!.key);
  const td = owning.find((d) => d.key === toDesk) ?? owning[1]!;
  const [toId, setToId] = React.useState(td.members[1]!.person.id);
  const [rules, setRules] = React.useState<string[]>(["no_ftd"]);
  const [notify, setNotify] = React.useState(true);
  const [keepIb, setKeepIb] = React.useState(true);

  React.useEffect(() => {
    if (!open || !initialDesk) return;
    const d = owning.find((x) => x.key === initialDesk);
    if (!d) return;
    setFromDesk(d.key);
    setFromId((d.members[1] ?? d.members[0]!).person.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialDesk]);

  const from = fd.members.find((m) => m.person.id === fromId) ?? fd.members[0]!;
  const to = td.members.find((m) => m.person.id === toId) ?? td.members[0]!;
  const max = Math.max(0, from.clients);
  const [count, setCount] = React.useState(60);
  const n = Math.min(count, max);
  const same = from.person.id === to.person.id;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Reassign clients"
      description="Move a slice of an agent's book to another agent. Open tickets and scheduled calls move with the client."
      width={640}
      footer={
        <>
          <DialogClose asChild>
            <Button size="sm" variant="ghost">
              Cancel
            </Button>
          </DialogClose>
          <Button
            size="sm"
            variant="ember"
            disabled={same || n === 0}
            onClick={() => {
              onConfirm({ fromDesk: fd.key, fromId: from.person.id, toDesk: td.key, toId: to.person.id, count: n });
              toast.success(`${n} clients reassigned`, { description: `${from.person.name} → ${to.person.name}${notify ? " · clients notified by email" : ""}` });
              onOpenChange(false);
            }}
          >
            <Shuffle /> Reassign {n} clients
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <div className="space-y-2">
            <Field label="From desk">
              <Sel
                label="From desk"
                value={fromDesk}
                onChange={(v) => {
                  setFromDesk(v);
                  const d = owning.find((x) => x.key === v)!;
                  setFromId((d.members[1] ?? d.members[0]!).person.id);
                }}
              >
                {owning.map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.name}
                  </option>
                ))}
              </Sel>
            </Field>
            <Sel label="From agent" value={fromId} onChange={setFromId}>
              {fd.members.map((m) => (
                <option key={m.person.id} value={m.person.id}>
                  {m.person.name} · {m.clients} clients
                </option>
              ))}
            </Sel>
          </div>
          <span className="mx-auto mb-3 hidden size-9 place-items-center rounded-full border border-line bg-surface-2 text-ember sm:grid">
            <ArrowRight className="size-4" />
          </span>
          <div className="space-y-2">
            <Field label="To desk">
              <Sel
                label="To desk"
                value={toDesk}
                onChange={(v) => {
                  setToDesk(v);
                  const d = owning.find((x) => x.key === v)!;
                  setToId((d.members[1] ?? d.members[0]!).person.id);
                }}
              >
                {owning.map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.name}
                  </option>
                ))}
              </Sel>
            </Field>
            <Sel label="To agent" value={toId} onChange={setToId}>
              {td.members.map((m) => (
                <option key={m.person.id} value={m.person.id}>
                  {m.person.name} · {m.clients} clients
                </option>
              ))}
            </Sel>
          </div>
        </div>

        <div>
          <div className="mb-2 text-[12.5px] font-medium text-fg-2">Which clients</div>
          <div className="flex flex-wrap gap-1.5">
            {RULES.map((r) => {
              const on = rules.includes(r.key);
              return (
                <button key={r.key} type="button" onClick={() => setRules(on ? rules.filter((x) => x !== r.key) : [...rules, r.key])} className={cn("h-8 rounded-full border px-3 text-[12.5px]", on ? "border-ember/40 bg-ember-soft text-fg" : "border-line bg-surface-2 text-fg-2 hover:text-fg")}>
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between text-[12.5px]">
            <span className="font-medium text-fg-2">Number of clients</span>
            <span className="k-num text-fg">
              {n} <span className="text-fg-3">/ {max}</span>
            </span>
          </div>
          <RangeSlider value={n} onChange={setCount} min={0} max={Math.max(1, max)} step={5} />
        </div>

        {/* preview */}
        <div className="k-row flex items-center gap-3 px-4 py-3.5">
          <Avatar src={from.person.photo} name={from.person.name} size={36} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium">{from.person.name}</div>
            <div className="k-num text-[11.5px] text-fg-3">
              {from.clients} → <span className="text-down">{from.clients - n}</span>
            </div>
          </div>
          <span className="k-num rounded-full bg-ember-soft px-2.5 py-1 text-[12px] font-medium text-ember">{n}</span>
          <div className="min-w-0 flex-1 text-right">
            <div className="truncate text-[13px] font-medium">{to.person.name}</div>
            <div className="k-num text-[11.5px] text-fg-3">
              {to.clients} → <span className="text-up">{to.clients + n}</span>
            </div>
          </div>
          <Avatar src={to.person.photo} name={to.person.name} size={36} />
        </div>
        {same && <p className="text-[12px] text-down">Pick a different target agent.</p>}

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 text-[13px]">
            <span>
              Notify clients of their new account manager
              <span className="block text-[11.5px] text-fg-3">Uses the “Account manager changed” email template</span>
            </span>
            <Toggle checked={notify} onChange={setNotify} label="Notify clients" />
          </div>
          <div className="flex items-center justify-between gap-3 text-[13px]">
            <span>
              Keep IB attribution
              <span className="block text-[11.5px] text-fg-3">Partner commissions are not affected</span>
            </span>
            <Toggle checked={keepIb} onChange={setKeepIb} label="Keep IB attribution" />
          </div>
        </div>
      </div>
    </Dialog>
  );
}
