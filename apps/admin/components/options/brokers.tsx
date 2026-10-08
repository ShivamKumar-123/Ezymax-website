"use client";

/**
 * Options › Brokers access (O42, O48): the module switches per broker. Options are off for a broker until Ezymex
 * switches them on; demo and live accounts are separate switches, the public option chain is Ezymex' own, and a broker
 * can be limited to some underlyings. Only Ezymex staff change these (switching another broker is the Platform
 * Owner's call); every change needs a reason.
 *
 *   GET /api/options/tenants          PUT /api/options/tenants/{tenant} {enabledDemo?, enabledLive?, publicChain?, underlyings?, reason}
 *   GET /api/owner/tenants            the broker list (Platform Owner)
 */
import * as React from "react";
import Link from "next/link";
import { Building2, Eye, FlaskConical, Globe2, RefreshCw, ShieldAlert, SlidersHorizontal, TriangleAlert } from "lucide-react";
import { Button, Card, Chip, EmptyState, KpiCard, PageHeader, Reveal, Toggle, cn } from "@ezymex/ui";
import { ErrorState, TableSkeleton, ago, useNow, when } from "@/components/live/kit";
import type { TenantSettings, Underlying } from "./types";
import { REASONS, ReasonDialog, ReadOnlyHint, optSend, useOpt, useOptPerms } from "./kit";

type Broker = { slug: string; name: string; status: string; settings: TenantSettings | null };
type Change = { broker: Broker; patch: Partial<Pick<TenantSettings, "enabledDemo" | "enabledLive" | "publicChain">> & { underlyings?: string[] } };

const SWITCH: Record<"enabledDemo" | "enabledLive" | "publicChain", { label: string; text: string }> = {
  enabledDemo: { label: "Demo accounts", text: "Clients can trade options on demo accounts." },
  enabledLive: { label: "Live accounts", text: "Real money: clients can buy and sell options on live accounts." },
  publicChain: { label: "Public chain", text: "The guest option chain (trade.ezymex.com/options/chain) and the public API." },
};

export function BrokersPage() {
  const perms = useOptPerms();
  const now = useNow();
  const t = useOpt<{ tenants: TenantSettings[] }>("/api/options/tenants", { refreshMs: 30_000 });
  const owner = useOpt<{ items: { slug: string; name: string; status: string }[] }>(perms.owner && perms.platform ? "/api/owner/tenants" : null);
  const unders = useOpt<{ underlyings: Underlying[] }>("/api/options/underlyings");
  const [change, setChange] = React.useState<Change | null>(null);
  const [pick, setPick] = React.useState<Broker | null>(null);

  const brokers: Broker[] = React.useMemo(() => {
    const settings = new Map((t.data?.tenants ?? []).map((x) => [x.tenant, x]));
    const list: Broker[] = (owner.data?.items ?? []).map((b) => ({ slug: b.slug, name: b.name, status: b.status, settings: settings.get(b.slug) ?? null }));
    for (const s of t.data?.tenants ?? []) if (!list.some((b) => b.slug === s.tenant)) list.push({ slug: s.tenant, name: s.tenant, status: "active", settings: s });
    return list.sort((a, b) => (a.slug === "ezymex" ? -1 : b.slug === "ezymex" ? 1 : a.name.localeCompare(b.name)));
  }, [t.data, owner.data]);
  const editable = (b: Broker) => perms.config && perms.platform && (b.slug === perms.tenant || perms.owner);
  const block = !perms.config ? "Read-only for your role" : !perms.platform ? "Only Ezymex switches Options on or off" : null;
  const on = (b: Broker) => !!b.settings && (b.settings.enabledDemo || b.settings.enabledLive);

  return (
    <div className="pb-10">
      <PageHeader
        title="Brokers access"
        subtitle="Which brokers offer Ezymex FX Options, on demo and on live accounts. A broker without a row is off. Vol surfaces and settlement prices are always shared from Ezymex."
        actions={
          <Button variant="surface" size="lg" onClick={() => (t.reload(), owner.reload())}>
            <RefreshCw /> Refresh
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard label="Brokers with options" icon={<Building2 />} value={<span className="k-num">{brokers.filter(on).length}</span>} chip={`of ${brokers.length}`} />
        <KpiCard label="Demo on" icon={<FlaskConical />} value={<span className="k-num">{brokers.filter((b) => b.settings?.enabledDemo).length}</span>} chip="practice accounts" chipTone="up" delay={0.04} />
        <KpiCard label="Live on" icon={<ShieldAlert />} value={<span className="k-num">{brokers.filter((b) => b.settings?.enabledLive).length}</span>} chip="real money" chipTone={brokers.some((b) => b.settings?.enabledLive) ? "down" : "neutral"} delay={0.08} />
        <KpiCard label="Public chain" icon={<Globe2 />} value={<span className="k-num">{brokers.find((b) => b.slug === "ezymex")?.settings?.publicChain ? "On" : "Off"}</span>} chip="guest view (Ezymex)" delay={0.12} />
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-[18px] border border-down/30 bg-down-soft px-4 py-3.5 text-[13px]">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-down" />
        <div>
          <div className="font-medium text-fg">Live means real money.</div>
          <div className="mt-0.5 text-fg-2">
            With Live on, the broker's clients buy and sell options with their own funds, and the house takes the other side. Switch it on only after the broker's jurisdiction check, with tester caps in{" "}
            <Link href="/options/controls" className="underline underline-offset-2 hover:text-ember">
              Dealer controls › Client limits
            </Link>{" "}
            while you test, and the risk desk watching.
          </div>
        </div>
      </div>

      <Reveal delay={0.05} className="mt-4">
        <Card className="px-4 py-5 sm:px-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-fg-3">
            <span>{perms.owner && perms.platform ? "Every broker on the platform." : "Brokers with an options row."}</span>
            <ReadOnlyHint text={block} />
          </div>
          {t.error ? (
            <ErrorState error={t.error} onRetry={t.reload} />
          ) : !t.data ? (
            <TableSkeleton rows={4} />
          ) : !brokers.length ? (
            <EmptyState title="No brokers" illustration="globe_with_meridians" />
          ) : (
            <div className="space-y-2">
              {brokers.map((b) => {
                const s = b.settings;
                const can = editable(b);
                return (
                  <div key={b.slug} className="k-row grid grid-cols-1 items-center gap-3 px-4 py-3.5 lg:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,1fr))_minmax(0,1.2fr)]">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-[12px] border border-line bg-surface-2 font-mono text-[12px] font-semibold uppercase">{b.name.slice(0, 2)}</span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate font-medium">{b.name}</span>
                          <span className="font-mono text-[11px] text-fg-3">{b.slug}</span>
                          {b.slug === "ezymex" && <Chip size="sm" tone="ember">platform</Chip>}
                          {b.status !== "active" && <Chip size="sm" tone="down">{b.status}</Chip>}
                        </div>
                        <div className="text-[11px] text-fg-3" title={s ? when(s.updatedAt) : undefined}>
                          {s ? `${s.updatedBy || "—"} · ${ago(s.updatedAt, now)}` : "Options off (no row)"}
                        </div>
                      </div>
                    </div>
                    {(["enabledDemo", "enabledLive", "publicChain"] as const).map((k) => {
                      const val = !!s?.[k];
                      const na = k === "publicChain" && b.slug !== "ezymex";
                      return (
                        <label key={k} className={cn("flex items-center gap-2 text-[12.5px]", na && "opacity-40")} title={na ? "The public chain is Ezymex' own guest page" : SWITCH[k].text}>
                          {can && !na ? (
                            <Toggle checked={val} onChange={(v) => setChange({ broker: b, patch: { [k]: v } })} label={`${SWITCH[k].label} for ${b.name}`} />
                          ) : (
                            <Chip size="sm" tone={val ? (k === "enabledLive" ? "down" : "up") : "neutral"} dot>
                              {val ? "On" : "Off"}
                            </Chip>
                          )}
                          <span className={cn(k === "enabledLive" && val && "font-medium text-down")}>{SWITCH[k].label}</span>
                        </label>
                      );
                    })}
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 flex-wrap gap-1">
                        {!s?.underlyings ? (
                          <Chip size="sm">All underlyings</Chip>
                        ) : (
                          <>
                            {s.underlyings.slice(0, 4).map((u) => (
                              <Chip key={u} size="sm">
                                {u}
                              </Chip>
                            ))}
                            {s.underlyings.length > 4 && <span className="text-[11px] text-fg-3">+{s.underlyings.length - 4}</span>}
                          </>
                        )}
                      </span>
                      {can && (
                        <Button size="xs" variant="ghost" onClick={() => setPick(b)}>
                          <SlidersHorizontal /> Underlyings
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-4 flex items-center gap-2 text-[12px] text-fg-3">
            <Eye className="size-3.5" /> The engine checks the switch on every order; switching off makes the broker's open option positions close-only.
          </div>
        </Card>
      </Reveal>

      <SwitchDialog change={change} onClose={() => setChange(null)} onSaved={t.reload} />
      <UnderlyingsDialog broker={pick} all={(unders.data?.underlyings ?? []).filter((u) => u.enabled).map((u) => u.symbol)} onClose={() => setPick(null)} onSaved={t.reload} />
    </div>
  );
}

function SwitchDialog({ change, onClose, onSaved }: { change: Change | null; onClose: () => void; onSaved: () => void }) {
  const [ack, setAck] = React.useState(false);
  React.useEffect(() => setAck(false), [change]);
  if (!change) return null;
  const [key, val] = Object.entries(change.patch)[0] as ["enabledDemo" | "enabledLive" | "publicChain", boolean];
  const liveOn = key === "enabledLive" && val;
  const name = change.broker.name;
  return (
    <ReasonDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`${val ? "Switch on" : "Switch off"} ${SWITCH[key].label.toLowerCase()} for ${name}`}
      description={val ? SWITCH[key].text : key === "publicChain" ? "The guest chain and public API answer 404 again." : `New option orders are refused; open positions become close-only.`}
      codes={REASONS.broker}
      confirmLabel={val ? "Switch on" : "Switch off"}
      confirmVariant={liveOn ? "sell" : "ember"}
      disabled={liveOn && !ack ? "Confirm that you understand live means real money" : null}
      onConfirm={async (reason) => {
        const r = await optSend("PUT", `/api/options/tenants/${change.broker.slug}`, { ...change.patch, reason });
        if (r.ok) onSaved();
        return r;
      }}
      success={`${SWITCH[key].label} ${val ? "on" : "off"} for ${name}`}
    >
      {liveOn && (
        <div className="space-y-3 rounded-[14px] border border-down/40 bg-down-soft px-4 py-3 text-[12.5px]">
          <div className="flex items-center gap-2 font-medium text-down">
            <ShieldAlert className="size-4" /> Live means real money
          </div>
          <ul className="list-disc space-y-1 pl-5 text-fg-2">
            <li>{name}'s clients will buy and sell options with real funds; the house takes the other side of every trade.</li>
            <li>Check the broker's jurisdiction first: some regulators treat cash-settled options like CFDs (leverage caps, warnings).</li>
            <li>While testing, cap testers in Client limits and keep the risk desk open.</li>
          </ul>
          <label className="flex items-center gap-2 text-fg">
            <Toggle checked={ack} onChange={setAck} label="I understand" /> I understand this enables real-money option trading for {name}.
          </label>
        </div>
      )}
    </ReasonDialog>
  );
}

function UnderlyingsDialog({ broker, all, onClose, onSaved }: { broker: Broker | null; all: string[]; onClose: () => void; onSaved: () => void }) {
  const [sel, setSel] = React.useState<string[] | null>(null);
  React.useEffect(() => setSel(broker ? (broker.settings?.underlyings ?? null) : null), [broker]);
  const cur = broker?.settings?.underlyings ?? null;
  const same = JSON.stringify(sel ? [...sel].sort() : null) === JSON.stringify(cur ? [...cur].sort() : null);
  return (
    <ReasonDialog
      open={!!broker}
      onOpenChange={(o) => !o && onClose()}
      title={`Underlyings for ${broker?.name ?? ""}`}
      description="Limit which underlyings this broker's clients see and trade. All = every enabled underlying, including new ones."
      codes={REASONS.broker}
      confirmLabel="Save underlyings"
      disabled={same ? "Nothing changed yet" : sel && !sel.length ? "Pick at least one, or All" : null}
      onConfirm={async (reason) => {
        const r = await optSend("PUT", `/api/options/tenants/${broker!.slug}`, { underlyings: sel ?? [], reason });
        if (r.ok) onSaved();
        return r;
      }}
      success="Underlyings saved"
    >
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-[12.5px]">
          <Toggle checked={sel === null} onChange={(v) => setSel(v ? null : [...all])} label="All underlyings" /> All underlyings
        </label>
        <div className="flex flex-wrap gap-1.5">
          {all.map((u) => {
            const on = sel === null || sel.includes(u);
            return (
              <button
                key={u}
                type="button"
                disabled={sel === null}
                aria-pressed={on}
                onClick={() => setSel((s) => (s === null ? s : s.includes(u) ? s.filter((x) => x !== u) : [...s, u]))}
                className={cn("rounded-full border px-2.5 py-1 font-mono text-[12px] disabled:opacity-60", on ? "border-ember/50 bg-ember-soft text-fg" : "border-line bg-surface-2 text-fg-3 hover:text-fg")}
              >
                {u}
              </button>
            );
          })}
        </div>
      </div>
    </ReasonDialog>
  );
}
