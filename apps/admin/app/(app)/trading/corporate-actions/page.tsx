"use client";

import * as React from "react";
import { IS_DEMO } from "@ezymex/mock/mode";
import { LiveCorporateActions } from "@/components/live/corporate-actions";
import { motion } from "motion/react";
import { CalendarDays, CheckCircle2, Coins, Scissors, TrendingDown, TrendingUp } from "lucide-react";
import { Button, Card, CardHeader, Chip, KpiCard, PageHeader, Reveal, SymbolAvatar, SymbolCell, cn, formatMoney, formatNumber } from "@ezymex/ui";
import { getInstrument } from "@ezymex/mock";
import { ADMIN_NOW } from "@ezymex/mock/admin-clients";
import { CORPORATE_ACTIONS, type CorporateAction } from "@ezymex/mock/admin-trading";
import { ReasonDialog } from "@/components/command/kit";

const DAY = 86_400_000;
const d = (s: string) => new Date(`${s}T12:00:00Z`);
const fmt = (s: string) => d(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

function preview(a: CorporateAction) {
  const price = getInstrument(a.symbol).price;
  if (a.type !== "Split") {
    const longs = a.amount! * a.longQty;
    const shorts = -a.amount! * a.shortQty;
    return { kind: "div" as const, longs, shorts, book: -(longs + shorts), price };
  }
  const [n, m] = a.ratio!.split(":").map(Number) as [number, number];
  const k = n / m;
  return { kind: "split" as const, k, newPrice: price / k, newLong: a.longQty * k, newShort: a.shortQty * k, price };
}

function Timeline({ items, onPick }: { items: CorporateAction[]; onPick: (a: CorporateAction) => void }) {
  const start = ADMIN_NOW - 5 * DAY;
  const end = ADMIN_NOW + 55 * DAY;
  const x = (s: string) => ((d(s).getTime() - start) / (end - start)) * 100;
  const weeks = Array.from({ length: 9 }, (_, i) => start + i * 7 * DAY);
  return (
    <div className="relative mt-2 h-[150px]">
      {weeks.map((w) => (
        <div key={w} className="absolute inset-y-0" style={{ left: `${((w - start) / (end - start)) * 100}%` }}>
          <div className="h-full w-px bg-line" />
          <div className="absolute bottom-0 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] text-fg-3">{new Date(w).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</div>
        </div>
      ))}
      <div className="absolute inset-y-0 w-px bg-ember shadow-[0_0_10px_var(--k-ember)]" style={{ left: `${((ADMIN_NOW - start) / (end - start)) * 100}%` }}>
        <span className="absolute -top-1 -translate-x-1/2 rounded-full bg-ember px-1.5 text-[9.5px] font-semibold text-white">Today</span>
      </div>
      {items.filter((a) => a.status !== "applied").map((a, i) => (
        <motion.button
          key={a.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}
          onClick={() => onPick(a)}
          className={cn("absolute flex -translate-x-1/2 items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 text-[11.5px] backdrop-blur transition-transform hover:scale-105", a.type === "Split" ? "border-info/40 bg-info-soft" : "border-gold/40 bg-gold-soft")}
          style={{ left: `${x(a.exDate)}%`, top: 14 + (i % 3) * 36 }}
        >
          <SymbolAvatar symbol={a.symbol} size={20} />
          <span className="font-medium">{a.symbol}</span>
          <span className="text-fg-2">{a.type === "Split" ? a.ratio : `$${a.amount}`}</span>
        </motion.button>
      ))}
    </div>
  );
}

export default function CorporateActionsPage() {
  return IS_DEMO ? <DemoCorporateActions /> : <LiveCorporateActions />;
}

function DemoCorporateActions() {
  const [items, setItems] = React.useState(CORPORATE_ACTIONS);
  const [sel, setSel] = React.useState<CorporateAction>(CORPORATE_ACTIONS[0]!);
  const [apply, setApply] = React.useState(false);
  const p = preview(sel);
  const upcoming = items.filter((a) => a.status !== "applied");
  return (
    <div className="pb-10">
      <PageHeader title="Corporate actions" subtitle="Dividends and splits on stock CFDs — adjust client positions on the ex-date." />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard label="Upcoming" icon={<CalendarDays />} value={<span className="k-num">{upcoming.length}</span>} chip="Next 60 days" />
        <KpiCard label="Dividends" icon={<Coins />} value={<span className="k-num">{upcoming.filter((a) => a.type !== "Split").length}</span>} chip="AAPL due in 2 days" chipTone="warn" delay={0.04} />
        <KpiCard label="Splits" icon={<Scissors />} value={<span className="k-num">{upcoming.filter((a) => a.type === "Split").length}</span>} chip="NVDA 4:1 · TSLA 3:1" chipTone="info" delay={0.08} />
        <KpiCard label="Positions affected" icon={<CheckCircle2 />} value={<span className="k-num">{upcoming.reduce((s, a) => s + a.longPositions + a.shortPositions, 0)}</span>} chip="long + short" delay={0.12} />
      </div>
      <Reveal delay={0.08} className="mt-4">
        <Card>
          <CardHeader title="Calendar" subtitle="Ex-dates · click an event to preview the adjustment" />
          <div className="px-6 pb-8 pt-2">
            <Timeline items={items} onPick={setSel} />
          </div>
        </Card>
      </Reveal>
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.1} className="xl:col-span-7">
          <Card className="h-full">
            <CardHeader title="Events" />
            <div className="mt-4 space-y-2 px-4 pb-5 sm:px-6">
              {items.map((a) => (
                <button key={a.id} onClick={() => setSel(a)} className={cn("k-row flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-3/60", sel.id === a.id && "border-ember/40 bg-ember-soft", a.status === "applied" && "opacity-60")}>
                  <SymbolCell symbol={a.symbol} size={28} sub={a.id} className="w-40" />
                  <Chip size="sm" tone={a.type === "Split" ? "info" : "gold"}>{a.type}</Chip>
                  <span className="k-num font-mono text-[13px]">{a.type === "Split" ? a.ratio : `$${a.amount!.toFixed(3)} / share`}</span>
                  <span className="text-[12px] text-fg-3">ex {fmt(a.exDate)}{a.payDate ? ` · pay ${fmt(a.payDate)}` : ""}</span>
                  <span className="ml-auto flex items-center gap-3 text-[12px]">
                    <span className="k-num text-up">{a.longPositions} L</span>
                    <span className="k-num text-down">{a.shortPositions} S</span>
                    <Chip size="sm" dot tone={a.status === "applied" ? "up" : a.status === "due" ? "warn" : "neutral"} className="capitalize">{a.status}</Chip>
                  </span>
                </button>
              ))}
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.15} className="xl:col-span-5">
          <Card hot className="h-full overflow-hidden">
            <div className="relative px-6 pb-6 pt-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <SymbolAvatar symbol={sel.symbol} size={38} />
                  <div>
                    <div className="text-[17px] font-medium">{sel.symbol} · {sel.type}</div>
                    <div className="text-[12.5px] text-fg-2">ex-date {fmt(sel.exDate)} · {sel.id}</div>
                  </div>
                </div>
                <Chip tone={sel.status === "applied" ? "up" : "warn"} dot className="capitalize">{sel.status}</Chip>
              </div>
              <div className="mt-5 k-label">Adjustment preview</div>
              {p.kind === "div" ? (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between rounded-[14px] border border-white/10 bg-black/20 px-4 py-3">
                    <span className="flex items-center gap-2 text-[13px]"><TrendingUp className="size-4 text-up" /> Longs credited · {formatNumber(sel.longQty, 0)} shares × ${sel.amount}</span>
                    <span className="k-num font-mono text-up">+{formatMoney(p.longs)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-[14px] border border-white/10 bg-black/20 px-4 py-3">
                    <span className="flex items-center gap-2 text-[13px]"><TrendingDown className="size-4 text-down" /> Shorts debited · {formatNumber(sel.shortQty, 0)} shares × ${sel.amount}</span>
                    <span className="k-num font-mono text-down">{formatMoney(p.shorts)}</span>
                  </div>
                  <div className="flex items-center justify-between px-1 pt-2 text-[13px]">
                    <span className="font-medium">Net book cost</span>
                    <span className={cn("k-num font-mono text-[16px] font-semibold", p.book >= 0 ? "text-up" : "text-down")}>{formatMoney(p.book)}</span>
                  </div>
                  <p className="px-1 text-[11.5px] text-fg-3">Posted as a “Dividend {sel.symbol}” balance line at 00:00 GMT+3 on the ex-date. Swap-free accounts are adjusted the same way.</p>
                </div>
              ) : (
                <div className="mt-3 space-y-2 text-[13px]">
                  {[
                    ["Volume multiplier", `×${p.k}`],
                    ["Reference price", `${formatMoney(p.price)} → ${formatMoney(p.newPrice)}`],
                    ["Long quantity", `${formatNumber(sel.longQty, 0)} → ${formatNumber(p.newLong, 0)}`],
                    ["Short quantity", `${formatNumber(sel.shortQty, 0)} → ${formatNumber(p.newShort, 0)}`],
                    ["Open price, SL, TP, pending orders", `÷ ${p.k}`],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between rounded-[14px] border border-white/10 bg-black/20 px-4 py-2.5">
                      <span className="text-fg-2">{k}</span>
                      <span className="k-num font-mono">{v}</span>
                    </div>
                  ))}
                  <p className="px-1 pt-1 text-[11.5px] text-fg-3">Notional value and floating P&L are unchanged. Max-lot limits for {sel.symbol} are scaled by ×{p.k} automatically.</p>
                </div>
              )}
              <Button className="mt-5 w-full" variant="ember" disabled={sel.status === "applied"} onClick={() => setApply(true)}>
                {sel.status === "applied" ? "Already applied" : `Apply to ${sel.longPositions + sel.shortPositions} positions`}
              </Button>
            </div>
          </Card>
        </Reveal>
      </div>
      <ReasonDialog
        open={apply}
        onOpenChange={setApply}
        title={`Apply ${sel.type.toLowerCase()} · ${sel.symbol}`}
        description={`${sel.longPositions + sel.shortPositions} positions will be adjusted. This cannot be undone without a correcting action.`}
        codes={["CA-01 · Scheduled corporate action", "CA-02 · Correction", "CA-03 · Exchange announcement update"]}
        confirmLabel="Apply adjustment"
        successMessage={`${sel.symbol} ${sel.type.toLowerCase()} applied`}
        onConfirm={() => {
          setItems((xs) => xs.map((x) => (x.id === sel.id ? { ...x, status: "applied" } : x)));
          setSel((s) => ({ ...s, status: "applied" }));
        }}
      />
    </div>
  );
}
