"use client";

// Expiry selection of the options workspace: three tabs, Daily | Weekly | Monthly, each showing the nearest listed
// expiry of that kind (date + countdown to its cut; after the cut the store rolls it to the next date on its own),
// plus a picker of every listed expiry of the underlying grouped by kind, to choose any other date.
import * as React from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { cn } from "@kalks/ui";
import { useLocale, useT } from "@kalks/i18n/react";
import { DropMenu } from "@/components/ui/menu";
import { EXPIRY_KINDS, expiryOpen, nearestExpiry, opt, useOpt } from "@/lib/options-store";
import type { ExpiryKind, OptionExpiry } from "@/lib/options/types";
import { Countdown, KindBadges, StateBadge, useNow } from "./bits";
import { countdown, expiryLabel } from "./format";

const KIND_KEY = { daily: "trader.opt.kind.daily", weekly: "trader.opt.kind.weekly", monthly: "trader.opt.kind.monthly" } as const;

/** "3D" for a few days out, "5h 10m" on the day of the cut. */
function untilText(cutMs: number, now: number) {
  const left = cutMs - now;
  if (left >= 86_400_000) return `${Math.floor(left / 86_400_000)}D`;
  return countdown(cutMs, now);
}

function KindTab({ kind, e, active, now, locale, compact }: { kind: ExpiryKind; e: OptionExpiry | undefined; active: boolean; now: number; locale: string; compact?: boolean }) {
  const t = useT();
  const cut = e ? Date.parse(e.cutAt) : 0;
  const soon = e && cut - now < 3_600_000;
  return (
    <button
      role="tab"
      aria-selected={active}
      disabled={!e}
      onClick={() => opt.selectKind(kind)}
      title={e ? `${t("trader.opt.expiryTitle", { date: e.date, time: new Date(e.cutAt).toISOString().slice(11, 16) })}. ${t("trader.opt.exp.rollHint")}` : undefined}
      className={cn(
        "flex shrink-0 items-center rounded-[6px] border text-start transition-colors disabled:cursor-default disabled:opacity-50",
        compact ? "h-[34px] min-w-0 flex-1 gap-1.5 px-1.5" : "h-[30px] gap-2 px-2",
        active ? "border-ember/50 bg-ember-soft text-fg shadow-[inset_0_-2px_0_var(--k-ember)]" : "border-line bg-surface-2/60 text-fg-2 hover:border-fg-3/40 hover:text-fg",
      )}
    >
      {!compact && <KindBadges kinds={[kind]} />}
      <span className="min-w-0 leading-none">
        <span className={cn("block truncate font-semibold", compact ? "text-[11px]" : "text-[11px]")}>{t(KIND_KEY[kind])}</span>
        <span className={cn("k-num mt-[3px] block truncate font-mono text-[9.5px]", soon ? "text-warn" : active ? "text-fg-2" : "text-fg-3")}>
          {e ? `${expiryLabel(e.date, locale, !compact)} · ${untilText(cut, now)}` : t("trader.opt.exp.none")}
        </span>
      </span>
    </button>
  );
}

function ExpiryPicker({ list, expiry, picked, now, locale, compact }: { list: OptionExpiry[]; expiry: string | null; picked: boolean; now: number; locale: string; compact?: boolean }) {
  const t = useT();
  const open = list.filter((e) => expiryOpen(e, now)).sort((a, b) => Date.parse(a.cutAt) - Date.parse(b.cutAt));
  const cur = list.find((e) => e.date === expiry);
  return (
    <DropMenu
      width={312}
      align="end"
      trigger={({ toggle, open: on }) => (
        <button
          onClick={toggle}
          aria-haspopup="dialog"
          aria-expanded={on}
          title={t("trader.opt.exp.pickTitle")}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-[6px] border px-2 text-[11px] font-medium transition-colors",
            compact ? "h-[34px]" : "h-[30px]",
            picked && cur ? "border-ember/50 bg-ember-soft text-fg shadow-[inset_0_-2px_0_var(--k-ember)]" : "border-line bg-surface-2/60 text-fg-2 hover:border-fg-3/40 hover:text-fg",
            on && "bg-surface-3",
          )}
        >
          <CalendarDays className="size-3.5 shrink-0" />
          {picked && cur ? (
            <span className="k-num whitespace-nowrap font-mono text-[10.5px]">
              {expiryLabel(cur.date, locale, !compact)} · {untilText(Date.parse(cur.cutAt), now)}
            </span>
          ) : (
            !compact && <span className="whitespace-nowrap">{t("trader.opt.exp.other")}</span>
          )}
          <ChevronDown className="size-3 shrink-0 text-fg-3" />
        </button>
      )}
    >
      {(close) => (
        <div className="t-scroll max-h-[min(460px,70dvh)] overflow-y-auto p-2">
          <div className="px-1 pb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-fg-3">{t("trader.opt.exp.pickTitle")}</div>
          {EXPIRY_KINDS.map((k) => {
            const items = open.filter((e) => e.kinds.includes(k));
            if (!items.length) return null;
            return (
              <div key={k} className="mb-2.5 last:mb-0">
                <div className="flex items-center gap-1.5 px-1 pb-1 text-[11px] font-medium text-fg-2">
                  <KindBadges kinds={[k]} /> {t(KIND_KEY[k])}
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {items.map((e) => {
                    const on = e.date === expiry;
                    return (
                      <button
                        key={`${k}-${e.date}`}
                        onClick={() => (opt.selectExpiry(e.date), close())}
                        aria-pressed={on}
                        className={cn("rounded-[6px] border px-1.5 py-1 text-start transition-colors", on ? "border-ember/50 bg-ember-soft text-fg" : "border-line bg-surface-2/50 text-fg-2 hover:bg-surface-3 hover:text-fg")}
                      >
                        <div className="truncate text-[11px] font-medium">{expiryLabel(e.date, locale)}</div>
                        <div className="k-num font-mono text-[9.5px] text-fg-3">{untilText(Date.parse(e.cutAt), now)}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {!open.length && <div className="px-1 py-3 text-center text-[11.5px] text-fg-3">{t("trader.opt.loadingExpiries")}</div>}
        </div>
      )}
    </DropMenu>
  );
}

/** Daily | Weekly | Monthly (nearest of each, rolling) + any listed date. */
export function ExpiryBar({ className, compact }: { className?: string; compact?: boolean }) {
  const t = useT();
  const { locale } = useLocale();
  const list = useOpt((s) => s.expiries);
  const expiry = useOpt((s) => s.expiry);
  const kind = useOpt((s) => s.prefs.expKind);
  const chain = useOpt((s) => (s.chain && s.chain.expiry === s.expiry ? s.chain : null));
  const now = useNow();
  const nearest = EXPIRY_KINDS.map((k) => ({ k, e: nearestExpiry(list, k, now) }));
  const activeKind = kind && nearest.find((x) => x.k === kind)?.e?.date === expiry ? kind : null;
  return (
    <div className={cn("flex shrink-0 items-center gap-1 border-b border-line", compact ? "h-11 px-1.5" : "h-10 overflow-x-auto px-2 [scrollbar-width:none]", className)}>
      {!compact && <span className="shrink-0 pe-1 text-[10px] font-semibold uppercase tracking-[0.09em] text-fg-3">{t("trader.opt.col.expiry")}</span>}
      <div role="tablist" aria-label={t("trader.opt.col.expiry")} className={cn("flex items-center gap-1", compact ? "min-w-0 flex-1" : "shrink-0")}>
        {nearest.map(({ k, e }) => (
          <KindTab key={k} kind={k} e={e} active={activeKind === k} now={now} locale={locale} compact={compact} />
        ))}
      </div>
      <ExpiryPicker list={list} expiry={expiry} picked={!activeKind} now={now} locale={locale} compact={compact} />
      {!compact && chain && (
        <span className="ms-auto flex shrink-0 items-center gap-2 ps-2 text-[10.5px] text-fg-3" title={t("trader.opt.cutHint", { time: chain.cut.time })}>
          <StateBadge state={chain.state} />
          <span className="hidden whitespace-nowrap xl:inline">{t("trader.opt.cutIn")}</span>
          <Countdown to={Date.parse(chain.cutAt)} className="text-fg-2" />
        </span>
      )}
    </div>
  );
}
