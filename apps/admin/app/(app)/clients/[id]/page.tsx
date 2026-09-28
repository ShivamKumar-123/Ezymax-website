"use client";

import { IS_DEMO } from "@kalks/mock/mode";
import { LiveClientPage } from "@/components/live/client-page";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Ban, Calendar, Eye, Layers, Mail, MoreHorizontal, Phone, Scale, ShieldAlert, Clock } from "lucide-react";
import { toast } from "sonner";
import {
  Avatar,
  Button,
  Card,
  Chip,
  CopyButton,
  Dialog,
  DialogClose,
  Field,
  Flag,
  Input,
  Menu,
  Reveal,
  Segmented,
  Starfield,
  Tabs,
  cn,
  formatMoney,
} from "@kalks/ui";
import { CLIENT_GROUPS, REASON_CODES, getClient, serverTime, staff, timeAgo } from "@kalks/mock/admin-clients";
import { KycChip, ReasonDialog, RiskScore } from "@/components/command/kit";
import { AdjustmentDialog } from "@/components/command/adjustment-dialog";
import { AccountsTab, AuditTab, IbTab, KycTab, LoginsTab, OverviewTab, TradesTab, TransactionsTab } from "@/components/clients/profile-tabs";

type Tab = "overview" | "accounts" | "trades" | "transactions" | "kyc" | "ib" | "logins" | "audit";
type Act = "impersonate" | "adjust" | "group" | "block" | "email" | null;

function DemoClientProfilePage() {
  const params = useParams<{ id: string }>();
  const c = getClient(params.id);
  const agent = staff(c.agentId);
  const [tab, setTab] = React.useState<Tab>("overview");
  const [act, setAct] = React.useState<Act>(null);
  const [group, setGroup] = React.useState(c.group);
  const [nextGroup, setNextGroup] = React.useState<string>(c.group === "Pro" ? "VIP" : "Pro");
  const [blocked, setBlocked] = React.useState(c.tradingDisabled);
  const close = (o: boolean) => !o && setAct(null);

  return (
    <div className="pb-10">
      <Link href="/clients" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-fg-3 hover:text-fg">
        <ArrowLeft className="size-3.5" /> All users
      </Link>

      <Reveal>
        <Card hot className="overflow-hidden">
          <Starfield density={30} />
          <div className="relative flex flex-col gap-6 p-6 lg:flex-row lg:items-center">
            <div className="flex items-center gap-5">
              <div className="relative">
                <Avatar src={c.photo} name={c.name} size={88} className="[&_img]:ring-2 [&_img]:ring-white/15" />
                <span className="absolute -bottom-1 -right-1 grid size-8 place-items-center rounded-full bg-surface ring-2 ring-bg">
                  <Flag country={c.country} className="size-6" />
                </span>
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-[26px] font-medium tracking-[-0.02em]">{c.name}</h1>
                  <KycChip status={c.kyc} />
                  <Chip tone={c.status === "active" ? "up" : c.status === "blocked" ? "down" : "neutral"} dot className="capitalize">
                    {c.status}
                  </Chip>
                  {blocked && (
                    <Chip tone="down">
                      <Ban className="size-3" /> Trading disabled
                    </Chip>
                  )}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-fg-2">
                  <span className="flex items-center gap-1 font-mono">
                    #{c.id} <CopyButton value={c.id} label="Client ID" />
                  </span>
                  <span className="flex items-center gap-1">
                    <Mail className="size-3.5 text-fg-3" /> {c.email}
                  </span>
                  <span className="flex items-center gap-1">
                    <Phone className="size-3.5 text-fg-3" /> {c.phone}
                  </span>
                  <span>{c.countryName}</span>
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <Chip size="sm" tone="gold">
                    {group}
                  </Chip>
                  <Chip size="sm">L{c.kycLevel} KYC</Chip>
                  {c.tags.map((t) => (
                    <Chip key={t} size="sm" tone={t === "VIP" ? "gold" : t === "Scalper" ? "down" : "neutral"}>
                      {t}
                    </Chip>
                  ))}
                  <button onClick={() => toast("Tag editor", { description: "Use Users → bulk actions to tag many clients" })} className="h-5 rounded-full border border-dashed border-fg-3/50 px-2 text-[10.5px] text-fg-3 hover:text-fg">
                    + tag
                  </button>
                </div>
              </div>
            </div>

            <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4 lg:ml-auto lg:max-w-[560px]">
              <div className="rounded-[14px] border border-white/10 bg-black/20 px-3.5 py-2.5">
                <div className="text-[10.5px] uppercase tracking-wider text-fg-3">Risk score</div>
                <RiskScore score={c.risk} meter className="mt-1.5" />
              </div>
              <div className="rounded-[14px] border border-white/10 bg-black/20 px-3.5 py-2.5">
                <div className="text-[10.5px] uppercase tracking-wider text-fg-3">Agent</div>
                <div className="mt-1 flex items-center gap-2">
                  <Avatar src={agent.photo} name={agent.name} size={22} />
                  <span className="min-w-0 leading-tight">
                    <span className="block truncate text-[12.5px]">{agent.name}</span>
                    <span className="block truncate text-[10.5px] text-fg-3">{c.desk}</span>
                  </span>
                </div>
              </div>
              <div className="rounded-[14px] border border-white/10 bg-black/20 px-3.5 py-2.5">
                <div className="flex items-center gap-1 text-[10.5px] uppercase tracking-wider text-fg-3">
                  <Calendar className="size-3" /> Registered
                </div>
                <div className="k-num mt-1 font-mono text-[12.5px]">{serverTime(c.registered).slice(0, 6)} {new Date(c.registered).getUTCFullYear()}</div>
                <div className="text-[10.5px] text-fg-3">{c.source}</div>
              </div>
              <div className="rounded-[14px] border border-white/10 bg-black/20 px-3.5 py-2.5">
                <div className="flex items-center gap-1 text-[10.5px] uppercase tracking-wider text-fg-3">
                  <Clock className="size-3" /> Last login
                </div>
                <div className="mt-1 text-[12.5px]">{timeAgo(c.lastLogin)}</div>
                <div className="text-[10.5px] text-fg-3">{c.ib ? `IB ${c.ib.id}` : "Direct"}</div>
              </div>
            </div>
          </div>
          <div className="relative flex flex-wrap items-center gap-2 border-t border-white/10 bg-black/15 px-6 py-3.5">
            <Button size="sm" variant="surface" onClick={() => setAct("impersonate")}>
              <Eye /> Impersonate
            </Button>
            <Button size="sm" variant="ember" onClick={() => setAct("adjust")}>
              <Scale /> Adjust balance
            </Button>
            <Button size="sm" variant="surface" onClick={() => setAct("group")}>
              <Layers /> Change group
            </Button>
            <Button size="sm" variant={blocked ? "up-outline" : "down-outline"} onClick={() => setAct("block")}>
              <Ban /> {blocked ? "Unblock trading" : "Block trading"}
            </Button>
            <Button size="sm" variant="surface" onClick={() => setAct("email")}>
              <Mail /> Send email
            </Button>
            <Menu
              items={[
                { label: "Reset password", onSelect: () => toast.success("Password reset link sent", { description: c.email }) },
                { label: "Reset 2FA", onSelect: () => toast.success("2FA reset — client must re-enrol") },
                { label: "Open AML case", icon: <ShieldAlert />, href: "/clients/aml" },
                "sep",
                { label: "Close account", danger: true, onSelect: () => toast.error("Close account requires Compliance approval") },
              ]}
              trigger={
                <button className="grid size-8 place-items-center rounded-full border border-line text-fg-2 hover:bg-surface-3" aria-label="More actions">
                  <MoreHorizontal className="size-4" />
                </button>
              }
            />
            <span className="ml-auto hidden text-[12px] text-fg-3 md:block">
              Equity <span className="k-num font-mono text-fg">{formatMoney(c.equity)}</span> · Net deposits <span className="k-num font-mono text-fg">{formatMoney(c.net, "USD", 0)}</span> · Lifetime <span className="k-num font-mono text-fg">{c.lifetimeLots}</span> lots
            </span>
          </div>
        </Card>
      </Reveal>

      <Reveal delay={0.08} className="mt-5">
        <div className="overflow-x-auto [scrollbar-width:none]">
          <Tabs
            className="min-w-max"
            value={tab}
            onChange={setTab}
            tabs={[
              { value: "overview", label: "Overview" },
              { value: "accounts", label: "Accounts", count: c.logins.length + 1 },
              { value: "trades", label: "Trades" },
              { value: "transactions", label: "Transactions" },
              { value: "kyc", label: "KYC documents" },
              { value: "ib", label: "IB tree" },
              { value: "logins", label: "Logins & devices" },
              { value: "audit", label: "Audit" },
            ]}
          />
        </div>
      </Reveal>
      <div key={tab} className="mt-5">
        <Reveal>
          {tab === "overview" && <OverviewTab c={c} />}
          {tab === "accounts" && <AccountsTab c={c} />}
          {tab === "trades" && <TradesTab c={c} />}
          {tab === "transactions" && <TransactionsTab c={c} />}
          {tab === "kyc" && <KycTab c={c} />}
          {tab === "ib" && <IbTab c={c} />}
          {tab === "logins" && <LoginsTab c={c} />}
          {tab === "audit" && <AuditTab c={c} />}
        </Reveal>
      </div>

      <ReasonDialog
        open={act === "impersonate"}
        onOpenChange={close}
        title={`View as ${c.name}`}
        description="Opens the Client Area in read-only mode. Trading, transfers and settings are disabled."
        codes={REASON_CODES.impersonate}
        confirmLabel="Start read-only session"
        successMessage="Read-only session started (15 min max)"
      >
        <div className="flex items-start gap-3 rounded-[14px] border border-warn/30 bg-warn-soft px-4 py-3 text-[12.5px] text-fg-2">
          <Eye className="mt-0.5 size-4 shrink-0 text-warn" />
          <span>
            The whole session is recorded and the client sees it in their security log (“Support viewed your account”). Session auto-expires after 15 minutes.
          </span>
        </div>
      </ReasonDialog>
      <AdjustmentDialog open={act === "adjust"} onOpenChange={close} client={c} />
      <ReasonDialog
        open={act === "group"}
        onOpenChange={close}
        title="Change account group"
        description={`Current group: ${group}. New pricing applies to new orders; open positions keep their terms.`}
        codes={REASON_CODES.group}
        confirmLabel={`Move to ${nextGroup}`}
        successMessage={`${c.name} moved to ${nextGroup}`}
        onConfirm={() => setGroup(nextGroup)}
      >
        <Segmented size="sm" value={nextGroup} onChange={setNextGroup} options={CLIENT_GROUPS.filter((g) => g !== group)} />
      </ReasonDialog>
      <ReasonDialog
        open={act === "block"}
        onOpenChange={close}
        title={blocked ? "Re-enable trading" : "Block trading"}
        description={blocked ? "Client can open new positions again." : "Open positions stay open (close-only). New orders and deposits to trading accounts are rejected."}
        codes={REASON_CODES.block}
        confirmLabel={blocked ? "Unblock" : "Block trading"}
        confirmVariant={blocked ? "buy" : "sell"}
        successMessage={blocked ? "Trading re-enabled" : "Trading disabled (close-only)"}
        onConfirm={() => setBlocked((b) => !b)}
      />
      <Dialog
        open={act === "email"}
        onOpenChange={close}
        title={`Email ${c.name}`}
        description={c.email}
        width={600}
        footer={
          <>
            <DialogClose asChild>
              <Button size="sm" variant="ghost">Cancel</Button>
            </DialogClose>
            <DialogClose asChild>
              <Button size="sm" variant="ember" onClick={() => toast.success("Email sent", { description: `To ${c.email} · logged in CRM` })}>
                <Mail /> Send
              </Button>
            </DialogClose>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Subject">
            <Input defaultValue={`Your Kalks account — next steps`} />
          </Field>
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-medium text-fg-2">Message</span>
            <textarea rows={6} defaultValue={`Hi ${c.name.split(" ")[0]},\n\nThanks for trading with Kalks. I'm ${agent.name}, your account manager — reply here anytime.\n\nBest,\n${agent.name}`} className={cn("w-full resize-none rounded-[14px] border border-line bg-surface-2 px-3.5 py-2.5 text-[13px] outline-none focus:border-ember/50")} />
          </label>
        </div>
      </Dialog>
    </div>
  );
}

/** Live builds: real data from the gateway / market-data. Demo builds: the mock showcase above. */
export default function Page() {
  return IS_DEMO ? <DemoClientProfilePage /> : <LiveClientPage />;
}
