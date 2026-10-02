"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight, Plus, Rocket, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Dialog, Field, Icon3D, Input, Segmented, Stepper, Toggle, cn } from "@kalks/ui";
import { MKT_COUNTRIES, MKT_SEGMENTS, type MktSegment } from "@kalks/mock/admin-growth-marketing";
import { ChipPicker, CountryPicker, NumField, SectionLabel, fmtInt } from "./kit";

const STEPS = ["Basics", "Rules", "Prizes", "Audience", "Review"];

export function rankIcon(i: number) {
  return i === 0 ? { name: "trophy", cls: "" } : i === 1 ? { name: "gem_stone", cls: "" } : i === 2 ? { name: "coin", cls: "" } : { name: "money_bag", cls: "opacity-80" };
}

export function ContestWizard({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [step, setStep] = React.useState(0);
  const [name, setName] = React.useState("October FX Masters");
  const [type, setType] = React.useState<"demo" | "live">("live");
  const [instrument, setInstrument] = React.useState<"cfd" | "options">("cfd");
  const [metric, setMetric] = React.useState<"gain" | "profit" | "sharpe">("gain");
  const [start, setStart] = React.useState("2026-10-01");
  const [end, setEnd] = React.useState("2026-10-31");
  const [minDeposit, setMinDeposit] = React.useState(200);
  const [minTrades, setMinTrades] = React.useState(20);
  const [maxLeverage, setMaxLeverage] = React.useState(500);
  const [capacity, setCapacity] = React.useState(2000);
  const [newOnly, setNewOnly] = React.useState(false);
  const [prizes, setPrizes] = React.useState([10000, 5000, 2500, 1000, 500]);
  const [segments, setSegments] = React.useState<MktSegment[]>(["All clients"]);
  const [countries, setCountries] = React.useState<string[]>(["in", "ae", "vn", "my", "br", "ng"]);
  React.useEffect(() => {
    if (open) setStep(0);
  }, [open]);
  const pool = prizes.reduce((s, p) => s + p, 0);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      width={760}
      title="New contest"
      description="Configure the competition, prizes and who can join."
      footer={
        <>
          <Button size="sm" variant="ghost" className="mr-auto" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            <ArrowLeft /> Back
          </Button>
          <Button size="sm" variant="surface" onClick={() => toast.success("Contest saved as draft", { description: name })}>
            Save draft
          </Button>
          {step < STEPS.length - 1 ? (
            <Button size="sm" variant="ember" onClick={() => setStep((s) => s + 1)}>
              Continue <ArrowRight />
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ember"
              onClick={() => {
                toast.success(`${name} scheduled`, { description: `${type === "live" ? "Live" : "Demo"}${instrument === "options" ? " · Options" : ""} · $${fmtInt(pool)} pool · starts ${start}` });
                onOpenChange(false);
              }}
            >
              <Rocket /> Launch contest
            </Button>
          )}
        </>
      }
    >
      <Stepper steps={STEPS} current={step} className="mb-6" />
      <div className="min-h-[340px]">
        {step === 0 && (
          <div className="space-y-4">
            <Field label="Contest name">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <SectionLabel>Account type</SectionLabel>
                <div className="grid grid-cols-2 gap-2">
                  {(["demo", "live"] as const).map((t) => (
                    <button key={t} type="button" onClick={() => setType(t)} className={cn("k-row flex items-center gap-3 p-3 text-left transition-all", type === t && "border-ember/50 bg-ember-soft")}>
                      <Icon3D name={t === "demo" ? "laptop" : "money_bag"} size={32} />
                      <div>
                        <div className="text-[13.5px] font-medium capitalize">{t}</div>
                        <div className="text-[11.5px] text-fg-3">{t === "demo" ? "Virtual $10k" : "Real funds"}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <SectionLabel>Ranking metric</SectionLabel>
                <Segmented size="md" value={metric} onChange={setMetric} options={[{ value: "gain", label: "Gain %" }, { value: "profit", label: "Net profit" }, { value: "sharpe", label: "Sharpe" }]} />
              </div>
            </div>
            <div>
              <SectionLabel>Instrument</SectionLabel>
              <Segmented
                size="md"
                value={instrument}
                onChange={setInstrument}
                options={[
                  { value: "cfd", label: "CFD (lots)" },
                  { value: "options", label: "Options (contracts)" },
                ]}
              />
              {instrument === "options" && <div className="mt-1.5 text-[11.5px] text-fg-3">Only Kalks FX Options trades count, on realised P&L, volume in contracts. Clients need the options intro.</div>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Starts (GMT+3)">
                <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
              </Field>
              <Field label="Ends (GMT+3)">
                <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
              </Field>
            </div>
          </div>
        )}
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Min deposit" hint={type === "demo" ? "n/a for demo" : undefined}>
                <NumField value={type === "demo" ? 0 : minDeposit} onChange={setMinDeposit} prefix="$" />
              </Field>
              <Field label="Min trades to qualify">
                <NumField value={minTrades} onChange={setMinTrades} suffix="trades" />
              </Field>
              <Field label="Max leverage">
                <NumField value={maxLeverage} onChange={setMaxLeverage} prefix="1:" />
              </Field>
              <Field label="Capacity">
                <NumField value={capacity} onChange={setCapacity} suffix="entrants" />
              </Field>
            </div>
            <div className="k-row divide-y divide-line px-4">
              <div className="flex items-center justify-between py-3">
                <div>
                  <div className="text-[13.5px] font-medium">New clients only</div>
                  <div className="text-[12px] text-fg-3">Registered after the contest is announced</div>
                </div>
                <Toggle checked={newOnly} onChange={setNewOnly} label="New clients only" />
              </div>
              <div className="py-3 text-[12.5px] text-fg-3">Integrity: hedging across entrant accounts, copy-trading and trades under 60 seconds are excluded automatically.</div>
            </div>
          </div>
        )}
        {step === 2 && (
          <div>
            <SectionLabel action={<span className="k-num text-[13px] text-gold">Pool ${fmtInt(pool)}</span>}>Prize table</SectionLabel>
            <div className="space-y-2">
              {prizes.map((p, i) => {
                const ic = rankIcon(i);
                return (
                  <div key={i} className="k-row flex items-center gap-3 px-3 py-2">
                    <Icon3D name={ic.name} size={30} className={ic.cls} />
                    <span className="k-num w-12 text-[13px] font-medium">{i + 1}{["st", "nd", "rd"][i] ?? "th"}</span>
                    <NumField value={p} onChange={(v) => setPrizes((x) => x.map((y, j) => (j === i ? v : y)))} prefix="$" className="flex-1" />
                    <button type="button" aria-label="Remove prize" onClick={() => setPrizes((x) => x.filter((_, j) => j !== i))} className="grid size-8 place-items-center rounded-full text-fg-3 hover:bg-surface-3 hover:text-down">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                );
              })}
            </div>
            <Button size="sm" variant="surface" className="mt-3" onClick={() => setPrizes((x) => [...x, 250])}>
              <Plus /> Add prize rank
            </Button>
          </div>
        )}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <SectionLabel>Segments</SectionLabel>
              <ChipPicker options={MKT_SEGMENTS} value={segments} onChange={setSegments} />
            </div>
            <div>
              <SectionLabel>Countries</SectionLabel>
              <CountryPicker options={MKT_COUNTRIES} value={countries} onChange={setCountries} />
            </div>
          </div>
        )}
        {step === 4 && (
          <div className="k-hot-card relative overflow-hidden rounded-[18px] p-6">
            <Icon3D name="trophy" size={96} className="absolute right-4 top-4" />
            <div className="k-label text-ember">Ready to launch</div>
            <div className="mt-2 text-[22px] font-medium tracking-tight">{name}</div>
            <div className="mt-4 grid max-w-md grid-cols-2 gap-x-6 gap-y-3 text-[13px]">
              {[
                ["Type", type === "live" ? "Live" : "Demo"],
                ["Ranking", metric === "gain" ? "Gain %" : metric === "profit" ? "Net profit" : "Sharpe ratio"],
                ["Dates", `${start} → ${end}`],
                ["Prize pool", `$${fmtInt(pool)} · ${prizes.length} ranks`],
                ["Min deposit", type === "demo" ? "—" : `$${fmtInt(minDeposit)}`],
                ["Capacity", fmtInt(capacity)],
                ["Segments", segments.join(", ")],
                ["Countries", `${countries.length} selected`],
              ].map(([k, v]) => (
                <div key={k}>
                  <div className="text-[11px] uppercase tracking-[0.06em] text-fg-3">{k}</div>
                  <div className="k-num mt-0.5 font-medium">{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
