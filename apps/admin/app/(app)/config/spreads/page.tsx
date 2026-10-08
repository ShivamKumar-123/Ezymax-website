"use client";

import { IS_DEMO } from "@ezymex/mock/mode";
import { LiveSpreads } from "@/components/live/spreads";

import * as React from "react";
import { Info, RotateCcw, Save, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, Dialog, PageHeader, Reveal, Segmented, SymbolAvatar, cn, formatNumber } from "@ezymex/ui";
import { INSTRUMENTS, ASSET_CLASS_LABEL, type AssetClass, type Instrument } from "@ezymex/mock";
import { ADMIN_GROUPS, SPREAD_FLOORS, SPREAD_MARKUPS, pipSize, type MarkupCell } from "@ezymex/mock/admin-config";
import { ChipList, MiniField, MiniStat, NumInput, Select, auditToast } from "@/components/config/kit";

type Matrix = Record<string, Record<string, MarkupCell>>;

/** Pip used for the matrix: FX fractional pip, otherwise 10 points (1.0 for indices). */
function pipOf(i: Instrument) {
  if (i.assetClass === "forex") return pipSize(i.digits);
  return i.digits >= 1 ? Math.pow(10, -(i.digits - 1)) : 1;
}
const usesPrice = (i: Instrument) => i.assetClass === "crypto" || i.assetClass === "stocks";
const RAW_FACTOR: Record<AssetClass, number> = { forex: 0.22, metals: 0.45, indices: 0.5, energies: 0.5, crypto: 0.55, stocks: 0.5 };

/** Simulated raw LP spread per symbol, jittering like a live feed (client-only effect). */
function useRawSpreads() {
  const base = React.useMemo(() => Object.fromEntries(INSTRUMENTS.map((i) => [i.symbol, (i.spread * RAW_FACTOR[i.assetClass]) / (usesPrice(i) ? 1 : pipOf(i))])), []);
  const [raw, setRaw] = React.useState<Record<string, { v: number; d: 1 | -1 | 0 }>>(() => Object.fromEntries(Object.entries(base).map(([k, v]) => [k, { v, d: 0 as const }])));
  React.useEffect(() => {
    const t = setInterval(() => {
      setRaw((prev) => {
        const next = { ...prev };
        for (const s of Object.keys(base)) {
          if (Math.random() < 0.35) {
            const nv = base[s]! * (0.8 + Math.random() * 0.55);
            next[s] = { v: nv, d: nv > prev[s]!.v ? 1 : -1 };
          }
        }
        return next;
      });
    }, 1400);
    return () => clearInterval(t);
  }, [base]);
  return raw;
}

function effective(raw: number, cell: MarkupCell, floor: number) {
  const v = cell.type === "fixed" ? raw + cell.value : raw * (1 + cell.value / 100);
  return { value: Math.max(floor, v), floored: v < floor };
}

function MarkupInput({ cell, dirty, onChange }: { cell: MarkupCell; dirty: boolean; onChange: (c: MarkupCell) => void }) {
  return (
    <div className={cn("flex items-center rounded-[10px] border bg-surface-2 transition-colors", dirty ? "border-ember/60 bg-ember-soft" : "border-line")}>
      <NumInput size="sm" value={cell.value} onChange={(v) => onChange({ ...cell, value: v })} step={0.1} min={0} className="h-7 w-[58px] rounded-[10px] border-0 bg-transparent px-2 focus-within:ring-0" align="right" />
      <button
        type="button"
        onClick={() => onChange({ ...cell, type: cell.type === "fixed" ? "pct" : "fixed" })}
        className="mr-1 h-5 rounded-md bg-surface-3 px-1.5 font-mono text-[10px] text-fg-2 hover:text-ember"
        title="Toggle fixed pips / % of raw"
      >
        {cell.type === "fixed" ? "pip" : "%"}
      </button>
    </div>
  );
}

function BulkDialog({ open, onOpenChange, onApply }: { open: boolean; onOpenChange: (o: boolean) => void; onApply: (cls: AssetClass | "all", groups: string[], op: "add" | "set" | "mult", v: number) => void }) {
  const [cls, setCls] = React.useState<AssetClass | "all">("forex");
  const [groups, setGroups] = React.useState<string[]>(["standard", "cent"]);
  const [op, setOp] = React.useState<"add" | "set" | "mult">("add");
  const [v, setV] = React.useState(0.1);
  const n = INSTRUMENTS.filter((i) => cls === "all" || i.assetClass === cls).length * groups.length;
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Bulk adjust markups"
      description="Changes are staged in the matrix; nothing goes live until you save."
      footer={
        <>
          <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="ember"
            disabled={!groups.length}
            onClick={() => {
              onApply(cls, groups, op, v);
              onOpenChange(false);
            }}
          >
            Stage {n} cells
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <MiniField label="Asset class">
          <Select value={cls} onChange={setCls} options={[{ value: "all", label: "All symbols" }, ...(Object.keys(ASSET_CLASS_LABEL) as AssetClass[]).map((c) => ({ value: c, label: ASSET_CLASS_LABEL[c] }))]} />
        </MiniField>
        <MiniField label="Groups">
          <ChipList values={groups} onChange={setGroups} options={ADMIN_GROUPS.map((g) => g.id)} format={(id) => ADMIN_GROUPS.find((g) => g.id === id)!.name} />
        </MiniField>
        <div className="grid grid-cols-[auto_1fr] items-end gap-3">
          <Segmented size="sm" value={op} onChange={setOp} options={[{ value: "add", label: "Add" }, { value: "set", label: "Set to" }, { value: "mult", label: "Multiply" }]} />
          <NumInput value={v} onChange={setV} step={0.1} suffix={op === "mult" ? "×" : "value"} />
        </div>
      </div>
    </Dialog>
  );
}

function DemoSpreadsPage() {
  const [saved, setSaved] = React.useState<Matrix>(SPREAD_MARKUPS);
  const [m, setM] = React.useState<Matrix>(SPREAD_MARKUPS);
  const [floors, setFloors] = React.useState<Record<string, number>>(SPREAD_FLOORS);
  const [savedFloors, setSavedFloors] = React.useState<Record<string, number>>(SPREAD_FLOORS);
  const [cls, setCls] = React.useState<AssetClass | "all">("all");
  const [bulk, setBulk] = React.useState(false);
  const raw = useRawSpreads();

  const dirtyCells = INSTRUMENTS.reduce((n, i) => n + ADMIN_GROUPS.filter((g) => JSON.stringify(m[i.symbol]![g.id]) !== JSON.stringify(saved[i.symbol]![g.id])).length + (floors[i.symbol] !== savedFloors[i.symbol] ? 1 : 0), 0);
  const rows = INSTRUMENTS.filter((i) => cls === "all" || i.assetClass === cls);
  const setCell = (sym: string, gid: string, c: MarkupCell) => setM((p) => ({ ...p, [sym]: { ...p[sym]!, [gid]: c } }));

  return (
    <div className="pb-16">
      <PageHeader
        title="Spread markups"
        subtitle="Markup over the raw LP feed per symbol and group — fixed pips or % of raw, never below the floor."
        actions={
          <>
            <Button variant="surface" onClick={() => setBulk(true)}>
              <Wand2 /> Bulk adjust
            </Button>
            <Button
              variant="ghost"
              disabled={!dirtyCells}
              onClick={() => {
                setM(saved);
                setFloors(savedFloors);
                toast("Staged changes discarded");
              }}
            >
              <RotateCcw /> Discard
            </Button>
            <Button
              variant="ember"
              disabled={!dirtyCells}
              onClick={() => {
                setSaved(m);
                setSavedFloors(floors);
                auditToast(`${dirtyCells} markup cell${dirtyCells > 1 ? "s" : ""} published`, "Live on next quote");
              }}
            >
              <Save /> Save {dirtyCells ? `${dirtyCells} change${dirtyCells > 1 ? "s" : ""}` : "changes"}
            </Button>
          </>
        }
      />

      <Reveal>
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MiniStat label="Markup revenue · today" value="$48,210.44" sub="+6.2% vs 7-day avg" tone="up" />
          <MiniStat label="EURUSD client spread" value="1.2 · 0.5 · 0.2" sub="Standard · Pro · ECN (pips)" />
          <MiniStat label="Quotes at floor · 1h" value="1,284" sub="Mostly XAUUSD during Asia" tone="warn" />
          <MiniStat label="LP feed" value="Infoways · 41 ms" sub="Tier-1 pool · 14 LPs aggregated" />
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <Card>
          <CardHeader
            title="Markup matrix"
            subtitle={<span>Symbols × groups · click the unit to switch between fixed pips and % of raw</span>}
            action={
              <Segmented
                size="xs"
                value={cls}
                onChange={setCls}
                options={[{ value: "all" as const, label: "All" }, ...(Object.keys(ASSET_CLASS_LABEL) as AssetClass[]).map((c) => ({ value: c, label: ASSET_CLASS_LABEL[c] }))]}
              />
            }
          />
          <div className="mt-4 overflow-x-auto px-4 pb-5 sm:px-6">
            <table className="w-full min-w-[1180px] border-separate border-spacing-0 text-[12.5px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-fg-3">
                  <th className="sticky left-0 z-10 rounded-l-[14px] border-y border-l border-line bg-surface-2 px-4 py-3 text-left font-medium">Symbol</th>
                  <th className="border-y border-line bg-surface-2 px-3 py-3 text-right font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="size-1.5 animate-pulse rounded-full bg-up" /> Raw feed
                    </span>
                  </th>
                  {ADMIN_GROUPS.map((g) => (
                    <th key={g.id} className="border-y border-line bg-surface-2 px-2 py-3 text-left font-medium">
                      <span className="text-fg-2">{g.name}</span>
                      <span className="ml-1 normal-case tracking-normal text-fg-3">{g.route === "A" ? "A" : g.route === "B" ? "B" : "Auto"}</span>
                    </th>
                  ))}
                  <th className="rounded-r-[14px] border-y border-r border-line bg-surface-2 px-3 py-3 text-left font-medium">Min floor</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((i) => {
                  const r = raw[i.symbol]!;
                  const unit = usesPrice(i) ? "$" : "pips";
                  return (
                    <tr key={i.symbol} className="group">
                      <td className="sticky left-0 z-10 border-b border-line bg-surface px-4 py-2 group-hover:bg-surface-2">
                        <span className="flex items-center gap-2.5">
                          <SymbolAvatar symbol={i.symbol} size={20} />
                          <span className="font-medium">{i.symbol}</span>
                          <span className="text-[10.5px] text-fg-3">{ASSET_CLASS_LABEL[i.assetClass]}</span>
                        </span>
                      </td>
                      <td className="border-b border-line px-3 py-2 text-right group-hover:bg-surface-2/60">
                        <span key={r.v} className={cn("k-num font-mono text-[12.5px] font-medium", r.d === 1 ? "flash-down" : r.d === -1 ? "flash-up" : "")}>
                          {usesPrice(i) ? `$${formatNumber(r.v, i.digits)}` : formatNumber(r.v, 1)}
                        </span>
                        <span className="ml-1 text-[10.5px] text-fg-3">{usesPrice(i) ? "" : "pips"}</span>
                      </td>
                      {ADMIN_GROUPS.map((g) => {
                        const cell = m[i.symbol]![g.id]!;
                        const dirty = JSON.stringify(cell) !== JSON.stringify(saved[i.symbol]![g.id]);
                        const eff = effective(r.v, cell, floors[i.symbol]!);
                        return (
                          <td key={g.id} className="border-b border-line px-2 py-2 group-hover:bg-surface-2/60">
                            <div className="flex items-center gap-2">
                              <MarkupInput cell={cell} dirty={dirty} onChange={(c) => setCell(i.symbol, g.id, c)} />
                              <span className={cn("k-num w-14 truncate text-[11px]", eff.floored ? "text-warn" : "text-fg-3")} title={eff.floored ? "Floor applied" : "Client spread"}>
                                {usesPrice(i) ? "$" : ""}
                                {formatNumber(eff.value, usesPrice(i) ? i.digits : 1)}
                              </span>
                            </div>
                          </td>
                        );
                      })}
                      <td className="border-b border-line px-3 py-2 group-hover:bg-surface-2/60">
                        <NumInput
                          size="sm"
                          value={floors[i.symbol]!}
                          onChange={(v) => setFloors((p) => ({ ...p, [i.symbol]: v }))}
                          step={0.1}
                          min={0}
                          suffix={unit}
                          className={cn("h-7 w-[92px]", floors[i.symbol] !== savedFloors[i.symbol] && "border-ember/60 bg-ember-soft")}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11.5px] text-fg-3">
              <span className="inline-flex items-center gap-1.5">
                <Info className="size-3.5" /> Client spread = max(floor, raw + markup) — shown next to each cell
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-warn" /> Floor applied
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-ember" /> Staged change
              </span>
              <Chip size="sm">Crypto & stocks: raw and floor in USD, % = share of raw spread</Chip>
            </div>
          </div>
        </Card>
      </Reveal>

      <BulkDialog
        open={bulk}
        onOpenChange={setBulk}
        onApply={(c, groups, op, v) => {
          setM((p) => {
            const next: Matrix = structuredClone(p);
            for (const i of INSTRUMENTS) {
              if (c !== "all" && i.assetClass !== c) continue;
              for (const gid of groups) {
                const cell = next[i.symbol]![gid]!;
                cell.value = +(op === "add" ? Math.max(0, cell.value + v) : op === "set" ? v : cell.value * v).toFixed(2);

              }
            }
            return next;
          });
          toast.message("Bulk change staged", { description: "Review the highlighted cells, then save to publish." });
        }}
      />
    </div>
  );
}

/** Live builds: real data from the gateway / market-data. Demo builds: the mock showcase above. */
export default function Page() {
  return IS_DEMO ? <DemoSpreadsPage /> : <LiveSpreads />;
}
