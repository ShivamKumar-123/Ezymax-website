"use client";

/**
 * Config › Symbols (live): the instrument catalogue from the trading engine (services/trading api/catalogue.rs).
 * 28 core instruments plus the provider catalogue. Every instrument trades on demo accounts. Forex, metals, energies,
 * indices and crypto trade live by default (stocks and symbols kept off for a reason do not); the asset-class and
 * per-symbol switches here override that, and the spec templates are edited here. Only the
 * platform owner / super admin of the Kalks platform may change either (the engine enforces it); everyone else with
 * dealing access sees the same page read-only. Every change needs a reason and is audited.
 */
import * as React from "react";
import { History, Info, Lock, Pencil, RefreshCw, RotateCcw, Save, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, DataTable, Dialog, EmptyState, IconButton, PageHeader, Reveal, Segmented, Skeleton, Toggle, cn, type ChipTone, type Column } from "@kalks/ui";
import { ASSET_CLASS_LABEL } from "@kalks/mock";
import { MiniField, MiniStat, NumInput, Select, TextArea } from "@/components/config/kit";
import { ErrorState, ago, sendJson, useApi, useNow, when } from "./kit";

type Sym = {
  symbol: string;
  name: string;
  assetClass: string;
  core: boolean;
  template: string | null;
  liveTrading: boolean;
  liveDefault: boolean;
  liveOff: string | null;
  swapMode: "points" | "percent";
  session: string;
  holidayCalendar: string | null;
  digits: number;
  contractSize: number;
  lotMin: number;
  lotMax: number;
  lotStep: number;
  marginPct: number;
  maxLeverage: number;
  swapLong: number;
  swapShort: number;
  stopsLevelPoints: number;
  quoteCcy: string;
  baseCcy: string | null;
};
type RawSpec = Partial<{
  contract_size: number;
  lot_min: number;
  lot_max: number;
  lot_step: number;
  margin_pct: number;
  max_leverage: number;
  swap_long: number;
  swap_short: number;
  triple_swap_day: string | null;
  swap_days: string;
  swap_mode: "points" | "percent";
  session: string;
  stops_level_points: number;
  commission_per_lot: number;
}>;
type Template = { key: string; comment: string | null; symbols: number; file: RawSpec; override: RawSpec | null; effective: RawSpec; updatedBy: string | null; updatedReason: string | null; updatedAt: string | null };
type Counts = Record<string, { total: number; core: number; catalogue: number; catalogueLive: number }>;
type CatalogueResp = { canChange: boolean; counts: Counts; liveClasses: Record<string, boolean>; liveDefaultClasses: string[]; liveSymbols: Record<string, boolean>; templates: Template[]; symbols: Sym[] };
type Change = { id: number; at: string; staff: string; role: string; action: string; target: string; before: unknown; after: unknown; reason: string };

const CLASS_TONE: Record<string, ChipTone> = { forex: "info", metals: "gold", indices: "ember", energies: "warn", crypto: "up", stocks: "neutral" };
const classLabel = (c: string) => (ASSET_CLASS_LABEL as Record<string, string>)[c] ?? c.charAt(0).toUpperCase() + c.slice(1);
const SESSION_LABEL: Record<string, string> = { fx: "Mon–Fri (server time)", "24x7": "24/7", us_equity: "US stocks 09:30–16:00 NY", hk_equity: "HKEX 09:30–16:00 HKT", jp_equity: "TSE 09:00–15:30 JST", uk_equity: "LSE 08:00–16:30", eu_equity: "Xetra 09:00–17:30 CET", cn_equity: "SSE / SZSE", sg_equity: "SGX", in_equity: "NSE / BSE", au_equity: "ASX" };
const fmt = (n: number | undefined | null) => (n === undefined || n === null ? "—" : n.toLocaleString(undefined, { maximumFractionDigits: 8 }));

/** Live state of a catalogue symbol: its own switch, else kept off for a reason, else its class (switch or default). */
function liveSource(s: Sym, d: CatalogueResp): "core" | "symbol-on" | "symbol-off" | "kept-off" | "class-on" | "off" {
  if (s.core) return "core";
  const own = d.liveSymbols[s.symbol];
  if (own === true) return "symbol-on";
  if (own === false) return "symbol-off";
  if (s.liveOff) return "kept-off";
  return classOn(d, s.assetClass) ? "class-on" : "off";
}

/** A class's live state: its Back Office switch, else the catalogue default. */
function classOn(d: CatalogueResp, c: string) {
  return d.liveClasses[c] ?? d.liveDefaultClasses.includes(c);
}

/* ------------------------------------------------------------------ */
/* Reason prompt                                                       */
/* ------------------------------------------------------------------ */

type Ask = { title: string; description: React.ReactNode; confirm: string; danger?: boolean; run: (reason: string) => Promise<string | null> };

function ReasonPrompt({ ask, onClose }: { ask: Ask | null; onClose: () => void }) {
  const [reason, setReason] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    setReason("");
    setErr(null);
  }, [ask]);
  if (!ask) return null;
  async function go() {
    if (!ask) return;
    if (reason.trim().length < 3) return setErr("Give a reason for the audit log (at least 3 characters).");
    setBusy(true);
    const e = await ask.run(reason.trim());
    setBusy(false);
    if (e) return setErr(e);
    onClose();
  }
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={ask.title}
      description={ask.description}
      footer={
        <>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" variant={ask.danger ? "sell" : "ember"} onClick={go} disabled={busy}>
            <ShieldCheck /> {busy ? "Saving…" : ask.confirm}
          </Button>
        </>
      }
    >
      <MiniField label="Reason" hint="saved in the audit log">
        <TextArea value={reason} onChange={setReason} rows={2} placeholder="e.g. Launch live trading on crypto after the demo review" />
      </MiniField>
      {err && <div className="mt-3 rounded-[12px] border border-down/25 bg-down-soft px-3 py-2 text-[12.5px] text-down">{err}</div>}
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Template editor                                                     */
/* ------------------------------------------------------------------ */

const NUM_FIELDS: { k: keyof RawSpec; label: string; hint?: string; step: number; min?: number; max?: number }[] = [
  { k: "contract_size", label: "Contract size", hint: "units per lot", step: 1, min: 0 },
  { k: "lot_min", label: "Lot min", step: 0.01, min: 0 },
  { k: "lot_max", label: "Lot max", step: 1, min: 0 },
  { k: "lot_step", label: "Lot step", step: 0.01, min: 0 },
  { k: "margin_pct", label: "Margin", hint: "% (100 = notional / leverage)", step: 10, min: 1, max: 10000 },
  { k: "max_leverage", label: "Leverage cap", hint: "1:N", step: 1, min: 1, max: 1000 },
  { k: "swap_long", label: "Swap long", hint: "see swap mode", step: 0.5 },
  { k: "swap_short", label: "Swap short", hint: "see swap mode", step: 0.5 },
  { k: "stops_level_points", label: "Stops level", hint: "points", step: 1, min: 0 },
];
const DAYS = [
  { value: "none", label: "No triple swap" },
  { value: "mon", label: "Monday" },
  { value: "tue", label: "Tuesday" },
  { value: "wed", label: "Wednesday" },
  { value: "thu", label: "Thursday" },
  { value: "fri", label: "Friday" },
];

function TemplateEditor({ t, canChange, onClose, onSaved }: { t: Template | null; canChange: boolean; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = React.useState<RawSpec>({});
  const [reason, setReason] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    setV(t?.effective ?? {});
    setReason("");
    setErr(null);
  }, [t]);
  if (!t) return null;
  // only fields that differ from the file template are stored as the override
  const diff: RawSpec = {};
  for (const [k, val] of Object.entries(v) as [keyof RawSpec, unknown][]) {
    if (JSON.stringify(val) !== JSON.stringify(t.file[k])) (diff as Record<string, unknown>)[k] = val;
  }
  const changed = JSON.stringify(diff) !== JSON.stringify(t.override ?? {});
  async function save(fields: RawSpec | null) {
    if (!t) return;
    if (reason.trim().length < 3) return setErr("Give a reason for the audit log (at least 3 characters).");
    setBusy(true);
    setErr(null);
    const r = await sendJson<{ ok: boolean; symbols: number }>(`/api/trading/admin/symbols/templates/${t.key}`, { fields: fields && Object.keys(fields).length ? fields : null, reason: reason.trim() }, "PUT");
    setBusy(false);
    if (!r.ok) return setErr(r.error.message);
    toast.success(`Template ${t.key} saved`, { description: `${r.data.symbols} instruments use it · applies to the next order` });
    onSaved();
    onClose();
  }
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Template · ${t.key}`}
      description={`${t.comment ? `${t.comment} ` : ""}${t.symbols} catalogue instruments. Fields that differ from the file defaults (config/trading-specs.json) are stored as the override.`}
      footer={
        canChange ? (
          <>
            {t.override && (
              <Button size="sm" variant="ghost" onClick={() => save(null)} disabled={busy}>
                <RotateCcw /> Reset to file
              </Button>
            )}
            <Button size="sm" variant="ember" onClick={() => save(diff)} disabled={busy || !changed}>
              <Save /> {busy ? "Saving…" : "Save template"}
            </Button>
          </>
        ) : (
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        )
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {NUM_FIELDS.map((f) => (
            <MiniField key={f.k} label={f.label} hint={f.hint}>
              <NumInput
                size="sm"
                value={Number(v[f.k] ?? 0)}
                onChange={(n) => canChange && setV((p) => ({ ...p, [f.k]: n }))}
                step={f.step}
                min={f.min}
                max={f.max}
                className={cn(JSON.stringify(v[f.k]) !== JSON.stringify(t.file[f.k]) && "ring-1 ring-ember/50")}
              />
            </MiniField>
          ))}
          <MiniField label="Triple swap">
            <Select size="sm" value={v.triple_swap_day ?? "none"} onChange={(d) => canChange && setV((p) => ({ ...p, triple_swap_day: d === "none" ? null : d }))} options={DAYS} />
          </MiniField>
          <MiniField label="Swap mode">
            <Select size="sm" value={v.swap_mode ?? "points"} onChange={(d) => canChange && setV((p) => ({ ...p, swap_mode: d }))} options={[{ value: "points", label: "Points / lot / night" }, { value: "percent", label: "% of value / year" }]} />
          </MiniField>
          <MiniField label="Swap nights">
            <Select size="sm" value={v.swap_days ?? "mon-fri"} onChange={(d) => canChange && setV((p) => ({ ...p, swap_days: d }))} options={[{ value: "mon-fri", label: "Mon–Fri" }, { value: "all", label: "Every night" }]} />
          </MiniField>
          <MiniField label="Session">
            <Select size="sm" value={v.session ?? "fx"} onChange={(d) => canChange && setV((p) => ({ ...p, session: d }))} options={Object.entries(SESSION_LABEL).map(([value, label]) => ({ value, label }))} />
          </MiniField>
        </div>
        <p className="flex gap-2 text-[12px] text-fg-3">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          Changes apply to new orders and margin at once, on demo and live. Swaps in % per year are charged per night as rate / 360 (/ 365 when every night), negative = the client pays. Crypto and index contract sizes are set per symbol (one lot ≈ 1,000–10,000 USD). A contract size change waits until no position or order is open on these instruments. Core instruments never use templates.
        </p>
        {canChange ? (
          <MiniField label="Reason" hint="saved in the audit log">
            <TextArea value={reason} onChange={setReason} rows={2} placeholder="e.g. Lower the leverage cap on exotic pairs" />
          </MiniField>
        ) : (
          <div className="flex items-center gap-2 rounded-[12px] border border-line bg-surface-2 px-3 py-2 text-[12.5px] text-fg-3">
            <Lock className="size-3.5" /> Only the platform owner can change templates.
          </div>
        )}
        {err && <div className="rounded-[12px] border border-down/25 bg-down-soft px-3 py-2 text-[12.5px] text-down">{err}</div>}
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function RecentChanges({ version }: { version: number }) {
  const now = useNow();
  const { data, error, reload } = useApi<{ changes: Change[] }>(`/api/trading/admin/symbols/catalogue/audit?v=${version}`);
  return (
    <Card>
      <CardHeader title="Recent changes" subtitle="Live switch and templates" icon={<History />} />
      <div className="px-4 pb-5 pt-3 sm:px-6">
        {error && <ErrorState error={error} onRetry={reload} className="py-6" />}
        {!data && !error && <Skeleton className="h-32 w-full" />}
        {data && data.changes.length === 0 && <EmptyState title="No changes yet" text="Every change to live trading or a template is recorded here with its reason." illustration="calendar" className="py-6" />}
        <div className="divide-y divide-line">
          {data?.changes.slice(0, 12).map((c) => (
            <div key={c.id} className="py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-medium">{c.action === "symbols.live" ? `Live trading · ${c.target.replace(/^(class|symbol):/, "")}` : `Template · ${c.target.replace(/^template:/, "")}`}</span>
                <span className="text-[11.5px] text-fg-3" title={when(c.at, true)}>
                  {ago(c.at, now)}
                </span>
              </div>
              {c.action === "symbols.live" && <div className="mt-0.5 font-mono text-[12px] text-fg-2">{(c.after as { enabled?: unknown })?.enabled === true ? "on" : (c.after as { enabled?: unknown })?.enabled === false ? "off" : "back to default"}</div>}
              <div className="mt-0.5 truncate text-[12px] text-fg-3">
                {c.staff} · {c.reason}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

export function LiveSymbols() {
  const { data, error, reload } = useApi<CatalogueResp>("/api/trading/admin/symbols/catalogue");
  const [cls, setCls] = React.useState("all");
  const [tier, setTier] = React.useState<"all" | "core" | "catalogue" | "live">("all");
  const [ask, setAsk] = React.useState<Ask | null>(null);
  const [tpl, setTpl] = React.useState<Template | null>(null);
  const [version, setVersion] = React.useState(0);
  const refresh = () => {
    reload();
    setVersion((v) => v + 1);
  };

  if (error)
    return (
      <div className="pb-10">
        <PageHeader title="Symbols" subtitle="Instrument catalogue, live trading and spec templates" />
        <Card>
          <ErrorState error={error} onRetry={reload} />
        </Card>
      </div>
    );

  const d = data;
  const canChange = d?.canChange ?? false;
  const classes = d ? Object.keys(d.counts) : [];
  const total = d?.symbols.length ?? 0;
  const core = d?.symbols.filter((s) => s.core).length ?? 0;
  const liveCat = d?.symbols.filter((s) => !s.core && s.liveTrading).length ?? 0;
  const keptOff = d?.symbols.filter((s) => !s.core && s.liveOff).length ?? 0;
  const rows = (d?.symbols ?? []).filter((s) => (cls === "all" || s.assetClass === cls) && (tier === "all" || (tier === "core" ? s.core : tier === "catalogue" ? !s.core : !s.core && s.liveTrading)));

  const putLive = async (body: object, okText: string) => {
    const r = await sendJson<{ catalogueLive: number }>("/api/trading/admin/symbols/live", body, "PUT");
    if (!r.ok) return r.error.message;
    toast.success(okText, { description: `${r.data.catalogueLive} catalogue instruments now trade on live accounts` });
    refresh();
    return null;
  };
  const toggleClass = (c: string, on: boolean | null) => {
    if (!d) return;
    if (!canChange) return toast("Only the platform owner can switch live trading");
    const n = d.counts[c]?.catalogue ?? 0;
    const def = d.liveDefaultClasses.includes(c);
    setAsk({
      title: on === null ? `Live trading · ${classLabel(c)} back to the default (${def ? "on" : "off"})` : `${on ? "Enable" : "Disable"} live trading · ${classLabel(c)}`,
      description:
        on === false
          ? `New live positions on ${n} catalogue ${classLabel(c).toLowerCase()} instruments will be refused; open positions can still be closed. Demo is not affected.`
          : `Catalogue ${classLabel(c).toLowerCase()} instruments will ${on === null && !def ? "not " : ""}accept orders on live accounts (symbols kept off for a reason, or switched off individually, stay off). Core instruments are not affected.`,
      confirm: on === null ? "Use the default" : on ? "Enable live trading" : "Disable live trading",
      danger: on === false,
      run: (reason) => putLive({ scope: "class", key: c, enabled: on, reason }, `Live trading ${on === null ? "default" : on ? "on" : "off"} · ${classLabel(c)}`),
    });
  };
  const setSymbol = (s: Sym, enabled: boolean | null) => {
    if (!canChange) return toast("Only the platform owner can switch live trading");
    setAsk({
      title: `${s.symbol} · live trading ${enabled === null ? "follows its class" : enabled ? "on" : "off"}`,
      description:
        enabled === null
          ? `${s.symbol} goes back to its default${s.liveOff ? ` (kept off: ${s.liveOff})` : ` (the ${classLabel(s.assetClass)} switch)`}.`
          : enabled
            ? `${s.symbol} will accept orders on live accounts.${s.liveOff ? ` It is kept off by default because: ${s.liveOff}.` : ""}`
            : `New live positions on ${s.symbol} will be refused; open ones can be closed.`,
      confirm: "Save",
      danger: enabled === false,
      run: (reason) => putLive({ scope: "symbol", key: s.symbol, enabled, reason }, `${s.symbol}: live trading ${enabled === null ? "follows its class" : enabled ? "on" : "off"}`),
    });
  };

  const columns: Column<Sym>[] = [
    {
      key: "symbol",
      header: "Symbol",
      width: "230px",
      sort: (s) => s.symbol,
      cell: (s) => (
        <span className="flex min-w-0 flex-col">
          <span className="font-medium">{s.symbol}</span>
          <span className="truncate text-[11px] text-fg-3">{s.name || (s.core ? "Core instrument" : "")}</span>
        </span>
      ),
    },
    { key: "class", header: "Class", sort: (s) => s.assetClass, cell: (s) => <Chip size="sm" tone={CLASS_TONE[s.assetClass] ?? "neutral"}>{classLabel(s.assetClass)}</Chip> },
    { key: "tier", header: "Source", hideOn: "md", sort: (s) => (s.core ? 0 : 1), cell: (s) => (s.core ? <Chip size="sm" tone="ember">Core</Chip> : <span className="font-mono text-[11.5px] text-fg-2">{s.template}</span>) },
    { key: "session", header: "Session", hideOn: "lg", cell: (s) => <span className="text-[12px] text-fg-2">{SESSION_LABEL[s.session] ?? s.session}{s.holidayCalendar ? ` · ${s.holidayCalendar}` : ""}</span> },
    { key: "contract", header: "Contract", align: "right", sort: (s) => s.contractSize, cell: (s) => <span className="k-num">{fmt(s.contractSize)}</span>, hideOn: "md" },
    {
      key: "lots",
      header: "Lots min / max / step",
      align: "right",
      hideOn: "lg",
      cell: (s) => (
        <span className="k-num font-mono text-[12px] text-fg-2">
          {fmt(s.lotMin)} / {fmt(s.lotMax)} / {fmt(s.lotStep)}
        </span>
      ),
    },
    { key: "lev", header: "Leverage cap", align: "right", sort: (s) => s.maxLeverage, cell: (s) => <span className="k-num">1:{s.maxLeverage}</span> },
    { key: "ccy", header: "Profit ccy", align: "center", hideOn: "xl", cell: (s) => <span className="font-mono text-[12px]">{s.quoteCcy}</span> },
    {
      key: "live",
      header: "Live trading",
      align: "right",
      sort: (s) => (s.core ? 2 : s.liveTrading ? 1 : 0),
      csv: (s) => (s.core ? "core" : s.liveTrading ? "on" : "demo only"),
      cell: (s) => {
        if (!d) return null;
        const src = liveSource(s, d);
        if (src === "core") return <Chip size="sm" tone="up">Always</Chip>;
        const value = src === "symbol-on" ? "on" : src === "symbol-off" ? "off" : "class";
        return (
          <span className="inline-flex items-center gap-2" onClick={(e) => e.stopPropagation()} title={s.liveOff ? `Kept off live trading: ${s.liveOff}` : undefined}>
            <Chip size="sm" tone={s.liveTrading ? "up" : src === "kept-off" ? "warn" : "neutral"} dot>
              {s.liveTrading ? "Live + demo" : src === "kept-off" ? "Kept off" : "Demo only"}
            </Chip>
            {canChange && (
              <Segmented
                size="xs"
                value={value}
                onChange={(v) => setSymbol(s, v === "class" ? null : v === "on")}
                options={[
                  { value: "class", label: "Default" },
                  { value: "on", label: "On" },
                  { value: "off", label: "Off" },
                ]}
              />
            )}
          </span>
        );
      },
    },
  ];

  return (
    <div className="pb-16">
      <PageHeader
        title="Symbols"
        subtitle="The instrument catalogue: 28 core instruments and the provider catalogue. Everything trades on demo; forex, metals, energies, indices and crypto also trade live by default (stocks follow once corporate actions are handled)."
        actions={
          <Button variant="surface" onClick={refresh}>
            <RefreshCw /> Refresh
          </Button>
        }
      />

      <Reveal>
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MiniStat label="Instruments" value={d ? total.toLocaleString() : "—"} sub={d ? `${core} core · ${(total - core).toLocaleString()} catalogue` : undefined} />
          <MiniStat label="Live trading on" value={d ? `${liveCat.toLocaleString()} / ${(total - core).toLocaleString()}` : "—"} sub={d ? `Catalogue instruments open to live accounts · ${keptOff} kept off` : undefined} tone={liveCat > 0 ? "up" : undefined} />
          <MiniStat label="Templates" value={d ? d.templates.length : "—"} sub={d ? `${d.templates.filter((t) => t.override).length} with Back Office changes` : undefined} />
          <MiniStat label="Your access" value={canChange ? "Can change" : "View only"} sub={canChange ? "Every change needs a reason" : "Platform owner only"} tone={canChange ? "up" : undefined} />
        </div>
      </Reveal>

      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-12">
        <div className="space-y-4 2xl:col-span-9">
          <Reveal delay={0.03}>
            <Card>
              <CardHeader title="Live trading by asset class" subtitle="Off: catalogue instruments of the class trade on demo accounts only. Core instruments always trade. A class without a switch follows the catalogue default." icon={<ShieldCheck />} />
              <div className="grid grid-cols-1 gap-2 px-4 pb-5 pt-3 sm:grid-cols-2 sm:px-6 xl:grid-cols-3">
                {!d && <Skeleton className="h-24 w-full sm:col-span-2 xl:col-span-3" />}
                {d &&
                  classes.map((c) => {
                    const k = d.counts[c]!;
                    const on = classOn(d, c);
                    const explicit = d.liveClasses[c] !== undefined;
                    const overrides = d.symbols.filter((s) => s.assetClass === c && !s.core && d.liveSymbols[s.symbol] !== undefined).length;
                    return (
                      <div key={c} className="k-row flex items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-[13px] font-medium">
                            {classLabel(c)}
                            <Chip size="sm" tone={k.catalogueLive > 0 ? "up" : "neutral"}>
                              {k.catalogueLive > 0 ? `${k.catalogueLive} live` : "Demo only"}
                            </Chip>
                          </div>
                          <div className="mt-0.5 text-[11.5px] text-fg-3">
                            {k.catalogue} catalogue · {k.core} core{overrides ? ` · ${overrides} symbol switch${overrides > 1 ? "es" : ""}` : ""} · {explicit ? "Back Office switch" : `default ${d.liveDefaultClasses.includes(c) ? "on" : "off"}`}
                            {explicit && canChange && (
                              <button className="ml-1.5 text-ember hover:underline" onClick={() => toggleClass(c, null)}>
                                use default
                              </button>
                            )}
                          </div>
                        </div>
                        {k.catalogue > 0 && canChange ? (
                          <Toggle checked={on} onChange={(v) => void toggleClass(c, v)} label={`Live trading on ${classLabel(c)}`} />
                        ) : k.catalogue > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11.5px] text-fg-3" title="Only the platform owner can switch live trading">
                            <Lock className="size-3" /> {on ? "On" : "Off"}
                          </span>
                        ) : (
                          <span className="text-[11.5px] text-fg-3">Core only</span>
                        )}
                      </div>
                    );
                  })}
              </div>
            </Card>
          </Reveal>

          <Reveal delay={0.06}>
            <Card className="px-4 pb-5 pt-5 sm:px-6">
              {!d ? (
                <Skeleton className="h-96 w-full" />
              ) : (
                <DataTable
                  columns={columns}
                  rows={rows}
                  pageSize={20}
                  dense
                  rowKey={(s) => s.symbol}
                  search={(s) => `${s.symbol} ${s.name} ${s.template ?? ""}`}
                  searchPlaceholder="Search symbol or name…"
                  exportName="symbols"
                  toolbar={
                    <div className="flex flex-wrap items-center gap-2">
                      <Segmented size="xs" value={cls} onChange={setCls} options={[{ value: "all", label: <>All <span className="text-fg-3">{total}</span></> }, ...classes.map((c) => ({ value: c, label: classLabel(c) }))]} />
                      <Segmented
                        size="xs"
                        value={tier}
                        onChange={setTier}
                        options={[
                          { value: "all" as const, label: "Any" },
                          { value: "core" as const, label: "Core" },
                          { value: "catalogue" as const, label: "Catalogue" },
                          { value: "live" as const, label: "Live on" },
                        ]}
                      />
                    </div>
                  }
                />
              )}
            </Card>
          </Reveal>

          <Reveal delay={0.09}>
            <Card>
              <CardHeader title="Spec templates" subtitle="Conservative contract specs of catalogue instruments, per asset class" icon={<SlidersHorizontal />} />
              <div className="overflow-x-auto px-4 pb-5 pt-3 sm:px-6">
                {!d ? (
                  <Skeleton className="h-48 w-full" />
                ) : (
                  <table className="w-full min-w-[720px] text-[12.5px]">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wider text-fg-3">
                        <th className="py-2 font-medium">Template</th>
                        <th className="py-2 text-right font-medium">Instruments</th>
                        <th className="py-2 text-right font-medium">Contract</th>
                        <th className="py-2 text-right font-medium">Lots</th>
                        <th className="py-2 text-right font-medium">Leverage cap</th>
                        <th className="py-2 text-right font-medium">Swap L / S</th>
                        <th className="py-2 font-medium">Session</th>
                        <th className="py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {d.templates.map((t) => (
                        <tr key={t.key} className="cursor-pointer hover:bg-surface-2" onClick={() => setTpl(t)}>
                          <td className="py-2">
                            <span className="font-mono font-medium">{t.key}</span>
                            {t.override && (
                              <Chip size="sm" tone="ember" className="ml-2">
                                changed
                              </Chip>
                            )}
                            {t.comment && <div className="text-[11px] text-fg-3">{t.comment}</div>}
                          </td>
                          <td className="py-2 text-right k-num">{t.symbols}</td>
                          <td className="py-2 text-right k-num">{fmt(t.effective.contract_size)}</td>
                          <td className="py-2 text-right font-mono text-[12px] text-fg-2">
                            {fmt(t.effective.lot_min)} / {fmt(t.effective.lot_max)} / {fmt(t.effective.lot_step)}
                          </td>
                          <td className="py-2 text-right k-num">1:{t.effective.max_leverage}</td>
                          <td className="py-2 text-right font-mono text-[12px] text-fg-2">
                            {fmt(t.effective.swap_long)} / {fmt(t.effective.swap_short)} {t.effective.swap_mode === "percent" ? "%/yr" : "pts"}
                          </td>
                          <td className="py-2 text-[12px] text-fg-2">{SESSION_LABEL[t.effective.session ?? ""] ?? t.effective.session}</td>
                          <td className="py-2 text-right">
                            <IconButton size="sm" aria-label={`Edit template ${t.key}`}>
                              <Pencil />
                            </IconButton>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>
          </Reveal>
        </div>
        <Reveal delay={0.1} className="2xl:col-span-3">
          <RecentChanges version={version} />
        </Reveal>
      </div>

      <ReasonPrompt ask={ask} onClose={() => setAsk(null)} />
      <TemplateEditor t={tpl} canChange={canChange} onClose={() => setTpl(null)} onSaved={refresh} />
    </div>
  );
}
