"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Bell, CalendarDays, ChevronRight, IdCard, KeyRound, Lock, Mail, Phone, ShieldCheck, UserRound } from "lucide-react";
import { Avatar, Button, Card, CardHeader, Chip, Flag, PageHeader, Reveal } from "@kalks/ui";
import { ChangePasswordCard } from "@/components/profile/change-password";
import { KYC_CHIP, useSession } from "@/components/session";
import { SUPPORT_EMAIL } from "@/lib/live";

function countryName(code: string) {
  if (!code) return "—";
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase()) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB", opts);
}

/** Signs out and opens the password-reset flow (for clients who don't know their current password). */
async function resetPassword() {
  await fetch("/api/auth/logout", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }).catch(() => {});
  window.location.assign("/forgot");
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line py-3 text-[13.5px] last:border-0">
      <span className="shrink-0 text-fg-3">{label}</span>
      <span className="min-w-0 truncate text-right text-fg">{children}</span>
    </div>
  );
}

/** Live builds: the client's real record from the gateway. Read-only: there is no profile-update API yet. */
export function LiveProfile() {
  const me = useSession();
  const kyc = KYC_CHIP[me.kyc_status];
  const id = `KL-${String(me.id).padStart(6, "0")}`;
  const phone = [me.phone_dial, me.phone].filter(Boolean).join(" ");
  const correction = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Profile correction · ${id}`)}`;

  return (
    <div className="pb-16">
      <PageHeader title="Profile" subtitle="Your personal details as registered with Kalks." />

      <Reveal>
        <Card hot className="overflow-hidden">
          <div className="relative flex flex-col gap-6 p-6 md:flex-row md:items-center">
            <Avatar name={me.name} size={88} verified={me.kyc_status === "verified"} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-medium tracking-tight">{me.name}</h2>
                <Chip tone={kyc.tone} dot>
                  {kyc.label}
                </Chip>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-fg-2">
                <span className="flex items-center gap-1.5">
                  <Mail className="size-3.5" /> {me.email}
                </span>
                {phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="size-3.5" /> {phone}
                  </span>
                )}
                {me.country && (
                  <span className="flex items-center gap-1.5">
                    <Flag country={me.country.toLowerCase()} className="size-4" /> {countryName(me.country)}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="size-3.5" /> Member since {fmtDate(me.created_at, { month: "short", year: "numeric" })}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-center">
              {[
                ["Client ID", id],
                ["Email", me.email_verified ? "Verified" : "Unverified"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-2xl border border-line bg-surface/40 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-wider text-fg-3">{k}</div>
                  <div className="k-num mt-1 font-mono text-sm font-semibold">{v}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </Reveal>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Reveal delay={0.05}>
            <Card>
              <CardHeader
                title="Personal information"
                subtitle="Details can't be edited online yet. To correct them, write to support from your registered email."
                icon={<UserRound />}
                action={
                  <a href={correction}>
                    <Button size="sm" variant="surface">
                      <Mail /> Request a correction
                    </Button>
                  </a>
                }
              />
              <div className="grid grid-cols-1 gap-x-10 px-6 pb-4 pt-2 md:grid-cols-2">
                <div>
                  <Row label="First name">{me.first_name || "—"}</Row>
                  <Row label="Last name">{me.last_name || "—"}</Row>
                  <Row label="Date of birth">{fmtDate(me.date_of_birth)}</Row>
                  <Row label="Country of residence">
                    <span className="inline-flex items-center gap-2">
                      {me.country && <Flag country={me.country.toLowerCase()} className="size-4" />}
                      {countryName(me.country)}
                    </span>
                  </Row>
                </div>
                <div>
                  <Row label="Email">{me.email}</Row>
                  <Row label="Phone">{phone || "—"}</Row>
                  <Row label="Client ID">
                    <span className="font-mono">{id}</span>
                  </Row>
                  <Row label="Registered">{fmtDate(me.created_at)}</Row>
                </div>
              </div>
              <div className="mx-6 mb-6 flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-[12px] text-fg-3">
                <Lock className="size-3.5 shrink-0" />
                {me.identity_locked ? "Name and date of birth are locked to your verified identity documents. Contact support to change them." : "Name and date of birth must match your identity document. You can correct them during verification."}
              </div>
            </Card>
          </Reveal>
          <Reveal delay={0.08}>
            <ChangePasswordCard
              onForgot={() => {
                toast("Signing you out to reset your password…");
                void resetPassword();
              }}
            />
          </Reveal>
        </div>

        <div className="space-y-4">
          <Reveal delay={0.1}>
            <Card>
              <CardHeader title="Sign-in & security" icon={<ShieldCheck />} />
              <div className="px-6 pb-2 pt-2">
                <Row label="Email address">
                  {me.email_verified ? (
                    <Chip size="sm" tone="up">
                      Verified
                    </Chip>
                  ) : (
                    <Chip size="sm" tone="warn">
                      Not verified
                    </Chip>
                  )}
                </Row>
                <Row label="Sign-in">Password</Row>
                <Row label="New devices">Email code required</Row>
                <Row label="Sensitive changes">Email code required</Row>
              </div>
              <div className="px-6 pb-6">
                <Button
                  variant="surface"
                  className="w-full"
                  onClick={() => {
                    toast("Signing you out to reset your password…");
                    void resetPassword();
                  }}
                >
                  <KeyRound /> Reset password
                </Button>
                <p className="mt-2 text-[11.5px] text-fg-3">Forgot your password? You'll be signed out and we'll email you a reset code.</p>
              </div>
            </Card>
          </Reveal>
          <Reveal delay={0.15}>
            <Link href="/profile/verification" className="block">
              <Card className="flex items-center gap-4 px-6 py-5 transition-colors hover:border-[var(--k-border-top)]">
                <span className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface-3 text-fg-2">
                  <IdCard className="size-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[14px] font-medium">
                    Identity verification
                    <Chip size="sm" tone={me.kyc_case_status === "more_info" ? "warn" : kyc.tone} dot>
                      {me.kyc_case_status === "more_info" ? "Action needed" : me.kyc_status === "unverified" ? (me.kyc_case_status === "draft" ? "In progress" : "Not started") : kyc.label}
                    </Chip>
                  </div>
                  <div className="mt-0.5 text-[12.5px] text-fg-3">
                    {me.kyc_status === "verified"
                      ? "Withdrawals and higher limits are unlocked."
                      : me.kyc_case_status === "more_info"
                        ? "Our team asked for another document."
                        : me.kyc_status === "pending"
                          ? "Your documents are with our verification team."
                          : "Verify online in about 3 minutes to unlock withdrawals."}
                  </div>
                </div>
                <ChevronRight className="size-4 text-fg-3" />
              </Card>
            </Link>
          </Reveal>
          <Reveal delay={0.2}>
            <Link href="/profile/notifications" className="block">
              <Card className="flex items-center gap-4 px-6 py-5 transition-colors hover:border-[var(--k-border-top)]">
                <span className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface-3 text-fg-2">
                  <Bell className="size-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-medium">Notifications</div>
                  <div className="mt-0.5 text-[12.5px] text-fg-3">Choose what reaches you in the app and by email.</div>
                </div>
                <ChevronRight className="size-4 text-fg-3" />
              </Card>
            </Link>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
