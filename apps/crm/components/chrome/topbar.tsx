"use client";

// Top area of the Client Area: the rail's collapse control at the start, and at the end a wallet shortcut with the
// balance, search, notifications, theme and the avatar that opens the profile drawer.
//
// A module's pages are listed in the sidebar on desktop, so SubNav is only reached below `lg`, where the sidebar is
// hidden and the phone bar takes over.

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { ChevronDown, CreditCard, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Avatar, Menu, cn, type NavModule, type SubNavItem } from "@/components/kit";
import { useLocale, useT } from "@ezymex/i18n/react";
import { fmt, useWallet, usdtAvailable, type Overview } from "@/components/wallet-live/api";
import { activeSub } from "./nav-utils";

/** The module's pages as text tabs with an accent underline. `fit` (desktop): as many tabs as the space allows, the
 *  rest in a "More" menu (the current page always stays visible); otherwise the row scrolls sideways (touch). */
export function SubNav({ items, className, fit = false }: { items: SubNavItem[]; className?: string; fit?: boolean }) {
  const t = useT();
  const pathname = usePathname();
  const cur = activeSub(pathname, items);
  const curIdx = cur ? items.indexOf(cur) : -1;
  const { dir } = useLocale();
  const lid = React.useId();
  const ref = React.useRef<HTMLDivElement>(null);
  const measure = React.useRef<HTMLDivElement>(null);
  const [edges, setEdges] = React.useState({ start: false, end: false });
  // null until measured: the first paint shows every tab
  const [fitCount, setFitCount] = React.useState<number | null>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el || fit) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      const pos = Math.abs(el.scrollLeft);
      setEdges({ start: pos > 2, end: pos < max - 2 });
    };
    update();
    el.querySelector<HTMLElement>("[data-sub-active]")?.scrollIntoView({ block: "nearest", inline: "nearest" });
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [items.length, cur?.href, fit]);

  React.useLayoutEffect(() => {
    if (!fit) return;
    const wrap = ref.current?.parentElement;
    const meas = measure.current;
    if (!wrap || !meas) return;
    const compute = () => {
      const avail = wrap.clientWidth;
      const kids = Array.from(meas.children) as HTMLElement[];
      const widths = items.map((_, i) => kids[i]?.offsetWidth ?? 0);
      const moreW = kids[items.length]?.offsetWidth ?? 0;
      const GAP = 4;
      const total = widths.reduce((a, w) => a + w, 0) + GAP * Math.max(0, items.length - 1);
      if (total <= avail) return setFitCount(items.length);
      let used = moreW + (curIdx >= 0 ? widths[curIdx]! + GAP : 0);
      let n = curIdx >= 0 ? 1 : 0;
      for (let i = 0; i < items.length; i++) {
        if (i === curIdx) continue;
        if (used + widths[i]! + GAP > avail) break;
        used += widths[i]! + GAP;
        n++;
      }
      setFitCount(n);
    };
    compute();
    // the measuring row resizes when the web font arrives; the wrapper when the window does
    const ro = new ResizeObserver(compute);
    ro.observe(wrap);
    ro.observe(meas);
    void document.fonts?.ready.then(compute);
    return () => ro.disconnect();
  }, [fit, items, curIdx]);

  let visible = items;
  let overflow: SubNavItem[] = [];
  if (fit && fitCount !== null && fitCount < items.length) {
    const others = items.filter((_, i) => i !== curIdx);
    const keep = new Set(others.slice(0, Math.max(0, curIdx >= 0 ? fitCount - 1 : fitCount)));
    if (cur) keep.add(cur);
    visible = items.filter((s) => keep.has(s));
    overflow = items.filter((s) => !keep.has(s));
  }

  const tabCls = (on: boolean) => cn("relative flex h-11 shrink-0 items-center gap-2 whitespace-nowrap px-2.5 text-[14px] font-semibold transition-colors", on ? "text-fg" : "text-fg-3 hover:text-fg");
  const body = (s: SubNavItem, on: boolean) => {
    const Icon = s.icon;
    return (
      <>
        {Icon && <Icon className={cn("size-[17px] shrink-0", on ? "text-ember" : "")} strokeWidth={1.9} />}
        {s.label}
        {s.badge !== undefined && <span className="k-num grid h-[18px] min-w-[18px] place-items-center rounded-full bg-ember-soft px-1 text-[10px] font-bold text-ember">{s.badge}</span>}
      </>
    );
  };
  const moreCls = "flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[14px] font-semibold text-fg-3 outline-none hover:text-fg focus-visible:ring-2 focus-visible:ring-ember/40";
  const mask = !fit && (edges.start || edges.end) ? `linear-gradient(to ${dir === "rtl" ? "left" : "right"}, ${edges.start ? "transparent, #000 28px" : "#000"}, ${edges.end ? "#000 calc(100% - 28px), transparent" : "#000"})` : undefined;
  return (
    <div ref={ref} className={cn("relative flex min-w-0 items-center gap-1", fit ? "" : "overflow-x-auto [scrollbar-width:none]", className)} style={mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined}>
      {fit && (
        // invisible measuring row: every tab at its natural width, plus the More button
        <div ref={measure} aria-hidden className="pointer-events-none invisible absolute start-0 top-0 flex items-center gap-1">
          {items.map((s) => (
            <span key={s.href} className={tabCls(s === cur)}>
              {body(s, s === cur)}
            </span>
          ))}
          <span className={moreCls}>
            {t("shell.more")} <ChevronDown className="size-4" />
          </span>
        </div>
      )}
      {visible.map((s) => {
        const on = s === cur;
        return (
          <Link key={s.href} href={s.href} prefetch data-sub-active={on || undefined} aria-current={on ? "page" : undefined} className={tabCls(on)}>
            {body(s, on)}
            {on && <motion.span layoutId={`crm-subnav-${lid}`} className="absolute inset-x-2.5 bottom-0.5 h-[2.5px] rounded-full bg-ember" transition={{ type: "spring", bounce: 0.18, duration: 0.45 }} />}
          </Link>
        );
      })}
      {overflow.length > 0 && (
        <Menu
          align="start"
          trigger={
            <button type="button" className={moreCls}>
              {t("shell.more")} <ChevronDown className="size-4" />
            </button>
          }
          items={overflow.map((o) => ({ label: o.label, href: o.href, icon: o.icon ? <o.icon /> : undefined }))}
        />
      )}
    </div>
  );
}

const ICON_BTN =
  "k-surface-btn grid size-10 shrink-0 place-items-center rounded-full text-fg-2 outline-none transition-colors hover:text-fg focus-visible:ring-4 focus-visible:ring-ember/20";

/** Collapses and expands the rail. It sits here rather than on the rail so the rail can run flush to the screen edge. */
export function RailToggle({ expanded, onToggle, label }: { expanded: boolean; onToggle: () => void; label: string }) {
  const Icon = expanded ? PanelLeftClose : PanelLeftOpen;
  return (
    <button type="button" onClick={onToggle} aria-expanded={expanded} aria-label={label} className={cn(ICON_BTN, "hidden lg:grid")}>
      <Icon className="size-[18px] rtl:-scale-x-100" strokeWidth={1.9} />
    </button>
  );
}

/** A shortcut to the wallet, with the available balance beside it.
 *
 *  The figure appears only once it has arrived: while it loads, or if the request fails, the shortcut shows on its
 *  own. A stale or invented number next to a deposit button is worse than no number at all. */
export function WalletChip({ enabled }: { enabled: boolean }) {
  const t = useT();
  const o = useWallet<Overview>(enabled ? "overview" : null);
  const balance = o.data ? usdtAvailable(o.data) : null;
  if (!enabled) return null;
  return (
    <>
      <Link href="/wallet" aria-label={t("shell.nav.wallet")} className={ICON_BTN}>
        <CreditCard className="size-[18px]" strokeWidth={1.9} />
      </Link>
      {balance && (
        <Link
          href="/wallet"
          className="k-surface-btn hidden h-10 shrink-0 items-center gap-1.5 rounded-full px-4 outline-none focus-visible:ring-4 focus-visible:ring-ember/20 sm:flex"
        >
          <span className="k-num text-[13.5px] font-bold text-fg">{fmt(balance.available)}</span>
          <span className="text-[11.5px] font-medium text-fg-3">{balance.currency}</span>
        </Link>
      )}
    </>
  );
}

/** The avatar at the end of the top bar. It opens the profile drawer, so it carries no name, e-mail or caret. */
export function AvatarButton({ name, verified, onOpen, label }: { name: string; verified?: boolean; onOpen: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      aria-haspopup="dialog"
      className="shrink-0 rounded-full outline-none transition-transform hover:scale-[1.04] focus-visible:ring-4 focus-visible:ring-ember/20"
    >
      <Avatar name={name} size={38} verified={verified} />
    </button>
  );
}

/** Title of the current module (for the phone top bar). */
export function currentModule(modules: NavModule[], pathname: string, isActive: (p: string, m: NavModule) => boolean) {
  return modules.find((m) => isActive(pathname, m));
}
