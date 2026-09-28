"use client";

/**
 * Live plan builder cards: same layout as the demo editor (components/prop/plan-editor.tsx), bound to the prop
 * service's Plan JSON (engine group, fixed phase count per type, trailing lock, news breach, banned codes).
 */
import * as React from "react";
import { AlertTriangle, CalendarClock, Check, Eye, Layers, Minus, Plus, Scale, ShieldAlert, Trash2, TrendingUp, Wallet, X } from "lucide-react";
import { Button, Card, CardHeader, Chip, IconButton, Segmented, Toggle, cn } from "@kalks/ui";
import { MiniField, NumInput, Select, SettingRow, Slider, TextInput } from "@/components/config/kit";
import { BANNED_LABEL, DETECTED, PlanTypeChip, bannedLabel, usd, usdK, type EngineGroup, type Plan, type PlanPhase, type PlanType } from "./kit";

type Patch = (p: Partial<Plan>) => void;
export type FieldError = { field: string; message: string } | null;

export function defaultPhases(type: PlanType): PlanPhase[] {
  if (type === "instant") return [];
  if (type === "1-step") return [{ name: "Evaluation", target: 10, minDays: 3, timeLimit: 0 }];
  return [
    { name: "Phase 1", target: 8, minDays: 4, timeLimit: 0 },
    { name: "Phase 2", target: 5, minDays: 4, timeLimit: 0 },
  ];
}

/** Which card shows a service validation error for a field. */
const CARD_OF: Record<string, "model" | "sizes" | "risk" | "trading" | "funded"> = {
  id: "model",
  name: "model",
  type: "model",
  phases: "model",
  group: "model",
  status: "model",
  sizes: "sizes",
  dailyLoss: "risk",
  dailyBasis: "risk",
  maxDD: "risk",
  ddType: "risk",
  consistency: "risk",
  newsWindow: "trading",
  banned: "trading",
  split: "funded",
  scalingEvery: "funded",
  payoutFreq: "funded",
  firstPayoutDays: "funded",
  minPayout: "funded",
};

function FieldAlert({ card, error }: { card: string; error: FieldError }) {
  if (!error || (CARD_OF[error.field] ?? "model") !== card) return null;
  return (
    <div role="alert" className="mx-4 mt-4 flex items-start gap-2.5 rounded-[14px] border border-down/30 bg-down-soft px-3.5 py-2.5 text-[12.5px] text-fg sm:mx-6">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-down" />
      {error.message}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function ModelCard({ plan, patch, groups, isNew, error }: { plan: Plan; patch: Patch; groups: EngineGroup[]; isNew: boolean; error: FieldError }) {
  const setPhase = (i: number, p: Partial<PlanPhase>) => patch({ phases: plan.phases.map((ph, j) => (j === i ? { ...ph, ...p } : ph)) });
  const group = groups.find((g) => g.code === plan.group);
  const options = groups.some((g) => g.code === plan.group) ? groups : [...groups, { code: plan.group, name: `${plan.group} (not found)`, leverages: [], enabled: false, maxAccountsPerUser: 0 }];
  return (
    <Card>
      <CardHeader icon={<Layers />} title="Model & phases" subtitle="Evaluation structure the trader completes before funding" />
      <FieldAlert card="model" error={error} />
      <div className="space-y-5 px-4 pb-6 pt-5 sm:px-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto]">
          <MiniField label="Plan name" hint="Shown in the client store">
            <TextInput value={plan.name} onChange={(v) => patch({ name: v })} />
          </MiniField>
          <MiniField label="Challenge type">
            <Segmented
              size="md"
              value={plan.type}
              onChange={(t) => patch({ type: t, phases: t === plan.type ? plan.phases : defaultPhases(t) })}
              options={[
                { value: "1-step", label: "1-Step" },
                { value: "2-step", label: "2-Step" },
                { value: "instant", label: "Instant" },
              ]}
            />
          </MiniField>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <MiniField label="Plan id" hint={isNew ? "Lowercase, digits, dashes · can't change later" : "Fixed"}>
            <TextInput mono value={plan.id} onChange={(v) => isNew && patch({ id: v.toLowerCase().replace(/[^a-z0-9-]/g, "") })} className={cn(!isNew && "pointer-events-none opacity-70")} />
          </MiniField>
          <MiniField label="Engine group" hint="Accounts open in this trading group">
            <Select value={plan.group} onChange={(v) => patch({ group: v })} options={options.map((g) => ({ value: g.code, label: `${g.name} · ${g.code}${g.enabled ? "" : " (disabled)"}` }))} />
          </MiniField>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-fg-3">
          Leverage offered by {group?.name ?? plan.group}:
          {group?.leverages.length ? (
            group.leverages.map((l) => (
              <Chip key={l} size="sm">
                1:{l}
              </Chip>
            ))
          ) : (
            <span className="text-down">none (group not found)</span>
          )}
          {group && <span className="ml-1">· max {group.maxAccountsPerUser} accounts per client</span>}
        </div>

        {plan.type === "instant" ? (
          <div className="rounded-[16px] border border-gold/25 bg-gold-soft px-5 py-4 text-[13px]">
            <div className="font-medium text-fg">No evaluation phase</div>
            <div className="mt-0.5 text-fg-2">The trader receives a simulated funded account right after payment. The risk rules below apply from day one.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[560px] space-y-2">
              <div className="grid grid-cols-[28px_1.2fr_1fr_1fr_1.3fr] items-center gap-3 px-1 text-[11px] uppercase tracking-wider text-fg-3">
                <span />
                <span>Phase</span>
                <span>Profit target</span>
                <span>Min days</span>
                <span>Time limit</span>
              </div>
              {plan.phases.map((ph, i) => (
                <div key={i} className="k-row grid grid-cols-[28px_1.2fr_1fr_1fr_1.3fr] items-center gap-3 px-3 py-2.5">
                  <span className="grid size-7 place-items-center rounded-full border border-ember/40 bg-ember-soft font-mono text-[12px] text-ember">{i + 1}</span>
                  <TextInput size="sm" value={ph.name} onChange={(v) => setPhase(i, { name: v })} />
                  <NumInput size="sm" value={ph.target} onChange={(v) => setPhase(i, { target: v })} suffix="%" step={0.5} min={0.5} max={100} />
                  <NumInput size="sm" value={ph.minDays} onChange={(v) => setPhase(i, { minDays: Math.round(v) })} suffix="days" min={0} max={60} />
                  <div className="flex items-center gap-2">
                    {ph.timeLimit === 0 ? (
                      <span className="flex h-8 flex-1 items-center rounded-[12px] border border-dashed border-line px-2.5 text-[12.5px] text-fg-3">Unlimited</span>
                    ) : (
                      <NumInput size="sm" className="flex-1" value={ph.timeLimit} onChange={(v) => setPhase(i, { timeLimit: Math.round(v) })} suffix="days" min={1} max={365} />
                    )}
                    <Toggle checked={ph.timeLimit > 0} onChange={(on) => setPhase(i, { timeLimit: on ? Math.max(30, ph.minDays) : 0 })} label="Time limit" />
                  </div>
                </div>
              ))}
              <div className="px-1 text-[11.5px] text-fg-3">A {plan.type} plan has {plan.phases.length} evaluation phase{plan.phases.length === 1 ? "" : "s"}; change the type to change the count.</div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

export function SizesCard({ plan, patch, groups, error }: { plan: Plan; patch: Patch; groups: EngineGroup[]; error: FieldError }) {
  const [newSize, setNewSize] = React.useState(0);
  const leverages = groups.find((g) => g.code === plan.group)?.leverages ?? [];
  const set = (i: number, p: Partial<Plan["sizes"][number]>) => patch({ sizes: plan.sizes.map((s, j) => (j === i ? { ...s, ...p } : s)) });
  const bump = (pctv: number) => patch({ sizes: plan.sizes.map((s) => ({ ...s, fee: Math.max(0, Math.round(s.fee * (1 + pctv / 100))) })) });
  const add = () => {
    if (newSize < 1000 || plan.sizes.some((s) => s.size === newSize)) return;
    const lev = plan.sizes[0]?.leverage ?? leverages[0] ?? 100;
    patch({ sizes: [...plan.sizes, { size: newSize, fee: Math.round(newSize * 0.009), leverage: lev, enabled: true }].sort((a, b) => a.size - b.size) });
    setNewSize(0);
  };
  return (
    <Card>
      <CardHeader
        icon={<Wallet />}
        title="Account sizes & fees"
        subtitle="One-time challenge fee per size · leverage must be offered by the engine group"
        action={
          <>
            <Button size="xs" variant="surface" onClick={() => bump(-10)}>
              -10%
            </Button>
            <Button size="xs" variant="surface" onClick={() => bump(10)}>
              +10%
            </Button>
          </>
        }
      />
      <FieldAlert card="sizes" error={error} />
      <div className="overflow-x-auto px-4 pb-6 pt-4 sm:px-6">
        <table className="w-full min-w-[620px] border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-fg-3">
              <th className="rounded-l-[12px] border-y border-l border-line bg-surface-2 px-3 py-2.5 text-left font-medium">Account size</th>
              <th className="border-y border-line bg-surface-2 px-3 py-2.5 text-left font-medium">Fee</th>
              <th className="border-y border-line bg-surface-2 px-3 py-2.5 text-left font-medium">Leverage</th>
              <th className="border-y border-line bg-surface-2 px-3 py-2.5 text-right font-medium">Fee / $1K</th>
              <th className="border-y border-line bg-surface-2 px-3 py-2.5 text-right font-medium">Daily loss $</th>
              <th className="border-y border-line bg-surface-2 px-3 py-2.5 text-right font-medium">Enabled</th>
              <th className="rounded-r-[12px] border-y border-r border-line bg-surface-2 px-2 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {plan.sizes.map((s, i) => {
              const offered = leverages.includes(s.leverage);
              const levOptions = (offered ? leverages : [...leverages, s.leverage].sort((a, b) => a - b)).map((l) => ({ value: String(l), label: `1:${l}${leverages.includes(l) ? "" : " (not offered)"}` }));
              return (
                <tr key={s.size} className={cn(!s.enabled && "opacity-45")}>
                  <td className="border-b border-line px-3 py-2">
                    <span className="k-num text-[14px] font-medium">${s.size.toLocaleString("en-US")}</span>
                  </td>
                  <td className="border-b border-line px-3 py-2">
                    <NumInput size="sm" className="w-28" prefix="$" value={s.fee} onChange={(v) => set(i, { fee: Math.round(v * 100) / 100 })} min={0} />
                  </td>
                  <td className="border-b border-line px-3 py-2">
                    <Select size="sm" className={cn("w-36", !offered && "[&_select]:border-down/50 [&_select]:text-down")} value={String(s.leverage)} onChange={(v) => set(i, { leverage: +v })} options={levOptions} />
                  </td>
                  <td className="k-num border-b border-line px-3 py-2 text-right text-fg-2">${((s.fee / s.size) * 1000).toFixed(2)}</td>
                  <td className="k-num border-b border-line px-3 py-2 text-right text-fg-2">${Math.round((s.size * plan.dailyLoss) / 100).toLocaleString("en-US")}</td>
                  <td className="border-b border-line px-3 py-2 text-right">
                    <span className="inline-flex">
                      <Toggle checked={s.enabled} onChange={(v) => set(i, { enabled: v })} label={`Enable ${s.size}`} />
                    </span>
                  </td>
                  <td className="border-b border-line px-2 py-2 text-right">
                    <IconButton size="sm" aria-label={`Remove ${s.size}`} disabled={plan.sizes.length <= 1} onClick={() => patch({ sizes: plan.sizes.filter((_, j) => j !== i) })}>
                      <Trash2 />
                    </IconButton>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px] text-fg-3">
          Add size
          <NumInput size="sm" className="w-36" prefix="$" value={newSize} onChange={(v) => setNewSize(Math.round(v))} min={0} max={5_000_000} />
          <Button size="xs" variant="surface" disabled={newSize < 1000 || plan.sizes.some((s) => s.size === newSize) || plan.sizes.length >= 20} onClick={add}>
            <Plus /> Add
          </Button>
          <span>1,000 – 5,000,000 · up to 20 sizes</span>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

export function RiskCard({ plan, patch, error }: { plan: Plan; patch: Patch; error: FieldError }) {
  const ref = 100000;
  const floor = ref * (1 - plan.maxDD / 100);
  return (
    <Card>
      <CardHeader icon={<ShieldAlert />} title="Risk rules" subtitle="Hard breaches fail the account and close every position; soft rules hold the pass or payout" />
      <FieldAlert card="risk" error={error} />
      <div className="grid grid-cols-1 gap-4 px-4 pb-6 pt-5 sm:px-6 lg:grid-cols-2">
        <div className="k-row space-y-3 px-4 py-4">
          <div className="flex items-center justify-between">
            <span className="text-[13.5px] font-medium">Daily loss limit</span>
            <Chip size="sm" tone="down">
              Hard breach
            </Chip>
          </div>
          <div className="flex items-center gap-3">
            <NumInput className="w-28" value={plan.dailyLoss} onChange={(v) => patch({ dailyLoss: v })} suffix="%" step={0.5} min={0.5} max={50} stepper />
            <Segmented size="xs" value={plan.dailyBasis} onChange={(v) => patch({ dailyBasis: v })} options={[{ value: "balance", label: "Balance" }, { value: "equity", label: "Equity" }]} />
          </div>
          <p className="text-[12px] text-fg-3">
            Measured from {plan.dailyBasis === "balance" ? "the balance at the daily reset" : "the higher of balance and equity at the daily reset"} (17:00 New York). On $100K the floor is{" "}
            <span className="k-num text-fg-2">${(ref - (ref * plan.dailyLoss) / 100).toLocaleString("en-US")}</span>.
          </p>
        </div>

        <div className="k-row space-y-3 px-4 py-4">
          <div className="flex items-center justify-between">
            <span className="text-[13.5px] font-medium">Max drawdown</span>
            <Chip size="sm" tone="down">
              Hard breach
            </Chip>
          </div>
          <div className="flex items-center gap-3">
            <NumInput className="w-28" value={plan.maxDD} onChange={(v) => patch({ maxDD: v })} suffix="%" step={0.5} min={0.5} max={50} stepper />
            <Segmented size="xs" value={plan.ddType} onChange={(v) => patch({ ddType: v })} options={[{ value: "static", label: "Static" }, { value: "trailing", label: "Trailing" }]} />
          </div>
          {plan.ddType === "trailing" && (
            <SettingRow className="py-1" label="Lock at initial balance" hint="The trailing floor stops rising once it reaches the starting balance">
              <Toggle checked={plan.trailingLock} onChange={(v) => patch({ trailingLock: v })} label="Trailing lock" />
            </SettingRow>
          )}
          <p className="text-[12px] text-fg-3">
            {plan.ddType === "static" ? "Fixed floor at" : "Floor trails the balance / equity high-water mark, starting at"} <span className="k-num text-fg-2">${floor.toLocaleString("en-US")}</span> on $100K
            {plan.ddType === "trailing" && plan.trailingLock && " and locks at the initial balance"}.
          </p>
        </div>

        <div className="k-row px-4 py-4 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[13.5px] font-medium">Consistency rule</div>
              <div className="text-[12px] text-fg-3">The best day&apos;s closed profit may not exceed this share of total profit. Soft rule: holds the pass and payouts until met.</div>
            </div>
            <Chip size="sm" tone={plan.consistency ? "warn" : "neutral"}>
              {plan.consistency ? `${plan.consistency}% max / day` : "Off"}
            </Chip>
          </div>
          <Slider className="mt-4" value={plan.consistency} onChange={(v) => patch({ consistency: v })} min={0} max={60} step={5} marks={[0, 15, 30, 45, 60]} />
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

const BANNED_OPTIONS = Object.keys(BANNED_LABEL);

export function TradingRulesCard({ plan, patch, error }: { plan: Plan; patch: Patch; error: FieldError }) {
  const toggle = (code: string) => patch({ banned: plan.banned.includes(code) ? plan.banned.filter((b) => b !== code) : [...plan.banned, code] });
  const extra = plan.banned.filter((b) => !BANNED_OPTIONS.includes(b));
  return (
    <Card>
      <CardHeader icon={<CalendarClock />} title="Trading rules & banned strategies" subtitle="Enforced by the rule engine on every evaluation; evidence goes to Violations" />
      <FieldAlert card="trading" error={error} />
      <div className="px-4 pb-6 pt-3 sm:px-6">
        <div className="divide-y divide-line">
          <SettingRow label="News trading" hint={plan.newsTrading ? "Allowed during high-impact releases" : `No opens or closes within ±${plan.newsWindow} min of a News calendar event on an affected instrument`}>
            {!plan.newsTrading && <NumInput size="sm" className="w-24" value={plan.newsWindow} onChange={(v) => patch({ newsWindow: Math.round(v) })} suffix="min" min={0} max={240} />}
            <Toggle checked={plan.newsTrading} onChange={(v) => patch({ newsTrading: v })} label="News trading" />
          </SettingRow>
          {!plan.newsTrading && (
            <SettingRow label="News breach fails the account" hint={plan.newsBreachFails ? "A trade inside the window fails the challenge" : "A trade inside the window is closed and logged as a violation"}>
              <Toggle checked={plan.newsBreachFails} onChange={(v) => patch({ newsBreachFails: v })} label="News breach fails" />
            </SettingRow>
          )}
          <SettingRow label="Weekend holding" hint={plan.weekendHolding ? "Positions may be held over the weekend" : "Positions still open Friday 16:45 New York are closed (violation)"}>
            <Toggle checked={plan.weekendHolding} onChange={(v) => patch({ weekendHolding: v })} label="Weekend holding" />
          </SettingRow>
          <SettingRow label="Expert Advisors" hint="Allow EAs / algorithmic execution (banned strategies still apply)">
            <Toggle checked={plan.eaAllowed} onChange={(v) => patch({ eaAllowed: v })} label="EAs" />
          </SettingRow>
        </div>
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="k-label">Banned strategies</span>
            <span className="k-num text-[12px] text-fg-3">{plan.banned.length} listed</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[...BANNED_OPTIONS, ...extra].map((code) => {
              const on = plan.banned.includes(code);
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => toggle(code)}
                  className={cn("inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[12px] font-medium transition-colors", on ? "border-down/25 bg-down-soft text-down" : "border-line bg-surface-2 text-fg-3 hover:text-fg-2")}
                >
                  {on && <Check className="size-3" />}
                  {bannedLabel(code)}
                  {!DETECTED.includes(code) && <span className="text-[10.5px] font-normal opacity-70">· terms only</span>}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11.5px] text-fg-3">HFT, latency arbitrage, tick scalping and cross-account copying / hedging are detected automatically and flagged for review. The others are shown to traders in the plan terms only.</p>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

export function FundedTermsCard({ plan, patch, error }: { plan: Plan; patch: Patch; error: FieldError }) {
  const ladder = React.useMemo(() => {
    const out: { level: number; size: number; month: number }[] = [];
    let size = 100000;
    for (let l = 0; l < 5; l++) {
      out.push({ level: l, size, month: l * plan.scalingEvery });
      const next = Math.round(size * (1 + plan.scalingIncrease / 100));
      if (!plan.scalingEvery || !plan.scalingIncrease || next > plan.scalingCap) break;
      size = next;
    }
    return out;
  }, [plan.scalingEvery, plan.scalingIncrease, plan.scalingCap]);

  return (
    <Card>
      <CardHeader icon={<Scale />} title="Funded terms" subtitle="Profit split, payout schedule and scaling plan" />
      <FieldAlert card="funded" error={error} />
      <div className="grid grid-cols-1 gap-4 px-4 pb-6 pt-5 sm:px-6 lg:grid-cols-2">
        <div className="k-row px-4 py-4">
          <div className="flex items-center justify-between">
            <span className="text-[13.5px] font-medium">Profit split</span>
            <span className="k-num text-[13px]">
              <span className="text-ember">{plan.split}%</span>
              <span className="text-fg-3"> → </span>
              <span className="text-gold">{plan.splitMax}%</span>
            </span>
          </div>
          <div className="mt-3 text-[11.5px] text-fg-3">Starting split (trader share)</div>
          <Slider value={plan.split} onChange={(v) => patch({ split: v, splitMax: Math.max(v, plan.splitMax) })} min={50} max={100} step={5} marks={[50, 60, 70, 80, 90, 100]} />
          <div className="mt-3 text-[11.5px] text-fg-3">Max split with scaling</div>
          <Slider value={plan.splitMax} onChange={(v) => patch({ splitMax: Math.max(v, plan.split) })} min={50} max={100} step={5} marks={[50, 60, 70, 80, 90, 100]} />
        </div>

        <div className="k-row px-4 py-4">
          <div className="flex items-center justify-between">
            <span className="text-[13.5px] font-medium">Payouts</span>
            <Chip size="sm" tone="gold">
              USDT wallet
            </Chip>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <MiniField label="Frequency" className="col-span-2">
              <Segmented size="xs" value={plan.payoutFreq} onChange={(v) => patch({ payoutFreq: v })} options={[{ value: "weekly", label: "Weekly" }, { value: "bi-weekly", label: "Bi-weekly" }, { value: "monthly", label: "Monthly" }, { value: "on-demand", label: "On demand" }]} />
            </MiniField>
            <MiniField label="First payout after">
              <NumInput size="sm" value={plan.firstPayoutDays} onChange={(v) => patch({ firstPayoutDays: Math.round(v) })} suffix="days" min={0} max={365} />
            </MiniField>
            <MiniField label="Minimum payout">
              <NumInput size="sm" value={plan.minPayout} onChange={(v) => patch({ minPayout: v })} prefix="$" min={0} />
            </MiniField>
          </div>
          <SettingRow className="mt-2 pb-0" label="Refund fee on first payout" hint="The challenge fee is added to the first approved payout">
            <Toggle checked={plan.refundFee} onChange={(v) => patch({ refundFee: v })} label="Refund fee" />
          </SettingRow>
        </div>

        <div className="k-row px-4 py-4 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[13.5px] font-medium">
              <TrendingUp className="size-4 text-up" /> Scaling plan
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-fg-2">
              Every
              <NumInput size="sm" className="w-24" value={plan.scalingEvery} onChange={(v) => patch({ scalingEvery: Math.round(v) })} suffix="mo" min={0} max={24} />
              add
              <NumInput size="sm" className="w-20" value={plan.scalingIncrease} onChange={(v) => patch({ scalingIncrease: v })} suffix="%" min={0} max={100} step={5} />
              if profit ≥
              <NumInput size="sm" className="w-20" value={plan.scalingProfit} onChange={(v) => patch({ scalingProfit: v })} suffix="%" min={0} max={100} />
              cap
              <NumInput size="sm" className="w-36" value={plan.scalingCap} onChange={(v) => patch({ scalingCap: Math.round(v) })} prefix="$" min={0} step={100000} />
            </div>
          </div>
          {plan.scalingEvery > 0 && plan.scalingIncrease > 0 ? (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {ladder.map((l) => (
                <div key={l.level} className={cn("rounded-[12px] border px-3 py-2.5", l.level === 0 ? "border-ember/35 bg-ember-soft" : "border-line bg-surface-3/40")}>
                  <div className="flex items-center justify-between text-[10.5px] uppercase tracking-wider text-fg-3">
                    <span>L{l.level}</span>
                    <span className="k-num normal-case">{l.level === 0 ? "start" : `m${l.month}`}</span>
                  </div>
                  <div className="k-num mt-1 text-[15px] font-semibold">{usdK(l.size)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 text-[12px] text-fg-3">Scaling is off (0 months or 0%).</div>
          )}
          <div className="mt-2 text-[11.5px] text-fg-3">Example ladder for a $100K account. A scale-up is reviewed after a payout when the profit condition is met.</div>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

/** The plan as the trader sees it in the client-area store. */
export function PlanPreview({ plan, groups }: { plan: Plan; groups: EngineGroup[] }) {
  const enabled = plan.sizes.filter((s) => s.enabled);
  const [size, setSize] = React.useState<string>(String(enabled[Math.min(3, enabled.length - 1)]?.size ?? ""));
  const row = enabled.find((s) => String(s.size) === size) ?? enabled[0];
  React.useEffect(() => {
    if (!enabled.some((s) => String(s.size) === size) && enabled[0]) setSize(String(enabled[0].size));
  }, [enabled, size]);
  const groupName = groups.find((g) => g.code === plan.group)?.name ?? plan.group;

  const rules: { label: string; value: string; ok?: boolean }[] = [
    ...plan.phases.map((p) => ({ label: `${p.name} target`, value: `${p.target}%${p.timeLimit ? ` · ${p.timeLimit}d` : ""}` })),
    { label: "Daily loss", value: `${plan.dailyLoss}% · ${plan.dailyBasis}` },
    { label: "Max drawdown", value: `${plan.maxDD}% · ${plan.ddType}` },
    { label: "Min trading days", value: plan.phases.length ? `${plan.phases[0]!.minDays} days` : "None" },
    { label: "Consistency", value: plan.consistency ? `${plan.consistency}% / day` : "None" },
    { label: "News trading", value: plan.newsTrading ? "Allowed" : `±${plan.newsWindow} min`, ok: plan.newsTrading },
    { label: "Weekend holding", value: plan.weekendHolding ? "Allowed" : "Not allowed", ok: plan.weekendHolding },
    { label: "Expert Advisors", value: plan.eaAllowed ? "Allowed" : "Not allowed", ok: plan.eaAllowed },
    { label: "Leverage", value: row ? `1:${row.leverage}` : "—" },
  ];

  return (
    <Card className="overflow-hidden">
      <div className="px-6 pb-6 pt-5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-fg-3">
            <Eye className="size-3.5" /> Client preview
          </span>
          <PlanTypeChip type={plan.type} />
        </div>
        <div className="mt-3 text-[20px] font-medium tracking-tight">{plan.name || "Untitled plan"}</div>
        <div className="mt-1 text-[12.5px] text-fg-2">
          {plan.type === "instant" ? "Skip the evaluation. Trade a funded account today." : plan.phases.length === 1 ? "One phase, one target. The fastest path to funding." : "The classic two-phase evaluation."}
        </div>

        {enabled.length > 0 ? (
          <>
            <div className="mt-4 overflow-x-auto">
              <Segmented size="xs" value={size} onChange={setSize} options={enabled.map((s) => ({ value: String(s.size), label: usdK(s.size) }))} />
            </div>
            <div className="mt-4 flex items-end justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-fg-3">One-time fee</div>
                <div className="k-num text-[34px] font-semibold leading-none tracking-tight">{usd(row?.fee ?? 0)}</div>
              </div>
              {plan.refundFee && (
                <Chip size="sm" tone="up">
                  Refundable
                </Chip>
              )}
            </div>
          </>
        ) : (
          <div className="mt-4 rounded-[12px] border border-dashed border-down/40 px-3 py-3 text-[12.5px] text-down">No account sizes enabled. The plan can&apos;t be sold.</div>
        )}

        <div className="mt-5 flex items-center gap-2">
          {plan.phases.map((p, i) => (
            <React.Fragment key={i}>
              <div className="min-w-0 flex-1 rounded-[12px] border border-line bg-surface-2/70 px-3 py-2">
                <div className="truncate text-[11px] text-fg-3">{p.name}</div>
                <div className="k-num text-[14px] font-medium text-up">+{p.target}%</div>
              </div>
              <span className="h-px w-3 bg-line" />
            </React.Fragment>
          ))}
          <div className="min-w-0 flex-1 rounded-[12px] border border-gold/30 bg-gold-soft px-3 py-2">
            <div className="truncate text-[11px] text-fg-3">Funded</div>
            <div className="k-num text-[14px] font-medium text-gold">{plan.split}%</div>
          </div>
        </div>

        <div className="mt-5 divide-y divide-line rounded-[14px] border border-line bg-surface-2/60 px-4">
          {rules.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-3 py-2 text-[12.5px]">
              <span className="flex items-center gap-2 text-fg-2">
                {r.ok === undefined ? <Minus className="size-3 text-fg-3" /> : r.ok ? <Check className="size-3 text-up" /> : <X className="size-3 text-down" />}
                {r.label}
              </span>
              <span className="k-num font-medium text-fg">{r.value}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-[12px]">
          <div className="rounded-[12px] border border-line bg-surface-2/60 px-3 py-2">
            <div className="text-fg-3">Profit split</div>
            <div className="k-num font-medium">
              {plan.split}% → {plan.splitMax}%
            </div>
          </div>
          <div className="rounded-[12px] border border-line bg-surface-2/60 px-3 py-2">
            <div className="text-fg-3">Payouts</div>
            <div className="font-medium">
              {plan.payoutFreq} · {plan.firstPayoutDays}d first
            </div>
          </div>
        </div>
        <div className="mt-3 text-[11.5px] text-fg-3">Accounts open in the {groupName} group.</div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

/** Readable list of changes between the saved plan and the draft. */
export function diffPlan(a: Plan | null, b: Plan): string[] {
  if (!a) return ["New plan"];
  const out: string[] = [];
  if (a.name !== b.name) out.push(`Name → "${b.name}"`);
  if (a.type !== b.type) out.push(`Type ${a.type} → ${b.type}`);
  if (a.group !== b.group) out.push(`Engine group ${a.group} → ${b.group}`);
  if (JSON.stringify(a.phases) !== JSON.stringify(b.phases)) out.push(`Phases: ${b.phases.map((p) => `${p.target}%/${p.minDays}d${p.timeLimit ? `/${p.timeLimit}d` : ""}`).join(", ") || "none"}`);
  const sizesA = new Map(a.sizes.map((s) => [s.size, s]));
  const sizesB = new Map(b.sizes.map((s) => [s.size, s]));
  for (const s of b.sizes) {
    const o = sizesA.get(s.size);
    if (!o) out.push(`${usdK(s.size)} added`);
    else {
      if (o.fee !== s.fee) out.push(`${usdK(s.size)} fee ${usd(o.fee)} → ${usd(s.fee)}`);
      if (o.enabled !== s.enabled) out.push(`${usdK(s.size)} ${s.enabled ? "enabled" : "disabled"}`);
      if (o.leverage !== s.leverage) out.push(`${usdK(s.size)} leverage 1:${o.leverage} → 1:${s.leverage}`);
    }
  }
  for (const s of a.sizes) if (!sizesB.has(s.size)) out.push(`${usdK(s.size)} removed`);
  if (a.dailyLoss !== b.dailyLoss || a.dailyBasis !== b.dailyBasis) out.push(`Daily loss ${a.dailyLoss}% ${a.dailyBasis} → ${b.dailyLoss}% ${b.dailyBasis}`);
  if (a.maxDD !== b.maxDD || a.ddType !== b.ddType || a.trailingLock !== b.trailingLock) out.push(`Max DD ${a.maxDD}% ${a.ddType} → ${b.maxDD}% ${b.ddType}${b.ddType === "trailing" ? (b.trailingLock ? " (locks)" : " (no lock)") : ""}`);
  if (a.consistency !== b.consistency) out.push(`Consistency ${a.consistency ? a.consistency + "%" : "off"} → ${b.consistency ? b.consistency + "%" : "off"}`);
  if (a.newsTrading !== b.newsTrading || a.newsWindow !== b.newsWindow || a.newsBreachFails !== b.newsBreachFails) out.push(`News trading ${b.newsTrading ? "allowed" : `blocked ±${b.newsWindow}m${b.newsBreachFails ? ", fails" : ""}`}`);
  if (a.weekendHolding !== b.weekendHolding) out.push(`Weekend holding ${b.weekendHolding ? "allowed" : "blocked"}`);
  if (a.eaAllowed !== b.eaAllowed) out.push(`EAs ${b.eaAllowed ? "allowed" : "blocked"}`);
  if ([...a.banned].sort().join() !== [...b.banned].sort().join()) out.push(`Banned strategies: ${b.banned.length}`);
  if (a.split !== b.split || a.splitMax !== b.splitMax) out.push(`Split ${a.split}/${a.splitMax} → ${b.split}/${b.splitMax}`);
  if (a.scalingEvery !== b.scalingEvery || a.scalingIncrease !== b.scalingIncrease || a.scalingProfit !== b.scalingProfit || a.scalingCap !== b.scalingCap) out.push(`Scaling every ${b.scalingEvery}mo +${b.scalingIncrease}% at ${b.scalingProfit}%, cap ${usdK(b.scalingCap)}`);
  if (a.refundFee !== b.refundFee) out.push(`Fee refund ${b.refundFee ? "on" : "off"}`);
  if (a.payoutFreq !== b.payoutFreq || a.firstPayoutDays !== b.firstPayoutDays || a.minPayout !== b.minPayout) out.push(`Payouts ${b.payoutFreq}, first ${b.firstPayoutDays}d, min ${usd(b.minPayout, 0)}`);
  return out;
}

/** Client-side checks that mirror the service's validation (the service stays authoritative). */
export function planIssues(p: Plan, groups: EngineGroup[]): string[] {
  const out: string[] = [];
  if (!/^[a-z0-9][a-z0-9-]{1,47}$/.test(p.id)) out.push("Plan id: 2–48 lowercase letters, digits or dashes");
  if (!p.name.trim()) out.push("Name is required");
  if (p.phases.some((ph) => !ph.name.trim())) out.push("Every phase needs a name");
  if (p.phases.some((ph) => ph.timeLimit > 0 && ph.timeLimit < ph.minDays)) out.push("A time limit must be at least the minimum trading days");
  if (!p.sizes.length) out.push("Add at least one account size");
  if (p.maxDD < p.dailyLoss) out.push("Max drawdown can't be smaller than the daily loss limit");
  if (p.splitMax < p.split) out.push("Max split must be at least the split");
  const g = groups.find((x) => x.code === p.group);
  if (groups.length && !g) out.push(`Engine group "${p.group}" doesn't exist`);
  if (g) {
    const bad = Array.from(new Set(p.sizes.map((s) => s.leverage).filter((l) => !g.leverages.includes(l))));
    if (bad.length) out.push(`${g.name} doesn't offer leverage ${bad.map((l) => `1:${l}`).join(", ")}`);
  }
  return out;
}
