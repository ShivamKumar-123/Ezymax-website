"use client";

// Live strategy marketplace (/developer/marketplace, D83): browse verified strategies, subscribe (copy onto
// your account, or clone the rules when the author allows it), review, and publish your own.

import * as React from "react";
import { BadgeCheck, Building2, Loader2, Plus, Search, Star, Store, Upload, Users } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, Dialog, EmptyState, EquityChart, PageHeader, Reveal, Segmented, Skeleton, Sparkline, SymbolAvatar, Tabs, Toggle, cn } from "@/components/kit";
import { useT } from "@kalks/i18n/react";
import { NumInput } from "./builder";
import { AlgoError, algoApi, algoError, fmtDateTime, fmtMoney, fmtPct, useAlgo, type Deployment, type StrategyItem, type TradingAccount } from "./api";

/** An idempotency key for one subscribe attempt (32 hex characters). */
const attemptKey = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");

/**
 * Whether a failed subscribe attempt is over: the service refused it (a 4xx, except a setup still in progress).
 * No answer, a timeout or a server error may have gone through: a retry sends the same key and gets that
 * subscription instead of a second charge.
 */
const attemptOver = (e: unknown) => e instanceof AlgoError && e.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 429 && e.code !== "in_progress";

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
  /** House account listing: operated by the broker (shown with the disclosure label) */
  house?: boolean;
}
/** A house listing's backtest: simulated on history, never live results. */
interface HouseBacktest {
  kind: "backtest";
  label: string;
  summary: { returnPct?: number; trades?: number; winRate?: number; maxDrawdownPct?: number; profitFactor?: number | null; firstBar?: number | null; lastBar?: number | null } | null;
  curve: { t: number; equity: number }[];
  notes: string[] | null;
}
interface ListingDetail extends Listing {
  risk?: Record<string, unknown> & { sizing?: { mode: string; lots: number; riskPct: number }; sl?: { mode: string; value: number }; tp?: { mode: string; value: number } };
  summary?: Record<string, string>;
  kind?: string;
  reviews: { id: number; user: string; rating: number; comment: string; createdAt: string; mine: boolean }[];
  subscription: { id: number; mode: string; status: string; login: number | null; deploymentId: number | null; clonedStrategyId: number | null; periodEnd: string | null; autoRenew: boolean } | null;
  isAuthor: boolean;
  platformCutPct: number;
  backtest?: HouseBacktest | null;
}

function HouseChip() {
  const t = useT();
  return (
    <Chip size="sm" tone="info">
      <Building2 className="size-3" /> {t("developer.market.houseChip")}
    </Chip>
  );
}

function BacktestBlock({ b }: { b: HouseBacktest }) {
  const t = useT();
  const s = b.summary ?? {};
  const data = b.curve.map((p) => ({ time: p.t, value: p.equity })).filter((p) => Number.isFinite(p.time));
  const range = s.firstBar && s.lastBar ? t("developer.market.range", { from: new Date(s.firstBar * 1000).toISOString().slice(0, 10), to: new Date(s.lastBar * 1000).toISOString().slice(0, 10) }) : null;
  return (
    <div className="rounded-[12px] border border-warn/30 bg-warn-soft p-3" data-testid="house-backtest">
      <div className="flex flex-wrap items-center gap-2">
        <Chip size="sm" tone="warn">
          {t("developer.market.backtestSimulated")}
        </Chip>
        {range && <span className="text-[11.5px] text-fg-3">{range}</span>}
      </div>
      <p className="mt-1.5 text-[11.5px] text-fg-2">{b.label}. {t("developer.market.backtestNote")}</p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(
          [
            [t("developer.market.return"), s.returnPct !== undefined ? fmtPct(s.returnPct, 2) : "—"],
            [t("developer.dep.winRate"), s.winRate !== undefined ? `${s.winRate.toFixed(1)}%` : "—"],
            [t("developer.market.maxDd"), s.maxDrawdownPct !== undefined ? `${s.maxDrawdownPct.toFixed(2)}%` : "—"],
            [t("developer.market.trades"), s.trades !== undefined ? String(s.trades) : "—"],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="rounded-[10px] bg-surface/60 px-2.5 py-1.5">
            <div className="text-[11.5px] text-fg-3">{k}</div>
            <div className="k-num text-[13.5px] text-fg">{v}</div>
          </div>
        ))}
      </div>
      {data.length > 1 && (
        <div className="mt-2">
          <EquityChart data={data} height={120} showVolume={false} color="ember" />
        </div>
      )}
    </div>
  );
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
  const t = useT();
  const curve = (l.track.curve ?? []) as number[];
  return (
    <button type="button" onClick={onOpen} className="k-card group flex flex-col p-5 text-start transition hover:border-[var(--k-border-top)]" data-testid={`listing-${l.id}`}>
      <div className="flex items-start gap-3">
        <SymbolAvatar symbol={l.symbol} size={28} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-medium text-fg">{l.title}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-fg-3">
            <span>{t("developer.market.by", { author: l.author })}</span>·<span className="font-mono" dir="ltr">{l.symbol} {l.timeframe}</span>
          </div>
          {l.house && (
            <div className="mt-1.5">
              <HouseChip />
            </div>
          )}
        </div>
        <Chip size="sm" tone={l.priceMonthly > 0 ? "gold" : "up"}>{l.priceMonthly > 0 ? t("developer.market.pricePerMo", { price: l.priceMonthly }) : t("developer.market.free")}</Chip>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <div className={cn("k-num text-[24px] font-semibold", l.track.returnPct >= 0 ? "text-up" : "text-down")}>{fmtPct(l.track.returnPct, 2)}</div>
          <div className="text-[11px] text-fg-3">
            {t("developer.market.verifiedDays", { type: t.dyn(`developer.acctType.${l.track.accountType}`, l.track.accountType), days: l.track.days.toFixed(1) })}
          </div>
        </div>
        {curve.length > 1 && <Sparkline data={curve} width={120} height={36} tone={l.track.returnPct >= 0 ? "gold" : "down"} />}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-[11px]">
        <div className="rounded-[10px] bg-surface-2/60 px-2.5 py-1.5">
          <div className="text-fg-3">{t("developer.dep.winRate")}</div>
          <div className="k-num text-[13px] text-fg">{l.track.winRate.toFixed(1)}%</div>
        </div>
        <div className="rounded-[10px] bg-surface-2/60 px-2.5 py-1.5">
          <div className="text-fg-3">{t("developer.market.maxDd")}</div>
          <div className="k-num text-[13px] text-down">{l.track.maxDrawdownPct.toFixed(1)}%</div>
        </div>
        <div className="rounded-[10px] bg-surface-2/60 px-2.5 py-1.5">
          <div className="text-fg-3">{t("developer.market.trades")}</div>
          <div className="k-num text-[13px] text-fg">{l.track.trades}</div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-[11.5px] text-fg-3">
        <Stars v={l.rating} /> <span>({l.ratings})</span>
        <Users className="ms-2 size-3.5" /> {l.subscribers}
        {subscribed && (
          <Chip size="sm" tone="ember" className="ms-auto">
            {t("developer.market.subscribed")}
          </Chip>
        )}
      </div>
    </button>
  );
}

function ListingDialog({ id, onClose, accounts, onChanged }: { id: number | null; onClose: () => void; accounts: TradingAccount[]; onChanged: () => void }) {
  const t = useT();
  const d = useAlgo<ListingDetail>(id ? `market/listings/${id}` : null);
  const [mode, setMode] = React.useState<"copy" | "clone">("copy");
  const [login, setLogin] = React.useState<number | null>(null);
  const [mult, setMult] = React.useState(1);
  const [busy, setBusy] = React.useState(false);
  const [rating, setRating] = React.useState(5);
  const [comment, setComment] = React.useState("");
  // one request at a time (a double click), and one idempotency key per attempt until its answer is known
  const inFlight = React.useRef(false);
  const attempt = React.useRef<string | null>(null);
  React.useEffect(() => {
    attempt.current = null;
  }, [id]);
  React.useEffect(() => {
    if (login === null && accounts.length) setLogin((accounts.find((a) => a.type === "demo") ?? accounts[0]!).login);
  }, [accounts, login]);
  const l = d.data;
  const subscribe = async () => {
    if (!l || inFlight.current) return;
    inFlight.current = true;
    attempt.current ??= attemptKey();
    setBusy(true);
    try {
      const r = await algoApi<{ deploymentId: number | null; clonedStrategyId: number | null; charged: number }>(`market/listings/${l.id}/subscribe`, {
        body: { mode, login: mode === "copy" ? login : undefined, risk: mult !== 1 ? { lotMultiplier: mult } : undefined, idempotencyKey: attempt.current },
      });
      attempt.current = null;
      toast.success(mode === "copy" ? t("developer.market.copyingToast", { title: l.title, login: login ?? "" }) : t("developer.market.clonedToast", { title: l.title }), { description: r.charged ? t("developer.market.charged", { amount: r.charged }) : t("developer.market.freeSubscription") });
      d.reload();
      onChanged();
    } catch (e) {
      if (attemptOver(e)) attempt.current = null;
      algoError(t("developer.market.subscribeFailed"), e);
      // the listing shows a subscription that went through meanwhile
      d.reload();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const cancel = async () => {
    if (!l?.subscription) return;
    try {
      const r = await algoApi<{ status: string }>(`market/subscriptions/${l.subscription.id}/cancel`, { body: {} });
      toast.success(t("developer.market.subscriptionStatus", { status: t.dyn(`developer.subStatus.${r.status}`, r.status) }));
      d.reload();
      onChanged();
    } catch (e) {
      algoError(t("developer.bt.cancelFailed"), e);
    }
  };
  const review = async () => {
    if (!l) return;
    try {
      await algoApi(`market/listings/${l.id}/reviews`, { body: { rating, comment } });
      toast.success(t("developer.market.reviewSaved"));
      setComment("");
      d.reload();
      onChanged();
    } catch (e) {
      algoError(t("developer.market.reviewFailed"), e);
    }
  };
  const curve = Array.isArray(l?.track.curve) ? (l!.track.curve as { day: string; equity: number }[]).filter((p) => typeof p === "object").map((p) => ({ time: Math.floor(new Date(p.day).getTime() / 1000), value: p.equity })) : [];
  const active = l?.subscription?.status === "active";
  return (
    <Dialog open={id !== null} onOpenChange={(o) => !o && onClose()} title={l?.title ?? t("developer.bt.strategy")} description={l ? `${t("developer.market.by", { author: l.author })} · ${l.symbol} ${l.timeframe}` : undefined} side="right">
      {!l ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="space-y-5 text-[13px]" data-testid="listing-detail">
          <div className="flex flex-wrap items-center gap-2">
            {l.house && <HouseChip />}
            <Chip tone="up">
              <BadgeCheck className="size-3.5" /> {t("developer.market.verifiedTrack", { type: t.dyn(`developer.acctType.${l.track.accountType}`, l.track.accountType) })}
            </Chip>
            <Chip tone={l.priceMonthly > 0 ? "gold" : "up"}>{l.priceMonthly > 0 ? t("developer.market.pricePerMonth", { price: l.priceMonthly }) : t("developer.market.free")}</Chip>
            {l.status !== "approved" && <Chip tone="warn">{t.dyn(`developer.listingStatus.${l.status}`, l.status)}</Chip>}
          </div>
          <p className="whitespace-pre-line text-fg-2">{l.description}</p>
          {l.house && <div className="rounded-[12px] border border-line bg-surface-2/60 px-3 py-2 text-[12px] text-fg-2">{t("developer.market.houseNote")}</div>}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                [t("developer.market.return"), fmtPct(l.track.returnPct, 2), l.track.returnPct >= 0 ? "text-up" : "text-down"],
                [t("developer.dep.winRate"), `${l.track.winRate.toFixed(1)}%`, "text-fg"],
                [t("developer.market.maxDd"), `${l.track.maxDrawdownPct.toFixed(2)}%`, "text-down"],
                [t("developer.market.trades"), String(l.track.trades), "text-fg"],
              ] as const
            ).map(([k, v, tone]) => (
              <div key={k} className="rounded-[12px] bg-surface-2/60 px-3 py-2">
                <div className="text-[11.5px] text-fg-3">{k}</div>
                <div className={cn("k-num text-[16px] font-semibold", tone)}>{v}</div>
              </div>
            ))}
          </div>
          {curve.length > 1 && <EquityChart data={curve} height={150} showVolume={false} color="gold" />}
          <div className="text-[11.5px] text-fg-3">
            {t("developer.market.trackNote", { since: fmtDateTime(l.track.since ?? null).slice(0, 10), days: l.track.days.toFixed(1), net: fmtMoney(l.track.netProfit ?? 0) })}
          </div>
          {l.house && l.backtest && <BacktestBlock b={l.backtest} />}
          {l.risk && (
            <div className="rounded-[12px] border border-line p-3 text-[12.5px] text-fg-2">
              <div className="k-label mb-1.5">{t("developer.market.riskSettings")}</div>
              {t("developer.market.riskLine", {
                size: l.risk.sizing?.mode === "risk" ? t("developer.market.riskPct", { pct: l.risk.sizing.riskPct }) : t("developer.market.lotSize", { lots: l.risk.sizing?.lots }),
                stop: l.risk.sl?.mode === "none" ? t("developer.market.none") : `${l.risk.sl?.value} ${t.dyn(`developer.dist.${l.risk.sl?.mode}`, l.risk.sl?.mode ?? "")}`,
                target: l.risk.tp?.mode === "none" ? t("developer.market.none") : `${l.risk.tp?.value} ${t.dyn(`developer.dist.${l.risk.tp?.mode}`, l.risk.tp?.mode ?? "")}`,
              })}
              {l.summary ? (
                <div className="mt-2 space-y-1 font-mono text-[11.5px]" dir="ltr">
                  {Object.entries(l.summary).map(([k, v]) => (
                    <div key={k}>
                      <span className="text-fg-3">{k} = </span>
                      {v}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-1 text-[11.5px] text-fg-3">{t("developer.market.rulesPrivate")}</div>
              )}
            </div>
          )}
          {!l.isAuthor && (
            <div className="rounded-[14px] border border-ember/30 bg-ember-soft/40 p-4">
              {active ? (
                <div className="space-y-2">
                  <div className="font-medium text-fg">
                    {t("developer.market.subscribed")} · {l.subscription!.mode === "copy" ? t("developer.market.copyingOn", { login: l.subscription!.login ?? "" }) : t("developer.market.clonedToStrategies")}
                  </div>
                  {l.subscription!.periodEnd && <div className="text-[12px] text-fg-3">{l.subscription!.autoRenew ? t("developer.market.renewsOn", { date: fmtDateTime(l.subscription!.periodEnd).slice(0, 10) }) : t("developer.market.endsOn", { date: fmtDateTime(l.subscription!.periodEnd).slice(0, 10) })}</div>}
                  <div className="flex gap-2">
                    {l.subscription!.deploymentId && (
                      <a href={`/developer/deployments?id=${l.subscription!.deploymentId}`}>
                        <Button size="sm" variant="surface">
                          {t("developer.market.openDeployment")}
                        </Button>
                      </a>
                    )}
                    {l.subscription!.clonedStrategyId && (
                      <a href={`/developer/strategies?id=${l.subscription!.clonedStrategyId}`}>
                        <Button size="sm" variant="surface">
                          {t("developer.market.openStrategy")}
                        </Button>
                      </a>
                    )}
                    {l.subscription!.autoRenew && (
                      <Button size="sm" variant="ghost" onClick={cancel}>
                        {t("developer.market.cancelSubscription")}
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <Segmented size="sm" value={mode} onChange={setMode} options={[{ value: "copy", label: t("developer.market.copyToAccount") }, ...(l.allowClone ? [{ value: "clone" as const, label: t("developer.market.cloneRules") }] : [])]} />
                  {mode === "copy" && (
                    <>
                      <div className="flex flex-wrap gap-1.5">
                        {accounts.map((a) => (
                          <button key={a.login} type="button" onClick={() => setLogin(a.login)} className={cn("h-8 rounded-full border px-3 text-[12px]", login === a.login ? "border-ember/40 bg-ember-soft text-ember" : "border-line text-fg-2")}>
                            {a.type === "live" ? t("common.live") : t("common.demo")} #{a.login}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 text-[12px] text-fg-3">
                        {t("developer.dep.lotMultiplier")} <NumInput label={t("developer.dep.lotMultiplier")} value={mult} step={0.1} min={0.01} onChange={setMult} suffix="×" />
                      </div>
                    </>
                  )}
                  <Button variant="ember" className="w-full" disabled={busy || (mode === "copy" && !login)} onClick={subscribe}>
                    {busy ? <Loader2 className="animate-spin" /> : null} {l.priceMonthly > 0 ? t("developer.market.subscribePaid", { price: l.priceMonthly }) : t("developer.market.subscribeFree")}
                  </Button>
                  {l.priceMonthly > 0 && <p className="text-[11px] text-fg-3">{t("developer.market.paidNote")}</p>}
                </div>
              )}
            </div>
          )}
          <div>
            <div className="k-label mb-2">{t("developer.market.reviews", { n: l.ratings })}</div>
            {l.subscription && !l.isAuthor && (
              <div className="mb-3 space-y-2 rounded-[12px] border border-line p-3">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <button key={i} type="button" aria-label={t("developer.market.stars", { count: i })} onClick={() => setRating(i)}>
                      <Star className={cn("size-4", i <= rating ? "fill-gold text-gold" : "text-fg-3")} />
                    </button>
                  ))}
                </div>
                <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder={t("developer.market.reviewPlaceholder")} className="w-full rounded-[10px] border border-line bg-surface-2 px-3 py-2 text-[12.5px] text-fg outline-none" />
                <Button size="xs" variant="surface" onClick={review}>
                  {t("developer.market.postReview")}
                </Button>
              </div>
            )}
            {l.reviews.map((r) => (
              <div key={r.id} className="border-b border-line/60 py-2">
                <div className="flex items-center gap-2">
                  <Stars v={r.rating} /> <span className="text-[12px] text-fg-2">{r.user}</span>
                  <span className="ms-auto text-[11px] text-fg-3">{fmtDateTime(r.createdAt).slice(0, 10)}</span>
                </div>
                {r.comment && <p className="mt-1 text-[12.5px] text-fg-2">{r.comment}</p>}
              </div>
            ))}
            {l.reviews.length === 0 && <p className="text-[12px] text-fg-3">{t("developer.market.noReviews")}</p>}
          </div>
        </div>
      )}
    </Dialog>
  );
}

function PublishDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const t = useT();
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
      toast.success(t("developer.market.submitted"), { description: t("developer.market.submittedText") });
      onOpenChange(false);
      onDone();
    } catch (e) {
      algoError(t("developer.market.publishFailed"), e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("developer.market.publish")}
      description={t("developer.market.publishText")}
      width={600}
      footer={
        <>
          <Button variant="surface" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button variant="ember" disabled={busy || !sid || !dep || desc.trim().length < 20} onClick={publish}>
            {busy ? <Loader2 className="animate-spin" /> : <Upload />} {t("developer.market.submit")}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-[13px]">
        <div>
          <div className="text-fg-3">{t("developer.bt.strategy")}</div>
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
            <div className="text-fg-3">{t("developer.market.trackFrom")}</div>
            {mine.length === 0 ? (
              <p className="mt-1 text-[12px] text-warn">{t("developer.market.deployFirst")}</p>
            ) : (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {mine.map((d) => (
                  <button key={d.id} type="button" onClick={() => setDep(d.id)} className={cn("h-8 rounded-full border px-3 text-[12px]", dep === d.id ? "border-ember/40 bg-ember-soft text-ember" : "border-line text-fg-2")}>
                    #{d.login} · {t.dyn(`developer.acctType.${d.accountType}`, d.accountType)} · {t("developer.market.nTrades", { count: d.stats.trades ?? 0 })}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <label className="block">
          <span className="text-fg-3">{t("developer.market.titleLabel")}</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} className="mt-1 h-10 w-full rounded-[12px] border border-line bg-surface-2 px-3 text-fg outline-none focus:border-ember/50" />
        </label>
        <label className="block">
          <span className="text-fg-3">{t("developer.market.descLabel")}</span>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={4} maxLength={4000} className="mt-1 w-full rounded-[12px] border border-line bg-surface-2 px-3 py-2 text-fg outline-none focus:border-ember/50" />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-fg-3">{t("developer.market.price")}</span>
            <NumInput label={t("developer.market.monthlyPrice")} value={price} min={0} step={5} onChange={setPrice} suffix={t("developer.market.usdtPerMonth")} />
            <span className="text-[11.5px] text-fg-3">{price > 0 ? "" : t("developer.market.freeLower")}</span>
          </div>
          <label className="flex items-center gap-2 text-fg-2">
            {t("developer.market.allowCloning")} <Toggle checked={clone} onChange={setClone} label={t("developer.market.allowCloningAria")} />
          </label>
        </div>
      </div>
    </Dialog>
  );
}

export function LiveMarketplacePage() {
  const t = useT();
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
        title={t("developer.market.title")}
        subtitle={t("developer.market.subtitle")}
        actions={
          <Button variant="ember" onClick={() => setPublishing(true)}>
            <Upload /> {t("developer.market.publish")}
          </Button>
        }
      />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: "browse", label: t("developer.market.browse"), count: items.length }, { value: "subs", label: t("developer.market.mySubs") }, { value: "mine", label: t("developer.market.myListings") }]} className="mb-5" />
      {tab === "browse" && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="flex h-10 min-w-[240px] flex-1 items-center gap-2 rounded-full border border-line bg-surface-2 px-4">
              <Search className="size-4 text-fg-3" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("developer.market.searchPlaceholder")} aria-label={t("common.search")} className="w-full bg-transparent text-[13.5px] text-fg outline-none placeholder:text-fg-3" />
            </div>
            <Segmented size="sm" value={price || "all"} onChange={(v) => setPrice(v === "all" ? "" : (v as "free" | "paid"))} options={[{ value: "all", label: t("common.all") }, { value: "free", label: t("developer.market.free") }, { value: "paid", label: t("developer.market.paid") }]} />
            <Segmented size="sm" value={sort} onChange={setSort} options={[{ value: "updated", label: t("developer.market.newest") }, { value: "rating", label: t("developer.market.topRated") }, { value: "subscribers", label: t("developer.market.popular") }]} />
          </div>
          {browse.loading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-64" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <Card className="grid min-h-[300px] place-items-center">
              <EmptyState title={t("developer.market.emptyTitle")} text={t("developer.market.emptyText")} />
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((l) => (
                <ListingCard key={l.id} l={l} subscribed={browse.data!.subscribed.includes(l.id)} onOpen={() => setOpen(l.id)} />
              ))}
            </div>
          )}
          <p className="mt-4 text-[11.5px] text-fg-3">{t("developer.market.disclaimer", { pct: browse.data?.platformCutPct ?? 20 })}</p>
        </>
      )}
      {tab === "subs" && (
        <Card>
          <CardHeader icon={<Store />} title={t("developer.market.mySubs")} />
          <div className="overflow-x-auto px-6 pb-6 pt-4">
            <table className="w-full min-w-[640px] text-[13px]">
              <thead className="text-fg-3">
                <tr>
                  <th className="py-1.5 text-start font-medium">{t("developer.bt.strategy")}</th>
                  <th className="py-1.5 text-start font-medium">{t("developer.market.mode")}</th>
                  <th className="py-1.5 text-start font-medium">{t("common.status")}</th>
                  <th className="py-1.5 text-end font-medium">{t("developer.market.price")}</th>
                  <th className="py-1.5 text-end font-medium">{t("developer.market.renews")}</th>
                </tr>
              </thead>
              <tbody>
                {(subs.data?.items ?? []).map((s) => (
                  <tr key={s.id} className="cursor-pointer border-t border-line/60 hover:bg-surface-2/50" onClick={() => setOpen(s.listingId)}>
                    <td className="py-2">
                      <div className="text-fg">{s.title}</div>
                      <div className="font-mono text-[11px] text-fg-3">
                        {s.symbol} {s.timeframe} · {t("developer.market.by", { author: s.author })}
                      </div>
                    </td>
                    <td className="text-fg-2">{s.mode === "copy" ? t("developer.market.copyOn", { login: s.login ?? "" }) : t("developer.market.clone")}</td>
                    <td>
                      <Chip size="sm" tone={s.status === "active" ? "up" : "neutral"}>
                        {t.dyn(`developer.subStatus.${s.status}`, s.status)}
                      </Chip>
                      {s.deploymentStatus && <span className="ms-2 text-[11px] text-fg-3">{t.dyn(`developer.depStatus.${s.deploymentStatus}`, s.deploymentStatus)}</span>}
                    </td>
                    <td className="k-num text-end tabular-nums">{s.price > 0 ? `${s.price} USDT` : t("developer.market.free")}</td>
                    <td className="text-end text-[12px] text-fg-3">{s.periodEnd ? (s.autoRenew ? fmtDateTime(s.periodEnd).slice(0, 10) : t("developer.market.endsLower", { date: fmtDateTime(s.periodEnd).slice(0, 10) })) : "–"}</td>
                  </tr>
                ))}
                {subs.data && subs.data.items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-fg-3">
                      {t("developer.market.noSubs")}
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
                [t("developer.market.earned"), `${(mine.data?.earned ?? 0).toFixed(2)} USDT`],
                [t("developer.market.platformFees"), `${(mine.data?.platformFees ?? 0).toFixed(2)} USDT`],
                [t("developer.market.payments"), String(mine.data?.payments ?? 0)],
              ] as const
            ).map(([k, v]) => (
              <Card key={k} className="px-5 py-4">
                <div className="k-label">{k}</div>
                <div className="k-num mt-1 text-[22px] font-semibold text-fg">{v}</div>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader title={t("developer.market.myListings")} action={<Button size="sm" variant="surface" onClick={() => setPublishing(true)}><Plus /> {t("developer.market.publishShort")}</Button>} />
            <div className="space-y-2 px-6 pb-6 pt-4">
              {(mine.data?.items ?? []).map((l) => (
                <button key={l.id} type="button" onClick={() => setOpen(l.id)} className="flex w-full items-center gap-3 rounded-[12px] border border-line px-4 py-3 text-start hover:bg-surface-2/50">
                  <SymbolAvatar symbol={l.symbol} size={20} />
                  <div className="min-w-0">
                    <div className="truncate text-fg">{l.title}</div>
                    <div className="text-[11.5px] text-fg-3">
                      {t("developer.market.subscribers", { count: l.subscribers })} · {l.priceMonthly > 0 ? t("developer.market.pricePerMonth", { price: l.priceMonthly }) : t("developer.market.freeLower")}
                      {l.moderationNote ? ` · ${t("developer.market.moderator", { note: l.moderationNote })}` : ""}
                    </div>
                  </div>
                  <Chip size="sm" tone={l.status === "approved" ? "up" : l.status === "pending" ? "warn" : "down"} className="ms-auto">
                    {t.dyn(`developer.listingStatus.${l.status}`, l.status)}
                  </Chip>
                </button>
              ))}
              {mine.data && mine.data.items.length === 0 && <p className="text-[12.5px] text-fg-3">{t("developer.market.noListings")}</p>}
            </div>
          </Card>
        </div>
      )}
      <ListingDialog id={open} onClose={() => setOpen(null)} accounts={(accounts.data?.items ?? []).filter((a) => a.status === "active")} onChanged={() => (browse.reload(), subs.reload(), mine.reload())} />
      <PublishDialog open={publishing} onOpenChange={setPublishing} onDone={() => (setTab("mine"), mine.reload())} />
    </>
  );
}
