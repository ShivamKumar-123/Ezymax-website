"use client";

import * as React from "react";
import { ArrowDownRight, ArrowUpRight, BellRing, Gauge as GaugeIcon, RotateCcw, Save, Scale } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, DivergingBar, Donut, KpiCard, PageHeader, Progress, Reveal, Segmented, SymbolAvatar, SymbolCell, Toggle, cn, formatNumber } from "@ezymex/ui";
import { ASSET_CLASS_LABEL } from "@ezymex/mock";
import { EXPOSURE_GRID, RISK_GROUPS } from "@ezymex/mock/admin-ops";
import { ASSET_CLASS_EXPOSURE, EXPOSURE_LIMITS, type ExposureLimit } from "@ezymex/mock/admin-trading";
import { PnlText, usdCompact } from "@/components/command/kit";
import { useLiveExposure, usageTone } from "@/components/command/overview";
import { IS_DEMO } from "@ezymex/mock/mode";
import { LiveExposurePage } from "@/components/trading-live/exposure";

const CLS_COLORS = ["#e9b949", "#ff5a1f", "#22c55e", "#38bdf8", "#a1a1aa", "#ff8a3d"];

function NumCell({ value, onChange, suffix, w = "w-24" }: { value: number; onChange: (v: number) => void; suffix?: string; w?: string }) {
  return (
    <span className={cn("inline-flex h-8 items-center gap-1 rounded-[10px] border border-line bg-surface-2 px-2 focus-within:border-ember/50", w)}>
      <input
        value={formatNumber(value, 0)}
        onChange={(e) => onChange(Number(e.target.value.replace(/[^0-9.]/g, "")) || 0)}
        className="k-num min-w-0 flex-1 bg-transparent text-right font-mono text-[12.5px] outline-none"
      />
      {suffix && <span className="text-[11px] text-fg-3">{suffix}</span>}
    </span>
  );
}

export default function ExposurePage() {
  return IS_DEMO ? <DemoExposurePage /> : <LiveExposurePage />;
}

function DemoExposurePage() {
  const rows = useLiveExposure();
  const [view, setView] = React.useState<"usd" | "lots">("usd");
  const [limits, setLimits] = React.useState<ExposureLimit[]>(EXPOSURE_LIMITS);
  const [dirty, setDirty] = React.useState(false);
  const gross = rows.reduce((s, r) => s + Math.abs(r.netUsd), 0);
  const long = rows.filter((r) => r.netUsd > 0).reduce((s, r) => s + r.netUsd, 0);
  const short = rows.filter((r) => r.netUsd < 0).reduce((s, r) => s + r.netUsd, 0);
  const book = rows.reduce((s, r) => s + r.bookPnl, 0);
  const maxNet = Math.max(...rows.map((r) => Math.abs(view === "usd" ? r.netUsd : r.net)));
  const groupNet = RISK_GROUPS.map((g, k) => ({ g, v: EXPOSURE_GRID.reduce((s, r) => s + r.cells[k]!, 0) }));
  const groupMax = Math.max(...groupNet.map((x) => Math.abs(x.v)));
  const upd = (sym: string, p: Partial<ExposureLimit>) => {
    setLimits((xs) => xs.map((x) => (x.symbol === sym ? { ...x, ...p } : x)));
    setDirty(true);
  };

  return (
    <div className="pb-10">
      <PageHeader
        title="Exposure"
        subtitle="Net B-book exposure by symbol, group and asset class — with limits and alert thresholds."
        actions={<Segmented size="md" value={view} onChange={setView} options={[{ value: "usd", label: "Net USD" }, { value: "lots", label: "Net lots" }]} />}
      />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard label="Gross exposure" icon={<Scale />} value={<span className="k-num">{usdCompact(gross, 1)}</span>} chip="8 symbols" />
        <KpiCard label="Net long" icon={<ArrowUpRight />} value={<span className="k-num text-up">{usdCompact(long, 1)}</span>} chip="Clients long → book short" chipTone="up" delay={0.04} />
        <KpiCard label="Net short" icon={<ArrowDownRight />} value={<span className="k-num text-down">{usdCompact(short, 1)}</span>} chip="Clients short → book long" chipTone="down" delay={0.08} />
        <KpiCard label="Book floating" icon={<GaugeIcon />} value={<PnlText value={book} />} hot chip="Live" chipTone="ember" delay={0.12} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.08} className="xl:col-span-8">
          <Card className="h-full">
            <CardHeader title="By symbol" subtitle="Diverging bars: left = clients net short, right = net long" />
            <div className="mt-4 space-y-1.5 px-4 pb-5 sm:px-6">
              {rows.map((r) => {
                const tone = usageTone(r.usage);
                return (
                  <div key={r.symbol} className="k-row grid grid-cols-[150px_1fr_110px_110px_150px] items-center gap-4 px-4 py-2.5 max-lg:grid-cols-[130px_1fr_100px]">
                    <SymbolCell symbol={r.symbol} size={24} sub={`${formatNumber(r.buyLots, 1)} / ${formatNumber(r.sellLots, 1)} lots`} />
                    <DivergingBar value={view === "usd" ? r.netUsd : r.net} max={maxNet} />
                    <span className={cn("k-num text-right font-mono text-[12.5px] font-medium", r.net >= 0 ? "text-up" : "text-down")}>{view === "usd" ? usdCompact(r.netUsd) : `${r.net >= 0 ? "+" : ""}${formatNumber(r.net, 1)}`}</span>
                    <PnlText value={r.bookPnl} className="text-right font-mono text-[12.5px] max-lg:hidden" />
                    <div className="flex items-center gap-2 max-lg:hidden">
                      <Progress value={r.usage} tone={tone} className="flex-1" />
                      <span className={cn("k-num w-9 text-right text-[11.5px]", tone === "down" ? "text-down" : tone === "warn" ? "text-warn" : "text-fg-2")}>{Math.round(r.usage)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </Reveal>
        <div className="space-y-4 xl:col-span-4">
          <Reveal delay={0.12}>
            <Card>
              <CardHeader title="By asset class" subtitle="Gross notional share" />
              <div className="flex items-center gap-5 px-6 pb-5 pt-4">
                <Donut
                  size={140}
                  thickness={16}
                  data={ASSET_CLASS_EXPOSURE.map((a, i) => ({ label: a.cls, value: a.grossUsd, color: CLS_COLORS[i] }))}
                  center={
                    <div>
                      <div className="k-num text-[15px] font-semibold">{usdCompact(ASSET_CLASS_EXPOSURE.reduce((s, a) => s + a.grossUsd, 0), 0)}</div>
                      <div className="text-[10px] text-fg-3">gross</div>
                    </div>
                  }
                />
                <div className="flex-1 space-y-1.5">
                  {ASSET_CLASS_EXPOSURE.map((a, i) => (
                    <div key={a.cls} className="flex items-center gap-2 text-[12px]">
                      <span className="size-2 rounded-full" style={{ background: CLS_COLORS[i] }} />
                      <span className="flex-1 text-fg-2">{ASSET_CLASS_LABEL[a.cls]}</span>
                      <span className={cn("k-num font-mono", a.netUsd >= 0 ? "text-up" : "text-down")}>{usdCompact(a.netUsd, 1)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </Reveal>
          <Reveal delay={0.16}>
            <Card>
              <CardHeader title="By group" subtitle="Net USD across all symbols" />
              <div className="space-y-2.5 px-6 pb-5 pt-4">
                {groupNet.map((g) => (
                  <div key={g.g} className="grid grid-cols-[70px_1fr_70px] items-center gap-3 text-[12.5px]">
                    <span className="text-fg-2">{g.g}</span>
                    <DivergingBar value={g.v} max={groupMax} />
                    <span className={cn("k-num text-right font-mono", g.v >= 0 ? "text-up" : "text-down")}>{usdCompact(g.v, 1)}</span>
                  </div>
                ))}
              </div>
            </Card>
          </Reveal>
        </div>
      </div>

      <Reveal delay={0.1} className="mt-4">
        <Card>
          <CardHeader
            title="Limits & alert thresholds"
            subtitle="Warn and high alerts fire into the Alerts centre; auto-hedge routes the excess to A-book when an LP is connected."
            icon={<BellRing />}
            action={
              <>
                <Button size="sm" variant="ghost" disabled={!dirty} onClick={() => { setLimits(EXPOSURE_LIMITS); setDirty(false); toast("Changes discarded"); }}>
                  <RotateCcw /> Reset
                </Button>
                <Button size="sm" variant="ember" disabled={!dirty} onClick={() => { setDirty(false); toast.success("Exposure limits saved", { description: "Applied to risk-engine · audit logged" }); }}>
                  <Save /> Save limits
                </Button>
              </>
            }
          />
          <div className="mt-4 overflow-x-auto px-4 pb-5 sm:px-6">
            <table className="w-full min-w-[900px] border-separate border-spacing-0 text-[13px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-[0.05em] text-fg-3">
                  {["Symbol", "Max net lots", "Max notional", "Warn at", "High at", "Auto-hedge", "Current usage", "Enabled"].map((h, i) => (
                    <th key={h} className={cn("border-y border-line bg-surface-2 px-3 py-2.5 font-medium", i === 0 ? "rounded-l-[14px] border-l pl-4 text-left" : "text-right", i === 7 && "rounded-r-[14px] border-r text-center", i === 6 && "text-left")}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {limits.map((l) => {
                  const live = rows.find((r) => r.symbol === l.symbol);
                  const usage = live ? (Math.abs(live.netUsd) / l.maxNotional) * 100 : 18 + (l.symbol.length * 7) % 30;
                  const tone = usage >= l.highPct ? "down" : usage >= l.warnPct ? "warn" : "up";
                  return (
                    <tr key={l.symbol} className={cn("group", !l.enabled && "opacity-50")}>
                      <td className="border-b border-line py-2 pl-4 pr-3">
                        <span className="flex items-center gap-2.5">
                          <SymbolAvatar symbol={l.symbol} size={22} />
                          <span className="font-medium">{l.symbol}</span>
                        </span>
                      </td>
                      <td className="border-b border-line px-3 text-right"><NumCell value={l.maxNetLots} onChange={(v) => upd(l.symbol, { maxNetLots: v })} /></td>
                      <td className="border-b border-line px-3 text-right"><NumCell value={l.maxNotional} onChange={(v) => upd(l.symbol, { maxNotional: v })} suffix="$" w="w-32" /></td>
                      <td className="border-b border-line px-3 text-right"><NumCell value={l.warnPct} onChange={(v) => upd(l.symbol, { warnPct: v })} suffix="%" w="w-20" /></td>
                      <td className="border-b border-line px-3 text-right"><NumCell value={l.highPct} onChange={(v) => upd(l.symbol, { highPct: v })} suffix="%" w="w-20" /></td>
                      <td className="border-b border-line px-3 text-right">
                        <span className="inline-flex">
                          <Segmented size="xs" value={String(l.autoHedgePct)} onChange={(v) => upd(l.symbol, { autoHedgePct: Number(v) })} options={[{ value: "0", label: "Off" }, { value: "25", label: "25%" }, { value: "50", label: "50%" }, { value: "100", label: "100%" }]} />
                        </span>
                      </td>
                      <td className="border-b border-line px-3">
                        <div className="flex items-center gap-2">
                          <Progress value={usage} tone={tone} className="w-28" />
                          <span className={cn("k-num w-10 text-right text-[12px]", tone === "down" ? "text-down" : tone === "warn" ? "text-warn" : "text-fg-2")}>{Math.round(usage)}%</span>
                          {tone !== "up" && <Chip size="sm" tone={tone}>{tone === "down" ? "High" : "Warn"}</Chip>}
                        </div>
                      </td>
                      <td className="border-b border-line px-3 text-center">
                        <Toggle checked={l.enabled} onChange={(v) => upd(l.symbol, { enabled: v })} label={`Limit ${l.symbol}`} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </Reveal>
    </div>
  );
}
