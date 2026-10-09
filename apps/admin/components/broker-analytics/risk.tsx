"use client";

// Analytics → Broker risk: live client exposure, the broker's B-book floating P&L, concentration, margin levels,
// accounts at risk, credit and negative balances, capital strength and a what-if scenario builder. Live builds read
// the reports service (GET risk, POST scenarios, PUT settings/capital); demo builds compute the same shapes from the
// mock book (@ezymex/mock/admin-broker-analytics).

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Banknote, Gauge, Landmark, Layers, Play, Plus, RefreshCw, ShieldAlert, ShieldCheck, Target, Trash2, Wallet, Zap } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Card,
  CardHeader,
  Chip,
  DataTable,
  Dialog,
  DivergingBar,
  Field,
  IconButton,
  Input,
  KpiCard,
  Money,
  PageHeader,
  Reveal,
  Segmented,
  SymbolCell,
  cn,
  formatDateTime,
  formatNumber,
  type Column,
} from "@ezymex/ui";
import { BA_CAPITAL, BA_CLASSES, BA_PRESETS, baRisk, baScenario, type CapitalInfo, type ExposureRow, type RiskAccount, type RiskReport, type ScenarioAccount, type ScenarioResult, type ShockInput, type ShockScope } from "@ezymex/mock/admin-broker-analytics";
import { ExportActions } from "@/components/analytics/common";
import { Meter, MiniStat } from "@/components/analytics/meter";
import { ExportMenu, ReportFailed, ReportLoading, reportsApi, useReport } from "@/components/reports/common";
import { useCan } from "@/components/staff-session";
import { ClientCell, CountBars, SELECT, addDays, compactMoney, isoDay, pct1 } from "./kit";

const CLASS_LABEL: Record<string, string> = { forex: "Forex", metals: "Metals", indices: "Indices", energies: "Energies", crypto: "Crypto", stocks: "Stocks", options: "Options", other: "Other" };
const STATUS: Record<RiskReport["capital"]["status"], { label: string; tone: "up" | "gold" | "down" | "neutral"; text: string }> = {
  strong: { label: "Strong", tone: "up", text: "Capital covers the worst preset scenario at least twice" },
  adequate: { label: "Adequate", tone: "gold", text: "Capital covers the worst preset scenario, with less than a 2× buffer" },
  weak: { label: "Weak", tone: "down", text: "The worst preset scenario would cost more than the broker's capital" },
  unset: { label: "Not set", tone: "neutral", text: "Set the broker capital to measure coverage" },
};

export type RiskActions = {
  runScenario: (body: { preset?: string; shocks?: ShockInput[] }) => Promise<ScenarioResult>;
  setCapital: (amount: number, reason: string) => Promise<void>;
};

/* ------------------------------------------------------------------ */
/* Capital                                                             */
/* ------------------------------------------------------------------ */

function CapitalDialog({ open, onOpenChange, current, onSave }: { open: boolean; onOpenChange: (o: boolean) => void; current: number | null; onSave: (amount: number, reason: string) => Promise<void> }) {
  const [amount, setAmount] = React.useState(current ? String(current) : "");
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (open) {
      setAmount(current ? String(current) : "");
      setReason("");
    }
  }, [open, current]);
  const n = Number(amount.replace(/[,\s]/g, ""));
  const valid = amount.trim() !== "" && Number.isFinite(n) && n >= 0 && n <= 1e12 && reason.trim().length >= 3;
  const save = async () => {
    setBusy(true);
    try {
      await onSave(n, reason.trim());
      toast.success("Broker capital saved", { description: `${compactMoney(n)} · written to the audit log` });
      onOpenChange(false);
    } catch (e) {
      toast.error("Couldn't save the broker capital", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Set broker capital"
      description="The capital the broker holds against client exposure. Coverage compares it with the worst preset scenario loss."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="ember" disabled={!valid || busy} onClick={save}>
            Save capital
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Broker capital (USD)" hint={current !== null ? `Currently ${compactMoney(current)}` : "Not set yet"}>
          <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,\s]/g, ""))} leading={<Banknote />} placeholder="2500000" autoFocus />
        </Field>
        <Field label="Reason" hint="Required. Stored with your name in the reports audit log.">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 500))}
            rows={3}
            placeholder="e.g. Audited regulatory capital, Q3 2026"
            className="w-full rounded-[14px] border border-line bg-surface-2 px-3.5 py-3 text-sm text-fg outline-none transition-colors placeholder:text-fg-3 focus:border-ember/50"
          />
        </Field>
      </div>
    </Dialog>
  );
}

function CapitalCard({ r, canSet, onSet }: { r: RiskReport; canSet: boolean; onSet: () => void }) {
  const c = r.capital;
  const st = STATUS[c.status];
  const max = Math.max(1, ...c.presets.map((p) => Math.abs(p.brokerImpact)));
  return (
    <Card className="flex h-full flex-col" hot={c.status === "weak"}>
      <CardHeader
        title="Capital strength"
        subtitle="Broker capital vs the worst preset scenario on today's open positions"
        icon={<Landmark />}
        action={
          canSet ? (
            <Button size="sm" variant="surface" onClick={onSet}>
              Set broker capital
            </Button>
          ) : (
            <Chip size="sm">Needs reports.export to change</Chip>
          )
        }
      />
      <div className="grid grid-cols-1 gap-4 px-6 pt-5 sm:grid-cols-[1.1fr_1fr]">
        <div>
          <div className="flex items-center gap-2">
            <Chip tone={st.tone} dot>
              {st.label}
            </Chip>
            {c.coverage !== null && <span className="k-num text-[13px] text-fg-2">{c.coverage.toFixed(2)}× coverage</span>}
          </div>
          <div className="mt-3 text-[11px] uppercase tracking-wider text-fg-3">Broker capital</div>
          {c.amount !== null ? <Money value={c.amount} decimals={0} className="mt-1 block text-[30px] font-semibold leading-none tracking-[-0.02em]" /> : <div className="mt-1 text-[22px] font-semibold text-fg-3">Not set</div>}
          <p className="mt-2 text-[12px] leading-snug text-fg-3">{st.text}</p>
        </div>
        <div className="space-y-2 rounded-[16px] border border-line bg-surface-2/60 p-3.5 text-[12.5px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-fg-3">Worst scenario</span>
            <span className="text-right font-medium">{c.worst ? `${c.worst.label}${c.worst.direction !== "down" && c.worst.preset !== "flash" ? " (up)" : c.worst.preset === "flash" ? "" : " (down)"}` : "—"}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-fg-3">Broker impact</span>
            {c.worst ? <Money value={c.worst.brokerImpact} decimals={0} signed tone="auto" countUp={false} className="font-medium" /> : <span>—</span>}
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-fg-3">Capital after</span>
            {c.capitalAfterWorst !== null ? <Money value={c.capitalAfterWorst} decimals={0} countUp={false} tone={c.capitalAfterWorst < 0 ? "down" : undefined} className="font-medium" /> : <span>—</span>}
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-fg-3">B-book floating</span>
            <span className="k-num">{c.bbookFloatingPct === null ? compactMoney(r.totals.bbookFloating) : `${c.bbookFloatingPct > 0 ? "+" : ""}${c.bbookFloatingPct.toFixed(2)}% of capital`}</span>
          </div>
        </div>
      </div>
      <div className="mt-5 flex-1 px-6">
        <div className="mb-2 grid grid-cols-[1fr_auto_auto] gap-x-4 text-[10.5px] uppercase tracking-wider text-fg-3">
          <span>Preset scenario</span>
          <span className="text-right">Broker impact</span>
          <span className="hidden text-right sm:block">Capital after</span>
        </div>
        <div className="space-y-3">
          {c.presets.map((p) => (
            <div key={p.preset} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 gap-y-1.5">
              <span className="truncate text-[12.5px] text-fg-2">
                {p.label} <span className="text-fg-3">· {p.stopOuts} stop-outs · {p.marginCalls} calls</span>
              </span>
              <Money value={p.brokerImpact} decimals={0} signed tone="auto" countUp={false} className="text-right text-[12.5px] font-medium" />
              <span className="k-num hidden text-right text-[12px] text-fg-3 sm:block">{p.capitalAfter === null ? "—" : compactMoney(p.capitalAfter)}</span>
              <div className="col-span-3">
                <Meter value={p.brokerImpact} max={max} tone={p.brokerImpact < 0 ? "down" : "up"} height={4} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2.5 pb-1">
          <MiniStat label="Negative balance (worst)" value={c.worst ? compactMoney(c.worst.negativeBalance) : "—"} sub="Written off under NBP" />
          <MiniStat label="Client P&L (worst)" value={c.worst ? compactMoney(c.worst.clientPnl) : "—"} sub={c.worst ? `${c.worst.stopOuts} stop-outs` : "No positions"} />
        </div>
      </div>
      <div className="mt-4 rounded-b-[20px] border-t border-line bg-surface-2/80 px-6 py-3 text-[11.5px] text-fg-3 dark:bg-black/20">
        {c.updatedAt ? (
          <>
            Set by <span className="text-fg-2">{c.updatedBy}</span> · {formatDateTime(c.updatedAt)}
            {c.reason && <> · “{c.reason}”</>}
          </>
        ) : (
          "No broker capital recorded yet"
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Exposure                                                            */
/* ------------------------------------------------------------------ */

function ExposureCard({ r }: { r: RiskReport }) {
  const [view, setView] = React.useState<"usd" | "lots">("usd");
  const [book, setBook] = React.useState<"all" | "B">("all");
  const rows = r.bySymbol.slice(0, 12);
  const val = (s: ExposureRow) => (view === "lots" ? s.netLots : book === "B" ? s.bbookNetUsd : s.netUsd);
  const max = Math.max(1, ...rows.map((s) => Math.abs(val(s))));
  return (
    <Card className="h-full">
      <CardHeader
        title="Net client exposure by symbol"
        subtitle="◂ clients net short · net long ▸ · the B-book carries the opposite side"
        icon={<Layers />}
        action={
          <>
            <Segmented size="xs" value={book} onChange={setBook} options={[{ value: "all", label: "All books" }, { value: "B", label: "B-book" }]} />
            <Segmented size="xs" value={view} onChange={setView} options={[{ value: "usd", label: "USD" }, { value: "lots", label: "Lots" }]} />
            <Link href="/trading/exposure">
              <Button size="sm" variant="surface">
                Desk
              </Button>
            </Link>
          </>
        }
      />
      <div className="mt-4 overflow-x-auto px-4 pb-5 sm:px-6">
        {rows.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-fg-3">No open positions on live accounts.</div>
        ) : (
          <div className="min-w-[620px] divide-y divide-line">
            {rows.map((s) => {
              const v = val(s);
              return (
                <div key={s.symbol} className="grid grid-cols-[1.3fr_2fr_0.9fr_0.8fr_0.9fr] items-center gap-4 py-2.5">
                  <SymbolCell symbol={s.symbol!} size={24} sub={<span className="text-[11px] text-fg-3">{s.positions} pos · {s.accounts} acc</span>} />
                  <div>
                    <DivergingBar value={v} max={max} />
                    <div className="k-num mt-1 flex justify-between text-[10.5px] text-fg-3">
                      <span>{formatNumber(s.shortLots, 2)} short</span>
                      <span>{formatNumber(s.longLots, 2)} long</span>
                    </div>
                  </div>
                  <span className={cn("k-num text-right text-[13px] font-medium", v > 0 ? "text-up" : v < 0 ? "text-down" : "text-fg-2")}>{view === "lots" ? formatNumber(v, 2) : compactMoney(v)}</span>
                  <span className="k-num text-right text-[12px] text-fg-3">{pct1(s.bbookSharePct)} B</span>
                  <Money value={s.bbookFloating} decimals={0} signed tone="auto" countUp={false} className="text-right text-[12.5px]" />
                </div>
              );
            })}
            <div className="grid grid-cols-[1.3fr_2fr_0.9fr_0.8fr_0.9fr] gap-4 pt-2.5 text-[10.5px] uppercase tracking-wider text-fg-3">
              <span>Symbol</span>
              <span className="text-center">Net {view === "lots" ? "lots" : "notional"}</span>
              <span className="text-right">Net</span>
              <span className="text-right">B-book share</span>
              <span className="text-right">Book P&amp;L</span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function ClassCard({ r }: { r: RiskReport }) {
  const rows = r.byClass;
  const gross = Math.max(1, ...rows.map((c) => c.grossUsd));
  return (
    <Card className="h-full">
      <CardHeader title="By asset class" subtitle="Gross notional, net direction and B-book floating" icon={<Target />} />
      <div className="mt-4 space-y-2.5 px-4 pb-5 sm:px-6">
        {rows.length === 0 && <div className="py-6 text-center text-[13px] text-fg-3">No open positions.</div>}
        {rows.map((c, i) => (
          <div key={c.class} className="k-row px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-medium">{CLASS_LABEL[c.class] ?? c.class}</span>
              <span className="k-num text-[12px] text-fg-2">{compactMoney(c.grossUsd)} gross</span>
            </div>
            <div className="mt-2">
              <Meter value={c.grossUsd} max={gross} tone={i === 0 ? "ember" : "gold"} delay={i * 0.05} />
            </div>
            <div className="k-num mt-2 grid grid-cols-3 gap-2 text-[11.5px] text-fg-3">
              <span>
                Net <span className={c.netUsd >= 0 ? "text-up" : "text-down"}>{compactMoney(c.netUsd)}</span>
              </span>
              <span className="text-center">B {pct1(c.bbookSharePct)}</span>
              <span className="text-right">
                Book <span className={c.bbookFloating >= 0 ? "text-up" : "text-down"}>{compactMoney(c.bbookFloating)}</span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function MarginCard({ r }: { r: RiskReport }) {
  const color: Record<string, string> = { healthy: "var(--k-up)", watch: "var(--k-gold)", nearStopOut: "var(--k-warn)", critical: "var(--k-down)" };
  const short: Record<string, string> = { healthy: "≥ 200 %", watch: "100–200 %", nearStopOut: "50–100 %", critical: "< 50 %" };
  return (
    <Card className="h-full">
      <CardHeader title="Margin levels" subtitle={`${formatNumber(r.marginLevels.accounts, 0)} accounts using margin · stop-out by group (usually 50 %)`} icon={<Gauge />} />
      <div className="px-4 pb-2 pt-6 sm:px-6">
        <CountBars
          height={150}
          rows={[...r.marginLevels.buckets].reverse().map((b) => ({ key: b.key, label: short[b.key] ?? b.label, value: b.accounts, color: color[b.key] ?? "var(--k-fg-3)", hint: <span className="k-num">{b.label} · equity {compactMoney(b.equity)} · floating {compactMoney(b.floating)}</span> }))}
        />
      </div>
      <div className="space-y-1.5 px-4 pb-5 sm:px-6">
        {[...r.marginLevels.buckets].reverse().map((b) => (
          <div key={b.key} className="k-row flex items-center gap-3 px-3.5 py-2 text-[12.5px]">
            <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: color[b.key] ?? "var(--k-fg-3)" }} />
            <span className="min-w-0 flex-1 truncate text-fg-2">{b.label}</span>
            <span className="k-num w-10 text-right text-fg">{formatNumber(b.accounts, 0)}</span>
            <span className="k-num w-20 text-right text-fg-3">{compactMoney(b.equity)}</span>
            <span className={cn("k-num w-16 text-right", b.floating > 0 ? "text-up" : b.floating < 0 ? "text-down" : "text-fg-3")}>{compactMoney(b.floating)}</span>
          </div>
        ))}
        <div className="flex justify-end gap-3 pr-3.5 text-[10.5px] uppercase tracking-wider text-fg-3">
          <span className="w-10 text-right">Acc.</span>
          <span className="w-20 text-right">Equity</span>
          <span className="w-16 text-right">Floating</span>
        </div>
      </div>
    </Card>
  );
}

function ConcentrationCard({ r }: { r: RiskReport }) {
  const c = r.concentration;
  return (
    <Card className="h-full">
      <CardHeader title="Concentration" subtitle={`${formatNumber(c.accounts, 0)} accounts with open positions`} icon={<Target />} />
      <div className="space-y-3 px-4 pt-4 sm:px-6">
        {(
          [
            ["Top 10 accounts' share of exposure", c.top10GrossPct, "ember"],
            ["Top 10 accounts' share of B-book floating", c.top10FloatingPct, "gold"],
            ["Largest symbol's share of exposure", c.topSymbolPct, "info"],
          ] as const
        ).map(([l, v, tone]) => (
          <div key={l}>
            <div className="flex items-center justify-between text-[12.5px]">
              <span className="text-fg-2">{l}</span>
              <span className="k-num font-medium">{pct1(v)}</span>
            </div>
            <Meter value={v} max={100} tone={tone} className="mt-1.5" />
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-1.5 px-4 pb-5 sm:px-6">
        {c.topAccounts.slice(0, 5).map((a) => (
          <Link key={a.login} href={`/clients/${a.userId}`} className="k-row flex items-center gap-3 px-3.5 py-2 transition-colors hover:bg-surface-2">
            <div className="min-w-0 flex-1">
              <ClientCell name={a.name} userId={a.userId} country={a.country} logins={[a.login]} />
            </div>
            <div className="text-right">
              <div className="k-num text-[12.5px] font-medium">{compactMoney(a.grossUsd ?? 0)}</div>
              <div className="k-num text-[11px] text-fg-3">{pct1(a.sharePct ?? 0)}</div>
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}

function levelTone(level: number | null, stopOut: number): "down" | "warn" | "gold" | "up" {
  if (level === null) return "up";
  if (level <= stopOut) return "down";
  if (level < 100) return "warn";
  if (level < 200) return "gold";
  return "up";
}

function AtRiskCard({ r }: { r: RiskReport }) {
  const cols: Column<RiskAccount>[] = [
    { key: "client", header: "Account", cell: (a) => <ClientCell name={a.name} userId={a.userId} country={a.country} logins={[a.login]} sub={a.group} />, csv: (a) => a.login },
    {
      key: "level",
      header: "Margin level",
      align: "right",
      sort: (a) => a.marginLevel ?? 1e9,
      csv: (a) => a.marginLevel ?? "",
      cell: (a) => (
        <Chip size="sm" tone={levelTone(a.marginLevel, a.stopOutLevel)}>
          {a.marginLevel === null ? "—" : `${a.marginLevel.toFixed(1)}%`}
        </Chip>
      ),
    },
    { key: "so", header: "Stop-out", align: "right", hideOn: "md", cell: (a) => <span className="k-num text-[12.5px] text-fg-3">{a.stopOutLevel}%</span>, csv: (a) => a.stopOutLevel },
    { key: "equity", header: "Equity", align: "right", sort: (a) => a.equity, csv: (a) => a.equity, cell: (a) => <Money value={a.equity} decimals={0} countUp={false} tone={a.equity < 0 ? "down" : undefined} className="text-[13px]" /> },
    { key: "margin", header: "Margin", align: "right", sort: (a) => a.margin, csv: (a) => a.margin, hideOn: "sm", cell: (a) => <Money value={a.margin} decimals={0} countUp={false} className="text-[12.5px] text-fg-2" /> },
    { key: "floating", header: "Floating", align: "right", sort: (a) => a.floating, csv: (a) => a.floating, hideOn: "md", cell: (a) => <Money value={a.floating} decimals={0} signed tone="auto" countUp={false} className="text-[12.5px]" /> },
    { key: "loss", header: "Loss to stop-out", align: "right", sort: (a) => a.lossToStopOut ?? 0, csv: (a) => a.lossToStopOut ?? "", hideOn: "lg", cell: (a) => <span className="k-num text-[12.5px] text-fg-2">{a.lossToStopOut === null ? "—" : compactMoney(a.lossToStopOut)}</span> },
    { key: "credit", header: "Credit", align: "right", sort: (a) => a.credit, csv: (a) => a.credit, hideOn: "xl", cell: (a) => <span className="k-num text-[12.5px] text-fg-3">{a.credit ? compactMoney(a.credit) : "—"}</span> },
    {
      key: "act",
      header: "",
      align: "right",
      cell: (a) => (
        <Link href={`/trading/accounts?login=${a.login}`} onClick={(e) => e.stopPropagation()}>
          <Button size="xs" variant={a.marginLevel !== null && a.marginLevel < 100 ? "down-outline" : "ghost"}>
            Open
          </Button>
        </Link>
      ),
    },
  ];
  return (
    <Card>
      <CardHeader title="Accounts at risk" subtitle="Margin level at or below 150 % (or the group's margin call level) · lowest first" icon={<AlertTriangle />} />
      <div className="mt-4 px-4 pb-5 sm:px-6">
        <DataTable columns={cols} rows={r.atRisk} pageSize={8} search={(a) => `${a.name} ${a.login} ${a.group}`} exportName="accounts-at-risk" rowKey={(a) => String(a.login)} empty={<div className="py-8 text-center text-[13px] text-fg-3">No account is close to its margin call.</div>} />
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Scenario builder                                                    */
/* ------------------------------------------------------------------ */

type Draft = { id: number; scope: ShockScope; target: string; pct: string };

function ShockRow({ d, onChange, onRemove, symbols }: { d: Draft; onChange: (p: Partial<Draft>) => void; onRemove: () => void; symbols: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select value={d.scope} onChange={(e) => onChange({ scope: e.target.value as ShockScope, target: e.target.value === "assetClass" ? "crypto" : e.target.value === "symbol" ? (symbols[0] ?? "EURUSD") : "" })} className={cn(SELECT, "w-[140px]")}>
        <option value="all">All symbols</option>
        <option value="assetClass">Asset class</option>
        <option value="symbol">Symbol</option>
      </select>
      {d.scope === "assetClass" && (
        <select value={d.target} onChange={(e) => onChange({ target: e.target.value })} className={cn(SELECT, "w-[140px]")}>
          {BA_CLASSES.map((c) => (
            <option key={c} value={c}>
              {CLASS_LABEL[c]}
            </option>
          ))}
        </select>
      )}
      {d.scope === "symbol" && (
        <>
          <input list="ba-symbols" value={d.target} onChange={(e) => onChange({ target: e.target.value.toUpperCase().replace(/[^A-Z0-9._#-]/g, "").slice(0, 32) })} className={cn(SELECT, "w-[140px] font-mono")} placeholder="EURUSD" />
        </>
      )}
      <Input value={d.pct} onChange={(e) => onChange({ pct: e.target.value.replace(/[^\d.-]/g, "").slice(0, 7) })} trailing="%" className="h-10 w-[110px]" inputClassName="k-num text-right" aria-label="Price change" />
      <IconButton aria-label="Remove shock" onClick={onRemove} size="sm">
        <Trash2 />
      </IconButton>
    </div>
  );
}

function ScenarioCard({ r, run, initial }: { r: RiskReport; run: RiskActions["runScenario"]; initial?: ScenarioResult | null }) {
  const [mode, setMode] = React.useState<string>(initial?.preset ?? "pm3");
  const [drafts, setDrafts] = React.useState<Draft[]>([
    { id: 1, scope: "assetClass", target: "crypto", pct: "-15" },
    { id: 2, scope: "symbol", target: r.bySymbol[0]?.symbol ?? "XAUUSD", pct: "-3" },
  ]);
  const [busy, setBusy] = React.useState(false);
  const [res, setRes] = React.useState<ScenarioResult | null>(initial ?? null);
  const symbols = r.bySymbol.map((s) => s.symbol!);
  const shocks: ShockInput[] = drafts.map((d) => ({ scope: d.scope, target: d.scope === "all" ? undefined : d.target, pct: Number(d.pct) }));
  const validCustom = shocks.length > 0 && shocks.every((s) => Number.isFinite(s.pct) && s.pct >= -90 && s.pct <= 200 && (s.scope === "all" || !!s.target));
  const go = async () => {
    setBusy(true);
    try {
      setRes(await run(mode === "custom" ? { shocks } : { preset: mode }));
    } catch (e) {
      toast.error("The scenario couldn't run", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };
  const t = res?.totals;
  const cols: Column<ScenarioAccount>[] = [
    { key: "client", header: "Account", cell: (a) => <ClientCell name={a.name} userId={a.userId} country={a.country} logins={[a.login]} sub={a.group} />, csv: (a) => a.login },
    { key: "pnl", header: "Client P&L", align: "right", sort: (a) => a.clientPnl, csv: (a) => a.clientPnl, cell: (a) => <Money value={a.clientPnl} decimals={0} signed tone="auto" countUp={false} className="text-[13px] font-medium" /> },
    {
      key: "eq",
      header: "Equity",
      align: "right",
      sort: (a) => a.equityAfter,
      csv: (a) => a.equityAfter,
      hideOn: "sm",
      cell: (a) => (
        <span className="k-num text-[12.5px] text-fg-2">
          {compactMoney(a.equityBefore)} → <span className={a.equityAfter < 0 ? "text-down" : "text-fg"}>{compactMoney(a.equityAfter)}</span>
        </span>
      ),
    },
    {
      key: "ml",
      header: "Margin level",
      align: "right",
      sort: (a) => a.marginLevelAfter ?? 1e9,
      csv: (a) => a.marginLevelAfter ?? "",
      hideOn: "md",
      cell: (a) => (
        <span className="k-num text-[12.5px] text-fg-3">
          {a.marginLevelBefore === null ? "—" : `${a.marginLevelBefore.toFixed(0)}%`} →{" "}
          <span className={cn(levelTone(a.marginLevelAfter, a.stopOutLevel) === "down" ? "text-down" : levelTone(a.marginLevelAfter, a.stopOutLevel) === "warn" ? "text-warn" : "text-fg")}>{a.marginLevelAfter === null ? "—" : `${a.marginLevelAfter.toFixed(0)}%`}</span>
        </span>
      ),
    },
    {
      key: "state",
      header: "Outcome",
      cell: (a) =>
        a.stopOut ? (
          <Chip size="sm" tone="down">
            Stop-out{a.negativeBalance > 0 ? ` · −${compactMoney(a.negativeBalance)}` : ""}
          </Chip>
        ) : a.marginCall ? (
          <Chip size="sm" tone="warn">
            Margin call
          </Chip>
        ) : (
          <Chip size="sm">Holds</Chip>
        ),
      csv: (a) => (a.stopOut ? "stop-out" : a.marginCall ? "margin call" : "holds"),
    },
    { key: "impact", header: "Broker impact", align: "right", sort: (a) => a.brokerImpact, csv: (a) => a.brokerImpact, hideOn: "lg", cell: (a) => <Money value={a.brokerImpact} decimals={0} signed tone="auto" countUp={false} className="text-[12.5px]" /> },
  ];
  return (
    <Card>
      <CardHeader
        title="What-if scenarios"
        subtitle="Instant price gaps on every open position · stop-outs at the shocked price · negative balances written off"
        icon={<Zap />}
        action={
          <Segmented
            size="xs"
            value={mode}
            onChange={setMode}
            options={[...BA_PRESETS.map((p) => ({ value: p.key as string, label: p.key === "flash" ? "Flash crash" : p.label.split(" ")[0]! })), { value: "custom", label: "Custom" }]}
          />
        }
      />
      <div className="px-4 pb-5 pt-4 sm:px-6">
        <div className="rounded-[16px] border border-line bg-surface-2/50 p-4">
          {mode === "custom" ? (
            <div className="space-y-2.5">
              <datalist id="ba-symbols">
                {symbols.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
              {drafts.map((d) => (
                <ShockRow key={d.id} d={d} symbols={symbols} onChange={(p) => setDrafts((all) => all.map((x) => (x.id === d.id ? { ...x, ...p } : x)))} onRemove={() => setDrafts((all) => all.filter((x) => x.id !== d.id))} />
              ))}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button size="sm" variant="ghost" disabled={drafts.length >= 50} onClick={() => setDrafts((all) => [...all, { id: Math.max(0, ...all.map((x) => x.id)) + 1, scope: "all", target: "", pct: "-2" }])}>
                  <Plus /> Add shock
                </Button>
                <span className="text-[11.5px] text-fg-3">A symbol shock wins over its asset class, which wins over “All symbols”. −90 % to +200 %.</span>
              </div>
            </div>
          ) : (
            <div className="text-[13px] text-fg-2">
              {mode === "flash" ? (
                <>
                  <span className="font-medium text-fg">Flash crash:</span> crypto −20 %, stocks −10 %, indices −7 %, energies −8 %, metals −4 %, forex −2 % (base vs quote).
                </>
              ) : (
                <>
                  <span className="font-medium text-fg">{BA_PRESETS.find((p) => p.key === mode)?.label}:</span> runs every symbol up and down and keeps the direction that hurts the broker most.
                </>
              )}
            </div>
          )}
          <div className="mt-3 flex justify-end">
            <Button variant="ember" size="md" onClick={go} disabled={busy || (mode === "custom" && !validCustom)}>
              <Play /> {busy ? "Running…" : "Run scenario"}
            </Button>
          </div>
        </div>

        {res && t && (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-fg-2">
              <Chip tone="ember">{res.label}</Chip>
              {res.direction !== "custom" && res.preset !== "flash" && <Chip size="sm">worse direction: {res.direction}</Chip>}
              {res.legs.length > 1 &&
                res.legs.map((l) => (
                  <span key={l.direction} className="k-num text-fg-3">
                    {l.direction}: {compactMoney(l.brokerImpact)}
                  </span>
                ))}
              <span className="ml-auto text-[11.5px] text-fg-3">As of {formatDateTime(res.asOf, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
              <MiniStat label="Broker impact" value={<Money value={t.brokerImpact} decimals={0} signed tone="auto" countUp={false} />} sub={`B-book ${compactMoney(t.bbookPnl)} · uncollectible ${compactMoney(-t.uncollectible)}`} />
              <MiniStat label="Client P&L" value={<Money value={t.clientPnl} decimals={0} signed tone="auto" countUp={false} />} sub={`A ${compactMoney(t.clientPnlA)} · B ${compactMoney(t.clientPnlB)}`} />
              <MiniStat label="Stop-outs" value={<span className={t.stopOuts ? "text-down" : undefined}>{formatNumber(t.stopOuts, 0)}</span>} sub={`${formatNumber(t.marginCalls, 0)} margin calls`} />
              <MiniStat label="Negative balance" value={compactMoney(t.negativeBalance)} sub={`${formatNumber(t.negativeAccounts, 0)} accounts · credit used ${compactMoney(t.creditUsed)}`} />
              <MiniStat label="Client equity" value={compactMoney(t.equityAfter)} sub={`from ${compactMoney(t.equityBefore)}`} />
              <MiniStat
                label="Capital after"
                value={t.capitalAfter === null ? "Not set" : <Money value={t.capitalAfter} decimals={0} countUp={false} tone={t.capitalAfter < 0 ? "down" : undefined} />}
                sub={t.capitalAfterPct === null ? "Set the broker capital" : `${t.capitalAfterPct.toFixed(1)}% of capital${t.coverage !== null ? ` · ${t.coverage.toFixed(2)}× cover` : ""}`}
              />
            </div>
            {res.bySymbol.length > 0 && (
              <div className="overflow-x-auto">
                <div className="flex min-w-max gap-2">
                  {res.bySymbol.slice(0, 10).map((s) => (
                    <div key={s.symbol} className="k-row min-w-[150px] px-3.5 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[12px] font-medium">{s.symbol}</span>
                        <span className={cn("k-num text-[11.5px]", s.pct < 0 ? "text-down" : "text-up")}>{s.pct > 0 ? "+" : ""}{s.pct}%</span>
                      </div>
                      <div className="mt-1 text-[11px] text-fg-3">Book</div>
                      <Money value={s.bbookPnl} decimals={0} signed tone="auto" countUp={false} className="text-[14px] font-semibold" />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <DataTable columns={cols} rows={res.accounts} pageSize={8} search={(a) => `${a.name} ${a.login}`} exportName={`scenario-${res.preset ?? "custom"}`} rowKey={(a) => String(a.login)} empty={<div className="py-8 text-center text-[13px] text-fg-3">No account is affected by these shocks.</div>} />
          </div>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* View                                                                */
/* ------------------------------------------------------------------ */

export function RiskView({ r, loading, actions, act, scenario }: { r: RiskReport; loading?: boolean; actions?: React.ReactNode; act: RiskActions; scenario?: ScenarioResult | null }) {
  const canSet = useCan("reports.export");
  const [capOpen, setCapOpen] = React.useState(false);
  const t = r.totals;
  const near = r.marginLevels.buckets.filter((b) => b.key === "nearStopOut" || b.key === "critical").reduce((a, b) => a + b.accounts, 0);
  return (
    <div className="pb-16">
      <PageHeader title="Broker risk" subtitle={`Live client exposure, B-book floating P&L, margin levels and capital strength · live accounts · USD · as of ${formatDateTime(r.asOf, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`} actions={actions} />
      <div className={cn("transition-opacity", loading && "opacity-60")}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="B-book floating P&L"
            icon={<Wallet />}
            value={<Money value={t.bbookFloating} decimals={0} signed tone="auto" />}
            footer={<span className="flex items-center gap-1.5 text-[11.5px] text-fg-3">Clients <Money value={t.clientFloating} decimals={0} signed tone="auto" countUp={false} className="font-medium" /></span>}
            href="/trading/exposure"
          />
          <KpiCard
            label="Net client exposure"
            icon={<Layers />}
            value={<span className={cn("k-num", t.netUsd >= 0 ? "text-up" : "text-down")}>{compactMoney(t.netUsd)}</span>}
            footer={<span className="text-[11.5px] text-fg-3">Gross {compactMoney(t.grossUsd)} · B-book {pct1(t.bbookSharePct)}</span>}
            delay={0.05}
          />
          <KpiCard
            label="Accounts at risk"
            icon={<ShieldAlert />}
            value={<span className={cn("k-num", t.atRisk ? "text-warn" : undefined)}>{formatNumber(t.atRisk, 0)}</span>}
            footer={<span className="text-[11.5px] text-fg-3">{formatNumber(near, 0)} below 100 % · margin level ≤ 150 %</span>}
            delay={0.08}
          />
          <KpiCard
            label="Client equity"
            icon={<ShieldCheck />}
            value={<Money value={t.equity} decimals={0} />}
            footer={<span className="text-[11.5px] text-fg-3">{formatNumber(t.withPositions, 0)} of {formatNumber(t.accounts, 0)} accounts trading · level {t.marginLevel === null ? "—" : `${formatNumber(t.marginLevel, 0)}%`}</span>}
            delay={0.11}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Reveal delay={0.08} className="xl:col-span-5">
            <CapitalCard r={r} canSet={canSet} onSet={() => setCapOpen(true)} />
          </Reveal>
          <Reveal delay={0.12} className="xl:col-span-7">
            <ExposureCard r={r} />
          </Reveal>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <Reveal delay={0.08}>
            <MarginCard r={r} />
          </Reveal>
          <Reveal delay={0.1}>
            <ClassCard r={r} />
          </Reveal>
          <Reveal delay={0.12} className="lg:col-span-2 xl:col-span-1">
            <ConcentrationCard r={r} />
          </Reveal>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
          <MiniStat label="Client balance" value={compactMoney(t.balance)} sub={`Free margin ${compactMoney(t.freeMargin)}`} />
          <MiniStat label="Margin in use" value={compactMoney(t.margin)} sub={`${formatNumber(t.positions, 0)} open positions`} />
          <MiniStat label="Credit + bonus" value={compactMoney(r.credit.credit)} sub={`${formatNumber(r.credit.accounts, 0)} accounts`} />
          <MiniStat label="Credit in use" value={<span className={r.credit.inUse ? "text-warn" : undefined}>{compactMoney(r.credit.inUse)}</span>} sub={`${formatNumber(r.credit.inUseAccounts, 0)} accounts trading on credit`} />
          <MiniStat label="Negative balances" value={<span className={r.credit.negativeBalance ? "text-down" : undefined}>{compactMoney(r.credit.negativeBalance)}</span>} sub={`${formatNumber(r.credit.negativeBalanceAccounts, 0)} accounts`} />
          <MiniStat label="Negative equity" value={<span className={r.credit.negativeEquity ? "text-down" : undefined}>{compactMoney(r.credit.negativeEquity)}</span>} sub={`${formatNumber(r.credit.negativeEquityAccounts, 0)} accounts · NBP exposure`} />
        </div>

        <Reveal delay={0.08} className="mt-4">
          <AtRiskCard r={r} />
        </Reveal>

        <Reveal delay={0.1} className="mt-4">
          <ScenarioCard r={r} run={act.runScenario} initial={scenario} />
        </Reveal>
      </div>
      <CapitalDialog open={capOpen} onOpenChange={setCapOpen} current={r.capital.amount} onSave={act.setCapital} />
    </div>
  );
}

/** Live builds: the reports service (the snapshot is read from the trading engine on every load). */
export function LiveRisk() {
  const { data, error, loading, reload } = useReport<RiskReport>("risk");
  const today = isoDay(new Date());
  const act: RiskActions = {
    runScenario: (body) => reportsApi<ScenarioResult>("scenarios", { method: "POST", body }),
    setCapital: async (amount, reason) => {
      await reportsApi("settings/capital", { method: "PUT", body: { amount, reason } });
      reload();
    },
  };
  const actions = (
    <>
      <Button variant="ghost" size="md" onClick={reload} disabled={loading}>
        <RefreshCw className={cn(loading && "animate-spin")} /> Refresh
      </Button>
      <ExportMenu report="risk" name="Broker risk" from={today} to={addDays(today, 1)} />
    </>
  );
  if (loading && !data)
    return (
      <div className="pb-16">
        <PageHeader title="Broker risk" subtitle="Live exposure from the trading engine" actions={actions} />
        <ReportLoading />
      </div>
    );
  if (error && !data)
    return (
      <div className="pb-16">
        <PageHeader title="Broker risk" subtitle="Live exposure from the trading engine" actions={actions} />
        <ReportFailed message={error} onRetry={reload} />
      </div>
    );
  return data ? <RiskView r={data} loading={loading} actions={actions} act={act} /> : null;
}

/** Demo builds: the mock book. */
export function DemoRisk() {
  const [capital, setCap] = React.useState<CapitalInfo>(BA_CAPITAL);
  const data = React.useMemo(() => baRisk(capital), [capital]);
  // the showcase opens with the ±3 % preset already run
  const first = React.useMemo(() => baScenario({ preset: "pm3" }, BA_CAPITAL.amount), []);
  const act: RiskActions = {
    runScenario: async (body) => baScenario(body, capital.amount),
    setCapital: async (amount, reason) => setCap({ amount, currency: "USD", reason, updatedBy: "You", updatedAt: new Date().toISOString() }),
  };
  const actions = (
    <>
      <Button variant="ghost" size="md" onClick={() => toast.success("Exposure refreshed from the trading engine")}>
        <RefreshCw /> Refresh
      </Button>
      <ExportActions name="Broker risk" />
    </>
  );
  return <RiskView r={data} actions={actions} act={act} scenario={first} />;
}
