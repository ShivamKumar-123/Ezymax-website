"use client";

import Link from "next/link";
import { ArrowDownToLine, ArrowUpRight, IdCard, LogOut, Settings, ShieldCheck, UserRound } from "lucide-react";
import {
  AppShell,
  Avatar,
  Button,
  CommandPalette,
  LanguageMenu,
  MarketBoundary,
  Menu,
  ThemeToggle,
  Tooltip,
  Chip,
} from "@kalks/ui";
import { IS_DEMO } from "@kalks/mock";
import { useLocale, useT } from "@kalks/i18n/react";
import { CRM_COMMANDS, NAV, localizeCommands, localizeNav } from "@/lib/nav";
import { navForFeatures, pageModule, useFeatures } from "@/components/tenant-config";
import { TERMINAL_URL } from "@/lib/live";
import { LiveGate } from "@/components/live-gate";
import { NotificationsBell } from "@/components/notifications";
import { SupportLauncher } from "@/components/support/launcher";
import { KYC_CHIP, logout, useSession } from "@/components/session";

/** The shared rail's sign-out icon is a plain link to /login; turn it into a real sign-out. */
function onRailSignOut(e: React.MouseEvent) {
  const a = (e.target as HTMLElement).closest("a");
  if (a?.getAttribute("href") === "/login") {
    e.preventDefault();
    e.stopPropagation();
    void logout();
  }
}

const ACCOUNT_MENU_DEMO = [
  { label: "shell.profile", icon: <UserRound />, href: "/profile" },
  { label: "shell.security", icon: <ShieldCheck />, href: "/profile/security" },
  { label: "shell.verification", icon: <IdCard />, href: "/profile/verification" },
  { label: "shell.preferences", icon: <Settings />, href: "/profile/preferences" },
] as const;

const ACCOUNT_MENU_LIVE = [
  { label: "shell.profile", icon: <UserRound />, href: "/profile" },
  { label: "shell.verification", icon: <IdCard />, href: "/profile/verification", soon: true },
] as const;

/** Client Area chrome (rail, top bar, account menu) for the signed-in client. */
export function ClientShell({ children }: { children: React.ReactNode }) {
  const t = useT();
  const { dir } = useLocale();
  const me = useSession();
  const verified = me.kyc_status === "verified";
  const kyc = KYC_CHIP[me.kyc_status];
  // modules the broker switched off (Platform Owner, D112) disappear from the navigation
  const features = useFeatures();
  const modules = localizeNav(navForFeatures(NAV, features), t);
  return (
    <div className="contents" onClickCapture={onRailSignOut}>
      <AppShell
        modules={modules}
        railFooter={
          <Tooltip content={t("shell.profile")} side={dir === "rtl" ? "left" : "right"}>
            <Link href="/profile" className="mb-1">
              <Avatar name={me.name} size={38} verified={verified} />
            </Link>
          </Tooltip>
        }
        topRight={
          <>
            <CommandPalette items={localizeCommands(CRM_COMMANDS, t).filter((c) => { const m = pageModule(c.href); return !m || features?.modules[m] !== false; }).map((c) => ({ group: c.group, label: c.label, href: c.href, icon: <c.Icon /> }))} />
            <LanguageMenu />
            <ThemeToggle />
            <NotificationsBell userKey={String(me.id)} />
            {IS_DEMO ? (
              <Link href="/wallet/deposit" className="hidden sm:block">
                <Button variant="ember" shimmer>
                  <ArrowDownToLine /> {t("shell.deposit")}
                </Button>
              </Link>
            ) : (
              <a href={TERMINAL_URL} target="_blank" rel="noopener" className="hidden sm:block">
                <Button variant="ember">
                  {t("shell.kalksTrader")} <ArrowUpRight />
                </Button>
              </a>
            )}
            <Menu
              width={260}
              header={
                <div className="flex items-center gap-3">
                  <Avatar name={me.name} size={40} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{me.name}</div>
                    <div className="truncate text-xs text-fg-3">{me.email}</div>
                    <Chip tone={kyc.tone} size="sm" className="mt-1.5" dot>
                      {t(`shell.kyc.${me.kyc_status}`)}
                    </Chip>
                  </div>
                </div>
              }
              items={[
                ...(IS_DEMO ? ACCOUNT_MENU_DEMO : ACCOUNT_MENU_LIVE).map(({ label, ...m }) => ({ ...m, label: t(label), hint: "soon" in m ? <span className="text-[11px] text-ember">{t("common.soon")}</span> : undefined })),
                "sep",
                { label: t("shell.logOut"), icon: <LogOut />, onSelect: () => void logout(), danger: true },
              ]}
              trigger={
                <button className="rounded-full outline-none ring-offset-2 ring-offset-bg focus-visible:ring-2 focus-visible:ring-ember" aria-label={t("shell.accountMenu")}>
                  <Avatar name={me.name} size={40} verified={verified} />
                </button>
              }
            />
          </>
        }
      >
        <MarketBoundary>
          <LiveGate>{children}</LiveGate>
        </MarketBoundary>
      </AppShell>
      <SupportLauncher />
    </div>
  );
}
