"use client";

import * as React from "react";
import { Info, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button, Dialog, DialogClose, Field, Icon3D, Input, Segmented, Toggle, cn } from "@ezymex/ui";
import { MKT_COUNTRIES, MKT_GROUPS, type MktBonusCampaign, type MktBonusKind, type MktGroup } from "@ezymex/mock/admin-growth-marketing";
import { ChipPicker, CountryPicker, NumField, SectionLabel, fmtInt } from "./kit";

interface Draft {
  name: string;
  kind: MktBonusKind;
  pct: number;
  fixed: number;
  max: number;
  minDeposit: number;
  releasePerLot: number;
  expiryDays: number;
  groups: MktGroup[];
  countries: string[];
  start: string;
  end: string;
  kyc: boolean;
  forfeitOnWithdraw: boolean;
  stackable: boolean;
  oncePerClient: boolean;
}

const EMPTY: Draft = {
  name: "",
  kind: "deposit",
  pct: 25,
  fixed: 30,
  max: 2500,
  minDeposit: 100,
  releasePerLot: 2,
  expiryDays: 60,
  groups: ["Standard", "Pro"],
  countries: ["in", "ae", "my"],
  start: "2026-10-01",
  end: "2026-12-31",
  kyc: true,
  forfeitOnWithdraw: true,
  stackable: false,
  oncePerClient: true,
};

function fromCampaign(c: MktBonusCampaign): Draft {
  return {
    ...EMPTY,
    name: c.name,
    kind: c.kind,
    pct: c.pct,
    fixed: c.fixed,
    max: c.max,
    minDeposit: c.minDeposit,
    releasePerLot: c.releasePerLot,
    expiryDays: c.expiryDays,
    groups: [...c.groups],
    countries: [...c.countries],
    start: c.start.slice(0, 10),
    end: c.end?.slice(0, 10) ?? "",
  };
}

export function BonusEditor({ open, onOpenChange, campaign }: { open: boolean; onOpenChange: (o: boolean) => void; campaign: MktBonusCampaign | null }) {
  const [d, setD] = React.useState<Draft>(EMPTY);
  React.useEffect(() => {
    if (open) setD(campaign ? fromCampaign(campaign) : EMPTY);
  }, [open, campaign]);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  const exampleDeposit = d.kind === "no-deposit" ? 0 : Math.max(d.minDeposit, 1000);
  const credit = d.kind === "no-deposit" ? d.fixed : Math.min(d.max, (exampleDeposit * d.pct) / 100);
  const lots = d.releasePerLot > 0 ? credit / d.releasePerLot : 0;
  const lotsPerDay = d.expiryDays > 0 ? lots / d.expiryDays : 0;
  const hard = lotsPerDay > 3;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      side="right"
      title={campaign ? `Edit · ${campaign.name}` : "New bonus campaign"}
      description="Credit is non-withdrawable and releases to balance as the client trades."
      footer={
        <>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="surface"
            size="sm"
            onClick={() => {
              toast.success("Draft saved", { description: d.name || "Untitled campaign" });
              onOpenChange(false);
            }}
          >
            Save draft
          </Button>
          <Button
            variant="ember"
            size="sm"
            onClick={() => {
              if (!d.name.trim()) {
                toast.error("Give the campaign a name first");
                return;
              }
              toast.success(campaign ? `${d.name} updated` : `${d.name} created`, { description: `${d.groups.length} groups · ${d.countries.length} countries · change logged to audit trail` });
              onOpenChange(false);
            }}
          >
            {campaign ? "Save changes" : "Create campaign"}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <div className="space-y-3">
          <Field label="Campaign name">
            <Input value={d.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. 30% welcome credit" />
          </Field>
          <div>
            <SectionLabel>Bonus type</SectionLabel>
            <Segmented
              size="sm"
              value={d.kind}
              onChange={(v) => set("kind", v)}
              options={[
                { value: "deposit", label: "Deposit %" },
                { value: "reload", label: "Reload" },
                { value: "crypto", label: "Crypto" },
                { value: "no-deposit", label: "No-deposit" },
              ]}
            />
          </div>
        </div>

        <div>
          <SectionLabel>Credit rules</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            {d.kind === "no-deposit" ? (
              <Field label="Fixed credit">
                <NumField value={d.fixed} onChange={(v) => set("fixed", v)} prefix="$" />
              </Field>
            ) : (
              <Field label="Bonus %">
                <NumField value={d.pct} onChange={(v) => set("pct", v)} suffix="% of deposit" />
              </Field>
            )}
            <Field label="Max credit per client">
              <NumField value={d.max} onChange={(v) => set("max", v)} prefix="$" />
            </Field>
            <Field label="Min deposit">
              <NumField value={d.minDeposit} onChange={(v) => set("minDeposit", v)} prefix="$" />
            </Field>
            <Field label="Release per lot" hint="to balance">
              <NumField value={d.releasePerLot} onChange={(v) => set("releasePerLot", v)} prefix="$" suffix="/ 1 lot" step={0.5} />
            </Field>
            <Field label="Expiry">
              <NumField value={d.expiryDays} onChange={(v) => set("expiryDays", v)} suffix="days" />
            </Field>
            <Field label="Schedule">
              <div className="grid grid-cols-2 gap-1.5">
                <Input type="date" value={d.start} onChange={(e) => set("start", e.target.value)} className="h-10 px-2.5 text-[12.5px]" />
                <Input type="date" value={d.end} onChange={(e) => set("end", e.target.value)} className="h-10 px-2.5 text-[12.5px]" />
              </div>
            </Field>
          </div>
        </div>

        <div>
          <SectionLabel action={<span className="text-[11.5px] text-fg-3">{d.groups.length} selected</span>}>Eligible account groups</SectionLabel>
          <ChipPicker options={MKT_GROUPS} value={d.groups} onChange={(v) => set("groups", v)} />
        </div>

        <div>
          <SectionLabel
            action={
              <button type="button" className="text-[11.5px] text-ember hover:underline" onClick={() => set("countries", d.countries.length === MKT_COUNTRIES.length ? [] : MKT_COUNTRIES.map((c) => c.code))}>
                {d.countries.length === MKT_COUNTRIES.length ? "Clear all" : "Select all"}
              </button>
            }
          >
            Eligible countries
          </SectionLabel>
          <CountryPicker options={MKT_COUNTRIES} value={d.countries} onChange={(v) => set("countries", v)} />
        </div>

        <div className="k-row divide-y divide-line px-4">
          {(
            [
              ["kyc", "Require full KYC", "Credit is granted only after verification"],
              ["forfeitOnWithdraw", "Forfeit on withdrawal", "Any withdrawal removes unreleased credit"],
              ["stackable", "Stack with other bonuses", "Allow alongside another active credit"],
              ["oncePerClient", "Once per client", "Limit by client ID, device and payment method"],
            ] as const
          ).map(([k, label, hint]) => (
            <div key={k} className="flex items-center justify-between gap-4 py-3">
              <div>
                <div className="text-[13.5px] font-medium">{label}</div>
                <div className="text-[12px] text-fg-3">{hint}</div>
              </div>
              <Toggle checked={d[k]} onChange={(v) => set(k, v)} label={label} />
            </div>
          ))}
        </div>

        <div className="k-hot-card relative overflow-hidden rounded-[18px] p-5">
          <div className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.06em] text-ember">
            <Sparkles className="size-3.5" /> Preview
          </div>
          <div className="mt-2 max-w-[80%] text-[17px] font-medium leading-snug tracking-tight">
            {d.kind === "no-deposit" ? (
              <>
                New live client receives <span className="k-num text-gold">${fmtInt(credit)}</span> credit without depositing.
              </>
            ) : (
              <>
                Client deposits <span className="k-num">${fmtInt(exampleDeposit)}</span> and receives <span className="k-num text-gold">${fmtInt(Math.round(credit))}</span> credit.
              </>
            )}
          </div>
          <ul className="mt-3 space-y-1.5 text-[13px] text-fg-2">
            <li>
              Releases <span className="k-num text-fg">${d.releasePerLot}</span> to balance per lot traded, fully released after <span className="k-num text-fg">{lots.toFixed(1)}</span> lots.
            </li>
            <li>
              Unreleased credit expires after <span className="k-num text-fg">{d.expiryDays}</span> days ({lotsPerDay.toFixed(2)} lots/day to fully release).
            </li>
            <li>
              {d.groups.length ? d.groups.join(", ") : "No groups"} · {d.countries.length} countries{d.kyc ? " · KYC required" : ""}.
            </li>
          </ul>
          <div className={cn("mt-3 flex items-start gap-2 rounded-xl border px-3 py-2 text-[12px]", hard ? "border-warn/30 bg-warn-soft text-warn" : "border-up/25 bg-up-soft text-up")}>
            <Info className="mt-0.5 size-3.5 shrink-0" />
            {hard ? "Release pace looks aggressive — most clients will not fully release before expiry." : "Release pace is achievable for an average active client (0.8 lots/day)."}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
