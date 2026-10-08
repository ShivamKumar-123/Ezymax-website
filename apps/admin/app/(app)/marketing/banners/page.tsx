"use client";

import * as React from "react";
import { CalendarRange, Copy, Eye, Image as ImageIcon, LayoutDashboard, LogIn, MoreHorizontal, MousePointerClick, Pencil, Plus, Trash2, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, IconButton, KpiCard, Menu, PageHeader, Reveal, Segmented, StatusChip, Toggle, cn } from "@ezymex/ui";
import { MKT_BANNERS, type MktBanner, type MktPlacement } from "@ezymex/mock/admin-growth-marketing";
import { BannerEditor } from "@/components/marketing/banner-editor";
import { BannerPreview, fmtDate, fmtInt, fmtK } from "@/components/marketing/kit";
import { IS_DEMO } from "@ezymex/mock/mode";
import { LiveBanners } from "@/components/marketing/live/banners";

type P = "all" | MktPlacement;
const PLACEMENT_ICON: Record<MktPlacement, React.ReactNode> = { dashboard: <LayoutDashboard className="size-3" />, wallet: <Wallet className="size-3" />, login: <LogIn className="size-3" /> };

function DemoBannersPage() {
  const [placement, setPlacement] = React.useState<P>("all");
  const [editing, setEditing] = React.useState<MktBanner | null>(null);
  const [open, setOpen] = React.useState(false);
  const edit = (b: MktBanner | null) => {
    setEditing(b);
    setOpen(true);
  };
  const list = MKT_BANNERS.filter((b) => placement === "all" || b.placement === placement);
  const imp = MKT_BANNERS.reduce((s, b) => s + b.impressions, 0);
  const clk = MKT_BANNERS.reduce((s, b) => s + b.clicks, 0);
  const count = (p: MktPlacement) => MKT_BANNERS.filter((b) => b.placement === p).length;

  return (
    <div className="pb-16">
      <PageHeader
        title="Banners & announcements"
        subtitle="Targeted promos inside the Client Area — dashboard, wallet and login screens."
        actions={
          <>
            <Button variant="surface" onClick={() => toast.info("Opening Client Area as a test client", { description: "Segment: New sign-ups (7d) · locale EN" })}>
              <Eye /> Preview as client
            </Button>
            <Button variant="ember" shimmer onClick={() => edit(null)}>
              <Plus /> New banner
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Live banners" icon={<ImageIcon />} value={<span className="k-num">{MKT_BANNERS.filter((b) => b.status === "active").length}</span>} chip="1 scheduled · 1 paused" />
        <KpiCard label="Impressions · 30d" icon={<Users />} value={<span className="k-num">{fmtK(imp)}</span>} chip="+18.2% vs prior" chipTone="up" delay={0.05} />
        <KpiCard label="Clicks · 30d" icon={<MousePointerClick />} value={<span className="k-num">{fmtK(clk)}</span>} chip="+9.6% vs prior" chipTone="up" delay={0.1} />
        <KpiCard label="Average CTR" value={<span className="k-num">{((clk / imp) * 100).toFixed(2)}%</span>} hot illustration="speech_balloon" footer={<Chip tone="gold">Best: Crypto week 6.8%</Chip>} delay={0.15} />
      </div>

      <Reveal delay={0.1} className="mt-4">
        <Card>
          <CardHeader
            title="Banner library"
            subtitle="Rendered exactly as clients see them"
            action={
              <Segmented
                size="sm"
                value={placement}
                onChange={setPlacement}
                options={[
                  { value: "all", label: <>All <span className="text-fg-3">{MKT_BANNERS.length}</span></> },
                  { value: "dashboard", label: <>Dashboard <span className="text-fg-3">{count("dashboard")}</span></> },
                  { value: "wallet", label: <>Wallet <span className="text-fg-3">{count("wallet")}</span></> },
                  { value: "login", label: <>Login <span className="text-fg-3">{count("login")}</span></> },
                ]}
              />
            }
          />
          <div className="mt-5 grid grid-cols-1 gap-4 px-4 pb-6 sm:px-6 md:grid-cols-2 xl:grid-cols-3">
            {list.map((b, i) => (
              <Reveal key={b.id} delay={i * 0.03}>
                <BannerTile b={b} onEdit={edit} />
              </Reveal>
            ))}
          </div>
        </Card>
      </Reveal>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.1} className="xl:col-span-7">
          <PerformanceCard />
        </Reveal>
        <Reveal delay={0.15} className="xl:col-span-5">
          <RotationCard />
        </Reveal>
      </div>

      <BannerEditor open={open} onOpenChange={setOpen} banner={editing} />
    </div>
  );
}

function BannerTile({ b, onEdit }: { b: MktBanner; onEdit: (b: MktBanner) => void }) {
  const [on, setOn] = React.useState(b.status === "active" || b.status === "scheduled");
  const ctr = b.impressions ? (b.clicks / b.impressions) * 100 : 0;
  return (
    <div className="k-row group flex h-full flex-col overflow-hidden p-2.5 transition-colors hover:border-[var(--k-border-top)]">
      <div className="relative">
        <BannerPreview photo={b.photo} eyebrow={b.eyebrow} headline={b.headline} sub={b.sub} cta={b.cta} />
        <div className="absolute bottom-2.5 right-2.5 flex gap-1.5">
          <span className="inline-flex h-6 items-center gap-1 rounded-full border border-white/15 bg-black/55 px-2 text-[10.5px] font-medium capitalize text-white backdrop-blur">
            {PLACEMENT_ICON[b.placement]} {b.placement}
          </span>
        </div>
        <span className="absolute right-2.5 top-2.5 rounded-full border border-white/15 bg-black/55 px-2 py-0.5 font-mono text-[10.5px] text-white/80 backdrop-blur">P{b.priority}</span>
      </div>
      <div className="flex flex-1 flex-col px-1.5 pb-1 pt-3">
        <div className="flex items-center gap-2">
          <StatusChip status={on ? b.status : "paused"} label={on && b.status === "scheduled" ? "Scheduled" : undefined} />
          <span className="flex items-center gap-1 truncate text-[11.5px] text-fg-3">
            <CalendarRange className="size-3.5 shrink-0" />
            {fmtDate(b.start, false)} – {fmtDate(b.end)}
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <Toggle
              checked={on}
              label="Enabled"
              onChange={(v) => {
                setOn(v);
                toast.success(v ? "Banner resumed" : "Banner paused", { description: b.headline });
              }}
            />
            <Menu
              trigger={
                <IconButton size="sm" aria-label="Banner actions">
                  <MoreHorizontal />
                </IconButton>
              }
              items={[
                { label: "Edit", icon: <Pencil />, onSelect: () => onEdit(b) },
                { label: "Duplicate", icon: <Copy />, onSelect: () => toast.success("Banner duplicated as draft") },
                { label: "Preview as client", icon: <Eye />, onSelect: () => toast.info(`Previewing on ${b.placement}`) },
                "sep",
                { label: "Delete", icon: <Trash2 />, danger: true, onSelect: () => toast.warning("Banner deleted", { description: b.headline }) },
              ]}
            />
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1">
          {b.segments.map((s) => (
            <Chip key={s} size="sm" tone="ember">
              {s}
            </Chip>
          ))}
          {b.locales.map((l) => (
            <Chip key={l} size="sm">
              {l}
            </Chip>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3">
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.06em] text-fg-3">Impr.</div>
            <div className="k-num text-[14px] font-medium">{fmtK(b.impressions)}</div>
          </div>
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.06em] text-fg-3">Clicks</div>
            <div className="k-num text-[14px] font-medium">{fmtInt(b.clicks)}</div>
          </div>
          <div className="text-right">
            <div className="text-[10.5px] uppercase tracking-[0.06em] text-fg-3">CTR</div>
            <div className={cn("k-num text-[14px] font-semibold", ctr >= 5 ? "text-up" : ctr >= 2 ? "text-gold" : ctr > 0 ? "text-fg-2" : "text-fg-3")}>{ctr ? `${ctr.toFixed(2)}%` : "—"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PerformanceCard() {
  const rows = [...MKT_BANNERS].filter((b) => b.impressions > 0).sort((a, b) => b.clicks / b.impressions - a.clicks / a.impressions).slice(0, 7);
  const best = rows[0]!.clicks / rows[0]!.impressions;
  return (
    <Card className="h-full">
      <CardHeader title="CTR leaderboard" subtitle="Click-through rate by banner · last 30 days" />
      <div className="mt-4 space-y-2 px-4 pb-6 sm:px-6">
        {rows.map((b, i) => {
          const ctr = b.clicks / b.impressions;
          return (
            <button key={b.id} type="button" onClick={() => toast.info(b.headline, { description: `${fmtInt(b.clicks)} clicks from ${fmtInt(b.impressions)} impressions` })} className="k-row flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-surface-3/60">
              <span className="k-num w-4 text-[12px] text-fg-3">{i + 1}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.photo} alt="" className="h-9 w-14 shrink-0 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium">{b.headline}</div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
                  <div className="h-full rounded-full bg-gradient-to-r from-ember to-gold" style={{ width: `${(ctr / best) * 100}%` }} />
                </div>
              </div>
              <span className="hidden w-20 text-right text-[11.5px] capitalize text-fg-3 sm:block">{b.placement}</span>
              <span className="k-num w-14 text-right text-[13px] font-semibold">{(ctr * 100).toFixed(2)}%</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function RotationCard() {
  const groups: MktPlacement[] = ["dashboard", "wallet", "login"];
  return (
    <Card className="h-full">
      <CardHeader title="Rotation queue" subtitle="What each placement serves right now, by priority" />
      <div className="mt-4 space-y-4 px-4 pb-6 sm:px-6">
        {groups.map((g) => {
          const items = MKT_BANNERS.filter((b) => b.placement === g).sort((a, b) => a.priority - b.priority);
          const imp = items.reduce((s, b) => s + b.impressions, 0);
          return (
            <div key={g}>
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2 text-[13px] font-medium capitalize">
                  <span className="grid size-6 place-items-center rounded-full border border-line bg-surface-2 text-fg-2">{PLACEMENT_ICON[g]}</span>
                  {g}
                </span>
                <span className="k-num text-[11.5px] text-fg-3">{fmtK(imp)} impressions</span>
              </div>
              <div className="flex h-9 gap-1 overflow-hidden rounded-xl">
                {items.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => toast.info(`Priority ${b.priority} · ${b.headline}`)}
                    className="relative min-w-9 overflow-hidden rounded-lg border border-line"
                    style={{ flex: Math.max(b.impressions, imp * 0.06) }}
                    title={b.headline}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={b.photo} alt="" className="absolute inset-0 size-full object-cover opacity-60" />
                    <span className="absolute inset-0 bg-gradient-to-r from-black/80 to-black/20" />
                    <span className="relative block truncate px-2 text-left text-[11px] font-medium text-white">P{b.priority} · {b.eyebrow}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        <div className="k-row mt-2 flex items-center justify-between px-4 py-3 text-[12.5px]">
          <span className="text-fg-3">Frequency cap</span>
          <span className="font-medium">3 impressions / client / day</span>
          <Button size="xs" variant="surface" onClick={() => toast.success("Frequency cap saved")}>
            Edit
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default function BannersPage() {
  return IS_DEMO ? <DemoBannersPage /> : <LiveBanners />;
}
