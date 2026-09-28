"use client";

import * as React from "react";
import { CloudDownload, Moon, RotateCcw, Save, Timer } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, PageHeader, Reveal, Segmented, Starfield, SymbolCell, Toggle, cn, formatDateTime, formatMoney } from "@kalks/ui";
import { ASSET_CLASS_LABEL, getInstrument, type AssetClass } from "@kalks/mock";
import { ADMIN_GROUPS, SWAP_SETTINGS, SYMBOL_SPECS, WEEKDAYS, type SymbolSpec, type Weekday } from "@kalks/mock/admin-config";
import { ChipList, MiniField, MiniStat, NumInput, Select, SettingRow, auditToast } from "@/components/config/kit";

type SwapRow = Pick<SymbolSpec, "symbol" | "swapLong" | "swapShort" | "swapType">;

/** USD per 1 lot per night. */
function perNight(r: SwapRow, side: "long" | "short") {
  const inst = getInstrument(r.symbol);
  const v = side === "long" ? r.swapLong : r.swapShort;
  if (r.swapType === "pct") return (inst.price * inst.contractSize * v) / 100 / 360;
  let usd = v * Math.pow(10, -inst.digits) * inst.contractSize;
  if (r.symbol.endsWith("JPY")) usd /= inst.price;
  else if (r.symbol.startsWith("USD") && inst.assetClass === "forex") usd /= inst.price;
  return usd;
}

function useCountdown() {
  const [left, setLeft] = React.useState<number | null>(null);
  React.useEffect(() => {
    const tick = () => {
      const nowSrv = Date.now() + 3 * 3600_000; // server GMT+3
      const next = Math.ceil(nowSrv / 86_400_000) * 86_400_000;
      setLeft(Math.floor((next - nowSrv) / 1000));
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  return left;
}

function RolloverCard({ tripleFx }: { tripleFx: Weekday }) {
  const left = useCountdown();
  const hh = left === null ? "--" : String(Math.floor(left / 3600)).padStart(2, "0");
  const mm = left === null ? "--" : String(Math.floor((left % 3600) / 60)).padStart(2, "0");
  const ss = left === null ? "--" : String(left % 60).padStart(2, "0");
  return (
    <Card hot className="relative h-full overflow-hidden">
      <Starfield density={36} />
      <div className="relative flex h-full flex-col px-6 pb-5 pt-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="k-label">Next rollover</div>
            <div className="mt-1 text-[12.5px] text-fg-2">Daily at {SWAP_SETTINGS.rolloverTime} server time ({SWAP_SETTINGS.timezone})</div>
          </div>
          <span className="grid size-10 place-items-center rounded-full border border-line bg-surface-2/80 text-fg-2">
            <Timer className="size-4" />
          </span>
        </div>
        <div className="mt-5 flex items-center gap-2 font-mono text-[34px] font-semibold tracking-tight">
          {[hh, mm, ss].map((v, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="text-fg-3">:</span>}
              <span className="k-num rounded-[12px] border border-line bg-black/30 px-2.5 py-1">{v}</span>
            </React.Fragment>
          ))}
        </div>
        <div className="mt-auto grid grid-cols-3 gap-2 pt-5 text-[12px]">
          <div>
            <div className="text-fg-3">Tonight</div>
            <div className="font-medium">Thu → Fri · ×1</div>
          </div>
          <div>
            <div className="text-fg-3">Swap charged</div>
            <div className="k-num font-medium text-up">+$41,220</div>
          </div>
          <div>
            <div className="text-fg-3">Swap paid</div>
            <div className="k-num font-medium text-down">-$3,884</div>
          </div>
        </div>
        <div className="mt-3 text-[11.5px] text-fg-3">Triple swap (×3) for FX/CFDs is charged on {tripleFx}; covers the weekend settlement.</div>
      </div>
    </Card>
  );
}

export default function SwapsPage() {
  const initial: SwapRow[] = SYMBOL_SPECS.map(({ symbol, swapLong, swapShort, swapType }) => ({ symbol, swapLong, swapShort, swapType }));
  const [rows, setRows] = React.useState<SwapRow[]>(initial);
  const [saved, setSaved] = React.useState<SwapRow[]>(initial);
  const [tripleFx, setTripleFx] = React.useState<Weekday>(SWAP_SETTINGS.tripleDayFx);
  const [tripleCrypto, setTripleCrypto] = React.useState<Weekday>(SWAP_SETTINGS.tripleDayCrypto);
  const [cryptoWeekend, setCryptoWeekend] = React.useState(SWAP_SETTINGS.cryptoWeekendSwap);
  const [islamic, setIslamic] = React.useState({ fee: 5, grace: 3, basis: "per-lot-night", groups: ["islamic"], exempt: ["EURUSD", "GBPUSD", "USDJPY"] as string[], waiveUnder: 0.1 });
  const [cls, setCls] = React.useState<AssetClass | "all">("all");

  const dirtyRows = rows.filter((r, i) => JSON.stringify(r) !== JSON.stringify(saved[i])).length;
  const setRow = (sym: string, patch: Partial<SwapRow>) => setRows((p) => p.map((r) => (r.symbol === sym ? { ...r, ...patch } : r)));
  const view = rows.filter((r) => cls === "all" || getInstrument(r.symbol).assetClass === cls);

  return (
    <div className="pb-16">
      <PageHeader
        title="Swaps & rollover"
        subtitle="Overnight financing per symbol (points or % p.a.), triple-swap day and the Islamic admin fee."
        actions={
          <>
            <Button variant="surface" onClick={() => toast.success("LP swap sheet imported", { description: `${SWAP_SETTINGS.source} · 27 symbols updated, review before saving` })}>
              <CloudDownload /> Import from LP
            </Button>
            <Button variant="ghost" disabled={!dirtyRows} onClick={() => setRows(saved)}>
              <RotateCcw /> Discard
            </Button>
            <Button
              variant="ember"
              disabled={!dirtyRows}
              onClick={() => {
                setSaved(rows);
                auditToast(`Swap rates updated on ${dirtyRows} symbol${dirtyRows > 1 ? "s" : ""}`, "Applied from the next rollover");
              }}
            >
              <Save /> Save {dirtyRows ? `${dirtyRows} change${dirtyRows > 1 ? "s" : ""}` : "rates"}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Reveal>
          <RolloverCard tripleFx={tripleFx} />
        </Reveal>
        <Reveal delay={0.05}>
          <Card className="h-full">
            <CardHeader title="Triple-swap day" subtitle="Charged ×3 to cover the weekend" />
            <div className="space-y-4 px-6 pb-6 pt-4">
              <div>
                <div className="mb-2 text-[12px] font-medium text-fg-2">Forex, metals, indices, energies</div>
                <Segmented value={tripleFx} onChange={(v) => { setTripleFx(v); auditToast(`FX/CFD triple swap moved to ${v}`); }} options={WEEKDAYS.slice(0, 5)} />
              </div>
              <div>
                <div className="mb-2 text-[12px] font-medium text-fg-2">Crypto</div>
                <Segmented value={tripleCrypto} onChange={(v) => { setTripleCrypto(v); auditToast(`Crypto triple swap moved to ${v}`); }} options={WEEKDAYS.slice(0, 5)} />
              </div>
              <SettingRow label="Crypto charges swap on weekends" hint={cryptoWeekend ? "Daily incl. Sat/Sun — triple day disabled" : "Weekdays only, triple on " + tripleCrypto} className="border-t border-line pt-3">
                <Toggle checked={cryptoWeekend} onChange={(v) => { setCryptoWeekend(v); auditToast(v ? "Crypto weekend swaps enabled" : "Crypto weekend swaps disabled"); }} />
              </SettingRow>
              <div className="text-[11.5px] text-fg-3">Last LP import {formatDateTime(SWAP_SETTINGS.lastImport)} · {SWAP_SETTINGS.source}</div>
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.1} className="lg:col-span-2 xl:col-span-1">
          <Card className="h-full">
            <CardHeader title="Islamic admin fee" subtitle="Replaces swaps on swap-free accounts" icon={<Moon />} />
            <div className="space-y-3 px-6 pb-6 pt-4">
              <div className="grid grid-cols-3 gap-3">
                <MiniField label="Fee">
                  <NumInput value={islamic.fee} onChange={(v) => setIslamic((p) => ({ ...p, fee: v }))} prefix="$" step={0.5} min={0} />
                </MiniField>
                <MiniField label="Grace nights">
                  <NumInput value={islamic.grace} onChange={(v) => setIslamic((p) => ({ ...p, grace: v }))} min={0} max={30} />
                </MiniField>
                <MiniField label="Basis">
                  <Select value={islamic.basis} onChange={(v) => setIslamic((p) => ({ ...p, basis: v }))} options={[{ value: "per-lot-night", label: "Lot / night" }, { value: "flat-night", label: "Flat / night" }]} />
                </MiniField>
              </div>
              <MiniField label="Applies to groups">
                <ChipList values={islamic.groups} onChange={(v) => setIslamic((p) => ({ ...p, groups: v }))} options={ADMIN_GROUPS.map((g) => g.id)} format={(id) => ADMIN_GROUPS.find((g) => g.id === id)!.name} tone="up" />
              </MiniField>
              <MiniField label="Fee-exempt symbols">
                <ChipList values={islamic.exempt} onChange={(v) => setIslamic((p) => ({ ...p, exempt: v }))} placeholder="Type symbol + Enter" tone="neutral" />
              </MiniField>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11.5px] text-fg-3">4,602 swap-free clients · $18,240 fees MTD</span>
                <Button size="sm" variant="surface" onClick={() => auditToast("Islamic fee settings saved", `$${islamic.fee} after ${islamic.grace} nights`)}>
                  Save fee
                </Button>
              </div>
            </div>
          </Card>
        </Reveal>
      </div>

      <Reveal delay={0.1}>
        <Card className="mt-4">
          <CardHeader
            title="Swap rates"
            subtitle="Negative = client pays · positive = client receives · $ values per 1 lot per night"
            action={
              <Segmented
                size="xs"
                value={cls}
                onChange={setCls}
                options={[{ value: "all" as const, label: "All" }, ...(Object.keys(ASSET_CLASS_LABEL) as AssetClass[]).map((c) => ({ value: c, label: ASSET_CLASS_LABEL[c] }))]}
              />
            }
          />
          <div className="mt-4 grid grid-cols-2 gap-3 px-4 sm:px-6 lg:grid-cols-4">
            <MiniStat label="Symbols with positive carry" value={`${rows.filter((r) => r.swapShort > 0 || r.swapLong > 0).length}`} sub="Client receives on at least one side" tone="up" />
            <MiniStat label="Avg long swap · FX" value={`${(rows.filter((r) => getInstrument(r.symbol).assetClass === "forex").reduce((s, r) => s + r.swapLong, 0) / 9).toFixed(2)} pts`} />
            <MiniStat label="Open lots overnight" value="48,912" sub="Across all live groups" />
            <MiniStat label="Swap revenue · MTD" value="$1.08M" sub="+12.4% vs Aug" tone="up" />
          </div>
          <div className="mt-4 overflow-x-auto px-4 pb-5 sm:px-6">
            <table className="w-full min-w-[920px] border-separate border-spacing-0 text-[12.5px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-fg-3">
                  <th className="rounded-l-[14px] border-y border-l border-line bg-surface-2 px-4 py-3 text-left font-medium">Symbol</th>
                  <th className="border-y border-line bg-surface-2 px-3 py-3 text-left font-medium">Type</th>
                  <th className="border-y border-line bg-surface-2 px-3 py-3 text-left font-medium">Long</th>
                  <th className="border-y border-line bg-surface-2 px-3 py-3 text-right font-medium">$ / lot · long</th>
                  <th className="border-y border-line bg-surface-2 px-3 py-3 text-left font-medium">Short</th>
                  <th className="border-y border-line bg-surface-2 px-3 py-3 text-right font-medium">$ / lot · short</th>
                  <th className="rounded-r-[14px] border-y border-r border-line bg-surface-2 px-3 py-3 text-left font-medium">Triple day</th>
                </tr>
              </thead>
              <tbody>
                {view.map((r) => {
                  const i = saved.findIndex((x) => x.symbol === r.symbol);
                  const dirty = JSON.stringify(r) !== JSON.stringify(saved[i]);
                  const inst = getInstrument(r.symbol);
                  const unit = r.swapType === "pct" ? "%" : "pts";
                  const l = perNight(r, "long");
                  const s = perNight(r, "short");
                  const crypto = inst.assetClass === "crypto";
                  return (
                    <tr key={r.symbol} className={cn("group", dirty && "[&>td]:bg-ember-soft/40")}>
                      <td className="border-b border-line px-4 py-2 group-hover:bg-surface-2/60">
                        <SymbolCell symbol={r.symbol} size={22} sub={ASSET_CLASS_LABEL[inst.assetClass]} />
                      </td>
                      <td className="border-b border-line px-3 py-2 group-hover:bg-surface-2/60">
                        <Segmented size="xs" value={r.swapType} onChange={(v) => setRow(r.symbol, { swapType: v })} options={[{ value: "points", label: "Points" }, { value: "pct", label: "% p.a." }]} />
                      </td>
                      <td className="border-b border-line px-3 py-2 group-hover:bg-surface-2/60">
                        <NumInput size="sm" value={r.swapLong} onChange={(v) => setRow(r.symbol, { swapLong: v })} step={0.1} suffix={unit} className={cn("h-8 w-28", r.swapLong < 0 ? "text-down" : "text-up")} />
                      </td>
                      <td className={cn("k-num border-b border-line px-3 py-2 text-right font-medium group-hover:bg-surface-2/60", l < 0 ? "text-down" : "text-up")}>{formatMoney(l)}</td>
                      <td className="border-b border-line px-3 py-2 group-hover:bg-surface-2/60">
                        <NumInput size="sm" value={r.swapShort} onChange={(v) => setRow(r.symbol, { swapShort: v })} step={0.1} suffix={unit} className={cn("h-8 w-28", r.swapShort < 0 ? "text-down" : "text-up")} />
                      </td>
                      <td className={cn("k-num border-b border-line px-3 py-2 text-right font-medium group-hover:bg-surface-2/60", s < 0 ? "text-down" : "text-up")}>{formatMoney(s)}</td>
                      <td className="border-b border-line px-3 py-2 group-hover:bg-surface-2/60">
                        {crypto && cryptoWeekend ? <Chip size="sm" tone="info">Daily 7/7</Chip> : <Chip size="sm" tone="ember">{crypto ? tripleCrypto : tripleFx} ×3</Chip>}
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
