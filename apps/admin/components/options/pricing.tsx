"use client";

/**
 * Options › Spreads, fees & limits (O15, O28, O33, O42): per account group and underlying, this broker's vol spread
 * (bid at σ − x, ask at σ + x), minimum USD spread, commission per contract capped at a % of premium, max contracts
 * per client and the Friday weekend margin add-on. The most specific row wins: (group, underlying) > (group, all) >
 * (all, underlying) > (all, all) > the Kalks default.
 *
 *   GET /api/options/groups        PUT|DELETE /api/options/groups/{group}/{symbol} {…, reason}
 */
import * as React from "react";
import { BadgePercent, Calculator, Coins, Pencil, Plus, RefreshCw, Scale, Trash2 } from "lucide-react";
import { Button, Card, CardHeader, Chip, DataTable, Field, KpiCard, PageHeader, Reveal, Toggle, cn, formatNumber, type Column } from "@kalks/ui";
import { IS_DEMO } from "@kalks/mock/mode";
import { ErrorState, TableSkeleton, ago, useApi, useNow, when } from "@/components/live/kit";
import type { GroupSettings, Underlying } from "./types";
import { NumInput, ReadOnlyHint, REASONS, ReasonDialog, Select, optSend, parseNum, useOpt, useOptPerms, usd, volPts } from "./kit";

type Spec = { key: "volSpread" | "minSpreadUsd" | "commissionPerContract" | "commissionCapPct" | "maxContractsPerClient" | "weekendMarginPct"; label: string; scale?: number; suffix: string; hint: string; max: number; int?: boolean };
const SPECS: Spec[] = [
  { key: "volSpread", label: "Vol spread", scale: 100, suffix: "vol pts", hint: "each side of the mid vol", max: 20 },
  { key: "minSpreadUsd", label: "Min spread", suffix: "USD", hint: "per contract, bid to ask", max: 1000 },
  { key: "commissionPerContract", label: "Commission", suffix: "USD", hint: "per contract, open and close", max: 1000 },
  { key: "commissionCapPct", label: "Commission cap", suffix: "% of premium", hint: "the lower of the two applies", max: 100 },
  { key: "maxContractsPerClient", label: "Max contracts", suffix: "per client", hint: "open, across all series", max: 1_000_000, int: true },
  { key: "weekendMarginPct", label: "Weekend margin", suffix: "% add-on", hint: "on short margin, Fridays", max: 500 },
];

const rank = (g: GroupSettings, group: string, symbol: string) => (g.groupCode === group && g.symbol === symbol ? 0 : g.groupCode === group && g.symbol === "*" ? 1 : g.groupCode === "*" && g.symbol === symbol ? 2 : g.groupCode === "*" && g.symbol === "*" ? 3 : 9);

export function PricingPage() {
  const perms = useOptPerms();
  const block = perms.config ? null : "Read-only for your role";
  const now = useNow();
  const { data, error, reload } = useOpt<{ groups: GroupSettings[]; default: GroupSettings }>("/api/options/groups", { refreshMs: 60_000 });
  const unders = useOpt<{ underlyings: Underlying[] }>("/api/options/underlyings");
  // account groups of this broker (trading engine) for the picker; demo builds use the standard set
  const tg = useApi<{ groups: { code: string; name: string }[] }>(IS_DEMO ? null : "/api/trading/admin/groups");
  const groupCodes = React.useMemo(() => {
    const fromEngine = (tg.data?.groups ?? []).map((g) => g.code);
    const fromRows = (data?.groups ?? []).map((g) => g.groupCode).filter((c) => c !== "*");
    return Array.from(new Set([...(IS_DEMO ? ["standard", "pro", "ecn", "vip", "cent"] : []), ...fromEngine, ...fromRows])).sort();
  }, [tg.data, data]);
  const symbols = (unders.data?.underlyings ?? []).filter((u) => u.enabled).map((u) => u.symbol);
  const [edit, setEdit] = React.useState<{ g: GroupSettings | null; isNew: boolean } | null>(null);
  const [del, setDel] = React.useState<GroupSettings | null>(null);
  const rows = React.useMemo(() => [...(data?.groups ?? [])].sort((a, b) => (a.groupCode === "*" ? -1 : b.groupCode === "*" ? 1 : a.groupCode.localeCompare(b.groupCode)) || (a.symbol === "*" ? -1 : b.symbol === "*" ? 1 : a.symbol.localeCompare(b.symbol))), [data]);
  const def = data?.default ?? rows.find((g) => g.groupCode === "*" && g.symbol === "*") ?? null;

  const cols: Column<GroupSettings>[] = [
    {
      key: "g",
      header: "Group · underlying",
      cell: (g) => (
        <span className="flex flex-col">
          <span className="flex items-center gap-1.5">
            <span className={cn("font-mono text-[12.5px] font-medium", g.groupCode === "*" && "text-ember")}>{g.groupCode === "*" ? "All groups" : g.groupCode}</span>
            <span className="text-fg-3">·</span>
            <span className="font-mono text-[12.5px]">{g.symbol === "*" ? "all underlyings" : g.symbol}</span>
          </span>
          {g.groupCode === "*" && g.symbol === "*" && <span className="text-[10.5px] text-fg-3">broker default</span>}
        </span>
      ),
      sort: (g) => `${g.groupCode}/${g.symbol}`,
      csv: (g) => `${g.groupCode}/${g.symbol}`,
    },
    { key: "vs", header: "Vol spread", align: "right", cell: (g) => <span className="k-num font-mono text-[12.5px]">±{volPts(g.volSpread)}</span>, sort: (g) => g.volSpread, csv: (g) => g.volSpread },
    { key: "ms", header: "Min spread", align: "right", cell: (g) => <span className="k-num font-mono text-[12.5px]">{usd(g.minSpreadUsd, 2)}</span>, sort: (g) => g.minSpreadUsd, csv: (g) => g.minSpreadUsd },
    {
      key: "c",
      header: "Commission",
      align: "right",
      cell: (g) => (
        <span className="k-num whitespace-nowrap font-mono text-[12.5px]">
          {usd(g.commissionPerContract, 2)} <span className="text-fg-3">≤ {formatNumber(g.commissionCapPct, 1)}%</span>
        </span>
      ),
      sort: (g) => g.commissionPerContract,
      csv: (g) => `${g.commissionPerContract} cap ${g.commissionCapPct}%`,
    },
    { key: "mx", header: "Max / client", align: "right", cell: (g) => <span className="k-num font-mono text-[12.5px]">{formatNumber(g.maxContractsPerClient, 0)}</span>, sort: (g) => g.maxContractsPerClient, csv: (g) => g.maxContractsPerClient, hideOn: "md" },
    { key: "wm", header: "Weekend", align: "right", cell: (g) => <span className="k-num font-mono text-[12.5px]">+{formatNumber(g.weekendMarginPct, 0)}%</span>, sort: (g) => g.weekendMarginPct, csv: (g) => g.weekendMarginPct, hideOn: "md" },
    {
      key: "e",
      header: "Options",
      cell: (g) => (
        <Chip size="sm" tone={g.enabled ? "up" : "down"} dot>
          {g.enabled ? "On" : "Off"}
        </Chip>
      ),
      sort: (g) => (g.enabled ? 1 : 0),
      csv: (g) => (g.enabled ? "on" : "off"),
    },
    { key: "u", header: "Updated", cell: (g) => <span className="whitespace-nowrap text-[11.5px] text-fg-3" title={`${when(g.updatedAt)} · ${g.updatedBy}`}>{ago(g.updatedAt, now)}</span>, sort: (g) => g.updatedAt, hideOn: "lg" },
    {
      key: "x",
      header: "",
      align: "right",
      cell: (g) =>
        block ? null : (
          <span className="inline-flex gap-1">
            <Button size="xs" variant="surface" onClick={(e) => (e.stopPropagation(), setEdit({ g, isNew: false }))}>
              <Pencil /> Edit
            </Button>
            {!(g.groupCode === "*" && g.symbol === "*") && (
              <Button size="xs" variant="ghost" onClick={(e) => (e.stopPropagation(), setDel(g))} aria-label={`Delete ${g.groupCode}/${g.symbol}`}>
                <Trash2 />
              </Button>
            )}
          </span>
        ),
    },
  ];

  return (
    <div className="pb-10">
      <PageHeader
        title="Spreads, fees & limits"
        subtitle="Your pricing per account group and underlying. The most specific row wins: group + underlying, then group, then underlying, then your default."
        actions={
          <>
            <Button variant="surface" size="lg" onClick={reload}>
              <RefreshCw /> Refresh
            </Button>
            {!block && (
              <Button variant="ember" size="lg" onClick={() => setEdit({ g: null, isNew: true })}>
                <Plus /> Add override
              </Button>
            )}
          </>
        }
      />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard label="Default vol spread" icon={<Scale />} value={<span className="k-num">{def ? `±${volPts(def.volSpread)}` : "—"}</span>} chip="vol points each side" />
        <KpiCard label="Default commission" icon={<Coins />} value={<span className="k-num">{def ? usd(def.commissionPerContract, 2) : "—"}</span>} chip={def ? `capped at ${formatNumber(def.commissionCapPct, 1)}% of premium` : "per contract"} delay={0.04} />
        <KpiCard label="Overrides" icon={<BadgePercent />} value={<span className="k-num">{Math.max(0, rows.length - 1)}</span>} chip={`${rows.filter((g) => !g.enabled).length} with options off`} delay={0.08} />
        <KpiCard label="Weekend add-on" icon={<Scale />} value={<span className="k-num">{def ? `+${formatNumber(def.weekendMarginPct, 0)}%` : "—"}</span>} chip="short margin on Fridays" delay={0.12} />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 2xl:grid-cols-12">
        <Reveal delay={0.05} className="2xl:col-span-8">
          <Card className="px-4 py-5 sm:px-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-fg-3">
              <span>Shared from Kalks: the vol surface and settlement prices. Yours: everything on this page.</span>
              <ReadOnlyHint text={block} />
            </div>
            {error ? <ErrorState error={error} onRetry={reload} /> : !data ? <TableSkeleton /> : <DataTable columns={cols} rows={rows} dense pageSize={30} rowKey={(g) => `${g.groupCode}/${g.symbol}`} onRowClick={block ? undefined : (g) => setEdit({ g, isNew: false })} exportName="options-group-pricing" />}
          </Card>
        </Reveal>
        <Reveal delay={0.08} className="2xl:col-span-4">
          <EffectiveCard rows={rows} groups={groupCodes} symbols={symbols} />
        </Reveal>
      </div>
      <GroupEditor edit={edit} base={def} groups={groupCodes} symbols={symbols} existing={rows} onClose={() => setEdit(null)} onSaved={reload} />
      <ReasonDialog
        open={!!del}
        onOpenChange={(o) => !o && setDel(null)}
        title={`Delete ${del?.groupCode === "*" ? "All groups" : del?.groupCode} · ${del?.symbol === "*" ? "all underlyings" : del?.symbol}`}
        description="Clients in this group fall back to the next matching row at once."
        codes={REASONS.fees}
        confirmLabel="Delete override"
        confirmVariant="down-outline"
        onConfirm={async (reason) => {
          const r = await optSend("DELETE", `/api/options/groups/${encodeURIComponent(del!.groupCode)}/${encodeURIComponent(del!.symbol)}`, { reason });
          if (r.ok) reload();
          return r;
        }}
        success="Override deleted"
      />
    </div>
  );
}

function EffectiveCard({ rows, groups, symbols }: { rows: GroupSettings[]; groups: string[]; symbols: string[] }) {
  const [group, setGroup] = React.useState("");
  const [sym, setSym] = React.useState("");
  const [n, setN] = React.useState("10");
  const [prem, setPrem] = React.useState("45");
  React.useEffect(() => {
    if (!group && groups.length) setGroup(groups[0]!);
    if (!sym && symbols.length) setSym(symbols[0]!);
  }, [groups, symbols, group, sym]);
  const hit = rows.map((g) => ({ g, r: rank(g, group, sym) })).filter((x) => x.r < 9).sort((a, b) => a.r - b.r)[0]?.g ?? null;
  const contracts = parseNum(n) ?? 0;
  const premium = parseNum(prem) ?? 0;
  const commission = hit ? Math.min(hit.commissionPerContract * contracts, (hit.commissionCapPct / 100) * premium * contracts) : null;
  return (
    <Card className="pb-5">
      <CardHeader title="Effective for a client" subtitle="Which row prices a client in a group, and the commission on an example order." icon={<Calculator />} />
      <div className="mt-4 space-y-3 px-6">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Group">
            <Select value={group} onChange={setGroup} label="Group" options={groups.map((g) => ({ value: g, label: g }))} />
          </Field>
          <Field label="Underlying">
            <Select value={sym} onChange={setSym} label="Underlying" options={symbols.map((s) => ({ value: s, label: s }))} />
          </Field>
          <Field label="Contracts">
            <NumInput value={n} onChange={setN} label="Contracts" />
          </Field>
          <Field label="Premium" hint="per contract">
            <NumInput value={prem} onChange={setPrem} label="Premium per contract" suffix="USD" />
          </Field>
        </div>
        {!hit ? (
          <div className="text-[12.5px] text-fg-3">No row matches: the Kalks default applies.</div>
        ) : (
          <div className="space-y-1.5 rounded-[14px] border border-line bg-surface-2/60 px-3.5 py-3 text-[12.5px]">
            <div className="flex justify-between">
              <span className="text-fg-3">Row used</span>
              <span className="font-mono">
                {hit.groupCode === "*" ? "All groups" : hit.groupCode} · {hit.symbol === "*" ? "all" : hit.symbol}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-fg-3">Options</span>
              <span className={hit.enabled ? "text-up" : "text-down"}>{hit.enabled ? "Tradable" : "Off for this group"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-fg-3">Vol spread</span>
              <span className="k-num font-mono">±{volPts(hit.volSpread)} vol</span>
            </div>
            <div className="flex justify-between">
              <span className="text-fg-3">Commission</span>
              <span className="k-num font-mono">
                min({usd(hit.commissionPerContract, 2)} × {formatNumber(contracts, 0)}, {formatNumber(hit.commissionCapPct, 1)}% × {usd(premium * contracts, 2)}) = <span className="text-fg">{usd(commission, 2)}</span>
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-fg-3">Max contracts</span>
              <span className="k-num font-mono">{formatNumber(hit.maxContractsPerClient, 0)}</span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function GroupEditor({ edit, base, groups, symbols, existing, onClose, onSaved }: { edit: { g: GroupSettings | null; isNew: boolean } | null; base: GroupSettings | null; groups: string[]; symbols: string[]; existing: GroupSettings[]; onClose: () => void; onSaved: () => void }) {
  const [group, setGroup] = React.useState("*");
  const [sym, setSym] = React.useState("*");
  const [vals, setVals] = React.useState<Record<Spec["key"], string>>({} as Record<Spec["key"], string>);
  const [enabled, setEnabled] = React.useState(true);
  React.useEffect(() => {
    if (!edit) return;
    const src = edit.g ?? base;
    setGroup(edit.g?.groupCode ?? groups[0] ?? "*");
    setSym(edit.g?.symbol ?? "*");
    const v = {} as Record<Spec["key"], string>;
    for (const s of SPECS) v[s.key] = src ? String(+((src[s.key] as number) * (s.scale ?? 1)).toPrecision(10)) : "";
    setVals(v);
    setEnabled(src?.enabled ?? true);
  }, [edit, base, groups]);
  if (!edit) return null;
  const parsed: Partial<Record<Spec["key"], number>> = {};
  let invalid: string | null = null;
  for (const s of SPECS) {
    const n = parseNum(vals[s.key] ?? "");
    if (n === null || Number.isNaN(n) || n < 0 || n > s.max || (s.int && !Number.isInteger(n))) invalid ??= `${s.label}: 0–${formatNumber(s.max, 0)}${s.int ? ", whole number" : ""}`;
    else parsed[s.key] = s.scale ? n / s.scale : n;
  }
  if (edit.isNew && existing.some((g) => g.groupCode === group && g.symbol === sym)) invalid ??= "That group / underlying already has a row: edit it instead";
  const changed = edit.g ? SPECS.filter((s) => parsed[s.key] !== undefined && Math.abs((parsed[s.key] as number) - (edit.g![s.key] as number)) > 1e-12).length + (enabled !== edit.g.enabled ? 1 : 0) : 1;
  if (!edit.isNew && !changed) invalid ??= "Nothing changed yet";
  const isDefault = group === "*" && sym === "*";
  return (
    <ReasonDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={edit.isNew ? "Add a pricing override" : `Edit ${group === "*" ? "All groups" : group} · ${sym === "*" ? "all underlyings" : sym}`}
      description={edit.isNew ? "A new row starts from the settings that apply today." : isDefault ? "Your default: every group and underlying without its own row." : "Applies to new quotes and orders at once."}
      codes={REASONS.fees}
      confirmLabel={edit.isNew ? "Add override" : "Save"}
      disabled={invalid}
      onConfirm={async (reason) => {
        const r = await optSend("PUT", `/api/options/groups/${encodeURIComponent(group)}/${encodeURIComponent(sym)}`, { ...parsed, enabled, reason });
        if (r.ok) onSaved();
        return r;
      }}
      success="Pricing saved"
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Account group">
          <Select value={group} onChange={setGroup} label="Account group" disabled={!edit.isNew} options={[{ value: "*", label: "All groups" }, ...groups.map((g) => ({ value: g, label: g }))]} />
        </Field>
        <Field label="Underlying">
          <Select value={sym} onChange={setSym} label="Underlying" disabled={!edit.isNew} options={[{ value: "*", label: "All underlyings" }, ...symbols.map((s) => ({ value: s, label: s }))]} />
        </Field>
        {SPECS.map((s) => (
          <Field key={s.key} label={s.label} hint={s.hint}>
            <NumInput value={vals[s.key] ?? ""} onChange={(v) => setVals((x) => ({ ...x, [s.key]: v }))} label={s.label} suffix={s.suffix} />
          </Field>
        ))}
        <label className="col-span-2 flex items-center gap-2 text-[12.5px]">
          <Toggle checked={enabled} onChange={setEnabled} label="Options enabled" /> Options enabled for {group === "*" ? "all groups" : `group ${group}`}
          {sym !== "*" ? ` on ${sym}` : ""}
        </label>
      </div>
    </ReasonDialog>
  );
}
