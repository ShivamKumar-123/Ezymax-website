"use client";

// Left sidebar of the Client Area (right in RTL): the broker's logo (plus its name when expanded), the module
// navigation with the active module marked by an accent notch on the outer edge, and settings at the bottom.
// Modules that carry more than one sub-page expand in place as an accordion — one open at a time, so a long
// module list never pushes the rest of the navigation out of reach. The collapse toggle lives in the top bar and
// sign-out in the profile drawer, so neither appears here. Collapsed the rail is icon-only with tooltips, and
// since there is no room to expand a group there, its row simply navigates to the module's landing page.

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown, Settings } from "lucide-react";
import { LogoMark, Tooltip, cn, useBrand, type NavModule, type SubNavItem } from "@/components/kit";
import { useLocale, useT } from "@ezymex/i18n/react";
import { activeSub, isActive } from "./nav-utils";

const KEY = "ezymex.crm.rail";

/** Expanded (labelled) or slim rail, remembered per browser. */
export function useRailExpanded(): [boolean, (v: boolean) => void] {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    try {
      setOpen(window.localStorage.getItem(KEY) === "open");
    } catch {
      /* storage blocked: stay slim */
    }
  }, []);
  const set = React.useCallback((v: boolean) => {
    setOpen(v);
    try {
      window.localStorage.setItem(KEY, v ? "open" : "slim");
    } catch {
      /* ignore */
    }
  }, []);
  return [open, set];
}

/** The broker's mark on a brand-coloured disc (Ezymex: the K glyph; a broker: its logo on white, or its initial). */
export function BrandAvatar({ size = 46 }: { size?: number }) {
  const brand = useBrand();
  if (brand?.logo_url)
    return (
      <span className="grid shrink-0 place-items-center overflow-hidden rounded-full bg-white shadow-[0_8px_22px_-10px_var(--k-ember)] ring-1 ring-line" style={{ width: size, height: size }}>
        <LogoMark size={Math.round(size * 0.56)} />
      </span>
    );
  return (
    <span className="k-brand-disc grid shrink-0 place-items-center rounded-full text-white" style={{ width: size, height: size }}>
      {brand ? <span className="text-[19px] font-bold leading-none">{brand.name.trim().charAt(0).toUpperCase()}</span> : <LogoMark size={Math.round(size * 0.42)} className="text-white" />}
    </span>
  );
}

/** Only a real menu of sub-pages is worth an accordion; a single child is reached from the module page itself. */
function groupOf(m: NavModule): SubNavItem[] | undefined {
  return m.sub && m.sub.length >= 2 ? m.sub : undefined;
}

export function Rail({ modules, expanded }: { modules: NavModule[]; expanded: boolean }) {
  const t = useT();
  const brand = useBrand();
  const pathname = usePathname();
  const { dir } = useLocale();
  const reduce = useReducedMotion();
  const side = dir === "rtl" ? "left" : "right";

  const current = modules.find((m) => isActive(pathname, m));
  // Accordion state is re-derived while rendering rather than in an effect, so the group holding the current page
  // is already open on the first paint. `from` pins a manual open/close to the module it was made in: it survives
  // re-renders and navigation inside that module, and is dropped once the route moves to a different one.
  const [open, setOpen] = React.useState<{ key: string | null; from?: string }>({ key: null });
  const openKey = open.from === current?.key ? open.key : current && groupOf(current) ? current.key : null;

  const navRef = React.useRef<HTMLElement>(null);
  const [edges, setEdges] = React.useState({ top: false, bottom: false });
  React.useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const update = () => setEdges({ top: el.scrollTop > 2, bottom: el.scrollTop + el.clientHeight < el.scrollHeight - 2 });
    update();
    // also re-runs when a group opens, which can push the active row out of view
    el.querySelector<HTMLElement>("[data-rail-active]")?.scrollIntoView({ block: "nearest" });
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [modules.length, expanded, openKey, pathname]);
  const fade = edges.top || edges.bottom ? `linear-gradient(to bottom, ${edges.top ? "transparent, #000 24px" : "#000"}, ${edges.bottom ? "#000 calc(100% - 24px), transparent" : "#000"})` : undefined;
  let last: string | undefined;

  const item = (key: string, label: string, body: React.ReactNode) =>
    expanded ? (
      <React.Fragment key={key}>{body}</React.Fragment>
    ) : (
      <Tooltip key={key} content={label} side={side}>
        {body}
      </Tooltip>
    );
  const rowCls = (active: boolean) =>
    cn(
      "group/rail relative flex h-10 shrink-0 items-center rounded-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ember/40",
      expanded ? "w-full gap-3 px-3" : "w-10 justify-center",
      active ? "bg-ember-soft text-ember" : "text-fg-3 hover:bg-surface-3/70 hover:text-fg",
    );
  const badge = (value: number | string) => (
    <span className={cn("grid h-4 min-w-4 place-items-center rounded-full bg-ember px-1 text-[9px] font-bold text-[var(--k-on-ember)] ring-2 ring-[var(--k-rail-bg-solid)]", expanded ? "relative" : "absolute end-0.5 top-0.5")}>{value}</span>
  );

  return (
    <aside className={cn("k-rail fixed inset-y-0 start-0 z-40 hidden flex-col pb-4 pt-7 transition-[width] duration-300 lg:flex", expanded ? "w-[248px] px-4" : "w-[84px] items-center px-0")}>
      <Link href="/" className={cn("flex shrink-0 items-center gap-3", expanded ? "px-1" : "")} aria-label={t("shell.nav.dashboard")}>
        <BrandAvatar size={46} />
        {expanded && brand && <span className="min-w-0 flex-1 truncate text-[17px] font-bold leading-tight text-fg">{brand.name}</span>}
      </Link>
      <span className={cn("mt-5 block h-px shrink-0 bg-line", expanded ? "mx-1" : "w-10")} />
      <nav ref={navRef} className={cn("mt-3 flex min-h-0 flex-1 flex-col gap-[3px] overflow-y-auto [scrollbar-width:none]", expanded ? "-mx-4 px-4" : "w-full items-center")} style={fade ? { maskImage: fade, WebkitMaskImage: fade } : undefined}>
        {modules.map((m) => {
          const active = isActive(pathname, m);
          const Icon = m.icon;
          const sub = expanded ? groupOf(m) : undefined;
          const isOpen = sub ? openKey === m.key : false;
          const listId = `crm-rail-sub-${m.key}`;
          const here = sub && isOpen ? activeSub(pathname, sub) : undefined;
          const sep = m.section && last !== undefined && m.section !== last;
          last = m.section ?? last;
          const face = (
            <>
              {active && <motion.span layoutId="crm-rail-notch" aria-hidden className="k-rail-notch" transition={{ type: "spring", bounce: 0.2, duration: 0.5 }} />}
              <Icon className="relative size-[19px] shrink-0" strokeWidth={active ? 2 : 1.75} />
              {expanded && <span className="relative min-w-0 flex-1 truncate text-start text-[13.5px] font-semibold">{m.label}</span>}
              {m.badge !== undefined && badge(m.badge)}
            </>
          );
          return (
            <React.Fragment key={m.key}>
              {sep && <span className={cn("my-1 block h-px shrink-0 bg-line", expanded ? "mx-3" : "w-6 self-center")} />}
              {sub ? (
                <>
                  <button
                    type="button"
                    onClick={() => setOpen({ key: isOpen ? null : m.key, from: current?.key })}
                    aria-expanded={isOpen}
                    aria-controls={listId}
                    data-rail-active={active || undefined}
                    className={rowCls(active)}
                  >
                    {face}
                    <ChevronDown aria-hidden className={cn("relative size-4 shrink-0 text-fg-3 transition-transform duration-200", isOpen && "rotate-180")} strokeWidth={2} />
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.ul
                        id={listId}
                        initial={reduce ? false : { height: 0, opacity: 0 }}
                        animate={reduce ? undefined : { height: "auto", opacity: 1 }}
                        exit={reduce ? undefined : { height: 0, opacity: 0 }}
                        transition={{ duration: reduce ? 0 : 0.22, ease: "easeOut" }}
                        className="shrink-0 overflow-hidden"
                      >
                        {sub.map((s) => {
                          const on = here?.href === s.href;
                          return (
                            <li key={s.href} className="mt-[2px] first:mt-[3px]">
                              <Link
                                href={s.href}
                                prefetch
                                aria-current={on ? "page" : undefined}
                                className={cn(
                                  "flex h-9 items-center gap-2 rounded-[12px] pe-3 ps-11 text-[13.5px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ember/40",
                                  on ? "bg-surface-3 font-semibold text-fg" : "text-fg-3 hover:bg-surface-3/50 hover:text-fg",
                                )}
                              >
                                <span className="min-w-0 flex-1 truncate text-start">{s.label}</span>
                                {s.badge !== undefined && badge(s.badge)}
                              </Link>
                            </li>
                          );
                        })}
                      </motion.ul>
                    )}
                  </AnimatePresence>
                </>
              ) : (
                item(
                  m.key,
                  m.label,
                  <Link href={m.href} prefetch={m.external ? false : true} target={m.external ? "_blank" : undefined} data-rail-active={active || undefined} aria-current={active ? "page" : undefined} className={rowCls(active)}>
                    {face}
                  </Link>,
                )
              )}
            </React.Fragment>
          );
        })}
      </nav>
      <div className={cn("mt-2 flex shrink-0 flex-col gap-[3px]", expanded ? "" : "items-center")}>
        {item(
          "settings",
          t("shell.preferences"),
          <Link href="/profile/preferences" className={rowCls(pathname === "/profile/preferences")}>
            <Settings className="size-[20px] shrink-0" strokeWidth={1.75} />
            {expanded && <span className="flex-1 truncate text-start text-[13.5px] font-semibold">{t("shell.preferences")}</span>}
          </Link>,
        )}
      </div>
    </aside>
  );
}
