"use client";

// Simple mode (plan O32): "I think <underlying> goes UP / DOWN by <expiry>" → a suggested call or put and a cheaper
// debit spread, with cost, max loss and breakeven in plain words, the probability of profit, "Use this" (fills the
// ticket) and "Explain" (Claude explains the idea in the reader's language; a built-in explanation without it).
import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Lightbulb, Loader2, MessageSquareText, Sparkles } from "lucide-react";
import { cn } from "@kalks/ui";
import { useLocale, useT } from "@kalks/i18n/react";
import { Stepper, TSelect } from "@/components/ui/primitives";
import { atmIndex, fillOf, payoffStats, probProfit, usdPerUnitOf, type PayLeg } from "@/lib/options/math";
import { opt, useOpt } from "@/lib/options-store";
import type { OptionChain, OptionChainRow, OptionRight, Side } from "@/lib/options/types";
import { OptAvatar, RightTag } from "./bits";
import { expiryLabel, pct, px, usd } from "./format";

type View = "up" | "down";

interface Idea {
  id: "single" | "spread";
  legs: { row: OptionChainRow; right: OptionRight; side: Side; contracts: number }[];
  cost: number;
  maxLoss: number | null;
  maxProfit: number | null;
  breakeven: number | null;
  pop: number;
  /** spread: the price where the profit is capped */
  cap?: number;
}

function buildIdeas(chain: OptionChain, view: View, contracts: number): Idea[] {
  const rows = chain.rows;
  if (!rows.length) return [];
  const i0 = atmIndex(chain);
  const right: OptionRight = view === "up" ? "call" : "put";
  const dir = view === "up" ? 1 : -1;
  const usdU = usdPerUnitOf(chain);
  const years = Math.max(1 / 8760, (Date.parse(chain.cutAt) - Date.now()) / (365 * 86_400_000));
  const iv = rows[i0]?.call?.iv ?? 0.1;
  const fwd = chain.atmStrike ?? chain.spot?.mid ?? rows[i0]!.strike;
  const mk = (id: Idea["id"], legs: Idea["legs"]): Idea | null => {
    if (legs.some((l) => !(l.right === "call" ? l.row.call : l.row.put))) return null;
    const pay: PayLeg[] = legs.map((l) => ({ right: l.right, strike: l.row.strike, side: l.side, contracts: l.contracts, premium: fillOf((l.right === "call" ? l.row.call : l.row.put)!, l.side), iv: (l.right === "call" ? l.row.call : l.row.put)!.iv }));
    const st = payoffStats(pay, usdU);
    const cost = pay.reduce((s, p) => s + (p.side === "buy" ? 1 : -1) * p.premium * usdU * p.contracts, 0);
    return { id, legs, cost, maxLoss: st.maxLoss, maxProfit: st.maxProfit, breakeven: st.breakevens[0] ?? null, pop: probProfit(pay, usdU, fwd, iv, years), cap: id === "spread" ? legs[1]!.row.strike : undefined };
  };
  // one strike out of the money: cheaper than ATM, still close to the money
  const iBuy = Math.min(rows.length - 1, Math.max(0, i0 + dir));
  const iSell = Math.min(rows.length - 1, Math.max(0, i0 + dir * 3));
  const single = mk("single", [{ row: rows[iBuy]!, right, side: "buy", contracts }]);
  const spread = iSell !== i0 ? mk("spread", [{ row: rows[i0]!, right, side: "buy", contracts }, { row: rows[iSell]!, right, side: "sell", contracts }]) : null;
  return [single, spread].filter((x): x is Idea => !!x);
}

export function SimpleMode({ className }: { className?: string }) {
  const t = useT();
  const { locale } = useLocale();
  const chain = useOpt((s) => s.chain);
  const underlyings = useOpt((s) => s.underlyings);
  const u = useOpt((s) => s.u);
  const expiries = useOpt((s) => s.expiries);
  const expiry = useOpt((s) => s.expiry);
  const [view, setView] = React.useState<View>("up");
  const [contracts, setContracts] = React.useState(1);
  // ideas follow the chain at most once a second (prices tick 4×/s)
  const [ideas, setIdeas] = React.useState<Idea[]>([]);
  const last = React.useRef(0);
  React.useEffect(() => {
    if (!chain) return setIdeas([]);
    const now = Date.now();
    if (now - last.current < 1000 && ideas.length) return;
    last.current = now;
    setIdeas(buildIdeas(chain, view, contracts));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chain, view, contracts]);

  return (
    <div className={cn("space-y-3 p-2.5", className)}>
      <div className="rounded-[9px] border border-line bg-surface-2/40 p-2.5">
        <div className="mb-2 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-3">
          <Lightbulb className="size-3.5 text-gold" /> {t("trader.opt.simple.title")}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[13px] leading-8 text-fg">
          <span>{t("trader.opt.simple.iThink")}</span>
          <span className="relative inline-flex">
            <span className="pointer-events-none absolute start-2 top-1/2 -translate-y-1/2">
              <OptAvatar symbol={u} size={12} />
            </span>
            <TSelect ariaLabel={t("trader.opt.col.underlying")} value={u} onChange={(v) => opt.selectUnderlying(v)} options={underlyings.map((x) => ({ value: x.symbol, label: x.symbol }))} className="h-7 w-[118px] ps-8 font-semibold" />
          </span>
          <span>{t("trader.opt.simple.goes")}</span>
          <span className="inline-flex rounded-[7px] border border-line bg-surface-2 p-0.5">
            <button onClick={() => setView("up")} aria-pressed={view === "up"} className={cn("flex h-6 items-center gap-1 rounded-[5px] px-2 text-[12px] font-semibold", view === "up" ? "bg-up text-white" : "text-fg-3 hover:text-fg-2")}>
              <ArrowUpRight className="size-3.5" /> {t("trader.opt.simple.up")}
            </button>
            <button onClick={() => setView("down")} aria-pressed={view === "down"} className={cn("flex h-6 items-center gap-1 rounded-[5px] px-2 text-[12px] font-semibold", view === "down" ? "bg-down text-white" : "text-fg-3 hover:text-fg-2")}>
              <ArrowDownRight className="size-3.5" /> {t("trader.opt.simple.down")}
            </button>
          </span>
          <span>{t("trader.opt.simple.by")}</span>
          <TSelect ariaLabel={t("trader.opt.expiries")} value={expiry ?? ""} onChange={(v) => opt.selectExpiry(v)} options={expiries.map((e) => ({ value: e.date, label: expiryLabel(e.date, locale) }))} className="h-7 w-[124px]" />
        </div>
        <div className="mt-2 flex items-center gap-2 text-[11.5px] text-fg-3">
          <span>{t("trader.opt.ticket.contracts")}</span>
          <div className="w-[96px]">
            <Stepper ariaLabel={t("trader.opt.ticket.contracts")} value={String(contracts)} onChange={(v) => setContracts(Math.max(1, Math.min(100, Math.round(parseFloat(v) || 1))))} step={1} min={1} decimals={0} className="h-6" />
          </div>
        </div>
      </div>

      {!chain && <div className="py-6 text-center text-[12px] text-fg-3">{t("trader.opt.loadingChain")}</div>}
      {chain &&
        ideas.map((idea) => <IdeaCard key={`${idea.id}-${view}-${chain.expiry}`} idea={idea} chain={chain} view={view} locale={locale} />)}
      <p className="text-[10.5px] leading-relaxed text-fg-3">{t("trader.opt.simple.disclaimer")}</p>
    </div>
  );
}

function IdeaCard({ idea, chain, view, locale }: { idea: Idea; chain: OptionChain; view: View; locale: string }) {
  const t = useT();
  const u = chain.underlying;
  const date = expiryLabel(chain.expiry, locale);
  const d = chain.digits;
  const right = idea.legs[0]!.right;
  const [explain, setExplain] = React.useState<{ busy: boolean; text?: string; ai?: boolean; error?: string } | null>(null);
  const title =
    idea.id === "single" ? (right === "call" ? t("trader.opt.simple.buyCall") : t("trader.opt.simple.buyPut")) : view === "up" ? t("trader.opt.tpl.bull_call.name") : t("trader.opt.tpl.bear_put.name");
  const be = idea.breakeven !== null ? px(idea.breakeven, d) : "—";
  const plain =
    idea.id === "single"
      ? t(view === "up" ? "trader.opt.simple.plainCall" : "trader.opt.simple.plainPut", { cost: usd(idea.cost), u, be, date, time: chain.cut.time })
      : t(view === "up" ? "trader.opt.simple.plainBullSpread" : "trader.opt.simple.plainBearSpread", { cost: usd(idea.cost), u, cap: px(idea.cap ?? 0, d), profit: idea.maxProfit === null ? t("trader.opt.unlimited") : usd(idea.maxProfit), be, date });

  const use = () => {
    opt.setLegs(idea.legs.map((l) => {
      const q = (l.right === "call" ? l.row.call : l.row.put)!;
      return { series: q.code, u, expiry: chain.expiry, right: l.right, strike: l.row.strike, strikeLabel: l.row.strikeLabel, side: l.side, contracts: l.contracts };
    }));
    opt.setPrefs({ panel: "ticket" });
  };

  const ask = async () => {
    setExplain({ busy: true });
    const body = {
      locale,
      strategy: {
        name: title,
        view,
        underlying: u,
        expiry: chain.expiry,
        cut: `${chain.cut.time} ${chain.cut.zone}`,
        spot: chain.spot?.mid ?? null,
        contractSize: chain.contractSize,
        contractUnit: chain.contractUnit,
        legs: idea.legs.map((l) => {
          const q = (l.right === "call" ? l.row.call : l.row.put)!;
          return { side: l.side, right: l.right, strike: l.row.strike, contracts: l.contracts, premiumUsd: (l.side === "buy" ? q.askUsd : q.bidUsd) || (q.book ? q.markUsd : 0), iv: q.iv, delta: q.delta };
        }),
        netPremium: +idea.cost.toFixed(2),
        maxProfit: idea.maxProfit === null ? null : +idea.maxProfit.toFixed(2),
        maxLoss: idea.maxLoss === null ? null : +idea.maxLoss.toFixed(2),
        breakevens: idea.breakeven !== null ? [idea.breakeven] : [],
        probProfit: +idea.pop.toFixed(3),
      },
    };
    try {
      const res = await fetch("/api/options/explain", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = (await res.json().catch(() => ({}))) as { configured?: boolean; text?: string; error?: string };
      if (data.text) return setExplain({ busy: false, text: data.text, ai: true });
      if (data.configured === false) return setExplain({ busy: false, text: `${plain} ${t("trader.opt.simple.basicMore")}`, ai: false });
      setExplain({ busy: false, error: data.error ?? t("trader.opt.simple.explainFailed") });
    } catch {
      setExplain({ busy: false, error: t("trader.opt.simple.explainFailed") });
    }
  };

  return (
    <div className="rounded-[9px] border border-line bg-panel-2/60 p-2.5">
      <div className="flex items-center gap-2">
        <span className="flex gap-0.5">
          {idea.legs.map((l, i) => (
            <RightTag key={i} right={l.right} />
          ))}
        </span>
        <span className="text-[12.5px] font-semibold text-fg">{title}</span>
        {idea.id === "spread" && <span className="rounded-[4px] bg-gold-soft px-1.5 text-[9.5px] font-semibold uppercase tracking-[0.05em] text-gold">{t("trader.opt.simple.cheaper")}</span>}
        <span className="ms-auto font-mono text-[10.5px] text-fg-3">{idea.legs.map((l) => `${l.side === "buy" ? "+" : "−"}${l.row.strikeLabel}`).join(" / ")}</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {[
          [t("trader.opt.simple.cost"), `${usd(idea.cost)}`, "text-fg"],
          [t("trader.opt.preview.maxLoss"), idea.maxLoss === null ? t("trader.opt.unlimited") : usd(idea.maxLoss), "text-down"],
          [t("trader.opt.preview.maxProfit"), idea.maxProfit === null ? t("trader.opt.unlimited") : usd(idea.maxProfit), "text-up"],
          [t("trader.opt.col.be"), be, "text-fg"],
        ].map(([k, v, tone]) => (
          <div key={k} className="rounded-[6px] bg-surface-2/60 px-2 py-1">
            <div className="text-[9.5px] font-medium uppercase tracking-[0.05em] text-fg-3">{k}</div>
            <div className={cn("k-num font-mono text-[12px] font-semibold", tone)}>{v}</div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-fg-2">{plain}</p>
      <div className="mt-1 text-[11px] text-fg-3">{t("trader.opt.simple.pop", { pct: pct(idea.pop, 0) })}</div>
      {explain && (
        <div className="mt-2 rounded-[7px] border border-line bg-surface-2/50 px-2.5 py-2 text-[12px] leading-relaxed text-fg-2">
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
      <div className="mt-2.5 flex items-center gap-1.5">
        <button onClick={use} className={cn("flex h-7 flex-1 items-center justify-center gap-1.5 rounded-[7px] text-[12px] font-semibold text-white transition hover:brightness-110", view === "up" ? "bg-up" : "bg-down")}>
          {t("trader.opt.simple.use")}
        </button>
        <button onClick={() => void ask()} disabled={explain?.busy} className="flex h-7 items-center gap-1.5 rounded-[7px] border border-line px-2.5 text-[12px] font-medium text-fg-2 transition-colors hover:border-ember/40 hover:text-fg disabled:opacity-60">
          <Sparkles className="size-3.5 text-ember" /> {t("trader.opt.simple.explain")}
        </button>
      </div>
    </div>
  );
}
