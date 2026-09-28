"use client";

import * as React from "react";
import { toast } from "sonner";
import { Eye, EyeOff, FileStack, Plus, Search, Settings2, SlidersHorizontal, Spline, Star, Trash2, X } from "lucide-react";
import { cn } from "@kalks/ui";
import { useTerminal } from "@/lib/store";
import {
  COLOR_TOKENS,
  INDICATOR_CATEGORIES,
  INDICATOR_DEFS,
  INDICATOR_LIST,
  SOURCES,
  SOURCE_LABEL,
  indicatorLabel,
  normalizeParams,
  validateParam,
  type IndicatorCategory,
  type IndicatorDef,
  type IndicatorInstance,
  type OutputStyle,
  type ParamDef,
} from "@/lib/indicators";
import { Kbd } from "@/components/dialogs/kbd";
import { Check, MiniSwitch, Stepper, TButton, TDialog, TInput, TSelect } from "@/components/ui/primitives";
import {
  addIndicator,
  closeIndUi,
  openIndicatorSettings,
  patchIndicator,
  removeIndicator,
  saveTemplate,
  templateExists,
  toggleFavourite,
  toggleIndicator,
  useIndUi,
  useIndicatorFavourites,
} from "./state";

/** CSS for a colour token or literal (so swatches follow the theme). */
const TOKEN_VAR: Record<string, string> = { ember: "var(--k-ember)", gold: "var(--k-gold)", up: "var(--k-up)", down: "var(--k-down)", warn: "var(--k-warn)", info: "var(--k-info)", fg: "var(--k-fg)", fg2: "var(--k-fg-2)", fg3: "var(--k-fg-3)" };
export const cssColor = (c: string) => TOKEN_VAR[c] ?? c;

function toHex(c: string): string {
  if (/^#[0-9a-f]{6}$/i.test(c)) return c;
  if (typeof document === "undefined") return "#e9b949";
  const v = TOKEN_VAR[c] ? getComputedStyle(document.documentElement).getPropertyValue(TOKEN_VAR[c]!.slice(4, -1)).trim() : c;
  if (/^#[0-9a-f]{6}$/i.test(v)) return v;
  if (/^#[0-9a-f]{3}$/i.test(v)) return `#${[...v.slice(1)].map((x) => x + x).join("")}`;
  const m = v.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  return m ? `#${[m[1], m[2], m[3]].map((x) => Number(x).toString(16).padStart(2, "0")).join("")}` : "#e9b949";
}

const paneLabel = (d: IndicatorDef) => (d.pane === "overlay" ? "Overlay" : "Sub-window");

/** Mounted once by the terminal shell. */
export function IndicatorDialogs() {
  return (
    <>
      <IndicatorsDialog />
      <IndicatorSettingsDialog />
      <SaveTemplateDialog />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Indicators browser                                                  */
/* ------------------------------------------------------------------ */

type View = "all" | "fav" | "chart" | IndicatorCategory;

function IndicatorsDialog() {
  const T = useTerminal();
  const s = useIndUi();
  const favs = useIndicatorFavourites();
  const tab = T.ws.tabs.find((t) => t.id === s.list) ?? null;
  const [q, setQ] = React.useState("");
  const [view, setView] = React.useState<View>("all");
  const [idx, setIdx] = React.useState(0);
  const input = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const open = !!tab;
  const close = React.useCallback(() => closeIndUi("list"), []);

  React.useEffect(() => {
    if (!open) return;
    setQ("");
    setIdx(0);
    setTimeout(() => input.current?.focus(), 20);
  }, [open]);

  if (!tab) return null;
  const needle = q.trim().toLowerCase();
  const list =
    view === "chart"
      ? []
      : INDICATOR_LIST.filter((d) => {
          if (view === "fav" && !favs.includes(d.type)) return false;
          if (view !== "all" && view !== "fav" && d.category !== view) return false;
          if (!needle) return true;
          return d.name.toLowerCase().includes(needle) || d.short.toLowerCase().includes(needle) || d.type.includes(needle) || d.category.toLowerCase().includes(needle);
        });
  const cur = list[Math.min(idx, list.length - 1)];
  const counts = new Map<string, number>();
  for (const i of tab.indicators) counts.set(i.type, (counts.get(i.type) ?? 0) + 1);

  const onKey = (e: React.KeyboardEvent) => {
    if (view === "chart") return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIdx((i) => Math.min(list.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" && cur && (e.target as HTMLElement).tagName === "INPUT") {
      e.preventDefault();
      addIndicator(T, tab.id, cur.type, { configure: e.shiftKey });
      if (e.shiftKey) close();
    }
  };

  const nav: { id: View; label: string; n: number }[] = [
    { id: "all", label: "All indicators", n: INDICATOR_LIST.length },
    { id: "fav", label: "Favourites", n: favs.length },
    ...INDICATOR_CATEGORIES.map((c) => ({ id: c as View, label: c, n: INDICATOR_LIST.filter((d) => d.category === c).length })),
  ];

  return (
    <TDialog
      open
      onClose={close}
      width={760}
      icon={<Spline />}
      title="Indicators"
      subtitle={`${tab.symbol}, ${tab.tf}`}
      footer={
        <>
          <div className="mr-auto hidden items-center gap-3 text-[10.5px] text-fg-3 sm:flex">
            <span className="flex items-center gap-1">
              <Kbd>↑↓</Kbd> navigate
            </span>
            <span className="flex items-center gap-1">
              <Kbd>↵</Kbd> add
            </span>
            <span className="flex items-center gap-1">
              <Kbd>⇧ ↵</Kbd> add &amp; configure
            </span>
          </div>
          {tab.indicators.length > 0 && (
            <TButton
              variant="ghost"
              className="text-down hover:text-down"
              onClick={() => {
                const n = tab.indicators.length;
                T.updateTab(tab.id, { indicators: [] });
                toast(`Removed ${n} indicator${n > 1 ? "s" : ""}`, { description: `${tab.symbol}, ${tab.tf}` });
              }}
            >
              <Trash2 /> Remove all
            </TButton>
          )}
          <TButton variant="ember" onClick={close}>
            Done
          </TButton>
        </>
      }
    >
      <div className="flex h-[min(520px,70dvh)] min-h-0" onKeyDown={onKey}>
        <nav className="hidden w-[176px] shrink-0 flex-col gap-0.5 border-r border-line bg-panel-2/60 p-1.5 sm:flex" aria-label="Indicator categories">
          {nav.map((n) => (
            <NavBtn key={n.id} on={view === n.id} onClick={() => (setView(n.id), setIdx(0))} label={n.label} n={n.n} star={n.id === "fav"} />
          ))}
          <div className="mx-1 my-1.5 h-px bg-line" />
          <NavBtn on={view === "chart"} onClick={() => setView("chart")} label="On this chart" n={tab.indicators.length} />
        </nav>
        <div className="flex min-w-0 flex-1 flex-col">
          {view !== "chart" && (
            <div className="flex h-10 shrink-0 items-center gap-2 border-b border-line px-3">
              <Search className="size-3.5 text-fg-3" />
              <input
                ref={input}
                value={q}
                onChange={(e) => (setQ(e.target.value), setIdx(0))}
                placeholder="Search 35 indicators: RSI, bands, volume…"
                aria-label="Search indicators"
                aria-controls="ind-list"
                aria-activedescendant={cur ? `ind-opt-${cur.type}` : undefined}
                className="h-full min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-fg-3"
              />
              <select
                aria-label="Category"
                value={view}
                onChange={(e) => (setView(e.target.value as View), setIdx(0))}
                className="t-select h-6 rounded-[5px] border border-line bg-surface-2 pl-1.5 pr-5 text-[11px] text-fg-2 sm:hidden"
              >
                {nav.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.label}
                  </option>
                ))}
                <option value="chart">On this chart</option>
              </select>
            </div>
          )}
          {view === "chart" ? (
            <OnChart tabId={tab.id} list={tab.indicators} />
          ) : (
            <>
              <div ref={listRef} id="ind-list" role="listbox" aria-label="Indicators" className="t-scroll min-h-0 flex-1 overflow-y-auto p-1">
                {list.map((d, n) => (
                  <IndRow
                    key={d.type}
                    def={d}
                    active={n === idx}
                    fav={favs.includes(d.type)}
                    count={counts.get(d.type) ?? 0}
                    showCat={view === "all" || view === "fav"}
                    onHover={() => setIdx(n)}
                    onAdd={(configure) => {
                      addIndicator(T, tab.id, d.type, { configure });
                      if (configure) close();
                    }}
                  />
                ))}
                {!list.length && (
                  <div className="p-8 text-center text-[12.5px] text-fg-3">{view === "fav" && !needle ? "No favourites yet. Star an indicator to pin it here." : `No indicators match “${q}”`}</div>
                )}
              </div>
              {cur && (
                <div className="shrink-0 border-t border-line bg-panel-2/60 px-3 py-2 text-[11.5px] leading-snug text-fg-3">
                  <span className="font-medium text-fg-2">{cur.name}</span> · {cur.description}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </TDialog>
  );
}

function NavBtn({ on, onClick, label, n, star }: { on: boolean; onClick: () => void; label: string; n: number; star?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={cn("flex h-7 items-center gap-1.5 rounded-[5px] px-2 text-left text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-ember/40", on ? "bg-ember-soft text-ember" : "text-fg-2 hover:bg-surface-3 hover:text-fg")}
    >
      {star && <Star className={cn("size-3", on ? "fill-ember" : "fill-gold text-gold")} />}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="k-num font-mono text-[10px] text-fg-3">{n}</span>
    </button>
  );
}

function IndRow({ def, active, fav, count, showCat, onHover, onAdd }: { def: IndicatorDef; active: boolean; fav: boolean; count: number; showCat: boolean; onHover: () => void; onAdd: (configure: boolean) => void }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: "nearest" });
  }, [active]);
  return (
    <div
      ref={ref}
      id={`ind-opt-${def.type}`}
      role="option"
      aria-selected={active}
      onMouseMove={onHover}
      onClick={(e) => onAdd(e.shiftKey)}
      className={cn("group flex h-8 cursor-default items-center gap-2 rounded-[6px] px-2", active ? "bg-surface-3" : "hover:bg-surface-2")}
    >
      <button
        aria-label={fav ? `Remove ${def.name} from favourites` : `Add ${def.name} to favourites`}
        title={fav ? "Remove from favourites" : "Add to favourites"}
        onClick={(e) => {
          e.stopPropagation();
          toggleFavourite(def.type);
        }}
        className="grid size-5 shrink-0 place-items-center rounded-[4px] text-fg-3 outline-none hover:text-gold focus-visible:ring-2 focus-visible:ring-ember/40"
      >
        <Star className={cn("size-3.5", fav && "fill-gold text-gold")} />
      </button>
      <span className="min-w-0 flex-1 truncate text-[12.5px] text-fg">
        {def.name}
        <span className="ml-2 font-mono text-[10.5px] text-fg-3">{def.short}</span>
      </span>
      {count > 0 && <span className="k-num rounded-[3px] bg-ember-soft px-1 font-mono text-[10px] text-ember">{count} on chart</span>}
      {showCat && <span className="hidden w-[84px] shrink-0 text-right text-[10.5px] text-fg-3 md:inline">{def.category}</span>}
      <span className="w-[62px] shrink-0 text-right text-[10.5px] text-fg-3">{paneLabel(def)}</span>
      <button
        aria-label={`Add ${def.name} and configure`}
        title="Add and configure (Shift+Enter)"
        onClick={(e) => {
          e.stopPropagation();
          onAdd(true);
        }}
        className={cn("grid size-6 shrink-0 place-items-center rounded-[5px] text-fg-3 outline-none hover:bg-surface-2 hover:text-fg focus-visible:ring-2 focus-visible:ring-ember/40", active ? "opacity-100" : "opacity-0 focus-visible:opacity-100 group-hover:opacity-100")}
      >
        <Settings2 className="size-3.5" />
      </button>
      <Plus className={cn("size-3.5 shrink-0", active ? "text-ember" : "text-fg-3/60")} />
    </div>
  );
}

function OnChart({ tabId, list }: { tabId: string; list: IndicatorInstance[] }) {
  const T = useTerminal();
  if (!list.length)
    return (
      <div className="grid flex-1 place-items-center p-8 text-center">
        <div>
          <SlidersHorizontal className="mx-auto mb-2 size-5 text-fg-3" />
          <div className="text-[12.5px] text-fg-2">No indicators on this chart</div>
          <div className="mt-0.5 text-[11.5px] text-fg-3">Pick one from the categories on the left.</div>
        </div>
      </div>
    );
  return (
    <div className="t-scroll min-h-0 flex-1 overflow-y-auto p-1">
      {list.map((inst) => {
        const def = INDICATOR_DEFS[inst.type];
        const col = inst.style?.[def.outputs[0]!.key]?.color ?? def.outputs[0]!.color;
        return (
          <div key={inst.uid} className="group flex h-8 items-center gap-2 rounded-[6px] px-2 hover:bg-surface-2">
            <span className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: cssColor(col) }} />
            <span className={cn("min-w-0 flex-1 truncate font-mono text-[12px]", inst.visible ? "text-fg" : "text-fg-3")}>{indicatorLabel(inst.type, normalizeParams(inst.type, inst.params))}</span>
            <span className="w-[62px] text-right text-[10.5px] text-fg-3">{paneLabel(def)}</span>
            <RowIcon label={inst.visible ? "Hide" : "Show"} onClick={() => toggleIndicator(T, tabId, inst)}>
              {inst.visible ? <Eye /> : <EyeOff />}
            </RowIcon>
            <RowIcon label="Settings" onClick={() => (closeIndUi("list"), openIndicatorSettings(tabId, inst.uid))}>
              <Settings2 />
            </RowIcon>
            <RowIcon label="Remove" danger onClick={() => removeIndicator(T, tabId, inst.uid)}>
              <X />
            </RowIcon>
          </div>
        );
      })}
    </div>
  );
}

function RowIcon({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button aria-label={label} title={label} onClick={onClick} className={cn("grid size-6 place-items-center rounded-[5px] text-fg-3 outline-none focus-visible:ring-2 focus-visible:ring-ember/40 [&_svg]:size-3.5", danger ? "hover:bg-down-soft hover:text-down" : "hover:bg-surface-3 hover:text-fg")}>
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Instance settings                                                   */
/* ------------------------------------------------------------------ */

type Draft = { params: Record<string, string>; style: Record<string, OutputStyle>; levels: string[]; visible: boolean };

const draftOf = (inst: IndicatorInstance, def: IndicatorDef): Draft => ({
  params: Object.fromEntries(def.params.map((p) => [p.key, String(inst.params[p.key] ?? p.def)])),
  style: Object.fromEntries(def.outputs.map((o) => [o.key, { ...inst.style?.[o.key] }])),
  levels: (inst.levels ?? def.levels?.(normalizeParams(inst.type, inst.params)) ?? []).map(String),
  visible: inst.visible,
});

function IndicatorSettingsDialog() {
  const T = useTerminal();
  const s = useIndUi();
  const tab = s.settings ? T.ws.tabs.find((t) => t.id === s.settings!.tabId) : undefined;
  const inst = tab?.indicators.find((x) => x.uid === s.settings?.uid);
  const close = React.useCallback(() => closeIndUi("settings"), []);
  if (!tab || !inst) return null;
  return <SettingsBody key={inst.uid} tabId={tab.id} title={`${tab.symbol}, ${tab.tf}`} inst={inst} onClose={close} />;
}

function SettingsBody({ tabId, title, inst, onClose }: { tabId: string; title: string; inst: IndicatorInstance; onClose: () => void }) {
  const T = useTerminal();
  const def = INDICATOR_DEFS[inst.type];
  const [d, setD] = React.useState<Draft>(() => draftOf(inst, def));
  const hasLevels = def.pane === "separate";
  const [pane, setPane] = React.useState<"inputs" | "style" | "levels">(def.params.length ? "inputs" : "style");
  const errors = def.params.map((p) => [p.key, validateParam(p, d.params[p.key])] as const).filter(([, e]) => e);
  const levelErr = d.levels.some((l) => l.trim() === "" || !Number.isFinite(Number(l)));
  const ok = !errors.length && !levelErr;

  const commit = () => {
    if (!ok) return;
    const params = normalizeParams(inst.type, d.params);
    const style: Record<string, OutputStyle> = {};
    for (const [k, v] of Object.entries(d.style)) {
      const clean: OutputStyle = {};
      if (v.color) clean.color = v.color;
      if (v.width) clean.width = v.width;
      if (v.visible === false) clean.visible = false;
      if (Object.keys(clean).length) style[k] = clean;
    }
    const lv = d.levels.map(Number);
    const defLv = def.levels?.(params) ?? [];
    const levels = hasLevels && JSON.stringify(lv) !== JSON.stringify(defLv) ? lv : undefined;
    T.updateTab(tabId, (t) => ({
      indicators: t.indicators.map((x) => {
        if (x.uid !== inst.uid) return x;
        const next: IndicatorInstance = { uid: x.uid, type: x.type, params, visible: d.visible };
        if (Object.keys(style).length) next.style = style;
        if (levels) next.levels = levels;
        return next;
      }),
    }));
    toast.success(`${indicatorLabel(inst.type, params)} updated`, { description: title });
    onClose();
  };

  const reset = () => setD({ params: Object.fromEntries(def.params.map((p) => [p.key, String(p.def)])), style: Object.fromEntries(def.outputs.map((o) => [o.key, {}])), levels: (def.levels?.(normalizeParams(inst.type, {})) ?? []).map(String), visible: true });
  const setStyle = (k: string, patch: OutputStyle) => setD((x) => ({ ...x, style: { ...x.style, [k]: { ...x.style[k], ...patch } } }));

  const tabs: { id: typeof pane; label: string }[] = [...(def.params.length ? [{ id: "inputs" as const, label: "Inputs" }] : []), { id: "style", label: "Style" }, ...(hasLevels ? [{ id: "levels" as const, label: "Levels" }] : [])];

  return (
    <TDialog
      open
      onClose={onClose}
      width={480}
      icon={<Settings2 />}
      title={def.name}
      subtitle={title}
      footer={
        <>
          <TButton variant="ghost" className="mr-auto text-down hover:text-down" onClick={() => (removeIndicator(T, tabId, inst.uid), onClose())}>
            <Trash2 /> Remove
          </TButton>
          <TButton variant="ghost" onClick={reset}>
            Defaults
          </TButton>
          <TButton variant="surface" onClick={onClose}>
            Cancel
          </TButton>
          <TButton variant="ember" onClick={commit} disabled={!ok}>
            OK
          </TButton>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          commit();
        }}
      >
        <div role="tablist" className="flex h-9 items-stretch gap-3 border-b border-line px-3.5">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={pane === t.id}
              onClick={() => setPane(t.id)}
              className={cn("relative text-[12px] outline-none focus-visible:text-fg", pane === t.id ? "text-fg" : "text-fg-3 hover:text-fg-2")}
            >
              {t.label}
              {pane === t.id && <span className="absolute inset-x-0 bottom-[-1px] h-[2px] bg-ember" />}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-2 text-[11.5px] text-fg-3">
            Visible
            <MiniSwitch checked={d.visible} onChange={(v) => setD((x) => ({ ...x, visible: v }))} label="Visible on chart" />
          </label>
        </div>

        <div className="min-h-[180px] p-3.5">
          {pane === "inputs" && (
            <div className="grid grid-cols-[1fr_180px] items-center gap-x-3 gap-y-2">
              {def.params.map((p) => (
                <ParamField key={p.key} p={p} value={d.params[p.key] ?? ""} error={errors.find(([k]) => k === p.key)?.[1] ?? null} onChange={(v) => setD((x) => ({ ...x, params: { ...x.params, [p.key]: v } }))} />
              ))}
            </div>
          )}

          {pane === "style" && (
            <div className="space-y-2">
              {def.outputs.map((o) => {
                const st = d.style[o.key] ?? {};
                const color = st.color ?? o.color;
                return (
                  <div key={o.key} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[6px] border border-line bg-surface-2/50 px-2.5 py-2">
                    <Check checked={st.visible !== false} onChange={(v) => setStyle(o.key, { visible: v })} label={<span className="inline-block w-[74px] truncate text-fg">{o.label}</span>} />
                    <div className="flex items-center gap-1" role="radiogroup" aria-label={`${o.label} colour`}>
                      {COLOR_TOKENS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          role="radio"
                          aria-checked={color === c}
                          aria-label={c}
                          title={c}
                          onClick={() => setStyle(o.key, { color: c })}
                          className={cn("size-4 rounded-[3px] outline-none ring-offset-1 ring-offset-panel focus-visible:ring-2 focus-visible:ring-ember/60", color === c && "ring-2 ring-fg/70")}
                          style={{ background: cssColor(c) }}
                        />
                      ))}
                      <label className={cn("relative size-4 cursor-pointer overflow-hidden rounded-[3px] border border-line", !TOKEN_VAR[color] && "ring-2 ring-fg/70 ring-offset-1 ring-offset-panel")} title="Custom colour" style={{ background: TOKEN_VAR[color] ? "conic-gradient(var(--k-down),var(--k-gold),var(--k-up),var(--k-info),var(--k-down))" : color }}>
                        <input type="color" aria-label={`${o.label} custom colour`} value={toHex(color)} onChange={(e) => setStyle(o.key, { color: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" />
                      </label>
                    </div>
                    {o.kind !== "hist" && o.kind !== "markers" && (
                      <div className="ml-auto w-[92px]">
                        <TSelect
                          ariaLabel={`${o.label} ${o.kind === "dots" ? "size" : "width"}`}
                          value={String(st.width ?? o.width ?? 1) as "1" | "2" | "3" | "4"}
                          onChange={(v) => setStyle(o.key, { width: Number(v) })}
                          options={(["1", "2", "3", "4"] as const).map((w) => ({ value: w, label: `${o.kind === "dots" ? "Size" : "Width"} ${w}` }))}
                        />
                      </div>
                    )}
                    {o.kind === "hist" && <span className="ml-auto text-[10.5px] text-fg-3">{o.histColor === "sign" ? "Up/down by sign" : o.histColor === "trend" ? "Up/down vs previous bar" : "Histogram"}</span>}
                  </div>
                );
              })}
            </div>
          )}

          {pane === "levels" && (
            <div className="space-y-1.5">
              {d.levels.map((l, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-14 text-[11.5px] text-fg-3">Level {i + 1}</span>
                  <TInput
                    aria-label={`Level ${i + 1}`}
                    inputMode="decimal"
                    value={l}
                    onChange={(e) => setD((x) => ({ ...x, levels: x.levels.map((y, k) => (k === i ? e.target.value.replace(/[^0-9.\-]/g, "") : y)) }))}
                    className={cn("k-num w-32 font-mono", (l.trim() === "" || !Number.isFinite(Number(l))) && "border-down/70")}
                  />
                  <button type="button" aria-label={`Remove level ${i + 1}`} onClick={() => setD((x) => ({ ...x, levels: x.levels.filter((_, k) => k !== i) }))} className="grid size-6 place-items-center rounded-[5px] text-fg-3 hover:bg-down-soft hover:text-down">
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
              {!d.levels.length && <div className="py-2 text-[11.5px] text-fg-3">No horizontal levels.</div>}
              <TButton type="button" size="xs" variant="surface" onClick={() => setD((x) => ({ ...x, levels: [...x.levels, "0"] }))} disabled={d.levels.length >= 8}>
                <Plus /> Add level
              </TButton>
            </div>
          )}
        </div>
        {(errors.length > 0 || levelErr) && (
          <div className="border-t border-line bg-down-soft px-3.5 py-1.5 text-[11.5px] text-down" role="alert">
            {errors.length ? errors[0]![1] : "Levels must be numbers"}
          </div>
        )}
        <button type="submit" hidden />
      </form>
    </TDialog>
  );
}

function ParamField({ p, value, error, onChange }: { p: ParamDef; value: string; error: string | null; onChange: (v: string) => void }) {
  return (
    <>
      <label className="text-[12px] text-fg-2" htmlFor={`ip-${p.key}`}>
        {p.label}
        {(p.kind === "int" || p.kind === "float") && (
          <span className="ml-1.5 font-mono text-[10px] text-fg-3">
            {p.min}–{p.max}
          </span>
        )}
      </label>
      {p.kind === "int" || p.kind === "float" ? (
        <Stepper value={value} onChange={onChange} step={p.kind === "int" ? 1 : p.step} min={p.min} ariaLabel={p.label} decimals={p.kind === "int" ? 0 : undefined} className={cn(error && "border-down/70")} />
      ) : p.kind === "source" ? (
        <TSelect ariaLabel={p.label} value={value} onChange={onChange} options={SOURCES.map((s) => ({ value: s, label: SOURCE_LABEL[s] }))} />
      ) : (
        <TSelect ariaLabel={p.label} value={value} onChange={onChange} options={p.options} />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Save template                                                       */
/* ------------------------------------------------------------------ */

function SaveTemplateDialog() {
  const T = useTerminal();
  const s = useIndUi();
  const tab = T.ws.tabs.find((t) => t.id === s.saveTemplate) ?? null;
  const [name, setName] = React.useState("");
  const ref = React.useRef<HTMLInputElement>(null);
  const close = React.useCallback(() => closeIndUi("saveTemplate"), []);
  React.useEffect(() => {
    if (!tab) return;
    setName(`${tab.symbol} ${tab.tf}`);
    setTimeout(() => ref.current?.select(), 20);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab?.id]);
  if (!tab) return null;
  const valid = name.trim().length > 0 && name.trim().length <= 48;
  const save = () => {
    if (!valid) return;
    saveTemplate(name, tab);
    close();
  };
  return (
    <TDialog
      open
      onClose={close}
      width={420}
      icon={<FileStack />}
      title="Save template"
      subtitle={`${tab.symbol}, ${tab.tf}`}
      footer={
        <>
          <TButton variant="surface" onClick={close}>
            Cancel
          </TButton>
          <TButton variant="ember" onClick={save} disabled={!valid}>
            {templateExists(name) ? "Replace" : "Save"}
          </TButton>
        </>
      }
    >
      <form
        className="space-y-3 p-3.5"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <label className="block space-y-1">
          <span className="text-[11.5px] text-fg-3">Template name</span>
          <input ref={ref} value={name} maxLength={48} onChange={(e) => setName(e.target.value)} aria-label="Template name" className="h-7 w-full min-w-0 rounded-[6px] border border-line bg-surface-2 px-2 text-[12px] text-fg outline-none transition-colors placeholder:text-fg-3 focus:border-ember/60" />
        </label>
        {templateExists(name) && <div className="text-[11.5px] text-warn">A template with this name exists and will be replaced.</div>}
        <div>
          <div className="mb-1 text-[11.5px] text-fg-3">
            Saves the chart type ({tab.type}) and {tab.indicators.length} indicator{tab.indicators.length === 1 ? "" : "s"} with their settings
          </div>
          <div className="flex flex-wrap gap-1">
            {tab.indicators.map((i) => (
              <span key={i.uid} className="rounded-[4px] border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[10.5px] text-fg-2">
                {indicatorLabel(i.type, normalizeParams(i.type, i.params))}
              </span>
            ))}
          </div>
        </div>
      </form>
    </TDialog>
  );
}

export { patchIndicator };
