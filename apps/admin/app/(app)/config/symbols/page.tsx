"use client";

import * as React from "react";
import { Pencil, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Chip, DataTable, IconButton, PageHeader, PriceText, Reveal, Segmented, SymbolCell, Toggle, cn, formatNumber, useQuotes, type Column, type ChipTone } from "@kalks/ui";
import { INSTRUMENTS, ASSET_CLASS_LABEL, getInstrument, type AssetClass } from "@kalks/mock";
import { SYMBOL_SPECS, SESSIONS, pipSize, type SymbolSpec } from "@kalks/mock/admin-config";
import { SymbolEditor, TRADE_MODE_LABEL } from "@/components/config/symbol-editor";
import { auditToast } from "@/components/config/kit";

const CLASS_TONE: Record<AssetClass, ChipTone> = { forex: "info", metals: "gold", indices: "ember", energies: "warn", crypto: "up", stocks: "neutral" };
const MODE_TONE: Record<SymbolSpec["tradeMode"], ChipTone> = { full: "up", "close-only": "warn", "long-only": "info", disabled: "down" };

function LiveQuote({ symbol, q }: { symbol: string; q: { bid: number; ask: number; dir: 1 | -1 | 0 } }) {
  const inst = getInstrument(symbol);
  const fx = inst.assetClass === "forex";
  const sp = (q.ask - q.bid) / (fx ? pipSize(inst.digits) : Math.pow(10, -inst.digits));
  return (
    <span className="inline-flex flex-col items-end">
      <PriceText symbol={symbol} value={q.bid} dir={q.dir} className="text-[12.5px]" size="sm" />
      <span className="k-num text-[11px] text-fg-3">{formatNumber(sp, fx ? 1 : 0)} {fx ? "pips" : "pts"}</span>
    </span>
  );
}

export default function SymbolsPage() {
  const [specs, setSpecs] = React.useState<SymbolSpec[]>(SYMBOL_SPECS);
  const [cls, setCls] = React.useState<"all" | AssetClass>("all");
  const [editing, setEditing] = React.useState<SymbolSpec | null>(null);
  const [open, setOpen] = React.useState(false);
  const qs = useQuotes(INSTRUMENTS.map((i) => i.symbol));

  const rows = specs.filter((s) => cls === "all" || getInstrument(s.symbol).assetClass === cls);
  const classes = Object.keys(ASSET_CLASS_LABEL) as AssetClass[];
  const edit = (s: SymbolSpec) => {
    setEditing(s);
    setOpen(true);
  };
  const toggle = (s: SymbolSpec, v: boolean) => {
    setSpecs((p) => p.map((x) => (x.symbol === s.symbol ? { ...x, enabled: v } : x)));
    auditToast(`${s.symbol} ${v ? "enabled" : "disabled"} for all groups`, v ? undefined : "Open positions stay open; new orders rejected");
  };

  const columns: Column<SymbolSpec>[] = [
    { key: "symbol", header: "Symbol", cell: (s) => <SymbolCell symbol={s.symbol} size={26} />, sort: (s) => s.symbol, width: "220px" },
    { key: "class", header: "Class", cell: (s) => <Chip size="sm" tone={CLASS_TONE[getInstrument(s.symbol).assetClass]}>{ASSET_CLASS_LABEL[getInstrument(s.symbol).assetClass]}</Chip>, sort: (s) => getInstrument(s.symbol).assetClass },
    {
      key: "enabled",
      header: "Enabled",
      align: "center",
      cell: (s) => (
        <span className="inline-flex" onClick={(e) => e.stopPropagation()}>
          <Toggle checked={s.enabled} onChange={(v) => toggle(s, v)} label={`Enable ${s.symbol}`} />
        </span>
      ),
    },
    { key: "mode", header: "Trade mode", cell: (s) => <Chip size="sm" tone={MODE_TONE[s.tradeMode]} dot>{TRADE_MODE_LABEL[s.tradeMode]}</Chip>, hideOn: "md" },
    { key: "digits", header: "Digits", align: "right", cell: (s) => <span className="k-num">{s.digits}</span>, sort: (s) => s.digits },
    { key: "contract", header: "Contract", align: "right", cell: (s) => <span className="k-num">{s.contractSize.toLocaleString()}</span>, sort: (s) => s.contractSize },
    {
      key: "lots",
      header: "Lots min / max / step",
      align: "right",
      cell: (s) => (
        <span className="k-num font-mono text-[12px] text-fg-2">
          {s.lotMin} / {s.lotMax.toLocaleString()} / {s.lotStep}
        </span>
      ),
    },
    {
      key: "margin",
      header: "Margin",
      align: "right",
      cell: (s) => (
        <span className="inline-flex flex-col items-end">
          <span className="k-num font-medium">{s.marginPct}%</span>
          <span className="k-num text-[11px] text-fg-3">1:{formatNumber(100 / s.marginPct, 0)}</span>
        </span>
      ),
      sort: (s) => s.marginPct,
    },
    { key: "session", header: "Session", cell: (s) => <span className="text-[12.5px] text-fg-2">{SESSIONS.find((x) => x.key === s.session)?.name}</span>, hideOn: "lg" },
    { key: "live", header: "Live bid · spread", align: "right", cell: (s) => <LiveQuote symbol={s.symbol} q={qs[s.symbol]!} /> },
    {
      key: "edit",
      header: "",
      align: "right",
      cell: (s) => (
        <IconButton
          size="sm"
          aria-label={`Edit ${s.symbol}`}
          onClick={(e) => {
            e.stopPropagation();
            edit(s);
          }}
        >
          <Pencil />
        </IconButton>
      ),
    },
  ];

  const enabled = specs.filter((s) => s.enabled).length;
  const restricted = specs.filter((s) => s.tradeMode !== "full").length;

  return (
    <div className="pb-16">
      <PageHeader
        title="Symbols"
        subtitle="Contract specifications, volume limits and margin rates for every instrument on the tenant."
        actions={
          <>
            <Button variant="surface" onClick={() => toast.success("Specs re-synced from Global symbols", { description: "28 symbols checked · 0 conflicts" })}>
              <RefreshCw /> Sync from global
            </Button>
            <Button variant="ember" onClick={() => toast.message("Add symbols from the platform catalogue", { description: "Brokers (Owner) → Global symbols lists 1,240 instruments available to this tenant." })}>
              <Plus /> Add symbol
            </Button>
          </>
        }
      />

      <Reveal>
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
          <div className="k-row px-4 py-3">
            <div className="text-[11px] uppercase tracking-wider text-fg-3">Enabled</div>
            <div className="k-num mt-1 text-[20px] font-semibold">
              {enabled}
              <span className="text-[13px] font-normal text-fg-3"> / {specs.length}</span>
            </div>
          </div>
          <div className="k-row px-4 py-3">
            <div className="text-[11px] uppercase tracking-wider text-fg-3">Restricted</div>
            <div className="k-num mt-1 text-[20px] font-semibold text-warn">{restricted}</div>
          </div>
          {classes.map((c) => (
            <button key={c} onClick={() => setCls(c)} className={cn("k-row px-4 py-3 text-left transition-colors hover:bg-surface-3/60", cls === c && "border-ember/40")}>
              <div className="text-[11px] uppercase tracking-wider text-fg-3">{ASSET_CLASS_LABEL[c]}</div>
              <div className="k-num mt-1 text-[20px] font-semibold">{INSTRUMENTS.filter((i) => i.assetClass === c).length}</div>
            </button>
          ))}
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <Card className="px-4 pb-5 pt-5 sm:px-6">
          <DataTable
            columns={columns}
            rows={rows}
            pageSize={15}
            dense
            rowKey={(s) => s.symbol}
            onRowClick={edit}
            search={(s) => `${s.symbol} ${getInstrument(s.symbol).name}`}
            searchPlaceholder="Search symbol…"
            exportName="symbols"
            toolbar={
              <Segmented
                size="xs"
                value={cls}
                onChange={setCls}
                options={[{ value: "all" as const, label: <>All <span className="text-fg-3">{specs.length}</span></> }, ...classes.map((c) => ({ value: c, label: ASSET_CLASS_LABEL[c] }))]}
              />
            }
          />
        </Card>
      </Reveal>

      <SymbolEditor spec={editing} open={open} onOpenChange={setOpen} onSave={(ns) => setSpecs((p) => p.map((x) => (x.symbol === ns.symbol ? ns : x)))} />
    </div>
  );
}
