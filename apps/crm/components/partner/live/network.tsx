"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  Infinity as InfinityIcon,
  Network,
  Users,
} from "lucide-react";
import {
  Avatar,
  Button,
  Card,
  CardHeader,
  Chip,
  Donut,
  Flag,
  Money,
  PageHeader,
  Progress,
  Reveal,
  cn,
  formatMoney,
} from "@kalks/ui";
import {
  fmtLots,
  fmtPct,
  usePartner,
  type NetworkNode,
  type NetworkResp,
  type Programme,
} from "./api";
import { CardEmpty, PageFallback, SkeletonGrid, TierChip } from "./ui";

const TIER_COLORS = ["#ff5a1f", "#e9b949", "#22c55e", "#38bdf8", "#a1a1aa"];

type Tree = {
  kids: Map<number, NetworkNode[]>;
  byId: Map<number, NetworkNode>;
};

function buildTree(nodes: NetworkNode[], rootId: number): Tree {
  const kids = new Map<number, NetworkNode[]>();
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const n of nodes) {
    const p = n.parentId ?? rootId;
    if (!kids.has(p)) kids.set(p, []);
    kids.get(p)!.push(n);
  }
  return { kids, byId };
}

function subtree(t: Tree, id: number): NetworkNode[] {
  return (t.kids.get(id) ?? []).flatMap((k) => [k, ...subtree(t, k.id)]);
}

const sortKids = (t: Tree, list: NetworkNode[]) =>
  [...list].sort(
    (a, b) =>
      Number(t.kids.has(b.id)) - Number(t.kids.has(a.id)) ||
      b.lotsMonth - a.lotsMonth ||
      a.name.localeCompare(b.name),
  );

type OpenMap = Record<string, boolean>;
const Ctx = React.createContext<{
  open: OpenMap;
  toggle: (id: string) => void;
  tree: Tree;
}>({ open: {}, toggle: () => {}, tree: { kids: new Map(), byId: new Map() } });

function Branch({
  children,
  last,
}: {
  children: React.ReactNode;
  last: boolean;
}) {
  return (
    <li className="relative pl-4 sm:pl-9">
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-0 w-px bg-fg-3/30",
          last ? "h-[30px]" : "h-full",
        )}
      />
      <span
        aria-hidden
        className="absolute left-0 top-[30px] h-px w-4 bg-fg-3/40 sm:w-9"
      />
      <div className="pb-2.5">{children}</div>
    </li>
  );
}

function Collapsible({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden"
        >
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
          <div className="text-[10.5px] uppercase tracking-wider text-fg-3">
            {k}
          </div>
          <div className="k-num text-[13px] font-medium">{v}</div>
        </div>
      ))}
    </div>
  );
}

const initials = (name: string) =>
  name.replace(/[^\p{L}\s]/gu, "").trim() || "?";

function PartnerNode({ c }: { c: NetworkNode }) {
  const { open, toggle, tree } = React.useContext(Ctx);
  const kids = sortKids(tree, tree.kids.get(c.id) ?? []);
  const isOpen = !!open[c.id];
  const net = subtree(tree, c.id);
  const lots = c.lotsMonth + net.reduce((s, k) => s + k.lotsMonth, 0);
  const earned = c.earnedMonth + net.reduce((s, k) => s + k.earnedMonth, 0);
  const hasKids = kids.length > 0;
  return (
    <div>
      <div
        role={hasKids ? "button" : undefined}
        tabIndex={hasKids ? 0 : undefined}
        onClick={hasKids ? () => toggle(String(c.id)) : undefined}
        onKeyDown={
          hasKids
            ? (e) =>
                (e.key === "Enter" || e.key === " ") &&
                (e.preventDefault(), toggle(String(c.id)))
            : undefined
        }
        className={cn(
          "flex items-center gap-3 rounded-[14px] border px-3.5 py-2.5 transition-colors",
          hasKids
            ? "cursor-pointer border-gold/25 bg-gold/[0.05] hover:border-gold/40"
            : "border-line bg-surface-2",
        )}
      >
        <span className="relative shrink-0">
          <Avatar name={initials(c.name)} size={hasKids ? 38 : 32} />
          {c.country && (
            <Flag
              country={c.country.toLowerCase()}
              className="absolute -bottom-0.5 -right-1 size-3.5 ring-2 ring-surface-2"
            />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-[13.5px] font-medium">{c.name}</span>
            <TierChip tier={c.tier} />
            {hasKids && (
              <Chip size="sm" tone="gold">
                Sub-IB
              </Chip>
            )}
          </div>
          <div className="mt-0.5 truncate text-[11.5px] text-fg-3">
            {hasKids
              ? `${net.length} in their network · ${fmtLots(lots, 1)} lots this month`
              : `${c.lotsMonth ? `${fmtLots(c.lotsMonth)} lots` : "No trades"} this month`}
          </div>
        </div>
        <NodeStats
          items={[
            ["Lots · month", fmtLots(lots)],
            [
              "To you · month",
              <span key="c" className={earned ? "text-up" : "text-fg-3"}>
                {formatMoney(earned)}
              </span>,
            ],
          ]}
        />
        {hasKids && (
          <span className="grid size-7 shrink-0 place-items-center rounded-full border border-line bg-surface-3 text-fg-2">
            <ChevronDown
              className={cn(
                "size-3.5 transition-transform",
                isOpen && "rotate-180",
              )}
            />
          </span>
        )}
      </div>
      {hasKids && (
        <Collapsible open={isOpen}>
          <ul className="ml-3 mt-2.5 sm:ml-5">
            {kids.map((k, i) => (
              <Branch key={k.id} last={i === kids.length - 1}>
                <PartnerNode c={k} />
              </Branch>
            ))}
          </ul>
        </Collapsible>
      )}
    </div>
  );
}

function DirectGroupNode({ list }: { list: NetworkNode[] }) {
  const { open, toggle } = React.useContext(Ctx);
  const [all, setAll] = React.useState(false);
  const isOpen = !!open.direct;
  const lots = list.reduce((s, c) => s + c.lotsMonth, 0);
  const earned = list.reduce((s, c) => s + c.earnedMonth, 0);
  const active = list.filter((c) => c.lotsMonth > 0).length;
  const shown = all ? list : list.slice(0, 12);
  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => toggle("direct")}
        onKeyDown={(e) =>
          (e.key === "Enter" || e.key === " ") &&
          (e.preventDefault(), toggle("direct"))
        }
        className="flex cursor-pointer items-center gap-3 rounded-[14px] border border-ember/25 bg-ember/[0.05] px-3.5 py-2.5 hover:border-ember/40"
      >
        <span className="grid size-[34px] shrink-0 place-items-center rounded-full border border-line bg-surface-3 text-fg-2">
          <Users className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[13.5px] font-medium">
            {list.length} direct client{list.length === 1 ? "" : "s"}{" "}
            <TierChip tier={1} />
          </div>
          <div className="truncate text-[11.5px] text-fg-3">
            {active} traded this month · signed up with your link
          </div>
        </div>
        <NodeStats
          items={[
            ["Lots · month", fmtLots(lots)],
            [
              "To you · month",
              <span key="c" className={earned ? "text-up" : "text-fg-3"}>
                {formatMoney(earned)}
              </span>,
            ],
          ]}
        />
        <span className="grid size-7 shrink-0 place-items-center rounded-full border border-line bg-surface-3 text-fg-2">
          <ChevronDown
            className={cn(
              "size-3.5 transition-transform",
              isOpen && "rotate-180",
            )}
          />
        </span>
      </div>
      <Collapsible open={isOpen}>
        <div className="ml-3 border-l border-fg-3/30 pb-1 pl-4 pt-2.5 sm:ml-5 sm:pl-9">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 2xl:grid-cols-3">
            {shown.map((c) => (
              <Link
                key={c.id}
                href="/partner/clients"
                className="k-row flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-surface-3/60"
              >
                <Avatar name={initials(c.name)} size={26} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 truncate text-[12.5px] font-medium">
                    <span className="truncate">{c.name}</span>
                    {c.country && (
                      <Flag
                        country={c.country.toLowerCase()}
                        className="size-3"
                      />
                    )}
                  </div>
                  <div className="text-[11px] text-fg-3">
                    {c.lotsMonth > 0
                      ? "Traded this month"
                      : "No trades this month"}
                  </div>
                </div>
                <span
                  className={cn(
                    "k-num text-[12px]",
                    c.lotsMonth ? "text-fg" : "text-fg-3",
                  )}
                >
                  {c.lotsMonth ? `${fmtLots(c.lotsMonth, 1)} lots` : "—"}
                </span>
              </Link>
            ))}
          </div>
          {list.length > 12 && (
            <Button
              size="xs"
              variant="ghost"
              className="mt-2"
              onClick={() => setAll((v) => !v)}
            >
              {all ? "Show fewer" : `Show all ${list.length}`}
            </Button>
          )}
        </div>
      </Collapsible>
    </div>
  );
}

const TIER_TEXT: Record<number, [string, string]> = {
  1: ["Direct clients", "Signed up with your link"],
  2: ["Sub-IB clients", "Referred by your direct clients"],
  3: ["Second level", "Referred by your sub-IBs' clients"],
};

function TierCard({
  tier,
  pct,
  nodes,
  total,
  delay,
}: {
  tier: number;
  pct: number | null;
  nodes: NetworkNode[];
  total: number;
  delay: number;
}) {
  const list = nodes.filter((c) => c.tier === tier);
  const lots = list.reduce((s, c) => s + c.lotsMonth, 0);
  const share = total > 0 ? (lots / total) * 100 : 0;
  const earned = list.reduce((s, c) => s + c.earnedMonth, 0);
  const [title, note] = TIER_TEXT[tier] ?? [
    `Tier ${tier}`,
    `${tier - 1} levels below you`,
  ];
  return (
    <Reveal delay={delay} className="min-w-0">
      <Card className="h-full px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <TierChip tier={tier} />
              <span className="text-[13.5px] font-medium">{title}</span>
            </div>
            <div className="mt-1 text-[12px] text-fg-3">{note}</div>
          </div>
          {pct !== null && (
            <Chip tone={tier === 1 ? "ember" : tier === 2 ? "gold" : "neutral"}>
              {fmtPct(pct)} of rate
            </Chip>
          )}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-fg-3">
              People
            </div>
            <div className="k-num mt-0.5 text-[20px] font-semibold">
              {list.length}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-fg-3">
              Lots
            </div>
            <div className="k-num mt-0.5 text-[20px] font-semibold">
              {fmtLots(lots, 1)}
            </div>
            <div className="k-num text-[11px] text-fg-3">
              {total > 0 ? `${share.toFixed(1)}% of network` : "this month"}
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-fg-3">
              To you
            </div>
            <Money
              value={earned}
              countUp={false}
              decimals={2}
              className={cn(
                "mt-0.5 block truncate text-[20px] font-semibold",
                earned ? "text-up" : "text-fg",
              )}
            />
            <div className="text-[11px] text-fg-3">this month</div>
          </div>
        </div>
        <Progress
          value={share}
          tone={tier === 1 ? "ember" : tier === 2 ? "gold" : "up"}
          className="mt-4"
        />
      </Card>
    </Reveal>
  );
}

/* ------------------------------------------------------------------ */

const TITLE = "Network";
const SUBTITLE =
  "You, your sub-IBs and their clients. Every qualifying lot in your tree earns you commission.";

export function LivePartnerNetwork() {
  const { data, error, reload } = usePartner<NetworkResp>("network");
  const { data: prog } = usePartner<Programme>("programme");
  const tree = React.useMemo(
    () => (data ? buildTree(data.nodes, data.root.id) : null),
    [data],
  );
  const [open, setOpen] = React.useState<OpenMap>({ direct: true });
  const toggle = React.useCallback(
    (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] })),
    [],
  );

  if (!data || !tree)
    return (
      <PageFallback
        title={TITLE}
        subtitle={SUBTITLE}
        error={error}
        onRetry={reload}
        skeleton={
          <SkeletonGrid
            rows={[
              { cols: "md:grid-cols-3", h: "h-[170px]", n: 3 },
              { cols: "xl:grid-cols-[2fr_1fr]", h: "h-[420px]", n: 2 },
            ]}
          />
        }
      />
    );

  const rootKids = sortKids(tree, tree.kids.get(data.root.id) ?? []);
  const directIbs = rootKids.filter((c) => tree.kids.has(c.id));
  const directClients = rootKids.filter((c) => !tree.kids.has(c.id));
  const allIbs = data.nodes.filter((c) => tree.kids.has(c.id));
  const total = data.nodes.reduce((s, c) => s + c.lotsMonth, 0);
  const tierList = Array.from({ length: data.tiers }, (_, i) => i + 1);
  const tierPct = (t: number) =>
    prog?.tiers.find((x) => x.tier === t)?.pct ?? null;
  const tierLots = tierList.map((t) =>
    data.nodes.filter((c) => c.tier === t).reduce((s, c) => s + c.lotsMonth, 0),
  );
  const levelName =
    prog?.levels.find((l) => l.key === data.root.level)?.name ??
    data.root.level;
  const ibRank = allIbs
    .map((c) => {
      const net = subtree(tree, c.id);
      return {
        c,
        n: net.length,
        lots: c.lotsMonth + net.reduce((s, k) => s + k.lotsMonth, 0),
      };
    })
    .sort((a, b) => b.lots - a.lots || b.n - a.n)
    .slice(0, 8);

  const expandAll = () => {
    const m: OpenMap = { direct: true };
    allIbs.forEach((c) => (m[c.id] = true));
    setOpen(m);
  };

  return (
    <div className="pb-24">
      <PageHeader
        title={TITLE}
        subtitle={SUBTITLE}
        actions={
          data.nodes.length > 0 ? (
            <>
              <Button variant="surface" onClick={() => setOpen({})}>
                <ChevronsDownUp /> Collapse all
              </Button>
              <Button variant="surface" onClick={expandAll}>
                <ChevronsUpDown /> Expand all
              </Button>
            </>
          ) : undefined
        }
      />

      <div
        className={cn(
          "grid grid-cols-1 gap-4",
          tierList.length >= 3 ? "md:grid-cols-3" : "md:grid-cols-2",
        )}
      >
        {tierList.map((t, i) => (
          <TierCard
            key={t}
            tier={t}
            pct={tierPct(t)}
            nodes={data.nodes}
            total={total}
            delay={i * 0.05}
          />
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.1} className="min-w-0 xl:col-span-8">
          <Card className="h-full">
            <CardHeader
              title="Network tree"
              subtitle={
                allIbs.length
                  ? "Select a sub-IB to expand their clients"
                  : "Your direct clients and anyone they refer"
              }
              icon={<Network />}
              action={
                <Chip tone="ember" dot>
                  {data.nodes.length}{" "}
                  {data.nodes.length === 1 ? "person" : "people"} · {data.tiers}{" "}
                  tiers
                </Chip>
              }
            />
            <div className="px-3 pb-6 pt-5 sm:px-6">
              <Ctx.Provider value={{ open, toggle, tree }}>
                <div className="k-hot-card relative flex items-center gap-4 overflow-hidden rounded-[16px] px-4 py-3.5">
                  <Avatar name={initials(data.root.name)} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-[15px] font-medium">
                        You · {data.root.name}
                      </span>
                      <Chip size="sm" tone="gold">
                        {levelName}
                      </Chip>
                    </div>
                    <div className="mt-0.5 text-[12px] text-fg-2">
                      {directIbs.length} sub-IB
                      {directIbs.length === 1 ? "" : "s"} ·{" "}
                      {directClients.length} direct client
                      {directClients.length === 1 ? "" : "s"} ·{" "}
                      {fmtLots(total, 1)} network lots this month
                    </div>
                  </div>
                  <span className="hidden font-mono text-[12px] text-fg-2 sm:block">
                    {data.root.code}
                  </span>
                </div>
                {data.nodes.length === 0 ? (
                  <CardEmpty
                    className="mt-4"
                    title="Your tree is empty"
                    text="When someone signs up with your link they appear here. If they invite others, those clients show up under them as tier 2 and tier 3."
                  >
                    <Link href="/partner/links">
                      <Button size="sm" variant="surface">
                        Get your links
                      </Button>
                    </Link>
                  </CardEmpty>
                ) : (
                  <ul className="ml-3 mt-2.5 sm:ml-6">
                    {directIbs.map((c, i) => (
                      <Branch
                        key={c.id}
                        last={
                          directClients.length === 0 &&
                          i === directIbs.length - 1
                        }
                      >
                        <PartnerNode c={c} />
                      </Branch>
                    ))}
                    {directClients.length > 0 && (
                      <Branch last>
                        <DirectGroupNode list={directClients} />
                      </Branch>
                    )}
                  </ul>
                )}
              </Ctx.Provider>
            </div>
          </Card>
        </Reveal>

        <div className="flex min-w-0 flex-col gap-4 xl:col-span-4">
          <Reveal delay={0.12}>
            <Card>
              <CardHeader
                title="Lots by tier"
                subtitle={`This month · ${fmtLots(total, 1)} lots`}
              />
              <div className="px-5 pb-6 pt-4 sm:px-6">
                {total > 0 ? (
                  <div className="flex flex-col items-center gap-5 sm:flex-row xl:flex-col 2xl:flex-row">
                    <Donut
                      size={160}
                      thickness={18}
                      data={tierList.map((t, i) => ({
                        label: `L${t}`,
                        value: tierLots[i]!,
                        color: TIER_COLORS[i % TIER_COLORS.length],
                      }))}
                      center={
                        <div>
                          <div className="k-num text-[20px] font-semibold">
                            {total.toFixed(total >= 100 ? 0 : 1)}
                          </div>
                          <div className="text-[11px] text-fg-3">lots</div>
                        </div>
                      }
                    />
                    <TierLegend
                      tiers={tierList}
                      lots={tierLots}
                      total={total}
                      pct={tierPct}
                    />
                  </div>
                ) : (
                  <>
                    <TierLegend
                      tiers={tierList}
                      lots={tierLots}
                      total={total}
                      pct={tierPct}
                    />
                    <p className="mt-3 text-[12px] text-fg-3">
                      No lots traded in your network this month yet.
                    </p>
                  </>
                )}
              </div>
            </Card>
          </Reveal>
          {ibRank.length > 0 && (
            <Reveal delay={0.16}>
              <Card>
                <CardHeader
                  title="Sub-IB leaderboard"
                  subtitle="Network lots this month"
                  icon={<Users />}
                />
                <div className="space-y-2 px-4 pb-5 pt-4 sm:px-6">
                  {ibRank.map(({ c, lots, n }, i) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        // open the path from the root down to this partner
                        const m: OpenMap = { [c.id]: true };
                        let p = c.parentId;
                        while (p && tree.byId.has(p)) {
                          m[p] = true;
                          p = tree.byId.get(p)!.parentId;
                        }
                        setOpen((o) => ({ ...o, ...m }));
                      }}
                      className="k-row flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-surface-3/60"
                    >
                      <span className="w-4 font-mono text-[11px] text-fg-3">
                        {i + 1}
                      </span>
                      <Avatar name={initials(c.name)} size={30} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 truncate text-[13px] font-medium">
                          <span className="truncate">{c.name}</span>{" "}
                          <TierChip tier={c.tier} />
                        </div>
                        <div className="text-[11px] text-fg-3">
                          {n} {n === 1 ? "person" : "people"}
                        </div>
                      </div>
                      <span className="k-num text-[13px] font-medium">
                        {fmtLots(lots, 1)}
                      </span>
                    </button>
                  ))}
                </div>
              </Card>
            </Reveal>
          )}
          <Reveal delay={0.2}>
            <Card className="flex items-start gap-4 px-5 py-5">
              <span className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-fg-2">
                <InfinityIcon className="size-5" />
              </span>
              <div>
                <div className="text-[14px] font-medium">
                  Attribution is permanent
                </div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-fg-3">
                  Clients stay in your tree for good. Lots they trade through
                  PAMM funds and copy trading count toward your commission and
                  level, the same as their own trades.
                </p>
              </div>
            </Card>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

function TierLegend({
  tiers,
  lots,
  total,
  pct,
}: {
  tiers: number[];
  lots: number[];
  total: number;
  pct: (t: number) => number | null;
}) {
  return (
    <div className="w-full flex-1 space-y-2">
      {tiers.map((t, i) => (
        <div key={t} className="k-row flex items-center gap-3 px-3.5 py-2">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ background: TIER_COLORS[i % TIER_COLORS.length] }}
          />
          <span className="flex-1 text-[12.5px]">
            Tier {t}
            {pct(t) !== null && (
              <span className="text-fg-3"> · {fmtPct(pct(t)!)} of rate</span>
            )}
          </span>
          <span className="k-num text-[12.5px] font-medium">
            {fmtLots(lots[i]!, 1)}
          </span>
          <span className="k-num w-12 text-right text-[11.5px] text-fg-3">
            {total > 0 ? `${((lots[i]! / total) * 100).toFixed(1)}%` : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}
