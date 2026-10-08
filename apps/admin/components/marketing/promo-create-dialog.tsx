"use client";

import * as React from "react";
import { CalendarDays, Dices, Save, Sparkles, Ticket } from "lucide-react";
import { toast } from "sonner";
import { Button, Dialog, DialogClose, Field, Icon3D, Input, Toggle, cn } from "@ezymex/ui";
import { PROMO_SEGMENTS, PROMO_TYPE_META, type PromoCode, type PromoSegment, type PromoType } from "@ezymex/mock/admin-promo-codes";
import { PEOPLE } from "@ezymex/mock";
import { NumField, SectionLabel, fmtDate } from "./kit";

const CAP_DEFAULT: Record<PromoType, string> = { "deposit-bonus": "3000", "fee-waiver": "14", "prop-retry": "50000" };

function randomCode() {
  const words = ["GOLD", "PIPS", "BOOST", "EDGE", "ALPHA", "FLOW", "PRIME", "SURGE"];
  const w = words[Math.floor(Math.random() * words.length)]!;
  return `${w}${Math.floor(10 + Math.random() * 89)}`;
}

export function PromoCreateDialog({ open, onOpenChange, onCreate }: { open: boolean; onOpenChange: (o: boolean) => void; onCreate: (c: PromoCode) => void }) {
  const [code, setCode] = React.useState("AUTUMN40");
  const [type, setType] = React.useState<PromoType>("deposit-bonus");
  const [value, setValue] = React.useState(40);
  const [cap, setCap] = React.useState(CAP_DEFAULT["deposit-bonus"]);
  const [limit, setLimit] = React.useState(2000);
  const [perClient, setPerClient] = React.useState(1);
  const [minDeposit, setMinDeposit] = React.useState(200);
  const [starts, setStarts] = React.useState("2026-10-01");
  const [expires, setExpires] = React.useState("2026-11-30");
  const [segment, setSegment] = React.useState<PromoSegment>("First-time depositors");
  const [stack, setStack] = React.useState(false);
  const [kycOnly, setKycOnly] = React.useState(true);

  const pickType = (t: PromoType) => {
    setType(t);
    setCap(CAP_DEFAULT[t]);
    setValue(t === "deposit-bonus" ? 40 : t === "fee-waiver" ? 100 : 1);
  };

  const valueLabel = type === "deposit-bonus" ? `${value}% bonus` : type === "fee-waiver" ? `${value}% fees waived` : `${value} free ${value === 1 ? "retry" : "retries"}`;
  const capLabel = type === "deposit-bonus" ? `up to $${Number(cap).toLocaleString("en-US")}` : type === "fee-waiver" ? `${cap} days` : `plans ≤ $${Math.round(Number(cap) / 1000)}K`;
  const valid = /^[A-Z0-9-]{4,16}$/.test(code) && value > 0 && limit > 0 && expires > starts;

  const submit = () => {
    if (!valid) {
      toast.error("Check the form", { description: "Code must be 4–16 characters (A–Z, 0–9, -) and expiry after start." });
      return;
    }
    const scheduled = starts > "2026-09-24";
    onCreate({
      id: `prm_${Date.now()}`,
      code,
      type,
      value,
      cap: capLabel,
      uses: 0,
      limit,
      perClient,
      minDeposit,
      starts: `${starts}T00:00:00+03:00`,
      expires: `${expires}T23:59:00+03:00`,
      segment,
      status: scheduled ? "scheduled" : "active",
      createdBy: PEOPLE[4]!,
      deposits: 0,
      cost: 0,
      daily: Array(14).fill(0),
    });
    toast.success(`${code} created`, { description: `${valueLabel} · ${segment} · ${scheduled ? `goes live ${fmtDate(starts)}` : "live now"}` });
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="New promo code"
      description="Codes are validated at deposit, checkout or challenge purchase. Every redemption is logged with device and IP."
      width={760}
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
              toast.success(`${code} saved as draft`, { description: "Drafts are not redeemable until published." });
              onOpenChange(false);
            }}
          >
            <Save /> Save draft
          </Button>
          <Button variant="ember" size="sm" onClick={submit} disabled={!valid}>
            <Ticket /> Create code
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_240px]">
        <div className="space-y-5">
          <Field label="Code" hint="A–Z, 0–9 and dashes">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 16))}
              inputClassName="font-mono tracking-wider"
              trailing={
                <button type="button" onClick={() => setCode(randomCode())} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[12px] text-fg-2 hover:bg-surface-3 hover:text-fg">
                  <Dices className="size-3.5" /> Generate
                </button>
              }
            />
          </Field>

          <div>
            <SectionLabel>Benefit type</SectionLabel>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(Object.keys(PROMO_TYPE_META) as PromoType[]).map((t) => {
                const m = PROMO_TYPE_META[t];
                const on = type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => pickType(t)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-[14px] border px-3 py-2.5 text-left transition-all",
                      on ? "border-ember/40 bg-ember-soft shadow-[0_0_24px_-12px_rgba(255,90,31,0.9)]" : "border-line bg-surface-2 hover:bg-surface-3",
                    )}
                  >
                    <Icon3D name={m.icon} size={30} />
                    <span className={cn("text-[13px] font-medium", on ? "text-fg" : "text-fg-2")}>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={type === "deposit-bonus" ? "Bonus %" : type === "fee-waiver" ? "Fees waived %" : "Free retries"}>
              <NumField value={value} onChange={(v) => setValue(Math.max(0, type === "prop-retry" ? Math.min(3, v) : Math.min(200, v)))} suffix={type === "prop-retry" ? "retries" : "%"} />
            </Field>
            <Field label={type === "deposit-bonus" ? "Max bonus" : type === "fee-waiver" ? "Duration" : "Max plan size"}>
              <NumField value={Number(cap)} onChange={(v) => setCap(String(v))} prefix={type === "fee-waiver" ? undefined : "$"} suffix={type === "fee-waiver" ? "days" : "USD"} />
            </Field>
            <Field label="Total usage limit">
              <NumField value={limit} onChange={setLimit} suffix="redemptions" />
            </Field>
            <Field label="Per client">
              <NumField value={perClient} onChange={(v) => setPerClient(Math.max(1, v))} suffix="max" />
            </Field>
            {type !== "prop-retry" && (
              <Field label="Minimum deposit">
                <NumField value={minDeposit} onChange={setMinDeposit} prefix="$" />
              </Field>
            )}
            <Field label="Segment">
              <div className="relative flex h-10 items-center rounded-[12px] border border-line bg-surface-2 px-3 text-sm">
                <select value={segment} onChange={(e) => setSegment(e.target.value as PromoSegment)} className="h-full w-full cursor-pointer appearance-none bg-transparent text-fg outline-none [&>option]:bg-surface">
                  {PROMO_SEGMENTS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
            </Field>
            <Field label="Starts">
              <Input type="date" value={starts} onChange={(e) => setStarts(e.target.value)} className="h-10 rounded-[12px]" leading={<CalendarDays />} inputClassName="[color-scheme:dark]" />
            </Field>
            <Field label="Expires" error={expires <= starts ? "Expiry must be after start" : undefined}>
              <Input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} className="h-10 rounded-[12px]" leading={<CalendarDays />} inputClassName="[color-scheme:dark]" />
            </Field>
          </div>

          <div className="space-y-2">
            <div className="k-row flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <div className="text-[13px] font-medium">Verified clients only</div>
                <div className="text-[11.5px] text-fg-3">Block redemption until KYC is approved</div>
              </div>
              <Toggle checked={kycOnly} onChange={setKycOnly} label="Verified clients only" />
            </div>
            <div className="k-row flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <div className="text-[13px] font-medium">Stack with other promotions</div>
                <div className="text-[11.5px] text-fg-3">Off: one active promo per account (recommended)</div>
              </div>
              <Toggle checked={stack} onChange={setStack} label="Stackable" />
            </div>
          </div>
        </div>

        {/* Live ticket preview */}
        <div className="md:sticky md:top-0 md:self-start">
          <SectionLabel>Client preview</SectionLabel>
          <div className="relative overflow-hidden rounded-[18px] border border-ember/30 bg-[radial-gradient(120%_90%_at_100%_0%,rgba(255,90,31,0.35),transparent_60%),linear-gradient(180deg,#1b1310,#0d0b0a)] p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-white/60">Promo code</span>
              <Icon3D name={PROMO_TYPE_META[type].icon} size={34} />
            </div>
            <div className="mt-2 font-mono text-[22px] font-semibold tracking-[0.08em] text-white">{code || "CODE"}</div>
            <div className="mt-1 text-[13px] font-medium text-ember-2">{valueLabel}</div>
            <div className="text-[11.5px] text-white/60">{capLabel}</div>
            <div className="relative my-3 border-t border-dashed border-white/15">
              <span className="absolute -left-6 -top-2 size-4 rounded-full bg-surface" />
              <span className="absolute -right-6 -top-2 size-4 rounded-full bg-surface" />
            </div>
            <div className="space-y-1 text-[11.5px] text-white/70">
              <div className="flex justify-between">
                <span>Valid</span>
                <span className="k-num text-white">
                  {fmtDate(starts, false)} – {fmtDate(expires, false)}
                </span>
              </div>
              {type !== "prop-retry" && (
                <div className="flex justify-between">
                  <span>Min deposit</span>
                  <span className="k-num text-white">${minDeposit.toLocaleString("en-US")}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Limit</span>
                <span className="k-num text-white">
                  {perClient}/client · {limit.toLocaleString("en-US")} total
                </span>
              </div>
            </div>
          </div>
          <p className="mt-3 flex gap-2 text-[11.5px] leading-relaxed text-fg-3">
            <Sparkles className="mt-0.5 size-3.5 shrink-0 text-gold" />
            Estimated reach for “{segment}”: <span className="k-num text-fg-2">{(8400 + segment.length * 173).toLocaleString("en-US")}</span> clients.
          </p>
        </div>
      </div>
    </Dialog>
  );
}
