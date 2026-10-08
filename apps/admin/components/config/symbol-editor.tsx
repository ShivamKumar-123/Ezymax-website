"use client";

import * as React from "react";
import { Save } from "lucide-react";
import { Button, Chip, Dialog, Segmented, SymbolAvatar, Toggle, formatNumber } from "@ezymex/ui";
import { getInstrument, ASSET_CLASS_LABEL } from "@ezymex/mock";
import { SESSIONS, WEEKDAYS, type SymbolSpec, type TradeMode, type Weekday } from "@ezymex/mock/admin-config";
import { MiniField, NumInput, Section, Select, SettingRow, auditToast } from "./kit";

export const TRADE_MODE_LABEL: Record<TradeMode, string> = { full: "Full access", "close-only": "Close-only", "long-only": "Long-only", disabled: "Disabled" };

export function SymbolEditor({ spec, open, onOpenChange, onSave }: { spec: SymbolSpec | null; open: boolean; onOpenChange: (o: boolean) => void; onSave: (s: SymbolSpec) => void }) {
  const [s, setS] = React.useState<SymbolSpec | null>(spec);
  React.useEffect(() => {
    if (open && spec) setS({ ...spec });
  }, [open, spec]);
  if (!s || !spec) return null;
  const inst = getInstrument(s.symbol);
  const set = <K extends keyof SymbolSpec>(k: K, v: SymbolSpec[K]) => setS((p) => (p ? { ...p, [k]: v } : p));
  const notional = inst.price * s.contractSize;
  const margin1 = (notional * s.marginPct) / 100;
  const changed = JSON.stringify(s) !== JSON.stringify(spec);
  const lotInvalid = s.lotMin > s.lotMax || s.lotStep > s.lotMin;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      side="right"
      title={
        <span className="flex items-center gap-3">
          <SymbolAvatar symbol={s.symbol} size={26} />
          {s.symbol} contract specification
        </span>
      }
      description={`${inst.name} · ${ASSET_CLASS_LABEL[inst.assetClass]} · ${s.exchange}`}
      footer={
        <>
          <span className="mr-auto text-[12px] text-fg-3">{lotInvalid ? <span className="text-down">Lot step must be ≤ min lot ≤ max lot</span> : changed ? <span className="text-ember">Unsaved changes</span> : "Applies to all groups"}</span>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="ember"
            size="sm"
            disabled={!changed || lotInvalid}
            onClick={() => {
              onSave(s);
              auditToast(`${s.symbol} contract spec saved`, "Pushed to Ezymex-Live01/02 and Demo");
              onOpenChange(false);
            }}
          >
            <Save /> Save spec
          </Button>
        </>
      }
    >
      <Section title="Availability">
        <SettingRow label="Enabled" hint="Symbol visible and tradable in terminals">
          <Toggle checked={s.enabled} onChange={(v) => set("enabled", v)} />
        </SettingRow>
        <div className="mt-2">
          <Segmented<TradeMode>
            size="sm"
            value={s.tradeMode}
            onChange={(v) => set("tradeMode", v)}
            options={(["full", "long-only", "close-only", "disabled"] as TradeMode[]).map((m) => ({ value: m, label: TRADE_MODE_LABEL[m] }))}
          />
        </div>
      </Section>

      <Section title="Contract">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <MiniField label="Digits">
            <NumInput value={s.digits} onChange={(v) => set("digits", Math.round(v))} min={0} max={6} stepper />
          </MiniField>
          <MiniField label="Contract size">
            <NumInput value={s.contractSize} onChange={(v) => set("contractSize", v)} min={0.0001} />
          </MiniField>
          <MiniField label="Profit currency">
            <Select value={s.profitCcy} onChange={(v) => set("profitCcy", v)} options={["USD", "JPY", "CHF", "CAD", "INR", "EUR", "GBP"]} />
          </MiniField>
          <MiniField label="Stops level">
            <NumInput value={s.stopsLevel} onChange={(v) => set("stopsLevel", v)} suffix="pts" min={0} />
          </MiniField>
          <MiniField label="Execution">
            <Select value={s.execution} onChange={(v) => set("execution", v)} options={[{ value: "market", label: "Market" }, { value: "instant", label: "Instant" }]} />
          </MiniField>
          <MiniField label="Liquidity">
            <Select value={s.liquidity} onChange={(v) => set("liquidity", v)} options={["Tier-1 bank pool", "Prime of Prime", "Crypto venue", "DMA equities"]} />
          </MiniField>
        </div>
      </Section>

      <Section title="Volume">
        <div className="grid grid-cols-3 gap-3">
          <MiniField label="Min lot">
            <NumInput value={s.lotMin} onChange={(v) => set("lotMin", v)} step={0.01} min={0.001} />
          </MiniField>
          <MiniField label="Max lot">
            <NumInput value={s.lotMax} onChange={(v) => set("lotMax", v)} step={1} min={0.01} />
          </MiniField>
          <MiniField label="Step">
            <NumInput value={s.lotStep} onChange={(v) => set("lotStep", v)} step={0.01} min={0.001} />
          </MiniField>
        </div>
      </Section>

      <Section title="Margin" hint="Group leverage caps the effective rate: margin = notional × max(margin %, 1/leverage).">
        <div className="grid grid-cols-2 gap-3">
          <MiniField label="Margin requirement">
            <NumInput value={s.marginPct} onChange={(v) => set("marginPct", v)} suffix="%" step={0.1} min={0.01} max={100} />
          </MiniField>
          <MiniField label="Equivalent leverage">
            <div className="flex h-10 items-center rounded-[12px] border border-dashed border-line px-3 text-[13.5px] text-fg-2">
              1:{formatNumber(100 / s.marginPct, 0)}
            </div>
          </MiniField>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-[12.5px]">
          <div className="k-row px-3.5 py-2.5">
            <div className="text-[11px] uppercase tracking-wider text-fg-3">Notional · 1 lot</div>
            <div className="k-num mt-0.5 font-medium">${formatNumber(notional, 0)}</div>
          </div>
          <div className="k-row px-3.5 py-2.5">
            <div className="text-[11px] uppercase tracking-wider text-fg-3">Margin · 1 lot</div>
            <div className="k-num mt-0.5 font-medium text-ember">${formatNumber(margin1, 2)}</div>
          </div>
        </div>
      </Section>

      <Section title="Swaps & session">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniField label="Swap long">
            <NumInput value={s.swapLong} onChange={(v) => set("swapLong", v)} step={0.1} suffix={s.swapType === "pct" ? "%" : "pts"} />
          </MiniField>
          <MiniField label="Swap short">
            <NumInput value={s.swapShort} onChange={(v) => set("swapShort", v)} step={0.1} suffix={s.swapType === "pct" ? "%" : "pts"} />
          </MiniField>
          <MiniField label="Swap type">
            <Select value={s.swapType} onChange={(v) => set("swapType", v)} options={[{ value: "points", label: "Points" }, { value: "pct", label: "% p.a." }]} />
          </MiniField>
          <MiniField label="Triple swap">
            <Select<Weekday> value={s.tripleDay} onChange={(v) => set("tripleDay", v)} options={WEEKDAYS.slice(0, 5)} />
          </MiniField>
          <MiniField label="Session template" className="col-span-2 sm:col-span-4">
            <Select value={s.session} onChange={(v) => set("session", v)} options={SESSIONS.map((x) => ({ value: x.key, label: `${x.name} · ${x.exchange}` }))} />
          </MiniField>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Chip size="sm">Exchange {s.exchange}</Chip>
          <Chip size="sm">Server time GMT+3</Chip>
        </div>
      </Section>
    </Dialog>
  );
}
