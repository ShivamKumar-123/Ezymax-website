"use client";

import * as React from "react";
import { Copy, MoreHorizontal, Pause, Play, Trash2 } from "lucide-react";
import { Chip, IconButton, Menu, Sparkline, StatusChip, cn } from "@ezymex/ui";
import type { PropPlan } from "./data";
import { PlanTypeChip } from "./rules";

const fmtK = (v: number) => (v >= 1000 ? `$${Math.round(v / 1000)}K` : `$${v}`);

export function PlanCard({
  plan,
  selected,
  dirty,
  onSelect,
  onDuplicate,
  onToggleStatus,
  onArchive,
}: {
  plan: PropPlan;
  selected: boolean;
  dirty?: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onToggleStatus: () => void;
  onArchive: () => void;
}) {
  const enabled = plan.sizes.filter((s) => s.enabled);
  const from = Math.min(...enabled.map((s) => s.fee));
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      className={cn(
        "k-card group relative flex h-full cursor-pointer flex-col p-5 text-left outline-none transition-all",
        selected ? "border-ember/50 shadow-[0_0_0_1px_var(--k-ember),0_20px_50px_-24px_rgba(255,90,31,0.55)]" : "hover:border-[var(--k-border-top)]",
      )}
    >
      {selected && <span className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-ember to-transparent" />}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <PlanTypeChip type={plan.type} />
            <StatusChip status={plan.status} />
            {dirty && (
              <Chip size="sm" tone="warn">
                Unsaved
              </Chip>
            )}
          </div>
          <div className="mt-3 truncate text-[16px] font-medium tracking-tight">{plan.name}</div>
          <div className="k-num mt-0.5 text-[12px] text-fg-3">
            v{plan.version} · updated {plan.updated}
          </div>
        </div>
        <span onClick={(e) => e.stopPropagation()}>
          <Menu
            trigger={
              <IconButton size="sm" aria-label="Plan actions">
                <MoreHorizontal />
              </IconButton>
            }
            items={[
              { label: "Duplicate plan", icon: <Copy />, onSelect: onDuplicate },
              { label: plan.status === "active" ? "Pause sales" : "Resume sales", icon: plan.status === "active" ? <Pause /> : <Play />, onSelect: onToggleStatus },
              "sep",
              { label: "Archive plan", icon: <Trash2 />, danger: true, onSelect: onArchive },
            ]}
          />
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-1">
        {enabled.map((s) => (
          <span key={s.size} className="k-num rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-[11px] text-fg-2">
            {fmtK(s.size)}
          </span>
        ))}
      </div>

      <div className="mt-auto grid grid-cols-3 gap-2 pt-4">
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-fg-3">From</div>
          <div className="k-num mt-0.5 text-[15px] font-semibold">${from}</div>
        </div>
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-fg-3">Active</div>
          <div className="k-num mt-0.5 text-[15px] font-semibold">{plan.active.toLocaleString()}</div>
        </div>
        <div className="flex items-end justify-end">
          {plan.active > 0 ? <Sparkline data={plan.trend} width={64} height={26} tone="ember" /> : <span className="text-[11px] text-fg-3">No sales yet</span>}
        </div>
      </div>
    </div>
  );
}
