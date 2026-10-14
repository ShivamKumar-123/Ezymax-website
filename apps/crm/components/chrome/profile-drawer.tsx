"use client";

// "My Profile": the right-hand drawer behind the profile pill — identity, then one tappable row per account
// destination (verification, Partner Hub, preferences, support), sign out, and an invitation to send feedback.
//
// It rides on the shared Dialog (side="right") rather than its own overlay so the backdrop, focus trap, Escape and
// the title/close header stay identical to every other drawer in the product. That Dialog ignores `width` for
// side="right" — the panel is pinned at 560px — so the width passed below is for the day it stops being ignored.
// Everything shown comes in through props: the drawer never fetches.

import * as React from "react";
import Link from "next/link";
import { ChevronRight, Handshake, LifeBuoy, Lightbulb, LogOut, Settings, ShieldCheck, type LucideIcon } from "lucide-react";
import { Avatar, Chip, Dialog, cn } from "@/components/kit";
import { KYC_CHIP } from "@/components/session";
import { useT } from "@ezymex/i18n/react";

// the caller passes kyc_status through as a plain string, so look the chip up loosely and let an unknown status
// degrade to a neutral pill instead of crashing the drawer
const KYC = KYC_CHIP as Record<string, (typeof KYC_CHIP)[keyof typeof KYC_CHIP] | undefined>;

type RowVariant = "default" | "danger" | "invite";

/** One row of the stack: a link when `href` is given, a plain button otherwise. Both close the drawer. */
function Row({
  icon: Icon,
  label,
  subtitle,
  end,
  href,
  onClick,
  variant = "default",
}: {
  icon: LucideIcon;
  label: string;
  subtitle?: string;
  end?: React.ReactNode;
  href?: string;
  onClick: () => void;
  variant?: RowVariant;
}) {
  const danger = variant === "danger";
  const invite = variant === "invite";
  const cls = cn(
    "flex min-h-16 w-full items-center gap-3 rounded-[16px] border px-4 py-3 text-start outline-none transition-colors focus-visible:ring-4 focus-visible:ring-ember/20",
    invite ? "border-ember/35 bg-ember-soft hover:border-ember/60" : "border-line hover:bg-surface-2",
  );
  const body = (
    <>
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-[12px]", danger ? "bg-down-soft text-down" : invite ? "bg-ember-soft text-ember" : "bg-surface-3 text-fg-2")}>
        <Icon className="size-[18px]" strokeWidth={1.9} />
      </span>
      {/* labels wrap rather than truncate: several of them are long sentences once translated */}
      <span className="min-w-0 flex-1">
        <span className={cn("block text-[14.5px] font-semibold leading-snug", danger ? "text-down" : "text-fg")}>{label}</span>
        {subtitle && <span className="mt-0.5 block text-[12px] leading-snug text-fg-3">{subtitle}</span>}
      </span>
      {end}
      <ChevronRight className="size-4 shrink-0 text-fg-3 rtl:-scale-x-100" />
    </>
  );
  return href ? (
    <Link href={href} onClick={onClick} className={cls}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {body}
    </button>
  );
}

export function ProfileDrawer({
  open,
  onOpenChange,
  name,
  email,
  kycStatus,
  verified,
  viewer,
  onSignOut,
  extra,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  name: string;
  email: string;
  /** drives the Verification row's pill */
  kycStatus: string;
  verified?: boolean;
  /** a view-only session (D90): the account's own destinations are not this person's, so only the way out remains */
  viewer?: boolean;
  onSignOut: () => void;
  /** rendered between the identity block and the rows; the caller puts the language picker here */
  extra?: React.ReactNode;
}): React.ReactElement {
  const t = useT();
  const close = () => onOpenChange(false);
  const kyc = KYC[kycStatus];
  const firstName = name.trim().split(/\s+/)[0] || name;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} side="right" width={400} title={t("shell.profileDrawer.title")} closeLabel={t("shell.profileDrawer.close")}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <Avatar name={name} size={56} verified={verified} />
          <div className="min-w-0">
            <p className="truncate text-[20px] font-bold tracking-[-0.015em] text-fg">{t("shell.profileDrawer.greeting", { name: firstName })}</p>
            <p className="truncate text-[13px] text-fg-3">{email}</p>
          </div>
        </div>

        {extra}

        <div className="flex flex-col gap-2.5">
          {!viewer && (
            <>
              <Row
                icon={ShieldCheck}
                label={t("shell.verification")}
                href="/profile/verification"
                onClick={close}
                end={
                  <Chip tone={kyc?.tone ?? "neutral"} size="sm" dot>
                    {t.dyn(`shell.kyc.${kycStatus}`, kyc?.label)}
                  </Chip>
                }
              />
              <Row icon={Handshake} label={t("shell.profileDrawer.partnerHub")} subtitle={t("shell.profileDrawer.partnerHubSubtitle")} href="/partner" onClick={close} />
              <Row icon={Settings} label={t("shell.preferences")} href="/profile/preferences" onClick={close} />
              <Row icon={LifeBuoy} label={t("shell.nav.support")} href="/support" onClick={close} />
            </>
          )}
          <Row
            icon={LogOut}
            label={t("shell.logOut")}
            variant="danger"
            onClick={() => {
              close();
              onSignOut();
            }}
          />
          {!viewer && <Row icon={Lightbulb} label={t("shell.profileDrawer.suggest")} href="/support" onClick={close} variant="invite" />}
        </div>
      </div>
    </Dialog>
  );
}
