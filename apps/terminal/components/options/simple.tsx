"use client";

// Quick trade: the guided way to an option for traders who know CFDs but not options (plan O32, O50).
//   1. the market (underlying)          4. how far it will go (the strike: close to today's price, or further
//   2. Up or Down? (a call or a put)        away = cheaper and less likely), with its price and chance of profit
//   3. by when (the expiry)              5. how many contracts, with the total
// then "What happens" in plain words (what you pay, where you make money and when, the most you can lose) and one
// confirm button. Only buying (risk limited to the price paid); selling and strategies are in the full order ticket
// and the strategy builder. While the order book is live the confirm hands the option over to the order ticket,
// which trades it on the book. "Explain it to me" asks Claude for a short explanation in the reader's language.
import * as React from "react";
import { ArrowRight, CheckCircle2, ChevronDown, Loader2, MessageSquareText, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@ezymex/ui";
import { useLocale, useT } from "@ezymex/i18n/react";
import { toast } from "@/lib/notify";
import { useTerminal } from "@/lib/store";
import { useModule } from "@/lib/features";
import { GuestActions } from "@/components/shell/guest";
import { aiDeniedText, aiHeaders } from "@/lib/ai-client";
import { LOGIN_URL } from "@/lib/guest";
import { DropMenu } from "@/components/ui/menu";
import { Stepper } from "@/components/ui/primitives";
import { optionsApi } from "@/lib/options/api";
import { errText, needsOnboarding } from "@/lib/options/errors";
import { atmIndex, fillOf, probProfit, usdPerUnitOf, type PayLeg } from "@/lib/options/math";
import { expiryOpen, opt, underlyingOf, useBookLive, useOpt } from "@/lib/options-store";
import type { OptionChain, OptionChainRow, OptionExpiry, OptionRight } from "@/lib/options/types";
import { ErrorNote, OptAvatar, useNow } from "./bits";
import { Explain, IntroCard, useIntroHidden } from "./explain";
import { countdown, expiryLabel, iso, money, pct, px, usd } from "./format";
import { FeedChange, SpotPrice } from "./header";
import { commissionOf, OutcomeCard, OutcomeSkeleton } from "./outcome";
import { PreviewSummary, usePreview } from "./preview";

type View = "up" | "down";

/** Strikes offered for "How far": the at-the-money strike, then one and two steps further in the chosen direction. */
const REACH = [0, 1, 2] as const;

interface Target {
  i: number;
  row: OptionChainRow;
  right: OptionRight;
  priceUsd: number;
  premium: number;
  pop: number;
}

function targetsOf(chain: OptionChain, view: View): Target[] {
  const rows = chain.rows;
  if (!rows.length) return [];
  const i0 = atmIndex(chain);
  const right: OptionRight = view === "up" ? "call" : "put";
  const dir = view === "up" ? 1 : -1;
  const usdU = usdPerUnitOf(chain);
  const years = Math.max(1 / 8760, (Date.parse(chain.cutAt) - Date.now()) / (365 * 86_400_000));
  const fwd = chain.atmStrike ?? chain.spot?.mid ?? rows[i0]!.strike;
  const out: Target[] = [];
  for (const k of REACH) {
    const i = i0 + dir * k;
    const row = rows[i];
    const q = row ? (right === "call" ? row.call : row.put) : null;
    if (!row || !q || out.some((x) => x.i === i)) continue;
    const premium = fillOf(q, "buy");
    const leg: PayLeg = { right, strike: row.strike, side: "buy", contracts: 1, premium, iv: q.iv };
    out.push({ i, row, right, priceUsd: q.askUsd || premium * usdU, premium, pop: probProfit([leg], usdU, fwd, q.iv || 0.1, years) });
  }
  return out;
}

function Step({ n, title, help, children, done, className }: { n: number; title: React.ReactNode; help?: React.ReactNode; children: React.ReactNode; done?: boolean; className?: string }) {
  return (
    <section className={cn("relative ps-8", className)}>
      <span className={cn("absolute start-0 top-0 grid size-[22px] place-items-center rounded-full font-mono text-[11px] font-semibold", done ? "bg-ember text-white" : "border border-line bg-surface-2 text-fg-2")}>{n}</span>
      <div className="mb-2 flex min-h-[22px] items-center gap-1 text-[13px] font-semibold text-fg">
        {title}
        {help}
      </div>
      {children}
    </section>
  );
}

function MarketPicker() {
  const t = useT();
  const u = useOpt((s) => s.u);
  const list = useOpt((s) => s.underlyings);
  const chainSpot = useOpt((s) => (s.chain?.underlying === s.u ? s.chain.spot?.mid : undefined));
  const name = useOpt((s) => underlyingOf(s)?.name);
  return (
    <DropMenu
      width={300}
      trigger={({ toggle, open }) => (
        <button onClick={toggle} aria-expanded={open} aria-label={t("trader.opt.pickUnderlying")} className={cn("flex h-10 w-full items-center gap-2.5 rounded-[10px] border border-line bg-surface-2 px-3 text-start transition-colors hover:border-fg-3/40", open && "border-ember/50")}>
          <OptAvatar symbol={u} size={22} />
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block text-[14px] font-semibold text-fg">{u}</span>
            <span className="block truncate text-[11px] text-fg-3">{name}</span>
          </span>
          <span className="flex flex-col items-end leading-tight">
            <SpotPrice symbol={u} className="text-[13px]" fallback={chainSpot} />
            <FeedChange symbol={u} />
          </span>
          <ChevronDown className="size-4 shrink-0 text-fg-3" />
        </button>
      )}
    >
      {(close) => (
        <div className="t-scroll max-h-[min(420px,70dvh)] overflow-y-auto p-1.5">
          {list.map((x) => (
            <button
              key={x.symbol}
              onClick={() => (opt.selectUnderlying(x.symbol), close())}
              aria-pressed={x.symbol === u}
              className={cn("flex h-11 w-full items-center gap-2.5 rounded-[8px] px-2 text-start transition-colors", x.symbol === u ? "bg-ember-soft" : "hover:bg-surface-3")}
            >
              <OptAvatar symbol={x.symbol} size={18} />
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block text-[12.5px] font-semibold text-fg">{x.symbol}</span>
                <span className="block truncate text-[10.5px] text-fg-3">{x.name}</span>
              </span>
              <SpotPrice symbol={x.symbol} className="text-[12px]" />
            </button>
          ))}
        </div>
      )}
    </DropMenu>
  );
}

/** "Today 14:00", "Tomorrow", "Fri, Oct 9": a short date for the expiry chips. */
export function useDayLabel() {
  const t = useT();
  const { locale } = useLocale();
  return React.useCallback(
    (e: Pick<OptionExpiry, "date" | "cutAt">, now: number) => {
      const today = new Date(now).toISOString().slice(0, 10);
      const tomorrow = new Date(now + 86_400_000).toISOString().slice(0, 10);
      if (e.date === today) return t("trader.opt.guide.today");
      if (e.date === tomorrow) return t("trader.opt.guide.tomorrow");
      return expiryLabel(e.date, locale);
    },
    [t, locale],
  );
}

function WhenPicker() {
  const t = useT();
  const { locale } = useLocale();
  const list = useOpt((s) => s.expiries);
  const expiry = useOpt((s) => s.expiry);
  const now = useNow();
  const day = useDayLabel();
  const open = list.filter((e) => expiryOpen(e, now)).sort((a, b) => Date.parse(a.cutAt) - Date.parse(b.cutAt));
  const first = open.slice(0, 4);
  const rest = open.slice(4);
  const picked = rest.find((e) => e.date === expiry);
  const chip = (e: OptionExpiry) => {
    const on = e.date === expiry;
    return (
      <button key={e.date} onClick={() => opt.selectExpiry(e.date)} aria-pressed={on} className={cn("flex min-w-0 flex-col items-start rounded-[10px] border px-2.5 py-1.5 text-start transition-colors", on ? "border-ember bg-ember-soft text-fg shadow-[inset_0_0_0_1px_var(--k-ember)]" : "border-line bg-surface-2 text-fg-2 hover:border-fg-3/40 hover:text-fg")}>
        <span className="w-full truncate text-[12px] font-semibold">{day(e, now)}</span>
        <span className={cn("k-num w-full truncate text-[10.5px]", on ? "text-ember" : "text-fg-3")}>{t("trader.opt.plain.in", iso({ left: countdown(Date.parse(e.cutAt), now) }))}</span>
      </button>
    );
  };
  if (!open.length) return <div className="h-12 animate-pulse rounded-[10px] bg-surface-2" />;
  return (
    <div className="@container">
    <div className="grid grid-cols-2 gap-1.5 @[330px]:grid-cols-3">
      {first.map(chip)}
      {rest.length > 0 && (
        <DropMenu
          width={260}
          trigger={({ toggle, open: on }) => (
            <button onClick={toggle} aria-expanded={on} className={cn("flex min-w-0 flex-col items-start rounded-[10px] border px-2.5 py-1.5 text-start transition-colors", picked ? "border-ember bg-ember-soft text-fg" : "border-dashed border-line text-fg-2 hover:border-fg-3/40 hover:text-fg")}>
              <span className="flex w-full items-center gap-1 truncate text-[12px] font-semibold">
                {picked ? expiryLabel(picked.date, locale) : t("trader.opt.guide.later")} <ChevronDown className="size-3 shrink-0" />
              </span>
              <span className={cn("k-num w-full truncate text-[10.5px]", picked ? "text-ember" : "text-fg-3")}>{picked ? t("trader.opt.plain.in", iso({ left: countdown(Date.parse(picked.cutAt), now) })) : t("trader.opt.guide.moreDates", { count: rest.length })}</span>
            </button>
          )}
        >
          {(close) => (
            <div className="t-scroll grid max-h-[min(360px,60dvh)] grid-cols-2 gap-1 overflow-y-auto p-2">
              {rest.map((e) => (
                <button key={e.date} onClick={() => (opt.selectExpiry(e.date), close())} aria-pressed={e.date === expiry} className={cn("rounded-[8px] border px-2 py-1.5 text-start", e.date === expiry ? "border-ember/50 bg-ember-soft" : "border-line hover:bg-surface-3")}>
                  <div className="truncate text-[11.5px] font-medium text-fg">{expiryLabel(e.date, locale)}</div>
                  <div className="font-mono text-[10px] text-fg-3">{countdown(Date.parse(e.cutAt), now)}</div>
                </button>
              ))}
            </div>
          )}
        </DropMenu>
      )}
    </div>
    </div>
  );
}

export function SimpleMode({ className, onDone }: { className?: string; onDone?: () => void }) {
  const T = useTerminal();
  const t = useT();
  const { locale } = useLocale();
  const chain = useOpt((s) => (s.chain && s.chain.underlying === s.u && s.chain.expiry === s.expiry ? s.chain : null));
  const u = useOpt((s) => s.u);
  const cur = useOpt((s) => underlyingOf(s));
  const publicView = useOpt((s) => s.publicView);
  const tradingSoon = useOpt((s) => s.tradingSoon);
  const bookLive = useBookLive();
  const [hidden, setHidden] = useIntroHidden();
  const [view, setView] = React.useState<View | null>(null);
  const [reach, setReach] = React.useState(1);
  const [contracts, setContracts] = React.useState(1);
  const [busy, setBusy] = React.useState(false);
  const [lastErr, setLastErr] = React.useState<{ code: string; message: string } | null>(null);
  const [done, setDone] = React.useState<string | null>(null);
  // targets follow the chain at most once a second (prices tick 4×/s)
  const [targets, setTargets] = React.useState<Target[]>([]);
  const last = React.useRef(0);
  const key = chain ? `${chain.underlying}|${chain.expiry}|${view}` : "";
  const lastKey = React.useRef("");
  React.useEffect(() => {
    if (!chain || !view) return setTargets([]);
    const now = Date.now();
    if (now - last.current < 1000 && lastKey.current === key && targets.length) return;
    last.current = now;
    lastKey.current = key;
    setTargets(targetsOf(chain, view));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chain, view, key]);
  React.useEffect(() => {
    setLastErr(null);
    setDone(null);
  }, [u, view, reach, contracts, chain?.expiry]);

  const target = targets[Math.min(reach, targets.length - 1)] ?? null;
  const q = target ? (target.right === "call" ? target.row.call : target.row.put) : null;
  const usdU = chain ? usdPerUnitOf(chain) : 0;
  const legSpec = target && q && chain ? [{ series: q.code, u, right: target.right, strike: target.row.strike, side: "buy" as const, contracts }] : [];
  const preview = usePreview(legSpec, "market", undefined, legSpec.length > 0 && !bookLive);
  const minC = cur?.minContracts ?? 1;
  const maxC = cur?.maxContracts ?? 100;
  const stepC = cur?.contractStep ?? 1;
  const premium = preview.preview?.legs[0]?.price ?? (q ? fillOf(q, "buy") : 0);
  const pay: PayLeg[] = target && q ? [{ right: target.right, strike: target.row.strike, side: "buy", contracts, premium, iv: q.iv }] : [];
  const commission = commissionOf(chain, pay, usdU, bookLive);
  const total = preview.preview ? Math.abs(preview.preview.netPremium) + preview.preview.commission : premium * usdU * contracts + commission;
  const guest = T.guest || publicView;
  const blocked = !target || !q || busy || T.readOnly || guest || q.state !== "open" || (!bookLive && (!preview.preview || !preview.preview.ok || (preview.preview.estimate && T.live)));
  const rightWord = target?.right === "call" ? t("trader.opt.call") : t("trader.opt.put");

  const confirm = async () => {
    if (blocked || !target || !q || !chain) return;
    const leg = { series: q.code, u, expiry: chain.expiry, right: target.right, strike: target.row.strike, strikeLabel: target.row.strikeLabel, side: "buy" as const, contracts };
    // the order book: the order ticket trades it (book orders)
    if (bookLive) {
      opt.setLegs([leg]);
      opt.setTicket({ bookType: "market" });
      opt.setPrefs({ panel: "ticket" });
      return;
    }
    setBusy(true);
    setLastErr(null);
    const r = await optionsApi.order(T.account.login, { legs: [{ series: q.code, side: "buy", contracts }], type: "market", clientOrderId: `opq${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}` });
    setBusy(false);
    const what = t("trader.opt.ticket.what", { side: t("common.buy"), n: contracts, series: `${u} ${target.row.strikeLabel} ${rightWord}`, date: expiryLabel(chain.expiry, locale, false) });
    if (!r.ok) {
      setLastErr({ code: r.err.code, message: r.err.message });
      T.log("Trade", `'${T.account.login}': quick option order buy ${contracts} ${q.code} failed [${r.err.code}]`, "error");
      if (!needsOnboarding(r.err.code)) toast.error(t("trader.opt.toast.rejected"), { description: `${what} · ${errText(r.err)}` });
      return;
    }
    T.log("Trade", `'${T.account.login}': quick option order buy ${contracts} ${q.code} ${r.data.status === "placed" ? "placed" : "filled"}`);
    toast.success(t("trader.opt.toast.filled"), { description: what });
    setDone(what);
  };

  const step2Done = !!view;
  return (
    <div className={cn("space-y-5 p-3", className)}>
      {!hidden && <IntroCard onHide={() => setHidden(true)} />}

      <Step n={1} title={t("trader.opt.guide.s1")} done>
        <MarketPicker />
      </Step>

      <Step n={2} title={t("trader.opt.guide.s2", iso({ u }))} done={step2Done}>
        <div role="radiogroup" className="grid grid-cols-2 gap-1 rounded-[11px] border border-line bg-panel-2 p-1">
          {(["up", "down"] as const).map((v) => {
            const on = view === v;
            const up = v === "up";
            return (
              <button
                key={v}
                role="radio"
                onClick={() => setView(v)}
                aria-checked={on}
                className={cn(
                  "flex h-11 min-w-0 flex-col justify-center rounded-[8px] border px-2.5 text-start transition-[background-color,border-color] duration-150",
                  on ? (up ? "border-up/45 bg-up-soft" : "border-down/45 bg-down-soft") : "border-transparent hover:bg-surface-3/70",
                )}
              >
                <span className={cn("flex items-center gap-1.5 text-[13px] font-semibold", up ? "text-up" : "text-down")}>
                  {up ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                  {up ? t("trader.opt.simple.up") : t("trader.opt.simple.down")}
                </span>
                <span className="truncate text-[11.5px] leading-[15px] text-fg-3">{up ? t("trader.opt.guide.upSub") : t("trader.opt.guide.downSub")}</span>
              </button>
            );
          })}
        </div>
      </Step>

      <Step n={3} title={t("trader.opt.guide.s3")} help={<Explain topic="expiry" size={12} />} done={step2Done}>
        <WhenPicker />
      </Step>

      {view && (
        <Step n={4} title={view === "up" ? t("trader.opt.guide.s4up", iso({ u })) : t("trader.opt.guide.s4down", iso({ u }))} help={<Explain topic="strike" size={12} />} done={!!target}>
          {!chain || !targets.length ? (
            <div className="grid gap-1.5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-[52px] animate-pulse rounded-[10px] bg-surface-2" />
              ))}
            </div>
          ) : (
            <div className="grid gap-1.5" role="radiogroup">
              {targets.map((x, i) => {
                const on = i === Math.min(reach, targets.length - 1);
                return (
                  <button key={x.i} role="radio" aria-checked={on} onClick={() => setReach(i)} className={cn("flex items-start gap-2.5 rounded-[10px] border px-3 py-2 text-start transition-colors", on ? "border-ember bg-ember-soft shadow-[inset_0_0_0_1px_var(--k-ember)]" : "border-line bg-surface-2 hover:border-fg-3/40")}>
                    <span className={cn("mt-[2px] grid size-4 shrink-0 place-items-center rounded-full border", on ? "border-ember" : "border-fg-3/60")}>{on && <span className="size-2 rounded-full bg-ember" />}</span>
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="min-w-0 truncate text-[12.5px] font-semibold text-fg">{view === "up" ? t("trader.opt.guide.above", iso({ price: x.row.strikeLabel })) : t("trader.opt.guide.below", iso({ price: x.row.strikeLabel }))}</span>
                        <span className="k-num shrink-0 font-mono text-[13px] font-semibold text-fg">{money(x.priceUsd)}</span>
                      </span>
                      <span className="mt-1 flex items-center gap-1.5 text-[10.5px] text-fg-2">
                        <span className="h-1 w-10 shrink-0 overflow-hidden rounded-full bg-surface-3">
                          <span className="block h-full rounded-full bg-up" style={{ width: `${Math.round(Math.min(1, x.pop) * 100)}%` }} />
                        </span>
                        <span className="truncate">{t("trader.opt.guide.chance", iso({ pct: pct(x.pop, 0) }))}</span>
                      </span>
                      <span className="mt-1 line-clamp-2 block text-[10.5px] leading-snug text-fg-3">{t(i === 0 ? "trader.opt.guide.reach0" : i === 1 ? "trader.opt.guide.reach1" : "trader.opt.guide.reach2")}</span>
                    </span>
                  </button>
                );
              })}
              <div className="flex items-center gap-1 px-1 text-[10.5px] text-fg-3">
                {t("trader.opt.guide.perContract")} <Explain topic="chance" size={11} />
              </div>
            </div>
          )}
        </Step>
      )}

      {view && target && (
        <Step n={5} title={t("trader.opt.guide.s5")} help={<Explain topic="contracts" size={12} />} done>
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-[132px] shrink-0">
              <Stepper ariaLabel={t("trader.opt.ticket.contracts")} value={String(contracts)} onChange={(v) => setContracts(Math.min(maxC, Math.max(minC, Math.round((parseFloat(v) || minC) / stepC) * stepC)))} step={stepC} min={minC} decimals={0} size="lg" />
            </div>
            <div className="flex gap-1">
              {[1, 2, 5, 10].map((v) => (
                <button key={v} onClick={() => setContracts(Math.min(maxC, v))} aria-pressed={contracts === v} className={cn("h-7 min-w-8 rounded-[7px] border px-2 font-mono text-[12.5px] transition-colors", contracts === v ? "border-ember/50 bg-ember-soft font-semibold text-accent-text" : "border-line bg-panel-2 text-fg-2 hover:bg-surface-3 hover:text-fg")}>
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-1.5 text-[11px] text-fg-3">{t("trader.opt.ticket.notional", { n: ((cur?.contractSize ?? chain?.contractSize ?? 0) * contracts).toLocaleString("en-US"), unit: cur?.contractUnit ?? chain?.contractUnit ?? "" })}</div>
        </Step>
      )}

      {view && target && chain && (
        <section className="space-y-2.5">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-fg">
            <CheckCircle2 className="size-4 text-ember" /> {t("trader.opt.guide.what")}
          </div>
          {pay.length && premium > 0 ? <OutcomeCard u={u} legs={pay} usdPerUnit={usdU} digits={chain.digits} cutAt={chain.cutAt} spot={chain.spot?.mid} preview={bookLive ? null : preview.preview} commission={commission} loading={preview.loading} /> : <OutcomeSkeleton />}
          {!bookLive && preview.preview && <PreviewSummary state={preview} digits={chain.digits} collapsible showGreeks={false} />}
          {lastErr && <ErrorNote code={lastErr.code} message={lastErr.message} />}
          {done ? (
            <div role="status" className="rounded-[12px] border border-up/35 bg-up-soft px-3 py-3">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-fg">
                <CheckCircle2 className="size-4 text-up" /> {t("trader.opt.guide.doneTitle")}
              </div>
              <p className="mt-1 text-[12px] text-fg-2">{done}</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <button onClick={() => (onDone ? onDone() : T.setWs({ toolboxTab: "options" }))} className="inline-flex h-8 items-center gap-1.5 rounded-[8px] bg-ember px-3 text-[12px] font-semibold text-white hover:brightness-110">
                  {t("trader.opt.guide.seePositions")} <ArrowRight className="size-3.5 rtl:-scale-x-100" />
                </button>
                <button onClick={() => setDone(null)} className="inline-flex h-8 items-center rounded-[8px] border border-line px-3 text-[12px] font-medium text-fg-2 hover:text-fg">
                  {t("trader.opt.guide.again")}
                </button>
              </div>
            </div>
          ) : guest ? (
            <div className="rounded-[12px] border border-ember/25 bg-ember-soft/40 px-3 py-3 text-center">
              <div className="text-[12.5px] font-semibold text-fg">{t("trader.opt.guest.title")}</div>
              <p className="mt-1 text-[11.5px] leading-relaxed text-fg-3">{t("trader.opt.guest.text")}</p>
              <GuestActions className="mt-2.5" />
            </div>
          ) : T.readOnly ? (
            <div className="rounded-[10px] border border-warn/30 bg-warn-soft px-3 py-2 text-[11.5px] text-warn">{t("trader.opt.ticket.readOnly")}</div>
          ) : (
            <button
              onClick={() => void confirm()}
              disabled={!!blocked}
              className={cn(
                "flex h-10 w-full items-center justify-between gap-2 rounded-[10px] bg-accent-strong px-4 text-[13.5px] font-semibold text-white transition hover:brightness-110 active:brightness-95 disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-fg-3",
              )}
            >
              <span className="truncate">{busy ? t("trader.opt.ticket.sending") : tradingSoon && T.live ? t("trader.opt.ticket.soon") : bookLive ? t("trader.opt.guide.continue") : t("trader.opt.guide.confirm", iso({ n: contracts, u, right: rightWord, strike: target.row.strikeLabel }))}</span>
              {!bookLive && total > 0 && <span className="k-num shrink-0 rounded-[7px] bg-black/15 px-2 py-0.5 text-[12px]">{t("trader.opt.ticket.payAmount", iso({ amount: money(total) }))}</span>}
              {bookLive && <ArrowRight className="size-4 shrink-0 rtl:-scale-x-100" />}
            </button>
          )}
          <ExplainIdea chain={chain} target={target} contracts={contracts} view={view} total={total} premium={premium} usdU={usdU} />
        </section>
      )}

      <div className="space-y-1.5 border-t border-line pt-3 text-[11px] leading-relaxed text-fg-3">
        <p>{t("trader.opt.simple.disclaimer")}</p>
        <button onClick={() => opt.setPrefs({ panel: "ticket" })} className="text-fg-2 underline-offset-2 hover:text-fg hover:underline">
          {t("trader.opt.guide.fullTicket")}
        </button>
      </div>
    </div>
  );
}

/** "Explain it to me": Claude explains the idea in the reader's language (a built-in explanation without it, and while
 *  the broker has the AI assistant switched off: then nothing is sent, and guests needn't sign in for it). */
function ExplainIdea({ chain, target, contracts, view, total, premium, usdU }: { chain: OptionChain; target: Target; contracts: number; view: View; total: number; premium: number; usdU: number }) {
  const t = useT();
  const T = useTerminal();
  const { locale } = useLocale();
  const aiOn = useModule("ai_assistant");
  const [explain, setExplain] = React.useState<{ busy: boolean; text?: string; ai?: boolean; error?: string } | null>(null);
  React.useEffect(() => {
    setExplain(null);
  }, [target.row.strike, view, chain.expiry, chain.underlying]);
  const q = (target.right === "call" ? target.row.call : target.row.put)!;
  const be = target.right === "call" ? target.row.strike + premium : target.row.strike - premium;
  const u = chain.underlying;
  const plain = t(view === "up" ? "trader.opt.simple.plainCall" : "trader.opt.simple.plainPut", { cost: usd(total), u, be: px(be, chain.digits), date: expiryLabel(chain.expiry, locale), time: chain.cut.time });
  const ask = async () => {
    if (!aiOn) return setExplain({ busy: false, text: `${plain} ${t("trader.opt.simple.basicMore")}`, ai: false });
    setExplain({ busy: true });
    const body = {
      locale,
      strategy: {
        name: target.right === "call" ? t("trader.opt.simple.buyCall") : t("trader.opt.simple.buyPut"),
        view,
        underlying: u,
        expiry: chain.expiry,
        cut: `${chain.cut.time} ${chain.cut.zone}`,
        spot: chain.spot?.mid ?? null,
        contractSize: chain.contractSize,
        contractUnit: chain.contractUnit,
        legs: [{ side: "buy", right: target.right, strike: target.row.strike, contracts, premiumUsd: q.askUsd || premium * usdU, iv: q.iv, delta: q.delta }],
        netPremium: +total.toFixed(2),
        maxProfit: target.right === "call" ? null : +Math.max(0, (target.row.strike - premium) * usdU * contracts).toFixed(2),
        maxLoss: +total.toFixed(2),
        breakevens: [be],
        probProfit: +target.pop.toFixed(3),
      },
    };
    try {
      const res = await fetch("/api/options/explain", { method: "POST", headers: aiHeaders(T.account?.login), body: JSON.stringify(body) });
      const data = (await res.json().catch(() => ({}))) as { configured?: boolean; text?: string; error?: string; code?: string };
      if (data.text) return setExplain({ busy: false, text: data.text, ai: true });
      if (data.configured === false) return setExplain({ busy: false, text: `${plain} ${t("trader.opt.simple.basicMore")}`, ai: false });
      const denied = aiDeniedText(t, data.code);
      if (denied) return setExplain({ busy: false, error: denied });
      setExplain({ busy: false, error: data.error ?? t("trader.opt.simple.explainFailed") });
    } catch {
      setExplain({ busy: false, error: t("trader.opt.simple.explainFailed") });
    }
  };
  return (
    <div>
      {!explain && T.guest && aiOn && (
        // AI explanations need a signed-in session (lib/ai-guard.ts)
        <a href={LOGIN_URL} className="flex h-8 w-full items-center justify-center gap-1.5 rounded-[8px] border border-line text-[12.5px] font-medium text-fg-2 transition-colors hover:border-ember/40 hover:text-fg">
          <Sparkles className="size-3.5 text-ember" /> {t("desk.ai.signin")}
        </a>
      )}
      {!explain && (!T.guest || !aiOn) && (
        <button onClick={() => void ask()} className="flex h-8 w-full items-center justify-center gap-1.5 rounded-[8px] border border-line text-[12.5px] font-medium text-fg-2 transition-colors hover:border-ember/40 hover:text-fg">
          {aiOn ? <Sparkles className="size-3.5 text-ember" /> : <MessageSquareText className="size-3.5 text-fg-3" />} {t("trader.opt.guide.explain")}
        </button>
      )}
      {explain && (
        <div className="rounded-[10px] border border-line bg-surface-2/50 px-3 py-2.5 text-[12px] leading-relaxed text-fg-2" dir="auto">
          {explain.busy ? (
            <span className="flex items-center gap-1.5 text-fg-3">
              <Loader2 className="size-3.5 animate-spin" /> {t("trader.opt.simple.explaining")}
            </span>
          ) : explain.error ? (
            <span className="text-down">{explain.error}</span>
          ) : (
            <>
              <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-fg-3">
                {explain.ai ? <Sparkles className="size-3 text-ember" /> : <MessageSquareText className="size-3" />}
                {explain.ai ? t("trader.opt.simple.byClaude") : t("trader.opt.simple.basic")}
              </div>
              <div className="whitespace-pre-line">{explain.text}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
