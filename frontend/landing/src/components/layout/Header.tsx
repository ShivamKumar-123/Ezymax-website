"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, ChevronDown, Menu, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { getIcon } from "@/lib/icons";
import { mainNav, type NavGroup } from "@/content/nav";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";

function isActive(pathname: string, group: NavGroup) {
  if (group.href && (pathname === group.href || pathname.startsWith(`${group.href}/`))) return true;
  return group.links.some((l) => pathname === l.href || pathname.startsWith(`${l.href}/`));
}

export function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close menus when the route changes (derived-state reset, no effect needed).
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setOpenGroup(null);
    setMobileOpen(false);
  }

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const activeGroup = mainNav.find((g) => isActive(pathname, g))?.label ?? null;
  const pillKey = hovered ?? openGroup ?? activeGroup;
  const open = openGroup ? mainNav.find((g) => g.label === openGroup) : null;

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div
        className={cn(
          "transition-all duration-500",
          scrolled ? "bg-bg/80 shadow-[0_1px_0_rgb(255_255_255/0.06)] backdrop-blur-xl" : "bg-transparent",
        )}
        onMouseLeave={() => {
          setOpenGroup(null);
          setHovered(null);
        }}
      >
        <div className="container-x flex h-[72px] items-center justify-between gap-4">
          <Link href="/" className="relative z-10 flex items-center text-ink" aria-label="SetupZero home">
            <Logo className="h-[22px] md:h-6" />
          </Link>

          {/* Center pill nav */}
          <nav
            aria-label="Main"
            className="absolute left-1/2 hidden -translate-x-1/2 items-center rounded-full border border-line bg-white/[0.04] p-1 backdrop-blur-xl lg:flex"
          >
            {mainNav.map((group) => {
              const hasMenu = group.links.length > 0;
              const current = pillKey === group.label;
              const content = (
                <>
                  {current ? (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-full bg-white/10"
                      transition={{ type: "spring", stiffness: 420, damping: 36 }}
                    />
                  ) : null}
                  <span className="relative flex items-center gap-1">
                    {group.label}
                    {hasMenu ? (
                      <ChevronDown
                        className={cn("size-3.5 transition-transform duration-300", openGroup === group.label && "rotate-180")}
                      />
                    ) : null}
                  </span>
                </>
              );
              const classes = cn(
                "relative inline-flex items-center rounded-full px-4 py-2 text-[13px] font-medium transition-colors",
                activeGroup === group.label ? "text-ink" : "text-muted hover:text-ink",
              );
              return (
                <div
                  key={group.label}
                  onMouseEnter={() => {
                    setHovered(group.label);
                    setOpenGroup(hasMenu ? group.label : null);
                  }}
                  onFocus={() => hasMenu && setOpenGroup(group.label)}
                >
                  {group.href ? (
                    <Link href={group.href} className={classes} aria-haspopup={hasMenu ? "true" : undefined}>
                      {content}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className={classes}
                      aria-haspopup="true"
                      aria-expanded={openGroup === group.label}
                      onClick={() => setOpenGroup(openGroup === group.label ? null : group.label)}
                    >
                      {content}
                    </button>
                  )}
                </div>
              );
            })}
          </nav>

          <div className="relative z-10 flex items-center gap-3">
            <Button action="demo" size="sm" className="hidden sm:inline-flex">
              Book a Free Demo
            </Button>
            <button
              type="button"
              className="flex size-10 items-center justify-center rounded-full border border-line bg-white/[0.04] text-ink backdrop-blur-xl lg:hidden"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {/* Mega menu */}
        <AnimatePresence>
          {open && open.links.length > 0 ? (
            <motion.div
              key={open.label}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-x-0 top-full hidden lg:block"
            >
              <div className="container-x pt-2">
                <div className="relative overflow-hidden rounded-panel border border-line bg-[#0a0807]/[0.97] p-6 shadow-card backdrop-blur-2xl">
                  <div className="pointer-events-none absolute -top-32 right-10 h-64 w-96 ember-glow opacity-50" aria-hidden />
                  <div className="relative grid gap-6 lg:grid-cols-[1fr_280px]">
                    <div
                      className={cn(
                        "grid gap-1",
                        open.links.length > 6 ? "grid-cols-3" : "grid-cols-2",
                      )}
                    >
                      {open.links.map((link) => {
                        const Icon = getIcon(link.icon);
                        return (
                          <Link
                            key={link.href}
                            href={link.href}
                            className="group flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-white/[0.05]"
                          >
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 text-orange-400 transition-colors group-hover:border-orange-500/50">
                              <Icon className="size-4" />
                            </span>
                            <span>
                              <span className="block text-sm font-medium text-ink">{link.label}</span>
                              <span className="mt-0.5 block text-xs leading-relaxed text-muted">{link.blurb}</span>
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                    <div className="flex flex-col justify-between rounded-card border border-orange-500/30 bg-gradient-to-br from-orange-600/25 to-ember-deep/30 p-5">
                      <div>
                        <span className="bracket">{open.label}</span>
                        <p className="mt-3 font-display text-xl font-semibold leading-tight text-ink">
                          {open.label === "Solutions"
                            ? "One partner. Every brokerage model."
                            : open.label === "Products"
                              ? "Everything you need to run a brokerage."
                              : "The technology behind tomorrow's brokers."}
                        </p>
                      </div>
                      <Link
                        href={open.href ?? "/about"}
                        className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-orange-300 hover:text-orange-200"
                      >
                        {open.href ? `View all ${open.label.toLowerCase()}` : "About SetupZero"}
                        <ArrowUpRight className="size-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 top-[72px] z-40 overflow-y-auto bg-bg/95 backdrop-blur-2xl lg:hidden"
          >
            <div className="container-x py-6">
              {mainNav.map((group) => (
                <MobileGroup key={group.label} group={group} pathname={pathname} />
              ))}
              <div className="mt-6 flex flex-col gap-3">
                <Button action="demo" size="lg">
                  Book a Free Demo
                </Button>
                <Button href="/contact" variant="outline" size="lg">
                  Talk to Sales
                </Button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}

function MobileGroup({ group, pathname }: { group: NavGroup; pathname: string }) {
  const [open, setOpen] = useState(isActive(pathname, group));
  if (group.links.length === 0 && group.href) {
    return (
      <Link
        href={group.href}
        className="flex items-center justify-between border-b border-line py-4 font-display text-xl font-medium text-ink"
      >
        {group.label}
        <ArrowUpRight className="size-5 text-muted" />
      </Link>
    );
  }
  return (
    <div className="border-b border-line">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between py-4 font-display text-xl font-medium text-ink"
      >
        {group.label}
        <ChevronDown className={cn("size-5 text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="grid gap-1 pb-4">
          {group.href ? (
            <Link href={group.href} className="rounded-lg px-3 py-2 text-sm font-medium text-orange-400">
              View all {group.label.toLowerCase()}
            </Link>
          ) : null}
          {group.links.map((link) => {
            const Icon = getIcon(link.icon);
            return (
              <Link key={link.href} href={link.href} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-white/5 hover:text-ink">
                <Icon className="size-4 text-orange-400" />
                {link.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
