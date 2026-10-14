"use client";

// Client Area chrome for the signed-in client: the backdrop, the sidebar (modules, with the current one's pages listed
// under it), the top area (rail toggle, wallet balance, search, notifications, theme, avatar) and, on phones and
// tablets, a bottom bar with a "More" drawer.
//
// The avatar opens a profile drawer rather than a dropdown, which is where the account's own destinations now live -
// verification, partner hub, settings, support, language and signing out. The sidebar therefore carries navigation
// only, and the top area carries no page tabs on desktop, because the sidebar already lists them.

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowDownToLine, ArrowUpRight } from "lucide-react";
import { Button, CommandPalette, LanguageMenu, MarketBoundary, ThemeToggle, TooltipProvider, cn } from "@/components/kit";
import { IS_DEMO } from "@ezymex/mock";
import { useT } from "@ezymex/i18n/react";
import { CRM_COMMANDS, NAV, localizeCommands, localizeNav } from "@/lib/nav";
import { navForFeatures, useFeatures, useModule, usePageOn } from "@/components/tenant-config";
import { TERMINAL_URL } from "@/lib/live";
import { LiveGate } from "@/components/live-gate";
import { NotificationsBell, NotificationsProvider } from "@/components/notifications";
import { SupportLauncher } from "@/components/support/launcher";
import { logout, useSession } from "@/components/session";
import { SessionGuard, ViewerBar, navForViewer } from "@/components/security/session-guard";
import { viewerPageAllowed } from "@/lib/viewer";
import { AccountNotices } from "@/components/account-notices";
import { MaintenanceNotice } from "@/components/maintenance-notice";
import { BrandAvatar, Rail, useRailExpanded } from "./rail";
import { AvatarButton, RailToggle, SubNav, WalletChip } from "./topbar";
import { ProfileDrawer } from "./profile-drawer";
import { MobileBar } from "./mobile-nav";
import { isActive } from "./nav-utils";

/** True once the page has scrolled (the sticky top area then gets its frosted backdrop). */
function useScrolled() {
  const [s, setS] = React.useState(false);
  React.useEffect(() => {
    const on = () => setS(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return s;
}

export function ClientShell({ children }: { children: React.ReactNode }) {
  const t = useT();
  const pathname = usePathname();
  const me = useSession();
  const verified = me.kyc_status === "verified";
  // modules the broker switched off (Platform Owner, D112) disappear from the navigation
  const features = useFeatures();
  // a view-only session (D90) only gets the sections it was given, and no account actions
  const viewer = me.viewer ?? null;
  const modules = localizeNav(viewer ? navForViewer(navForFeatures(NAV, features), viewer) : navForFeatures(NAV, features), t);
  const current = modules.find((m) => isActive(pathname, m));
  const subs = current?.sub && current.sub.length > 1 ? current.sub : null;
  const [expanded, setExpanded] = useRailExpanded();
  const [profileOpen, setProfileOpen] = React.useState(false);
  const scrolled = useScrolled();
  const signOut = () => void logout();

  const pageOn = usePageOn();
  const supportOn = useModule("support");
  const walletOn = useModule("wallet");
  const commands = localizeCommands(CRM_COMMANDS, t)
    .filter((c) => pageOn(c.href) && (!viewer || viewerPageAllowed(viewer, c.href)))
    .map((c) => ({ group: c.group, label: c.label, href: c.href, icon: <c.Icon /> }));

  const cta = viewer ? null : IS_DEMO ? (
    <Link href="/wallet/deposit" className="hidden md:block">
      <Button variant="ember">
        <ArrowDownToLine /> {t("shell.deposit")}
      </Button>
    </Link>
  ) : (
    <a href={TERMINAL_URL} target="_blank" rel="noopener" className="hidden md:block">
      <Button variant="ink">
        {t("shell.ezymexTrader")} <ArrowUpRight className="rtl:-scale-x-100" />
      </Button>
    </a>
  );

  return (
    <NotificationsProvider userKey={String(me.id)} enabled={!viewer}>
      <TooltipProvider>
        <div className="relative min-h-dvh overflow-x-clip">
          <div className="k-backdrop" aria-hidden />
          <Rail modules={modules} expanded={expanded} />
          <div className={cn("relative transition-[padding] duration-300", expanded ? "lg:ps-[248px]" : "lg:ps-[84px]")}>
            {/* TEMPORARY: remove with components/maintenance-notice.tsx when the dashboard work ships */}
            <MaintenanceNotice />
            <header data-scrolled={scrolled || undefined} className="k-topbar sticky top-0 z-30">
              <div className="mx-auto flex h-[68px] max-w-[1640px] items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:h-[72px] lg:px-8">
                <RailToggle expanded={expanded} onToggle={() => setExpanded(!expanded)} label={expanded ? t("dashboard.chrome.collapse") : t("dashboard.chrome.expand")} />
                <Link href="/" className="lg:hidden" aria-label={t("shell.nav.dashboard")}>
                  <BrandAvatar size={40} />
                </Link>
                {/* the module name is the phone's only orientation; on desktop the sidebar shows where you are */}
                <div className="k-display min-w-0 flex-1 truncate text-[17px] font-bold tracking-[-0.01em] lg:hidden">{current?.label}</div>
                <div className="hidden flex-1 lg:block" />
                <div className="flex shrink-0 items-center gap-2">
                  <CommandPalette items={commands} />
                  {!viewer && <WalletChip enabled={walletOn} />}
                  {!viewer && <NotificationsBell />}
                  <span className="hidden sm:contents">
                    <ThemeToggle />
                  </span>
                  {cta}
                  <AvatarButton name={me.name} verified={verified} onOpen={() => setProfileOpen(true)} label={t("shell.accountMenu")} />
                </div>
              </div>
              {subs && (
                <div className="px-2 pb-1 sm:px-4 lg:hidden">
                  <SubNav items={subs} />
                </div>
              )}
            </header>
            <main className="relative mx-auto max-w-[1640px] px-4 pb-32 pt-3 sm:px-6 lg:px-8 lg:pb-14">
              {/* demo builds rebuild their sample views from live prices once; live pages follow the feed mode themselves */}
              <MarketBoundary remount={IS_DEMO}>
                {/* staff session banner, account restrictions, presence heartbeat */}
                <AccountNotices />
                {viewer && <ViewerBar viewer={viewer} owner={me.name} />}
                <LiveGate>{children}</LiveGate>
              </MarketBoundary>
            </main>
          </div>
          <MobileBar modules={modules} onSignOut={signOut} />
          {/* a view-only session gets the drawer for its identity and the way out, but none of the account destinations */}
          <ProfileDrawer
            open={profileOpen}
            onOpenChange={setProfileOpen}
            name={me.name}
            email={viewer ? viewer.label : me.email}
            kycStatus={me.kyc_status}
            verified={verified}
            viewer={!!viewer}
            onSignOut={signOut}
            extra={<LanguageMenu />}
          />
        </div>
      </TooltipProvider>
      {!IS_DEMO && <SessionGuard />}
      {!viewer && supportOn && <SupportLauncher />}
    </NotificationsProvider>
  );
}
