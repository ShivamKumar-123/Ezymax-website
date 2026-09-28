"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Ban, KeyRound, LifeBuoy, Siren, UserRound, Wallet, ArrowDownToLine, Ticket, Smartphone, Languages } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Chip, CopyButton, Flag, Money, StatusChip, Tooltip, cn } from "@kalks/ui";
import { REASON_CODES } from "@kalks/mock/admin-clients";
import type { SupConversation } from "@kalks/mock/admin-growth-support";
import { KycChip, ReasonDialog } from "@/components/command/kit";
import { AiSpark } from "./shared";

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="border-t border-line px-4 py-4">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="k-label !text-fg-3">{title}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

export function ContextPanel({ conv, className }: { conv: SupConversation; className?: string }) {
  const c = conv.context;
  const [block, setBlock] = React.useState(false);
  const [escalate, setEscalate] = React.useState(false);
  const actions = [
    { label: "Reset password", icon: KeyRound, onClick: () => toast.success("Password reset link sent", { description: `${conv.client.email} · expires in 30 min` }) },
    { label: "Open profile", icon: UserRound, href: "/clients" },
    { label: "Create ticket", icon: Ticket, onClick: () => toast.success("Ticket TK-7734 created", { description: conv.subject }) },
    { label: "Escalate", icon: Siren, onClick: () => setEscalate(true) },
    { label: "Block", icon: Ban, danger: true, onClick: () => setBlock(true) },
  ];
  return (
    <div className={cn("h-full min-h-0 overflow-y-auto", className)}>
    <div className="flex min-h-full flex-col">
      <div className="relative overflow-hidden px-4 pb-4 pt-5 text-center">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(255,90,31,0.18),transparent)]" />
        <Avatar src={conv.client.photo} name={conv.client.name} size={64} verified={c.kyc === "verified"} className="relative mx-auto" />
        <div className="relative mt-2.5 flex items-center justify-center gap-1.5 text-[15px] font-medium">
          {conv.client.name}
          <Flag country={conv.client.country} className="size-4" />
        </div>
        <div className="relative mt-0.5 flex items-center justify-center gap-1 text-[12px] text-fg-3">
          {conv.client.email}
          <CopyButton value={conv.client.email} label="Email" className="size-5" />
        </div>
        <div className="relative mt-2.5 flex flex-wrap items-center justify-center gap-1.5">
          <KycChip status={c.kyc} size="sm" />
          <Chip size="sm" tone={c.segment.includes("VIP") || c.segment.includes("IB") ? "gold" : "neutral"}>
            {c.segment}
          </Chip>
          <Chip size="sm" tone={c.sentiment === "frustrated" ? "down" : c.sentiment === "positive" ? "up" : "neutral"}>
            {c.sentiment === "frustrated" ? "Frustrated" : c.sentiment === "positive" ? "Happy" : "Neutral"}
          </Chip>
        </div>
        <div className="relative mt-4 grid grid-cols-5 gap-1.5">
          {actions.map((a) => {
            const inner = (
              <span className={cn("flex flex-col items-center gap-1 rounded-xl border border-line bg-surface-2 px-1 py-2 text-[10px] leading-tight transition-colors hover:bg-surface-3", a.danger ? "text-down hover:border-down/40" : "text-fg-2 hover:text-fg")}>
                <a.icon className="size-4" />
                {a.label}
              </span>
            );
            return a.href ? (
              <Link key={a.label} href={a.href}>
                {inner}
              </Link>
            ) : (
              <button key={a.label} onClick={a.onClick}>
                {inner}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 pb-4">
        <div className="relative overflow-hidden rounded-[16px] border border-gold/25 bg-[linear-gradient(160deg,rgba(255,90,31,0.12),rgba(233,185,73,0.05)_60%,transparent)] p-3.5">
          <div className="flex items-center gap-2 text-[12px] font-medium">
            <AiSpark size={18} />
            <span className="text-gold">AI summary</span>
            <span className="ml-auto text-[10.5px] text-fg-3">updated just now</span>
          </div>
          <p className="mt-2 text-[12.5px] leading-relaxed text-fg-2">{c.aiSummary}</p>
          {c.tags.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1">
              {c.tags.map((t) => (
                <span key={t} className="rounded-md bg-surface-3/80 px-1.5 py-0.5 font-mono text-[10px] text-fg-2">
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <Section title="Profile">
        <div className="space-y-1.5 text-[12.5px]">
          {[
            ["Tenant", c.tenant],
            ["Client since", c.since],
            ["Country", conv.client.countryName],
            ["Language", c.language],
            ["Device", c.device],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-3">
              <span className="text-fg-3">{k}</span>
              <span className="truncate text-right text-fg-2">{v}</span>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3">
            <span className="text-fg-3">Lifetime deposits</span>
            <Money value={c.ltv} countUp={false} className="text-fg" />
          </div>
        </div>
      </Section>

      <Section title={`Trading accounts · ${c.accounts.length}`} action={<Link href="/trading/accounts" className="text-[11px] text-fg-3 hover:text-ember">All →</Link>}>
        <div className="space-y-1.5">
          {c.accounts.map((a) => (
            <div key={a.login} className="k-row flex items-center gap-2.5 px-3 py-2">
              <Chip size="sm" tone={a.type === "live" ? "ember" : "gold"}>
                {a.type.toUpperCase()}
              </Chip>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 font-mono text-[12.5px]">
                  {a.login}
                  <CopyButton value={a.login} label="Login" className="size-5" />
                </div>
                <div className="truncate text-[11px] text-fg-3">{a.group}</div>
              </div>
              <Money value={a.equity} currency={a.currency === "USC" ? "¢" : "$"} countUp={false} className="text-[12.5px] font-medium" />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Wallet & funding">
        <div className="grid grid-cols-2 gap-1.5">
          <div className="k-row px-3 py-2">
            <div className="flex items-center gap-1 text-[10.5px] uppercase tracking-wider text-fg-3">
              <Wallet className="size-3" /> Wallet
            </div>
            <Money value={c.wallet} countUp={false} className="mt-0.5 block text-[13.5px] font-medium" />
            <div className="text-[10.5px] text-fg-3">USDT · TRC20</div>
          </div>
          <div className="k-row px-3 py-2">
            <div className="flex items-center gap-1 text-[10.5px] uppercase tracking-wider text-fg-3">
              <ArrowDownToLine className="size-3" /> Last deposit
            </div>
            {c.lastDeposit.amount > 0 ? <Money value={c.lastDeposit.amount} countUp={false} className="mt-0.5 block text-[13.5px] font-medium text-up" /> : <div className="mt-0.5 text-[13.5px] text-fg-3">—</div>}
            <div className="truncate text-[10.5px] text-fg-3">{c.lastDeposit.at}</div>
          </div>
        </div>
        {c.lastWithdrawal && (
          <div className="mt-1.5 flex items-center gap-2.5 rounded-[14px] border border-warn/25 bg-warn-soft px-3 py-2">
            <div className="min-w-0 flex-1">
              <div className="font-mono text-[11.5px] text-fg">{c.lastWithdrawal.id}</div>
              <div className="text-[10.5px] text-fg-3">{c.lastWithdrawal.at}</div>
            </div>
            <Money value={-c.lastWithdrawal.amount} countUp={false} className="text-[12.5px] font-medium" />
            <Chip size="sm" tone="warn">
              {c.lastWithdrawal.status}
            </Chip>
          </div>
        )}
      </Section>

      <Section title={`Open tickets · ${c.openTickets.length}`}>
        {c.openTickets.length ? (
          <div className="space-y-1.5">
            {c.openTickets.map((t) => (
              <button key={t.id} onClick={() => toast.info(`Opening ${t.id}`)} className="k-row flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-3">
                <LifeBuoy className="size-3.5 shrink-0 text-fg-3" />
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-[11px] text-fg-3">{t.id}</span>
                  <span className="block truncate text-[12.5px]">{t.title}</span>
                </span>
                <StatusChip status={t.status} />
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-[14px] border border-dashed border-line px-3 py-3 text-center text-[12px] text-fg-3">No open tickets</div>
        )}
      </Section>

      <Section title="Previous conversations">
        <div className="space-y-1 text-[12px]">
          {[
            ["CV-19842", "Deposit not credited", "12 Sep", "Claude"],
            ["CV-18310", "Change leverage", "28 Aug", "Mei Lin"],
          ].map(([id, t, d, by]) => (
            <button key={id} onClick={() => toast.info(`Opening ${id}`)} className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left hover:bg-surface-2">
              <span className="font-mono text-[10.5px] text-fg-3">{id}</span>
              <span className="min-w-0 flex-1 truncate text-fg-2">{t}</span>
              <span className="text-[10.5px] text-fg-3">
                {d} · {by}
              </span>
            </button>
          ))}
        </div>
      </Section>

      <div className="mt-auto flex items-center gap-2 border-t border-line px-4 py-3 text-[11px] text-fg-3">
        <Smartphone className="size-3.5" /> Last seen 1 min ago
        <Languages className="ml-auto size-3.5" />
        Auto-translate on
        <Tooltip content="Open full client profile">
          <Link href="/clients" className="text-fg-3 hover:text-ember">
            <ArrowUpRight className="size-3.5" />
          </Link>
        </Tooltip>
      </div>

      <ReasonDialog
        open={block}
        onOpenChange={setBlock}
        title={`Block ${conv.client.name}`}
        description="Blocks login, trading and withdrawals across all accounts until lifted."
        codes={REASON_CODES.block}
        confirmLabel="Block client"
        confirmVariant="sell"
        successMessage={`${conv.client.name} blocked`}
      />
      <ReasonDialog
        open={escalate}
        onOpenChange={setEscalate}
        title="Escalate conversation"
        description={`${conv.id} will be routed to the Tier-3 queue with priority “urgent”.`}
        codes={["ESC-01 · Finance dispute", "ESC-02 · Trade dispute", "ESC-03 · Compliance / AML", "ESC-04 · Complaint / regulator", "ESC-05 · VIP request"]}
        confirmLabel="Escalate"
        successMessage="Escalated to Tier-3"
      />
    </div>
    </div>
  );
}
