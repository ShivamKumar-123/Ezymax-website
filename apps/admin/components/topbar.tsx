"use client";

import * as React from "react";
import Link from "next/link";
import { Check, ChevronDown, LogOut, ShieldCheck, UserRound, KeyRound, Bell } from "lucide-react";
import { Avatar, Chip, CommandPalette, Menu, NotificationsPopover, ThemeToggle, cn } from "@kalks/ui";
import { ADMIN_COMMANDS } from "@/lib/nav";
import { signOut, useStaff } from "@/components/staff-session";

const TENANTS = [
  { id: "kalks", name: "Kalks Markets", plan: "Owner", color: "#ff5a1f" },
  { id: "aurum", name: "Aurum FX", plan: "Enterprise", color: "#e9b949" },
  { id: "nova", name: "NovaTrade Asia", plan: "Growth", color: "#38bdf8" },
  { id: "dunes", name: "Dunes Capital", plan: "Growth", color: "#22c55e" },
];

function TenantSwitcher() {
  const [t, setT] = React.useState(TENANTS[0]!);
  return (
    <Menu
      align="start"
      width={260}
      header={<div className="text-[11px] uppercase tracking-wider text-fg-3">Switch broker (platform owner)</div>}
      items={TENANTS.map((x) => ({
        label: (
          <span className="flex items-center justify-between gap-2">
            {x.name}
            <span className="text-[11px] text-fg-3">{x.plan}</span>
          </span>
        ),
        icon: <span className="grid size-5 place-items-center rounded-md text-[10px] font-bold text-black" style={{ background: x.color }}>{x.name[0]}</span>,
        onSelect: () => setT(x),
        hint: x.id === t.id ? <Check className="size-3.5 text-ember" /> : undefined,
      }))}
      trigger={
        <button className="hidden h-10 items-center gap-2 whitespace-nowrap rounded-full border border-line bg-surface/70 pl-1.5 pr-3 text-[13px] font-medium shadow-[inset_0_1px_0_var(--k-border-top)] hover:bg-surface-3 min-[1760px]:flex">
          <span className="grid size-7 place-items-center rounded-full text-[11px] font-bold text-black" style={{ background: t.color }}>
            {t.name[0]}
          </span>
          {t.name}
          <ChevronDown className="size-3.5 text-fg-3" />
        </button>
      }
    />
  );
}

function ServerClock() {
  const [now, setNow] = React.useState<string>("--:--:--");
  React.useEffect(() => {
    const f = () => {
      const d = new Date();
      setNow(`${String((d.getUTCHours() + 3) % 24).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}:${String(d.getUTCSeconds()).padStart(2, "0")}`);
    };
    f();
    const t = setInterval(f, 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="hidden h-10 items-center whitespace-nowrap rounded-full border border-line bg-surface/70 px-3.5 font-mono text-[12.5px] text-fg-2 shadow-[inset_0_1px_0_var(--k-border-top)] min-[1900px]:flex">
      <span className="mr-1.5 text-fg-3">GMT+3</span>
      {now}
    </span>
  );
}

function FeedPill() {
  const [ms, setMs] = React.useState(38);
  React.useEffect(() => {
    const t = setInterval(() => setMs(32 + Math.round(Math.random() * 14)), 2000);
    return () => clearInterval(t);
  }, []);
  return (
    <Link href="/command/system" className="hidden h-10 items-center gap-2 whitespace-nowrap rounded-full border border-line bg-surface/70 px-3.5 text-[12.5px] text-fg-2 shadow-[inset_0_1px_0_var(--k-border-top)] hover:text-fg 2xl:flex">
      <span className="relative size-2 rounded-full bg-up text-up">
        <span className="absolute inset-0 animate-pulse-dot rounded-full" />
      </span>
      Infoways · live · <span className="k-num font-mono text-fg">{ms}ms</span>
    </Link>
  );
}

function QueueChips() {
  const q = [
    { label: "KYC", n: 12, href: "/clients/kyc" },
    { label: "WDL", n: 7, href: "/finance/withdrawals" },
    { label: "PAY", n: 3, href: "/finance/payouts" },
  ];
  return (
    <div className="hidden items-center gap-1.5 min-[1400px]:flex">
      {q.map((x) => (
        <Link key={x.label} href={x.href} className={cn("flex h-10 items-center gap-1.5 rounded-full border border-ember/25 bg-ember-soft px-3 text-[12px] font-semibold text-ember hover:border-ember/50")}>
          {x.label}
          <span className="k-num rounded-full bg-ember px-1.5 text-[10.5px] text-white">{x.n}</span>
        </Link>
      ))}
    </div>
  );
}

export function AdminTopRight() {
  const staff = useStaff();
  return (
    <>
      <TenantSwitcher />
      <FeedPill />
      <ServerClock />
      <QueueChips />
      <CommandPalette placeholder="Search user, account #, tx hash, page…" items={ADMIN_COMMANDS.map((c) => ({ group: c.group, label: c.label, href: c.href, icon: <c.Icon /> }))} />
      <ThemeToggle />
      <NotificationsPopover
        items={[
          { id: "a1", title: "USOIL feed stale for 4.2s — trading auto-paused", time: "1m", unread: true, icon: <Bell /> },
          { id: "a2", title: "Large withdrawal 48,000 USDT flagged for review", time: "6m", unread: true, icon: <Bell /> },
          { id: "a3", title: "XAUUSD net exposure at 86% of limit", time: "9m", unread: true, icon: <Bell /> },
        ]}
      />
      <Menu
        width={250}
        header={
          <div className="flex items-center gap-3">
            <Avatar name={staff.name} size={40} />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{staff.name}</div>
              <div className="truncate text-xs text-fg-3">{staff.role_label}</div>
              <Chip size="sm" tone="up" className="mt-1.5" dot>
                {staff.tenant.name}
              </Chip>
            </div>
          </div>
        }
        items={[
          { label: "My profile", icon: <UserRound />, href: "/org" },
          { label: "Change password", icon: <KeyRound /> },
          { label: "My audit trail", icon: <ShieldCheck />, href: "/security" },
          "sep",
          { label: "Sign out", icon: <LogOut />, danger: true, onSelect: () => void signOut() },
        ]}
        trigger={
          <button aria-label="Staff menu" className="rounded-full">
            <Avatar name={staff.name} size={40} online />
          </button>
        }
      />
    </>
  );
}
