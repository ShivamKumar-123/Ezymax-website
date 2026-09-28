"use client";

// Live strategy marketplace (/developer/marketplace, D83): browse verified strategies, subscribe (copy onto
// your account, or clone the rules when the author allows it), review, and publish your own.

import * as React from "react";
import { BadgeCheck, Loader2, Plus, Search, Star, Store, Upload, Users } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, Dialog, EmptyState, EquityChart, PageHeader, Reveal, Segmented, Skeleton, Sparkline, SymbolAvatar, Tabs, Toggle, cn } from "@kalks/ui";
import { NumInput } from "./builder";
import { algoApi, algoError, fmtDateTime, fmtMoney, fmtPct, useAlgo, type Deployment, type StrategyItem, type TradingAccount } from "./api";

interface Track {
  returnPct: number;
  winRate: number;
  trades: number;
  maxDrawdownPct: number;
  days: number;
  accountType: string;
  curve?: number[] | { day: string; realized: number; equity: number }[];
  netProfit?: number;
  since?: string;
  deploymentStatus?: string;
}
interface Listing {
  id: number;
  title: string;
  description: string;
  author: string;
  authorUserId: number;
  symbol: string;
  timeframe: string;
  priceMonthly: number;
  currency: string;
  allowClone: boolean;
  status: string;
  moderationNote: string | null;
  rating: number;
  ratings: number;
  subscribers: number;
  track: Track;
  createdAt: string;
}
interface ListingDetail extends Listing {
  risk?: Record<string, unknown> & { sizing?: { mode: string; lots: number; riskPct: number }; sl?: { mode: string; value: number }; tp?: { mode: string; value: number } };
  summary?: Record<string, string>;
  kind?: string;
  reviews: { id: number; user: string; rating: number; comment: string; createdAt: string; mine: boolean }[];
  subscription: { id: number; mode: string; status: string; login: number | null; deploymentId: number | null; clonedStrategyId: number | null; periodEnd: string | null; autoRenew: boolean } | null;
  isAuthor: boolean;
  platformCutPct: number;
}

function Stars({ v, size = 12 }: { v: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} style={{ width: size, height: size }} className={i <= Math.round(v) ? "fill-gold text-gold" : "text-fg-3"} />
      ))}
    </span>
  );
}

function ListingCard({ l, subscribed, onOpen }: { l: Listing; subscribed: boolean; onOpen: () => void }) {
  const curve = (l.track.curve ?? []) as number[];
  return (
    <button type="button" onClick={onOpen} className="k-card group flex flex-col p-5 text-left transition hover:border-[var(--k-border-top)]" data-testid={`listing-${l.id}`}>
      <div className="flex items-start gap-3">
        <SymbolAvatar symbol={l.symbol} size={28} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-medium text-fg">{l.title}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-fg-3">
            <span>by {l.author}</span>·<span className="font-mono">{l.symbol} {l.timeframe}</span>
          </div>
        </div>
        <Chip size="sm" tone={l.priceMonthly > 0 ? "gold" : "up"}>{l.priceMonthly > 0 ? `${l.priceMonthly} USDT/mo` : "Free"}</Chip>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <div className={cn("k-num text-[24px] font-semibold", l.track.returnPct >= 0 ? "text-up" : "text-down")}>{fmtPct(l.track.returnPct, 2)}</div>
          <div className="text-[11px] text-fg-3">
            verified {l.track.accountType} · {l.track.days.toFixed(1)} days
          </div>
        </div>
        {curve.length > 1 && <Sparkline data={curve} width={120} height={36} tone={l.track.returnPct >= 0 ? "gold" : "down"} />}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-[11px]">
        <div className="rounded-[10px] bg-surface-2/60 px-2.5 py-1.5">
          <div className="text-fg-3">Win rate</div>
          <div className="k-num text-[13px] text-fg">{l.track.winRate.toFixed(1)}%</div>
        </div>
        <div className="rounded-[10px] bg-surface-2/60 px-2.5 py-1.5">
          <div className="text-fg-3">Max DD</div>
          <div className="k-num text-[13px] text-down">{l.track.maxDrawdownPct.toFixed(1)}%</div>
        </div>
        <div className="rounded-[10px] bg-surface-2/60 px-2.5 py-1.5">
          <div className="text-fg-3">Trades</div>
          <div className="k-num text-[13px] text-fg">{l.track.trades}</div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-[11.5px] text-fg-3">
        <Stars v={l.rating} /> <span>({l.ratings})</span>
        <Users className="ml-2 size-3.5" /> {l.subscribers}
        {subscribed && (
          <Chip size="sm" tone="ember" className="ml-auto">
            Subscribed
          </Chip>
        )}
      </div>
    </button>
  );
}

function ListingDialog({ id, onClose, accounts, onChanged }: { id: number | null; onClose: () => void; accounts: TradingAccount[]; onChanged: () => void }) {
  const d = useAlgo<ListingDetail>(id ? `market/listings/${id}` : null);
  const [mode, setMode] = React.useState<"copy" | "clone">("copy");
  const [login, setLogin] = React.useState<number | null>(null);
  const [mult, setMult] = React.useState(1);
  const [busy, setBusy] = React.useState(false);
  const [rating, setRating] = React.useState(5);
  const [comment, setComment] = React.useState("");
  React.useEffect(() => {
    if (login === null && accounts.length) setLogin((accounts.find((a) => a.type === "demo") ?? accounts[0]!).login);
  }, [accounts, login]);
  const l = d.data;
  const subscribe = async () => {
    if (!l) return;
    setBusy(true);
    try {
      const r = await algoApi<{ deploymentId: number | null; clonedStrategyId: number | null; charged: number }>(`market/listings/${l.id}/subscribe`, { body: { mode, login: mode === "copy" ? login : undefined, risk: mult !== 1 ? { lotMultiplier: mult } : undefined } });
      toast.success(mode === "copy" ? `Copying “${l.title}” on #${login}` : `“${l.title}” cloned to your strategies`, { description: r.charged ? `${r.charged} USDT charged from your wallet` : "Free subscription" });
      d.reload();
      onChanged();
    } catch (e) {
      algoError("Couldn't subscribe", e);
    } finally {
      setBusy(false);
    }
  };
  const cancel = async () => {
    if (!l?.subscription) return;
    try {
      const r = await algoApi<{ status: string }>(`market/subscriptions/${l.subscription.id}/cancel`, { body: {} });
      toast.success(`Subscription ${r.status}`);
      d.reload();
      onChanged();
    } catch (e) {
      algoError("Couldn't cancel", e);
    }
  };
  const review = async () => {
    if (!l) return;
    try {
      await algoApi(`market/listings/${l.id}/reviews`, { body: { rating, comment } });
      toast.success("Review saved");
      setComment("");
      d.reload();
      onChanged();
    } catch (e) {
      algoError("Couldn't save the review", e);
    }
  };
  const curve = Array.isArray(l?.track.curve) ? (l!.track.curve as { day: string; equity: number }[]).filter((p) => typeof p === "object").map((p) => ({ time: Math.floor(new Date(p.day).getTime() / 1000), value: p.equity })) : [];
  const active = l?.subscription?.status === "active";
  return (
    <Dialog open={id !== null} onOpenChange={(o) => !o && onClose()} title={l?.title ?? "Strategy"} description={l ? `by ${l.author} · ${l.symbol} ${l.timeframe}` : undefined} side="right">
      {!l ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="space-y-5 text-[13px]" data-testid="listing-detail">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="up">
              <BadgeCheck className="size-3.5" /> Verified {l.track.accountType} track record
            </Chip>
            <Chip tone={l.priceMonthly > 0 ? "gold" : "up"}>{l.priceMonthly > 0 ? `${l.priceMonthly} USDT / month` : "Free"}</Chip>
            {l.status !== "approved" && <Chip tone="warn">{l.status}</Chip>}
          </div>
          <p className="whitespace-pre-line text-fg-2">{l.description}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                ["Return", fmtPct(l.track.returnPct, 2), l.track.returnPct >= 0 ? "text-up" : "text-down"],
                ["Win rate", `${l.track.winRate.toFixed(1)}%`, "text-fg"],
                ["Max DD", `${l.track.maxDrawdownPct.toFixed(2)}%`, "text-down"],
                ["Trades", String(l.track.trades), "text-fg"],
              ] as const
            ).map(([k, v, t]) => (
              <div key={k} className="rounded-[12px] bg-surface-2/60 px-3 py-2">
                <div className="text-[10.5px] uppercase text-fg-3">{k}</div>
                <div className={cn("k-num text-[16px] font-semibold", t)}>{v}</div>
              </div>
            ))}
          </div>
          {curve.length > 1 && <EquityChart data={curve} height={150} showVolume={false} color="gold" />}
          <div className="text-[11.5px] text-fg-3">
            Track record from the author's own deployment on Kalks since {fmtDateTime(l.track.since ?? null).slice(0, 10)}: {l.track.days.toFixed(1)} days, net {fmtMoney(l.track.netProfit ?? 0)}. Computed from closed deals on the trading engine, not entered by the author.
          </div>
          {l.risk && (
            <div className="rounded-[12px] border border-line p-3 text-[12.5px] text-fg-2">
              <div className="k-label mb-1.5">Risk settings</div>
              Size {l.risk.sizing?.mode === "risk" ? `${l.risk.sizing.riskPct}% risk` : `${l.risk.sizing?.lots} lot`} · stop {l.risk.sl?.mode === "none" ? "none" : `${l.risk.sl?.value} ${l.risk.sl?.mode}`} · target {l.risk.tp?.mode === "none" ? "none" : `${l.risk.tp?.value} ${l.risk.tp?.mode}`}
              {l.summary ? (
                <div className="mt-2 space-y-1 font-mono text-[11.5px]">
                  {Object.entries(l.summary).map(([k, v]) => (
                    <div key={k}>
                      <span className="text-fg-3">{k} = </span>
                      {v}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-1 text-[11.5px] text-fg-3">Rules are private: copy it to run it on your account.</div>
              )}
            </div>
          )}
          {!l.isAuthor && (
            <div className="rounded-[14px] border border-ember/30 bg-ember-soft/40 p-4">
              {active ? (
                <div className="space-y-2">
                  <div className="font-medium text-fg">
                    Subscribed · {l.subscription!.mode === "copy" ? `copying on #${l.subscription!.login}` : "cloned to your strategies"}
                  </div>
                  {l.subscription!.periodEnd && <div className="text-[12px] text-fg-3">{l.subscription!.autoRenew ? "Renews" : "Ends"} {fmtDateTime(l.subscription!.periodEnd).slice(0, 10)}</div>}
                  <div className="flex gap-2">
                    {l.subscription!.deploymentId && (
                      <a href={`/developer/deployments?id=${l.subscription!.deploymentId}`}>
                        <Button size="sm" variant="surface">
                          Open deployment
                        </Button>
                      </a>
                    )}
                    {l.subscription!.clonedStrategyId && (
                      <a href={`/developer/strategies?id=${l.subscription!.clonedStrategyId}`}>
                        <Button size="sm" variant="surface">
                          Open strategy
                        </Button>
                      </a>
                    )}
                    {l.subscription!.autoRenew && (
                      <Button size="sm" variant="ghost" onClick={cancel}>
                        Cancel subscription
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <Segmented size="sm" value={mode} onChange={setMode} options={[{ value: "copy", label: "Copy to my account" }, ...(l.allowClone ? [{ value: "clone" as const, label: "Clone the rules" }] : [])]} />
                  {mode === "copy" && (
                    <>
                      <div className="flex flex-wrap gap-1.5">
                        {accounts.map((a) => (
                          <button key={a.login} type="button" onClick={() => setLogin(a.login)} className={cn("h-8 rounded-full border px-3 text-[12px]", login === a.login ? "border-ember/40 bg-ember-soft text-ember" : "border-line text-fg-2")}>
                            {a.type === "live" ? "Live" : "Demo"} #{a.login}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 text-[12px] text-fg-3">
                        Lot multiplier <NumInput label="Lot multiplier" value={mult} step={0.1} min={0.01} onChange={setMult} suffix="×" />
                      </div>
                    </>
                  )}
                  <Button variant="ember" className="w-full" disabled={busy || (mode === "copy" && !login)} onClick={subscribe}>
                    {busy ? <Loader2 className="animate-spin" /> : null} {l.priceMonthly > 0 ? `Subscribe · ${l.priceMonthly} USDT / month` : "Subscribe for free"}
                  </Button>
                  {l.priceMonthly > 0 && <p className="text-[11px] text-fg-3">Paid from your Kalks wallet (USDT). Renews every 30 days; cancel any time.</p>}
                </div>
              )}
            </div>
          )}
          <div>
            <div className="k-label mb-2">Reviews ({l.ratings})</div>
            {l.subscription && !l.isAuthor && (
              <div className="mb-3 space-y-2 rounded-[12px] border border-line p-3">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <button key={i} type="button" aria-label={`${i} stars`} onClick={() => setRating(i)}>
                      <Star className={cn("size-4", i <= rating ? "fill-gold text-gold" : "text-fg-3")} />
                    </button>
                  ))}
                </div>
                <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder="How did it trade for you?" className="w-full rounded-[10px] border border-line bg-surface-2 px-3 py-2 text-[12.5px] text-fg outline-none" />
                <Button size="xs" variant="surface" onClick={review}>
                  Post review
                </Button>
              </div>
            )}
            {l.reviews.map((r) => (
              <div key={r.id} className="border-b border-line/60 py-2">
                <div className="flex items-center gap-2">
                  <Stars v={r.rating} /> <span className="text-[12px] text-fg-2">{r.user}</span>
                  <span className="ml-auto text-[11px] text-fg-3">{fmtDateTime(r.createdAt).slice(0, 10)}</span>
                </div>
                {r.comment && <p className="mt-1 text-[12.5px] text-fg-2">{r.comment}</p>}
              </div>
            ))}
            {l.reviews.length === 0 && <p className="text-[12px] text-fg-3">No reviews yet.</p>}
          </div>
        </div>
      )}
    </Dialog>
  );
}

function PublishDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const strategies = useAlgo<{ items: StrategyItem[] }>(open ? "strategies" : null);
  const deps = useAlgo<{ items: Deployment[] }>(open ? "deployments" : null);
  const [sid, setSid] = React.useState<number | null>(null);
  const [dep, setDep] = React.useState<number | null>(null);
  const [title, setTitle] = React.useState("");
  const [desc, setDesc] = React.useState("");
  const [price, setPrice] = React.useState(0);
  const [clone, setClone] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const mine = (deps.data?.items ?? []).filter((d) => d.strategyId === sid && !d.subscriptionId);
  React.useEffect(() => {
    const s = strategies.data?.items.find((x) => x.id === sid);
    if (s && !title) setTitle(s.name);
    setDep(mine[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sid, deps.data]);
  const publish = async () => {
    setBusy(true);
    try {
      await algoApi("market/listings", { body: { strategyId: sid, deploymentId: dep, title, description: desc, priceMonthly: price, allowClone: clone } });
      toast.success("Submitted for review", { description: "It appears in the marketplace once a moderator approves it." });
      onOpenChange(false);
      onDone();
    } catch (e) {
      algoError("Couldn't publish", e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Publish a strategy"
      description="Listings show a verified track record from one of your own deployments, never numbers you type."
      width={600}
      footer={
        <>
          <Button variant="surface" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="ember" disabled={busy || !sid || !dep || desc.trim().length < 20} onClick={publish}>
            {busy ? <Loader2 className="animate-spin" /> : <Upload />} Submit for review
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-[13px]">
        <div>
          <div className="text-fg-3">Strategy</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {(strategies.data?.items ?? []).filter((s) => s.valid).map((s) => (
              <button key={s.id} type="button" onClick={() => setSid(s.id)} className={cn("h-8 rounded-full border px-3 text-[12px]", sid === s.id ? "border-ember/40 bg-ember-soft text-ember" : "border-line text-fg-2")}>
                {s.name} · v{s.version}
              </button>
            ))}
          </div>
        </div>
        {sid && (
          <div>
            <div className="text-fg-3">Track record from</div>
            {mine.length === 0 ? (
              <p className="mt-1 text-[12px] text-warn">Deploy this strategy on one of your accounts first; its closed trades become the verified track record.</p>
            ) : (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {mine.map((d) => (
                  <button key={d.id} type="button" onClick={() => setDep(d.id)} className={cn("h-8 rounded-full border px-3 text-[12px]", dep === d.id ? "border-ember/40 bg-ember-soft text-ember" : "border-line text-fg-2")}>
                    #{d.login} · {d.accountType} · {d.stats.trades ?? 0} trades
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <label className="block">
          <span className="text-fg-3">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} className="mt-1 h-10 w-full rounded-[12px] border border-line bg-surface-2 px-3 text-fg outline-none focus:border-ember/50" />
        </label>
        <label className="block">
          <span className="text-fg-3">Description (idea, markets, risk; at least 20 characters)</span>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={4} maxLength={4000} className="mt-1 w-full rounded-[12px] border border-line bg-surface-2 px-3 py-2 text-fg outline-none focus:border-ember/50" />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-fg-3">Price</span>
            <NumInput label="Monthly price" value={price} min={0} step={5} onChange={setPrice} suffix="USDT / month" />
            <span className="text-[11.5px] text-fg-3">{price > 0 ? "" : "free"}</span>
          </div>
          <label className="flex items-center gap-2 text-fg-2">
            Allow cloning the rules <Toggle checked={clone} onChange={setClone} label="Allow cloning" />
          </label>
        </div>
      </div>
    </Dialog>
  );
}

export function LiveMarketplacePage() {
  const [q, setQ] = React.useState("");
  const [price, setPrice] = React.useState<"" | "free" | "paid">("");
  const [sort, setSort] = React.useState("updated");
  const [tab, setTab] = React.useState<"browse" | "subs" | "mine">("browse");
  const qs = new URLSearchParams({ ...(q ? { q } : {}), ...(price ? { price } : {}), sort }).toString();
  const browse = useAlgo<{ items: Listing[]; subscribed: number[]; platformCutPct: number }>(`market/listings?${qs}`);
  const subs = useAlgo<{ items: { id: number; listingId: number; title: string; author: string; symbol: string; timeframe: string; mode: string; status: string; login: number | null; deploymentStatus: string | null; price: number; periodEnd: string | null; autoRenew: boolean }[] }>(tab === "subs" ? "market/subscriptions" : null);
  const mine = useAlgo<{ items: Listing[]; earned: number; platformFees: number; payments: number }>(tab === "mine" ? "market/mine" : null);
  const accounts = useAlgo<{ items: TradingAccount[] }>("accounts");
  const [open, setOpen] = React.useState<number | null>(null);
  const [publishing, setPublishing] = React.useState(false);
  const items = browse.data?.items ?? [];
  return (
    <>
      <PageHeader
        title="Strategy marketplace"
        subtitle="Strategies with verified track records from Kalks accounts. Copy one onto your account, or publish your own and earn from subscriptions."
        actions={
          <Button variant="ember" onClick={() => setPublishing(true)}>
            <Upload /> Publish a strategy
          </Button>
        }
      />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: "browse", label: "Browse", count: items.length }, { value: "subs", label: "My subscriptions" }, { value: "mine", label: "My listings" }]} className="mb-5" />
      {tab === "browse" && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="flex h-10 min-w-[240px] flex-1 items-center gap-2 rounded-full border border-line bg-surface-2 px-4">
              <Search className="size-4 text-fg-3" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search strategies, authors…" aria-label="Search" className="w-full bg-transparent text-[13.5px] text-fg outline-none placeholder:text-fg-3" />
            </div>
            <Segmented size="sm" value={price || "all"} onChange={(v) => setPrice(v === "all" ? "" : (v as "free" | "paid"))} options={[{ value: "all", label: "All" }, { value: "free", label: "Free" }, { value: "paid", label: "Paid" }]} />
            <Segmented size="sm" value={sort} onChange={setSort} options={[{ value: "updated", label: "Newest" }, { value: "rating", label: "Top rated" }, { value: "subscribers", label: "Popular" }]} />
          </div>
          {browse.loading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-64" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <Card className="grid min-h-[300px] place-items-center">
              <EmptyState title="No strategies listed yet" text="Be the first: deploy a strategy on a demo account, then publish it with its verified track record." />
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((l) => (
                <ListingCard key={l.id} l={l} subscribed={browse.data!.subscribed.includes(l.id)} onOpen={() => setOpen(l.id)} />
              ))}
            </div>
          )}
          <p className="mt-4 text-[11.5px] text-fg-3">Past performance does not guarantee future results. Track records come from live or demo accounts on Kalks and are labelled accordingly. Platform fee on paid subscriptions: {browse.data?.platformCutPct ?? 20}%.</p>
        </>
      )}
      {tab === "subs" && (
        <Card>
          <CardHeader icon={<Store />} title="My subscriptions" />
          <div className="overflow-x-auto px-6 pb-6 pt-4">
            <table className="w-full min-w-[640px] text-[13px]">
              <thead className="text-fg-3">
                <tr>
                  <th className="py-1.5 text-left font-medium">Strategy</th>
                  <th className="py-1.5 text-left font-medium">Mode</th>
                  <th className="py-1.5 text-left font-medium">Status</th>
                  <th className="py-1.5 text-right font-medium">Price</th>
                  <th className="py-1.5 text-right font-medium">Renews</th>
                </tr>
              </thead>
              <tbody>
                {(subs.data?.items ?? []).map((s) => (
                  <tr key={s.id} className="cursor-pointer border-t border-line/60 hover:bg-surface-2/50" onClick={() => setOpen(s.listingId)}>
                    <td className="py-2">
                      <div className="text-fg">{s.title}</div>
                      <div className="font-mono text-[11px] text-fg-3">
                        {s.symbol} {s.timeframe} · by {s.author}
                      </div>
                    </td>
                    <td className="text-fg-2">{s.mode === "copy" ? `copy on #${s.login}` : "clone"}</td>
                    <td>
                      <Chip size="sm" tone={s.status === "active" ? "up" : "neutral"}>
                        {s.status}
                      </Chip>
                      {s.deploymentStatus && <span className="ml-2 text-[11px] text-fg-3">{s.deploymentStatus}</span>}
                    </td>
                    <td className="k-num text-right">{s.price > 0 ? `${s.price} USDT` : "Free"}</td>
                    <td className="text-right text-[12px] text-fg-3">{s.periodEnd ? (s.autoRenew ? fmtDateTime(s.periodEnd).slice(0, 10) : `ends ${fmtDateTime(s.periodEnd).slice(0, 10)}`) : "–"}</td>
                  </tr>
                ))}
                {subs.data && subs.data.items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-fg-3">
                      No subscriptions yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {tab === "mine" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {(
              [
                ["Earned", `${(mine.data?.earned ?? 0).toFixed(2)} USDT`],
                ["Platform fees", `${(mine.data?.platformFees ?? 0).toFixed(2)} USDT`],
                ["Payments", String(mine.data?.payments ?? 0)],
              ] as const
            ).map(([k, v]) => (
              <Card key={k} className="px-5 py-4">
                <div className="k-label">{k}</div>
                <div className="k-num mt-1 text-[22px] font-semibold text-fg">{v}</div>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader title="My listings" action={<Button size="sm" variant="surface" onClick={() => setPublishing(true)}><Plus /> Publish</Button>} />
            <div className="space-y-2 px-6 pb-6 pt-4">
              {(mine.data?.items ?? []).map((l) => (
                <button key={l.id} type="button" onClick={() => setOpen(l.id)} className="flex w-full items-center gap-3 rounded-[12px] border border-line px-4 py-3 text-left hover:bg-surface-2/50">
                  <SymbolAvatar symbol={l.symbol} size={20} />
                  <div className="min-w-0">
                    <div className="truncate text-fg">{l.title}</div>
                    <div className="text-[11.5px] text-fg-3">
                      {l.subscribers} subscribers · {l.priceMonthly > 0 ? `${l.priceMonthly} USDT / month` : "free"}
                      {l.moderationNote ? ` · moderator: ${l.moderationNote}` : ""}
                    </div>
                  </div>
                  <Chip size="sm" tone={l.status === "approved" ? "up" : l.status === "pending" ? "warn" : "down"} className="ml-auto">
                    {l.status}
                  </Chip>
                </button>
              ))}
              {mine.data && mine.data.items.length === 0 && <p className="text-[12.5px] text-fg-3">You haven't published a strategy yet.</p>}
            </div>
          </Card>
        </div>
      )}
      <ListingDialog id={open} onClose={() => setOpen(null)} accounts={(accounts.data?.items ?? []).filter((a) => a.status === "active")} onChanged={() => (browse.reload(), subs.reload(), mine.reload())} />
      <PublishDialog open={publishing} onOpenChange={setPublishing} onDone={() => (setTab("mine"), mine.reload())} />
    </>
  );
}
