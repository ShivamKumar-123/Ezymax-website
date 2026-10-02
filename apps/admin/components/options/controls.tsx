"use client";

/**
 * Options › Dealer controls (O40, O48): halt / close-only / price freeze / manual vol per underlying, expiry or series
 * (optionally until a time), per-client option limits (incl. the live tester allow-list), and voiding an erroneous
 * option trade (shown to the client as a correction).
 *
 *   GET    /api/options/controls?all=                POST /api/options/controls {tenant?, scope, target, mode, manualVol?, frozenSpot?, expiresAt?, reason}
 *   DELETE /api/options/controls/{id} {reason}
 *   GET    /api/options/limits                       PUT|DELETE /api/options/limits/{userId} {…, reason}
 *   POST   /api/trading/admin/options/trades/{ticket}/void {reasonCode, note}   (trading engine)
 */
import * as React from "react";
import Link from "next/link";
import { Ban, OctagonPause, Pencil, Plus, RefreshCw, ShieldOff, Snowflake, Trash2, Undo2, UserCog } from "lucide-react";
import { Button, Card, CardHeader, Chip, DataTable, EmptyState, Field, IconButton, Input, KpiCard, PageHeader, Reveal, Segmented, Toggle, cn, formatNumber, type Column } from "@kalks/ui";
import { ErrorState, TableSkeleton, ago, useNow, when } from "@/components/live/kit";
import type { AdminExpiry, Chain, ClientLimit, Control, ControlMode, ControlScope, Smile, Underlying } from "./types";
import { CONTROL_MODE, NumInput, REASONS, ReasonDialog, Select, countdown, optSend, parseNum, pct, tenantLabel, useOpt, useOptPerms } from "./kit";

const SCOPE_LABEL: Record<ControlScope, string> = { all: "Everything", underlying: "Underlying", expiry: "Expiry", series: "Series" };

export function ControlsPage() {
  const perms = useOptPerms();
  const now = useNow(5000);
  const [showAll, setShowAll] = React.useState(false);
  const ctl = useOpt<{ controls: Control[] }>(`/api/options/controls${showAll ? "?all=true" : ""}`, { refreshMs: 10_000 });
  const limits = useOpt<{ limits: ClientLimit[] }>("/api/options/limits", { refreshMs: 30_000 });
  const unders = useOpt<{ underlyings: Underlying[] }>("/api/options/underlyings");
  const [adding, setAdding] = React.useState(false);
  const [clearing, setClearing] = React.useState<Control | null>(null);
  const [limit, setLimit] = React.useState<{ l: ClientLimit | null; userId?: number } | null>(null);
  const [removeLimit, setRemoveLimit] = React.useState<ClientLimit | null>(null);
  const controls = ctl.data?.controls ?? [];
  const active = controls.filter((c) => c.active && (!c.expiresAt || Date.parse(c.expiresAt) > now));
  const lim = limits.data?.limits ?? [];
  const canClear = (c: Control) => perms.dealing && c.active && (perms.platform || c.tenant === perms.tenant);

  // deep link from the risk desk: /options/controls?limit=<userId>
  React.useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get("limit"));
    if (perms.dealing && Number.isInteger(id) && id > 0 && limits.data) {
      setLimit({ l: limits.data.limits.find((x) => x.userId === id) ?? null, userId: id });
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [limits.data, perms.dealing]);

  const cols: Column<Control>[] = [
    {
      key: "m",
      header: "Control",
      cell: (c) => (
        <span className="flex flex-col gap-1">
          <Chip size="sm" tone={CONTROL_MODE[c.mode]?.tone ?? "neutral"} dot>
            {CONTROL_MODE[c.mode]?.label ?? c.mode}
          </Chip>
          {c.mode === "manual_vol" && <span className="k-num font-mono text-[11px] text-fg-2">ATM {pct(c.manualVol, 2)}</span>}
          {c.mode === "freeze" && <span className="k-num font-mono text-[11px] text-fg-2">spot {c.frozenSpot ?? "—"}</span>}
        </span>
      ),
      sort: (c) => c.mode,
      csv: (c) => c.mode,
    },
    {
      key: "t",
      header: "Applies to",
      cell: (c) => (
        <span className="flex flex-col">
          <span className="text-[11px] text-fg-3">{SCOPE_LABEL[c.scope]}</span>
          <span className="font-mono text-[12.5px]">{c.scope === "all" ? "All options" : c.target}</span>
        </span>
      ),
      sort: (c) => c.target,
      csv: (c) => `${c.scope}:${c.target}`,
    },
    { key: "b", header: "Broker", cell: (c) => <Chip size="sm" tone={c.tenant === "*" ? "ember" : "neutral"}>{tenantLabel(c.tenant)}</Chip>, sort: (c) => c.tenant, csv: (c) => c.tenant, hideOn: "lg" },
    { key: "r", header: "Reason", cell: (c) => <span className="block max-w-[280px] truncate text-[12.5px] text-fg-2" title={c.reason}>{c.reason}</span>, csv: (c) => c.reason },
    {
      key: "e",
      header: "Until",
      cell: (c) =>
        !c.active ? (
          <span className="flex flex-col text-[11.5px] text-fg-3">
            <span>cleared {c.clearedAt ? ago(c.clearedAt, now) : ""}</span>
            <span className="truncate" title={c.clearReason ?? undefined}>
              {c.clearedBy ?? ""}
            </span>
          </span>
        ) : c.expiresAt ? (
          <span className={cn("k-num font-mono text-[12px]", Date.parse(c.expiresAt) <= now ? "text-fg-3" : "text-warn")} title={when(c.expiresAt)}>
            {Date.parse(c.expiresAt) <= now ? "expired" : countdown(c.expiresAt, now)}
          </span>
        ) : (
          <span className="text-[12px] text-fg-3">until cleared</span>
        ),
      sort: (c) => c.expiresAt ?? "9999",
      csv: (c) => c.expiresAt ?? "",
    },
    {
      key: "by",
      header: "Set by",
      cell: (c) => (
        <span className="flex flex-col text-[11.5px]">
          <span className="truncate text-fg-2">{c.createdBy}</span>
          <span className="text-fg-3" title={when(c.createdAt)}>
            {ago(c.createdAt, now)}
          </span>
        </span>
      ),
      sort: (c) => c.createdAt,
      csv: (c) => `${c.createdBy} ${c.createdAt}`,
      hideOn: "md",
    },
    {
      key: "x",
      header: "",
      align: "right",
      cell: (c) =>
        canClear(c) ? (
          <Button size="xs" variant="surface" onClick={(e) => (e.stopPropagation(), setClearing(c))}>
            <Undo2 /> Clear
          </Button>
        ) : !c.active ? (
          <Chip size="sm">Cleared</Chip>
        ) : null,
    },
  ];

  const limitCols: Column<ClientLimit>[] = [
    { key: "u", header: "Client", cell: (l) => <Link href={`/clients/${l.userId}`} className="font-mono text-[12.5px] font-medium hover:text-ember" onClick={(e) => e.stopPropagation()}>#{l.userId}</Link>, sort: (l) => l.userId, csv: (l) => l.userId },
    { key: "m", header: "Max contracts", align: "right", cell: (l) => <span className="k-num font-mono text-[12.5px]">{l.maxContracts === null ? <span className="text-fg-3">group limit</span> : formatNumber(l.maxContracts, 0)}</span>, sort: (l) => l.maxContracts ?? Infinity, csv: (l) => l.maxContracts ?? "" },
    { key: "s", header: "Max short", align: "right", cell: (l) => <span className="k-num font-mono text-[12.5px]">{l.maxShortContracts === null ? <span className="text-fg-3">—</span> : l.maxShortContracts === 0 ? <span className="text-warn">no selling</span> : formatNumber(l.maxShortContracts, 0)}</span>, sort: (l) => l.maxShortContracts ?? Infinity, csv: (l) => l.maxShortContracts ?? "" },
    {
      key: "f",
      header: "Status",
      cell: (l) => (
        <span className="flex flex-wrap gap-1">
          {l.blocked ? <Chip size="sm" tone="down">Blocked</Chip> : l.closeOnly ? <Chip size="sm" tone="warn">Close-only</Chip> : <Chip size="sm" tone="up">Can trade</Chip>}
        </span>
      ),
      sort: (l) => (l.blocked ? 2 : l.closeOnly ? 1 : 0),
      csv: (l) => (l.blocked ? "blocked" : l.closeOnly ? "close_only" : "ok"),
    },
    { key: "r", header: "Reason", cell: (l) => <span className="block max-w-[220px] truncate text-[12.5px] text-fg-2" title={l.reason}>{l.reason}</span>, csv: (l) => l.reason },
    { key: "d", header: "Updated", cell: (l) => <span className="whitespace-nowrap text-[11.5px] text-fg-3" title={`${when(l.updatedAt)} · ${l.updatedBy}`}>{ago(l.updatedAt, now)}</span>, sort: (l) => l.updatedAt, hideOn: "lg" },
    {
      key: "x",
      header: "",
      align: "right",
      cell: (l) =>
        perms.dealing ? (
          <span className="inline-flex gap-1">
            <IconButton size="sm" aria-label={`Edit limit of #${l.userId}`} onClick={(e) => (e.stopPropagation(), setLimit({ l }))}>
              <Pencil />
            </IconButton>
            <IconButton size="sm" aria-label={`Remove limit of #${l.userId}`} onClick={(e) => (e.stopPropagation(), setRemoveLimit(l))}>
              <Trash2 />
            </IconButton>
          </span>
        ) : null,
    },
  ];

  return (
    <div className="pb-10">
      <PageHeader
        title="Dealer controls"
        subtitle="Stop or limit trading in a series, an expiry, an underlying or everything; override the vol; cap single clients; void erroneous trades. Every action needs a reason."
        actions={
          <>
            <Button variant="surface" size="lg" onClick={() => (ctl.reload(), limits.reload())}>
              <RefreshCw /> Refresh
            </Button>
            {perms.dealing && (
              <Button variant="ember" size="lg" onClick={() => setAdding(true)}>
                <Plus /> New control
              </Button>
            )}
          </>
        }
      />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard label="Halts" icon={<OctagonPause />} value={<span className="k-num">{active.filter((c) => c.mode === "halt").length}</span>} chip="no trading" chipTone={active.some((c) => c.mode === "halt") ? "down" : "neutral"} />
        <KpiCard label="Close-only" icon={<Ban />} value={<span className="k-num">{active.filter((c) => c.mode === "close_only").length}</span>} chip="closing allowed" chipTone={active.some((c) => c.mode === "close_only") ? "warn" : "neutral"} delay={0.04} />
        <KpiCard label="Price overrides" icon={<Snowflake />} value={<span className="k-num">{active.filter((c) => c.mode === "freeze" || c.mode === "manual_vol").length}</span>} chip="freeze · manual vol" delay={0.08} />
        <KpiCard label="Client limits" icon={<UserCog />} value={<span className="k-num">{lim.length}</span>} chip={`${lim.filter((l) => l.blocked).length} blocked · ${lim.filter((l) => l.closeOnly).length} close-only`} delay={0.12} />
      </div>

      <Reveal delay={0.05} className="mt-4">
        <Card className="px-4 py-5 sm:px-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-[15px] font-medium">Controls</div>
            <Segmented size="xs" value={showAll ? "all" : "active"} onChange={(v) => setShowAll(v === "all")} options={[{ value: "active", label: `Active (${active.length})` }, { value: "all", label: "With history" }]} />
          </div>
          {ctl.error ? (
            <ErrorState error={ctl.error} onRetry={ctl.reload} />
          ) : !ctl.data ? (
            <TableSkeleton rows={4} />
          ) : (
            <DataTable columns={cols} rows={showAll ? controls : active} dense pageSize={20} rowKey={(c) => String(c.id)} exportName="options-controls" empty={<EmptyState title="No active controls" text="Options trade normally. Session windows before each cut still apply." illustration="check_mark_button" />} />
          )}
        </Card>
      </Reveal>

      <div className="mt-4 grid grid-cols-1 gap-4 2xl:grid-cols-12">
        <Reveal delay={0.08} className="2xl:col-span-8">
          <Card className="pb-5">
            <CardHeader
              title="Client limits"
              subtitle="Per-client caps on top of the group limit. While live options are limited to testers, the allow-list lives here: give each tester a contract cap."
              icon={<UserCog />}
              action={
                perms.dealing && (
                  <Button size="sm" variant="surface" onClick={() => setLimit({ l: null })}>
                    <Plus /> Add client
                  </Button>
                )
              }
            />
            <div className="mt-4 px-4 sm:px-6">{limits.error ? <ErrorState error={limits.error} onRetry={limits.reload} /> : !limits.data ? <TableSkeleton rows={4} /> : <DataTable columns={limitCols} rows={lim} dense pageSize={20} rowKey={(l) => String(l.userId)} exportName="options-client-limits" empty={<EmptyState title="No client limits" text="Every client trades within the group limit." illustration="busts_in_silhouette" />} />}</div>
          </Card>
        </Reveal>
        <Reveal delay={0.1} className="2xl:col-span-4">
          <VoidCard canVoid={perms.dealing} />
        </Reveal>
      </div>

      <NewControlDialog open={adding} onClose={() => setAdding(false)} underlyings={unders.data?.underlyings ?? []} platform={perms.platform} tenant={perms.tenant} onSaved={ctl.reload} />
      <ReasonDialog
        open={!!clearing}
        onOpenChange={(o) => !o && setClearing(null)}
        title={`Clear ${clearing ? (CONTROL_MODE[clearing.mode]?.label ?? clearing.mode).toLowerCase() : ""} on ${clearing?.scope === "all" ? "all options" : clearing?.target}`}
        description="Trading returns to normal for this scope at once (other controls still apply)."
        codes={REASONS.dealing}
        confirmLabel="Clear control"
        onConfirm={async (reason) => {
          const r = await optSend("DELETE", `/api/options/controls/${clearing!.id}`, { reason });
          if (r.ok) ctl.reload();
          return r;
        }}
        success="Control cleared"
      />
      <LimitDialog edit={limit} existing={lim} onClose={() => setLimit(null)} onSaved={limits.reload} />
      <ReasonDialog
        open={!!removeLimit}
        onOpenChange={(o) => !o && setRemoveLimit(null)}
        title={`Remove the limit of client #${removeLimit?.userId}`}
        description="The client trades within the group limit again (and leaves the live tester allow-list, if on it)."
        codes={REASONS.limit}
        confirmLabel="Remove limit"
        confirmVariant="down-outline"
        onConfirm={async (reason) => {
          const r = await optSend("DELETE", `/api/options/limits/${removeLimit!.userId}`, { reason });
          if (r.ok) limits.reload();
          return r;
        }}
        success="Client limit removed"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* New control                                                          */
/* ------------------------------------------------------------------ */

const EXPIRY_QUICK: { label: string; ms: number | null }[] = [
  { label: "None", ms: null },
  { label: "15 min", ms: 15 * 60_000 },
  { label: "1 h", ms: 3600_000 },
  { label: "4 h", ms: 4 * 3600_000 },
  { label: "24 h", ms: 24 * 3600_000 },
];

function localInput(ms: number) {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function NewControlDialog({ open, onClose, underlyings, platform, tenant, onSaved }: { open: boolean; onClose: () => void; underlyings: Underlying[]; platform: boolean; tenant: string; onSaved: () => void }) {
  const enabled = underlyings.filter((u) => u.enabled);
  const [scope, setScope] = React.useState<ControlScope>("underlying");
  const [mode, setMode] = React.useState<ControlMode>("halt");
  const [sym, setSym] = React.useState("");
  const [expiry, setExpiry] = React.useState("");
  const [series, setSeries] = React.useState("");
  const [vol, setVol] = React.useState("");
  const [spot, setSpot] = React.useState("");
  const [until, setUntil] = React.useState("");
  const [everyone, setEveryone] = React.useState(false);
  React.useEffect(() => {
    if (!open) return;
    setScope("underlying");
    setMode("halt");
    setSym(enabled[0]?.symbol ?? "");
    setExpiry("");
    setSeries("");
    setVol("");
    setSpot("");
    setUntil("");
    setEveryone(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const needExpiry = scope === "expiry" || scope === "series";
  const exps = useOpt<{ expiries: AdminExpiry[] }>(open && sym && needExpiry ? `/api/options/expiries?u=${sym}&status=listed&limit=60` : null);
  const listed = React.useMemo(() => [...(exps.data?.expiries ?? [])].sort((a, b) => a.cutAt.localeCompare(b.cutAt)), [exps.data]);
  React.useEffect(() => {
    if (needExpiry && listed.length && !listed.some((e) => e.date === expiry)) setExpiry(listed[0]!.date);
  }, [listed, expiry, needExpiry]);
  const chain = useOpt<Chain>(open && scope === "series" && sym && expiry ? `/api/options/chain?u=${sym}&expiry=${expiry}` : null);
  const codes = (chain.data?.rows ?? []).flatMap((r) => [r.call?.code, r.put?.code]).filter((c): c is string => !!c);
  const smile = useOpt<Smile>(open && mode === "manual_vol" && sym ? `/api/options/smile?u=${sym}${scope === "expiry" && expiry ? `&expiry=${expiry}` : ""}` : null);
  const u = underlyings.find((x) => x.symbol === sym);
  const priceOk = scope === "underlying" || scope === "expiry";
  React.useEffect(() => {
    if (!priceOk && (mode === "freeze" || mode === "manual_vol")) setMode("halt");
  }, [priceOk, mode]);

  const target = scope === "all" ? "*" : scope === "underlying" ? sym : scope === "expiry" ? `${sym}:${expiry}` : series.trim();
  const volN = parseNum(vol);
  const spotN = parseNum(spot);
  const untilMs = until ? new Date(until).getTime() : null;
  const invalid =
    scope !== "all" && !sym
      ? "Choose an underlying"
      : needExpiry && !expiry
        ? "Choose an expiry"
        : scope === "series" && !/^[A-Z0-9.]+-\d{8}-[0-9.]+-[CP]$/.test(series.trim())
          ? "Pick a series code (SYMBOL-YYYYMMDD-STRIKE-C/P)"
          : mode === "manual_vol" && (volN === null || Number.isNaN(volN) || volN <= 0.1 || volN >= 500)
            ? "Manual vol: an ATM vol in percent (e.g. 9.5)"
            : mode === "freeze" && spotN !== null && (Number.isNaN(spotN) || spotN <= 0)
              ? "Frozen spot must be positive (or empty for the current mid)"
              : untilMs !== null && (Number.isNaN(untilMs) || untilMs <= Date.now())
                ? "The end time must be in the future"
                : null;

  return (
    <ReasonDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      side="right"
      title="New dealer control"
      description="Takes effect in the engine's next snapshot (seconds). Overlapping controls all apply; the strictest wins."
      codes={REASONS.dealing}
      confirmLabel={`Set ${CONTROL_MODE[mode]?.label.toLowerCase()}`}
      confirmVariant={mode === "halt" ? "sell" : "ember"}
      disabled={invalid}
      onConfirm={async (reason) => {
        const body: Record<string, unknown> = { scope, target, mode, reason };
        if (platform && everyone) body.tenant = "*";
        if (mode === "manual_vol") body.manualVol = (volN ?? 0) / 100;
        if (mode === "freeze" && spotN !== null) body.frozenSpot = spotN;
        if (untilMs !== null) body.expiresAt = new Date(untilMs).toISOString();
        const r = await optSend("POST", "/api/options/controls", body);
        if (r.ok) onSaved();
        return r;
      }}
      success={`${CONTROL_MODE[mode]?.label} set on ${scope === "all" ? "all options" : target}`}
    >
      <div className="space-y-4">
        <Field label="Scope">
          <Segmented size="sm" value={scope} onChange={setScope} options={(["all", "underlying", "expiry", "series"] as ControlScope[]).map((s) => ({ value: s, label: SCOPE_LABEL[s] }))} />
        </Field>
        {scope !== "all" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Underlying">
              <Select value={sym} onChange={(v) => (setSym(v), setExpiry(""), setSeries(""))} label="Underlying" options={enabled.map((x) => ({ value: x.symbol, label: `${x.symbol} · ${x.name}` }))} />
            </Field>
            {needExpiry && (
              <Field label="Expiry">
                <Select value={expiry} onChange={(v) => (setExpiry(v), setSeries(""))} label="Expiry" disabled={!listed.length} options={listed.length ? listed.map((e) => ({ value: e.date, label: `${e.date} · ${e.kinds.join("/")}` })) : [{ value: "", label: exps.data ? "No listed expiries" : "Loading…" }]} />
              </Field>
            )}
            {scope === "series" && (
              <Field label="Series" className="col-span-2" hint={codes.length ? `${codes.length} listed` : undefined}>
                <Input value={series} onChange={(e) => setSeries(e.target.value.toUpperCase().replace(/\s/g, ""))} list="opt-series-codes" className="font-mono" placeholder={`${sym}-${expiry.replace(/-/g, "")}-…-C`} aria-label="Series code" />
                <datalist id="opt-series-codes">
                  {codes.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
            )}
          </div>
        )}
        <Field label="Mode">
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(CONTROL_MODE) as ControlMode[]).map((m) => {
              const off = (m === "freeze" || m === "manual_vol") && !priceOk;
              return (
                <button
                  key={m}
                  type="button"
                  disabled={off}
                  aria-pressed={mode === m}
                  onClick={() => setMode(m)}
                  className={cn("rounded-[14px] border px-3 py-2.5 text-left transition-colors disabled:opacity-40", mode === m ? "border-ember/50 bg-ember-soft" : "border-line bg-surface-2 hover:border-fg-3")}
                >
                  <div className="flex items-center gap-2 text-[13px] font-medium">
                    {m === "halt" ? <OctagonPause className="size-4 text-down" /> : m === "close_only" ? <Ban className="size-4 text-warn" /> : m === "freeze" ? <Snowflake className="size-4 text-info" /> : <ShieldOff className="size-4 text-gold" />}
                    {CONTROL_MODE[m]!.label}
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-fg-3">{off ? "Underlying or expiry scope only" : CONTROL_MODE[m]!.text}</div>
                </button>
              );
            })}
          </div>
        </Field>
        {mode === "manual_vol" && (
          <Field label="ATM vol" hint={smile.data?.atmVol ? `now ${pct(smile.data.atmVol, 2)}${smile.data.expiry ? ` (${smile.data.expiry})` : ""}` : "replaces the blended ATM"}>
            <NumInput value={vol} onChange={setVol} label="Manual ATM vol" suffix="%" placeholder={smile.data?.atmVol ? (smile.data.atmVol * 100).toFixed(2) : "9.50"} />
          </Field>
        )}
        {mode === "freeze" && (
          <Field label="Frozen spot" hint="empty = the current mid">
            <NumInput value={spot} onChange={setSpot} label="Frozen spot" placeholder={u?.spot ? String(u.spot.mid) : "current mid"} />
          </Field>
        )}
        <Field label="Ends" hint="optional; clear it by hand otherwise">
          <div className="flex flex-wrap items-center gap-1.5">
            {EXPIRY_QUICK.map((q) => (
              <button
                key={q.label}
                type="button"
                onClick={() => setUntil(q.ms === null ? "" : localInput(Date.now() + q.ms))}
                className={cn("rounded-full border px-2.5 py-1 text-[12px]", (q.ms === null && !until) ? "border-ember/50 bg-ember-soft text-fg" : "border-line bg-surface-2 text-fg-3 hover:text-fg")}
              >
                {q.label}
              </button>
            ))}
            <input type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} aria-label="Ends at" className="h-8 rounded-[10px] border border-line bg-surface-2 px-2 text-[12.5px] text-fg outline-none" />
          </div>
        </Field>
        {platform && (
          <label className="flex items-center gap-2 text-[12.5px]">
            <Toggle checked={everyone} onChange={setEveryone} label="All brokers" /> Apply to every broker (platform-wide), not only {tenant}
          </label>
        )}
        {mode === "halt" && <div className="rounded-[14px] border border-down/30 bg-down-soft px-3.5 py-2.5 text-[12.5px]">A halt stops closing too: clients can't exit until it ends. Prefer close-only unless prices are wrong.</div>}
      </div>
    </ReasonDialog>
  );
}

/* ------------------------------------------------------------------ */
/* Client limits                                                        */
/* ------------------------------------------------------------------ */

function LimitDialog({ edit, existing, onClose, onSaved }: { edit: { l: ClientLimit | null; userId?: number } | null; existing: ClientLimit[]; onClose: () => void; onSaved: () => void }) {
  const cur = edit?.l ?? null;
  const [user, setUser] = React.useState("");
  const [max, setMax] = React.useState("");
  const [maxShort, setMaxShort] = React.useState("");
  const [closeOnly, setCloseOnly] = React.useState(false);
  const [blocked, setBlocked] = React.useState(false);
  React.useEffect(() => {
    if (!edit) return;
    setUser(String(cur?.userId ?? edit.userId ?? ""));
    setMax(cur?.maxContracts != null ? String(cur.maxContracts) : "");
    setMaxShort(cur?.maxShortContracts != null ? String(cur.maxShortContracts) : "");
    setCloseOnly(cur?.closeOnly ?? false);
    setBlocked(cur?.blocked ?? false);
  }, [edit, cur]);
  const uid = Number(user);
  const m = parseNum(max);
  const ms = parseNum(maxShort);
  const isNew = !cur;
  const invalid =
    !Number.isInteger(uid) || uid <= 0
      ? "Enter the client ID"
      : isNew && existing.some((l) => l.userId === uid)
        ? "This client already has a limit: edit it"
        : (m !== null && (Number.isNaN(m) || m < 0)) || (ms !== null && (Number.isNaN(ms) || ms < 0))
          ? "Limits are 0 or more"
          : cur && ((cur.maxContracts !== null && m === null) || (cur.maxShortContracts !== null && ms === null))
            ? "A limit can't be emptied here: remove the client's row to drop all limits"
            : m === null && ms === null && !closeOnly && !blocked
              ? "Set a limit, close-only or block"
              : null;
  return (
    <ReasonDialog
      open={!!edit}
      onOpenChange={(o) => !o && onClose()}
      title={isNew ? "Limit a client" : `Client #${cur.userId}`}
      description="Applies to options only, on top of the group's max contracts. Existing positions stay; new orders are checked."
      codes={REASONS.limit}
      confirmLabel="Save limit"
      disabled={invalid}
      onConfirm={async (reason) => {
        const body: Record<string, unknown> = { closeOnly, blocked, reason };
        if (m !== null) body.maxContracts = m;
        if (ms !== null) body.maxShortContracts = ms;
        const r = await optSend("PUT", `/api/options/limits/${uid}`, body);
        if (r.ok) onSaved();
        return r;
      }}
      success={`Limit saved for #${user}`}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Client ID" className="col-span-2">
          <Input value={user} disabled={!isNew} onChange={(e) => setUser(e.target.value.replace(/\D/g, "").slice(0, 18))} className="font-mono" aria-label="Client ID" placeholder="e.g. 10482" />
        </Field>
        <Field label="Max contracts" hint="open, all series">
          <NumInput value={max} onChange={setMax} label="Max contracts" placeholder="group limit" />
        </Field>
        <Field label="Max short contracts" hint="0 = can't sell">
          <NumInput value={maxShort} onChange={setMaxShort} label="Max short contracts" placeholder="no extra cap" />
        </Field>
        <label className="flex items-center gap-2 text-[12.5px]">
          <Toggle checked={closeOnly} onChange={setCloseOnly} label="Close-only" /> Close-only
        </label>
        <label className="flex items-center gap-2 text-[12.5px]">
          <Toggle checked={blocked} onChange={setBlocked} label="Blocked" /> Blocked from options
        </label>
      </div>
    </ReasonDialog>
  );
}

/* ------------------------------------------------------------------ */
/* Void                                                                 */
/* ------------------------------------------------------------------ */

function VoidCard({ canVoid }: { canVoid: boolean }) {
  const [ticket, setTicket] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const ok = /^\d{1,18}$/.test(ticket);
  return (
    <Card className="h-full pb-5">
      <CardHeader title="Void an option trade" subtitle="For an off-market fill or a system error. Premium and commission are reversed and the client sees a correction." icon={<Trash2 />} />
      <div className="mt-4 space-y-3 px-6">
        {canVoid ? (
          <>
            <Field label="Trade ticket">
              <Input value={ticket} onChange={(e) => setTicket(e.target.value.replace(/\D/g, "").slice(0, 18))} className="font-mono" placeholder="e.g. 9104421" aria-label="Trade ticket" />
            </Field>
            <Button variant="down-outline" size="sm" disabled={!ok} onClick={() => setOpen(true)}>
              <Trash2 /> Void trade…
            </Button>
          </>
        ) : (
          <div className="text-[12.5px] text-fg-3">Voids need the options dealing permission.</div>
        )}
      </div>
      <ReasonDialog
        open={open}
        onOpenChange={setOpen}
        title={`Void trade #${ticket}`}
        description="The trading engine reverses the fill (premium and commission) and records a correction on the client's statement. This can't be undone."
        codes={REASONS.void}
        requireNote
        confirmLabel="Void trade"
        confirmVariant="sell"
        engine
        onConfirm={async (_reason, { code, note }) => {
          const r = await optSend("POST", `/api/trading/admin/options/trades/${ticket}/void`, { reasonCode: code, note });
          if (r.ok) setTicket("");
          return r;
        }}
        success={`Trade #${ticket} voided`}
      />
    </Card>
  );
}
