"use client";

// Strategy builder (drawer): templates filled around ATM for the selected expiry (long call / put, straddle, strangle,
// bull call / bear put spread, iron condor, butterfly) or custom legs, the payoff at expiry and today, max profit /
// loss, breakevens, probability of profit, Greeks and margin from the live preview, and one all-or-nothing order.
import * as React from "react";
import { createPortal } from "react-dom";
import { ArrowRightLeft, Lock, Plus, Send, Wand2, X } from "lucide-react";
import { cn } from "@kalks/ui";
import { useLocale, useT } from "@kalks/i18n/react";
import { toast } from "@/lib/notify";
import { useTerminal } from "@/lib/store";
import { GuestActions } from "@/components/shell/guest";
import { Stepper, TSelect } from "@/components/ui/primitives";
import { optionsApi } from "@/lib/options/api";
import { errText, needsOnboarding } from "@/lib/options/errors";
import { TEMPLATES, atmIndex, detectTemplate, fillOf, probProfit, templateLegs, usdPerUnitOf, type PayLeg, type TemplateId } from "@/lib/options/math";
import { opt, useOpt } from "@/lib/options-store";
import type { OptionChain, OptionRight, Side } from "@/lib/options/types";
import { ErrorNote, Flash, OptAvatar, RightTag, Seg } from "./bits";
import { expiryLabel, pct, usd } from "./format";
import { PayoffChart } from "./payoff-chart";
import { PreviewSummary, usePreview } from "./preview";

interface BLeg {
  id: string;
  right: OptionRight;
  strikeLabel: string;
  side: Side;
  contracts: number;
}

const uid = () => Math.random().toString(36).slice(2, 9);

/** Payoff shapes for the template cards (40 × 18, zero line at y = 10). */
const GLYPH: Record<TemplateId, string> = {
  long_call: "M0,13 L20,13 L40,2",
  long_put: "M0,2 L20,13 L40,13",
  straddle: "M0,2 L20,15 L40,2",
  strangle: "M0,3 L14,14 L26,14 L40,3",
  bull_call: "M0,14 L14,14 L26,5 L40,5",
  bear_put: "M0,5 L14,5 L26,14 L40,14",
  iron_condor: "M0,15 L8,15 L15,6 L25,6 L32,15 L40,15",
  butterfly: "M0,13 L13,13 L20,3 L27,13 L40,13",
};

function Drawer({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: React.ReactNode; title: React.ReactNode }) {
  const t = useT();
  React.useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] flex justify-end" role="dialog" aria-modal dir="ltr">
      <div className="absolute inset-0 bg-black/50 animate-[t-fade_.12s_ease-out]" onMouseDown={onClose} />
      <div className="relative flex h-full w-full max-w-[980px] flex-col border-s border-line-top bg-panel shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] animate-[opt-drawer_.18s_cubic-bezier(0.16,1,0.3,1)]">
        <div className="flex h-11 shrink-0 items-center gap-2.5 border-b border-line bg-panel-2 ps-3.5 pe-1.5">
          <Wand2 className="size-4 text-ember" />
          <div className="min-w-0 flex-1 truncate text-[13px] font-medium text-fg">{title}</div>
          <button onClick={onClose} aria-label={t("common.close")} className="grid size-7 place-items-center rounded-md text-fg-3 hover:bg-surface-3 hover:text-fg">
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function StrategyBuilder() {
  const open = useOpt((s) => s.builder);
  const t = useT();
  const u = useOpt((s) => s.u);
  const expiry = useOpt((s) => s.expiry);
  const { locale } = useLocale();
  return (
    <Drawer
      open={open}
      onClose={() => opt.openBuilder(false)}
      title={
        <span className="flex items-center gap-2">
          {t("trader.opt.builder.title")}
          <span className="flex items-center gap-1.5 font-normal text-fg-3">
            · <OptAvatar symbol={u} size={13} /> {u} · {expiry ? expiryLabel(expiry, locale) : "—"}
          </span>
        </span>
      }
    >
      {open && <BuilderBody />}
    </Drawer>
  );
}

function BuilderBody() {
  const T = useTerminal();
  const t = useT();
  const { locale } = useLocale();
  const chain = useOpt((s) => s.chain);
  const expiries = useOpt((s) => s.expiries);
  const expiry = useOpt((s) => s.expiry);
  const u = useOpt((s) => s.u);
  const ticketLegs = useOpt((s) => s.ticket.legs);
  const publicView = useOpt((s) => s.publicView);
  const tradingSoon = useOpt((s) => s.tradingSoon);
  const [tpl, setTpl] = React.useState<TemplateId | "custom">("straddle");
  const [width, setWidth] = React.useState(1);
  const [mult, setMult] = React.useState(1);
  const [legs, setLegs] = React.useState<BLeg[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [lastErr, setLastErr] = React.useState<{ code: string; message: string } | null>(null);
  const seeded = React.useRef(false);

  const apply = React.useCallback(
    (id: TemplateId, w: number, n: number, c: OptionChain) => setLegs(templateLegs(id, c, w, n).map((l) => ({ id: uid(), right: l.right, strikeLabel: l.row.strikeLabel, side: l.side, contracts: l.contracts }))),
    [],
  );

  // start from the ticket's legs when it holds a strategy on this chain, else from a straddle
  React.useEffect(() => {
    if (seeded.current || !chain) return;
    seeded.current = true;
    const mine = ticketLegs.filter((l) => l.u === chain.underlying && l.expiry === chain.expiry);
    if (mine.length) {
      setLegs(mine.map((l) => ({ id: uid(), right: l.right, strikeLabel: l.strikeLabel, side: l.side, contracts: l.contracts })));
      setTpl(detectTemplate(mine) ?? "custom");
    } else apply("straddle", 1, 1, chain);
  }, [chain, ticketLegs, apply]);

  // another expiry: keep the strategy, move each leg to the nearest listed strike
  const chainKey = chain ? `${chain.underlying}|${chain.expiry}` : "";
  const lastKey = React.useRef(chainKey);
  React.useEffect(() => {
    if (!chain || lastKey.current === chainKey) return;
    lastKey.current = chainKey;
    if (tpl !== "custom") apply(tpl, width, mult, chain);
    else
      setLegs((ls) =>
        ls.map((l) => {
          if (chain.rows.some((r) => r.strikeLabel === l.strikeLabel)) return l;
          const k = Number(l.strikeLabel);
          const best = chain.rows.reduce((a, r) => (Math.abs(r.strike - k) < Math.abs(a.strike - k) ? r : a), chain.rows[0]!);
          return { ...l, strikeLabel: best.strikeLabel };
        }),
      );
  }, [chainKey, chain, tpl, width, mult, apply]);

  const rows = chain?.rows ?? [];
  const resolved = legs
    .map((l) => {
      const row = rows.find((r) => r.strikeLabel === l.strikeLabel);
      const q = row ? (l.right === "call" ? row.call : row.put) : null;
      return row && q ? { ...l, row, q } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
  const usdPerUnit = usdPerUnitOf(chain);
  const pay: PayLeg[] = resolved.map((l) => ({ right: l.right, strike: l.row.strike, side: l.side, contracts: l.contracts, premium: fillOf(l.q, l.side), iv: l.q.iv }));
  const preview = usePreview(
    resolved.map((l) => ({ series: l.q.code, u, right: l.right, strike: l.row.strike, side: l.side, contracts: l.contracts })),
    "market",
    undefined,
  );
  const cut = chain ? Date.parse(chain.cutAt) : Date.now();
  const years = Math.max(1 / 365 / 24, (cut - Date.now()) / (365 * 86_400_000));
  const atmIv = chain && rows.length ? (rows[atmIndex(chain)]?.call?.iv ?? 0.1) : 0.1;
  const spot = chain?.spot?.mid ?? 0;
  const pop = probProfit(pay, usdPerUnit, chain?.atmStrike ?? spot, atmIv, years);
  const breakevens = preview.preview?.breakevens ?? [];

  const pickTemplate = (id: TemplateId) => {
    setTpl(id);
    if (chain) apply(id, width, mult, chain);
  };
  const setW = (w: number) => {
    setWidth(w);
    if (chain && tpl !== "custom") apply(tpl, w, mult, chain);
  };
  const setM = (n: number) => {
    setMult(n);
    if (chain && tpl !== "custom") apply(tpl, width, n, chain);
    else setLegs((ls) => ls.map((l) => ({ ...l, contracts: Math.max(1, Math.round((l.contracts / Math.max(1, mult)) * n)) })));
  };
  const edit = (id: string, patch: Partial<BLeg>) => {
    setTpl("custom");
    setLegs((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };
  const addLeg = () => {
    if (!chain || !rows.length) return;
    setTpl("custom");
    setLegs((ls): BLeg[] => [...ls, { id: uid(), right: "call" as const, strikeLabel: rows[atmIndex(chain)]!.strikeLabel, side: "buy" as const, contracts: mult }].slice(0, 8));
  };

  const toTicket = () => {
    if (!chain) return;
    opt.setLegs(resolved.map((l) => ({ series: l.q.code, u, expiry: chain.expiry, right: l.right, strike: l.row.strike, strikeLabel: l.strikeLabel, side: l.side, contracts: l.contracts })));
    opt.openBuilder(false);
    toast(t("trader.opt.builder.sentToTicket"), { description: t("trader.opt.ticket.strategy", { count: resolved.length }) });
  };

  const guest = T.guest || publicView;
  const dup = new Set(resolved.map((l) => l.q.code)).size !== resolved.length;
  const blocked = guest || T.readOnly || busy || !resolved.length || dup || !preview.preview?.ok || (preview.preview?.estimate && T.live);
  const place = async () => {
    if (blocked || !chain) return;
    setBusy(true);
    setLastErr(null);
    const r = await optionsApi.order(T.account.login, { legs: resolved.map((l) => ({ series: l.q.code, side: l.side, contracts: l.contracts })), type: "market", clientOrderId: `stg${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}` });
    setBusy(false);
    const name = tpl === "custom" ? t("trader.opt.tpl.custom.name") : t.dyn(`trader.opt.tpl.${tpl}.name`, tpl);
    if (!r.ok) {
      setLastErr({ code: r.err.code, message: r.err.message });
      T.log("Trade", `'${T.account.login}': option strategy ${name} ${u} ${chain.expiry} failed [${r.err.code}]`, "error");
      if (!needsOnboarding(r.err.code)) toast.error(t("trader.opt.toast.rejected"), { description: `${name} · ${errText(r.err)}` });
      return;
    }
    T.log("Trade", `'${T.account.login}': option strategy ${name} ${u} ${chain.expiry}: ${resolved.map((l) => `${l.side} ${l.contracts} ${l.q.code}`).join(", ")} done`);
    toast.success(t("trader.opt.toast.strategyFilled", { name }), { description: `${u} · ${expiryLabel(chain.expiry, locale)} · ${t("trader.opt.ticket.strategy", { count: resolved.length })}` });
    opt.openBuilder(false);
  };

  if (!chain) return <div className="grid flex-1 place-items-center text-[12px] text-fg-3">{t("trader.opt.loadingChain")}</div>;

  return (
    <>
      <div className="t-scroll grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* left: templates + legs */}
        <div className="space-y-3 border-line p-3.5 lg:border-e">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-3">{t("trader.opt.builder.templates")}</span>
              <TSelect ariaLabel={t("trader.opt.expiries")} value={expiry ?? ""} onChange={(v) => opt.selectExpiry(v)} options={expiries.map((e) => ({ value: e.date, label: `${expiryLabel(e.date, locale)} · ${Math.max(0, Math.floor((Date.parse(e.cutAt) - Date.now()) / 86_400_000))}D` }))} className="h-6 w-[150px] text-[11px]" />
            </div>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {TEMPLATES.map((id) => (
                <button key={id} onClick={() => pickTemplate(id)} aria-pressed={tpl === id} className={cn("group rounded-[8px] border p-2 text-start transition-colors", tpl === id ? "border-ember/50 bg-ember-soft/60" : "border-line bg-surface-2/40 hover:border-fg-3/40 hover:bg-surface-2")}>
                  <svg viewBox="0 0 40 18" className="mb-1 h-[18px] w-[40px]" aria-hidden>
                    <line x1="0" x2="40" y1="10" y2="10" stroke="var(--k-fg-3)" strokeOpacity="0.5" strokeDasharray="2 2" />
                    <path d={GLYPH[id]} fill="none" stroke={tpl === id ? "var(--k-ember)" : "var(--k-gold)"} strokeWidth="1.6" strokeLinejoin="round" />
                  </svg>
                  <div className="text-[11.5px] font-semibold leading-tight text-fg">{t.dyn(`trader.opt.tpl.${id}.name`, id)}</div>
                  <div className="mt-0.5 text-[10px] leading-snug text-fg-3">{t.dyn(`trader.opt.tpl.${id}.hint`, "")}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="mb-1 text-[10.5px] font-medium uppercase tracking-[0.05em] text-fg-3">{t("trader.opt.builder.width")}</div>
              <Stepper ariaLabel={t("trader.opt.builder.width")} value={String(width)} onChange={(v) => setW(Math.max(1, Math.min(10, Math.round(parseFloat(v) || 1))))} step={1} min={1} decimals={0} />
            </div>
            <div>
              <div className="mb-1 text-[10.5px] font-medium uppercase tracking-[0.05em] text-fg-3">{t("trader.opt.builder.size")}</div>
              <Stepper ariaLabel={t("trader.opt.builder.size")} value={String(mult)} onChange={(v) => setM(Math.max(1, Math.min(100, Math.round(parseFloat(v) || 1))))} step={1} min={1} decimals={0} />
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-3">
                {t("trader.opt.builder.legs")} {tpl === "custom" && <span className="ms-1 rounded-[4px] bg-surface-3 px-1 text-[9.5px] normal-case tracking-normal">{t("trader.opt.tpl.custom.name")}</span>}
              </span>
              <button onClick={addLeg} disabled={legs.length >= 8} className="flex h-6 items-center gap-1 rounded-[5px] px-1.5 text-[11px] text-fg-2 hover:bg-surface-3 hover:text-fg disabled:opacity-40">
                <Plus className="size-3" /> {t("trader.opt.builder.addLeg")}
              </button>
            </div>
            <div className="overflow-hidden rounded-[8px] border border-line">
              <div className="grid grid-cols-[52px_56px_minmax(0,1fr)_76px_64px_22px] items-center gap-1.5 border-b border-line bg-panel-2 px-2 py-1 text-[9.5px] font-medium uppercase tracking-[0.05em] text-fg-3">
                <span>{t("trader.opt.col.side")}</span>
                <span>{t("trader.opt.col.type")}</span>
                <span>{t("trader.opt.col.strike")}</span>
                <span>{t("trader.opt.ticket.contracts")}</span>
                <span className="text-end">{t("trader.opt.col.price")}</span>
                <span />
              </div>
              {legs.map((l) => {
                const row = rows.find((r) => r.strikeLabel === l.strikeLabel);
                const q = row ? (l.right === "call" ? row.call : row.put) : null;
                const priceUsd = q ? (l.side === "buy" ? q.askUsd : q.bidUsd) : 0;
                return (
                  <div key={l.id} className="grid grid-cols-[52px_56px_minmax(0,1fr)_76px_64px_22px] items-center gap-1.5 border-b border-line/60 px-2 py-1 last:border-b-0">
                    <Seg size="sm" value={l.side} onChange={(v) => edit(l.id, { side: v })} options={[{ value: "buy", label: t("trader.opt.b"), tone: "up" }, { value: "sell", label: t("trader.opt.s"), tone: "down" }]} />
                    <Seg size="sm" value={l.right} onChange={(v) => edit(l.id, { right: v })} options={[{ value: "call", label: "C" }, { value: "put", label: "P" }]} />
                    <TSelect ariaLabel={t("trader.opt.col.strike")} value={l.strikeLabel} onChange={(v) => edit(l.id, { strikeLabel: v })} options={rows.map((r) => ({ value: r.strikeLabel, label: r.strikeLabel }))} className="h-6 font-mono text-[11px]" />
                    <Stepper ariaLabel={t("trader.opt.ticket.contracts")} value={String(l.contracts)} onChange={(v) => edit(l.id, { contracts: Math.max(1, Math.round(parseFloat(v) || 1)) })} step={1} min={1} decimals={0} className="h-6" />
                    <span className={cn("text-end font-mono text-[11.5px]", l.side === "buy" ? "text-up" : "text-down")}>
                      <Flash value={priceUsd}>{priceUsd ? usd(priceUsd) : "—"}</Flash>
                    </span>
                    <button onClick={() => (setTpl("custom"), setLegs((ls) => ls.filter((x) => x.id !== l.id)))} aria-label={t("trader.opt.ticket.removeLeg")} className="grid size-5 place-items-center rounded-[4px] text-fg-3 hover:bg-surface-3 hover:text-fg">
                      <X className="size-3" />
                    </button>
                  </div>
                );
              })}
              {!legs.length && <div className="px-3 py-4 text-center text-[11.5px] text-fg-3">{t("trader.opt.builder.noLegs")}</div>}
            </div>
            {dup && <div className="mt-1.5 text-[11px] text-warn">{t("trader.opt.builder.duplicate")}</div>}
          </div>
        </div>

        {/* right: payoff + numbers */}
        <div className="space-y-3 p-3.5">
          <div className="rounded-[8px] border border-line bg-panel-2/60 p-2">
            <PayoffChart legs={pay} usdPerUnit={usdPerUnit} spot={spot} u={u} cutAtMs={cut} digits={chain.digits} breakevens={breakevens} sigmaT={atmIv * Math.sqrt(years)} />
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              [t("trader.opt.builder.pop"), pct(pop, 0), "text-fg"],
              [t("trader.opt.preview.maxProfit"), preview.preview ? (preview.preview.maxProfit === null ? t("trader.opt.unlimited") : usd(preview.preview.maxProfit)) : "—", "text-up"],
              [t("trader.opt.preview.maxLoss"), preview.preview ? (preview.preview.maxLoss === null ? t("trader.opt.unlimited") : usd(preview.preview.maxLoss)) : "—", "text-down"],
            ].map(([k, v, tone]) => (
              <div key={k} className="rounded-[7px] border border-line bg-surface-2/40 px-2 py-1.5">
                <div className="text-[9.5px] font-medium uppercase tracking-[0.06em] text-fg-3">{k}</div>
                <div className={cn("k-num mt-0.5 font-mono text-[13px] font-semibold", tone)}>{v}</div>
              </div>
            ))}
          </div>
          <PreviewSummary state={preview} digits={chain.digits} />
          {lastErr && <ErrorNote code={lastErr.code} message={lastErr.message} />}
          <p className="text-[10.5px] leading-relaxed text-fg-3">{t("trader.opt.builder.note")}</p>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-line bg-panel-2 px-3.5 py-2.5">
        {guest ? (
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[12px] text-fg-2">
              <Lock className="size-3.5 text-ember" /> {t("trader.opt.guest.title")}
            </span>
            <GuestActions />
          </div>
        ) : (
          <>
            <span className="me-auto hidden text-[11px] text-fg-3 sm:block">{t("trader.opt.builder.atomic")}</span>
            <button onClick={toTicket} disabled={!resolved.length} className="flex h-8 items-center gap-1.5 rounded-[7px] border border-line px-3 text-[12px] font-medium text-fg-2 hover:border-fg-3/50 hover:text-fg disabled:opacity-45">
              <ArrowRightLeft className="size-3.5" /> {t("trader.opt.builder.toTicket")}
            </button>
            <button onClick={() => void place()} disabled={!!blocked} className="flex h-8 items-center gap-1.5 rounded-[7px] bg-ember px-3.5 text-[12px] font-semibold text-white shadow-[0_6px_18px_-8px_rgba(255,90,31,0.8)] transition hover:brightness-110 disabled:bg-surface-3 disabled:text-fg-3 disabled:shadow-none">
              <Send className="size-3.5" />
              {busy ? t("trader.opt.ticket.sending") : tradingSoon && T.live ? t("trader.opt.ticket.soon") : t("trader.opt.builder.place")}
              {preview.preview && <span className="k-num rounded-[4px] bg-black/15 px-1 font-mono text-[10.5px]">{usd(Math.abs(preview.preview.netPremium))}</span>}
            </button>
          </>
        )}
      </div>
    </>
  );
}
