"use client";

/**
 * Partners > Network: a partner's downline as the partner themselves sees it.
 *
 * The Back Office already shows this tree, but inside the partner drawer and in the dense admin style - ids,
 * funded flags, a row that opens the member. That is the right tool for reviewing one member. It is the wrong
 * tool for answering "what is this partner looking at when they phone us", which is most of why support opens
 * the page at all.
 *
 * So this is the Client Area layout (apps/crm/components/partner/live/network.tsx): the same cards, the same
 * sub-IB grouping, the same lots and earnings per row, the same lots-by-tier split and leaderboard. One
 * difference, and it is the point of putting it here: an admin picks whose network to look at.
 *
 * It reads the admin partner endpoint, which already carries the tree with earnings and the disqualified lots,
 * so there is no second source of truth and nothing new on the server.
 */

import * as React from "react";
import { Search, Users } from "lucide-react";
import { Avatar, Card, Chip, Flag, PageHeader, Reveal, Skeleton, cn } from "@ezymex/ui";
import { EmptyNote, LevelChip, PartnersError, int, lots as fmtLots, reasonLabel, usd, useLevels } from "./kit";
import { useApi, useDebounced } from "@/components/live/kit";
import { P, type Level, type Paged, type PartnerDetail, type PartnerRow, type TreeNode } from "./api";

/** Children by parent id; the root's own children sit under `rootId`. */
function childMap(nodes: TreeNode[], rootId: number) {
  const m = new Map<number, TreeNode[]>();
  for (const n of nodes) {
    const p = n.parentId ?? rootId;
    m.set(p, [...(m.get(p) ?? []), n]);
  }
  return m;
}

/** Everyone below `id`, at any depth. */
function subtree(kids: Map<number, TreeNode[]>, id: number): TreeNode[] {
  return (kids.get(id) ?? []).flatMap((k) => [k, ...subtree(kids, k.id)]);
}

/* ------------------------------------------------------------------ */
/* One row of the tree                                                  */
/* ------------------------------------------------------------------ */

function Node({ node, kids, levels, open, toggle, depth }: { node: TreeNode; kids: Map<number, TreeNode[]>; levels: Level[]; open: Set<number>; toggle: (id: number) => void; depth: number }) {
  const children = kids.get(node.id) ?? [];
  const hasKids = children.length > 0;
  const isOpen = open.has(node.id);
  const net = subtree(kids, node.id);
  // a sub-IB's row carries its whole branch, which is what the partner's own page shows
  const lotsTotal = node.lotsMonth + net.reduce((s, k) => s + k.lotsMonth, 0);
  const earnedTotal = node.earnedMonth + net.reduce((s, k) => s + k.earnedMonth, 0);

  const sub = hasKids
    ? `${int(net.length)} in their network · ${fmtLots(lotsTotal)} lots this month`
    : node.lotsMonth
      ? `${fmtLots(node.lotsMonth)} lots this month`
      : node.missedLotsMonth > 0
        ? `${fmtLots(node.missedLotsMonth)} lots this month earned nothing · ${reasonLabel(node.missedReason)}`
        : "No trades this month";

  return (
    <div>
      <div
        role={hasKids ? "button" : undefined}
        tabIndex={hasKids ? 0 : undefined}
        onClick={hasKids ? () => toggle(node.id) : undefined}
        onKeyDown={hasKids ? (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), toggle(node.id)) : undefined}
        className={cn(
          "flex items-center gap-3 rounded-[14px] border px-3.5 py-2.5 transition-colors",
          hasKids ? "cursor-pointer border-gold/25 bg-gold/[0.05] hover:border-gold/40" : "border-line bg-surface-2",
        )}
        style={{ marginLeft: depth * 18 }}
      >
        <span className="relative shrink-0">
          <Avatar name={node.name.trim() || `#${node.id}`} size={hasKids ? 36 : 30} />
          {node.country && <Flag country={node.country.toLowerCase()} className="absolute -bottom-0.5 -end-1 size-3.5 ring-2 ring-surface-2" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-[13.5px] font-medium">{node.name.trim() || `#${node.id}`}</span>
            <span className="font-mono text-[10.5px] text-fg-3">#{node.id}</span>
            <Chip size="sm">L{node.tier}</Chip>
            {hasKids && <Chip size="sm" tone="gold">Sub-IB</Chip>}
            {node.selfReferral && <Chip size="sm" tone="down">Self-ref</Chip>}
            <span className="hidden sm:inline"><LevelChip level={node.level} levels={levels} /></span>
          </div>
          <div className="mt-0.5 truncate text-[11.5px] text-fg-3">{sub}</div>
        </div>
        <div className="hidden shrink-0 items-center gap-5 md:flex">
          <div className="text-end">
            <div className="text-[11.5px] text-fg-3">Lots · month</div>
            <div className="k-num text-[13px] font-medium">{fmtLots(lotsTotal)}</div>
          </div>
          <div className="text-end">
            <div className="text-[11.5px] text-fg-3">To them · month</div>
            <div className={cn("k-num text-[13px] font-medium", earnedTotal ? "text-up" : "text-fg-3")}>{usd(earnedTotal)}</div>
          </div>
        </div>
      </div>
      {isOpen && (
        <div className="mt-2 space-y-2">
          {children.map((c) => (
            <Node key={c.id} node={c} kids={kids} levels={levels} open={open} toggle={toggle} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The page                                                             */
/* ------------------------------------------------------------------ */

export function LivePartnerNetwork() {
  const [q, setQ] = React.useState("");
  const dq = useDebounced(q, 300);
  const [id, setId] = React.useState<number | null>(null);
  const [open, setOpen] = React.useState<Set<number>>(() => new Set());

  // the picker: IBs that actually have a downline come first, because those are the ones with a network to look at
  const list = useApi<Paged<PartnerRow>>(`${P("partners")}?scope=all&limit=12${dq.trim() ? `&q=${encodeURIComponent(dq.trim())}` : ""}`);
  const detail = useApi<PartnerDetail>(id !== null ? P(`partners/${id}`) : null);

  const rows = list.data?.items ?? [];
  React.useEffect(() => {
    if (id === null && rows.length) setId(rows[0]!.id);
  }, [rows, id]);

  const d = detail.data;
  const root = d?.partner ?? null;
  const nodes: TreeNode[] = d?.tree ?? [];
  const rootId = root?.id ?? -1;
  const kids = React.useMemo(() => childMap(nodes, rootId), [nodes, rootId]);
  const top = kids.get(rootId) ?? [];
  const { levels } = useLevels();

  const toggle = (nid: number) =>
    setOpen((s) => {
      const x = new Set(s);
      if (x.has(nid)) x.delete(nid);
      else x.add(nid);
      return x;
    });

  const tiers = nodes.length ? Math.max(...nodes.map((n) => n.tier)) : 0;
  const perTier = Array.from({ length: tiers }, (_, i) => nodes.filter((n) => n.tier === i + 1));
  const totalLots = nodes.reduce((s, n) => s + n.lotsMonth, 0);
  const totalEarned = nodes.reduce((s, n) => s + n.earnedMonth, 0);
  const withKids = nodes.filter((n) => kids.has(n.id)).map((n) => n.id);
  const allOpen = withKids.length > 0 && withKids.every((x) => open.has(x));

  const leaders = nodes
    .filter((n) => kids.has(n.id))
    .map((n) => ({ n, people: subtree(kids, n.id).length, lots: n.lotsMonth + subtree(kids, n.id).reduce((s, k) => s + k.lotsMonth, 0) }))
    .sort((a, b) => b.lots - a.lots)
    .slice(0, 5);

  if (list.error) return <PartnersError error={list.error} onRetry={list.reload} />;

  return (
    <div className="pb-16">
      <PageHeader title="Network" subtitle="A partner's downline exactly as they see it in their own Client Area" />

      <Card className="p-3 sm:p-4">
        <div className="flex items-center gap-2">
          <span className="relative flex h-9 min-w-0 flex-1 items-center rounded-[9px] border border-line bg-surface-2 focus-within:border-ember/60">
            <Search className="pointer-events-none absolute start-3 size-4 text-fg-3" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Find a partner by name, email or code…"
              aria-label="Find a partner"
              className="h-9 w-full bg-transparent ps-9 pe-3 text-[13.5px] outline-none placeholder:text-fg-3"
            />
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {list.loading && !rows.length
            ? Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-8 w-40 rounded-full" />)
            : rows.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => (setId(p.id), setOpen(new Set()))}
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12.5px] transition-colors",
                    p.id === id ? "border-ember/50 bg-ember/10 text-fg" : "border-line text-fg-2 hover:bg-surface-3",
                  )}
                >
                  <Avatar name={p.name || `#${p.id}`} size={20} />
                  <span className="max-w-40 truncate">{p.name || `#${p.id}`}</span>
                  <span className="font-mono text-[10.5px] text-fg-3">{p.code}</span>
                </button>
              ))}
          {!list.loading && rows.length === 0 && <span className="px-1 py-2 text-[12.5px] text-fg-3">No partner matches that search.</span>}
        </div>
      </Card>

      {detail.error ? (
        <PartnersError className="mt-4" error={detail.error} onRetry={detail.reload} />
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Reveal className="min-w-0 xl:col-span-8">
            <Card className="h-full p-4 sm:p-6">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="text-[15px] font-medium">Network tree</span>
                <Chip size="sm" tone="ember">{int(nodes.length)} people · {int(tiers)} tiers</Chip>
                {withKids.length > 0 && (
                  <button type="button" className="ms-auto text-[12px] text-fg-3 hover:text-fg" onClick={() => setOpen(allOpen ? new Set() : new Set(withKids))}>
                    {allOpen ? "Collapse all" : "Expand all"}
                  </button>
                )}
              </div>

              {detail.loading && !d ? (
                <div className="space-y-2">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-16 rounded-[14px]" />)}</div>
              ) : !root ? (
                <EmptyNote className="py-10" title="Pick a partner" text="Choose someone above to see the network they see." />
              ) : (
                <>
                  <div className="k-hot-card mb-3 flex items-center gap-3 rounded-[16px] px-4 py-3.5">
                    <Avatar name={root.name || `#${root.id}`} size={44} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-[15px] font-medium">{root.name || `#${root.id}`}</span>
                        <span className="font-mono text-[11px] text-fg-3">#{root.id}</span>
                      </div>
                      <div className="mt-0.5 text-[12px] text-fg-2">
                        {int(top.length)} direct · {int(nodes.length)} in the network · {fmtLots(totalLots)} lots this month
                      </div>
                    </div>
                    <div className="shrink-0 text-end">
                      <div className="text-[11.5px] text-fg-3">To them · month</div>
                      <div className={cn("k-num text-[17px] font-semibold leading-tight", totalEarned ? "text-up" : "text-fg-3")}>{usd(totalEarned)}</div>
                      <div className="mt-0.5 font-mono text-[11px] text-fg-3">{root.code}</div>
                    </div>
                  </div>

                  {top.length === 0 ? (
                    <EmptyNote className="py-8" title="No referred clients yet" text="Clients who sign up with this member's link or code appear here." />
                  ) : (
                    <div className="space-y-2">
                      {top.map((n) => (
                        <Node key={n.id} node={n} kids={kids} levels={levels} open={open} toggle={toggle} depth={0} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </Card>
          </Reveal>

          <div className="min-w-0 space-y-4 xl:col-span-4">
            <Reveal delay={0.05}>
              <Card className="p-4 sm:p-5">
                <div className="text-[15px] font-medium">Lots by tier</div>
                <div className="text-[12px] text-fg-3">This month · {fmtLots(totalLots)} lots</div>
                <div className="mt-3 space-y-2">
                  {perTier.length === 0 && <div className="py-3 text-[12.5px] text-fg-3">Nothing to split yet.</div>}
                  {perTier.map((group, i) => {
                    const l = group.reduce((s, n) => s + n.lotsMonth, 0);
                    const pct = totalLots > 0 ? (l / totalLots) * 100 : 0;
                    return (
                      <div key={i} className="flex items-center gap-3 rounded-[10px] border border-line px-3 py-2">
                        <span className="text-[12.5px] text-fg-2">Tier {i + 1}</span>
                        <span className="ms-auto k-num text-[13px] font-medium">{fmtLots(l)}</span>
                        <span className="k-num w-12 text-end text-[11.5px] text-fg-3">{pct.toFixed(1)}%</span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </Reveal>

            <Reveal delay={0.1}>
              <Card className="p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <span className="grid size-7 place-items-center rounded-full border border-line bg-surface-3 text-fg-2"><Users className="size-3.5" /></span>
                  <div>
                    <div className="text-[15px] font-medium">Sub-IB leaderboard</div>
                    <div className="text-[12px] text-fg-3">Network lots this month</div>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {leaders.length === 0 && <div className="py-3 text-[12.5px] text-fg-3">This partner has no sub-IBs.</div>}
                  {leaders.map((l, i) => (
                    <div key={l.n.id} className="flex items-center gap-3 rounded-[10px] border border-line px-3 py-2">
                      <span className="k-num w-4 text-[12px] text-fg-3">{i + 1}</span>
                      <Avatar name={l.n.name || `#${l.n.id}`} size={26} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12.5px] font-medium">{l.n.name || `#${l.n.id}`}</div>
                        <div className="text-[11px] text-fg-3">{int(l.people)} people</div>
                      </div>
                      <span className="k-num text-[13px] font-medium">{fmtLots(l.lots)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </Reveal>
          </div>
        </div>
      )}
    </div>
  );
}
