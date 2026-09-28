"use client";

import * as React from "react";
import Link from "next/link";
import { Archive, Copy, History, Layers, MoreHorizontal, Pencil, Plus, Route as RouteIcon, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, IconButton, KpiCard, Menu, Money, PageHeader, Reveal, Segmented, cn, formatCompact, formatDateTime, type ChipTone } from "@kalks/ui";
import { ADMIN_GROUPS, type AdminGroup } from "@kalks/mock/admin-config";
import { GroupEditor, ROUTE_LABEL, CHARGE_LABEL, blankGroup } from "@/components/config/group-editor";
import { auditToast, useReason } from "@/components/config/kit";
import { IS_DEMO } from "@kalks/mock/mode";
import { LiveGroupsPage } from "@/components/trading-live/groups";

const ROUTE_TONE: Record<AdminGroup["route"], ChipTone> = { A: "info", B: "neutral", auto: "ember" };
const ACCENT: Record<AdminGroup["tone"], string> = {
  ember: "from-[#ff7a2f] to-[#b8330f] text-white",
  gold: "from-[#f3cf6b] to-[#9c6f14] text-[#1a1204]",
  info: "from-[#7dd3fc] to-[#0e7490] text-[#04131a]",
  up: "from-[#4ade80] to-[#15803d] text-[#04130a]",
  neutral: "from-[#3b3b44] to-[#17171c] text-fg",
  warn: "from-[#fbbf24] to-[#b45309] text-[#1a1204]",
};

function commissionText(g: AdminGroup) {
  return g.commission.perLot ? `$${g.commission.perLot} ${g.commission.chargeOn === "round" ? "RT" : g.commission.chargeOn}` : "None";
}
function markupText(g: AdminGroup) {
  return g.markup.type === "fixed" ? `+${g.markup.value.toFixed(1)} pips` : `+${g.markup.value}%`;
}

function GroupCard({ g, onEdit, onDuplicate, onArchive }: { g: AdminGroup; onEdit: () => void; onDuplicate: () => void; onArchive: () => void }) {
  const rows: [string, React.ReactNode][] = [
    ["Leverage", `up to 1:${Math.max(...g.leverage)}`],
    ["MC / SO", `${g.marginCall}% / ${g.stopOut}%`],
    ["Hedged margin", `${g.hedgedMargin}%`],
    ["Min deposit", g.minDeposit >= 1000 ? `$${formatCompact(g.minDeposit)}` : `$${g.minDeposit}`],
    ["Commission", commissionText(g)],
    ["Markup", <span key="m">{markupText(g)} <span className="text-fg-3">· ≥{g.markup.floor}</span></span>],
  ];
  return (
    <Card className="group flex h-full flex-col transition-colors hover:border-[var(--k-border-top)]">
      <div className="flex items-start gap-3 px-5 pt-5">
        <span className={cn("grid size-11 shrink-0 place-items-center rounded-[14px] bg-gradient-to-br text-[15px] font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]", ACCENT[g.tone])}>{g.name.slice(0, 2)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-[16px] font-medium tracking-tight">{g.name}</h3>
            {g.status === "draft" && <Chip size="sm" tone="warn">Draft</Chip>}
          </div>
          <p className="mt-0.5 truncate text-[12.5px] text-fg-3">{g.tagline || "No tagline"}</p>
        </div>
        <Menu
          trigger={
            <IconButton size="sm" aria-label="Group actions">
              <MoreHorizontal />
            </IconButton>
          }
          items={[
            { label: "Edit group", icon: <Pencil />, onSelect: onEdit },
            { label: "Duplicate", icon: <Copy />, onSelect: onDuplicate },
            { label: "View clients", icon: <Users />, href: "/clients" },
            { label: "Change history", icon: <History />, href: "/security" },
            "sep",
            { label: "Archive group", icon: <Archive />, danger: true, onSelect: onArchive },
          ]}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 px-5">
        <Chip size="sm" tone="neutral">{g.mode === "hedging" ? "Hedging" : "Netting"}</Chip>
        <Chip size="sm" tone={ROUTE_TONE[g.route]}>
          <RouteIcon className="size-3" /> {ROUTE_LABEL[g.route]}
        </Chip>
        {g.cent && <Chip size="sm" tone="gold">Cent · USC</Chip>}
        {g.swapFree && <Chip size="sm" tone="up">Swap-free</Chip>}
        <Chip size="sm" tone="neutral">{g.server}</Chip>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3 px-5">
        <div>
          <div className="k-label">Clients</div>
          <div className="k-num mt-1 text-[26px] font-semibold leading-none tracking-tight">{g.clients.toLocaleString()}</div>
          <div className="k-num mt-1 text-[11.5px] text-fg-3">{g.accounts.toLocaleString()} accounts</div>
        </div>
        <div className="text-right">
          <div className="k-label">Equity</div>
          <Money value={g.equity} decimals={0} className="mt-1 block text-[17px] font-medium" />
          <div className="k-num mt-1 text-[11.5px] text-fg-3">{formatCompact(g.volume30d)} lots · 30d</div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-[14px] border border-line bg-line mx-5">
        {rows.map(([k, v]) => (
          <div key={k} className="bg-surface-2 px-3 py-2.5">
            <div className="truncate text-[10.5px] uppercase tracking-wider text-fg-3">{k}</div>
            <div className="k-num mt-0.5 truncate text-[13px] font-medium">{v}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-1 px-5">
        {g.leverage.map((l) => (
          <span key={l} className={cn("k-num rounded-md px-1.5 py-0.5 font-mono text-[10.5px]", l === g.defaultLeverage ? "bg-ember-soft text-ember" : "bg-surface-3 text-fg-2")}>
            1:{l}
          </span>
        ))}
      </div>
      <div className="mt-auto flex items-center gap-3 border-t border-line px-5 py-3.5 mt-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between text-[11px] text-fg-3">
            <span>A-book share</span>
            <span className="k-num text-fg-2">{g.aBookShare}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full bg-gradient-to-r from-info/60 to-info" style={{ width: `${g.aBookShare}%` }} />
          </div>
        </div>
        <Button size="sm" variant="surface" onClick={onEdit}>
          <Pencil /> Edit
        </Button>
      </div>
    </Card>
  );
}

function CompareTable({ groups, onEdit }: { groups: AdminGroup[]; onEdit: (g: AdminGroup) => void }) {
  const rows: [string, (g: AdminGroup) => React.ReactNode][] = [
    ["Account mode", (g) => (g.mode === "hedging" ? "Hedging" : "Netting")],
    ["Currency", (g) => g.currency],
    ["Leverage options", (g) => g.leverage.map((l) => `1:${l}`).join(" · ")],
    ["Default leverage", (g) => `1:${g.defaultLeverage}`],
    ["Margin call / stop-out", (g) => `${g.marginCall}% / ${g.stopOut}%`],
    ["Hedged margin", (g) => `${g.hedgedMargin}%`],
    ["Minimum deposit", (g) => `$${g.minDeposit.toLocaleString()}`],
    ["Swap-free", (g) => (g.swapFree ? <Chip key="s" size="sm" tone="up">Yes</Chip> : <span className="text-fg-3">No</span>)],
    ["Islamic admin fee", (g) => (g.islamicFee.enabled ? `$${g.islamicFee.perLot}/lot/night after ${g.islamicFee.graceDays}` : <span className="text-fg-3">—</span>)],
    ["Route", (g) => <Chip key="r" size="sm" tone={ROUTE_TONE[g.route]}>{ROUTE_LABEL[g.route]}</Chip>],
    ["Commission", (g) => (g.commission.perLot ? `$${g.commission.perLot} · ${CHARGE_LABEL[g.commission.chargeOn]}` : <span className="text-fg-3">None</span>)],
    ["Spread markup / floor", (g) => `${markupText(g)} / ${g.markup.floor} pips`],
    ["Max lot · positions", (g) => `${g.maxLot} · ${g.maxPositions}`],
    ["Last change", (g) => <span key="u" className="text-fg-3">{g.updatedBy.split(" ")[0]} · {formatDateTime(g.updatedAt, { day: "2-digit", month: "short" })}</span>],
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] border-separate border-spacing-0 text-[12.5px]">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 rounded-l-[14px] border-y border-l border-line bg-surface-2 px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-fg-3">Parameter</th>
            {groups.map((g, i) => (
              <th key={g.id} className={cn("border-y border-line bg-surface-2 px-3 py-2 text-left", i === groups.length - 1 && "rounded-r-[14px] border-r")}>
                <button onClick={() => onEdit(g)} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-fg hover:text-ember">
                  {g.name} <Pencil className="size-3 opacity-50" />
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([k, fn]) => (
            <tr key={k} className="group">
              <td className="sticky left-0 z-10 border-b border-line bg-surface px-4 py-2.5 text-fg-3 group-hover:bg-surface-2">{k}</td>
              {groups.map((g) => (
                <td key={g.id} className="k-num border-b border-line px-3 py-2.5 text-fg-2 group-hover:bg-surface-2/60">
                  {fn(g)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AccountGroupsPage() {
  return IS_DEMO ? <DemoGroupsPage /> : <LiveGroupsPage />;
}

function DemoGroupsPage() {
  const [groups, setGroups] = React.useState<AdminGroup[]>(ADMIN_GROUPS);
  const [editing, setEditing] = React.useState<AdminGroup | null>(null);
  const [open, setOpen] = React.useState(false);
  const [view, setView] = React.useState<"cards" | "compare">("cards");
  const reason = useReason();

  const edit = (g: AdminGroup) => {
    setEditing(g);
    setOpen(true);
  };
  const clients = groups.reduce((s, g) => s + g.clients, 0);
  const equity = groups.reduce((s, g) => s + g.equity, 0);
  const vol = groups.reduce((s, g) => s + g.volume30d, 0);
  const aShare = groups.reduce((s, g) => s + g.volume30d * g.aBookShare, 0) / vol;

  return (
    <div className="pb-16">
      <PageHeader
        title="Account groups"
        subtitle="Trading conditions per group — leverage, margin, routing, commission and markup. Every save is versioned and audited."
        actions={
          <>
            <Link href="/security">
              <Button variant="surface" size="md">
                <History /> Change log
              </Button>
            </Link>
            <Button variant="ember" size="md" onClick={() => edit(blankGroup())}>
              <Plus /> New group
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Groups" icon={<Layers />} value={<span className="k-num">{groups.length}</span>} chip={`${groups.filter((g) => g.status === "active").length} published · ${groups.filter((g) => g.status === "draft").length} draft`} />
        <KpiCard label="Clients in groups" icon={<Users />} value={<span className="k-num">{clients.toLocaleString()}</span>} chip="+412 this week" chipTone="up" href="/clients" delay={0.05} />
        <KpiCard label="Equity under groups" icon={<Wallet />} value={<Money value={equity} decimals={0} />} chip={`${formatCompact(vol)} lots traded · 30d`} delay={0.1} />
        <KpiCard label="A-book share" icon={<RouteIcon />} value={<span className="k-num">{aShare.toFixed(1)}%</span>} chip="Volume-weighted · 30d" chipTone="ember" href="/trading/routing" hot illustration="bank" delay={0.15} />
      </div>

      <Reveal delay={0.1}>
        <div className="mb-3 mt-7 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[18px] font-medium tracking-tight">
            All groups <span className="k-num text-fg-3">{groups.length}</span>
          </h2>
          <Segmented size="xs" value={view} onChange={setView} options={[{ value: "cards", label: "Cards" }, { value: "compare", label: "Compare" }]} />
        </div>
      </Reveal>

      {view === "cards" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((g, i) => (
            <Reveal key={g.id} delay={0.05 + i * 0.04}>
              <GroupCard
                g={g}
                onEdit={() => edit(g)}
                onDuplicate={() => {
                  const copy = { ...structuredClone(g), id: `${g.id}-copy-${groups.length}`, name: `${g.name} (copy)`, status: "draft" as const, clients: 0, accounts: 0, equity: 0, volume30d: 0 };
                  setGroups((p) => [...p, copy]);
                  auditToast(`Duplicated “${g.name}” as draft`);
                }}
                onArchive={() =>
                  g.clients > 0
                    ? reason.ask({
                        title: `Archive ${g.name}?`,
                        description: `${g.clients.toLocaleString()} clients must be migrated first. Archiving stops new accounts in this group immediately.`,
                        reasons: ["Group retired — migrate to Pro", "Regulatory change", "Duplicate configuration", "Other"],
                        confirmLabel: "Archive group",
                        tone: "sell",
                        onConfirm: (r) => {
                          toast.message(`Archive request queued for ${g.name}`, { description: `${r} · needs second approval (4-eyes) from Head of Dealing` });
                        },
                      })
                    : (setGroups((p) => p.filter((x) => x.id !== g.id)), auditToast(`${g.name} archived`))
                }
              />
            </Reveal>
          ))}
        </div>
      ) : (
        <Reveal>
          <Card>
            <CardHeader title="Side-by-side" subtitle="Click a group name to edit" />
            <div className="px-4 pb-5 pt-4 sm:px-6">
              <CompareTable groups={groups} onEdit={edit} />
            </div>
          </Card>
        </Reveal>
      )}

      <GroupEditor
        group={editing}
        open={open}
        onOpenChange={setOpen}
        onSave={(ng) =>
          setGroups((p) => {
            const idx = p.findIndex((x) => x.id === editing?.id);
            if (idx === -1) return [...p, ng];
            const next = [...p];
            next[idx] = ng;
            return next;
          })
        }
      />
      {reason.node}
    </div>
  );
}
