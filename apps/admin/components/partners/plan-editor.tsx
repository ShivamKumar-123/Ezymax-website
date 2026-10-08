"use client";

import * as React from "react";
import { Minus, Plus, Trash2, Wand2 } from "lucide-react";
import { Button, Card, CardHeader, Chip, Flag, Menu, Toggle, cn } from "@ezymex/ui";
import { LEVELS, SYMBOL_GROUPS, type CommissionPlan, type LevelKey, type SymbolGroup } from "@ezymex/mock/admin-partners";
import { ChipList, MiniField, NumInput, SettingRow, Select } from "@/components/config/kit";
import { LEVEL_COLOR } from "./common";

const GROUP_HINT: Record<SymbolGroup, string> = {
  "Forex majors": "EURUSD, GBPUSD, USDJPY…",
  "Forex minors": "GBPJPY, EURJPY, USDINR…",
  Metals: "XAUUSD, XAGUSD",
  Indices: "NAS100, US30, GER40…",
  Energies: "USOIL, UKOIL",
  Crypto: "BTCUSD, ETHUSD, SOLUSD…",
  Stocks: "AAPL, TSLA, NVDA… (per 100 sh)",
};

export function RateMatrix({ plan, base, onChange }: { plan: CommissionPlan; base: CommissionPlan; onChange: (p: CommissionPlan) => void }) {
  const set = (g: SymbolGroup, l: LevelKey, v: number) => onChange({ ...plan, rates: { ...plan.rates, [g]: { ...plan.rates[g], [l]: v } } });
  const scale = (f: number) => {
    const rates = { ...plan.rates };
    for (const g of SYMBOL_GROUPS) rates[g] = Object.fromEntries(LEVELS.map((l) => [l.key, +(plan.rates[g][l.key] * f).toFixed(2)])) as Record<LevelKey, number>;
    onChange({ ...plan, rates });
  };
  const fromMultipliers = () => {
    const rates = { ...plan.rates };
    for (const g of SYMBOL_GROUPS) rates[g] = Object.fromEntries(LEVELS.map((l) => [l.key, +(plan.rates[g].bronze * l.benefits.rateMultiplier).toFixed(2)])) as Record<LevelKey, number>;
    onChange({ ...plan, rates });
  };
  const changed = SYMBOL_GROUPS.reduce((s, g) => s + LEVELS.filter((l) => plan.rates[g][l.key] !== base.rates[g][l.key]).length, 0);
  return (
    <Card className="h-full">
      <CardHeader
        title="Rebate matrix"
        subtitle="USD per round-turn lot · symbol group × partner level"
        action={
          <>
            {changed > 0 && <Chip tone="ember" dot>{changed} edited</Chip>}
            <Menu
              trigger={
                <Button size="sm" variant="surface">
                  <Wand2 /> Bulk
                </Button>
              }
              items={[
                { label: "Derive from Bronze × level multiplier", onSelect: fromMultipliers },
                "sep",
                { label: "Increase all by 5%", onSelect: () => scale(1.05) },
                { label: "Increase all by 10%", onSelect: () => scale(1.1) },
                { label: "Decrease all by 5%", onSelect: () => scale(0.95) },
                "sep",
                { label: "Reset to published", onSelect: () => onChange({ ...plan, rates: base.rates }), danger: true },
              ]}
            />
          </>
        }
      />
      <div className="overflow-x-auto px-4 pb-5 pt-4 sm:px-6">
        <table className="w-full min-w-[720px] border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr>
              <th className="rounded-l-[14px] border-y border-l border-line bg-surface-2 px-4 py-3 text-left text-[11.5px] font-medium uppercase tracking-[0.05em] text-fg-3">Symbol group</th>
              {LEVELS.map((l, i) => (
                <th key={l.key} className={cn("border-y border-line bg-surface-2 px-2 py-3 text-right text-[11.5px] font-medium uppercase tracking-[0.05em] text-fg-3", i === LEVELS.length - 1 && "rounded-r-[14px] border-r")}>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ background: LEVEL_COLOR[l.key] }} />
                    {l.name}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SYMBOL_GROUPS.map((g) => (
              <tr key={g}>
                <td className="border-b border-line px-4 py-2">
                  <div className="font-medium text-fg">{g}</div>
                  <div className="text-[11px] text-fg-3">{GROUP_HINT[g]}</div>
                </td>
                {LEVELS.map((l) => {
                  const edited = plan.rates[g][l.key] !== base.rates[g][l.key];
                  return (
                    <td key={l.key} className="border-b border-line px-1.5 py-2">
                      <NumInput size="sm" align="right" prefix="$" value={plan.rates[g][l.key]} onChange={(v) => set(g, l.key, v)} step={0.25} min={0} max={50} decimals={2} className={cn("ml-auto w-[104px]", edited && "border-ember/50 bg-ember-soft")} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11.5px] text-fg-3">
          <span>Rates are paid on closed volume, both sides counted once.</span>
          <span>Min hold 120s · trades closed faster are excluded (anti-scalp rule).</span>
        </div>
      </div>
    </Card>
  );
}

export function TiersCard({ plan, onChange }: { plan: CommissionPlan; onChange: (p: CommissionPlan) => void }) {
  const tiers = plan.tiers;
  const example = plan.rates["Forex majors"].gold || 7.8;
  const setTier = (i: number, v: number) => onChange({ ...plan, tiers: tiers.map((t, k) => (k === i ? v : t)) });
  return (
    <Card className="h-full">
      <CardHeader
        title="Multi-tier split"
        subtitle="% of the level rate paid up the referral tree"
        action={
          <Button size="sm" variant="surface" disabled={tiers.length >= 8} onClick={() => onChange({ ...plan, tiers: [...tiers, Math.max(1, Math.round((tiers[tiers.length - 1] ?? 10) / 2))] })}>
            <Plus /> Tier
          </Button>
        }
      />
      <div className="space-y-2 px-4 pb-5 pt-4 sm:px-6">
        {tiers.map((t, i) => (
          <div key={i} className="k-row flex items-center gap-3 px-3.5 py-2">
            <span className={cn("grid size-7 shrink-0 place-items-center rounded-full border font-mono text-[11px]", i === 0 ? "border-ember/40 bg-ember-soft text-ember" : "border-line bg-surface-3 text-fg-2")}>T{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] text-fg-2">{i === 0 ? "Direct referrals" : `Level-${i + 1} network`}</div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-3">
                <div className="h-full rounded-full bg-ember" style={{ width: `${t}%`, opacity: 1 - i * 0.12 }} />
              </div>
            </div>
            <NumInput size="sm" align="right" value={t} onChange={(v) => setTier(i, v)} suffix="%" min={0} max={100} className="w-24" />
            <span className="k-num hidden w-16 text-right text-[12px] text-fg-3 sm:inline">${((example * t) / 100).toFixed(2)}</span>
            <button type="button" disabled={i === 0} onClick={() => onChange({ ...plan, tiers: tiers.filter((_, k) => k !== i) })} className="grid size-7 place-items-center rounded-full text-fg-3 hover:bg-surface-3 hover:text-down disabled:opacity-30" aria-label="Remove tier">
              {i === 0 ? <Minus className="size-3.5" /> : <Trash2 className="size-3.5" />}
            </button>
          </div>
        ))}
        <div className="flex items-center justify-between rounded-[12px] border border-dashed border-line px-3.5 py-2.5 text-[12px] text-fg-3">
          <span>Example: 1 lot EURUSD by a Gold partner&apos;s client (${example.toFixed(2)}/lot)</span>
          <span className="k-num font-medium text-fg">Total ${((example * tiers.reduce((s, t) => s + t, 0)) / 100).toFixed(2)}</span>
        </div>
        {tiers.reduce((s, t) => s + t, 0) > 180 && <div className="text-[12px] text-warn">Combined payout exceeds 180% of base rate — check broker margin on this plan.</div>}
        <PlanRules />
      </div>
    </Card>
  );
}

const ALL_COUNTRIES = ["ae", "sa", "gb", "de", "sg", "au", "my", "tr", "br", "mx", "za", "th", "in", "ng", "pk", "vn", "eg", "ph", "id", "ke", "gh", "co"];

export function CpaCard({ plan, onChange }: { plan: CommissionPlan; onChange: (p: CommissionPlan) => void }) {
  const c = plan.cpa;
  const set = (patch: Partial<CommissionPlan["cpa"]>) => onChange({ ...plan, cpa: { ...c, ...patch } });
  const [exBonus, setExBonus] = React.useState(true);
  const [fallback, setFallback] = React.useState<"default" | "none">("default");
  return (
    <Card className="h-full">
      <CardHeader title="CPA rules" subtitle="One-off payout per qualified first-time depositor" action={<Toggle checked={c.enabled} onChange={(v) => set({ enabled: v })} label="CPA enabled" />} />
      <div className={cn("px-4 pb-5 pt-4 transition-opacity sm:px-6", !c.enabled && "pointer-events-none opacity-45")}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MiniField label="Default CPA"><NumInput size="sm" prefix="$" value={c.amount} onChange={(v) => set({ amount: v })} step={25} min={0} /></MiniField>
          <MiniField label="Min first deposit"><NumInput size="sm" prefix="$" value={c.minDeposit} onChange={(v) => set({ minDeposit: v })} step={50} min={0} /></MiniField>
          <MiniField label="Min lots traded"><NumInput size="sm" value={c.minLots} onChange={(v) => set({ minLots: v })} step={0.5} min={0} suffix="lots" /></MiniField>
          <MiniField label="Qualify within"><NumInput size="sm" value={c.withinDays} onChange={(v) => set({ withinDays: v })} step={5} min={1} suffix="days" /></MiniField>
        </div>
        <div className="mt-4 space-y-2">
          {c.countryTiers.map((t, i) => (
            <div key={t.tier} className="k-row grid grid-cols-1 items-center gap-3 px-3.5 py-3 sm:grid-cols-[88px_1fr_120px]">
              <div>
                <div className="text-[13px] font-medium">{t.tier}</div>
                <div className="flex -space-x-1 pt-1">
                  {t.countries.slice(0, 5).map((cc) => (
                    <Flag key={cc} country={cc} className="size-4 ring-2 ring-surface-2" />
                  ))}
                </div>
              </div>
              <ChipList values={t.countries} onChange={(v) => set({ countryTiers: c.countryTiers.map((x, k) => (k === i ? { ...x, countries: v } : x)) })} format={(v) => v.toUpperCase()} placeholder="Add ISO code…" tone="neutral" />
              <NumInput size="sm" align="right" prefix="$" value={t.amount} onChange={(v) => set({ countryTiers: c.countryTiers.map((x, k) => (k === i ? { ...x, amount: v } : x)) })} step={25} min={0} />
            </div>
          ))}
        </div>
        <div className="mt-3 divide-y divide-line">
          <SettingRow label="Exclude bonus-funded deposits" hint="Credit / bonus never counts toward min deposit">
            <Toggle checked={exBonus} onChange={setExBonus} label="Exclude bonus" />
          </SettingRow>
          <SettingRow label="Unlisted countries" hint={`${ALL_COUNTRIES.length - c.countryTiers.reduce((s, t) => s + t.countries.length, 0)} countries fall back to default CPA`}>
            <Select size="sm" value={fallback} onChange={setFallback} options={[{ value: "default", label: `Default ($${c.amount})` }, { value: "none", label: "No CPA" }]} className="w-40" />
          </SettingRow>
        </div>
      </div>
    </Card>
  );
}

function PlanRules() {
  const [attr, setAttr] = React.useState<"lifetime" | "24m" | "12m">("lifetime");
  const [hold, setHold] = React.useState(120);
  const [swapFree, setSwapFree] = React.useState(true);
  const [ccy, setCcy] = React.useState<"USD" | "USDT">("USD");
  return (
    <div className="mt-2 divide-y divide-line border-t border-line pt-1">
      <SettingRow label="Attribution window" hint="How long a client stays linked to the partner">
        <Select size="sm" className="w-32" value={attr} onChange={setAttr} options={[{ value: "lifetime", label: "Lifetime" }, { value: "24m", label: "24 months" }, { value: "12m", label: "12 months" }]} />
      </SettingRow>
      <SettingRow label="Minimum trade hold" hint="Shorter trades earn no rebate">
        <NumInput size="sm" className="w-28" value={hold} onChange={setHold} step={30} min={0} suffix="sec" />
      </SettingRow>
      <SettingRow label="Pay on swap-free accounts" hint="Islamic accounts at 50% of rate">
        <Toggle checked={swapFree} onChange={setSwapFree} label="Swap-free" />
      </SettingRow>
      <SettingRow label="Accrual currency">
        <Select size="sm" className="w-28" value={ccy} onChange={setCcy} options={["USD", "USDT"] as const} />
      </SettingRow>
    </div>
  );
}
