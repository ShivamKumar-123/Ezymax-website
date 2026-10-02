"use client";

// Underlying bar (picker with spot + ATM IV, cut countdown, view controls) and the expiry strip (daily / weekly /
// monthly expiries with days-to-expiry badges) of the options workspace.
import * as React from "react";
import { ChevronDown, LineChart, Search, Sigma, Wand2 } from "lucide-react";
import { INSTRUMENT_MAP } from "@kalks/mock";
import { OPTION_UNDERLYINGS } from "@kalks/mock/options";
import { PriceText, cn, useQuote } from "@kalks/ui";
import { useLocale, useT } from "@kalks/i18n/react";
import { DropMenu } from "@/components/ui/menu";
import { atmIndex } from "@/lib/options/math";
import { opt, underlyingOf, useOpt, type ChainView } from "@/lib/options-store";
import type { OptionExpiry, OptionUnderlying } from "@/lib/options/types";
import { Countdown, KindBadges, OptAvatar, Seg, StateBadge } from "./bits";
import { dte, expiryLabel, pct } from "./format";

/** Spot of an underlying: the CFD feed when the terminal lists it, else the chain's spot. */
export function SpotPrice({ symbol, className, fallback }: { symbol: string; className?: string; fallback?: number | null }) {
  if (!INSTRUMENT_MAP[symbol]) return <span className={cn("k-num font-mono", className)}>{fallback ? fallback.toFixed(5) : "—"}</span>;
  return <FeedPrice symbol={symbol} className={className} />;
}
function FeedPrice({ symbol, className }: { symbol: string; className?: string }) {
  const q = useQuote(symbol);
  return <PriceText symbol={symbol} value={(q.bid + q.ask) / 2 || q.bid} dir={q.dir} className={className} />;
}
function FeedChange({ symbol }: { symbol: string }) {
  const q = useQuote(symbol);
  if (!INSTRUMENT_MAP[symbol] || !q.bid) return null;
  return (
    <span dir="ltr" className={cn("k-num font-mono text-[10.5px]", q.change >= 0 ? "text-up" : "text-down")}>
      {q.change >= 0 ? "+" : ""}
      {q.change.toFixed(2)}%
    </span>
  );
}

function UnderlyingRow({ u, active, onPick }: { u: OptionUnderlying; active: boolean; onPick: () => void }) {
  return (
    <button onClick={onPick} className={cn("grid w-full grid-cols-[1fr_auto_52px] items-center gap-2 rounded-[6px] px-2 py-1.5 text-start transition-colors", active ? "bg-ember-soft/60" : "hover:bg-surface-3")}>
      <span className="flex min-w-0 items-center gap-2">
        <OptAvatar symbol={u.symbol} size={15} />
        <span className="min-w-0">
          <span className="block text-[12.5px] font-medium text-fg">{u.symbol}</span>
          <span className="block truncate text-[10.5px] text-fg-3">{u.name}</span>
        </span>
      </span>
      <span className="text-end">
        {INSTRUMENT_MAP[u.symbol] ? <FeedPrice symbol={u.symbol} className="text-[11.5px]" /> : <span className="font-mono text-[11px] text-fg-3">—</span>}
        <span className="block">
          <FeedChange symbol={u.symbol} />
        </span>
      </span>
      <span className="text-end font-mono text-[11px] text-fg-2" title="ATM IV">
        {pct(u.atmVol)}
      </span>
    </button>
  );
}

export function UnderlyingPicker({ compact }: { compact?: boolean }) {
  const t = useT();
  const list = useOpt((s) => s.underlyings);
  const u = useOpt((s) => s.u);
  const cur = useOpt((s) => underlyingOf(s));
  const [q, setQ] = React.useState("");
  const listed = new Set(list.map((x) => x.symbol));
  // every underlying of Kalks FX Options; the ones not open here yet show as "soon"
  const soon = OPTION_UNDERLYINGS.filter((x) => !listed.has(x.symbol));
  const match = (s: string, n: string) => !q || s.toLowerCase().includes(q.toLowerCase()) || n.toLowerCase().includes(q.toLowerCase());
  const groups: { key: string; label: string; items: OptionUnderlying[] }[] = [
    { key: "forex", label: t("trader.opt.class.forex"), items: list.filter((x) => x.assetClass === "forex" && match(x.symbol, x.name)) },
    { key: "metals", label: t("trader.opt.class.metals"), items: list.filter((x) => x.assetClass === "metals" && match(x.symbol, x.name)) },
    { key: "energies", label: t("trader.opt.class.energies"), items: list.filter((x) => x.assetClass === "energies" && match(x.symbol, x.name)) },
  ];
  return (
    <DropMenu
      width={340}
      trigger={({ toggle, open }) => (
        <button onClick={toggle} aria-label={t("trader.opt.pickUnderlying")} className={cn("flex h-8 shrink-0 items-center gap-2 rounded-[7px] border border-line bg-surface-2 ps-2 pe-1.5 text-start transition-colors hover:bg-surface-3", open && "bg-surface-3")}>
          <OptAvatar symbol={u} size={15} />
          <span className="leading-none">
            <span className="block text-[13px] font-semibold text-fg">{u}</span>
            {!compact && <span className="block max-w-[150px] truncate text-[10px] text-fg-3">{cur?.name ?? ""}</span>}
          </span>
          <ChevronDown className="size-3.5 text-fg-3" />
        </button>
      )}
    >
      {(close) => (
        <div className="max-h-[min(520px,70dvh)] overflow-y-auto p-1 t-scroll">
          <label className="mb-1 flex h-8 items-center gap-2 rounded-[6px] border border-line bg-surface-2 px-2">
            <Search className="size-3.5 text-fg-3" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("trader.opt.searchUnderlying")} className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-fg-3" />
          </label>
          <div className="grid grid-cols-[1fr_auto_52px] gap-2 px-2 pb-1 pt-0.5 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-fg-3">
            <span>{t("trader.opt.col.underlying")}</span>
            <span className="text-end">{t("trader.opt.spot")}</span>
            <span className="text-end">{t("trader.opt.atmIv")}</span>
          </div>
          {groups.map((g) =>
            g.items.length ? (
              <div key={g.key} className="mb-1">
                <div className="px-2 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-fg-3">{g.label}</div>
                {g.items.map((x) => (
                  <UnderlyingRow key={x.symbol} u={x} active={x.symbol === u} onPick={() => (opt.selectUnderlying(x.symbol), close())} />
                ))}
              </div>
            ) : null,
          )}
          {soon.filter((x) => match(x.symbol, x.name)).length > 0 && (
            <div className="mb-1">
              <div className="px-2 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-fg-3">{t("trader.opt.comingSoon")}</div>
              {soon
                .filter((x) => match(x.symbol, x.name))
                .map((x) => (
                  <div key={x.symbol} className="flex items-center gap-2 px-2 py-1.5 opacity-55">
                    <OptAvatar symbol={x.symbol} size={15} />
                    <span className="text-[12.5px] font-medium">{x.symbol}</span>
                    <span className="truncate text-[10.5px] text-fg-3">{x.name}</span>
                    <span className="ms-auto rounded-[4px] bg-surface-3 px-1.5 text-[9.5px] font-semibold uppercase tracking-[0.05em] text-fg-3">{t("trader.opt.soonBadge")}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </DropMenu>
  );
}

function Stat({ label, children, title }: { label: string; children: React.ReactNode; title?: string }) {
  return (
    <span className="flex shrink-0 flex-col justify-center leading-none" title={title}>
      <span className="text-[9.5px] font-medium uppercase tracking-[0.07em] text-fg-3">{label}</span>
      <span className="mt-1 font-mono text-[12px] text-fg">{children}</span>
    </span>
  );
}

export function UnderlyingBar() {
  const t = useT();
  const u = useOpt((s) => s.u);
  const cur = useOpt((s) => underlyingOf(s));
  const chain = useOpt((s) => s.chain);
  const prefs = useOpt((s) => s.prefs);
  const publicView = useOpt((s) => s.publicView);
  const atmRow = chain?.rows.length ? chain.rows[atmIndex(chain)] : undefined;
  const atmIv = atmRow?.call?.iv ?? cur?.atmVol ?? null;
  const cutAt = chain ? Date.parse(chain.cutAt) : null;
  return (
    <div className="flex h-11 shrink-0 items-center gap-3 overflow-x-auto rounded-[8px] border border-line bg-panel px-2 [scrollbar-width:none]">
      <UnderlyingPicker />
      <span className="flex shrink-0 flex-col justify-center leading-none">
        <span className="text-[9.5px] font-medium uppercase tracking-[0.07em] text-fg-3">{t("trader.opt.spot")}</span>
        <span className="mt-0.5 flex items-baseline gap-1.5">
          <SpotPrice symbol={u} className="text-[14px]" fallback={chain?.spot?.mid} />
          <FeedChange symbol={u} />
        </span>
      </span>
      <span className="h-6 w-px shrink-0 bg-line" />
      <Stat label={t("trader.opt.atmIv")} title={t("trader.opt.atmIvHint")}>
        {pct(atmIv)}
      </Stat>
      {cur?.realizedVol !== undefined && cur?.realizedVol !== null && (
        <Stat label={t("trader.opt.rv")} title={t("trader.opt.rvHint")}>
          {pct(cur.realizedVol)}
        </Stat>
      )}
      {chain && (
        <Stat label={t("trader.opt.contract")}>
          {chain.contractSize.toLocaleString("en-US")} <span className="font-sans text-[10.5px] text-fg-3">{chain.contractUnit}</span>
        </Stat>
      )}
      {cutAt && (
        <Stat label={t("trader.opt.cutIn")} title={t("trader.opt.cutHint", { time: chain?.cut.time ?? "10:00" })}>
          <Countdown to={cutAt} />
        </Stat>
      )}
      {chain && <StateBadge state={chain.state} />}
      <div className="ms-auto flex shrink-0 items-center gap-1.5">
        <Seg<ChainView>
          size="sm"
          className="w-[168px]"
          value={prefs.view}
          onChange={(v) => opt.setPrefs({ view: v })}
          options={[
            { value: "calls", label: t("trader.opt.calls") },
            { value: "both", label: t("trader.opt.both") },
            { value: "puts", label: t("trader.opt.puts") },
          ]}
        />
        <button onClick={() => opt.setPrefs({ greeks: !prefs.greeks })} aria-pressed={prefs.greeks} title={t("trader.opt.greeksToggle")} className={cn("flex h-7 items-center gap-1 rounded-[6px] border px-2 text-[11px] font-medium transition-colors", prefs.greeks ? "border-ember/40 bg-ember-soft text-ember" : "border-line text-fg-3 hover:text-fg-2")}>
          <Sigma className="size-3.5" /> {t("trader.opt.greeks")}
        </button>
        <button onClick={() => opt.setPrefs({ chart: !prefs.chart })} aria-pressed={prefs.chart} title={t("trader.opt.chartToggle")} className={cn("hidden h-7 items-center gap-1 rounded-[6px] border px-2 text-[11px] font-medium transition-colors lg:flex", prefs.chart ? "border-ember/40 bg-ember-soft text-ember" : "border-line text-fg-3 hover:text-fg-2")}>
          <LineChart className="size-3.5" /> {t("trader.opt.chart")}
        </button>
        {!publicView && (
          <button onClick={() => opt.openBuilder(true)} className="flex h-7 items-center gap-1.5 rounded-[6px] bg-ember px-2.5 text-[11.5px] font-semibold text-white shadow-[0_6px_18px_-10px_rgba(255,90,31,0.9)] transition hover:brightness-110">
            <Wand2 className="size-3.5" /> {t("trader.opt.builder.open")}
          </button>
        )}
      </div>
    </div>
  );
}

function ExpiryChip({ e, active, locale }: { e: OptionExpiry; active: boolean; locale: string }) {
  const t = useT();
  const days = dte(e);
  const hours = (Date.parse(e.cutAt) - Date.now()) / 3_600_000;
  return (
    <button
      onClick={() => opt.selectExpiry(e.date)}
      aria-pressed={active}
      title={t("trader.opt.expiryTitle", { date: e.date, time: new Date(e.cutAt).toISOString().slice(11, 16) })}
      className={cn("relative flex h-[30px] shrink-0 items-center gap-1.5 rounded-[6px] border px-2 text-[11.5px] transition-colors", active ? "border-ember/50 bg-ember-soft text-fg" : "border-line bg-surface-2/60 text-fg-2 hover:border-fg-3/40 hover:text-fg")}
    >
      <span className="font-medium">{expiryLabel(e.date, locale)}</span>
      <span className={cn("k-num rounded-[4px] px-1 font-mono text-[10px]", days === 0 ? "bg-warn-soft text-warn" : active ? "bg-ember/15 text-ember" : "bg-surface-3 text-fg-3")}>{days === 0 ? (hours > 0 ? `${Math.max(1, Math.round(hours))}h` : "0D") : `${days}D`}</span>
      <KindBadges kinds={e.kinds} />
      {e.state !== "open" && <span className={cn("size-1.5 rounded-full", e.state === "halted" ? "bg-down" : "bg-warn")} />}
    </button>
  );
}

export function ExpiryStrip({ className }: { className?: string }) {
  const t = useT();
  const { locale } = useLocale();
  const list = useOpt((s) => s.expiries);
  const expiry = useOpt((s) => s.expiry);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    ref.current?.querySelector<HTMLElement>("[aria-pressed=true]")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [expiry]);
  return (
    <div className={cn("flex h-10 shrink-0 items-center gap-2 rounded-[8px] border border-line bg-panel ps-2.5 pe-1", className)}>
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.09em] text-fg-3">{t("trader.opt.expiries")}</span>
      <div ref={ref} className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none]">
        {list.map((e) => (
          <ExpiryChip key={e.date} e={e} active={e.date === expiry} locale={locale} />
        ))}
        {!list.length && <span className="text-[11.5px] text-fg-3">{t("trader.opt.loadingExpiries")}</span>}
      </div>
      <span className="hidden shrink-0 items-center gap-2 pe-1.5 text-[10px] text-fg-3 xl:flex">
        <KindBadges kinds={["daily"]} /> {t("trader.opt.kind.daily")}
        <KindBadges kinds={["weekly"]} /> {t("trader.opt.kind.weekly")}
        <KindBadges kinds={["monthly"]} /> {t("trader.opt.kind.monthly")}
      </span>
    </div>
  );
}
