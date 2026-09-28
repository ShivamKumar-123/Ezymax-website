"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, ChevronsDownUp, ChevronsUpDown, Infinity as InfinityIcon, Network, Users } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, Card, CardHeader, Chip, Donut, Flag, Icon3D, Money, PageHeader, Progress, Reveal, cn, formatMoney } from "@kalks/ui";
import { ME } from "@kalks/mock";
import { PARTNER, REFERRED_CLIENTS, TIERS, type ReferredClient } from "@kalks/mock/partner";
import { TierChip } from "@/components/partner/partner-bits";
import { IS_DEMO } from "@kalks/mock/mode";
import { LivePartnerNetwork } from "@/components/partner/live/network";

/* ------------------------------------------------------------------ */
/* Tree helpers                                                        */
/* ------------------------------------------------------------------ */

const childrenOf = (id: string) => REFERRED_CLIENTS.filter((c) => c.parentId === id).sort((a, b) => Number(b.isSubIb) - Number(a.isSubIb) || b.lotsMonth - a.lotsMonth);
function subtree(c: ReferredClient): ReferredClient[] {
  return childrenOf(c.id).flatMap((k) => [k, ...subtree(k)]);
}
const TIER_SHARE: Record<number, number> = { 1: 1, 2: 0.2, 3: 0.1 };

const directIbs = REFERRED_CLIENTS.filter((c) => c.tier === 1 && c.isSubIb);
const directClients = REFERRED_CLIENTS.filter((c) => c.tier === 1 && !c.isSubIb).sort((a, b) => b.lotsMonth - a.lotsMonth);

type OpenMap = Record<string, boolean>;
const OpenCtx = React.createContext<{ open: OpenMap; toggle: (id: string) => void }>({ open: {}, toggle: () => {} });

/* ------------------------------------------------------------------ */

function Branch({ children, last }: { children: React.ReactNode; last: boolean }) {
  return (
    <li className="relative pl-4 sm:pl-9">
      <span aria-hidden className={cn("absolute left-0 top-0 w-px bg-gradient-to-b from-ember/50 to-fg-3/30", last ? "h-[30px]" : "h-full")} />
      <span aria-hidden className="absolute left-0 top-[30px] h-px w-4 bg-fg-3/40 sm:w-9" />
      <span aria-hidden className="absolute left-4 top-[27px] size-[7px] -translate-x-1/2 rounded-full border border-ember/60 bg-bg sm:left-9" />
      <div className="pb-2.5">{children}</div>
    </li>
  );
}

function Collapsible({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function NodeStats({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <div className="hidden items-center gap-5 md:flex">
      {items.map(([k, v]) => (
        <div key={k} className="text-right">
          <div className="text-[10.5px] uppercase tracking-wider text-fg-3">{k}</div>
          <div className="k-num text-[13px] font-medium">{v}</div>
        </div>
      ))}
    </div>
  );
}

function ClientNode({ c }: { c: ReferredClient }) {
  const { open, toggle } = React.useContext(OpenCtx);
  const kids = childrenOf(c.id);
  const isOpen = !!open[c.id];
  const net = c.isSubIb ? subtree(c) : [];
  const netLots = c.lotsMonth + net.reduce((s, k) => s + k.lotsMonth, 0);
  const yourComm = [c, ...net].reduce((s, k) => s + k.commission, 0);
  return (
    <div>
      <div
        onClick={kids.length ? () => toggle(c.id) : undefined}
        className={cn(
          "flex items-center gap-3 rounded-[14px] border px-3.5 py-2.5 transition-colors",
          c.isSubIb ? "border-gold/25 bg-gradient-to-r from-gold/[0.07] to-surface-2" : "border-line bg-surface-2",
          kids.length && "cursor-pointer hover:border-[var(--k-border-top)]",
        )}
      >
        <span className="relative shrink-0">
          <Avatar src={c.photo} name={c.name} size={c.isSubIb ? 40 : 32} />
          <Flag country={c.country} className="absolute -bottom-0.5 -right-1 size-3.5 ring-2 ring-surface-2" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-[13.5px] font-medium">{c.name}</span>
            <TierChip tier={c.tier} />
            {c.isSubIb && (
              <Chip size="sm" tone="gold">
                Sub-IB
              </Chip>
            )}
          </div>
          <div className="mt-0.5 truncate text-[11.5px] text-fg-3">
            {c.isSubIb ? `${net.length} clients in network · ${netLots.toFixed(1)} lots this month` : `${c.lotsMonth ? `${c.lotsMonth.toFixed(2)} lots` : "No trades"} this month · ${c.countryName}`}
          </div>
        </div>
        <NodeStats
          items={[
            ["Lots · Sep", netLots.toFixed(2)],
            ["To you", <span key="c" className="text-up">{formatMoney(yourComm, "USD", 0)}</span>],
          ]}
        />
        {kids.length > 0 && (
          <span className="grid size-7 shrink-0 place-items-center rounded-full border border-line bg-surface-3 text-fg-2">
            <ChevronDown className={cn("size-3.5 transition-transform", isOpen && "rotate-180")} />
          </span>
        )}
      </div>
      {kids.length > 0 && (
        <Collapsible open={isOpen}>
          <ul className="ml-3 mt-2.5 sm:ml-5">
            {kids.map((k, i) => (
              <Branch key={k.id} last={i === kids.length - 1}>
                <ClientNode c={k} />
              </Branch>
            ))}
          </ul>
        </Collapsible>
      )}
    </div>
  );
}

function DirectGroupNode() {
  const { open, toggle } = React.useContext(OpenCtx);
  const [all, setAll] = React.useState(false);
  const isOpen = !!open["direct"];
  const lots = directClients.reduce((s, c) => s + c.lotsMonth, 0);
  const comm = directClients.reduce((s, c) => s + c.commission, 0);
  const list = all ? directClients : directClients.slice(0, 12);
  return (
    <div>
      <div onClick={() => toggle("direct")} className="flex cursor-pointer items-center gap-3 rounded-[14px] border border-ember/25 bg-gradient-to-r from-ember/[0.08] to-surface-2 px-3.5 py-2.5 hover:border-ember/40">
        <div className="flex -space-x-2.5">
          {directClients.filter((c) => c.photo).slice(0, 4).map((c) => (
            <Avatar key={c.id} src={c.photo} name={c.name} size={30} className="rounded-full ring-2 ring-surface-2" />
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[13.5px] font-medium">
            {directClients.length} direct clients <TierChip tier={1} />
          </div>
          <div className="truncate text-[11.5px] text-fg-3">{directClients.filter((c) => c.status === "active").length} active this month · signed up with your link</div>
        </div>
        <NodeStats
          items={[
            ["Lots · Sep", lots.toFixed(2)],
            ["To you", <span key="c" className="text-up">{formatMoney(comm, "USD", 0)}</span>],
          ]}
        />
        <span className="grid size-7 shrink-0 place-items-center rounded-full border border-line bg-surface-3 text-fg-2">
          <ChevronDown className={cn("size-3.5 transition-transform", isOpen && "rotate-180")} />
        </span>
      </div>
      <Collapsible open={isOpen}>
        <div className="ml-3 border-l border-fg-3/30 pb-1 pl-4 pt-2.5 sm:ml-5 sm:pl-9">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 2xl:grid-cols-3">
            {list.map((c) => (
              <Link key={c.id} href="/partner/clients" className="k-row flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-surface-3/60">
                <Avatar src={c.photo} name={c.name} size={26} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 truncate text-[12.5px] font-medium">
                    {c.name}
                    <Flag country={c.country} className="size-3" />
                  </div>
                  <div className="text-[11px] text-fg-3">{c.status === "active" ? "Active" : c.status === "dormant" ? "Dormant" : "No deposit"}</div>
                </div>
                <span className={cn("k-num text-[12px]", c.lotsMonth ? "text-fg" : "text-fg-3")}>{c.lotsMonth ? `${c.lotsMonth.toFixed(1)} lots` : "—"}</span>
              </Link>
            ))}
          </div>
          {directClients.length > 12 && (
            <Button size="xs" variant="ghost" className="mt-2" onClick={() => setAll((v) => !v)}>
              {all ? "Show fewer" : `Show all ${directClients.length}`}
            </Button>
          )}
        </div>
      </Collapsible>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function TierCard({ tier, delay }: { tier: (typeof TIERS)[number]; delay: number }) {
  const list = REFERRED_CLIENTS.filter((c) => c.tier === tier.tier);
  const lots = list.reduce((s, c) => s + c.lotsMonth, 0);
  const share = (lots / PARTNER.monthlyLots) * 100;
  const comm = list.reduce((s, c) => s + c.commission, 0);
  const ibs = list.filter((c) => c.isSubIb).length;
  return (
    <Reveal delay={delay}>
      <Card className="h-full px-5 py-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <TierChip tier={tier.tier} />
              <span className="text-[13.5px] font-medium first-letter:uppercase">{tier.label.split(" · ")[1]}</span>
            </div>
            <div className="mt-1 text-[12px] text-fg-3">{tier.note}</div>
          </div>
          <Chip tone={tier.tier === 1 ? "ember" : tier.tier === 2 ? "gold" : "neutral"}>{tier.pct}% of rate</Chip>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-fg-3">Clients</div>
            <div className="k-num mt-0.5 text-[20px] font-semibold">{list.length}</div>
            <div className="text-[11px] text-fg-3">{ibs ? `${ibs} sub-IBs` : " "}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-fg-3">Lots · Sep</div>
            <div className="k-num mt-0.5 text-[20px] font-semibold">{lots.toFixed(1)}</div>
            <div className="k-num text-[11px] text-fg-3">{share.toFixed(1)}% of network</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-fg-3">To you</div>
            <Money value={comm} decimals={0} className="mt-0.5 block text-[20px] font-semibold text-up" />
            <div className="text-[11px] text-fg-3">lifetime</div>
          </div>
        </div>
        <Progress value={share} tone={tier.tier === 1 ? "ember" : tier.tier === 2 ? "gold" : "up"} className="mt-4" />
      </Card>
    </Reveal>
  );
}

function DemoPartnerNetworkPage() {
  const [open, setOpen] = React.useState<OpenMap>({ [directIbs[0]!.id]: true, [REFERRED_CLIENTS.find((c) => c.name === "Priya Nair")!.id]: true });
  const toggle = React.useCallback((id: string) => setOpen((o) => ({ ...o, [id]: !o[id] })), []);
  const expandAll = () => {
    const m: OpenMap = { direct: true };
    REFERRED_CLIENTS.forEach((c) => c.isSubIb && (m[c.id] = true));
    setOpen(m);
  };
  const tierLots = TIERS.map((t) => REFERRED_CLIENTS.filter((c) => c.tier === t.tier).reduce((s, c) => s + c.lotsMonth, 0));
  const ibRank = [...REFERRED_CLIENTS.filter((c) => c.isSubIb)]
    .map((c) => ({ c, lots: c.lotsMonth + subtree(c).reduce((s, k) => s + k.lotsMonth, 0), n: subtree(c).length }))
    .sort((a, b) => b.lots - a.lots);

  return (
    <div className="pb-24">
      <PageHeader
        title="Network"
        subtitle="You → sub-IBs → their clients. Every lot in your tree earns you commission."
        actions={
          <>
            <Button variant="surface" onClick={() => setOpen({})}>
              <ChevronsDownUp /> Collapse all
            </Button>
            <Button variant="surface" onClick={expandAll}>
              <ChevronsUpDown /> Expand all
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {TIERS.map((t, i) => (
          <TierCard key={t.tier} tier={t} delay={i * 0.05} />
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.1} className="xl:col-span-8">
          <Card className="h-full">
            <CardHeader title="Network tree" subtitle="Click a partner to expand their clients" icon={<Network />} action={<Chip tone="ember" dot>{REFERRED_CLIENTS.length} people · 3 tiers</Chip>} />
            <div className="px-3 pb-6 pt-5 sm:px-6">
              <OpenCtx.Provider value={{ open, toggle }}>
                {/* Root */}
                <div className="k-hot-card relative flex items-center gap-4 overflow-hidden rounded-[16px] px-4 py-3.5">
                  <Avatar src={ME.photo} name={ME.name} size={48} verified />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[15px] font-medium">You · {ME.name}</span>
                      <Chip size="sm" tone="gold">
                        {ME.ibLevelName}
                      </Chip>
                    </div>
                    <div className="mt-0.5 text-[12px] text-fg-2">
                      {directIbs.length} sub-IBs · {directClients.length} direct clients · {PARTNER.monthlyLots.toFixed(1)} network lots this month
                    </div>
                  </div>
                  <Icon3D name="crown" size={40} className="hidden sm:block" />
                </div>
                <ul className="ml-3 mt-2.5 sm:ml-6">
                  {directIbs.map((c) => (
                    <Branch key={c.id} last={false}>
                      <ClientNode c={c} />
                    </Branch>
                  ))}
                  <Branch last>
                    <DirectGroupNode />
                  </Branch>
                </ul>
              </OpenCtx.Provider>
            </div>
          </Card>
        </Reveal>

        <div className="flex flex-col gap-4 xl:col-span-4">
          <Reveal delay={0.12}>
            <Card>
              <CardHeader title="Lots by tier" subtitle="September · 612.4 lots" />
              <div className="flex flex-col items-center gap-5 px-6 pb-6 pt-4 sm:flex-row xl:flex-col 2xl:flex-row">
                <Donut
                  size={160}
                  thickness={18}
                  data={TIERS.map((t, i) => ({ label: `L${t.tier}`, value: tierLots[i]!, color: ["#ff5a1f", "#e9b949", "#22c55e"][i] }))}
                  center={
                    <div>
                      <div className="k-num text-[20px] font-semibold">{PARTNER.monthlyLots.toFixed(0)}</div>
                      <div className="text-[11px] text-fg-3">lots</div>
                    </div>
                  }
                />
                <div className="w-full flex-1 space-y-2">
                  {TIERS.map((t, i) => (
                    <div key={t.tier} className="k-row flex items-center gap-3 px-3.5 py-2">
                      <span className="size-2.5 rounded-full" style={{ background: ["#ff5a1f", "#e9b949", "#22c55e"][i] }} />
                      <span className="flex-1 text-[12.5px]">Tier {t.tier}</span>
                      <span className="k-num text-[12.5px] font-medium">{tierLots[i]!.toFixed(1)}</span>
                      <span className="k-num w-12 text-right text-[11.5px] text-fg-3">{((tierLots[i]! / PARTNER.monthlyLots) * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </Reveal>
          <Reveal delay={0.16}>
            <Card>
              <CardHeader title="Sub-IB leaderboard" subtitle="Network lots this month" icon={<Users />} />
              <div className="space-y-2 px-4 pb-5 pt-4 sm:px-6">
                {ibRank.map(({ c, lots, n }, i) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setOpen((o) => ({ ...o, [c.id]: true, ...(c.parentId ? { [c.parentId]: true } : {}) }));
                      toast(`${c.name} expanded in the tree`);
                    }}
                    className="k-row flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-surface-3/60"
                  >
                    <span className="w-4 font-mono text-[11px] text-fg-3">{i + 1}</span>
                    <Avatar src={c.photo} name={c.name} size={30} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 truncate text-[13px] font-medium">
                        {c.name} <TierChip tier={c.tier} />
                      </div>
                      <div className="text-[11px] text-fg-3">{n} clients</div>
                    </div>
                    <span className="k-num text-[13px] font-medium">{lots.toFixed(1)}</span>
                  </button>
                ))}
              </div>
            </Card>
          </Reveal>
          <Reveal delay={0.2}>
            <Card className="flex items-start gap-4 px-5 py-5">
              <span className="grid size-10 shrink-0 place-items-center rounded-full border border-ember/30 bg-ember-soft text-ember">
                <InfinityIcon className="size-5" />
              </span>
              <div>
                <div className="text-[14px] font-medium">Attribution is permanent</div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-fg-3">
                  Clients stay in your tree for life. Lots they generate through PAMM funds and copy accounts count toward your commission and level, just like manual trades.
                </p>
              </div>
            </Card>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return IS_DEMO ? <DemoPartnerNetworkPage /> : <LivePartnerNetwork />;
}
