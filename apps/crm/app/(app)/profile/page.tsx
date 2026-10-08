"use client";

import * as React from "react";
import Link from "next/link";
import { BadgeCheck, CalendarDays, Camera, Globe2, Lock, Mail, MapPin, Phone, UserRound, Building2, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, Card, CardHeader, Chip, Dialog, Field, Flag, Icon3D, Input, KeyValue, PageHeader, Reveal, Starfield } from "@/components/kit";
import { ACCOUNTS, IS_DEMO, ME } from "@ezymex/mock";
import { useFormat, useLocale, useT } from "@ezymex/i18n/react";
import { LiveProfile } from "@/components/profile/live-profile";
import { KYC_CHIP, useSession } from "@/components/session";

function countryName(code: string, lang = "en") {
  try {
    return new Intl.DisplayNames([lang], { type: "region" }).of(code.toUpperCase()) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

function DemoProfile() {
  const me = useSession();
  const t = useT();
  const f = useFormat();
  const { info } = useLocale();
  const kyc = KYC_CHIP[me.kyc_status];
  const since = f.date(me.created_at, { month: "short", year: "numeric" });
  const live = ACCOUNTS.filter((a) => a.type === "live").length;
  return (
    <div>
      <PageHeader title={t("profile.title")} subtitle={t("profile.subtitle")} />

      <Reveal>
        <Card hot className="overflow-hidden">
          <Starfield density={50} />
          <div className="relative flex flex-col gap-6 p-6 md:flex-row md:items-center">
            <div className="relative">
              <Avatar name={me.name} size={96} />
              <button onClick={() => toast(t("profile.photo.upload"), { description: t("profile.photo.uploadHint") })} className="absolute -bottom-1 -end-1 grid size-9 place-items-center rounded-full border border-line bg-surface text-fg-2 hover:text-fg" aria-label={t("profile.photo.change")}>
                <Camera className="size-4" />
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-medium tracking-tight">{me.name}</h2>
                <Chip tone={kyc.tone} dot>{t.dyn(`shell.kyc.${me.kyc_status}`, kyc.label)}</Chip>
                <Chip tone="gold">{ME.ibLevelName}</Chip>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-fg-2">
                <span className="flex items-center gap-1.5">
                  <Mail className="size-3.5" /> {me.email}
                </span>
                <span className="flex items-center gap-1.5">
                  <Phone className="size-3.5" /> {me.phone_dial} {me.phone}
                </span>
                <span className="flex items-center gap-1.5">
                  <Flag country={me.country} className="size-4" /> {countryName(me.country, info.intl)}
                </span>
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="size-3.5" /> {t("profile.memberSince", { date: since })}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                [t("profile.stat.clientId"), `KL-${String(me.id).padStart(6, "0")}`],
                [t("profile.stat.liveAccounts"), String(live)],
                [t("profile.stat.verification"), t("profile.stat.level1")],
              ].map(([k, v]) => (
                <div key={k} className="rounded-2xl border border-white/10 light:border-line bg-black/20 light:bg-white/70 px-4 py-3">
                  <div className="text-[12px] text-fg-3">{k}</div>
                  <div className="k-num mt-1 font-mono text-sm font-semibold">{v}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </Reveal>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Reveal delay={0.05} className="xl:col-span-2">
          <Card>
            <CardHeader title={t("profile.personal.title")} subtitle={t("profile.personal.subtitle")} icon={<UserRound />} />
            <form
              className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                toast.success(t("profile.personal.updated"));
              }}
            >
              <Field label={t("profile.field.firstName")} hint={<span className="flex items-center gap-1"><Lock className="size-3" /> {t("profile.field.lockedAfterKyc")}</span>}>
                <Input defaultValue={me.first_name} />
              </Field>
              <Field label={t("profile.field.lastName")}>
                <Input defaultValue={me.last_name} />
              </Field>
              <Field label={t("profile.field.dob")}>
                <Input type="date" defaultValue={me.date_of_birth} leading={<CalendarDays />} />
              </Field>
              <Field label={t("profile.field.nationality")}>
                <Input placeholder={t("profile.field.nationalityPlaceholder")} leading={<Globe2 />} />
              </Field>
              <Field label={t("common.email")} hint={me.email_verified ? <Chip size="sm" tone="up">{t("common.verified")}</Chip> : <Chip size="sm" tone="warn">{t("profile.notVerified")}</Chip>}>
                <Input defaultValue={me.email} leading={<Mail />} disabled />
              </Field>
              <Field label={t("common.phone")} hint={t("profile.field.phoneHint")}>
                <Input defaultValue={`${me.phone_dial} ${me.phone}`} leading={<Phone />} />
              </Field>
              <Field label={t("profile.field.address")} className="sm:col-span-2">
                <Input placeholder={t("profile.field.addressPlaceholder")} leading={<MapPin />} />
              </Field>
              <Field label={t("profile.field.city")}>
                <Input placeholder={t("profile.field.city")} />
              </Field>
              <Field label={t("profile.field.postalCode")}>
                <Input placeholder={t("profile.field.postalCode")} />
              </Field>
              <div className="flex justify-end gap-2 sm:col-span-2">
                <Button type="reset" variant="ghost">
                  {t("common.cancel")}
                </Button>
                <Button type="submit" variant="ember">
                  {t("common.saveChanges")}
                </Button>
              </div>
            </form>
          </Card>
        </Reveal>

        <div className="space-y-4">
          <Reveal delay={0.1}>
            <Card>
              <CardHeader title={t("profile.clientType.title")} icon={<Building2 />} />
              <div className="space-y-3 p-6 pt-4">
                <div className="k-row flex items-center gap-3 border-ember/40 p-4">
                  <UserRound className="size-5 text-ember" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{t("profile.clientType.individual")}</div>
                    <div className="text-xs text-fg-3">{t("profile.clientType.individualHint")}</div>
                  </div>
                  <BadgeCheck className="size-5 text-ember" />
                </div>
                <button onClick={() => toast(t("profile.clientType.corporateToast"), { description: t("profile.clientType.corporateToastHint") })} className="k-row flex w-full items-center gap-3 p-4 text-start hover:border-[var(--k-border-top)]">
                  <Building2 className="size-5 text-fg-3" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{t("profile.clientType.upgrade")}</div>
                    <div className="text-xs text-fg-3">{t("profile.clientType.upgradeHint")}</div>
                  </div>
                </button>
              </div>
            </Card>
          </Reveal>
          <Reveal delay={0.15}>
            <Card>
              <CardHeader title={t("profile.referral.title")} subtitle={t("profile.referral.subtitle")} />
              <div className="p-6 pt-4">
                <KeyValue rows={[[t("profile.referral.code"), <span key="c" className="font-mono">{me.referral_code}</span>], [t("profile.referral.partnerLevel"), ME.ibLevelName], [t("profile.referral.referredBy"), "—"]]} />
                <Link href="/partner">
                  <Button variant="surface" className="mt-3 w-full">
                    {t("profile.referral.openDashboard")}
                  </Button>
                </Link>
              </div>
            </Card>
          </Reveal>
          <Reveal delay={0.2}>
            <Card>
              <CardHeader title={t("profile.data.title")} />
              <div className="flex flex-col gap-2 p-6 pt-4">
                <Button variant="surface" onClick={() => toast.success(t("profile.data.exportRequested"), { description: t("profile.data.exportRequestedHint") })}>
                  <Download /> {t("profile.data.export")}
                </Button>
                <Dialog
                  title={t("profile.closure.title")}
                  description={t("profile.closure.description")}
                  trigger={
                    <Button variant="down-outline">
                      <Trash2 /> {t("profile.closure.request")}
                    </Button>
                  }
                  footer={
                    <Button variant="sell" onClick={() => toast(t("profile.closure.submitted"), { description: t("profile.closure.submittedHint") })}>
                      {t("profile.closure.submit")}
                    </Button>
                  }
                >
                  <div className="flex items-start gap-4">
                    <Icon3D name="warning" size={56} />
                    <p className="text-sm leading-relaxed text-fg-2">
                      {t("profile.closure.body")}
                    </p>
                  </div>
                </Dialog>
              </div>
            </Card>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

/** Demo builds: the full sample profile. Live builds: the client's real record, read-only. */
export default function ProfilePage() {
  return IS_DEMO ? <DemoProfile /> : <LiveProfile />;
}
