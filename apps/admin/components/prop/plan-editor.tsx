"use client";

import * as React from "react";
import { CalendarClock, Layers, Plus, Scale, ShieldAlert, Trash2, TrendingUp, Wallet } from "lucide-react";
import { Button, Card, CardHeader, Chip, Icon3D, IconButton, Segmented, Toggle, cn } from "@ezymex/ui";
import { ChipList, MiniField, NumInput, Select, SettingRow, Slider, TextInput } from "@/components/config/kit";
import { BANNED_STRATEGIES, type PlanPhase, type PlanType, type PropPlan } from "./data";

type Patch = (p: Partial<PropPlan>) => void;
const fmtK = (v: number) => (v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(v % 1_000_000 ? 1 : 0)}M` : `$${Math.round(v / 1000)}K`);

export function defaultPhases(type: PlanType): PlanPhase[] {
  if (type === "instant") return [];
  if (type === "1-step") return [{ name: "Evaluation", target: 10, minDays: 3, timeLimit: 0 }];
  return [
    { name: "Phase 1", target: 8, minDays: 4, timeLimit: 0 },
    { name: "Phase 2", target: 5, minDays: 4, timeLimit: 0 },
  ];
}

/* ------------------------------------------------------------------ */

export function ModelCard({ plan, patch }: { plan: PropPlan; patch: Patch }) {
  const setPhase = (i: number, p: Partial<PlanPhase>) => patch({ phases: plan.phases.map((ph, j) => (j === i ? { ...ph, ...p } : ph)) });
  return (
    <Card>
      <CardHeader icon={<Layers />} title="Model & phases" subtitle="Evaluation structure the trader must complete before funding" />
      <div className="space-y-5 px-4 pb-6 pt-5 sm:px-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto]">
          <MiniField label="Plan name" hint="Shown in the client store">
            <TextInput value={plan.name} onChange={(v) => patch({ name: v })} />
          </MiniField>
          <MiniField label="Challenge type">
            <Segmented
              size="md"
              value={plan.type}
              onChange={(t) => patch({ type: t, phases: defaultPhases(t) })}
              options={[
                { value: "1-step", label: "1-Step" },
                { value: "2-step", label: "2-Step" },
                { value: "instant", label: "Instant" },
              ]}
            />
          </MiniField>
        </div>

        {plan.type === "instant" ? (
          <div className="flex items-center gap-4 rounded-[16px] border border-gold/25 bg-gold-soft px-5 py-4">
            <Icon3D name="rocket" size={48} />
            <div className="min-w-0 text-[13px]">
              <div className="font-medium text-fg">No evaluation phase</div>
              <div className="mt-0.5 text-fg-2">Trader receives a simulated funded account immediately after payment and KYC level 2. Risk rules below apply from day one; fees are priced higher to cover the absent filter.</div>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[560px] space-y-2">
              <div className="grid grid-cols-[28px_1.2fr_1fr_1fr_1.3fr_32px] items-center gap-3 px-1 text-[11px] uppercase tracking-wider text-fg-3">
                <span />
                <span>Phase</span>
                <span>Profit target</span>
                <span>Min days</span>
                <span>Time limit</span>
                <span />
              </div>
              {plan.phases.map((ph, i) => (
                <div key={i} className="k-row grid grid-cols-[28px_1.2fr_1fr_1fr_1.3fr_32px] items-center gap-3 px-3 py-2.5">
                  <span className="grid size-7 place-items-center rounded-full border border-ember/40 bg-ember-soft font-mono text-[12px] text-ember">{i + 1}</span>
                  <TextInput size="sm" value={ph.name} onChange={(v) => setPhase(i, { name: v })} />
                  <NumInput size="sm" value={ph.target} onChange={(v) => setPhase(i, { target: v })} suffix="%" step={0.5} min={1} max={30} />
                  <NumInput size="sm" value={ph.minDays} onChange={(v) => setPhase(i, { minDays: v })} suffix="days" min={0} max={30} />
                  <div className="flex items-center gap-2">
                    {ph.timeLimit === 0 ? (
                      <span className="flex h-8 flex-1 items-center rounded-[12px] border border-dashed border-line px-2.5 text-[12.5px] text-fg-3">Unlimited</span>
                    ) : (
                      <NumInput size="sm" className="flex-1" value={ph.timeLimit} onChange={(v) => setPhase(i, { timeLimit: v })} suffix="days" min={5} max={120} />
                    )}
                    <Toggle checked={ph.timeLimit > 0} onChange={(on) => setPhase(i, { timeLimit: on ? 30 : 0 })} label="Time limit" />
                  </div>
                  <IconButton size="sm" aria-label="Remove phase" disabled={plan.phases.length <= 1} onClick={() => patch({ phases: plan.phases.filter((_, j) => j !== i), type: plan.phases.length - 1 === 1 ? "1-step" : plan.type })}>
                    <Trash2 />
                  </IconButton>
                </div>
              ))}
              {plan.phases.length < 3 && (
                <button
                  type="button"
                  onClick={() => patch({ phases: [...plan.phases, { name: `Phase ${plan.phases.length + 1}`, target: 5, minDays: 4, timeLimit: 0 }], type: "2-step" })}
                  className="flex w-full items-center justify-center gap-2 rounded-[14px] border border-dashed border-line py-2.5 text-[12.5px] text-fg-3 transition-colors hover:border-ember/40 hover:text-ember"
                >
                  <Plus className="size-3.5" /> Add phase
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

export function SizesCard({ plan, patch }: { plan: PropPlan; patch: Patch }) {
  const set = (i: number, p: Partial<PropPlan["sizes"][number]>) => patch({ sizes: plan.sizes.map((s, j) => (j === i ? { ...s, ...p } : s)) });
  const bump = (pct: number) => patch({ sizes: plan.sizes.map((s) => ({ ...s, fee: Math.max(1, Math.round(s.fee * (1 + pct / 100)) ) })) });
  return (
    <Card>
      <CardHeader
        icon={<Wallet />}
        title="Account sizes & fees"
        subtitle="One-time challenge fee per size · leverage applies to FX majors"
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
      <div className="overflow-x-auto px-4 pb-6 pt-4 sm:px-6">
        <table className="w-full min-w-[560px] border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-fg-3">
              <th className="rounded-l-[12px] border-y border-l border-line bg-surface-2 px-3 py-2.5 text-left font-medium">Account size</th>
              <th className="border-y border-line bg-surface-2 px-3 py-2.5 text-left font-medium">Fee</th>
              <th className="border-y border-line bg-surface-2 px-3 py-2.5 text-left font-medium">Leverage</th>
              <th className="border-y border-line bg-surface-2 px-3 py-2.5 text-right font-medium">Fee / $1K</th>
              <th className="border-y border-line bg-surface-2 px-3 py-2.5 text-right font-medium">Daily loss $</th>
              <th className="rounded-r-[12px] border-y border-r border-line bg-surface-2 px-3 py-2.5 text-right font-medium">Enabled</th>
            </tr>
          </thead>
          <tbody>
            {plan.sizes.map((s, i) => (
              <tr key={s.size} className={cn(!s.enabled && "opacity-45")}>
                <td className="border-b border-line px-3 py-2">
                  <span className="k-num text-[14px] font-medium">${s.size.toLocaleString()}</span>
                </td>
                <td className="border-b border-line px-3 py-2">
                  <NumInput size="sm" className="w-28" prefix="$" value={s.fee} onChange={(v) => set(i, { fee: v })} min={1} />
                </td>
                <td className="border-b border-line px-3 py-2">
                  <Select size="sm" className="w-24" value={String(s.leverage)} onChange={(v) => set(i, { leverage: +v })} options={[{ value: "30", label: "1:30" }, { value: "50", label: "1:50" }, { value: "100", label: "1:100" }]} />
                </td>
                <td className="k-num border-b border-line px-3 py-2 text-right text-fg-2">${((s.fee / s.size) * 1000).toFixed(2)}</td>
                <td className="k-num border-b border-line px-3 py-2 text-right text-fg-2">${Math.round((s.size * plan.dailyLoss) / 100).toLocaleString()}</td>
                <td className="border-b border-line px-3 py-2 text-right">
                  <span className="inline-flex">
                    <Toggle checked={s.enabled} onChange={(v) => set(i, { enabled: v })} label={`Enable ${s.size}`} />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

export function RiskCard({ plan, patch }: { plan: PropPlan; patch: Patch }) {
  const ref = 100000;
  const floor = ref * (1 - plan.maxDD / 100);
  return (
    <Card>
      <CardHeader icon={<ShieldAlert />} title="Risk rules" subtitle="Hard breaches end the account automatically; soft rules hold payouts" />
      <div className="grid grid-cols-1 gap-4 px-4 pb-6 pt-5 sm:px-6 lg:grid-cols-2">
        <div className="k-row space-y-3 px-4 py-4">
          <div className="flex items-center justify-between">
            <span className="text-[13.5px] font-medium">Daily loss limit</span>
            <Chip size="sm" tone="down">
              Hard breach
            </Chip>
          </div>
          <div className="flex items-center gap-3">
            <NumInput className="w-28" value={plan.dailyLoss} onChange={(v) => patch({ dailyLoss: v })} suffix="%" step={0.5} min={1} max={10} stepper />
            <Segmented size="xs" value={plan.dailyBasis} onChange={(v) => patch({ dailyBasis: v })} options={[{ value: "balance", label: "Balance" }, { value: "equity", label: "Equity" }]} />
          </div>
          <p className="text-[12px] text-fg-3">
            Measured from {plan.dailyBasis === "balance" ? "start-of-day balance" : "higher of start-of-day balance or equity"}, reset 00:00 GMT+3. On $100K the floor is{" "}
            <span className="k-num text-fg-2">${(ref - (ref * plan.dailyLoss) / 100).toLocaleString()}</span>.
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
            <NumInput className="w-28" value={plan.maxDD} onChange={(v) => patch({ maxDD: v })} suffix="%" step={0.5} min={2} max={20} stepper />
            <Segmented size="xs" value={plan.ddType} onChange={(v) => patch({ ddType: v })} options={[{ value: "static", label: "Static" }, { value: "trailing", label: "Trailing" }]} />
          </div>
          <DDSketch trailing={plan.ddType === "trailing"} />
          <p className="text-[12px] text-fg-3">
            {plan.ddType === "static" ? "Fixed floor at" : "Floor trails the equity high-water mark, starting at"} <span className="k-num text-fg-2">${floor.toLocaleString()}</span> on $100K
            {plan.ddType === "trailing" && " and locks at the initial balance"}.
          </p>
        </div>

        <div className="k-row px-4 py-4 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[13.5px] font-medium">Consistency rule</div>
              <div className="text-[12px] text-fg-3">No single trading day may exceed this share of total profit. Soft rule: holds payout until met.</div>
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

/** Tiny illustration of static vs trailing drawdown floor. */
function DDSketch({ trailing }: { trailing: boolean }) {
  const eq = "M0,34 L18,30 L34,22 L50,26 L66,14 L84,18 L100,8 L118,16 L136,12 L160,20";
  const floor = trailing ? "M0,54 L34,50 L66,44 L100,38 L160,38" : "M0,54 L160,54";
  return (
    <svg viewBox="0 0 160 60" className="h-12 w-full">
      <path d={eq} fill="none" stroke="var(--k-gold)" strokeWidth="1.6" strokeLinejoin="round" />
      <path d={floor} fill="none" stroke="var(--k-down)" strokeWidth="1.4" strokeDasharray="4 3" />
      <text x="158" y={trailing ? 34 : 50} textAnchor="end" className="fill-[var(--k-fg-3)] text-[7px]">
        {trailing ? "trailing floor" : "static floor"}
      </text>
    </svg>
  );
}

/* ------------------------------------------------------------------ */

export function TradingRulesCard({ plan, patch }: { plan: PropPlan; patch: Patch }) {
  return (
    <Card>
      <CardHeader icon={<CalendarClock />} title="Trading rules & banned strategies" subtitle="Enforced by the rule engine on every fill; evidence goes to Violations" />
      <div className="px-4 pb-6 pt-3 sm:px-6">
        <div className="divide-y divide-line">
          <SettingRow label="News trading" hint={plan.newsTrading ? "Allowed during high-impact releases" : `No opens/closes within ±${plan.newsWindow} min of red-folder news`}>
            {!plan.newsTrading && <NumInput size="sm" className="w-24" value={plan.newsWindow} onChange={(v) => patch({ newsWindow: v })} suffix="min" min={1} max={30} />}
            <Toggle checked={plan.newsTrading} onChange={(v) => patch({ newsTrading: v })} label="News trading" />
          </SettingRow>
          <SettingRow label="Weekend holding" hint={plan.weekendHolding ? "Positions may be held over the weekend" : "All positions auto-closed Fri 23:45 GMT+3"}>
            <Toggle checked={plan.weekendHolding} onChange={(v) => patch({ weekendHolding: v })} label="Weekend holding" />
          </SettingRow>
          <SettingRow label="Expert Advisors" hint="Allow EAs / algorithmic execution (banned strategies still apply)">
            <Toggle checked={plan.eaAllowed} onChange={(v) => patch({ eaAllowed: v })} label="EAs" />
          </SettingRow>
        </div>
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="k-label">Banned strategies</span>
            <span className="k-num text-[12px] text-fg-3">
              {plan.banned.length} of {BANNED_STRATEGIES.length} enforced
            </span>
          </div>
          <ChipList values={plan.banned} onChange={(v) => patch({ banned: v })} options={[...BANNED_STRATEGIES]} tone="down" />
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

export function FundedTermsCard({ plan, patch }: { plan: PropPlan; patch: Patch }) {
  const ladder = React.useMemo(() => {
    const out: { level: number; size: number; split: number; month: number }[] = [];
    let size = 100000;
    let split = plan.split;
    for (let l = 0; l < 5; l++) {
      out.push({ level: l, size, split, month: l * plan.scalingEvery });
      const next = Math.round(size * (1 + plan.scalingIncrease / 100));
      if (next > plan.scalingCap) break;
      size = next;
      split = Math.min(plan.splitMax, split + 5);
    }
    return out;
  }, [plan.split, plan.splitMax, plan.scalingEvery, plan.scalingIncrease, plan.scalingCap]);

  return (
    <Card>
      <CardHeader icon={<Scale />} title="Funded terms" subtitle="Profit split, scaling plan and payout schedule" />
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
              USDT TRC20 · Rise · Wire
            </Chip>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <MiniField label="Frequency" className="col-span-2">
              <Segmented size="xs" value={plan.payoutFreq} onChange={(v) => patch({ payoutFreq: v })} options={[{ value: "weekly", label: "Weekly" }, { value: "bi-weekly", label: "Bi-weekly" }, { value: "monthly", label: "Monthly" }, { value: "on-demand", label: "On demand" }]} />
            </MiniField>
            <MiniField label="First payout after">
              <NumInput size="sm" value={plan.firstPayoutDays} onChange={(v) => patch({ firstPayoutDays: v })} suffix="days" min={0} max={60} />
            </MiniField>
            <MiniField label="Minimum payout">
              <NumInput size="sm" value={plan.minPayout} onChange={(v) => patch({ minPayout: v })} prefix="$" min={0} />
            </MiniField>
          </div>
          <SettingRow className="mt-2 pb-0" label="Refund fee on first payout" hint="Challenge fee added to the first approved payout">
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
              <NumInput size="sm" className="w-24" value={plan.scalingEvery} onChange={(v) => patch({ scalingEvery: v })} suffix="mo" min={1} max={12} />
              add
              <NumInput size="sm" className="w-20" value={plan.scalingIncrease} onChange={(v) => patch({ scalingIncrease: v })} suffix="%" min={5} max={100} step={5} />
              if profit ≥
              <NumInput size="sm" className="w-20" value={plan.scalingProfit} onChange={(v) => patch({ scalingProfit: v })} suffix="%" min={1} max={30} />
              cap
              <Select size="sm" className="w-24" value={String(plan.scalingCap)} onChange={(v) => patch({ scalingCap: +v })} options={[{ value: "500000", label: "$500K" }, { value: "1000000", label: "$1M" }, { value: "2000000", label: "$2M" }, { value: "4000000", label: "$4M" }]} />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {ladder.map((l) => (
              <div key={l.level} className={cn("rounded-[12px] border px-3 py-2.5", l.level === 0 ? "border-ember/35 bg-ember-soft" : "border-line bg-surface-3/40")}>
                <div className="flex items-center justify-between text-[10.5px] uppercase tracking-wider text-fg-3">
                  <span>L{l.level}</span>
                  <span className="k-num normal-case">{l.level === 0 ? "start" : `m${l.month}`}</span>
                </div>
                <div className="k-num mt-1 text-[15px] font-semibold">{fmtK(l.size)}</div>
                <div className="k-num text-[11.5px] text-gold">{l.split}% split</div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-[11.5px] text-fg-3">Example ladder for a $100K account; each step also requires 2 approved payouts and no open violations.</div>
        </div>
      </div>
    </Card>
  );
}
