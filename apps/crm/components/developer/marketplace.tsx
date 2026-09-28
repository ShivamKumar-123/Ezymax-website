"use client";

import * as React from "react";
import { toast } from "sonner";
import { BadgeCheck, Check, Info, Star, Users, Wallet } from "lucide-react";
import { Avatar, Button, Chip, Dialog, Flag, Money, Segmented, Sparkline, SpotlightCard, SymbolAvatar, cn, formatNumber } from "@kalks/ui";
import { ACCOUNTS, WALLET } from "@kalks/mock";
import { MARKETPLACE_TERMS, type MarketStrategy } from "@kalks/mock/developer";

export function PriceTag({ price, size = "md" }: { price: number; size?: "sm" | "md" }) {
  return price === 0 ? (
    <Chip tone="up" size={size}>
      Free
    </Chip>
  ) : (
    <Chip tone="gold" size={size}>
      ${price}/mo
    </Chip>
  );
}

export function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {Array.from({ length: 5 }, (_, i) => {
        const fill = Math.max(0, Math.min(1, rating - i));
        return (
          <span key={i} className="relative inline-block size-3">
            <Star className="absolute inset-0 size-3 text-fg-3/40" fill="currentColor" strokeWidth={0} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className="size-3 text-gold" fill="currentColor" strokeWidth={0} />
            </span>
          </span>
        );
      })}
    </span>
  );
}

export function SymbolStack({ symbols, size = 22 }: { symbols: string[]; size?: number }) {
  return (
    <span className="flex -space-x-1.5">
      {symbols.slice(0, 4).map((s) => (
        <span key={s} className="rounded-full ring-2 ring-surface">
          <SymbolAvatar symbol={s} size={size} />
        </span>
      ))}
    </span>
  );
}

const RISK_TONE = { Low: "text-up", Medium: "text-warn", High: "text-down" } as const;

export function StrategyCard({ s, onSubscribe, subscribed }: { s: MarketStrategy; onSubscribe: () => void; subscribed: boolean }) {
  return (
    <SpotlightCard className="group flex h-full flex-col">
      <div className="relative flex items-start justify-between gap-3 px-5 pt-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar src={s.author.photo} name={s.author.name} size={34} verified={s.verified} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 truncate text-[12.5px] font-medium text-fg-2">
              {s.author.name}
              <Flag country={s.author.country} className="size-3.5" />
            </div>
            <div className="text-[11px] text-fg-3">{s.months} months live · {s.tradesPerWeek} trades/wk</div>
          </div>
        </div>
        <PriceTag price={s.price} />
      </div>
      <div className="relative px-5 pt-3.5">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-[16px] font-medium tracking-tight">{s.name}</h3>
          {s.verified && <BadgeCheck className="size-4 shrink-0 text-gold" />}
        </div>
        <p className="mt-0.5 line-clamp-1 text-[12.5px] text-fg-3">{s.tagline}</p>
      </div>
      <div className="relative mt-3 px-5">
        <div className="relative overflow-hidden rounded-[14px] border border-line bg-surface-2 px-3 pb-1 pt-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SymbolStack symbols={s.symbols} size={20} />
              <span className="font-mono text-[10.5px] text-fg-3">{s.symbols.join(" · ")}</span>
            </div>
            <span className="k-num text-[15px] font-semibold text-up">+{s.returnPct.toFixed(1)}%</span>
          </div>
          <Sparkline data={s.spark} width={320} height={58} tone={s.returnPct > 50 ? "gold" : "up"} className="mt-1.5 h-[58px] w-full" />
        </div>
      </div>
      <div className="relative grid grid-cols-3 gap-2 px-5 pt-3 text-[11px]">
        <div>
          <div className="text-fg-3">Max DD</div>
          <div className="k-num mt-0.5 text-[13.5px] font-medium text-down">-{s.maxDD}%</div>
        </div>
        <div>
          <div className="text-fg-3">Win rate</div>
          <div className="k-num mt-0.5 text-[13.5px] font-medium">{s.winRate}%</div>
        </div>
        <div>
          <div className="text-fg-3">Subscribers</div>
          <div className="k-num mt-0.5 flex items-center gap-1 text-[13.5px] font-medium">
            <Users className="size-3 text-fg-3" />
            {formatNumber(s.subscribers, 0)}
          </div>
        </div>
      </div>
      <div className="relative mt-auto flex items-center justify-between gap-2 px-5 pb-5 pt-4">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Stars rating={s.rating} />
            <span className="k-num text-[12px] font-medium">{s.rating.toFixed(1)}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-fg-3">
            <span className="k-num">{s.reviews} reviews</span>·<span className={RISK_TONE[s.risk]}>{s.risk} risk</span>
          </div>
        </div>
        {subscribed ? (
          <Button size="sm" variant="up-outline" onClick={() => toast.info(`You're subscribed to ${s.name}`, { description: "Manage it under Copy & PAMM → Subscriptions." })}>
            <Check /> Subscribed
          </Button>
        ) : (
          <Button size="sm" variant={s.price ? "surface" : "surface"} className="group-hover:border-ember/40" onClick={onSubscribe}>
            Subscribe
          </Button>
        )}
      </div>
    </SpotlightCard>
  );
}

/* ------------------------------------------------------------------ */
/* Subscribe dialog                                                    */
/* ------------------------------------------------------------------ */

export function SubscribeDialog({ s, onOpenChange, onDone }: { s: MarketStrategy | null; onOpenChange: (o: boolean) => void; onDone: (id: string) => void }) {
  const live = ACCOUNTS.filter((a) => a.type === "live" && !a.cent);
  const all = ACCOUNTS.filter((a) => !a.cent);
  const [login, setLogin] = React.useState(live[0]!.login);
  const [mode, setMode] = React.useState<"multiplier" | "allocation">("multiplier");
  const [mult, setMult] = React.useState(1);
  const [alloc, setAlloc] = React.useState(5000);
  const [agree, setAgree] = React.useState(false);
  React.useEffect(() => {
    if (s) {
      setAgree(false);
      setMult(1);
    }
  }, [s]);
  if (!s) return <Dialog open={false} onOpenChange={onOpenChange} title="">{null}</Dialog>;
  const acct = all.find((a) => a.login === login)!;
  const authorGets = (s.price * MARKETPLACE_TERMS.authorShare) / 100;
  const platform = s.price - authorGets;
  const lowEquity = mode === "allocation" ? alloc < s.minDeposit : acct.equity < s.minDeposit;

  return (
    <Dialog
      open={!!s}
      onOpenChange={onOpenChange}
      width={560}
      title={`Subscribe to ${s.name}`}
      description={`by ${s.author.name} · orders arrive tagged source=strategy`}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="ember"
            disabled={!agree}
            onClick={() => {
              onDone(s.id);
              onOpenChange(false);
              toast.success(`Subscribed to ${s.name}`, {
                description: `${login} · ${mode === "multiplier" ? `${mult.toFixed(1)}× sizing` : `$${formatNumber(alloc, 0)} allocated`}${s.price ? ` · $${s.price} charged from wallet` : ""}`,
              });
            }}
          >
            {s.price ? `Pay $${s.price} & subscribe` : "Subscribe free"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="k-row flex items-center gap-3 px-4 py-3">
          <Avatar src={s.author.photo} name={s.author.name} size={40} verified={s.verified} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-medium">{s.name}</div>
            <div className="flex items-center gap-2 text-[11.5px] text-fg-3">
              <SymbolStack symbols={s.symbols} size={16} />
              <span className="k-num text-up">+{s.returnPct}% 12m</span>·<span className="k-num text-down">DD -{s.maxDD}%</span>
            </div>
          </div>
          <Sparkline data={s.spark} width={90} height={32} tone="up" />
        </div>

        <div>
          <div className="mb-1.5 text-[12.5px] font-medium text-fg-2">Copy into account</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {all.map((a) => {
              const on = a.login === login;
              return (
                <button
                  key={a.login}
                  type="button"
                  onClick={() => setLogin(a.login)}
                  className={cn("k-row flex items-center gap-3 px-3.5 py-2.5 text-left transition-colors", on ? "border-ember/45 bg-ember-soft" : "hover:bg-surface-3")}
                >
                  <span className={cn("grid size-4 shrink-0 place-items-center rounded-full border", on ? "border-ember bg-ember" : "border-fg-3")}>{on && <span className="size-1.5 rounded-full bg-white" />}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[13px]">{a.login}</div>
                    <div className="text-[11px] text-fg-3">
                      {a.type === "live" ? "Live" : "Demo"} · {a.group}
                    </div>
                  </div>
                  <Money value={a.equity} countUp={false} decimals={0} className="text-[12.5px] text-fg-2" />
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[12.5px] font-medium text-fg-2">Position sizing</span>
            <Segmented size="xs" value={mode} onChange={setMode} options={[{ value: "multiplier", label: "Multiplier" }, { value: "allocation", label: "Fixed allocation" }]} />
          </div>
          {mode === "multiplier" ? (
            <div className="k-row px-4 py-3.5">
              <div className="flex items-baseline justify-between">
                <span className="text-[12px] text-fg-3">Master volume ×</span>
                <span className="k-num text-[22px] font-semibold">
                  {mult.toFixed(1)}
                  <span className="text-fg-3">×</span>
                </span>
              </div>
              <input type="range" min={0.1} max={5} step={0.1} value={mult} onChange={(e) => setMult(Number(e.target.value))} className="mt-2 w-full accent-[var(--k-ember)]" aria-label="Multiplier" />
              <div className="flex justify-between font-mono text-[10.5px] text-fg-3">
                <span>0.1×</span>
                <span>1×</span>
                <span>5×</span>
              </div>
              <div className="mt-2 text-[11.5px] text-fg-3">
                A 1.00 lot master trade opens <span className="k-num text-fg">{mult.toFixed(2)} lot</span> on {login}. Expected max DD ≈ <span className="k-num text-down">-{(s.maxDD * mult).toFixed(1)}%</span>
              </div>
            </div>
          ) : (
            <div className="k-row px-4 py-3.5">
              <div className="flex items-center gap-2">
                <span className="text-fg-3">$</span>
                <input type="number" value={alloc} min={s.minDeposit} step={100} onChange={(e) => setAlloc(Number(e.target.value))} className="k-num w-full bg-transparent text-[22px] font-semibold outline-none" aria-label="Allocation" />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[1000, 2500, 5000, 10000].map((v) => (
                  <button key={v} type="button" onClick={() => setAlloc(v)} className={cn("rounded-full border px-2.5 py-1 font-mono text-[11px]", alloc === v ? "border-ember/40 bg-ember-soft text-ember" : "border-line text-fg-2 hover:bg-surface-3")}>
                    ${formatNumber(v, 0)}
                  </button>
                ))}
              </div>
              <div className="mt-2 text-[11.5px] text-fg-3">Trades are scaled to this share of the master&apos;s equity. Min ${formatNumber(s.minDeposit, 0)}.</div>
            </div>
          )}
          {lowEquity && <div className="mt-2 text-[11.5px] text-warn">Below the author&apos;s recommended minimum of ${formatNumber(s.minDeposit, 0)}.</div>}
        </div>

        <div className="overflow-hidden rounded-[14px] border border-line">
          <div className="divide-y divide-line text-[13px]">
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-fg-3">Subscription</span>
              <span className="k-num font-medium">{s.price ? `$${s.price.toFixed(2)} / month` : "Free"}</span>
            </div>
            {s.price > 0 && (
              <div className="flex items-center justify-between px-4 py-2.5 text-[12px]">
                <span className="flex items-center gap-1.5 text-fg-3">
                  <Info className="size-3.5" /> Split: author {MARKETPLACE_TERMS.authorShare}% · platform {MARKETPLACE_TERMS.platformShare}%
                </span>
                <span className="k-num text-fg-2">
                  ${authorGets.toFixed(2)} · ${platform.toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-fg-3">Performance fee</span>
              <span className="font-medium">None</span>
            </div>
            <div className="flex items-center justify-between bg-surface-2 px-4 py-3">
              <span className="flex items-center gap-2 font-medium">
                <Wallet className="size-4 text-fg-3" /> Due today
              </span>
              <span className="text-right">
                <Money value={s.price} countUp={false} className="text-[18px] font-semibold" />
                <span className="block text-[11px] text-fg-3">
                  from wallet · <span className="k-num">{formatNumber(WALLET.assets[0]!.balance, 2)} USDT</span>
                </span>
              </span>
            </div>
          </div>
        </div>
        <p className="-mt-2 text-[11.5px] text-fg-3">The platform fee is already included in the price — you are never charged extra. Cancel any time; paid plans renew monthly.</p>

        <label className="flex cursor-pointer items-start gap-2.5 text-[12.5px] text-fg-2">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 size-4 accent-[var(--k-ember)]" />
          I understand past performance doesn&apos;t guarantee future results and that trades are copied automatically into my account.
        </label>
      </div>
    </Dialog>
  );
}
