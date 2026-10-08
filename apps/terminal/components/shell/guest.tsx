"use client";

import * as React from "react";
import { ArrowUpRight, ChevronDown, Keyboard, Lock, LogIn, UserPlus, UserRound } from "lucide-react";
import { cn } from "@ezymex/ui";
import { useT } from "@ezymex/i18n/react";
import { useTerminal } from "@/lib/store";
import { CLIENT_AREA, LOGIN_URL, REGISTER_URL } from "@/lib/guest";
import { DropMenu } from "@/components/ui/menu";
import { Badge } from "@/components/ui/primitives";

/** Log in / Open account pair, used by every guest notice. */
export function GuestActions({ size = "sm", className }: { size?: "sm" | "md"; className?: string }) {
  const t = useT();
  const h = size === "md" ? "h-9 px-3.5 text-[13px]" : "h-7 px-2.5 text-[12px]";
  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-1.5", className)}>
      <a href={LOGIN_URL} className={cn("inline-flex items-center gap-1.5 rounded-[7px] bg-ember font-semibold text-white transition hover:brightness-110 [&_svg]:size-3.5", h)}>
        <LogIn /> {t("trader.guest.logIn")}
      </a>
      <a href={REGISTER_URL} target="_blank" rel="noreferrer" className={cn("inline-flex items-center gap-1.5 rounded-[7px] border border-line font-medium text-fg-2 transition-colors hover:border-fg-3/50 hover:text-fg [&_svg]:size-3.5", h)}>
        <UserPlus /> {t("trader.guest.openAccount")}
      </a>
    </div>
  );
}

/** Centered explainer: replaces account-only panels (order ticket, trade/history/exposure tabs). */
export function GuestNotice({ icon = <Lock />, title, text, className }: { icon?: React.ReactNode; title?: string; text: React.ReactNode; className?: string }) {
  const t = useT();
  return (
    <div className={cn("grid h-full place-items-center p-5 text-center", className)}>
      <div className="max-w-[380px]">
        <div className="mx-auto mb-2.5 grid size-9 place-items-center rounded-full border border-ember/30 bg-ember-soft text-ember [&>svg]:size-4">{icon}</div>
        <div className="text-[13px] font-semibold text-fg">{title ?? t("trader.guest.title")}</div>
        <p className="mt-1 text-[12px] leading-relaxed text-fg-3">{text}</p>
        <GuestActions className="mt-3" />
      </div>
    </div>
  );
}

/** Title-bar chip in place of the account switcher. */
export function GuestAccountChip() {
  const t = useT();
  return (
    <DropMenu
      width={300}
      align="end"
      trigger={({ toggle, open }) => (
        <button onClick={toggle} className={cn("flex h-8 items-center gap-2 rounded-[7px] border border-line bg-surface-2 ps-1.5 pe-2 text-start transition-colors hover:bg-surface-3", open && "bg-surface-3")} aria-label={t("trader.guest.session")}>
          <Badge>{t("trader.guest.badge")}</Badge>
          <span className="leading-none">
            <span className="block text-[12px] text-fg">{t("trader.guest.noAccount")}</span>
            <span className="block text-[10px] text-fg-3">{t("trader.guest.liveData")}</span>
          </span>
          <ChevronDown className="size-3.5 text-fg-3" />
        </button>
      )}
    >
      {() => <GuestCard />}
    </DropMenu>
  );
}

function GuestCard() {
  const t = useT();
  return (
    <div>
      <div className="border-b border-line px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-3">{t("trader.guest.cardHeader")}</div>
      <div className="space-y-2 px-3 py-3">
        <div className="text-[12.5px] font-medium text-fg">{t("trader.guest.title")}</div>
        <p className="text-[11.5px] leading-relaxed text-fg-3">{t("trader.guest.cardText")}</p>
        <GuestActions className="justify-start pt-1" />
      </div>
      <div className="flex items-center justify-end border-t border-line px-3 py-2 text-[11.5px]">
        <a href={CLIENT_AREA} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-fg-2 hover:text-fg">
          {t("trader.clientArea")} <ArrowUpRight className="size-3" />
        </a>
      </div>
    </div>
  );
}

/** Title-bar user menu in place of the (mock) profile avatar. */
export function GuestUserMenu() {
  const T = useTerminal();
  const t = useT();
  return (
    <DropMenu
      align="end"
      width={220}
      items={[
        { header: t("trader.guest.badge") },
        { label: t("trader.guest.logInToTrade"), icon: <LogIn />, onSelect: () => window.location.assign(LOGIN_URL) },
        { label: t("trader.guest.openAccount"), icon: <UserPlus />, onSelect: () => window.open(REGISTER_URL, "_blank", "noopener") },
        "sep",
        { label: t("trader.account.keyboardShortcuts"), icon: <Keyboard />, hint: "F1", onSelect: () => T.setUi({ shortcuts: true }) },
      ]}
      trigger={({ toggle }) => (
        <button onClick={toggle} className="ms-0.5 grid size-8 place-items-center rounded-full bg-surface-3 text-fg-2 ring-1 ring-line transition hover:text-fg hover:ring-ember/50" aria-label={t("trader.accountMenu")}>
          <UserRound className="size-4" />
        </button>
      )}
    />
  );
}
