"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Flame,
  Fuel,
  RefreshCw,
  Snowflake,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import {
  Avatar,
  Button,
  Card,
  CardHeader,
  Chip,
  DivergingBar,
  Flag,
  Gauge,
  Icon3D,
  MiniBars,
  Money,
  Progress,
  Segmented,
  SymbolCell,
  Tooltip,
  cn,
  formatMoney,
  formatNumber,
  shortHash,
  useQuotes,
} from "@ezymex/ui";
import { getClient, REASON_CODES, KYC_QUEUE, timeAgo, serverTime, staff } from "@ezymex/mock/admin-clients";
import {
  ALERTS,
  AB_SPLIT,
  BOOK_PNL_INTRADAY,
  EXPOSURE,
  REVENUE_STREAMS,
  RISK_INDEX,
  TOXIC_FLOW,
  WALLETS,
  WITHDRAWAL_QUEUE,
  exposureClientPnl,
  notionalUsd,
  type WithdrawalRequest,
  type RiskCheck,
} from "@ezymex/mock/admin-ops";
import { seeded } from "@ezymex/mock";
import { IntradayChart, PnlText, ReasonDialog, RiskScore, SEVERITY_BAR, SeverityChip, ShareBar, SlaTimer, usdCompact, type IntradaySeriesPoint } from "./kit";

/* ------------------------------------------------------------------ */
/* Live exposure                                                       */
/* ------------------------------------------------------------------ */

export function useLiveExposure() {
  const qs = useQuotes(EXPOSURE.map((e) => e.symbol));
  return React.useMemo(
    () =>
      EXPOSURE.map((e) => {
        const q = qs[e.symbol]!;
        const mid = (q.bid + q.ask) / 2;
        const net = e.buyLots - e.sellLots;
        const netUsd = notionalUsd(e.symbol, net, mid);
        const clientPnl = exposureClientPnl(e, q.bid, q.ask);
        return { ...e, q, net, netUsd, clientPnl, bookPnl: -clientPnl, usage: (Math.abs(netUsd) / e.limitUsd) * 100 };
      }),
    [qs],
  );
}

export function usageTone(u: number) {
  return u >= 85 ? "down" : u >= 70 ? "warn" : "up";
}

export function ExposureCard() {
  const rows = useLiveExposure();
  const [view, setView] = React.useState<"book" | "client">("book");
  const maxNet = Math.max(...rows.map((r) => Math.abs(r.netUsd)));
  const totalBook = rows.reduce((s, r) => s + r.bookPnl, 0);
  const gross = rows.reduce((s, r) => s + Math.abs(r.netUsd), 0);
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Live exposure"
        subtitle={
          <span>
            B-book net by symbol · gross {usdCompact(gross, 1)} · floating{" "}
            <PnlText value={view === "book" ? totalBook : -totalBook} />
          </span>
        }
        action={
          <>
            <Segmented size="xs" value={view} onChange={setView} options={[{ value: "book", label: "Book P&L" }, { value: "client", label: "Client P&L" }]} />
            <Link href="/trading/exposure">
              <Button size="sm" variant="surface">
                Limits <ArrowUpRight />
              </Button>
            </Link>
          </>
        }
      />
      <div className="mt-4 flex-1 overflow-x-auto px-4 pb-5 sm:px-6">
        <table className="w-full min-w-[860px] border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-[0.05em] text-fg-3">
              {[
                ["Symbol", "text-left pl-4 rounded-l-[14px] border-l"],
                ["Buy lots", "text-right"],
                ["Sell lots", "text-right"],
                ["Net lots  ◂ short · long ▸", "text-center w-[210px]"],
                ["Net USD", "text-right"],
                [view === "book" ? "Book P&L" : "Client P&L", "text-right"],
                ["Limit usage", "text-left w-[150px] pr-4 rounded-r-[14px] border-r"],
              ].map(([h, c]) => (
                <th key={h} className={cn("border-y border-line bg-surface-2 px-3 py-2.5 font-medium", c)}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const pnl = view === "book" ? r.bookPnl : r.clientPnl;
              const tone = usageTone(r.usage);
              return (
                <motion.tr key={r.symbol} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.03 }} className="group">
                  <td className="border-b border-line py-2 pl-4 pr-3 group-hover:bg-surface-2/60">
                    <SymbolCell symbol={r.symbol} size={24} sub={<span className="k-num">{r.clients} clients</span>} />
                  </td>
                  <td className="k-num border-b border-line px-3 text-right text-up group-hover:bg-surface-2/60">{formatNumber(r.buyLots, 1)}</td>
                  <td className="k-num border-b border-line px-3 text-right text-down group-hover:bg-surface-2/60">{formatNumber(r.sellLots, 1)}</td>
                  <td className="border-b border-line px-3 group-hover:bg-surface-2/60">
                    <div className="flex items-center gap-2.5">
                      <DivergingBar value={r.netUsd} max={maxNet} className="flex-1" />
                      <span className={cn("k-num w-16 text-right font-mono text-[12px] font-medium", r.net >= 0 ? "text-up" : "text-down")}>
                        {r.net >= 0 ? "+" : ""}
                        {formatNumber(r.net, 1)}
                      </span>
                    </div>
                  </td>
                  <td className="k-num border-b border-line px-3 text-right font-mono text-[12.5px] group-hover:bg-surface-2/60">{usdCompact(r.netUsd)}</td>
                  <td className="border-b border-line px-3 text-right group-hover:bg-surface-2/60">
                    <PnlText value={pnl} className="font-mono text-[12.5px]" />
                  </td>
                  <td className="border-b border-line py-2 pl-3 pr-4 group-hover:bg-surface-2/60">
                    <div className="flex items-center gap-2">
                      <Progress value={r.usage} tone={tone} className="h-1.5 flex-1" />
                      <span className={cn("k-num w-9 text-right text-[11.5px] font-medium", tone === "down" ? "text-down" : tone === "warn" ? "text-warn" : "text-fg-2")}>{Math.round(r.usage)}%</span>
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Book risk gauge                                                     */
/* ------------------------------------------------------------------ */

export function BookRiskCard() {
  const rows = useLiveExposure();
  const floating = rows.reduce((s, r) => s + r.bookPnl, 0);
  const top = [...rows].sort((a, b) => b.usage - a.usage).slice(0, 3);
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="Book risk" subtitle="Composite of exposure, drawdown & toxic flow" action={<Chip tone="warn" dot>{RISK_INDEX.label}</Chip>} />
      <div className="flex flex-1 items-center justify-center py-3">
        <Gauge value={RISK_INDEX.value} max={100} label="Risk index" sublabel={<span className="text-warn">Watch XAUUSD</span>} size={206} />
      </div>
      <div className="grid grid-cols-2 gap-2.5 px-4 sm:px-6">
        <div className="k-row px-4 py-3">
          <div className="text-[11px] uppercase tracking-wider text-fg-3">Floating P&L</div>
          <PnlText value={floating} className="mt-1 block text-[15px]" />
        </div>
        <div className="k-row px-4 py-3">
          <div className="text-[11px] uppercase tracking-wider text-fg-3">Margin used</div>
          <div className="k-num mt-1 text-[15px] font-medium">{usdCompact(RISK_INDEX.marginUsed)}</div>
        </div>
      </div>
      <div className="space-y-2.5 px-6 pb-5 pt-4">
        <div className="text-[11px] uppercase tracking-wider text-fg-3">Top concentration</div>
        {top.map((r) => (
          <div key={r.symbol} className="flex items-center gap-3 text-[12.5px]">
            <span className="w-16 font-medium">{r.symbol}</span>
            <Progress value={r.usage} tone={usageTone(r.usage)} className="flex-1" />
            <span className="k-num w-9 text-right text-fg-2">{Math.round(r.usage)}%</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Book P&L intraday                                                   */
/* ------------------------------------------------------------------ */

function multiDay(days: number, end: number, seed: number): IntradaySeriesPoint[] {
  const r = seeded(seed);
  const pts = days * 24;
  const out: IntradaySeriesPoint[] = [];
  let v = 0;
  const now = BOOK_PNL_INTRADAY[BOOK_PNL_INTRADAY.length - 1]!.t;
  for (let i = 0; i < pts; i++) {
    v += 820 + r.normal() * 5200;
    out.push({ t: now - (pts - 1 - i) * 3600_000, v, vol: Math.round(200 + r.next() * 900) });
  }
  const k = end / out[out.length - 1]!.v;
  return out.map((p) => ({ ...p, v: p.v * k }));
}

const dayLabel = (t: number) => {
  const d = new Date(t + 3 * 3600_000);
  return `${String(d.getUTCDate()).padStart(2, "0")} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()]}`;
};

export function BookPnlCard() {
  const [range, setRange] = React.useState<"1D" | "1W" | "1M">("1D");
  const data = React.useMemo<IntradaySeriesPoint[]>(() => {
    if (range === "1D") return BOOK_PNL_INTRADAY.map((p) => ({ t: p.t, v: p.pnl, vol: p.volume }));
    return range === "1W" ? multiDay(7, 142_880.4, 71) : multiDay(30, 612_402.9, 301);
  }, [range]);
  const [hover, setHover] = React.useState<IntradaySeriesPoint | null>(null);
  const onHover = React.useCallback((p: IntradaySeriesPoint | null) => setHover(p), []);
  const last = data[data.length - 1]!;
  const shown = hover ?? last;
  const peak = Math.max(...data.map((d) => d.v));
  const trough = Math.min(...data.map((d) => d.v));
  const label = range === "1D" ? (t: number) => serverTime(new Date(t).toISOString(), false) : dayLabel;
  return (
    <Card className="h-full">
      <div className="flex flex-col gap-4 px-6 pt-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-[17px] font-medium tracking-tight">Book P&L</h3>
            <Chip size="sm" tone="ember" dot>
              Live
            </Chip>
          </div>
          <div className="mt-2 flex flex-wrap items-baseline gap-3">
            <Money value={shown.v} signed countUp={!hover} tone={shown.v >= 0 ? "up" : "down"} className="text-[32px] font-semibold tracking-tight" />
            <span className="text-[12.5px] text-fg-3">{hover ? `at ${label(hover.t)}${range === "1D" ? " GMT+3" : ""}` : range === "1D" ? "since 00:00 GMT+3" : `last ${range === "1W" ? "7" : "30"} days`}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-[12px] text-fg-3">
            <span>
              Peak <span className="k-num font-medium text-up">{formatMoney(peak)}</span>
            </span>
            <span>
              Trough <PnlText value={trough} />
            </span>
            <span>
              Realised <span className="k-num font-medium text-fg-2">{formatMoney(range === "1D" ? BOOK_PNL_INTRADAY[BOOK_PNL_INTRADAY.length - 1]!.realized : last.v * 0.62)}</span>
            </span>
          </div>
        </div>
        <Segmented size="xs" value={range} onChange={setRange} options={["1D", "1W", "1M"] as const} />
      </div>
      <div className="px-4 pb-4 pt-3 sm:px-6">
        <IntradayChart key={range} data={data} height={290} timeLabel={label} onHover={onHover} />
      </div>
    </Card>
  );
}

export function RevenueCard() {
  const total = REVENUE_STREAMS.reduce((s, r) => s + r.value, 0);
  const colors = ["bg-ember", "bg-gold", "bg-up", "bg-info"];
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="Revenue today" subtitle="Spread, commission, swaps & B-book" />
      <div className="px-6 pt-3">
        <Money value={total} className="text-[28px] font-semibold tracking-tight" />
        <ShareBar className="mt-3" height={8} parts={REVENUE_STREAMS.map((r, i) => ({ value: r.value, className: colors[i]! }))} />
      </div>
      <div className="mt-3 flex-1 divide-y divide-line px-6">
        {REVENUE_STREAMS.map((r, i) => (
          <div key={r.label} className="flex items-center justify-between py-2.5 text-[13px]">
            <span className="flex items-center gap-2.5 text-fg-2">
              <span className={cn("size-2 rounded-full", colors[i])} />
              {r.label}
            </span>
            <span className="flex items-center gap-3">
              <span className="k-num text-[11.5px] text-fg-3">{r.share}%</span>
              <Money value={r.value} countUp={false} className="w-24 text-right font-medium" />
            </span>
          </div>
        ))}
      </div>
      <div className="m-4 mt-2 rounded-[14px] border border-line bg-surface-2 px-4 py-3.5 sm:mx-6 sm:mb-6">
        <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider">
          <span className="text-info">A-book {AB_SPLIT.a}%</span>
          <span className="text-fg-2">B-book {AB_SPLIT.b}%</span>
        </div>
        <ShareBar
          className="mt-2"
          height={10}
          parts={[
            { value: AB_SPLIT.a, className: "bg-info" },
            { value: AB_SPLIT.b, className: "bg-gradient-to-r from-ember to-[#ff8a3d]" },
          ]}
        />
        <div className="k-num mt-2 flex justify-between font-mono text-[11.5px] text-fg-3">
          <span>{formatNumber(AB_SPLIT.aLots, 1)} lots</span>
          <span>{formatNumber(AB_SPLIT.bLots, 1)} lots</span>
        </div>
        <div className="mt-2.5 flex items-center justify-between">
          <span className="text-[11.5px] text-fg-3">LP not connected · A-book rules fall back to B</span>
          <Link href="/trading/routing" className="text-[12px] font-medium text-ember hover:underline">
            Rules →
          </Link>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Withdrawal queue                                                    */
/* ------------------------------------------------------------------ */

const CHECK_ICON: Record<RiskCheck["key"], string> = { kyc: "KYC", bonus: "BON", ip: "IP", wallet: "WAL", aml: "AML", margin: "MRG" };

export function RiskChecks({ checks }: { checks: RiskCheck[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {checks.map((c) => (
        <Tooltip key={c.key} content={`${c.label}: ${c.detail}`}>
          <span
            className={cn(
              "inline-flex h-5 items-center gap-0.5 rounded-full border px-1.5 text-[9.5px] font-semibold tracking-wide",
              c.ok ? "border-up/25 bg-up-soft text-up" : "border-warn/35 bg-warn-soft text-warn",
            )}
          >
            {c.ok ? <Check className="size-2.5" strokeWidth={3} /> : <AlertTriangle className="size-2.5" strokeWidth={2.6} />}
            {CHECK_ICON[c.key]}
          </span>
        </Tooltip>
      ))}
    </div>
  );
}

export function WithdrawalRow({ w, onDone }: { w: WithdrawalRequest; onDone: (id: string) => void }) {
  const c = getClient(w.clientId);
  const flagged = w.checks.filter((x) => !x.ok);
  const [dlg, setDlg] = React.useState<"reject" | "override" | null>(null);
  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 30, height: 0, marginTop: 0 }} className="k-row px-3.5 py-3">
      <div className="flex items-start gap-3">
        <Avatar src={c.photo} name={c.name} size={34} verified={c.kyc === "verified"} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Link href={`/clients/${c.id}`} className="truncate text-[13.5px] font-medium hover:text-ember">
              {c.name}
            </Link>
            <Flag country={c.country} className="size-3.5" />
            {w.firstWithdrawal && (
              <Chip size="sm" tone="gold">
                1st
              </Chip>
            )}
          </div>
          <div className="k-num mt-0.5 font-mono text-[12.5px]">
            {formatNumber(w.amount, 2)} <span className="text-fg-3">USDT · TRC20</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[11px] text-fg-3">{timeAgo(w.requested)}</span>
          <SlaTimer mins={w.slaMins} compact />
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
        <RiskChecks checks={w.checks} />
        <div className="flex gap-1.5">
          <Button size="xs" variant="down-outline" onClick={() => setDlg("reject")}>
            Reject
          </Button>
          <Button
            size="xs"
            variant="up-outline"
            onClick={() => {
              if (flagged.length) return setDlg("override");
              toast.success(`Withdrawal ${w.id} approved`, { description: `${formatNumber(w.amount, 2)} USDT queued for signing · ${shortHash(w.address, 6, 4)}` });
              onDone(w.id);
            }}
          >
            Approve
          </Button>
        </div>
      </div>
      <ReasonDialog
        open={dlg === "reject"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Reject ${formatNumber(w.amount, 2)} USDT`}
        description={`${c.name} · ${w.id} · funds return to the client wallet`}
        codes={REASON_CODES.withdrawal}
        confirmLabel="Reject withdrawal"
        confirmVariant="sell"
        successMessage={`Withdrawal ${w.id} rejected`}
        onConfirm={() => onDone(w.id)}
      />
      <ReasonDialog
        open={dlg === "override"}
        onOpenChange={(o) => !o && setDlg(null)}
        title="Approve with failed checks?"
        description={`${flagged.length} risk check${flagged.length > 1 ? "s" : ""} failed — an override reason is required.`}
        codes={["OVR-01 · Verified by phone", "OVR-02 · Source of funds provided", "OVR-03 · Known IB network", "OVR-04 · Manager approval"]}
        confirmLabel="Override & approve"
        successMessage={`Withdrawal ${w.id} approved with override`}
        onConfirm={() => onDone(w.id)}
      >
        <div className="space-y-2">
          {flagged.map((f) => (
            <div key={f.key} className="flex items-center gap-2.5 rounded-[12px] border border-warn/25 bg-warn-soft px-3 py-2 text-[12.5px]">
              <AlertTriangle className="size-3.5 shrink-0 text-warn" />
              <span className="font-medium text-fg">{f.label}</span>
              <span className="text-fg-2">{f.detail}</span>
            </div>
          ))}
        </div>
      </ReasonDialog>
    </motion.div>
  );
}

export function WithdrawalQueueCard() {
  const [items, setItems] = React.useState(WITHDRAWAL_QUEUE);
  const total = items.reduce((s, w) => s + w.amount, 0);
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Withdrawal queue"
        subtitle={
          <span>
            {items.length} pending · <span className="k-num">{formatNumber(total, 0)}</span> USDT
          </span>
        }
        action={
          <Link href="/command/queues">
            <Button size="sm" variant="surface">
              View all
            </Button>
          </Link>
        }
      />
      <div className="k-fade-bottom mt-4 flex-1 space-y-2 px-4 pb-5 sm:px-6">
        <AnimatePresence initial={false}>
          {items.slice(0, 3).map((w) => (
            <WithdrawalRow key={w.id} w={w} onDone={(id) => setItems((xs) => xs.filter((x) => x.id !== id))} />
          ))}
        </AnimatePresence>
        {items.length === 0 && <div className="py-10 text-center text-[13px] text-fg-3">Queue clear — nice work.</div>}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* KYC queue                                                           */
/* ------------------------------------------------------------------ */

export function DocThumb({ className, size = "md" }: { className?: string; size?: "sm" | "md" }) {
  return (
    <span className={cn("relative grid shrink-0 place-items-center overflow-hidden rounded-[10px] border border-line bg-[linear-gradient(135deg,var(--k-surface-3),var(--k-surface-2))]", size === "sm" ? "h-9 w-12" : "h-11 w-15", className)}>
      <span className="absolute inset-x-1.5 bottom-1.5 space-y-[2px] opacity-40">
        <span className="block h-[2px] rounded bg-fg-3" />
        <span className="block h-[2px] w-2/3 rounded bg-fg-3" />
      </span>
      <Icon3D name="identification_card" size={size === "sm" ? 22 : 28} className="relative -mt-1.5" />
    </span>
  );
}

function scoreTone(s: number) {
  return s >= 85 ? "up" : s >= 65 ? "warn" : "down";
}

export function KycQueueCard() {
  const list = KYC_QUEUE.slice(0, 4);
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="KYC queue"
        subtitle={`${KYC_QUEUE.length} awaiting review · auto-approve ≥ 90`}
        action={
          <Link href="/clients/kyc">
            <Button size="sm" variant="surface">
              Open queue
            </Button>
          </Link>
        }
      />
      <div className="k-fade-bottom mt-4 flex-1 space-y-2 px-4 pb-5 sm:px-6">
        {list.map((k) => {
          const c = getClient(k.clientId);
          const tone = scoreTone(k.providerScore);
          return (
            <div key={k.id} className="k-row flex items-center gap-3 px-3.5 py-2.5">
              <DocThumb />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[13.5px] font-medium">{c.name}</span>
                  <Flag country={c.country} className="size-3.5" />
                </div>
                <div className="truncate text-[11.5px] text-fg-3">
                  {k.docType} · L{k.level}
                  {k.amlHit !== "clear" && <span className="text-warn"> · {k.amlHit.toUpperCase()} hit</span>}
                  {k.checks.some((x) => x.result === "fail") && <span className="text-down"> · {k.checks.find((x) => x.result === "fail")!.label.toLowerCase()} failed</span>}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <span className={cn("k-num text-[13px] font-semibold", tone === "up" ? "text-up" : tone === "warn" ? "text-warn" : "text-down")}>{k.providerScore}%</span>
                <Link href={`/clients/kyc?id=${k.id}`}>
                  <Button size="xs" variant="surface">
                    Review
                  </Button>
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Alerts center                                                       */
/* ------------------------------------------------------------------ */

export function AlertsCard() {
  const [acked, setAcked] = React.useState<Set<string>>(new Set());
  const open = ALERTS.filter((a) => a.status !== "resolved");
  const counts = { critical: open.filter((a) => a.severity === "critical").length, high: open.filter((a) => a.severity === "high").length };
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Alerts center"
        subtitle={
          <span>
            <span className="text-down">{counts.critical} critical</span> · <span className="text-ember">{counts.high} high</span> · {open.length} open
          </span>
        }
        action={
          <Link href="/command/alerts">
            <Button size="sm" variant="surface">
              All alerts
            </Button>
          </Link>
        }
      />
      <div className="k-fade-bottom mt-4 flex-1 space-y-2 px-4 pb-5 sm:px-6">
        {open.slice(0, 5).map((a) => {
          const isAck = acked.has(a.id) || a.status !== "new";
          return (
            <div key={a.id} className="k-row relative flex items-center gap-3 overflow-hidden py-2.5 pl-5 pr-3">
              <span className={cn("absolute inset-y-2 left-0 w-[3px] rounded-r-full", SEVERITY_BAR[a.severity], a.severity === "critical" && "shadow-[0_0_10px_var(--k-down)]")} />
              <div className="min-w-0 flex-1">
                <Link href={a.href ?? "/command/alerts"} className="line-clamp-1 text-[13px] font-medium hover:text-ember">
                  {a.title}
                </Link>
                <div className="mt-0.5 flex items-center gap-2 font-mono text-[10.5px] text-fg-3">
                  {serverTime(a.time, false)}
                  <span>·</span>
                  <span className="uppercase">{a.type}</span>
                  {a.assigneeId && (
                    <>
                      <span>·</span>
                      <span className="font-sans">{staff(a.assigneeId).name.split(" ")[0]}</span>
                    </>
                  )}
                </div>
              </div>
              {isAck ? (
                <SeverityChip severity={a.severity} />
              ) : (
                <Tooltip content="Acknowledge">
                  <button
                    onClick={() => {
                      setAcked((s) => new Set(s).add(a.id));
                      toast.success("Alert acknowledged", { description: a.title });
                    }}
                    className="grid size-7 shrink-0 place-items-center rounded-full border border-line text-fg-2 hover:border-up/40 hover:bg-up-soft hover:text-up"
                    aria-label="Acknowledge"
                  >
                    <Check className="size-3.5" />
                  </button>
                </Tooltip>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Toxic flow                                                          */
/* ------------------------------------------------------------------ */

export function fmtHold(s: number) {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${(s / 86400).toFixed(1)}d`;
}

export function ToxicFlowCard() {
  const [routes, setRoutes] = React.useState<Record<string, "A" | "B">>(() => Object.fromEntries(TOXIC_FLOW.map((t) => [t.clientId, t.route])));
  const [target, setTarget] = React.useState<string | null>(null);
  const t = TOXIC_FLOW.find((x) => x.clientId === target);
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Toxic flow watch"
        subtitle="Scalping & latency-arbitrage detection · last 7 days"
        action={
          <Chip tone="up" dot>
            Real-time detection
          </Chip>
        }
      />
      <div className="mt-4 overflow-x-auto px-4 pb-5 sm:px-6">
        <table className="w-full min-w-[820px] border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-[0.05em] text-fg-3">
              {["Client", "Pattern", "Score", "Win rate", "Avg hold", "Lots", "Client P&L", "Route", ""].map((h, i) => (
                <th
                  key={i}
                  className={cn(
                    "border-y border-line bg-surface-2 px-3 py-2.5 font-medium",
                    i === 0 && "rounded-l-[14px] border-l pl-4 text-left",
                    i === 8 && "rounded-r-[14px] border-r",
                    i === 1 && "text-left",
                    i >= 3 && i <= 6 && "text-right",
                    (i === 2 || i === 7) && "text-center",
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TOXIC_FLOW.map((row) => {
              const c = getClient(row.clientId);
              const route = routes[row.clientId]!;
              return (
                <tr key={row.clientId} className="group">
                  <td className="border-b border-line py-2.5 pl-4 pr-3 group-hover:bg-surface-2/60">
                    <Link href={`/clients/${c.id}`} className="flex items-center gap-2.5">
                      <Avatar src={c.photo} name={c.name} size={28} />
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium hover:text-ember">{c.name}</span>
                        <span className="block font-mono text-[11px] text-fg-3">#{row.login}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="border-b border-line px-3 text-[12.5px] text-fg-2 group-hover:bg-surface-2/60">{row.pattern}</td>
                  <td className="border-b border-line px-3 text-center group-hover:bg-surface-2/60">
                    <RiskScore score={row.score} />
                  </td>
                  <td className="k-num border-b border-line px-3 text-right group-hover:bg-surface-2/60">{row.winRate.toFixed(1)}%</td>
                  <td className="k-num border-b border-line px-3 text-right font-mono text-[12.5px] group-hover:bg-surface-2/60">{fmtHold(row.avgHoldSec)}</td>
                  <td className="k-num border-b border-line px-3 text-right group-hover:bg-surface-2/60">{formatNumber(row.lots, 1)}</td>
                  <td className="border-b border-line px-3 text-right group-hover:bg-surface-2/60">
                    <PnlText value={row.pnl} />
                  </td>
                  <td className="border-b border-line px-3 text-center group-hover:bg-surface-2/60">
                    <Chip size="sm" tone={route === "A" ? "info" : "neutral"}>
                      {route}-book
                    </Chip>
                  </td>
                  <td className="border-b border-line py-2 pl-3 pr-2 text-right group-hover:bg-surface-2/60">
                    {route === "B" && row.score >= 7 ? (
                      <Button size="xs" variant="ember" onClick={() => setTarget(row.clientId)}>
                        Move to A-book
                      </Button>
                    ) : route === "B" ? (
                      <Button size="xs" variant="surface" onClick={() => toast.success(`${c.name} added to watchlist`, { description: "Dealer will be notified on next 20 trades" })}>
                        Monitor
                      </Button>
                    ) : (
                      <Button size="xs" variant="ghost" onClick={() => setTarget(row.clientId)}>
                        Back to B
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {t && (
        <ReasonDialog
          open={!!target}
          onOpenChange={(o) => !o && setTarget(null)}
          title={routes[t.clientId] === "B" ? "Route client to A-book" : "Return client to B-book"}
          description={`${getClient(t.clientId).name} · #${t.login} · ${t.pattern}`}
          codes={REASON_CODES.routing}
          confirmLabel={routes[t.clientId] === "B" ? "Move to A-book (100%)" : "Move to B-book"}
          successMessage={routes[t.clientId] === "B" ? "Client routed to A-book" : "Client returned to B-book"}
          onConfirm={() => setRoutes((r) => ({ ...r, [t.clientId]: r[t.clientId] === "B" ? "A" : "B" }))}
        >
          <div className="grid grid-cols-3 gap-2">
            {[
              ["Risk score", `${t.score} / 10`],
              ["Avg hold", fmtHold(t.avgHoldSec)],
              ["Win rate", `${t.winRate}%`],
            ].map(([k, v]) => (
              <div key={k} className="k-row px-3 py-2.5">
                <div className="text-[10.5px] uppercase tracking-wider text-fg-3">{k}</div>
                <div className="k-num mt-0.5 font-mono text-[14px] font-medium">{v}</div>
              </div>
            ))}
          </div>
          <div className="flex items-start gap-2.5 rounded-[14px] border border-warn/25 bg-warn-soft px-3.5 py-2.5 text-[12.5px] text-fg-2">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warn" />
            No LP is connected yet — A-book orders will be held on B-book and flagged for hedging until a FIX 4.4 session is live.
          </div>
        </ReasonDialog>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Wallets                                                             */
/* ------------------------------------------------------------------ */

export function WalletsCard() {
  const h = WALLETS.hot;
  const gasLow = h.trx < h.trxMin;
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="Wallets" subtitle="USDT · TRC20 custody" icon={<Wallet />} />
      <div className="mt-4 space-y-2.5 px-4 sm:px-6">
        <div className="k-row px-4 py-3.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[13px] font-medium">
              <Flame className="size-4 text-ember" /> Hot wallet
            </span>
            <span className="k-num font-mono text-[15px] font-semibold">
              {formatNumber(h.usdt, 2)} <span className="text-[11px] text-fg-3">USDT</span>
            </span>
          </div>
          <Progress value={(h.usdt / h.cap) * 100} tone="ember" className="mt-2.5" />
          <div className="mt-2 flex items-center justify-between text-[11.5px] text-fg-3">
            <span className="font-mono">{shortHash(h.address, 6, 5)}</span>
            <span>cap {usdCompact(h.cap, 0)} · swept {timeAgo(h.lastSweep)}</span>
          </div>
          <div className={cn("mt-3 flex items-center gap-2.5 rounded-xl border px-3 py-2", gasLow ? "border-warn/30 bg-warn-soft" : "border-line bg-surface-3/50")}>
            <Fuel className={cn("size-4 shrink-0", gasLow ? "text-warn" : "text-fg-3")} />
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-medium">
                TRX gas <span className="k-num font-mono">{formatNumber(h.trx, 0)}</span>
                <span className="text-fg-3"> / min {formatNumber(h.trxMin, 0)}</span>
              </div>
              <div className="text-[11px] text-fg-3">≈ {Math.round(h.trx / 3)} withdrawals left</div>
            </div>
            <Button size="xs" variant="surface" onClick={() => toast.success("Top-up requested", { description: "5,000 TRX from cold wallet · needs 2nd signer" })}>
              Top up
            </Button>
          </div>
        </div>
        <div className="k-row flex items-center gap-3 px-4 py-3.5">
          <Snowflake className="size-4 text-info" />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium">Cold wallet</div>
            <div className="text-[11.5px] text-fg-3">{WALLETS.cold.signers}</div>
          </div>
          <span className="k-num font-mono text-[15px] font-semibold">
            {formatNumber(WALLETS.cold.usdt, 2)} <span className="text-[11px] text-fg-3">USDT</span>
          </span>
        </div>
        <div className="flex items-end justify-between gap-3 px-1 pt-1">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-fg-3">Net flow 24h</div>
            <div className="text-[12px] text-fg-2">
              {formatNumber(WALLETS.deposit.addresses, 0)} deposit addresses · {WALLETS.deposit.pendingSweeps} sweeps pending
            </div>
          </div>
          <MiniBars data={WALLETS.flows24h} />
        </div>
      </div>
      <div className="mt-auto p-4 sm:px-6 sm:pb-6">
        <div className="flex items-center justify-between rounded-[14px] border border-up/25 bg-up-soft px-4 py-3">
          <span className="flex items-center gap-2 text-[13px] font-medium text-up">
            <CheckCircle2 className="size-4" /> Reconciliation matched
          </span>
          <span className="flex items-center gap-2 font-mono text-[11.5px] text-fg-2">
            {serverTime(WALLETS.reconciliation.last)} · Δ 0.00
            <button onClick={() => toast.success("Reconciliation started", { description: "Ledger vs on-chain · ~40s" })} className="text-fg-3 hover:text-fg" aria-label="Run reconciliation">
              <RefreshCw className="size-3.5" />
            </button>
          </span>
        </div>
      </div>
    </Card>
  );
}

