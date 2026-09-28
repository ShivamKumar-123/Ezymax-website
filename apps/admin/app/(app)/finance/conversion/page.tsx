"use client";

import * as React from "react";
import { toast } from "sonner";
import { ArrowRight, Calculator, Coins, Lock, Percent, Pencil, Radio, RefreshCw, TrendingUp } from "lucide-react";
import { Button, Card, CardHeader, Chip, CoinIcon, DataTable, Delta, KpiCard, Money, PageHeader, Reveal, Sparkline, Toggle, cn, type Column } from "@kalks/ui";
import { FIN_RATES, FIN_TXS, finAgo, type FinRate } from "@kalks/mock/admin-finance";

const RECENT = FIN_TXS.filter((t) => t.type === "conversion").slice(0, 4);
import { MiniField, NumInput, Select, auditToast, useReason } from "@/components/config/kit";
import { RateEditor, effRate, rateDigits } from "@/components/finance/rate-editor";
import { Line, LiveDot, num, usd } from "@/components/finance/shared";

export default function ConversionPage() {
  const [rates, setRates] = React.useState<FinRate[]>(FIN_RATES);
  const [editing, setEditing] = React.useState<FinRate | null>(null);
  const [calcCoin, setCalcCoin] = React.useState("btc");
  const [calcAmt, setCalcAmt] = React.useState(0.25);
  const [flash, setFlash] = React.useState<Record<string, "up" | "down">>({});
  const reason = useReason();

  // Live rate ticks (client-only, after mount).
  React.useEffect(() => {
    let clear: ReturnType<typeof setTimeout> | undefined;
    const t = setInterval(() => {
      const f: Record<string, "up" | "down"> = {};
      setRates((list) =>
        list.map((r) => {
          if (r.fixed || Math.random() < 0.4) return r;
          const k = 1 + (Math.random() - 0.5) * 0.0012;
          f[r.coin] = k >= 1 ? "up" : "down";
          return { ...r, rate: +(r.rate * k).toFixed(rateDigits(r.rate) + 1), updatedSec: 0 };
        }),
      );
      setFlash(f);
      clear = setTimeout(() => setFlash({}), 700);
    }, 2000);
    return () => {
      clearInterval(t);
      clearTimeout(clear);
    };
  }, []);

  const vol = rates.reduce((s, r) => s + r.volume24h, 0);
  const revenue = rates.reduce((s, r) => s + r.volume24h * (r.markup / 100), 0);
  const nonUsdt = rates.filter((r) => !r.fixed && r.volume24h > 0);
  const avgMarkup = nonUsdt.reduce((s, r) => s + r.markup * r.volume24h, 0) / Math.max(1, nonUsdt.reduce((s, r) => s + r.volume24h, 0));
  const calc = rates.find((r) => r.coin === calcCoin)!;

  const toggle = (r: FinRate, on: boolean) =>
    reason.ask({
      title: `${on ? "Enable" : "Disable"} ${r.symbol} conversion`,
      description: on ? `${r.symbol} deposits will convert to USD at live rate − ${r.markup}%.` : `${r.symbol} deposits will be held in-coin until re-enabled.`,
      reasons: on ? ["Liquidity restored", "New coin listing", "Volatility normalised"] : ["Extreme volatility", "Price feed degraded", "Liquidity provider outage", "Compliance instruction"],
      confirmLabel: on ? "Enable" : "Disable",
      tone: on ? "buy" : "sell",
      onConfirm: (why) => {
        setRates((list) => list.map((x) => (x.coin === r.coin ? { ...x, enabled: on } : x)));
        auditToast(`${r.symbol} conversion ${on ? "enabled" : "disabled"}`, why);
      },
    });

  const cols: Column<FinRate>[] = [
    {
      key: "coin",
      header: "Coin",
      cell: (r) => (
        <span className={cn("flex items-center gap-3", !r.enabled && "opacity-50")}>
          <CoinIcon coin={r.coin} size={30} />
          <span>
            <span className="flex items-center gap-1.5 text-[13.5px] font-medium">
              {r.symbol}
              {r.fixed && (
                <Chip size="sm" tone="gold">
                  <Lock className="size-2.5" /> 1:1
                </Chip>
              )}
            </span>
            <span className="block text-[11.5px] text-fg-3">{r.network}</span>
          </span>
        </span>
      ),
    },
    {
      key: "rate",
      header: "Live rate",
      align: "right",
      cell: (r) => (
        <div className="whitespace-nowrap">
          <div className={cn("k-num font-mono text-[13px] transition-colors duration-500", flash[r.coin] === "up" ? "text-up" : flash[r.coin] === "down" ? "text-down" : "text-fg")}>{usd(r.rate, rateDigits(r.rate))}</div>
          <div className="mt-0.5">{r.fixed ? <span className="text-[11px] text-fg-3">pegged</span> : <Delta value={r.change24h} className="text-[11px]" />}</div>
        </div>
      ),
      sort: (r) => r.rate,
    },
    { key: "spark", header: "24h", cell: (r) => (r.fixed ? <span className="block h-6 w-20 border-b border-dashed border-fg-3/40" /> : <Sparkline data={r.spark} width={80} height={26} tone={r.change24h >= 0 ? "up" : "down"} />), hideOn: "lg" },
    { key: "markup", header: "Markup", align: "right", cell: (r) => (r.fixed ? <span className="text-fg-3">—</span> : <span className="k-num font-medium text-ember">{r.markup.toFixed(2)}%</span>), sort: (r) => r.markup },
    { key: "eff", header: "Effective", align: "right", cell: (r) => <span className="k-num whitespace-nowrap font-mono text-[13px] font-medium">{usd(effRate(r), rateDigits(r.rate))}</span> },
    { key: "vol", header: "24h volume", align: "right", cell: (r) => <span className="k-num text-fg-2">{r.volume24h ? usd(r.volume24h, 0) : "—"}</span>, sort: (r) => r.volume24h, hideOn: "md" },
    {
      key: "feed",
      header: "Feed",
      cell: (r) => (
        <span className="whitespace-nowrap text-[11.5px] text-fg-3">
          {r.fixed ? "Fixed" : r.source.startsWith("Median") ? "Median ×3" : r.source}
          {!r.fixed && <span className={cn("block", r.updatedSec > r.staleSec * 0.5 ? "text-warn" : "")}>{r.updatedSec}s ago · guard {r.staleSec}s</span>}
        </span>
      ),
      hideOn: "lg",
    },
    { key: "on", header: "On", align: "center", cell: (r) => <span onClick={(e) => e.stopPropagation()}><Toggle checked={r.enabled} onChange={(v) => (r.fixed && !v ? toast.error("USDT conversion cannot be disabled", { description: "It is the settlement asset for the USD wallet." }) : toggle(r, v))} label={`${r.symbol} enabled`} /></span> },
    {
      key: "edit",
      header: "",
      align: "right",
      cell: (r) => (
        <Button size="xs" variant="surface" onClick={(e) => { e.stopPropagation(); setEditing(r); }}>
          <Pencil /> Edit
        </Button>
      ),
    },
  ];

  const gross = calcAmt * calc.rate;
  const net = calcAmt * effRate(calc);

  return (
    <div className="pb-24">
      <PageHeader
        title="Crypto → USD conversion"
        subtitle="Deposits in coins other than USDT convert to the USD wallet at the live rate minus a per-coin markup"
        actions={
          <>
            <Chip tone="up" className="h-9 px-3">
              <LiveDot /> Feeds healthy · Binance · Kraken · CoinGecko
            </Chip>
            <Button variant="surface" onClick={() => toast.success("Rates refreshed from all sources", { description: "Max deviation between sources 0.04%" })}>
              <RefreshCw /> Refresh
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Converted · 24h" icon={<Coins />} value={<Money value={vol} />} chip={`${rates.filter((r) => r.enabled).length} coins enabled`} chipTone="neutral" />
        <KpiCard label="Markup revenue · 24h" icon={<TrendingUp />} value={<Money value={revenue} />} chip="+8.2% vs 7d avg" chipTone="up" hot illustration="money_bag" delay={0.05} />
        <KpiCard label="Avg. markup (non-USDT)" icon={<Percent />} value={<span className="k-num">{avgMarkup.toFixed(2)}<span className="text-fg-3">%</span></span>} chip="Volume-weighted" chipTone="ember" delay={0.1} />
        <KpiCard label="Rate feed" icon={<Radio />} value={<span className="k-num">3<span className="text-fg-3">/3</span></span>} chip="Median deviation 0.04%" chipTone="up" delay={0.15} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.1} className="min-w-0 xl:col-span-8">
          <Card className="h-full">
            <CardHeader title="Conversion rates" subtitle="Live · updates every 2s · click a row to edit" icon={<Coins />} />
            <div className="px-4 pb-5 pt-4 sm:px-6">
              <DataTable columns={cols} rows={rates} rowKey={(r) => r.coin} pageSize={10} dense onRowClick={setEditing} />
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.15} className="min-w-0 xl:col-span-4">
          <Card className="h-full">
            <CardHeader title="Preview calculator" subtitle="What a client deposit credits right now" icon={<Calculator />} />
            <div className="space-y-4 px-6 pb-6 pt-5">
              <div className="grid grid-cols-[1fr_1.2fr] gap-3">
                <MiniField label="Coin">
                  <Select value={calcCoin} onChange={setCalcCoin} options={rates.map((r) => ({ value: r.coin, label: `${r.symbol}${r.enabled ? "" : " (off)"}` }))} />
                </MiniField>
                <MiniField label="Deposit amount">
                  <NumInput value={calcAmt} onChange={setCalcAmt} min={0} step={calc.rate > 100 ? 0.01 : 10} suffix={calc.symbol} />
                </MiniField>
              </div>
              <div className="k-row flex items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-2.5">
                  <CoinIcon coin={calc.coin} size={34} />
                  <div>
                    <div className="k-num text-[16px] font-semibold">
                      {num(calcAmt, calc.rate > 100 ? 4 : 2)} {calc.symbol}
                    </div>
                    <div className="text-[11.5px] text-fg-3">deposit</div>
                  </div>
                </div>
                <ArrowRight className="size-4 text-fg-3" />
                <div className="text-right">
                  <Money value={net} countUp={false} className="text-[20px] font-semibold text-ember" />
                  <div className="text-[11.5px] text-fg-3">USD wallet</div>
                </div>
              </div>
              <div className="divide-y divide-line">
                <Line k="Live rate" v={usd(calc.rate, rateDigits(calc.rate))} />
                <Line k="Gross value" v={usd(gross)} />
                <Line k={`Markup ${calc.fixed ? "(fixed 1:1)" : `${calc.markup.toFixed(2)}%`}`} v={`- ${usd(gross - net)}`} tone="down" />
                <Line k="Credited" v={usd(net)} tone="up" />
                <Line k="Broker revenue" v={usd(gross - net)} />
              </div>
              <div>
                <div className="mb-2 text-[11px] uppercase tracking-wider text-fg-3">Recent conversions</div>
                <div className="space-y-1.5">
                  {RECENT.map((t) => (
                    <div key={t.id} className="flex items-center gap-2.5 rounded-[10px] border border-line bg-surface-2 px-3 py-2 text-[12px]">
                      <CoinIcon coin={t.asset.toLowerCase()} size={18} />
                      <span className="min-w-0 flex-1 truncate text-fg-2">{t.client.person.name}</span>
                      <span className="k-num text-fg-3">{finAgo(t.minutesAgo)}</span>
                      <span className="k-num w-20 text-right font-medium">{usd(t.usd)}</span>
                    </div>
                  ))}
                </div>
              </div>
              {!calc.enabled && <div className="rounded-[12px] border border-warn/25 bg-warn-soft px-3 py-2 text-[12.5px] text-warn">{calc.symbol} conversion is disabled — this deposit would be held in-coin.</div>}
              {calc.enabled && (gross < calc.min || gross > calc.max) && (
                <div className="rounded-[12px] border border-warn/25 bg-warn-soft px-3 py-2 text-[12.5px] text-warn">
                  Outside limits ({usd(calc.min, 0)} – {usd(calc.max, 0)}) — routed to manual review.
                </div>
              )}
            </div>
          </Card>
        </Reveal>
      </div>

      <RateEditor rate={editing} onOpenChange={(o) => !o && setEditing(null)} onSave={(r) => setRates((list) => list.map((x) => (x.coin === r.coin ? { ...x, markup: r.markup, min: r.min, max: r.max, source: r.source, staleSec: r.staleSec, enabled: r.enabled } : x)))} />
      {reason.node}
    </div>
  );
}
