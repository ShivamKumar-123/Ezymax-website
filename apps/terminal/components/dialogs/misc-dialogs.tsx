"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { toast } from "@/lib/notify";
import { BarChart2, BookOpen, Check, CornerDownLeft, Info, Keyboard, Search, Settings2, ShoppingCart, Star } from "lucide-react";
import { useTheme } from "next-themes";
import { LOCALES } from "@ezymex/i18n/locales";
import { useLocale } from "@ezymex/i18n/react";
import type { MessageKey } from "@ezymex/i18n";
import { ASSET_CLASS_LABEL, INSTRUMENT_MAP } from "@ezymex/mock";
import { useMarketScope } from "@/lib/scope";
import { LogoMark, PriceText, SymbolAvatar, cn, useQuote } from "@ezymex/ui";
import { useTradeMode } from "@/lib/options/mode";
import { useTerminal } from "@/lib/store";
import { Kbd } from "./kbd";
import { Stepper, TDialog, TSelect } from "@/components/ui/primitives";
import { Button, Segmented, Switch } from "@/components/ui/kit";
import { SymbolInfo } from "@/components/order/right-panel";
import { SegmentChips, inSegment } from "@/components/market/segments";
import { MAX_DEVIATIONS, PRESETS, applyPreset, toggleOneClick, useCommands, type Command } from "@/components/shell/commands";
import type { Segment } from "@/lib/store";
import { useT } from "@ezymex/i18n/react";

/* ------------------------------------------------------------------ */
/* Command palette (Ctrl/⌘ K): markets and actions                     */
/* ------------------------------------------------------------------ */

const SUGGESTED = ["new-order", "indicators", "alerts", "keys", "tour", "settings"];

type Row = { k: "mkt"; symbol: string } | { k: "cmd"; c: Command };

export function SymbolSearch() {
  const T = useTerminal();
  if (!T.ui.search || typeof document === "undefined") return null;
  return <Palette />;
}

function Palette() {
  const T = useTerminal();
  const t = useT();
  const [q, setQ] = React.useState("");
  const cls = T.ws.searchSegment;
  const setCls = (s: Segment) => T.setWs({ searchSegment: s });
  const [idx, setIdx] = React.useState(0);
  const input = React.useRef<HTMLInputElement>(null);
  const close = React.useCallback(() => T.setUi({ search: false }), [T]);
  const commands = useCommands();
  React.useEffect(() => {
    setTimeout(() => input.current?.focus(), 10);
  }, []);
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  // the whole catalogue (1,400+), best matches first; rows render (and stream) only for the few shown
  const needle = q.toLowerCase();
  // live accounts and guests: only markets that trade live (lib/scope.ts)
  const scope = useMarketScope();
  const markets = scope.list.filter((i) => inSegment(i, cls, T.ws.favourites) && (!needle || i.symbol.toLowerCase().includes(needle) || i.name.toLowerCase().includes(needle))).sort((a, b) => (needle ? Number(!a.symbol.toLowerCase().startsWith(needle)) - Number(!b.symbol.toLowerCase().startsWith(needle)) : 0));
  const actions = words.length
    ? commands.filter((c) => {
        const hay = `${c.label} ${c.keywords ?? ""}`.toLowerCase();
        return words.every((w) => hay.includes(w));
      })
    : SUGGESTED.map((id) => commands.find((c) => c.id === id)).filter((c): c is Command => !!c);
  const shownMarkets = q ? markets.slice(0, 8) : markets.slice(0, 40);
  // actions first when the words match no market ("dark", "new order"); markets first otherwise
  const actionsFirst = !!q && shownMarkets.length === 0;
  const actionRows: Row[] = actions.slice(0, q ? 14 : 6).map((c) => ({ k: "cmd", c }));
  const marketRows: Row[] = shownMarkets.map((i) => ({ k: "mkt", symbol: i.symbol }));
  const rows: Row[] = actionsFirst ? [...actionRows, ...marketRows] : q ? [...marketRows, ...actionRows] : [...actionRows, ...marketRows];
  const pick = (s: string, mode: "chart" | "tab" | "trade" = "chart") => {
    if (mode === "trade") T.openNewOrder({ symbol: s });
    else T.openSymbol(s, mode === "tab");
    close();
    if (mode !== "trade") toast(mode === "tab" ? t("order.search.openedNewChart", { symbol: s }) : t("order.search.openedActiveChart", { symbol: s }));
  };
  const run = (c: Command) => {
    if (c.disabled) return;
    close();
    c.run();
  };
  const choose = (r: Row | undefined, e?: { altKey?: boolean; shiftKey?: boolean }) => {
    if (!r) return;
    if (r.k === "cmd") run(r.c);
    else pick(r.symbol, e?.altKey ? "tab" : e?.shiftKey ? "trade" : "chart");
  };
  const groupLabel = (g: Command["group"]) => t(`desk.cmd.group.${g}` as MessageKey);
  let n = -1;
  const renderRows = (list: Row[]) =>
    list.map((r) => {
      n += 1;
      const i = n;
      return r.k === "mkt" ? (
        <SearchRow key={`m-${r.symbol}`} symbol={r.symbol} active={i === idx} fav={T.ws.favourites.includes(r.symbol)} onHover={() => setIdx(i)} onPick={(m) => pick(r.symbol, m)} />
      ) : (
        <CommandRow key={`c-${r.c.id}`} c={r.c} group={groupLabel(r.c.group)} active={i === idx} onHover={() => setIdx(i)} onRun={() => run(r.c)} />
      );
    });
  const section = (title: string, list: Row[]) =>
    list.length ? (
      <div key={title}>
        <div className="px-3 pb-1 pt-2.5 text-[12px] font-semibold text-fg-3">{title}</div>
        {renderRows(list)}
      </div>
    ) : null;
  const first = actionsFirst || !q ? [t("desk.cmd.actions"), actionRows] : [t("desk.cmd.markets"), marketRows];
  const second = actionsFirst || !q ? [t("desk.cmd.markets"), marketRows] : [t("desk.cmd.actions"), actionRows];
  return createPortal(
    <div className="fixed inset-0 z-[75] flex items-start justify-center p-3 pt-[10vh]" role="dialog" aria-modal aria-label={t("desk.top.search")} dir="ltr">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onMouseDown={close} />
      <div
        className="t-pop t-glass-strong relative flex max-h-[78vh] w-full max-w-[640px] flex-col overflow-hidden rounded-[16px] border border-line-top shadow-[0_30px_80px_-20px_rgba(0,0,0,0.75)]"
        onKeyDown={(e) => {
          if (e.key === "Escape") close();
          if (e.key === "ArrowDown") (e.preventDefault(), setIdx((i) => Math.min(rows.length - 1, i + 1)));
          if (e.key === "ArrowUp") (e.preventDefault(), setIdx((i) => Math.max(0, i - 1)));
          if (e.key === "Enter") (e.preventDefault(), choose(rows[idx], e));
        }}
      >
        <div className="flex h-12 shrink-0 items-center gap-3 border-b border-line px-4">
          <Search className="size-4 text-fg-3" />
          <input ref={input} value={q} onChange={(e) => (setQ(e.target.value), setIdx(0))} placeholder={t("desk.cmd.placeholder")} className="h-full flex-1 bg-transparent text-[14px] outline-none placeholder:text-fg-3" aria-label={t("desk.top.search")} />
          <Kbd>Esc</Kbd>
        </div>
        <div className="shrink-0 border-b border-line px-3 py-2">
          <SegmentChips instruments={scope.list} value={cls} onChange={(s) => (setCls(s), setIdx(0))} favourites={T.ws.favourites} size="md" label={t("order.search.segment")} />
        </div>
        <div className="t-scroll min-h-0 flex-1 overflow-y-auto p-1.5">
          {section(first[0] as string, first[1] as Row[])}
          {section(second[0] as string, second[1] as Row[])}
          {!rows.length && <div className="p-8 text-center text-[13px] text-fg-3">{q ? t("desk.cmd.noMatch", { q }) : cls === "favourites" ? t("order.search.noFavourites") : t("order.search.emptySegment")}</div>}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t border-line bg-panel-2 px-4 py-2.5 text-[12px] text-fg-3">
          <span className="flex items-center gap-1.5">
            <Kbd>↑↓</Kbd> {t("order.search.navigate")}
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>↵</Kbd> {t("order.search.openInChart")} · {t("desk.cmd.run")}
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>Alt ↵</Kbd> {t("order.search.newChart")}
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>⇧ ↵</Kbd> {t("order.search.newOrder")}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function CommandRow({ c, group, active, onHover, onRun }: { c: Command; group: string; active: boolean; onHover: () => void; onRun: () => void }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: "nearest" });
  }, [active]);
  return (
    <div ref={ref} role="option" aria-selected={active} aria-disabled={c.disabled} onMouseMove={onHover} onClick={onRun} className={cn("flex h-8 cursor-default items-center gap-3 rounded-[8px] px-3 text-[13px]", active ? "bg-surface-3" : "", c.disabled ? "text-fg-3" : "text-fg")}>
      <span className="grid size-5 shrink-0 place-items-center text-fg-2 [&>svg]:size-4">{c.checked ? <Check className="text-accent-text" /> : c.icon}</span>
      <span className="min-w-0 flex-1 truncate">{c.label}</span>
      <span className="shrink-0 text-[12px] text-fg-3">{group}</span>
      {c.hint && <Kbd>{c.hint}</Kbd>}
    </div>
  );
}

function SearchRow({ symbol, active, fav, onHover, onPick }: { symbol: string; active: boolean; fav: boolean; onHover: () => void; onPick: (m: "chart" | "tab" | "trade") => void }) {
  const q = useQuote(symbol);
  const t = useT();
  const inst = INSTRUMENT_MAP[symbol]!;
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: "nearest" });
  }, [active]);
  return (
    <div ref={ref} role="option" aria-selected={active} onMouseMove={onHover} onClick={() => onPick("chart")} className={cn("group flex h-10 cursor-default items-center gap-3 rounded-[8px] px-3", active ? "bg-surface-3" : "")}>
      <SymbolAvatar symbol={symbol} size={20} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[13px] font-semibold">
          {symbol}
          {fav && <Star className="size-3 fill-gold text-gold" />}
        </div>
        <div className="truncate text-[12px] text-fg-3">
          {inst.name} · {t.dyn(`order.assetClass.${inst.assetClass}`, ASSET_CLASS_LABEL[inst.assetClass])}
        </div>
      </div>
      <PriceText symbol={symbol} value={q.bid} dir={q.dir} className="text-[13px]" />
      <span className={cn("k-num w-16 text-end font-mono text-[12px]", q.change >= 0 ? "text-up" : "text-down")} dir="ltr">
        {q.change >= 0 ? "+" : ""}
        {q.change.toFixed(2)}%
      </span>
      <span className={cn("flex gap-1", active ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
        <button title={t("order.search.newChartTitle")} aria-label={t("order.search.newChartTitle")} onClick={(e) => (e.stopPropagation(), onPick("tab"))} className="grid size-7 place-items-center rounded-[7px] text-fg-2 hover:bg-panel hover:text-fg">
          <BarChart2 className="size-3.5" />
        </button>
        <button title={t("order.search.newOrderTitle")} aria-label={t("order.search.newOrderTitle")} onClick={(e) => (e.stopPropagation(), onPick("trade"))} className="grid size-7 place-items-center rounded-[7px] text-fg-2 hover:bg-panel hover:text-fg">
          <ShoppingCart className="size-3.5" />
        </button>
        <CornerDownLeft className="my-auto size-4 text-fg-3" />
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Keyboard shortcuts                                                  */
/* ------------------------------------------------------------------ */

// [keys, label translation key]; key names (Ctrl, Alt, Delete, Esc…) stay as printed on keyboards
export const SHORTCUTS: { group: MessageKey; items: readonly (readonly [string, MessageKey])[] }[] = [
  {
    group: "desk.keys.trading",
    items: [
      ["F9", "order.shortcuts.newOrder"],
      ["F10", "order.shortcuts.oneClick"],
    ],
  },
  {
    group: "desk.keys.chart",
    items: [
      ["Ctrl + I", "order.shortcuts.indicators"],
      ["Ctrl + F", "order.shortcuts.crosshair"],
      ["Alt + 1 … 4", "order.shortcuts.layout"],
      ["+ / −", "order.shortcuts.zoom"],
      ["Delete", "order.shortcuts.deleteDrawing"],
    ],
  },
  {
    group: "desk.keys.panels",
    items: [
      ["Ctrl + M", "desk.keys.markets"],
      ["Ctrl + D", "desk.keys.trade"],
      ["Ctrl + T", "desk.keys.activity"],
      ["F11", "order.shortcuts.fullscreen"],
    ],
  },
  {
    group: "desk.keys.general",
    items: [
      ["Ctrl / ⌘ + K", "desk.keys.palette"],
      ["Esc", "order.shortcuts.escape"],
      ["F1", "order.shortcuts.help"],
    ],
  },
];

export function ShortcutsDialog() {
  const T = useTerminal();
  const t = useT();
  return (
    <TDialog open={T.ui.shortcuts} onClose={() => T.setUi({ shortcuts: false })} width={640} icon={<Keyboard />} title={t("order.shortcuts.title")}>
      <div className="grid gap-x-6 gap-y-4 p-4 sm:grid-cols-2">
        {SHORTCUTS.map((g) => (
          <section key={g.group}>
            <h3 className="mb-1 px-1 text-[12.5px] font-semibold text-fg-2">{t(g.group)}</h3>
            {g.items.map(([k, v]) => (
              <div key={k} className="flex min-h-9 items-center justify-between gap-3 rounded-[7px] px-2 text-[13px] hover:bg-surface-2">
                <span className="text-fg">{t(v)}</span>
                <span className="flex shrink-0 gap-1" dir="ltr">
                  {k.split(" + ").map((x) => (
                    <Kbd key={x}>{x}</Kbd>
                  ))}
                </span>
              </div>
            ))}
          </section>
        ))}
      </div>
    </TDialog>
  );
}

export function SpecDialog() {
  const T = useTerminal();
  const t = useT();
  const s = T.ui.spec;
  return (
    <TDialog open={!!s} onClose={() => T.setUi({ spec: null })} width={440} icon={<Info />} title={t("order.spec.title", { symbol: s ?? "" })}>
      {s && <SymbolInfo symbol={s} />}
    </TDialog>
  );
}

/* ------------------------------------------------------------------ */
/* Glossary (Help › Trading terms explained)                           */
/* ------------------------------------------------------------------ */

export const GLOSSARY = ["balance", "equity", "pnl", "margin", "free", "level", "lot", "pip", "spread", "leverage", "swap", "sl", "tp", "hedging", "netting", "commission", "credit"] as const;
/** Options words in plain language (desk.og.*): what a beginner meets in the chain, the ticket and settlement. */
export const OPTIONS_GLOSSARY = ["call", "put", "strike", "expiry", "cut", "premium", "be", "itm", "atm", "otm", "iv", "greeks", "delta", "gamma", "theta", "vega", "settle", "selling"] as const;

export function GlossaryDialog() {
  const T = useTerminal();
  const t = useT();
  const mode = useTradeMode();
  const [tab, setTab] = React.useState<"cfd" | "options">(mode);
  React.useEffect(() => {
    if (T.ui.glossary) setTab(mode);
  }, [T.ui.glossary, mode]);
  const list: { k: string; ns: "g" | "og" }[] = tab === "cfd" ? GLOSSARY.map((k) => ({ k, ns: "g" })) : OPTIONS_GLOSSARY.map((k) => ({ k, ns: "og" }));
  return (
    <TDialog open={T.ui.glossary} onClose={() => T.setUi({ glossary: false })} width={640} icon={<BookOpen />} title={t("desk.help.glossary")}>
      <div className="flex items-center gap-2 px-4 pt-3">
        <Segmented
          size="md"
          stretch={false}
          label={t("desk.help.glossary")}
          value={tab}
          onChange={(v) => setTab(v as "cfd" | "options")}
          options={[
            { value: "cfd", label: t("desk.og.tabCfd") },
            { value: "options", label: t("desk.og.tabOptions") },
          ]}
        />
      </div>
      <dl className="grid gap-x-6 gap-y-3 p-4 sm:grid-cols-2">
        {list.map(({ k, ns }) => (
          <div key={k} className="rounded-[10px] border border-line bg-panel-2/50 px-3 py-2.5">
            <dt className="text-[13.5px] font-semibold text-fg">{t.dyn(`desk.${ns}.${k}.t`)}</dt>
            <dd className="mt-0.5 text-[12.5px] leading-[18px] text-fg-2">{t.dyn(`desk.${ns}.${k}`)}</dd>
          </div>
        ))}
      </dl>
    </TDialog>
  );
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

/** Terminal settings in one place (each also lives in the Settings menu): applied at once, nothing to confirm. */
export function OptionsDialog() {
  const T = useTerminal();
  const t = useT();
  const { resolvedTheme, setTheme } = useTheme();
  const lang = useLocale();
  const close = React.useCallback(() => T.setUi({ options: false }), [T]);
  const [lot, setLot] = React.useState(T.ws.lot.toFixed(2));
  React.useEffect(() => {
    setLot(T.ws.lot.toFixed(2));
  }, [T.ws.lot, T.ui.options]);
  const commitLot = (v: string) => {
    setLot(v);
    const n = Math.round((parseFloat(v) || 0) * 100) / 100;
    if (n >= 0.01) T.setWs({ lot: n });
  };
  const a = T.account;
  const ro = T.readOnly || T.guest;
  return (
    <TDialog
      open={T.ui.options}
      onClose={close}
      width={560}
      icon={<Settings2 />}
      title={t("desk.set.dialogTitle")}
      footer={
        <Button variant="primary" size="lg" onClick={close}>
          {t("common.done")}
        </Button>
      }
    >
      <div className="divide-y divide-line text-[13px]">
        <OptSection title={t("desk.set.trading")}>
          <OptRow label={t("desk.set.oneClick")} hint={T.ws.oneClick ? t("desk.set.oneClickHint") : t("desk.set.oneClickOffHint")}>
            <Switch checked={T.ws.oneClick && !ro} disabled={ro} onChange={() => toggleOneClick(T)} label={t("desk.set.oneClick")} />
          </OptRow>
          <OptRow label={t("desk.set.defaultLot")} hint={t("desk.set.defaultLotHint")}>
            <Stepper size="md" value={lot} onChange={commitLot} step={0.01} min={0.01} decimals={2} ariaLabel={t("desk.set.defaultLot")} className="w-[150px]" />
          </OptRow>
          <OptRow label={t("desk.set.maxDeviation")} hint={t("desk.set.maxDeviationHint")}>
            <TSelect
              ariaLabel={t("desk.set.maxDeviation")}
              value={T.ws.maxDeviation === null ? "any" : String(T.ws.maxDeviation)}
              onChange={(v) => T.setWs({ maxDeviation: v === "any" ? null : Number(v) })}
              options={MAX_DEVIATIONS.map((d) => ({ value: d === null ? "any" : String(d), label: d === null ? t("trader.menu.anyPrice") : t("trader.menu.points", { count: d }) }))}
              className="w-[150px]"
            />
          </OptRow>
          <OptRow label={t("desk.set.sounds")} hint={t("desk.set.soundsHint")}>
            <Switch checked={T.ws.sound} onChange={(v) => T.setWs({ sound: v })} label={t("desk.set.sounds")} />
          </OptRow>
        </OptSection>
        <OptSection title={t("desk.set.appearance")}>
          <OptRow label={t("desk.set.theme")}>
            <Segmented
              value={resolvedTheme === "light" ? "light" : "dark"}
              onChange={(v) => setTheme(v)}
              label={t("desk.set.theme")}
              className="w-[180px]"
              options={[
                { value: "dark", label: t("desk.set.dark") },
                { value: "light", label: t("desk.set.light") },
              ]}
            />
          </OptRow>
          <OptRow label={t("desk.set.language")}>
            <TSelect ariaLabel={t("desk.set.language")} value={lang.locale} onChange={(v) => void lang.setLocale(v)} options={LOCALES.map((l) => ({ value: l.code, label: l.name }))} className="w-[180px]" />
          </OptRow>
        </OptSection>
        <OptSection title={t("desk.set.workspace")}>
          <div className="flex flex-wrap gap-1.5 py-1">
            {PRESETS.map((p) => (
              <Button key={p.id} variant="secondary" onClick={() => applyPreset(T, p)}>
                {t(p.nameKey)} <span className="text-[12px] font-normal text-fg-3">{t(p.hintKey)}</span>
              </Button>
            ))}
          </div>
          <OptRow label={t("desk.set.reset")} hint={t("desk.set.resetHint")}>
            <Button variant="outline" onClick={() => T.resetWorkspace()}>
              {t("desk.set.reset")}
            </Button>
          </OptRow>
          <OptRow label={t("desk.set.tourAgain")}>
            <Button variant="outline" onClick={() => (close(), T.setUi({ tour: true }))}>
              {t("desk.help.tour")}
            </Button>
          </OptRow>
        </OptSection>
        {!T.guest && (
          <OptSection title={t("trader.options.connection")}>
            <div className="flex items-center justify-between gap-3 py-1 text-[12.5px] text-fg-2">
              <span className="text-fg-3">{t("trader.account.connectedTo", { server: a.server })}</span>
              <span className="k-num font-mono">
                {a.login} · 1:{a.leverage}
              </span>
            </div>
          </OptSection>
        )}
      </div>
    </TDialog>
  );
}

function OptSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3.5">
      <div className="mb-2 text-[13px] font-semibold text-fg-2">{title}</div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function OptRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="text-[13.5px] text-fg">{label}</div>
        {hint && <div className="text-[12px] leading-[16px] text-fg-3">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function AboutDialog() {
  const T = useTerminal();
  const t = useT();
  return (
    <TDialog open={T.ui.about} onClose={() => T.setUi({ about: false })} width={420} icon={<Info />} title={t("order.about.title")}>
      <div className="space-y-3 p-6 text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-[14px] border border-line-top bg-surface-3">
          <LogoMark size={26} className="text-fg" />
        </div>
        <div>
          <div className="text-[17px] font-semibold">Ezymex Trader</div>
          <div className="font-mono text-[12px] text-fg-3">{t("order.about.version", { version: "5.1", build: 5200 })}</div>
        </div>
        <p className="text-[13px] leading-relaxed text-fg-2">{t("order.about.text")}</p>
        <div className="font-mono text-[11.5px] text-fg-3">© 2026 Ezymex Global Markets Ltd</div>
      </div>
    </TDialog>
  );
}
