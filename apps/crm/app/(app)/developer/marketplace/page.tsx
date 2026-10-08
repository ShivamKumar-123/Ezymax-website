"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { ArrowDownUp, ArrowUpRight, BadgeCheck, ChevronDown, Crown, Search, Upload, Users, Check } from "lucide-react";
import {
  Avatar,
  Button,
  Card,
  Chip,
  EmptyState,
  Flag,
  Icon3D,
  Menu,
  PageHeader,
  Reveal,
  Segmented,
  Sparkline,
  Starfield,
  cn,
  formatNumber,
} from "@/components/kit";
import { MARKETPLACE_TERMS, MARKET_STRATEGIES, MY_PUBLISHING, type MarketStrategy } from "@ezymex/mock/developer";
import type { AssetClass } from "@ezymex/mock";
import { Stars, StrategyCard, SubscribeDialog, SymbolStack } from "@/components/developer/marketplace";
import { IS_DEMO as DEMO_BUILD } from "@ezymex/mock/mode";
import { LiveMarketplacePage } from "@/components/algo/marketplace-page";

const CLASSES: { value: AssetClass | "all"; label: string }[] = [
  { value: "all", label: "All assets" },
  { value: "forex", label: "Forex" },
  { value: "metals", label: "Metals" },
  { value: "indices", label: "Indices" },
  { value: "crypto", label: "Crypto" },
  { value: "energies", label: "Energies" },
  { value: "stocks", label: "Stocks" },
];

const SORTS = {
  return: { label: "Highest return", fn: (a: MarketStrategy, b: MarketStrategy) => b.returnPct - a.returnPct },
  subs: { label: "Most subscribers", fn: (a: MarketStrategy, b: MarketStrategy) => b.subscribers - a.subscribers },
  rating: { label: "Top rated", fn: (a: MarketStrategy, b: MarketStrategy) => b.rating - a.rating },
  dd: { label: "Lowest drawdown", fn: (a: MarketStrategy, b: MarketStrategy) => a.maxDD - b.maxDD },
  price: { label: "Price: low to high", fn: (a: MarketStrategy, b: MarketStrategy) => a.price - b.price },
} as const;
type SortKey = keyof typeof SORTS;

function FeaturedHero({ s, onSubscribe, subscribed }: { s: MarketStrategy; onSubscribe: () => void; subscribed: boolean }) {
  return (
    <Card hot className="relative overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/photos/gold.jpg" alt="" className="absolute inset-y-0 right-0 hidden h-full w-[55%] object-cover opacity-35 lg:block" />
      <div className="absolute inset-0 hidden bg-gradient-to-r from-black/60 via-black/30 to-transparent light:from-white/85 light:via-white/40 lg:block" />
      <Starfield density={50} />
      <div className="relative grid grid-cols-1 gap-6 p-6 sm:p-7 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="gold">
              <Crown className="size-3.5" /> Featured this week
            </Chip>
            <Chip tone="up" dot>
              Verified track record · {s.months} months
            </Chip>
          </div>
          <h2 className="mt-4 text-[28px] font-medium leading-tight tracking-tight sm:text-[34px]">{s.name}</h2>
          <p className="mt-1.5 max-w-lg text-[14px] text-fg-2">{s.tagline}. Fully automated on your own account — you keep custody, stop any time.</p>
          <div className="mt-4 flex items-center gap-3">
            <Avatar src={s.author.photo} name={s.author.name} size={38} verified />
            <div>
              <div className="flex items-center gap-1.5 text-[13.5px] font-medium">
                {s.author.name} <Flag country={s.author.country} className="size-3.5" />
              </div>
              <div className="flex items-center gap-1.5 text-[11.5px] text-fg-3">
                <Stars rating={s.rating} /> {s.rating} · {s.reviews} reviews
              </div>
            </div>
          </div>
          <div className="mt-5 grid max-w-lg grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["12m return", `+${s.returnPct}%`, "text-up"],
              ["Max DD", `-${s.maxDD}%`, "text-down"],
              ["Win rate", `${s.winRate}%`, "text-fg"],
              ["Subscribers", formatNumber(s.subscribers, 0), "text-fg"],
            ].map(([k, v, c]) => (
              <div key={k} className="rounded-[14px] border border-white/10 light:border-line bg-black/25 light:bg-white/70 px-3 py-2.5 backdrop-blur">
                <div className="text-[11.5px] text-fg-3">{k}</div>
                <div className={cn("k-num mt-0.5 text-[17px] font-semibold", c)}>{v}</div>
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {subscribed ? (
              <Button variant="up-outline" size="lg" onClick={() => toast.info("Already subscribed", { description: "Manage it under Copy & PAMM." })}>
                <BadgeCheck /> Subscribed
              </Button>
            ) : (
              <Button variant="ember" size="lg" shimmer onClick={onSubscribe}>
                Subscribe · ${s.price}/mo <ArrowUpRight />
              </Button>
            )}
            <Button variant="surface" size="lg" onClick={() => toast.info(`${s.name} · full report`, { description: "Monthly returns, trade list and risk metrics — verified by Ezymex." })}>
              View track record
            </Button>
          </div>
        </div>
        <div className="rounded-[18px] border border-white/10 light:border-line bg-black/35 light:bg-white/70 p-4 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SymbolStack symbols={s.symbols} size={24} />
              <span className="text-[13px] font-medium">Equity curve</span>
            </div>
            <span className="text-[11.5px] text-fg-3">Last 12 months</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="k-num text-[28px] font-semibold text-gold">+{s.returnPct}%</span>
            <span className="text-[12px] text-fg-3">vs XAUUSD buy &amp; hold +31.8%</span>
          </div>
          <Sparkline data={s.spark} width={520} height={140} tone="gold" className="mt-2 h-[140px] w-full" />
          <div className="mt-2 grid grid-cols-12 gap-1">
            {[4.2, 6.8, -1.9, 5.1, 7.4, 3.3, -2.6, 8.9, 5.5, 2.1, 9.8, 6.4].map((m, i) => (
              <div key={i} className={cn("rounded-[4px] py-1 text-center font-mono text-[9px]", m >= 0 ? "bg-up-soft text-up" : "bg-down-soft text-down")}>
                {m > 0 ? "+" : ""}
                {m.toFixed(0)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function PublishCta() {
  const [subs, setSubs] = React.useState(80);
  const [price, setPrice] = React.useState(29);
  const gross = subs * price;
  const net = (gross * MARKETPLACE_TERMS.authorShare) / 100;
  return (
    <Card className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_260px_at_0%_100%,var(--k-ember-soft),transparent_70%)]" />
      <div className="relative grid grid-cols-1 gap-6 p-6 sm:p-7 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <div className="flex gap-5">
          <Icon3D name="rocket" size={80} className="hidden shrink-0 sm:block" />
          <div>
            <Chip tone="ember">Creators</Chip>
            <h3 className="mt-3 text-[24px] font-medium leading-tight tracking-tight">Publish your strategy. Keep {MARKETPLACE_TERMS.authorShare}% of every subscription.</h3>
            <p className="mt-2 max-w-lg text-[13.5px] text-fg-2">
              Connect a strategy from the builder or an API account with at least 3 months of live history. We verify the track record, handle billing and pay out on the {MARKETPLACE_TERMS.payoutDay} to your USDT wallet.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button variant="ember" size="lg" onClick={() => toast.success("Publishing wizard started", { description: `Draft "${MY_PUBLISHING.draftName}" loaded — add a description and price.` })}>
                <Upload /> Publish strategy
              </Button>
              <Button variant="surface" size="lg" onClick={() => toast.info("Creator guidelines", { description: "Verification, pricing rules and payout schedule." })}>
                Creator guidelines
              </Button>
            </div>
            <div className="mt-3 text-[12px] text-fg-3">
              You have <span className="text-fg-2">{MY_PUBLISHING.drafts} draft</span> · {MY_PUBLISHING.draftName}
            </div>
          </div>
        </div>
        <div className="k-row p-5">
          <div className="flex items-center justify-between text-[12.5px]">
            <span className="font-medium">Revenue split</span>
            <span className="text-fg-3">per subscription</span>
          </div>
          <div className="mt-3 flex h-10 overflow-hidden rounded-full border border-line">
            <motion.div initial={{ width: "20%" }} animate={{ width: `${MARKETPLACE_TERMS.authorShare}%` }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} className="k-ember-btn flex items-center justify-between px-4 text-[12.5px] font-semibold">
              <span>You</span>
              <span className="k-num">{MARKETPLACE_TERMS.authorShare}%</span>
            </motion.div>
            <div className="flex flex-1 items-center justify-between bg-surface-3 px-4 text-[12.5px] text-fg-2">
              <span>Ezymex</span>
              <span className="k-num">{MARKETPLACE_TERMS.platformShare}%</span>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <label className="block">
              <div className="flex justify-between text-[11.5px] text-fg-3">
                <span>Subscribers</span>
                <span className="k-num text-fg">{subs}</span>
              </div>
              <input type="range" min={10} max={500} step={10} value={subs} onChange={(e) => setSubs(Number(e.target.value))} className="mt-1.5 w-full accent-[var(--k-ember)]" />
            </label>
            <label className="block">
              <div className="flex justify-between text-[11.5px] text-fg-3">
                <span>Price / month</span>
                <span className="k-num text-fg">${price}</span>
              </div>
              <input type="range" min={9} max={99} step={1} value={price} onChange={(e) => setPrice(Number(e.target.value))} className="mt-1.5 w-full accent-[var(--k-ember)]" />
            </label>
          </div>
          <div className="mt-4 flex items-end justify-between border-t border-line pt-3">
            <div>
              <div className="text-[12px] text-fg-3">You earn / month</div>
              <div className="k-num text-[26px] font-semibold text-gold">${formatNumber(net, 0)}</div>
            </div>
            <div className="text-right text-[11.5px] text-fg-3">
              Gross <span className="k-num text-fg-2">${formatNumber(gross, 0)}</span>
              <br />
              Platform fee <span className="k-num text-fg-2">${formatNumber(gross - net, 0)}</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function DemoMarketplacePage() {
  const [price, setPrice] = React.useState<"all" | "free" | "paid">("all");
  const [cls, setCls] = React.useState<AssetClass | "all">("all");
  const [sort, setSort] = React.useState<SortKey>("return");
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState<MarketStrategy | null>(null);
  const [subscribed, setSubscribed] = React.useState<string[]>([]);
  const featured = MARKET_STRATEGIES.find((s) => s.featured)!;

  const list = React.useMemo(
    () =>
      MARKET_STRATEGIES.filter((s) => (price === "all" ? true : price === "free" ? s.price === 0 : s.price > 0))
        .filter((s) => cls === "all" || s.assetClass === cls)
        .filter((s) => !q || `${s.name} ${s.author.name} ${s.symbols.join(" ")} ${s.tagline}`.toLowerCase().includes(q.toLowerCase()))
        .sort(SORTS[sort].fn),
    [price, cls, sort, q],
  );
  const totalSubs = MARKET_STRATEGIES.reduce((s, x) => s + x.subscribers, 0);

  return (
    <div className="pb-24">
      <PageHeader
        title="Strategy marketplace"
        subtitle={`${MARKET_STRATEGIES.length} verified algorithms · ${formatNumber(totalSubs, 0)} active subscribers · runs on your own Ezymex account`}
        actions={
          <>
            <Button variant="surface" size="lg" onClick={() => toast.info(subscribed.length ? `${subscribed.length} active subscription${subscribed.length > 1 ? "s" : ""}` : "No subscriptions yet", { description: "Subscriptions also appear under Copy & PAMM." })}>
              <Users /> My subscriptions {subscribed.length > 0 && <span className="k-num rounded-full bg-ember-soft px-1.5 text-[11px] text-ember">{subscribed.length}</span>}
            </Button>
            <Button variant="ember" size="lg" shimmer onClick={() => document.getElementById("publish")?.scrollIntoView({ behavior: "smooth", block: "center" })}>
              <Upload /> Publish yours
            </Button>
          </>
        }
      />

      <Reveal>
        <FeaturedHero s={featured} subscribed={subscribed.includes(featured.id)} onSubscribe={() => setOpen(featured)} />
      </Reveal>

      <Reveal delay={0.05} className="mt-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <Segmented
            value={price}
            onChange={setPrice}
            options={[
              { value: "all", label: <>All <span className="k-num text-fg-3">{MARKET_STRATEGIES.length}</span></> },
              { value: "free", label: <>Free <span className="k-num text-fg-3">{MARKET_STRATEGIES.filter((s) => !s.price).length}</span></> },
              { value: "paid", label: <>Paid <span className="k-num text-fg-3">{MARKET_STRATEGIES.filter((s) => s.price).length}</span></> },
            ]}
          />
          <div className="-mx-1 flex flex-1 gap-1.5 overflow-x-auto px-1 pb-1 lg:pb-0">
            {CLASSES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCls(c.value)}
                className={cn(
                  "h-8 shrink-0 rounded-full border px-3.5 text-[12.5px] font-medium transition-colors",
                  cls === c.value ? "border-ember/40 bg-ember-soft text-ember" : "border-line bg-surface-2 text-fg-2 hover:bg-surface-3 hover:text-fg",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 flex-1 items-center gap-2 rounded-full border border-line bg-surface-2 px-3.5 focus-within:border-ember/50 lg:w-56 lg:flex-none">
              <Search className="size-3.5 text-fg-3" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search strategies, authors…" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-fg-3" />
            </div>
            <Menu
              width={210}
              trigger={
                <Button size="sm" variant="surface" className="h-9">
                  <ArrowDownUp /> <span className="hidden sm:inline">{SORTS[sort].label}</span>
                  <ChevronDown className="opacity-60" />
                </Button>
              }
              items={(Object.keys(SORTS) as SortKey[]).map((k) => ({ label: SORTS[k].label, hint: k === sort ? <Check className="size-3.5 text-ember" /> : undefined, onSelect: () => setSort(k) }))}
            />
          </div>
        </div>
      </Reveal>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {list.map((s, i) => (
            <motion.div key={s.id} layout initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.4, delay: Math.min(i * 0.04, 0.24), ease: [0.16, 1, 0.3, 1] }}>
              <StrategyCard s={s} subscribed={subscribed.includes(s.id)} onSubscribe={() => setOpen(s)} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      {list.length === 0 && (
        <Card className="mt-4">
          <EmptyState
            illustration="magnifying_glass_tilted_left"
            title="No strategies match"
            text="Try another asset class or clear the search."
            action={
              <Button
                variant="surface"
                onClick={() => {
                  setQ("");
                  setCls("all");
                  setPrice("all");
                }}
              >
                Clear filters
              </Button>
            }
          />
        </Card>
      )}

      <Reveal delay={0.05} className="mt-6">
        <div id="publish">
          <PublishCta />
        </div>
      </Reveal>

      <SubscribeDialog s={open} onOpenChange={(o) => !o && setOpen(null)} onDone={(id) => setSubscribed((x) => [...x, id])} />
    </div>
  );
}

export default function MarketplacePage() {
  return DEMO_BUILD ? <DemoMarketplacePage /> : <React.Suspense fallback={null}><LiveMarketplacePage /></React.Suspense>;
}
