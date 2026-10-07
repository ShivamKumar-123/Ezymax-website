"use client";

import * as React from "react";
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, BadgePercent, CandlestickChart, Coins, Download, Gift, Handshake, Moon, Receipt, Search, X } from "lucide-react";
import { Button, Card, Chip, DataTable, Menu, Money, PageHeader, Reveal, Segmented, cn, type ChipTone, type Column } from "@/components/kit";
import { LEDGER, LEDGER_TYPE_LABEL, LIVE_ACCOUNTS, PORTFOLIO_NOW, type LedgerEntry, type LedgerType } from "@kalks/mock/portfolio-extra";
import { downloadCsv, serverTime } from "@/components/portfolio/export";
import { IS_DEMO as DEMO_BUILD } from "@kalks/mock/mode";
import { LiveLedgerPage } from "@/components/trading/portfolio";

const TYPE_META: Record<LedgerType, { tone: ChipTone; icon: React.ReactNode }> = {
  deposit: { tone: "up", icon: <ArrowDownToLine /> },
  withdrawal: { tone: "down", icon: <ArrowUpFromLine /> },
  "transfer-in": { tone: "info", icon: <ArrowLeftRight /> },
  "transfer-out": { tone: "info", icon: <ArrowLeftRight /> },
  trade: { tone: "neutral", icon: <CandlestickChart /> },
  commission: { tone: "warn", icon: <BadgePercent /> },
  swap: { tone: "warn", icon: <Moon /> },
  bonus: { tone: "gold", icon: <Gift /> },
  "ib-payout": { tone: "gold", icon: <Handshake /> },
  fee: { tone: "warn", icon: <Receipt /> },
};

const GROUPS: { value: string; label: string; types: LedgerType[] }[] = [
  { value: "all", label: "All", types: [] },
  { value: "funding", label: "Funding", types: ["deposit", "withdrawal", "transfer-in", "transfer-out"] },
  { value: "trading", label: "Trade P&L", types: ["trade"] },
  { value: "charges", label: "Charges", types: ["commission", "swap", "fee"] },
  { value: "earnings", label: "Bonus & IB", types: ["bonus", "ib-payout"] },
];

const PRESETS = ["7D", "30D", "90D", "All"] as const;

type Row = LedgerEntry & { total: number };

/** Combined running balance across all live accounts (oldest → newest). */
const WITH_TOTAL: Row[] = (() => {
  let run = 0;
  const asc = [...LEDGER].reverse().map((e) => {
    run = +(run + e.amount).toFixed(2);
    return { ...e, total: run };
  });
  return asc.reverse();
})();

function DemoLedgerPage() {
  const [account, setAccount] = React.useState("all");
  const [group, setGroup] = React.useState("all");
  const [preset, setPreset] = React.useState<(typeof PRESETS)[number]>("30D");
  const [q, setQ] = React.useState("");

  const rows = React.useMemo(() => {
    const types = GROUPS.find((g) => g.value === group)!.types;
    const from = preset === "All" ? 0 : PORTFOLIO_NOW - { "7D": 7, "30D": 30, "90D": 90 }[preset] * 86400_000;
    const qq = q.trim().toLowerCase();
    return WITH_TOTAL.filter(
      (e) =>
        (account === "all" || e.login === account) &&
        (!types.length || types.includes(e.type)) &&
        Date.parse(e.time) >= from &&
        (!qq || e.note.toLowerCase().includes(qq) || e.ref.toLowerCase().includes(qq)),
    );
  }, [account, group, preset, q]);

  const sum = (types: LedgerType[]) => rows.filter((r) => types.includes(r.type)).reduce((s, r) => s + r.amount, 0);
  const summary = [
    { label: "Deposits & in", value: sum(["deposit", "transfer-in"]), icon: <ArrowDownToLine /> },
    { label: "Withdrawals & out", value: sum(["withdrawal", "transfer-out"]), icon: <ArrowUpFromLine /> },
    { label: "Trade P&L", value: sum(["trade"]), icon: <CandlestickChart /> },
    { label: "Charges", value: sum(["commission", "swap", "fee"]), icon: <Receipt /> },
    { label: "Bonus & IB", value: sum(["bonus", "ib-payout"]), icon: <Coins /> },
  ];
  const net = rows.reduce((s, r) => s + r.amount, 0);

  const cols: Column<Row>[] = [
    { key: "time", header: "Time (GMT+3)", cell: (e) => <span className="k-num whitespace-nowrap font-mono text-[12px] text-fg-2">{serverTime(e.time)}</span>, sort: (e) => e.time },
    { key: "id", header: "ID", hideOn: "lg", cell: (e) => <span className="font-mono text-[12px] text-fg-3">{e.id}</span> },
    { key: "acct", header: "Account", hideOn: "md", cell: (e) => <span className="font-mono text-[12.5px] text-fg-2">{e.login}</span> },
    {
      key: "type",
      header: "Type",
      cell: (e) => (
        <Chip size="sm" tone={TYPE_META[e.type].tone} className="[&_svg]:size-3">
          {TYPE_META[e.type].icon}
          {LEDGER_TYPE_LABEL[e.type]}
        </Chip>
      ),
      sort: (e) => e.type,
    },
    {
      key: "desc",
      header: "Description",
      cell: (e) => (
        <div className="min-w-0 max-w-[320px]">
          <div className="truncate text-[13px]">{e.note}</div>
          <div className="font-mono text-[11px] text-fg-3">{e.ref}</div>
        </div>
      ),
    },
    { key: "amount", header: "Amount", align: "right", cell: (e) => <Money value={e.amount} countUp={false} signed tone="auto" className="font-semibold" />, sort: (e) => e.amount },
    {
      key: "bal",
      header: account === "all" ? "Running balance" : `Balance #${account}`,
      align: "right",
      cell: (e) => <Money value={account === "all" ? e.total : e.balance} countUp={false} className="text-fg-2" />,
    },
  ];

  return (
    <div className="pb-24">
      <PageHeader
        title="Ledger"
        subtitle="Every balance movement: funding, trade P&L, commissions, swaps, bonuses and IB payouts."
        actions={
          <Button
            variant="ember"
            onClick={() =>
              downloadCsv(
                `kalks-ledger-${preset.toLowerCase()}`,
                rows.map((e) => ({ id: e.id, time: serverTime(e.time, true), account: e.login, type: LEDGER_TYPE_LABEL[e.type], reference: e.ref, description: e.note, amount: e.amount, balance: account === "all" ? e.total : e.balance })),
              )
            }
          >
            <Download /> Export CSV
          </Button>
        }
      />

      <Reveal>
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {summary.map((s) => (
            <Card key={s.label} className="px-5 py-4">
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-fg-3">{s.label}</span>
                <span className="text-fg-3 [&_svg]:size-3.5">{s.icon}</span>
              </div>
              <Money value={s.value} countUp={false} signed tone="auto" className={cn("mt-2 block text-[19px] font-semibold", s.value === 0 && "text-fg-3")} />
            </Card>
          ))}
          <Card hot className="col-span-2 px-5 py-4 md:col-span-1">
            <span className="text-[11px] uppercase tracking-wider text-fg-2">Net change</span>
            <Money value={net} signed tone="auto" className="mt-2 block text-[19px] font-semibold" />
          </Card>
        </div>
      </Reveal>

      <Reveal delay={0.08}>
        <Card className="px-4 pb-5 pt-5 sm:px-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Menu
              align="start"
              trigger={
                <Button size="sm" variant="surface">
                  <span className="font-mono">{account === "all" ? "All accounts" : `#${account}`}</span>
                </Button>
              }
              items={[{ label: "All accounts", onSelect: () => setAccount("all") }, "sep", ...LIVE_ACCOUNTS.map((a) => ({ label: <span className="font-mono">#{a.login}</span>, hint: a.nickname ?? a.group, onSelect: () => setAccount(a.login) }))]}
            />
            <Segmented size="xs" value={group} onChange={setGroup} options={GROUPS.map((g) => ({ value: g.value, label: g.label }))} />
            <Segmented size="xs" value={preset} onChange={setPreset} options={PRESETS} />
            <div className="ml-auto flex h-9 items-center gap-2 rounded-full border border-line bg-surface-2 px-3.5">
              <Search className="size-3.5 text-fg-3" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Reference or note…" className="w-36 bg-transparent text-[13px] outline-none placeholder:text-fg-3 sm:w-44" />
              {q && (
                <button onClick={() => setQ("")} aria-label="Clear" className="text-fg-3 hover:text-fg">
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>
          <DataTable columns={cols} rows={rows} pageSize={15} dense rowKey={(e) => e.id} />
        </Card>
      </Reveal>
    </div>
  );
}

/** Live builds: real accounts from the trading engine (via /api/trading). Demo builds: mock data. */
export default function LedgerPage() {
  return DEMO_BUILD ? <DemoLedgerPage /> : <LiveLedgerPage />;
}
