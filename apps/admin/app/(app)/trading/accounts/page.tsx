"use client";

import * as React from "react";
import { ArrowLeftRight, Ban, CandlestickChart, CirclePause, Gauge as GaugeIcon, KeyRound, Layers, List, MoreHorizontal, ShieldAlert, SlidersHorizontal, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Chip, Card, DataTable, KpiCard, Menu, PageHeader, Reveal, Segmented, cn, formatMoney, formatNumber, type Column } from "@kalks/ui";
import { ADMIN_ACCOUNTS, TRADING_GROUPS, type AdminAccountRow } from "@kalks/mock/admin-trading";
import { CLIENT_GROUPS, REASON_CODES, getClient } from "@kalks/mock/admin-clients";
import { ReasonDialog } from "@/components/command/kit";
import { MiniClient } from "@/components/trading/shared";
import { resolveRoute, useDesk, type Book } from "@/lib/trading-desk";
import { BookChip, DeskDialog } from "@/components/trading-desk/kit";
import { CreateTradeDrawer } from "@/components/trading-desk/create-trade";

const usd = (a: AdminAccountRow, v: number) => (a.currency === "USC" ? v / 100 : v);
const ml = (a: AdminAccountRow) => (a.margin > 0 ? (a.equity / a.margin) * 100 : Infinity);

function MlCell({ a }: { a: AdminAccountRow }) {
  const v = ml(a);
  if (v === Infinity) return <span className="text-fg-3">—</span>;
  const tone = v < 50 ? "down" : v < 100 ? "warn" : v < 300 ? "gold" : "up";
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-surface-3">
        <span className={cn("block h-full rounded-full", { down: "bg-down", warn: "bg-warn", gold: "bg-gold", up: "bg-up" }[tone])} style={{ width: `${Math.min(100, v / 10)}%` }} />
      </span>
      <span className={cn("k-num w-16 text-right font-mono text-[12px]", { down: "text-down", warn: "text-warn", gold: "text-gold", up: "text-fg-2" }[tone])}>{formatNumber(v, 0)}%</span>
    </span>
  );
}

type Act = { k: "leverage" | "group" | "disable" | "closeOnly" | "password"; a: AdminAccountRow } | { k: "route"; a: AdminAccountRow; book: Book | null } | { k: "trade"; a: AdminAccountRow } | null;

export default function AccountsPage() {
  const { state, api } = useDesk();
  const [base, setAccounts] = React.useState(ADMIN_ACCOUNTS);
  // dealer controls (desk store) override the account status; routing shows where new trades go
  const accounts = React.useMemo(
    () =>
      base.map((a) => {
        const c = state.accountControls.find((x) => x.login === a.login);
        const status: AdminAccountRow["status"] = c?.tradingDisabled ? "disabled" : c?.closeOnly ? "read-only" : a.status === "disabled" && c ? "active" : a.status;
        return { ...a, status, route: resolveRoute(state.routingRules, { login: a.login, group: a.group, symbol: "EURUSD", volume: 1, clientId: a.clientId }).book };
      }),
    [base, state.accountControls, state.routingRules],
  );
  const ctlOf = (login: string) => state.accountControls.find((x) => x.login === login);
  const quickOf = (login: string) => state.routingRules.find((r) => r.id === `RQ-L${login}`)?.action.book ?? null;
  const [group, setGroup] = React.useState<string>("all");
  const [route, setRoute] = React.useState<"all" | "A" | "B">("all");
  const [status, setStatus] = React.useState<"all" | "active" | "disabled" | "risk">("all");
  const [act, setAct] = React.useState<Act>(null);
  const [lev, setLev] = React.useState("200");
  const [grp, setGrp] = React.useState<string>("Pro");
  const rows = accounts.filter((a) => (group === "all" || a.group === group) && (route === "all" || a.route === route) && (status === "all" || (status === "risk" ? ml(a) < 150 : status === "active" ? a.status === "active" : a.status !== "active")));

  const cols: Column<AdminAccountRow>[] = [
    { key: "l", header: "Login", cell: (r) => <span className="font-mono text-[12.5px] font-medium">{r.login}</span>, sort: (r) => r.login },
    { key: "c", header: "Client", cell: (r) => <MiniClient clientId={r.clientId} login={`#${r.clientId}`} /> },
    { key: "g", header: "Group", cell: (r) => <Chip size="sm" tone={r.group === "VIP" ? "gold" : "neutral"}>{r.group}</Chip> },
    { key: "lev", header: "Leverage", align: "right", cell: (r) => <span className="k-num font-mono text-[12px]">1:{r.leverage}</span>, sort: (r) => r.leverage },
    { key: "b", header: "Balance", align: "right", cell: (r) => <span className="k-num font-mono text-[12.5px]">{formatMoney(usd(r, r.balance))}</span>, sort: (r) => usd(r, r.balance) },
    { key: "e", header: "Equity", align: "right", cell: (r) => <span className="k-num font-mono text-[12.5px]">{formatMoney(usd(r, r.equity))}</span>, sort: (r) => usd(r, r.equity) },
    { key: "cr", header: "Credit", align: "right", hideOn: "lg", cell: (r) => <span className="k-num font-mono text-[12px] text-fg-3">{r.credit ? formatMoney(r.credit) : "—"}</span> },
    { key: "ml", header: "Margin level", align: "right", cell: (r) => <MlCell a={r} />, sort: (r) => (ml(r) === Infinity ? 1e9 : ml(r)) },
    { key: "r", header: "New trades", align: "center", cell: (r) => <span className="inline-flex items-center gap-1"><BookChip book={r.route} />{quickOf(r.login) && <span className="text-[10px] text-fg-3">pinned</span>}</span>, sort: (r) => r.route },
    { key: "sv", header: "Server", hideOn: "lg", cell: (r) => <span className="text-[12px] text-fg-3">{r.server}</span> },
    { key: "p", header: "Open", align: "right", cell: (r) => <span className="k-num text-[12px]">{r.openPositions}</span> },
    { key: "st", header: "Status", cell: (r) => <Chip size="sm" dot tone={r.status === "active" ? "up" : r.status === "disabled" ? "down" : "warn"} className="capitalize">{r.status}</Chip> },
    {
      key: "a",
      header: "",
      align: "right",
      cell: (r) => (
        <span onClick={(e) => e.stopPropagation()}>
          <Menu
            width={210}
            items={[
              { label: "Change leverage", icon: <SlidersHorizontal />, onSelect: () => setAct({ k: "leverage", a: r }) },
              { label: "Change group", icon: <Layers />, onSelect: () => setAct({ k: "group", a: r }) },
              { label: "Reset password", icon: <KeyRound />, onSelect: () => setAct({ k: "password", a: r }) },
              "sep",
              { label: "Create trade", icon: <CandlestickChart />, onSelect: () => setAct({ k: "trade", a: r }) },
              { label: "Open positions", icon: <List />, href: `/trading?login=${r.login}` },
              { label: quickOf(r.login) === "A" ? "Remove A-book route" : "Route new trades to A", icon: <ArrowLeftRight />, onSelect: () => setAct({ k: "route", a: r, book: quickOf(r.login) === "A" ? null : "A" }) },
              { label: quickOf(r.login) === "B" ? "Remove B-book route" : "Route new trades to B", icon: <ArrowLeftRight />, onSelect: () => setAct({ k: "route", a: r, book: quickOf(r.login) === "B" ? null : "B" }) },
              "sep",
              { label: ctlOf(r.login)?.closeOnly ? "Lift close-only" : "Set close-only", icon: <CirclePause />, onSelect: () => setAct({ k: "closeOnly", a: r }) },
              { label: r.status === "disabled" ? "Enable trading" : "Disable trading", icon: <Ban />, danger: r.status !== "disabled", onSelect: () => setAct({ k: "disable", a: r }) },
            ]}
            trigger={
              <button className="grid size-7 place-items-center rounded-full text-fg-3 hover:bg-surface-3 hover:text-fg" aria-label="Account actions">
                <MoreHorizontal className="size-4" />
              </button>
            }
          />
        </span>
      ),
    },
  ];

  const a = act?.a;
  const total = rows.reduce((s, r) => s + usd(r, r.equity), 0);
  const risky = accounts.filter((x) => ml(x) < 150).length;
  const upd = (p: Partial<AdminAccountRow>) => a && setAccounts((xs) => xs.map((x) => (x.login === a.login ? { ...x, ...p } : x)));

  return (
    <div className="pb-10">
      <PageHeader title="Trading accounts" subtitle="Every live account across Kalks-Live01 and Kalks-Live02 — group, leverage, margin and routing." />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard label="Live accounts" icon={<Wallet />} value={<span className="k-num">{rows.length}</span>} chip={`${accounts.length} total`} />
        <KpiCard label="Equity (filtered)" icon={<GaugeIcon />} value={<span className="k-num">{formatMoney(total, "USD", 0)}</span>} chip="USD equivalent" delay={0.04} />
        <KpiCard label="ML below 150%" icon={<ShieldAlert />} value={<span className="k-num text-warn">{risky}</span>} chip="Watch list" chipTone="warn" delay={0.08} />
        <KpiCard label="A-book accounts" icon={<Layers />} value={<span className="k-num">{accounts.filter((x) => x.route === "A").length}</span>} chip="by routing rules" chipTone="info" delay={0.12} />
      </div>
      <Reveal delay={0.1} className="mt-4">
        <Card className="px-4 py-5 sm:px-6">
          <DataTable
            columns={cols}
            rows={rows}
            dense
            pageSize={14}
            rowKey={(r) => r.login}
            exportName="trading-accounts"
            search={(r) => `${r.login} ${r.clientId} ${getClient(r.clientId).name}`}
            searchPlaceholder="Login, client…"
            toolbar={
              <div className="flex flex-wrap gap-2">
                <Segmented size="sm" value={group} onChange={setGroup} options={[{ value: "all", label: "All groups" }, ...TRADING_GROUPS.slice(0, 5).map((g) => ({ value: g, label: g }))]} />
                <Segmented size="sm" value={route} onChange={setRoute} options={[{ value: "all", label: "A + B" }, { value: "A", label: "A" }, { value: "B", label: "B" }]} />
                <Segmented size="sm" value={status} onChange={setStatus} options={[{ value: "all", label: "Any status" }, { value: "active", label: "Active" }, { value: "disabled", label: "Disabled" }, { value: "risk", label: "ML < 150%" }]} />
              </div>
            }
          />
        </Card>
      </Reveal>
      {a && (
        <>
          <ReasonDialog open={act?.k === "leverage"} onOpenChange={(o) => !o && setAct(null)} title={`Change leverage · ${a.login}`} description={`Current 1:${a.leverage}. Margin on open positions is recalculated immediately.`} codes={["LEV-01 · Client request", "LEV-02 · Regulatory cap", "LEV-03 · Risk reduction", "LEV-04 · News / weekend policy"]} confirmLabel={`Set 1:${lev}`} successMessage={`Leverage set to 1:${lev}`} onConfirm={() => upd({ leverage: Number(lev) })}>
            <Segmented size="sm" value={lev} onChange={setLev} options={["50", "100", "200", "500", "1000"] as const} />
          </ReasonDialog>
          <ReasonDialog open={act?.k === "group"} onOpenChange={(o) => !o && setAct(null)} title={`Change group · ${a.login}`} description={`Current: ${a.group}`} codes={REASON_CODES.group} confirmLabel={`Move to ${grp}`} successMessage={`${a.login} moved to ${grp}`} onConfirm={() => upd({ group: grp })}>
            <Segmented size="sm" value={grp} onChange={setGrp} options={CLIENT_GROUPS} />
          </ReasonDialog>
          <DeskDialog open={act?.k === "disable"} onOpenChange={(o) => !o && setAct(null)} title={`${a.status !== "disabled" ? "Disable" : "Enable"} trading · ${a.login}`} description={a.status !== "disabled" ? "New trades and pending orders are rejected; the dealer can still close positions." : "Account can open new positions again."} confirmLabel={a.status !== "disabled" ? "Disable trading" : "Enable trading"} confirmVariant={a.status !== "disabled" ? "sell" : "buy"} onConfirm={(r) => api.setAccountControl(a.login, { tradingDisabled: a.status !== "disabled" }, r)} success={a.status !== "disabled" ? "Trading disabled" : "Trading enabled"} />
          <DeskDialog open={act?.k === "closeOnly"} onOpenChange={(o) => !o && setAct(null)} title={`${ctlOf(a.login)?.closeOnly ? "Lift close-only" : "Set close-only"} · ${a.login}`} description="Close-only accounts can reduce risk but cannot open new positions." confirmLabel={ctlOf(a.login)?.closeOnly ? "Lift close-only" : "Set close-only"} onConfirm={(r) => api.setAccountControl(a.login, { closeOnly: !ctlOf(a.login)?.closeOnly }, r)} success="Account control applied" />
          <DeskDialog open={act?.k === "route"} onOpenChange={(o) => !o && setAct(null)} title={act?.k === "route" ? (act.book ? `Route new trades of ${a.login} to ${act.book}-book` : `Remove account route · ${a.login}`) : ""} description="Applies to new trades only. Move open positions from the Positions page (full or partial)." confirmLabel="Apply route" onConfirm={(r) => api.quickRoute({ login: a.login }, act?.k === "route" ? act.book : null, r)} success="Routing updated" />
          <CreateTradeDrawer open={act?.k === "trade"} onOpenChange={(o) => !o && setAct(null)} initialLogin={a.login} />
          <ReasonDialog open={act?.k === "password"} onOpenChange={(o) => !o && setAct(null)} title={`Reset password · ${a.login}`} description="A new master password is emailed to the client; investor password unchanged." codes={["PWD-01 · Client request (verified)", "PWD-02 · Suspected compromise", "PWD-03 · Support ticket"]} confirmLabel="Reset & email" successMessage="Password reset — email sent" onConfirm={() => toast("Active sessions on this login were terminated")} />
        </>
      )}
    </div>
  );
}
