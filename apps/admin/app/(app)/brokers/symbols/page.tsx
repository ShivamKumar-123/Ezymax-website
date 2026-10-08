"use client";

import * as React from "react";
import { toast } from "sonner";
import { ArrowLeftRight, CheckCircle2, Database, Link2, MoreHorizontal, Pencil, Plus, Radio, RefreshCw, Satellite, Share2 } from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  Chip,
  DataTable,
  Dialog,
  DialogClose,
  Field,
  IconButton,
  Input,
  KpiCard,
  Menu,
  PageHeader,
  Reveal,
  Segmented,
  Sparkline,
  SymbolCell,
  Toggle,
  cn,
  formatNumber,
  type Column,
} from "@ezymex/ui";
import { ASSET_CLASS_LABEL, type AssetClass } from "@ezymex/mock/symbols";
import { BRK_FEEDS, BRK_SYMBOLS, BRK_TENANTS, type BrkSymbol } from "@ezymex/mock/admin-platform-brokers";
import { SectionLabel, Select, TenantLogo, timeAgo } from "@/components/brokers/kit";

type ClassFilter = "all" | AssetClass;
const STATUS_TONE = { active: "up", "close-only": "warn", halted: "down" } as const;

export default function SymbolsPage() {
  const [symbols, setSymbols] = React.useState<BrkSymbol[]>(BRK_SYMBOLS);
  const [cls, setCls] = React.useState<ClassFilter>("all");
  const [edit, setEdit] = React.useState<BrkSymbol | null>(null);
  const [sync, setSync] = React.useState(false);
  const rows = cls === "all" ? symbols : symbols.filter((s) => s.assetClass === cls);
  const classes = Object.keys(ASSET_CLASS_LABEL) as AssetClass[];

  const columns: Column<BrkSymbol>[] = [
    { key: "sym", header: "Symbol", cell: (s) => <SymbolCell symbol={s.symbol} />, sort: (s) => s.symbol, width: "20%" },
    { key: "cls", header: "Class", cell: (s) => <Chip size="sm">{ASSET_CLASS_LABEL[s.assetClass]}</Chip>, sort: (s) => s.assetClass, hideOn: "md" },
    { key: "dg", header: "Digits", align: "right", cell: (s) => <span className="k-num">{s.digits}</span>, hideOn: "lg" },
    { key: "cs", header: "Contract", align: "right", cell: (s) => <span className="k-num">{formatNumber(s.contractSize, 0)}</span>, sort: (s) => s.contractSize, hideOn: "lg" },
    {
      key: "map",
      header: "Feed mapping · Infoways ↔ LP",
      cell: (s) => (
        <span className="inline-flex items-center gap-2 font-mono text-[12px]">
          <span className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-fg">{s.feedSymbol}</span>
          <ArrowLeftRight className="size-3 text-ember" />
          <span className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-fg-2">{s.lpSymbol}</span>
        </span>
      ),
    },
    { key: "bk", header: "Backup feed", cell: (s) => <span className="whitespace-nowrap text-[12.5px] text-fg-2">{s.backupFeed}</span>, hideOn: "md" },
    {
      key: "st",
      header: "Status",
      sort: (s) => s.status,
      cell: (s) => (
        <Chip tone={STATUS_TONE[s.status]} dot>
          {s.status === "close-only" ? "Close-only" : s.status[0]!.toUpperCase() + s.status.slice(1)}
        </Chip>
      ),
    },
    {
      key: "ten",
      header: "Tenants",
      align: "right",
      sort: (s) => s.tenantsEnabled,
      cell: (s) => (
        <div className="flex items-center justify-end gap-2">
          <div className="hidden h-1.5 w-14 overflow-hidden rounded-full bg-surface-3 xl:block">
            <div className="h-full rounded-full bg-gold" style={{ width: `${(s.tenantsEnabled / BRK_TENANTS.length) * 100}%` }} />
          </div>
          <span className="k-num w-9 text-right">
            {s.tenantsEnabled}
            <span className="text-fg-3">/{BRK_TENANTS.length}</span>
          </span>
        </div>
      ),
    },
    { key: "sync", header: "Synced", cell: (s) => <span className="text-[12px] text-fg-3">{timeAgo(s.lastSync)}</span>, hideOn: "lg" },
    {
      key: "act",
      header: "",
      align: "right",
      width: "48px",
      cell: (s) => (
        <span onClick={(e) => e.stopPropagation()}>
          <Menu
            trigger={
              <IconButton size="sm" aria-label="Actions">
                <MoreHorizontal />
              </IconButton>
            }
            items={[
              { label: "Edit symbol", icon: <Pencil />, onSelect: () => setEdit(s) },
              { label: "Sync to tenants", icon: <Share2 />, onSelect: () => toast.success(`${s.symbol} synced`, { description: `Pushed to ${s.tenantsEnabled} tenants` }) },
              { label: "Test feed mapping", icon: <Radio />, onSelect: () => toast.success(`${s.feedSymbol} ↔ ${s.lpSymbol} OK`, { description: "Last tick 38ms ago · spread within tolerance" }) },
            ]}
          />
        </span>
      ),
    },
  ];

  return (
    <div className="pb-16">
      <PageHeader
        title="Global symbols"
        subtitle="Platform-wide symbol master and feed mapping. Tenants inherit specs; spreads and swaps stay tenant-level."
        actions={
          <>
            <Button variant="surface" onClick={() => toast.success("Symbol added to draft", { description: "Complete the spec before syncing" })}>
              <Plus /> Add symbol
            </Button>
            <Button variant="ember" onClick={() => setSync(true)}>
              <Share2 /> Sync to tenants
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Symbols in master" icon={<Database />} value={<span className="k-num">{formatNumber(1240, 0)}</span>} chip={`${symbols.length} shown · 6 classes`} delay={0} />
        <KpiCard label="Feeds connected" icon={<Satellite />} value={<span className="k-num">{BRK_FEEDS.length}</span>} footer={<div className="flex gap-1.5"><Chip size="sm" tone="up">{BRK_FEEDS.filter((f) => f.status === "live").length} live</Chip><Chip size="sm" tone="warn">{BRK_FEEDS.filter((f) => f.status === "degraded").length} degraded</Chip></div>} illustration="satellite_antenna" delay={0.05} />
        <KpiCard label="Mapping coverage" icon={<Link2 />} hot value={<span className="k-num">99.2%</span>} chip="10 unmapped on backup" chipTone="warn" delay={0.1} />
        <KpiCard label="Last tenant sync" icon={<RefreshCw />} value={<span className="k-num">11:30<span className="ml-1.5 text-sm font-normal text-fg-3">GMT+3</span></span>} chip="9 tenants OK · every 30 min" chipTone="up" delay={0.15} />
      </div>

      <Reveal delay={0.1} className="mt-4">
        <FeedHealth />
      </Reveal>

      <Reveal delay={0.1} className="mt-4">
          <Card>
            <CardHeader title="Symbol master" subtitle="Click a row to edit spec and mapping" />
            <div className="mt-4 px-4 pb-5 sm:px-6">
              <DataTable
                columns={columns}
                rows={rows}
                rowKey={(s) => s.symbol}
                pageSize={12}
                dense
                search={(s) => `${s.symbol} ${s.name} ${s.feedSymbol} ${s.lpSymbol}`}
                searchPlaceholder="Symbol or feed code…"
                exportName="symbol-master"
                onRowClick={setEdit}
                toolbar={
                  <Segmented
                    size="xs"
                    value={cls}
                    onChange={setCls}
                    options={[{ value: "all" as ClassFilter, label: "All" }, ...classes.map((c) => ({ value: c as ClassFilter, label: ASSET_CLASS_LABEL[c] }))]}
                  />
                }
              />
            </div>
          </Card>
      </Reveal>

      <EditSymbolDialog
        sym={edit}
        onClose={() => setEdit(null)}
        onSave={(s) => {
          setSymbols((xs) => xs.map((x) => (x.symbol === s.symbol ? s : x)));
          toast.success(`${s.symbol} saved`, { description: "Change queued — sync to push to tenants" });
          setEdit(null);
        }}
      />
      <SyncDialog open={sync} onOpenChange={setSync} />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function FeedHealth() {
  return (
    <Card>
      <CardHeader
        title="Feed health"
        subtitle="Latency over the last 20 minutes · auto-failover when primary stalls > 3s"
        action={
          <Button size="sm" variant="surface" onClick={() => toast.success("Failover drill scheduled", { description: "Sunday 03:00 GMT+3 · Infoways → Finalto FIX" })}>
            Schedule failover drill
          </Button>
        }
      />
      <div className="mt-4 grid grid-cols-1 gap-3 px-4 pb-5 sm:grid-cols-2 sm:px-6 xl:grid-cols-4">
        {BRK_FEEDS.map((f) => (
          <div key={f.name} className={cn("k-row p-3.5", f.status === "degraded" && "border-warn/30")}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[13.5px] font-medium">
                  <span className={cn("size-2 rounded-full", f.status === "live" ? "animate-pulse-dot bg-up" : "bg-warn")} />
                  {f.name}
                </div>
                <div className="mt-0.5 text-[11.5px] text-fg-3">
                  {f.role} · {f.protocol}
                </div>
              </div>
              <div className="text-right">
                <div className={cn("k-num text-[15px] font-semibold", f.status === "degraded" ? "text-warn" : "text-fg")}>{f.latency}ms</div>
                <div className="k-num text-[11px] text-fg-3">{f.uptime}%</div>
              </div>
            </div>
            <Sparkline data={f.series} width={300} height={34} tone={f.status === "degraded" ? "ember" : "up"} className="mt-2 w-full" />
            <div className="k-num mt-1.5 flex justify-between text-[11px] text-fg-3">
              <span>{formatNumber(f.ticks, 0)} ticks/s</span>
              <span>{formatNumber(f.symbols, 0)} symbols</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function EditSymbolDialog({ sym, onClose, onSave }: { sym: BrkSymbol | null; onClose: () => void; onSave: (s: BrkSymbol) => void }) {
  const [s, setS] = React.useState<BrkSymbol | null>(sym);
  React.useEffect(() => setS(sym), [sym]);
  if (!s) return null;
  const set = <K extends keyof BrkSymbol>(k: K, v: BrkSymbol[K]) => setS((p) => (p ? { ...p, [k]: v } : p));
  return (
    <Dialog
      open={!!sym}
      onOpenChange={(o) => !o && onClose()}
      width={680}
      title={
        <span className="flex items-center gap-3">
          <SymbolCell symbol={s.symbol} />
        </span>
      }
      description="Changes to the master spec apply to every tenant that has this symbol enabled."
      footer={
        <>
          <DialogClose asChild>
            <Button size="sm" variant="ghost">
              Cancel
            </Button>
          </DialogClose>
          <Button size="sm" variant="ember" onClick={() => onSave(s)}>
            Save symbol
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <SectionLabel>Specification</SectionLabel>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="Digits">
              <Input value={String(s.digits)} onChange={(e) => set("digits", Number(e.target.value) || 0)} inputClassName="k-num" />
            </Field>
            <Field label="Contract size">
              <Input value={String(s.contractSize)} onChange={(e) => set("contractSize", Number(e.target.value) || 0)} inputClassName="k-num" />
            </Field>
            <Field label="Min lot">
              <Input value={String(s.minLot)} onChange={(e) => set("minLot", Number(e.target.value) || 0)} inputClassName="k-num" />
            </Field>
            <Field label="Max lot">
              <Input value={String(s.maxLot)} onChange={(e) => set("maxLot", Number(e.target.value) || 0)} inputClassName="k-num" />
            </Field>
          </div>
        </div>
        <div>
          <SectionLabel>Feed mapping</SectionLabel>
          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
            <Field label="Infoways (primary)">
              <Input value={s.feedSymbol} onChange={(e) => set("feedSymbol", e.target.value)} inputClassName="font-mono" />
            </Field>
            <span className="mb-3 hidden size-7 place-items-center rounded-full border border-ember/30 bg-ember-soft text-ember sm:grid">
              <ArrowLeftRight className="size-3.5" />
            </span>
            <Field label="Liquidity provider">
              <Input value={s.lpSymbol} onChange={(e) => set("lpSymbol", e.target.value)} inputClassName="font-mono" />
            </Field>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Backup feed">
              <Select value={s.backupFeed} onChange={(v) => set("backupFeed", v)} options={BRK_FEEDS.filter((f) => f.name !== "Infoways").map((f) => f.name)} />
            </Field>
            <Field label="Trading sessions">
              <Input value={s.sessions} onChange={(e) => set("sessions", e.target.value)} />
            </Field>
          </div>
          <button type="button" onClick={() => toast.success(`${s.feedSymbol} ↔ ${s.lpSymbol} resolved`, { description: "Both legs streaming · price deviation 0.2 pips" })} className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] text-ember hover:underline">
            <CheckCircle2 className="size-3.5" /> Test mapping against live feeds
          </button>
        </div>
        <div>
          <SectionLabel>Status</SectionLabel>
          <Segmented
            value={s.status}
            onChange={(v) => set("status", v)}
            options={[
              { value: "active", label: "Active" },
              { value: "close-only", label: "Close-only" },
              { value: "halted", label: "Halted" },
            ]}
          />
        </div>
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */

function SyncDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const tenants = BRK_TENANTS.filter((t) => t.status !== "onboarding");
  const [sel, setSel] = React.useState<string[]>(tenants.filter((t) => t.status !== "suspended").map((t) => t.id));
  const [overwrite, setOverwrite] = React.useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      width={620}
      title="Sync symbol master to tenants"
      description="Pushes specs and feed mappings. Tenant spreads, swaps and group settings are never overwritten unless you opt in."
      footer={
        <>
          <DialogClose asChild>
            <Button size="sm" variant="ghost">
              Cancel
            </Button>
          </DialogClose>
          <Button
            size="sm"
            variant="ember"
            disabled={!sel.length}
            onClick={() => {
              onOpenChange(false);
              toast.success(`Sync started for ${sel.length} tenants`, { description: "3 spec changes · 1 new mapping · ETA 40s" });
            }}
          >
            <Share2 /> Sync {sel.length} tenants
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-3">
          {[
            ["Spec changes", "3", "text-fg"],
            ["New mappings", "1", "text-up"],
            ["Status changes", "2", "text-warn"],
          ].map(([l, v, c]) => (
            <div key={l} className="k-row px-4 py-3">
              <div className="k-label">{l}</div>
              <div className={`k-num mt-1 text-xl font-semibold ${c}`}>{v}</div>
            </div>
          ))}
        </div>
        <div>
          <SectionLabel action={<button className="text-[12px] text-fg-3 hover:text-fg" onClick={() => setSel(sel.length === tenants.length ? [] : tenants.map((t) => t.id))}>{sel.length === tenants.length ? "Clear" : "Select all"}</button>}>Tenants</SectionLabel>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {tenants.map((t) => {
              const on = sel.includes(t.id);
              return (
                <button key={t.id} type="button" onClick={() => setSel((xs) => (on ? xs.filter((x) => x !== t.id) : [...xs, t.id]))} className={cn("flex items-center gap-3 rounded-[14px] border px-3 py-2.5 text-left transition-colors", on ? "border-ember/35 bg-ember-soft" : "border-line bg-surface-2 hover:bg-surface-3")}>
                  <TenantLogo color={t.color} mark={t.mark} size={26} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{t.name}</span>
                    <span className="k-num block text-[11px] text-fg-3">{t.symbols} symbols{t.status === "suspended" ? " · suspended" : ""}</span>
                  </span>
                  <span className={cn("grid size-5 place-items-center rounded-md border", on ? "border-ember bg-ember text-white" : "border-line")}>{on && <CheckCircle2 className="size-3.5" />}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="k-row flex items-center justify-between gap-4 p-4">
          <div>
            <div className="text-[13.5px] font-medium">Overwrite tenant-level overrides</div>
            <div className="text-[12px] text-fg-3">Resets digits/contract size customised by tenants</div>
          </div>
          <Toggle checked={overwrite} onChange={setOverwrite} label="Overwrite overrides" />
        </div>
      </div>
    </Dialog>
  );
}
