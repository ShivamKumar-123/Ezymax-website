"use client";

// The + beside the chart tabs. It used to open a second chart of whatever was already on screen, so the only way to
// reach a market the trader had not opened before was the Instruments column. Now it opens the catalogue itself, the
// way the reference terminal does: search, an asset-class filter that starts on Favourites, then Symbol and
// Description with the star that keeps a market in that filter.
//
// The list is the same catalogue, scope and favourites as the Instruments column (instruments.tsx) - the same star
// here and there - and prices are deliberately absent: this is a list to choose a chart from, not one to trade from.
import * as React from "react";
import { Plus, Search, Star, X } from "lucide-react";
import { SymbolAvatar, cn } from "@ezymex/ui";
import { useT } from "@ezymex/i18n/react";
import { useTerminal } from "@/lib/store";
import { DropMenu } from "@/components/ui/menu";
import { EmptyState, IconButton } from "@/components/ui/kit";
import { TSelect } from "@/components/ui/primitives";
import { ORDER, classLabel, rank, useCatalogue } from "./instruments";

/** A popover is for choosing, not for browsing 1,400 rows: past this, the search box is the faster instrument. */
const MAX_ROWS = 120;

export function AddChartMenu() {
  const t = useT();
  return (
    <DropMenu
      width={440}
      trigger={({ toggle, open }) => (
        <IconButton label={t("desk.ch.newChart")} size="sm" onClick={toggle} aria-expanded={open} active={open || undefined}>
          <Plus />
        </IconButton>
      )}
    >
      {(close) => <Picker close={close} />}
    </DropMenu>
  );
}

function Picker({ close }: { close: () => void }) {
  const T = useTerminal();
  const t = useT();
  const all = useCatalogue();
  const favs = T.ws.favourites;
  const hidden = T.ws.hidden;
  const [q, setQ] = React.useState("");
  // Favourites first, as the reference does - unless there are none yet, when it would open on an empty list
  const [seg, setSeg] = React.useState<string>(() => (T.ws.favourites.length ? "favourites" : "all"));
  const [cursor, setCursor] = React.useState(0);
  const box = React.useRef<HTMLDivElement>(null);

  const base = React.useMemo(() => (hidden.length ? all.filter((i) => !hidden.includes(i.symbol)) : all), [all, hidden]);
  // the classes the catalogue actually has, in the house order, so a new one needs no code change here
  const classes = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const i of base) m.set(i.assetClass, (m.get(i.assetClass) ?? 0) + 1);
    return [...m.entries()].sort(([a], [b]) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b));
  }, [base]);

  const list = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    const inSeg = (i: { symbol: string; assetClass: string }) => seg === "all" || (seg === "favourites" ? favs.includes(i.symbol) : i.assetClass === seg);
    const out: { i: (typeof base)[number]; r: number; c: number }[] = [];
    for (const i of base) {
      if (!inSeg(i)) continue;
      const r = rank(i, needle);
      if (r < 0) continue;
      out.push({ i, r, c: ORDER.indexOf(i.assetClass) + 1 || 99 });
    }
    out.sort((a, b) => (needle ? a.r - b.r : 0) || a.c - b.c);
    return out.map((x) => x.i);
  }, [base, q, seg, favs]);

  React.useEffect(() => setCursor(0), [q, seg]);

  const shown = list.slice(0, MAX_ROWS);
  const open = (symbol: string) => {
    T.addTab(symbol);
    close();
  };
  const toggleFav = (symbol: string) => T.setWs((w) => ({ favourites: w.favourites.includes(symbol) ? w.favourites.filter((s) => s !== symbol) : [...w.favourites, symbol] }));

  // the search box drives the list: arrows move the cursor, Enter opens the market under it
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => {
        const n = Math.min(shown.length - 1, Math.max(0, c + (e.key === "ArrowDown" ? 1 : -1)));
        box.current?.querySelectorAll<HTMLElement>("[data-row]")[n]?.scrollIntoView({ block: "nearest" });
        return n;
      });
    } else if (e.key === "Enter" && shown[cursor]) {
      e.preventDefault();
      open(shown[cursor].symbol);
    }
  };

  return (
    <div className="flex max-h-[min(560px,70vh)] flex-col">
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-3">{t("desk.side.instruments")}</span>
      </div>

      <div className="flex items-center gap-2 px-3 pb-2">
        <span className="relative flex h-7 min-w-0 flex-1 items-center rounded-[7px] border border-line bg-panel-2 focus-within:border-ember/60">
          <Search className="pointer-events-none absolute start-2.5 size-3.5 text-fg-3" />
          {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t("desk.side.search")}
            aria-label={t("desk.side.search")}
            className="h-7 w-full min-w-0 bg-transparent ps-8 pe-7 text-[13px] text-fg outline-none placeholder:text-fg-3"
          />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label={t("market.clear")} className="absolute end-1 grid size-5 place-items-center rounded-[5px] text-fg-3 hover:bg-surface-3 hover:text-fg">
              <X className="size-3.5" />
            </button>
          )}
        </span>
        <TSelect
          ariaLabel={t("market.segmentAria")}
          value={seg}
          onChange={setSeg}
          className="w-[140px] shrink-0"
          options={[
            { value: "favourites", label: `${t("market.segment.favourites")} (${favs.length})` },
            { value: "all", label: t("common.all") },
            ...classes.map(([c]) => ({ value: c, label: classLabel(c, t) })),
          ]}
        />
      </div>

      <div className="flex items-center gap-2 border-b border-line px-3 pb-1.5 text-[11px] text-fg-3">
        <span className="w-[136px] shrink-0">{t("market.col.symbol")}</span>
        <span className="min-w-0 flex-1">{t("market.col.description")}</span>
        <span className="w-6 shrink-0" />
      </div>

      <div ref={box} className="t-scroll min-h-0 flex-1 overflow-y-auto py-1" role="listbox" aria-label={t("desk.side.instruments")}>
        {shown.length === 0 ? (
          <div className="px-3 py-6">
            {seg === "favourites" && !q ? (
              <EmptyState icon={<Star />} title={t("desk.mk.empty.fav")} text={t("desk.mk.empty.favText")} />
            ) : (
              <EmptyState icon={<Search />} title={t("desk.mk.empty.search", { q: q || "…" })} text={t("desk.mk.empty.searchText")} />
            )}
          </div>
        ) : (
          shown.map((i, n) => {
            const fav = favs.includes(i.symbol);
            return (
              <div
                key={i.symbol}
                data-row
                role="option"
                aria-selected={n === cursor}
                tabIndex={-1}
                onClick={() => open(i.symbol)}
                onMouseEnter={() => setCursor(n)}
                className={cn("flex h-9 cursor-pointer items-center gap-2 px-3 text-[13px]", n === cursor ? "bg-surface-3" : "hover:bg-surface-3/60")}
              >
                <span className="flex w-[136px] shrink-0 items-center gap-2">
                  <SymbolAvatar symbol={i.symbol} size={18} />
                  <span className="truncate font-semibold text-fg">{i.symbol}</span>
                </span>
                <span className="min-w-0 flex-1 truncate text-fg-2">{i.name}</span>
                <button
                  type="button"
                  onClick={(e) => (e.stopPropagation(), toggleFav(i.symbol))}
                  aria-pressed={fav}
                  aria-label={fav ? t("desk.mk.favRemove", { symbol: i.symbol }) : t("desk.mk.favAdd", { symbol: i.symbol })}
                  className={cn("grid size-6 shrink-0 place-items-center rounded-[6px] hover:bg-panel", fav ? "text-gold" : "text-fg-3 hover:text-fg")}
                >
                  <Star className={cn("size-3.5", fav && "fill-gold")} />
                </button>
              </div>
            );
          })
        )}
      </div>

      {list.length > shown.length && <div className="border-t border-line px-3 py-1.5 text-[11.5px] text-fg-3">{t("desk.mk.count", { shown: shown.length, total: list.length })}</div>}
    </div>
  );
}
