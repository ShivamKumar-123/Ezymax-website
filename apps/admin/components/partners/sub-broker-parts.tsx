"use client";

import * as React from "react";
import { MessageSquare, Pause, Play, Save, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, Chip, Dialog, Flag, Money, Progress, SpotlightCard, StatusChip } from "@kalks/ui";
import { PARTNERS, type SubBroker } from "@kalks/mock/admin-partners";
import { ChipList, MiniField, MiniStat, NumInput, Section, Select, TextInput, auditToast, useReason } from "@/components/config/kit";
import { LevelChip, fmtDate, fmtInt, fmtLots } from "./common";

export function Flags({ countries, max = 5 }: { countries: string[]; max?: number }) {
  return (
    <span className="inline-flex items-center">
      <span className="flex -space-x-1.5">
        {countries.slice(0, max).map((c) => (
          <Flag key={c} country={c} className="size-[18px] ring-2 ring-surface" />
        ))}
      </span>
      {countries.length > max && <span className="ml-1.5 text-[11px] text-fg-3">+{countries.length - max}</span>}
    </span>
  );
}

export function SubBrokerCard({ s, onOpen }: { s: SubBroker; onOpen: () => void }) {
  const pct = (s.lotsMtd / s.target) * 100;
  const delta = ((s.lotsMtd - s.lotsPrev) / s.lotsPrev) * 100;
  return (
    <SpotlightCard className="flex h-full cursor-pointer flex-col" onClick={onOpen}>
      <div className="relative h-20 overflow-hidden rounded-t-[20px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/photos/skyline.jpg" alt="" className="absolute inset-0 size-full object-cover opacity-35" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-surface" />
        <div className="absolute right-4 top-3"><StatusChip status={s.status} /></div>
      </div>
      <div className="-mt-9 px-5">
        <Avatar src={s.photo} name={s.name} size={60} className="ring-4 ring-surface rounded-full" />
        <div className="mt-2 flex items-center gap-2 text-[16px] font-medium">
          {s.name}
          <Flag country={s.country} className="size-4" />
        </div>
        <div className="mt-0.5 flex items-center justify-between text-[12.5px] text-fg-3">
          <span>{s.region} · <span className="font-mono">{s.id}</span></span>
          <Flags countries={s.countries} max={4} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 px-5 pt-4">
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-fg-3">Partners</div>
          <div className="k-num mt-0.5 text-[15px] font-medium">{s.partners}</div>
        </div>
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-fg-3">Override</div>
          <div className="k-num mt-0.5 text-[15px] font-medium text-gold">{s.overridePct}%</div>
        </div>
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-fg-3">Earned</div>
          <Money value={s.overrideEarned} decimals={0} countUp={false} className="mt-0.5 block text-[15px] font-medium" />
        </div>
      </div>
      <div className="mt-auto px-5 pb-5 pt-4">
        <div className="mb-1.5 flex justify-between text-[11.5px]">
          <span className="text-fg-3">
            <span className="k-num text-fg">{fmtInt(s.lotsMtd)}</span> / {fmtInt(s.target)} lots target
          </span>
          <span className={delta >= 0 ? "k-num text-up" : "k-num text-down"}>{delta >= 0 ? "+" : ""}{delta.toFixed(1)}%</span>
        </div>
        <Progress value={pct} tone={pct >= 100 ? "up" : "ember"} />
      </div>
    </SpotlightCard>
  );
}

export function SubBrokerDrawer({ s, open, onOpenChange, onChange }: { s: SubBroker | null; open: boolean; onOpenChange: (o: boolean) => void; onChange: (s: SubBroker) => void }) {
  const reason = useReason();
  const [ov, setOv] = React.useState(10);
  const [countries, setCountries] = React.useState<string[]>([]);
  React.useEffect(() => {
    if (s) {
      setOv(s.overridePct);
      setCountries(s.countries);
    }
  }, [s]);
  if (!s) return null;
  const partners = PARTNERS.filter((p) => p.subBroker === s.name);
  return (
    <>
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        side="right"
        title={
          <span className="flex items-center gap-3">
            <Avatar src={s.photo} name={s.name} size={44} />
            <span>
              <span className="flex items-center gap-2">{s.name}<Flag country={s.country} className="size-4" /></span>
              <span className="block text-[12px] font-normal text-fg-3">{s.region} country manager · since {fmtDate(s.since)}</span>
            </span>
          </span>
        }
        footer={
          <div className="flex w-full items-center gap-2">
            <Button variant="surface" size="sm" onClick={() => toast.success(`Message sent to ${s.name}`)}><MessageSquare /> Message</Button>
            <span className="flex-1" />
            {s.status === "paused" ? (
              <Button variant="up-outline" size="sm" onClick={() => reason.ask({ title: `Resume ${s.name}`, reasons: ["Review completed", "Contract renewed"], confirmLabel: "Resume", tone: "buy", onConfirm: (r) => { onChange({ ...s, status: "active" }); auditToast(`${s.name} resumed`, r); } })}><Play /> Resume</Button>
            ) : (
              <Button variant="down-outline" size="sm" onClick={() => reason.ask({ title: `Pause ${s.name}`, description: "Override accrual stops; partners underneath keep their own commissions.", reasons: ["Contract under review", "Target missed 3 months", "Compliance hold"], confirmLabel: "Pause override", tone: "sell", onConfirm: (r) => { onChange({ ...s, status: "paused" }); auditToast(`${s.name} override paused`, r); } })}><Pause /> Pause</Button>
            )}
          </div>
        }
      >
        <Section title="Performance · September">
          <div className="grid grid-cols-2 gap-2.5">
            <MiniStat label="Network lots" value={fmtLots(s.lotsMtd, 0)} sub={`Target ${fmtInt(s.target)}`} />
            <MiniStat label="Override earned" value={<Money value={s.overrideEarned} countUp={false} />} tone="gold" />
            <MiniStat label="Partners" value={`${s.activePartners} / ${s.partners}`} sub="active / total" />
            <MiniStat label="Net deposits" value={<Money value={s.netDeposits} decimals={0} countUp={false} />} sub="90 days" />
          </div>
        </Section>
        <Section title="Override & territory" hint="Override is paid on top of partner rebates, funded by the broker">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[140px_1fr]">
            <MiniField label="Override %"><NumInput value={ov} onChange={setOv} step={0.5} min={0} max={30} suffix="%" /></MiniField>
            <MiniField label="Countries"><ChipList values={countries} onChange={setCountries} format={(c) => c.toUpperCase()} tone="neutral" placeholder="ISO code…" /></MiniField>
          </div>
          <div className="mt-3 flex justify-end">
            <Button
              size="sm"
              variant="ember"
              onClick={() =>
                reason.ask({ title: `Update ${s.name}`, description: `Override ${s.overridePct}% → ${ov}% · ${countries.length} countries`, reasons: ["Annual renegotiation", "Territory expansion", "Performance adjustment"], confirmLabel: "Save", onConfirm: (r) => { onChange({ ...s, overridePct: ov, countries }); auditToast(`${s.name} terms updated`, r); } })
              }
            >
              <Save /> Save terms
            </Button>
          </div>
        </Section>
        <Section title="Partners in network" hint={`${partners.length} of ${s.partners} shown (top by commission)`}>
          <div className="space-y-2">
            {partners.slice(0, 8).map((p) => (
              <div key={p.id} className="k-row flex items-center gap-3 px-3.5 py-2">
                <Avatar src={p.photo} name={p.name} size={28} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium">{p.name}</div>
                  <div className="font-mono text-[11px] text-fg-3">{p.id}</div>
                </div>
                <LevelChip level={p.level} />
                <span className="k-num w-20 text-right text-[12.5px]">{fmtLots(p.lotsMtd)} lots</span>
              </div>
            ))}
            {partners.length === 0 && <div className="text-[12.5px] text-fg-3">No top-40 partners in this network.</div>}
          </div>
        </Section>
      </Dialog>
      {reason.node}
    </>
  );
}

export function AddSubBrokerDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [region, setRegion] = React.useState("GCC");
  const [countries, setCountries] = React.useState<string[]>(["ae"]);
  const [ov, setOv] = React.useState(10);
  const [target, setTarget] = React.useState(3000);
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      width={600}
      title="Add sub-broker"
      description="Country managers earn an override on every partner in their territory."
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="ember"
            size="sm"
            onClick={() => {
              if (!name || !email.includes("@")) return toast.error("Name and a valid email are required");
              onOpenChange(false);
              auditToast(`Sub-broker ${name} created`, `${region} · ${ov}% override · ${countries.length} countries`);
              setName("");
              setEmail("");
            }}
          >
            <UserPlus /> Create sub-broker
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MiniField label="Full name"><TextInput value={name} onChange={setName} placeholder="e.g. Nadia Rahimi" /></MiniField>
        <MiniField label="Email"><TextInput value={email} onChange={setEmail} placeholder="name@company.com" /></MiniField>
        <MiniField label="Region"><Select value={region} onChange={setRegion} options={["GCC", "South Asia", "South-East Asia", "West Africa", "East & South Africa", "LATAM North", "LATAM South", "Europe (EEA)", "Türkiye & Caucasus"]} /></MiniField>
        <MiniField label="Override %"><NumInput value={ov} onChange={setOv} step={0.5} min={0} max={30} suffix="%" /></MiniField>
        <MiniField label="Countries" className="sm:col-span-2"><ChipList values={countries} onChange={setCountries} format={(c) => c.toUpperCase()} tone="neutral" placeholder="Type ISO code + Enter" /></MiniField>
        <MiniField label="Monthly lots target"><NumInput value={target} onChange={setTarget} step={500} min={0} suffix="lots" /></MiniField>
        <MiniField label="Reports to"><Select value="Mariam Khoury" onChange={() => toast("Reporting line is fixed to Head of Partnerships")} options={["Mariam Khoury"]} /></MiniField>
      </div>
      <div className="mt-4 flex items-center gap-2 text-[12px] text-fg-3">
        <Chip size="sm" tone="info">KYB</Chip> A KYB request and the sub-broker agreement are emailed on creation.
      </div>
    </Dialog>
  );
}
