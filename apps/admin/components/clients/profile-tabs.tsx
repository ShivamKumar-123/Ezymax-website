"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Check, CheckCircle2, FileText, Mail, MessageSquare, Phone, Send, Server, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Avatar,
  Button,
  Card,
  CardHeader,
  Chip,
  CopyButton,
  DataTable,
  EquityChart,
  Flag,
  Gauge,
  Icon3D,
  Money,
  Segmented,
  SymbolCell,
  cn,
  formatMoney,
  formatNumber,
  shortHash,
  type Column,
} from "@kalks/ui";
import { equitySeries, hashString } from "@kalks/mock";
import {
  REASON_CODES,
  clientAccounts,
  clientAudit,
  clientIbTree,
  clientLogins,
  clientNotes,
  clientTrades,
  clientTransactions,
  serverTime,
  timeAgo,
  type AdminClient,
  type ClientAccount,
  type ClientTrade,
  type ClientTx,
  type IbNode,
  type LoginEvent,
} from "@kalks/mock/admin-clients";
import { PnlText, ReasonDialog } from "@/components/command/kit";
import { fmtHold } from "@/components/command/overview";

/* ------------------------------------------------------------------ */
/* Accounts                                                            */
/* ------------------------------------------------------------------ */

function mlOf(a: ClientAccount) {
  return a.margin > 0 ? (a.equity / a.margin) * 100 : Infinity;
}

export function AccountsList({ c, compact }: { c: AdminClient; compact?: boolean }) {
  const accs = clientAccounts(c);
  return (
    <div className="space-y-2">
      {accs.map((a) => {
        const ml = mlOf(a);
        return (
          <div key={a.login} className="k-row flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <div className="flex min-w-[170px] items-center gap-3">
              <Chip size="sm" tone={a.type === "live" ? "ember" : "gold"}>
                {a.type.toUpperCase()}
              </Chip>
              <div>
                <div className="flex items-center gap-1 font-mono text-[13.5px] font-medium">
                  {a.login}
                  <CopyButton value={a.login} label="Login" />
                </div>
                <div className="text-[11.5px] text-fg-3">
                  {a.group} · {a.mode} · 1:{a.leverage}
                </div>
              </div>
            </div>
            <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Balance", formatMoney(a.currency === "USC" ? a.balance / 100 : a.balance)],
                ["Equity", formatMoney(a.currency === "USC" ? a.equity / 100 : a.equity)],
                ["Margin level", ml === Infinity ? "—" : `${formatNumber(ml, 0)}%`],
                ["Open", `${a.openPositions} pos`],
              ].map(([k, v]) => (
                <div key={k}>
                  <div className="text-[10.5px] uppercase tracking-wider text-fg-3">{k}</div>
                  <div className={cn("k-num font-mono text-[13px]", k === "Margin level" && ml < 150 ? "text-warn" : "text-fg")}>{v}</div>
                </div>
              ))}
            </div>
            {!compact && (
              <div className="flex items-center gap-2">
                <Chip size="sm" tone={a.route === "A" ? "info" : "neutral"}>
                  {a.route}-book
                </Chip>
                <span className="flex items-center gap-1 text-[11.5px] text-fg-3">
                  <Server className="size-3" /> {a.server}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Overview                                                            */
/* ------------------------------------------------------------------ */

function NotesTimeline({ c }: { c: AdminClient }) {
  const [notes, setNotes] = React.useState(clientNotes(c));
  const [text, setText] = React.useState("");
  const icon = { note: <FileText />, call: <Phone />, email: <Mail />, system: <Server /> };
  return (
    <Card>
      <CardHeader title="Notes & activity" subtitle="Visible to all staff with CRM access" icon={<MessageSquare />} />
      <div className="px-4 pt-4 sm:px-6">
        <div className="flex items-center gap-2 rounded-[14px] border border-line bg-surface-2 p-1.5 pl-3.5">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && text.trim()) {
                setNotes((n) => [{ id: `n${Date.now()}`, author: n[0]!.author, time: new Date().toISOString(), kind: "note", text }, ...n]);
                setText("");
                toast.success("Note added");
              }
            }}
            placeholder="Add a note… (Enter to save)"
            className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-fg-3"
          />
          <Button
            size="xs"
            variant="ember"
            disabled={!text.trim()}
            onClick={() => {
              setNotes((n) => [{ id: `n${Date.now()}`, author: n[0]!.author, time: new Date().toISOString(), kind: "note", text }, ...n]);
              setText("");
              toast.success("Note added");
            }}
          >
            <Send /> Save
          </Button>
        </div>
      </div>
      <ol className="relative mt-4 space-y-4 px-6 pb-6">
        <span className="absolute bottom-6 left-[39px] top-2 w-px bg-line" />
        {notes.map((n) => (
          <li key={n.id} className="relative flex gap-3">
            <span className="relative z-10 grid size-7 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-fg-2 [&_svg]:size-3.5">{icon[n.kind]}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[12px]">
                <Avatar src={n.author.photo} name={n.author.name} size={18} />
                <span className="font-medium">{n.author.name}</span>
                <span className="text-fg-3">· {timeAgo(n.time)}</span>
              </div>
              <p className="mt-1 text-[13px] leading-snug text-fg-2">{n.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

export function OverviewTab({ c }: { c: AdminClient }) {
  const data = React.useMemo(() => equitySeries(180, Math.max(c.equity, 800), hashString(c.id) % 1000), [c]);
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <div className="space-y-4 xl:col-span-8">
        <Card>
          <div className="flex flex-col gap-3 px-6 pt-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="k-label">Total equity · all live accounts</div>
              <Money value={c.equity} className="mt-2 block text-[30px] font-semibold tracking-tight" />
            </div>
            <div className="flex gap-6 text-right">
              {[
                ["Deposits", c.deposits],
                ["Withdrawals", c.withdrawals],
                ["Net", c.net],
              ].map(([k, v]) => (
                <div key={k as string}>
                  <div className="text-[11px] uppercase tracking-wider text-fg-3">{k}</div>
                  <div className="k-num font-mono text-[14px] font-medium">{formatMoney(v as number, "USD", 0)}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="px-3 pb-4 pt-2">
            <EquityChart data={data} height={230} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Trading accounts" subtitle={`${c.logins.length} live · 1 demo`} />
          <div className="mt-4 px-4 pb-5 sm:px-6">
            <AccountsList c={c} compact />
          </div>
        </Card>
      </div>
      <div className="space-y-4 xl:col-span-4">
        <Card className="overflow-hidden">
          <CardHeader title="Wallet" subtitle="USDT · TRC20" />
          <div className="px-6 pb-5 pt-3">
            <Money value={Math.round(c.net * 0.08 * 100) / 100} className="text-[26px] font-semibold" />
            <div className="mt-3 flex items-center gap-2 rounded-[12px] border border-line bg-surface-2 px-3 py-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/coins/usdt.svg" alt="" className="size-5" />
              <span className="flex-1 truncate font-mono text-[12px] text-fg-2">{shortHash(c.wallet, 10, 6)}</span>
              <CopyButton value={c.wallet} label="Address" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
              <div className="k-row px-3 py-2">
                <div className="text-fg-3">Withdrawable</div>
                <div className="k-num font-mono">{formatMoney(c.net * 0.07)}</div>
              </div>
              <div className="k-row px-3 py-2">
                <div className="text-fg-3">Pending</div>
                <div className="k-num font-mono">{formatMoney(0)}</div>
              </div>
            </div>
          </div>
        </Card>
        <NotesTimeline c={c} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tables                                                              */
/* ------------------------------------------------------------------ */

export function AccountsTab({ c }: { c: AdminClient }) {
  return (
    <Card className="px-4 py-5 sm:px-6">
      <AccountsList c={c} />
    </Card>
  );
}

export function TradesTab({ c }: { c: AdminClient }) {
  const rows = clientTrades(c);
  const cols: Column<ClientTrade>[] = [
    { key: "t", header: "Ticket", cell: (r) => <span className="font-mono text-[12px]">{r.ticket}</span> },
    { key: "l", header: "Login", cell: (r) => <span className="font-mono text-[12px] text-fg-2">{r.login}</span> },
    { key: "s", header: "Symbol", cell: (r) => <SymbolCell symbol={r.symbol} size={20} sub={serverTime(r.closeTime)} /> },
    { key: "side", header: "Side", cell: (r) => <Chip size="sm" tone={r.side === "buy" ? "up" : "down"}>{r.side.toUpperCase()}</Chip> },
    { key: "v", header: "Volume", align: "right", cell: (r) => <span className="k-num">{r.volume.toFixed(2)}</span>, sort: (r) => r.volume },
    { key: "o", header: "Open → close", align: "right", cell: (r) => <span className="k-num font-mono text-[12px] text-fg-2">{r.openPrice} → {r.closePrice}</span> },
    { key: "h", header: "Hold", align: "right", cell: (r) => <span className={cn("k-num font-mono text-[12px]", r.holdSec < 60 ? "text-warn" : "text-fg-2")}>{fmtHold(r.holdSec)}</span>, sort: (r) => r.holdSec },
    { key: "p", header: "Profit", align: "right", cell: (r) => <PnlText value={r.profit} />, sort: (r) => r.profit },
  ];
  const win = rows.filter((r) => r.profit > 0).length;
  return (
    <Card className="px-4 py-5 sm:px-6">
      <DataTable
        columns={cols}
        rows={rows}
        dense
        pageSize={12}
        exportName={`trades-${c.id}`}
        search={(r) => `${r.ticket} ${r.symbol} ${r.login}`}
        rowKey={(r) => r.ticket}
        toolbar={rows.length ? <span className="text-[12.5px] text-fg-3">{rows.length} closed trades · win rate <span className="text-fg">{Math.round((win / rows.length) * 100)}%</span> · net <PnlText value={rows.reduce((s, r) => s + r.profit, 0)} /></span> : undefined}
      />
    </Card>
  );
}

export function TransactionsTab({ c }: { c: AdminClient }) {
  const rows = clientTransactions(c);
  const cols: Column<ClientTx>[] = [
    { key: "id", header: "ID", cell: (r) => <span className="font-mono text-[12px]">{r.id}</span> },
    { key: "time", header: "Time", cell: (r) => <span className="font-mono text-[12px] text-fg-2">{serverTime(r.createdAt)}</span>, sort: (r) => r.createdAt },
    { key: "type", header: "Type", cell: (r) => <Chip size="sm" tone={r.type === "deposit" ? "up" : r.type === "withdrawal" ? "down" : r.type === "adjustment" ? "gold" : "neutral"} className="capitalize">{r.type.replace("-", " ")}</Chip> },
    { key: "m", header: "Method", cell: (r) => <span className="text-[12.5px] text-fg-2">{r.method}</span> },
    { key: "h", header: "Hash / reason", cell: (r) => (r.hash ? <span className="font-mono text-[11.5px] text-fg-3">{shortHash(r.hash, 8, 6)}</span> : r.reason ? <span className="text-[12px] text-gold">{r.reason} <span className="text-fg-3">· {r.by}</span></span> : <span className="text-fg-3">—</span>) },
    { key: "a", header: "Amount", align: "right", cell: (r) => <PnlText value={r.type === "withdrawal" ? -Math.abs(r.amount) : r.amount} className="font-mono text-[12.5px]" />, sort: (r) => r.amount },
    { key: "s", header: "Status", align: "right", cell: (r) => <Chip size="sm" dot tone={r.status === "completed" ? "up" : r.status === "rejected" ? "down" : "warn"} className="capitalize">{r.status}</Chip> },
  ];
  return (
    <Card className="px-4 py-5 sm:px-6">
      <DataTable columns={cols} rows={rows} dense pageSize={12} exportName={`transactions-${c.id}`} search={(r) => `${r.id} ${r.type} ${r.hash ?? ""}`} rowKey={(r) => r.id} />
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* KYC documents                                                       */
/* ------------------------------------------------------------------ */

export function IdCard({ label, back, name, country }: { label: string; back?: boolean; name: string; country: string }) {
  return (
    <div>
      <div className="relative aspect-[1.58] overflow-hidden rounded-[14px] border border-line bg-[radial-gradient(120%_90%_at_0%_0%,color-mix(in_oklab,var(--k-gold)_18%,transparent),transparent_60%),linear-gradient(135deg,var(--k-surface-3),var(--k-surface-2))]">
        <div className="absolute inset-0 opacity-[0.07] [background-image:repeating-linear-gradient(45deg,var(--k-fg)_0_1px,transparent_1px_7px)]" />
        {!back ? (
          <div className="relative flex h-full gap-3 p-3.5">
            <div className="flex flex-col justify-between">
              <Icon3D name="identification_card" size={52} />
              <Flag country={country} className="size-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-1.5 pt-1">
              <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-fg-3">Identity document</div>
              <div className="truncate text-[12px] font-semibold uppercase">{name}</div>
              <div className="h-1.5 w-3/4 rounded bg-fg-3/30" />
              <div className="h-1.5 w-1/2 rounded bg-fg-3/30" />
              <div className="h-1.5 w-2/3 rounded bg-fg-3/30" />
            </div>
          </div>
        ) : (
          <div className="relative flex h-full flex-col justify-end p-3.5">
            <div className="absolute right-3.5 top-3.5 opacity-80">
              <Icon3D name="identification_card" size={34} />
            </div>
            <div className="space-y-0.5 font-mono text-[9.5px] leading-tight tracking-[0.12em] text-fg-2">
              <div>{`ID<${country.toUpperCase()}${name.split(" ")[1]?.toUpperCase() ?? "X"}<<<<<<<<<<<<`}</div>
              <div>{`${String(hashString(name)).slice(0, 9)}<8${country.toUpperCase()}<<<<<<<<<<<6`}</div>
            </div>
          </div>
        )}
      </div>
      <div className="mt-1.5 text-center text-[11.5px] text-fg-3">{label}</div>
    </div>
  );
}

export function KycTab({ c }: { c: AdminClient }) {
  const score = c.kyc === "verified" ? 94 : c.kyc === "rejected" ? 38 : c.kyc === "none" ? 0 : 76;
  const [status, setStatus] = React.useState(c.kyc);
  const [rej, setRej] = React.useState(false);
  const checks = [
    ["Document authenticity", score >= 80, "MRZ valid · holograms detected"],
    ["Face match", score >= 70, `${Math.min(99, score + 3)}% similarity`],
    ["Liveness", true, "Passive liveness 0.98"],
    ["AML / PEP / sanctions", true, "No hits · re-screened nightly"],
    ["Proof of address", score >= 80, score >= 80 ? "Utility bill · 11 Sep 2026" : "Awaiting upload"],
  ] as const;
  if (c.kyc === "none")
    return (
      <Card className="flex flex-col items-center px-6 py-14 text-center">
        <Icon3D name="identification_card" size={72} />
        <div className="mt-4 text-[15px] font-medium">No documents submitted</div>
        <p className="mt-1 text-[13px] text-fg-3">The client hasn&apos;t started verification yet.</p>
        <Button className="mt-5" size="sm" variant="ember" onClick={() => toast.success("KYC reminder sent", { description: c.email })}>
          <Send /> Send KYC reminder
        </Button>
      </Card>
    );
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <Card className="xl:col-span-8">
        <CardHeader title="Documents" subtitle={`Level ${c.kycLevel} · submitted via Sumsub-style provider`} action={<Chip tone={status === "verified" ? "up" : status === "rejected" ? "down" : "warn"} dot className="capitalize">{status === "review" ? "In review" : status}</Chip>} />
        <div className="grid grid-cols-2 gap-4 px-6 pb-6 pt-5 md:grid-cols-4">
          <IdCard label="ID · front" name={c.name} country={c.country} />
          <IdCard label="ID · back" back name={c.name} country={c.country} />
          <div>
            <div className="relative aspect-[1.58] overflow-hidden rounded-[14px] border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.photo} alt="" className="size-full object-cover" />
              <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10.5px] font-medium text-white backdrop-blur"><Check className="mr-1 inline size-3" />Liveness passed</span>
            </div>
            <div className="mt-1.5 text-center text-[11.5px] text-fg-3">Selfie</div>
          </div>
          <div>
            <div className="grid aspect-[1.58] place-items-center rounded-[14px] border border-line bg-[linear-gradient(135deg,var(--k-surface-3),var(--k-surface-2))]">
              <Icon3D name="receipt" size={52} />
            </div>
            <div className="mt-1.5 text-center text-[11.5px] text-fg-3">Proof of address</div>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-line px-6 py-4">
          <Button size="sm" variant="surface" onClick={() => toast.success("Resubmission requested", { description: "Client notified by email + push" })}>
            Request resubmission
          </Button>
          <Button size="sm" variant="down-outline" onClick={() => setRej(true)}>
            <XCircle /> Reject
          </Button>
          <Button size="sm" variant="up-outline" onClick={() => { setStatus("verified"); toast.success(`${c.name} verified`, { description: "Level 2 · withdrawals unlocked" }); }}>
            <CheckCircle2 /> Approve
          </Button>
        </div>
      </Card>
      <Card className="xl:col-span-4">
        <CardHeader title="Provider checks" subtitle="Automated score · admin override allowed" icon={<ShieldCheck />} />
        <div className="flex justify-center pt-3">
          <Gauge value={score} max={100} size={170} label="Provider score" display={score} />
        </div>
        <div className="space-y-1.5 px-4 pb-5 sm:px-6">
          {checks.map(([k, ok, d]) => (
            <div key={k} className="flex items-center gap-2.5 rounded-[12px] px-2 py-1.5">
              {ok ? <Check className="size-4 text-up" /> : <AlertTriangle className="size-4 text-warn" />}
              <span className="flex-1 text-[13px]">{k}</span>
              <span className="text-right text-[11.5px] text-fg-3">{d}</span>
            </div>
          ))}
        </div>
      </Card>
      <ReasonDialog open={rej} onOpenChange={setRej} title={`Reject KYC for ${c.name}`} codes={REASON_CODES.reject} confirmLabel="Reject documents" confirmVariant="sell" successMessage="KYC rejected — client notified" onConfirm={() => setStatus("rejected")} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* IB tree                                                             */
/* ------------------------------------------------------------------ */

function TreeNode({ n, depth }: { n: IbNode; depth: number }) {
  return (
    <li className="relative">
      {depth > 0 && <span className="absolute -left-5 top-0 h-7 w-5 rounded-bl-[10px] border-b border-l border-line" />}
      <Link href={`/clients/${n.id}`} className={cn("k-row flex items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-surface-3/60", depth === 0 && "border-gold/30 bg-gold-soft")}>
        <Avatar src={n.photo} name={n.name} size={depth === 0 ? 36 : 28} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[13px] font-medium">
            {n.name} <Flag country={n.country} className="size-3.5" />
            <Chip size="sm" tone={depth === 0 ? "gold" : "neutral"}>
              {depth === 0 ? "IB · root" : `L${depth}`}
            </Chip>
          </div>
          <div className="font-mono text-[11px] text-fg-3">#{n.id}</div>
        </div>
        <div className="hidden gap-6 text-right sm:flex">
          {[
            ["Clients", String(n.clients)],
            ["Volume", `${formatNumber(n.volume, 1)} lots`],
            ["Commission", formatMoney(n.commission)],
          ].map(([k, v]) => (
            <div key={k}>
              <div className="text-[10px] uppercase tracking-wider text-fg-3">{k}</div>
              <div className="k-num font-mono text-[12.5px]">{v}</div>
            </div>
          ))}
        </div>
      </Link>
      {n.children && (
        <ul className="relative ml-8 mt-2 space-y-2 pl-5 before:absolute before:bottom-7 before:left-0 before:top-0 before:w-px before:bg-line">
          {n.children.map((k) => (
            <TreeNode key={k.id + depth} n={k} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function IbTab({ c }: { c: AdminClient }) {
  const tree = clientIbTree(c);
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <Card className="xl:col-span-8">
        <CardHeader title="Referral tree" subtitle="Multi-level IB structure · click a node to open the client" />
        <ul className="px-4 pb-6 pt-4 sm:px-6">
          <TreeNode n={tree} depth={0} />
        </ul>
      </Card>
      <Card className="xl:col-span-4">
        <CardHeader title="Referred by" />
        <div className="px-6 pb-6 pt-4">
          {c.ib ? (
            <div className="k-row flex items-center gap-3 px-4 py-3">
              <Icon3D name="handshake" size={36} />
              <div className="flex-1">
                <div className="text-[13.5px] font-medium">{c.ib.name}</div>
                <div className="font-mono text-[11.5px] text-gold">{c.ib.id} · Gold plan · $8/lot</div>
              </div>
            </div>
          ) : (
            <div className="text-[13px] text-fg-3">Direct client — no IB attribution.</div>
          )}
          <div className="mt-4 space-y-2 text-[12.5px]">
            {[
              ["Sub-IBs", "4"],
              ["Referred clients", "18"],
              ["Lifetime commission paid", formatMoney(14208.4)],
              ["Plan", "Multi-tier 3 levels · 60/25/15"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-line pb-2">
                <span className="text-fg-3">{k}</span>
                <span className="k-num font-medium">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Logins & devices                                                    */
/* ------------------------------------------------------------------ */

export function LoginsTab({ c }: { c: AdminClient }) {
  const rows = clientLogins(c);
  const flagged = rows.filter((r) => r.flagged);
  const cols: Column<LoginEvent>[] = [
    { key: "t", header: "Time", cell: (r) => <span className="font-mono text-[12px] text-fg-2">{serverTime(r.time)}</span> },
    { key: "ip", header: "IP", cell: (r) => <span className="flex items-center gap-1 font-mono text-[12px]">{r.ip}<CopyButton value={r.ip} label="IP" /></span> },
    { key: "loc", header: "Location", cell: (r) => <span className="flex items-center gap-2 text-[12.5px]"><Flag country={r.country} className="size-4" />{r.city}</span> },
    { key: "dev", header: "Device", cell: (r) => <span className="text-[12.5px]">{r.device} <span className="text-fg-3">· {r.os}</span></span> },
    { key: "fp", header: "Fingerprint", cell: (r) => <span className={cn("font-mono text-[11.5px]", r.flagged ? "text-warn" : "text-fg-3")}>fp:{r.fingerprint}</span> },
    { key: "res", header: "Result", cell: (r) => <Chip size="sm" tone={r.result === "failed" ? "down" : r.result === "2fa" ? "info" : "up"}>{r.result === "2fa" ? "2FA passed" : r.result}</Chip> },
    {
      key: "flag",
      header: "Flags",
      cell: (r) =>
        r.flagged ? (
          <Link href="/clients/duplicates" onClick={(e) => e.stopPropagation()}>
            <Chip size="sm" tone="warn">
              <AlertTriangle className="size-3" /> {r.flagged}
            </Chip>
          </Link>
        ) : (
          <span className="text-fg-3">—</span>
        ),
    },
  ];
  return (
    <div className="space-y-4">
      {flagged.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-[16px] border border-warn/30 bg-warn-soft px-5 py-3.5">
          <AlertTriangle className="size-4 text-warn" />
          <span className="flex-1 text-[13px]">
            <span className="font-medium">{flagged.length} flagged sessions</span> — shared device fingerprint with another client and a Tor/VPN exit node.
          </span>
          <Link href="/clients/duplicates">
            <Button size="xs" variant="surface">Open duplicate cluster</Button>
          </Link>
        </div>
      )}
      <Card className="px-4 py-5 sm:px-6">
        <DataTable columns={cols} rows={rows} dense pageSize={14} exportName={`logins-${c.id}`} search={(r) => `${r.ip} ${r.city} ${r.device} ${r.fingerprint}`} rowKey={(r) => r.id} />
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Audit                                                               */
/* ------------------------------------------------------------------ */

export function AuditTab({ c }: { c: AdminClient }) {
  const rows = clientAudit(c);
  const [scope, setScope] = React.useState<"all" | "changes">("all");
  const list = scope === "all" ? rows : rows.filter((r) => r.reason);
  return (
    <Card>
      <CardHeader title="Audit trail" subtitle="Immutable · every staff action on this client" action={<Segmented size="xs" value={scope} onChange={setScope} options={[{ value: "all", label: "All" }, { value: "changes", label: "With reason code" }]} />} />
      <ol className="relative mt-4 space-y-3 px-6 pb-6">
        <span className="absolute bottom-6 left-[37px] top-2 w-px bg-line" />
        {list.map((a) => (
          <li key={a.id} className="relative flex gap-3">
            {a.actorPhoto ? <Avatar src={a.actorPhoto} name={a.actor} size={26} className="relative z-10" /> : <span className="relative z-10 grid size-[26px] place-items-center rounded-full border border-line bg-surface-3 text-[10px] text-fg-3">SYS</span>}
            <div className="k-row min-w-0 flex-1 px-4 py-2.5">
              <div className="flex flex-wrap items-center gap-2 text-[13px]">
                <span className="font-medium">{a.actor}</span>
                <span className="text-fg-2">{a.action}</span>
                <span className="text-fg-3">· {a.detail}</span>
                <span className="ml-auto font-mono text-[11px] text-fg-3">
                  {serverTime(a.time)} · {a.ip}
                </span>
              </div>
              {a.reason && (
                <div className="mt-1.5">
                  <Chip size="sm" tone="gold">
                    {a.reason}
                  </Chip>
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

