"use client";

import * as React from "react";
import { CalendarClock, Copy, Eye, MoreHorizontal, Pause, Pencil, Archive, Play } from "lucide-react";
import { toast } from "sonner";
import { Button, Chip, Icon3D, IconButton, Menu, Progress, SpotlightCard, StatusChip, Toggle, Tooltip, cn } from "@ezymex/ui";
import type { MktBonusCampaign } from "@ezymex/mock/admin-growth-marketing";
import { FlagStack, fmtInt, fmtK } from "./kit";

const KIND_LABEL: Record<MktBonusCampaign["kind"], string> = { deposit: "Deposit bonus", "no-deposit": "No-deposit", reload: "Reload", crypto: "Crypto boost" };

export function BonusCampaignCard({ c, onEdit }: { c: MktBonusCampaign; onEdit: (c: MktBonusCampaign) => void }) {
  const [enabled, setEnabled] = React.useState(c.enabled);
  const releasedPct = c.creditIssued ? (c.released / c.creditIssued) * 100 : 0;
  const status = !enabled && c.status === "active" ? "paused" : enabled && c.status === "paused" ? "active" : c.status;
  return (
    <SpotlightCard className="flex h-full flex-col">
      <div className="relative px-5 pt-5">
        <div className="flex items-start gap-3.5">
          <div className="relative grid size-14 shrink-0 place-items-center rounded-2xl border border-line bg-surface-2 shadow-[inset_0_1px_0_var(--k-border-top)]">
            <Icon3D name={c.illustration} size={40} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-[15.5px] font-medium tracking-tight">{c.name}</h3>
            </div>
            <p className="mt-0.5 truncate text-[12.5px] text-fg-3">{c.tagline}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <StatusChip status={status} label={status === "scheduled" ? "Scheduled" : undefined} />
              <Chip size="sm">{KIND_LABEL[c.kind]}</Chip>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Toggle
              checked={enabled}
              label={`Enable ${c.name}`}
              onChange={(v) => {
                setEnabled(v);
                toast.success(v ? `${c.name} enabled` : `${c.name} paused`, { description: v ? "New eligible deposits will receive credit" : "Existing credit keeps releasing; no new grants" });
              }}
            />
            <Menu
              trigger={
                <IconButton size="sm" aria-label="Campaign actions">
                  <MoreHorizontal />
                </IconButton>
              }
              items={[
                { label: "Edit rules", icon: <Pencil />, onSelect: () => onEdit(c) },
                { label: "Duplicate", icon: <Copy />, onSelect: () => toast.success(`${c.name} duplicated`, { description: "Saved as draft" }) },
                { label: "View grants", icon: <Eye />, onSelect: () => toast.info(`${fmtInt(c.claimed)} grants for ${c.name}`) },
                { label: enabled ? "Pause" : "Resume", icon: enabled ? <Pause /> : <Play />, onSelect: () => setEnabled((v) => !v) },
                "sep",
                { label: "Archive", icon: <Archive />, danger: true, onSelect: () => toast.warning(`${c.name} archived`) },
              ]}
            />
          </div>
        </div>

        <div className="mt-5 flex items-end justify-between gap-3">
          <div>
            <div className="k-label text-fg-3">Offer</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="k-num bg-gradient-to-br from-[#ffb070] to-[#ff5a1f] bg-clip-text text-[38px] font-semibold leading-none tracking-tight text-transparent">
                {c.kind === "no-deposit" ? `$${c.fixed}` : `${c.pct}%`}
              </span>
              <span className="text-[12.5px] text-fg-2">{c.kind === "no-deposit" ? "free credit" : <>up to <span className="k-num text-fg">${fmtInt(c.max)}</span></>}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="k-label text-fg-3">Conversion</div>
            <div className={cn("k-num mt-1 text-[20px] font-semibold", c.conversionPct >= 50 ? "text-up" : c.conversionPct > 0 ? "text-warn" : "text-fg-3")}>{c.conversionPct ? `${c.conversionPct}%` : "—"}</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Rule label="Min deposit" value={c.minDeposit ? `$${fmtInt(c.minDeposit)}` : "None"} />
          <Rule label="Release" value={`$${c.releasePerLot} / lot`} accent />
          <Rule label="Expiry" value={`${c.expiryDays} days`} />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap gap-1">
            {c.groups.slice(0, 3).map((g) => (
              <span key={g} className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-[11px] text-fg-2">
                {g}
              </span>
            ))}
            {c.groups.length > 3 && <span className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-[11px] text-fg-3">+{c.groups.length - 3}</span>}
          </div>
          <Tooltip content={`${c.countries.length} eligible countries`}>
            <span>
              <FlagStack countries={c.countries} max={5} />
            </span>
          </Tooltip>
        </div>
      </div>

      <div className="mt-4 flex-1 border-t border-line px-5 pb-4 pt-4">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="text-[11px] text-fg-3">Claimed</div>
            <div className="k-num mt-0.5 text-[14px] font-medium">{fmtInt(c.claimed)}</div>
          </div>
          <div>
            <div className="text-[11px] text-fg-3">Credit issued</div>
            <div className="k-num mt-0.5 text-[14px] font-medium">${fmtK(c.creditIssued)}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-fg-3">Released</div>
            <div className="k-num mt-0.5 text-[14px] font-medium text-gold">{releasedPct.toFixed(1)}%</div>
          </div>
        </div>
        <Progress value={releasedPct} tone="gold" className="mt-3" />
        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5 truncate text-[12px] text-fg-3">
            <CalendarClock className="size-3.5 shrink-0" />
            {c.schedule}
          </span>
          <Button size="xs" variant="surface" onClick={() => onEdit(c)}>
            <Pencil /> Edit rules
          </Button>
        </div>
      </div>
    </SpotlightCard>
  );
}

function Rule({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn("k-row px-3 py-2", accent && "border-ember/25 bg-ember-soft")}>
      <div className="truncate text-[10.5px] uppercase tracking-[0.06em] text-fg-3">{label}</div>
      <div className={cn("k-num mt-0.5 truncate text-[13px] font-medium", accent && "text-ember")}>{value}</div>
    </div>
  );
}
