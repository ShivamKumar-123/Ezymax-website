"use client";

import * as React from "react";
import { Check, Eye, Minus, X } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, Segmented, Starfield, cn } from "@kalks/ui";
import type { PropPlan } from "./data";
import { PlanTypeChip } from "./rules";

const fmtK = (v: number) => `$${Math.round(v / 1000)}K`;

/** The plan as the trader sees it in the client-area store. */
export function PlanPreview({ plan }: { plan: PropPlan }) {
  const enabled = plan.sizes.filter((s) => s.enabled);
  const [size, setSize] = React.useState<string>(String(enabled[Math.min(3, enabled.length - 1)]?.size ?? ""));
  const row = enabled.find((s) => String(s.size) === size) ?? enabled[0];
  React.useEffect(() => {
    if (!enabled.some((s) => String(s.size) === size) && enabled[0]) setSize(String(enabled[0].size));
  }, [enabled, size]);

  const rules: { label: string; value: string; ok?: boolean | null }[] = [
    ...plan.phases.map((p) => ({ label: `${p.name} target`, value: `${p.target}%${p.timeLimit ? ` · ${p.timeLimit}d` : ""}` })),
    { label: "Daily loss", value: `${plan.dailyLoss}% · ${plan.dailyBasis}` },
    { label: "Max drawdown", value: `${plan.maxDD}% · ${plan.ddType}` },
    { label: "Min trading days", value: plan.phases.length ? `${plan.phases[0].minDays} days` : "None" },
    { label: "Consistency", value: plan.consistency ? `${plan.consistency}% / day` : "None" },
    { label: "News trading", value: plan.newsTrading ? "Allowed" : `±${plan.newsWindow} min`, ok: plan.newsTrading },
    { label: "Weekend holding", value: plan.weekendHolding ? "Allowed" : "Not allowed", ok: plan.weekendHolding },
    { label: "Expert Advisors", value: plan.eaAllowed ? "Allowed" : "Not allowed", ok: plan.eaAllowed },
    { label: "Leverage", value: row ? `1:${row.leverage}` : "-" },
  ];

  return (
    <Card hot className="overflow-hidden">
      <Starfield density={28} />
      <div className="relative px-6 pb-6 pt-5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-fg-3">
            <Eye className="size-3.5" /> Client preview
          </span>
          <PlanTypeChip type={plan.type} />
        </div>
        <div className="mt-3 text-[20px] font-medium tracking-tight">{plan.name || "Untitled plan"}</div>
        <div className="mt-1 text-[12.5px] text-fg-2">
          {plan.type === "instant" ? "Skip the evaluation. Trade a funded account today." : plan.phases.length === 1 ? "One phase, one target. The fastest path to funding." : "The classic evaluation with relaxed limits."}
        </div>

        {enabled.length > 0 ? (
          <>
            <div className="mt-4 overflow-x-auto">
              <Segmented size="xs" value={size} onChange={setSize} options={enabled.map((s) => ({ value: String(s.size), label: fmtK(s.size) }))} />
            </div>
            <div className="mt-4 flex items-end justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-fg-3">One-time fee</div>
                <div className="k-num text-[34px] font-semibold leading-none tracking-tight">
                  ${row?.fee}
                  <span className="text-[16px] opacity-40">.00</span>
                </div>
              </div>
              {plan.refundFee && (
                <Chip size="sm" tone="up">
                  Refundable
                </Chip>
              )}
            </div>
          </>
        ) : (
          <div className="mt-4 rounded-[12px] border border-dashed border-down/40 px-3 py-3 text-[12.5px] text-down">No account sizes enabled. The plan cannot be published.</div>
        )}

        {plan.phases.length > 0 && (
          <div className="mt-5 flex items-center gap-2">
            {plan.phases.map((p, i) => (
              <React.Fragment key={i}>
                <div className="min-w-0 flex-1 rounded-[12px] border border-line bg-surface-2/70 px-3 py-2">
                  <div className="truncate text-[11px] text-fg-3">{p.name}</div>
                  <div className="k-num text-[14px] font-medium text-up">+{p.target}%</div>
                </div>
                {i < plan.phases.length - 1 && <span className="h-px w-3 bg-line" />}
              </React.Fragment>
            ))}
            <span className="h-px w-3 bg-line" />
            <div className="min-w-0 flex-1 rounded-[12px] border border-gold/30 bg-gold-soft px-3 py-2">
              <div className="truncate text-[11px] text-fg-3">Funded</div>
              <div className="k-num text-[14px] font-medium text-gold">{plan.split}%</div>
            </div>
          </div>
        )}

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

        <Button variant="ember" className="mt-5 w-full" shimmer onClick={() => toast("Preview only", { description: "Traders see this CTA in the client-area store." })}>
          Start challenge{row ? ` · $${row.fee}` : ""}
        </Button>
      </div>
    </Card>
  );
}

/** List of field changes between the saved plan and the draft. */
export function diffPlan(a: PropPlan, b: PropPlan): string[] {
  const out: string[] = [];
  if (a.name !== b.name) out.push(`Name → "${b.name}"`);
  if (a.type !== b.type) out.push(`Type ${a.type} → ${b.type}`);
  if (JSON.stringify(a.phases) !== JSON.stringify(b.phases)) out.push(`Phases: ${b.phases.map((p) => `${p.target}%/${p.minDays}d`).join(", ") || "none"}`);
  b.sizes.forEach((s, i) => {
    const o = a.sizes[i];
    if (o.fee !== s.fee) out.push(`$${s.size / 1000}K fee $${o.fee} → $${s.fee}`);
    if (o.enabled !== s.enabled) out.push(`$${s.size / 1000}K ${s.enabled ? "enabled" : "disabled"}`);
    if (o.leverage !== s.leverage) out.push(`$${s.size / 1000}K leverage 1:${o.leverage} → 1:${s.leverage}`);
  });
  if (a.dailyLoss !== b.dailyLoss || a.dailyBasis !== b.dailyBasis) out.push(`Daily loss ${a.dailyLoss}% ${a.dailyBasis} → ${b.dailyLoss}% ${b.dailyBasis}`);
  if (a.maxDD !== b.maxDD || a.ddType !== b.ddType) out.push(`Max DD ${a.maxDD}% ${a.ddType} → ${b.maxDD}% ${b.ddType}`);
  if (a.consistency !== b.consistency) out.push(`Consistency ${a.consistency || "off"} → ${b.consistency ? b.consistency + "%" : "off"}`);
  if (a.newsTrading !== b.newsTrading || a.newsWindow !== b.newsWindow) out.push(`News trading ${b.newsTrading ? "allowed" : `blocked ±${b.newsWindow}m`}`);
  if (a.weekendHolding !== b.weekendHolding) out.push(`Weekend holding ${b.weekendHolding ? "allowed" : "blocked"}`);
  if (a.eaAllowed !== b.eaAllowed) out.push(`EAs ${b.eaAllowed ? "allowed" : "blocked"}`);
  if (a.banned.join() !== b.banned.join()) out.push(`Banned strategies: ${b.banned.length}`);
  if (a.split !== b.split || a.splitMax !== b.splitMax) out.push(`Split ${a.split}/${a.splitMax} → ${b.split}/${b.splitMax}`);
  if (a.scalingEvery !== b.scalingEvery || a.scalingIncrease !== b.scalingIncrease || a.scalingProfit !== b.scalingProfit || a.scalingCap !== b.scalingCap) out.push(`Scaling every ${b.scalingEvery}mo +${b.scalingIncrease}% @ ${b.scalingProfit}%`);
  if (a.refundFee !== b.refundFee) out.push(`Fee refund ${b.refundFee ? "on" : "off"}`);
  if (a.payoutFreq !== b.payoutFreq || a.firstPayoutDays !== b.firstPayoutDays || a.minPayout !== b.minPayout) out.push(`Payouts ${b.payoutFreq}, first ${b.firstPayoutDays}d, min $${b.minPayout}`);
  return out;
}

export function ChangeSummary({ changes, plan, onSave, onPublish, onDiscard }: { changes: string[]; plan: PropPlan; onSave: () => void; onPublish: () => void; onDiscard: () => void }) {
  return (
    <Card>
      <CardHeader title="Pending changes" subtitle={`v${plan.version} → v${plan.version + 1} · applies to new purchases only`} action={<Chip tone={changes.length ? "warn" : "neutral"}>{changes.length}</Chip>} />
      <div className="px-4 pb-5 pt-3 sm:px-6">
        {changes.length ? (
          <ul className="max-h-48 space-y-1.5 overflow-y-auto">
            {changes.map((c) => (
              <li key={c} className="flex items-start gap-2 text-[12.5px] text-fg-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-warn" />
                <span className="k-num">{c}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-[12px] border border-dashed border-line px-3 py-3 text-center text-[12.5px] text-fg-3">No unsaved edits. Existing {plan.active.toLocaleString()} accounts keep the rules they bought.</div>
        )}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Button size="sm" variant="ghost" disabled={!changes.length} onClick={onDiscard}>
            Discard
          </Button>
          <Button size="sm" variant="surface" disabled={!changes.length} onClick={onSave}>
            Save draft
          </Button>
          <Button size="sm" variant="ember" onClick={onPublish} className={cn(!plan.sizes.some((s) => s.enabled) && "pointer-events-none opacity-50")}>
            Publish
          </Button>
        </div>
      </div>
    </Card>
  );
}
