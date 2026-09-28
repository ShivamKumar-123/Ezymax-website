"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Info, RotateCcw, Save } from "lucide-react";
import { Button, Chip, Dialog, Segmented, Toggle, cn } from "@kalks/ui";
import { ALL_LEVERAGES, type AdminGroup, type ChargeOn, type MarkupType, type Route } from "@kalks/mock/admin-config";
import { ChipList, MiniField, NumInput, Section, Select, SettingRow, Slider, TextInput, auditToast } from "./kit";

export const ROUTE_LABEL: Record<Route, string> = { A: "A-book", B: "B-book", auto: "Auto" };
export const CHARGE_LABEL: Record<ChargeOn, string> = { open: "On open", close: "On close", round: "Round-turn" };

export function blankGroup(): AdminGroup {
  return {
    id: "new", name: "New group", tagline: "", mode: "hedging", cent: false, currency: "USD", server: "Kalks-Live01",
    leverage: [50, 100, 200, 500], defaultLeverage: 200, marginCall: 100, stopOut: 50, hedgedMargin: 50, minDeposit: 100,
    swapFree: false, islamicFee: { enabled: false, perLot: 0, graceDays: 0, basis: "per-lot-night" }, route: "B",
    autoRule: { aBookAboveLots: 10, toxicityScore: 70, profitableDays: 10 }, commission: { perLot: 0, chargeOn: "round" },
    markup: { type: "fixed", value: 1, floor: 0.5 }, maxPositions: 500, maxLot: 50, clients: 0, accounts: 0, equity: 0, aBookShare: 0,
    volume30d: 0, status: "draft", tone: "neutral", updatedBy: "You", updatedAt: "2026-09-24T12:00:00Z",
  };
}

function diffCount(a: AdminGroup, b: AdminGroup) {
  let n = 0;
  const walk = (x: unknown, y: unknown) => {
    if (typeof x === "object" && x && y && !Array.isArray(x)) {
      for (const k of Object.keys(x as object)) walk((x as Record<string, unknown>)[k], (y as Record<string, unknown>)[k]);
    } else if (JSON.stringify(x) !== JSON.stringify(y)) n++;
  };
  walk(a, b);
  return n;
}

export function GroupEditor({ group, open, onOpenChange, onSave }: { group: AdminGroup | null; open: boolean; onOpenChange: (o: boolean) => void; onSave: (g: AdminGroup) => void }) {
  const [g, setG] = React.useState<AdminGroup | null>(group);
  React.useEffect(() => {
    if (open) setG(group ? structuredClone(group) : null);
  }, [open, group]);
  if (!g || !group) return null;
  const set = <K extends keyof AdminGroup>(k: K, v: AdminGroup[K]) => setG((p) => (p ? { ...p, [k]: v } : p));
  const changes = diffCount(group, g);
  const soInvalid = g.stopOut >= g.marginCall;
  const isNew = group.id === "new";

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      side="right"
      title={
        <span className="flex items-center gap-2">
          {isNew ? "Create account group" : `Edit group · ${group.name}`}
          {!isNew && <Chip size="sm">{group.clients.toLocaleString()} clients</Chip>}
        </span>
      }
      description={isNew ? "New groups start as draft and are hidden from the Client Area until published." : `Changes apply to ${group.accounts.toLocaleString()} accounts on ${group.server} at the next tick.`}
      footer={
        <>
          <span className="mr-auto text-[12px] text-fg-3">{changes ? <span className="text-ember">{changes} unsaved change{changes > 1 ? "s" : ""}</span> : "No changes"}</span>
          <Button variant="ghost" size="sm" onClick={() => setG(structuredClone(group))} disabled={!changes}>
            <RotateCcw /> Reset
          </Button>
          <Button
            variant="ember"
            size="sm"
            disabled={soInvalid || (!changes && !isNew)}
            onClick={() => {
              onSave({ ...g, id: isNew ? g.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") : g.id, updatedBy: "Priya Nair", updatedAt: "2026-09-24T12:00:00Z" });
              auditToast(isNew ? `Group “${g.name}” created as draft` : `Group “${g.name}” saved`, isNew ? undefined : `${changes} field${changes > 1 ? "s" : ""} updated`);
              onOpenChange(false);
            }}
          >
            <Save /> {isNew ? "Create group" : "Save changes"}
          </Button>
        </>
      }
    >
      <div className="-mt-1">
        <Section title="General">
          <div className="grid grid-cols-2 gap-3">
            <MiniField label="Group name" className="col-span-2 sm:col-span-1">
              <TextInput value={g.name} onChange={(v) => set("name", v)} />
            </MiniField>
            <MiniField label="Trade server" className="col-span-2 sm:col-span-1">
              <Select value={g.server} onChange={(v) => set("server", v)} options={["Kalks-Live01", "Kalks-Live02", "Kalks-Live03"]} />
            </MiniField>
            <MiniField label="Client Area tagline" className="col-span-2">
              <TextInput value={g.tagline} onChange={(v) => set("tagline", v)} placeholder="Shown on the open-account screen" />
            </MiniField>
          </div>
          <SettingRow label="Published" hint="Visible and selectable in the Client Area">
            <Toggle checked={g.status === "active"} onChange={(v) => set("status", v ? "active" : "draft")} />
          </SettingRow>
        </Section>

        <Section title="Account mode" hint="Mode is fixed per account after opening.">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmented
              value={g.mode}
              onChange={(v) => set("mode", v)}
              options={[
                { value: "hedging", label: "Hedging" },
                { value: "netting", label: "Netting" },
              ]}
            />
            <label className="flex items-center gap-3 text-[13px]">
              <span>
                <span className="font-medium">Cent account</span>
                <span className="block text-[11.5px] text-fg-3">Balances in USC (1 USD = 100 USC)</span>
              </span>
              <Toggle checked={g.cent} onChange={(v) => setG((p) => (p ? { ...p, cent: v, currency: v ? "USC" : "USD" } : p))} />
            </label>
          </div>
        </Section>

        <Section title="Leverage" hint="Options offered to clients. Tap to toggle.">
          <ChipList values={g.leverage} onChange={(v) => set("leverage", v as number[])} options={ALL_LEVERAGES} format={(v) => `1:${v}`} />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <MiniField label="Default leverage">
              <Select value={String(g.defaultLeverage)} onChange={(v) => set("defaultLeverage", +v)} options={g.leverage.map((l) => ({ value: String(l), label: `1:${l}` }))} />
            </MiniField>
            <MiniField label="Max lot per order">
              <NumInput value={g.maxLot} onChange={(v) => set("maxLot", v)} suffix="lots" min={0.01} />
            </MiniField>
          </div>
        </Section>

        <Section title="Margin" hint="Levels are equity ÷ used margin.">
          <div className="grid grid-cols-2 gap-3">
            <MiniField label="Margin call">
              <NumInput value={g.marginCall} onChange={(v) => set("marginCall", v)} suffix="%" min={0} max={1000} stepper step={5} />
            </MiniField>
            <MiniField label="Stop-out" hint={soInvalid ? <span className="text-down">Must be below MC</span> : undefined}>
              <NumInput value={g.stopOut} onChange={(v) => set("stopOut", v)} suffix="%" min={0} max={1000} stepper step={5} className={soInvalid ? "border-down/50" : undefined} />
            </MiniField>
          </div>
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between text-[12px]">
              <span className="font-medium text-fg-2">Hedged margin</span>
              <span className="k-num font-semibold text-ember">{g.hedgedMargin}%</span>
            </div>
            <Slider value={g.hedgedMargin} onChange={(v) => set("hedgedMargin", v)} marks={[0, 25, 50, 75, 100]} />
            <p className="mt-2 text-[11.5px] text-fg-3">Margin charged on the smaller leg of a locked (hedged) position. 0% = fully offset, 100% = both legs margined.</p>
          </div>
        </Section>

        <Section title="Deposits">
          <div className="grid grid-cols-2 gap-3">
            <MiniField label="Minimum first deposit">
              <NumInput value={g.minDeposit} onChange={(v) => set("minDeposit", v)} prefix="$" min={0} />
            </MiniField>
            <MiniField label="Max open positions">
              <NumInput value={g.maxPositions} onChange={(v) => set("maxPositions", v)} min={1} />
            </MiniField>
          </div>
        </Section>

        <Section title="Swap-free / Islamic">
          <SettingRow label="Swap-free" hint="No overnight swaps charged or paid">
            <Toggle checked={g.swapFree} onChange={(v) => setG((p) => (p ? { ...p, swapFree: v, islamicFee: { ...p.islamicFee, enabled: v ? p.islamicFee.enabled : false } } : p))} />
          </SettingRow>
          <SettingRow label="Islamic admin fee" hint="Flat fee instead of swap, after grace nights">
            <Toggle checked={g.islamicFee.enabled} onChange={(v) => set("islamicFee", { ...g.islamicFee, enabled: v, perLot: v && !g.islamicFee.perLot ? 5 : g.islamicFee.perLot, graceDays: v && !g.islamicFee.graceDays ? 3 : g.islamicFee.graceDays })} />
          </SettingRow>
          <div className={cn("mt-2 grid grid-cols-3 gap-3 transition-opacity", !g.islamicFee.enabled && "pointer-events-none opacity-40")}>
            <MiniField label="Fee">
              <NumInput value={g.islamicFee.perLot} onChange={(v) => set("islamicFee", { ...g.islamicFee, perLot: v })} prefix="$" step={0.5} min={0} />
            </MiniField>
            <MiniField label="Grace nights">
              <NumInput value={g.islamicFee.graceDays} onChange={(v) => set("islamicFee", { ...g.islamicFee, graceDays: v })} min={0} max={30} />
            </MiniField>
            <MiniField label="Basis">
              <Select value={g.islamicFee.basis} onChange={(v) => set("islamicFee", { ...g.islamicFee, basis: v })} options={[{ value: "per-lot-night", label: "Per lot / night" }, { value: "flat-night", label: "Flat / night" }]} />
            </MiniField>
          </div>
        </Section>

        <Section title="Execution route">
          <Segmented
            value={g.route}
            onChange={(v) => set("route", v)}
            options={[
              { value: "A", label: "A-book (LP)" },
              { value: "B", label: "B-book (internal)" },
              { value: "auto", label: "Auto" },
            ]}
          />
          {g.route === "auto" ? (
            <div className="mt-3 grid grid-cols-3 gap-3">
              <MiniField label="A-book above">
                <NumInput value={g.autoRule.aBookAboveLots} onChange={(v) => set("autoRule", { ...g.autoRule, aBookAboveLots: v })} suffix="lots" />
              </MiniField>
              <MiniField label="Toxicity ≥">
                <NumInput value={g.autoRule.toxicityScore} onChange={(v) => set("autoRule", { ...g.autoRule, toxicityScore: v })} suffix="/100" max={100} />
              </MiniField>
              <MiniField label="Profitable days">
                <NumInput value={g.autoRule.profitableDays} onChange={(v) => set("autoRule", { ...g.autoRule, profitableDays: v })} suffix="of 20" max={20} />
              </MiniField>
            </div>
          ) : (
            <p className="mt-3 flex items-start gap-2 text-[12px] text-fg-3">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              {g.route === "A" ? "Every order is hedged 1:1 with the LP bridge (Kalks-LP · Tier-1 pool). Broker earns commission + markup only." : "Orders are internalised; exposure is netted on the dealer desk and hedged by risk thresholds."}
            </p>
          )}
        </Section>

        <Section
          title="Commission"
          action={
            <Link href="/config/charges" className="inline-flex items-center gap-1 text-[12px] text-fg-3 hover:text-ember">
              Per asset class <ArrowUpRight className="size-3" />
            </Link>
          }
        >
          <div className="grid grid-cols-[1fr_auto] items-end gap-3">
            <MiniField label="Per lot (default)">
              <NumInput value={g.commission.perLot} onChange={(v) => set("commission", { ...g.commission, perLot: v })} prefix="$" step={0.5} min={0} />
            </MiniField>
            <Segmented
              size="sm"
              className="mb-0.5"
              value={g.commission.chargeOn}
              onChange={(v) => set("commission", { ...g.commission, chargeOn: v })}
              options={[
                { value: "open", label: "Open" },
                { value: "close", label: "Close" },
                { value: "round", label: "Round-turn" },
              ]}
            />
          </div>
        </Section>

        <Section
          title="Spread markup"
          hint="Default for every symbol in this group; overrides live in the matrix."
          action={
            <Link href="/config/spreads" className="inline-flex items-center gap-1 text-[12px] text-fg-3 hover:text-ember">
              Per symbol <ArrowUpRight className="size-3" />
            </Link>
          }
        >
          <div className="grid grid-cols-3 gap-3">
            <MiniField label="Type">
              <Select<MarkupType> value={g.markup.type} onChange={(v) => set("markup", { ...g.markup, type: v })} options={[{ value: "fixed", label: "Fixed pips" }, { value: "pct", label: "% of raw" }]} />
            </MiniField>
            <MiniField label="Markup">
              <NumInput value={g.markup.value} onChange={(v) => set("markup", { ...g.markup, value: v })} suffix={g.markup.type === "fixed" ? "pips" : "%"} step={0.1} min={0} />
            </MiniField>
            <MiniField label="Min floor">
              <NumInput value={g.markup.floor} onChange={(v) => set("markup", { ...g.markup, floor: v })} suffix="pips" step={0.1} min={0} />
            </MiniField>
          </div>
          <div className="mt-3 rounded-[12px] border border-line bg-surface-2 px-3.5 py-2.5 text-[12px] text-fg-2">
            EURUSD preview: raw <span className="k-num font-medium text-fg">0.2</span> →{" "}
            <span className="k-num font-semibold text-ember">
              {Math.max(g.markup.floor, g.markup.type === "fixed" ? 0.2 + g.markup.value : 0.2 * (1 + g.markup.value / 100)).toFixed(1)} pips
            </span>{" "}
            client spread
          </div>
        </Section>
      </div>
    </Dialog>
  );
}
