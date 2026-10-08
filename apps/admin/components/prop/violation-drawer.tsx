"use client";

import * as React from "react";
import { Ban, CheckCircle2, Globe, RotateCcw } from "lucide-react";
import { Button, Chip, Dialog, EquityChart, KeyValue, cn, type ChipTone } from "@ezymex/ui";
import { ColumnChart, MiniStat, PersonCell } from "@/components/config/kit";
import { COPY_MATCHES, HFT_BUCKETS, LATENCY_POINTS, VIOLATION_LABEL, BANNED_TYPES, equityPath, fmtDateTime, type Violation } from "./data";

export const SEVERITY_TONE: Record<Violation["severity"], ChipTone> = { critical: "down", high: "ember", medium: "warn", low: "neutral" };

/** Feed lag (ms) vs P/L (pips) scatter — latency-arbitrage evidence. */
function LatencyScatter() {
  const W = 480;
  const H = 200;
  const maxLag = 460;
  const minP = -3;
  const maxP = 6;
  const x = (l: number) => 36 + (l / maxLag) * (W - 46);
  const y = (p: number) => 10 + ((maxP - p) / (maxP - minP)) * (H - 34);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <rect x={x(160)} y={10} width={x(maxLag) - x(160)} height={H - 34} fill="var(--k-down-soft)" rx={6} />
      <text x={x(165)} y={24} className="fill-down text-[10px]">stale-quote zone &gt; 160 ms</text>
      <line x1={36} x2={W - 10} y1={y(0)} y2={y(0)} stroke="var(--k-border-top)" strokeDasharray="3 3" />
      {[0, 100, 200, 300, 400].map((l) => (
        <text key={l} x={x(l)} y={H - 8} textAnchor="middle" className="fill-fg-3 font-mono text-[9.5px]">
          {l}ms
        </text>
      ))}
      {[-2, 0, 2, 4, 6].map((p) => (
        <text key={p} x={28} y={y(p) + 3} textAnchor="end" className="fill-fg-3 font-mono text-[9.5px]">
          {p}
        </text>
      ))}
      {LATENCY_POINTS.map((pt, i) => (
        <circle key={i} cx={x(pt.lag)} cy={y(pt.pips)} r={3.2} fill={pt.pips >= 0 ? "var(--k-up)" : "var(--k-down)"} fillOpacity={0.75} />
      ))}
    </svg>
  );
}

function Evidence({ v }: { v: Violation }) {
  if (v.type === "hft")
    return (
      <div>
        <div className="k-label mb-2">Hold-time distribution · last 3 sessions</div>
        <ColumnChart data={HFT_BUCKETS} series={[{ label: "Trades", tone: "down" }]} height={180} />
      </div>
    );
  if (v.type === "latency-arb")
    return (
      <div>
        <div className="k-label mb-2">Feed lag at fill vs result (pips)</div>
        <div className="k-row p-3">
          <LatencyScatter />
        </div>
      </div>
    );
  if (v.type === "copy-accounts" || v.type === "hedge-accounts")
    return (
      <div>
        <div className="k-label mb-2 flex items-center justify-between">
          <span>Matching tickets · {v.login} ↔ 70412893</span>
          <span className="inline-flex items-center gap-1 normal-case tracking-normal text-down">
            <Globe className="size-3" /> Shared IP 185.203.72.14
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[460px] text-[12px]">
            <thead>
              <tr className="text-left text-[10.5px] uppercase tracking-wider text-fg-3">
                <th className="py-2 font-medium">Open</th>
                <th className="font-medium">Symbol</th>
                <th className="font-medium">Side</th>
                <th className="font-medium">Tickets</th>
                <th className="text-right font-medium">Lots</th>
                <th className="text-right font-medium">Δ ms</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {COPY_MATCHES.map((m) => {
                const side = v.type === "hedge-accounts" ? (m.side === "buy" ? "buy / sell" : "sell / buy") : m.side;
                return (
                  <tr key={m.tickets[0]}>
                    <td className="py-2 font-mono text-fg-2">{m.open}</td>
                    <td className="font-medium">{m.symbol}</td>
                    <td>
                      <Chip size="sm" tone={m.side === "buy" ? "up" : "down"}>
                        {side.toUpperCase()}
                      </Chip>
                    </td>
                    <td className="font-mono text-[11px] text-fg-3">
                      {m.tickets[0]} · {m.tickets[1]}
                    </td>
                    <td className="k-num text-right">
                      {m.lots[0]} / {m.lots[1]}
                    </td>
                    <td className={cn("k-num text-right font-medium", m.delta < 200 ? "text-down" : "text-warn")}>{m.delta}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  if (v.type === "daily-loss" || v.type === "max-dd") {
    const data = equityPath(v.login, v.size, v.size * (v.type === "daily-loss" ? 0.948 : 0.94), 18, v.detected - 18 * 86400);
    return (
      <div>
        <div className="k-label mb-2">Equity into the breach</div>
        <EquityChart data={data} height={180} color="down" />
      </div>
    );
  }
  return (
    <KeyValue
      rows={[
        ["Rule", VIOLATION_LABEL[v.type]],
        ["Measured", v.metric],
        ["Threshold", v.type === "consistency" ? "40% of cycle profit" : v.type === "news" ? "No trades ±2 min of red-folder news" : v.type === "weekend" ? "Flat by Fri 23:55" : "No size escalation after losses"],
        ["Engine", "Ezymex Risk · rule v3.4"],
      ]}
    />
  );
}

export function ViolationDrawer({
  v,
  open,
  onOpenChange,
  onConfirm,
  onOverturn,
  onBan,
}: {
  v: Violation | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onConfirm: (v: Violation) => void;
  onOverturn: (v: Violation) => void;
  onBan: (v: Violation) => void;
}) {
  if (!v) return null;
  const banned = BANNED_TYPES.includes(v.type);
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      side="right"
      title={
        <span className="flex items-center gap-2">
          {VIOLATION_LABEL[v.type]}
          <Chip size="sm" tone={SEVERITY_TONE[v.severity]}>
            {v.severity}
          </Chip>
        </span>
      }
      description={`${v.id} · detected ${fmtDateTime(v.detected)} · confidence ${v.confidence}%`}
      footer={
        v.status === "open" ? (
          <>
            <Button size="sm" variant="ghost" onClick={() => onOverturn(v)}>
              <RotateCcw /> Overturn
            </Button>
            {banned && (
              <Button size="sm" variant="down-outline" onClick={() => onBan(v)}>
                <Ban /> Ban trader
              </Button>
            )}
            <Button size="sm" variant="sell" onClick={() => onConfirm(v)}>
              <CheckCircle2 /> Confirm breach
            </Button>
          </>
        ) : (
          <span className="mr-auto text-[12.5px] text-fg-3">Resolved · {v.status}</span>
        )
      }
    >
      <div className="space-y-5">
        <div className="k-row flex items-center justify-between gap-3 px-4 py-3">
          <PersonCell name={v.trader.name} photo={v.trader.photo} country={v.trader.country} sub={<span className="font-mono">{v.login} · {v.accountKind}</span>} />
          <div className="text-right text-[12px]">
            <div className="font-medium">{v.planName}</div>
            <div className="k-num text-fg-3">${v.size.toLocaleString()}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <MiniStat label="Measured" value={v.metric} tone="down" />
          <MiniStat label="Auto-action" value={v.autoAction} tone="warn" />
        </div>
        <p className="rounded-[12px] border border-line bg-surface-2 px-3.5 py-3 text-[13px] text-fg-2">{v.detail}</p>
        <Evidence v={v} />
      </div>
    </Dialog>
  );
}
