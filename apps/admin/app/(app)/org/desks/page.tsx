"use client";

import * as React from "react";
import { CalendarClock, Clock, MoreHorizontal, Pencil, Plus, Shuffle, UserPlus, Users, UsersRound, Wifi } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, Chip, Flag, Icon3D, IconButton, KpiCard, Menu, PageHeader, Progress, Reveal, Segmented, Sparkline, Toggle, Tooltip, cn } from "@kalks/ui";
import { DSK_DESKS, type DskDesk } from "@kalks/mock/admin-desks";
import { ReassignDialog, type ReassignResult } from "@/components/org/reassign-dialog";

type Filter = "all" | "client" | "ops";

function DeskCard({ d, onReassign }: { d: DskDesk; onReassign: (k: string) => void }) {
  const online = d.members.filter((m) => m.online).length;
  const owns = d.capacity > 0;
  const load = owns ? (d.clients / d.capacity) * 100 : 0;
  return (
    <div className="k-card flex h-full flex-col">
      <div className="flex items-start gap-3.5 px-6 pt-5">
        <span className="grid size-12 shrink-0 place-items-center rounded-[14px] border border-line bg-[radial-gradient(circle_at_30%_20%,var(--k-surface-3),var(--k-surface-2)_70%)] shadow-[inset_0_1px_0_var(--k-border-top)]">
          <Icon3D name={d.icon} size={32} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[17px] font-medium tracking-tight">{d.name}</h3>
            <Flag country={d.flag} className="size-4" />
            <Chip size="sm" tone={online ? "up" : "neutral"} dot>
              {online}/{d.members.length} online
            </Chip>
          </div>
          <p className="mt-0.5 line-clamp-1 text-[12.5px] text-fg-3">{d.blurb}</p>
        </div>
        <Menu
          trigger={
            <IconButton size="sm" aria-label={`${d.name} actions`}>
              <MoreHorizontal />
            </IconButton>
          }
          items={[
            { label: "Edit desk", icon: <Pencil />, onSelect: () => toast.info(`Edit ${d.name}`, { description: `Hours ${d.hours} · languages ${d.languages.join(", ")}` }) },
            { label: "Add member", icon: <UserPlus />, onSelect: () => toast.success("Invite sent", { description: `New member will join ${d.name} after 2FA setup` }) },
            { label: "Shift schedule", icon: <CalendarClock />, onSelect: () => toast.info(`${d.name} shifts`, { description: d.members.map((m) => `${m.person.name.split(" ")[0]} ${m.shift}`).join(" · ") }) },
            ...(owns ? ["sep" as const, { label: "Reassign clients", icon: <Shuffle />, onSelect: () => onReassign(d.key) }] : []),
          ]}
        />
      </div>

      {/* head + meta */}
      <div className="mx-6 mt-4 flex flex-wrap items-center gap-3 rounded-[14px] border border-line bg-surface-2 px-3.5 py-2.5">
        <Avatar src={d.head.photo} name={d.head.name} size={34} online={d.members[0]!.online} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium">{d.head.name}</div>
          <div className="text-[11.5px] text-fg-3">Head of desk</div>
        </div>
        <div className="flex items-center gap-1.5 text-[11.5px] text-fg-3">
          <Clock className="size-3.5" /> {d.hours} GMT+3
        </div>
        <div className="flex gap-1">
          {d.languages.map((l) => (
            <span key={l} className="rounded-md border border-line px-1.5 py-0.5 font-mono text-[10px] text-fg-2">
              {l}
            </span>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2 px-6 pt-3 sm:grid-cols-4">
        {d.kpis.map((k) => {
          const good = k.delta === undefined ? true : (k.delta >= 0) === (k.good !== "down");
          return (
            <div key={k.label} className="k-row min-w-0 px-3 py-2.5">
              <div className="truncate text-[10.5px] font-medium uppercase tracking-[0.05em] text-fg-3">{k.label}</div>
              <div className="k-num mt-1 truncate text-[16px] font-semibold">{k.value}</div>
              {k.delta !== undefined && (
                <div className={cn("k-num text-[11px]", good ? "text-up" : "text-down")}>
                  {k.delta >= 0 ? "▲" : "▼"} {Math.abs(k.delta).toFixed(1)}%
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* members */}
      <div className="px-6 pt-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="k-label">Members</span>
          {owns && (
            <span className="k-num text-[11.5px] text-fg-3">
              {d.clients.toLocaleString("en-US")} / {d.capacity.toLocaleString("en-US")} clients
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {d.members.map((m) => (
            <div key={m.person.id} className="flex items-center gap-2.5 rounded-[12px] px-2 py-1.5 hover:bg-surface-2">
              <Avatar src={m.person.photo} name={m.person.name} size={30} online={m.online} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-medium">{m.person.name}</div>
                <div className="truncate text-[11px] text-fg-3">{m.title}</div>
              </div>
              {owns ? (
                <Tooltip content={`${m.clients} clients assigned`}>
                  <span className="k-num rounded-full bg-surface-3 px-2 py-0.5 text-[11px] text-fg-2">{m.clients}</span>
                </Tooltip>
              ) : (
                <span className="text-[10.5px] text-fg-3">{m.shift}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* footer */}
      <div className="mt-auto px-6 pb-5 pt-4">
        <div className="flex items-end gap-4 border-t border-line pt-4">
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex justify-between text-[11.5px]">
              <span className="text-fg-3">{owns ? "Book capacity" : `SLA · ${d.sla.label}`}</span>
              <span className="k-num text-fg">{owns ? `${load.toFixed(0)}%` : `${d.sla.pct}%`}</span>
            </div>
            <Progress value={owns ? load : d.sla.pct} tone={owns ? (load > 85 ? "warn" : "ember") : d.sla.pct >= 95 ? "up" : "gold"} />
            {owns && (
              <div className="mt-1.5 text-[11px] text-fg-3">
                SLA {d.sla.label}: <span className="k-num text-fg-2">{d.sla.pct}%</span>
              </div>
            )}
          </div>
          <Sparkline data={d.trend} width={90} height={34} tone="gold" />
          {owns && (
            <Button size="sm" variant="surface" onClick={() => onReassign(d.key)}>
              <Shuffle /> Reassign
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

const RULES = [
  { id: "r1", when: "Language = Hindi / Urdu, or country IN · NP", then: "Sales HI", how: "Round-robin by capacity", on: true },
  { id: "r2", when: "Country GB · NG · ZA · KE · GH, language EN", then: "Sales EN", how: "Round-robin by capacity", on: true },
  { id: "r3", when: "LatAm (BR · MX · CO) sign-ups", then: "Sales EN · Lucas Ferreira", how: "Sticky to PT/ES speaker", on: true },
  { id: "r4", when: "Funded client dormant for 30+ days", then: "Retention", how: "Owner keeps book, retention co-assigned", on: true },
  { id: "r5", when: "Net deposits > $25,000", then: "Retention · VIP", how: "Assigned to head of desk", on: false },
  { id: "r6", when: "No rule matched", then: "Unassigned pool", how: "Picked manually within 15 min", on: true },
];

function RulesCard() {
  const [rules, setRules] = React.useState(RULES);
  return (
    <div className="k-card flex h-full flex-col">
      <div className="flex items-start justify-between gap-3 px-6 pt-5">
        <div>
          <h3 className="text-[17px] font-medium tracking-tight">Assignment rules</h3>
          <p className="mt-0.5 text-[12.5px] text-fg-3">Evaluated top to bottom when a lead registers</p>
        </div>
        <Button size="sm" variant="surface" onClick={() => toast.success("Rule added", { description: "New rule placed above the fallback" })}>
          <Plus /> Add rule
        </Button>
      </div>
      <div className="flex-1 space-y-1.5 px-6 pb-5 pt-4">
        {rules.map((r, i) => (
          <div key={r.id} className={cn("k-row flex items-center gap-3 px-3.5 py-2.5", !r.on && "opacity-55")}>
            <span className="k-num grid size-6 shrink-0 place-items-center rounded-full bg-surface-3 text-[11px] text-fg-2">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] text-fg-2">{r.when}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[12.5px]">
                <span className="text-ember">→</span>
                <span className="font-medium">{r.then}</span>
                <span className="truncate text-[11.5px] text-fg-3">· {r.how}</span>
              </div>
            </div>
            <Toggle
              checked={r.on}
              onChange={(v) => {
                setRules((rs) => rs.map((x) => (x.id === r.id ? { ...x, on: v } : x)));
                toast.success(`Rule ${i + 1} ${v ? "enabled" : "disabled"}`);
              }}
              label={`Rule ${i + 1}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DesksPage() {
  const [desks, setDesks] = React.useState<DskDesk[]>(DSK_DESKS);
  const [filter, setFilter] = React.useState<Filter>("all");
  const [open, setOpen] = React.useState(false);
  const [initial, setInitial] = React.useState<string | undefined>();

  const reassign = (k?: string) => {
    setInitial(k);
    setOpen(true);
  };
  const apply = (r: ReassignResult) =>
    setDesks((ds) =>
      ds.map((d) => {
        let members = d.members;
        if (d.key === r.fromDesk) members = members.map((m) => (m.person.id === r.fromId ? { ...m, clients: m.clients - r.count } : m));
        if (d.key === r.toDesk) members = members.map((m) => (m.person.id === r.toId ? { ...m, clients: m.clients + r.count } : m));
        const clients = members.reduce((s, m) => s + m.clients, 0);
        return { ...d, members, clients };
      }),
    );

  const staff = desks.reduce((s, d) => s + d.members.length, 0);
  const online = desks.reduce((s, d) => s + d.members.filter((m) => m.online).length, 0);
  const clients = desks.reduce((s, d) => s + d.clients, 0);
  const list = desks.filter((d) => filter === "all" || (filter === "client" ? d.capacity > 0 : d.capacity === 0));

  return (
    <div className="pb-16">
      <PageHeader
        title="Desks & teams"
        subtitle="Who covers which clients, languages and hours. Assignment rules route new leads to the right desk automatically."
        actions={
          <>
            <Button variant="surface" onClick={() => toast.success("Desk created", { description: "“Sales AR” added as a draft · assign a head to activate it" })}>
              <Plus /> New desk
            </Button>
            <Button variant="ember" shimmer onClick={() => reassign()}>
              <Shuffle /> Reassign clients
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Desks" icon={<UsersRound />} value={<span className="k-num">{desks.length}</span>} chip="3 client-facing · 4 operations" />
        <KpiCard label="Staff on desks" icon={<Users />} value={<span className="k-num">{staff}</span>} chip={`${online} online now`} chipTone="up" delay={0.05} />
        <KpiCard label="Clients assigned" icon={<Shuffle />} value={<span className="k-num">{clients.toLocaleString("en-US")}</span>} chip="312 in the unassigned pool" chipTone="warn" delay={0.1} />
        <KpiCard
          label="Lead routing"
          icon={<Wifi />}
          value={<span className="k-num">1m 42s</span>}
          hot
          illustration="handshake"
          footer={
            <Chip tone="up">median to first call · −12.4% MoM</Chip>
          }
          delay={0.15}
        />
      </div>

      <div className="mb-4 mt-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-medium tracking-tight">Desks</h2>
          <p className="text-[13px] text-fg-3">Server time GMT+3 · KPIs are month-to-date</p>
        </div>
        <Segmented
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: <>All <span className="text-fg-3">{desks.length}</span></> },
            { value: "client", label: "Client-facing" },
            { value: "ops", label: "Operations" },
          ]}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {list.map((d, i) => (
          <Reveal key={d.key} delay={0.04 * i} className="h-full">
            <DeskCard d={d} onReassign={reassign} />
          </Reveal>
        ))}
        {filter === "all" && (
          <Reveal delay={0.3} className="h-full">
            <RulesCard />
          </Reveal>
        )}
      </div>

      <ReassignDialog open={open} onOpenChange={setOpen} desks={desks} initialDesk={initial} onConfirm={apply} />
    </div>
  );
}
