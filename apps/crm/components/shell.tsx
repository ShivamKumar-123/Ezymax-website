"use client";

import Link from "next/link";
import { ArrowDownToLine, Bell, CheckCircle2, Coins, IdCard, LogOut, Settings, ShieldCheck, TriangleAlert, UserRound } from "lucide-react";
import {
  AppShell,
  Avatar,
  Button,
  CommandPalette,
  LanguageMenu,
  MarketBoundary,
  Menu,
  NotificationsPopover,
  ThemeToggle,
  Tooltip,
  Chip,
} from "@kalks/ui";
import { NOTIFICATIONS } from "@kalks/mock";
import { CRM_COMMANDS, CRM_NAV } from "@/lib/nav";
import { KYC_CHIP, logout, useSession } from "@/components/session";

const NOTIF_ICON: Record<string, React.ReactNode> = {
  fill: <CheckCircle2 />,
  deposit: <ArrowDownToLine />,
  kyc: <IdCard />,
  ib: <Coins />,
  margin: <TriangleAlert />,
};

/** The shared rail's sign-out icon is a plain link to /login; turn it into a real sign-out. */
function onRailSignOut(e: React.MouseEvent) {
  const a = (e.target as HTMLElement).closest("a");
  if (a?.getAttribute("href") === "/login") {
    e.preventDefault();
    e.stopPropagation();
    void logout();
  }
}

/** Client Area chrome (rail, top bar, account menu) for the signed-in client. */
export function ClientShell({ children }: { children: React.ReactNode }) {
  const me = useSession();
  const verified = me.kyc_status === "verified";
  const kyc = KYC_CHIP[me.kyc_status];
  return (
    <div className="contents" onClickCapture={onRailSignOut}>
      <AppShell
        modules={CRM_NAV}
        railFooter={
          <Tooltip content="Profile" side="right">
            <Link href="/profile" className="mb-1">
              <Avatar name={me.name} size={38} verified={verified} />
            </Link>
          </Tooltip>
        }
        topRight={
          <>
            <CommandPalette items={CRM_COMMANDS.map((c) => ({ group: c.group, label: c.label, href: c.href, icon: <c.Icon /> }))} />
            <LanguageMenu />
            <ThemeToggle />
            <NotificationsPopover items={NOTIFICATIONS.map((n) => ({ ...n, icon: NOTIF_ICON[n.kind] ?? <Bell /> }))} />
            <Link href="/wallet/deposit" className="hidden sm:block">
              <Button variant="ember" shimmer>
                <ArrowDownToLine /> Deposit
              </Button>
            </Link>
            <Menu
              width={260}
              header={
                <div className="flex items-center gap-3">
                  <Avatar name={me.name} size={40} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{me.name}</div>
                    <div className="truncate text-xs text-fg-3">{me.email}</div>
                    <Chip tone={kyc.tone} size="sm" className="mt-1.5" dot>
                      {kyc.label}
                    </Chip>
                  </div>
                </div>
              }
              items={[
                { label: "Profile", icon: <UserRound />, href: "/profile" },
                { label: "Security", icon: <ShieldCheck />, href: "/profile/security" },
                { label: "Verification", icon: <IdCard />, href: "/profile/verification" },
                { label: "Preferences", icon: <Settings />, href: "/profile/preferences" },
                "sep",
                { label: "Log out", icon: <LogOut />, onSelect: () => void logout(), danger: true },
              ]}
              trigger={
                <button className="rounded-full outline-none ring-offset-2 ring-offset-bg focus-visible:ring-2 focus-visible:ring-ember" aria-label="Account menu">
                  <Avatar name={me.name} size={40} verified={verified} />
                </button>
              }
            />
          </>
        }
      >
        <MarketBoundary>{children}</MarketBoundary>
      </AppShell>
    </div>
  );
}
