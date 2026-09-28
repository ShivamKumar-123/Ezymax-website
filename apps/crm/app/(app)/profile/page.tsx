"use client";

import * as React from "react";
import Link from "next/link";
import { BadgeCheck, CalendarDays, Camera, Globe2, Lock, Mail, MapPin, Phone, UserRound, Building2, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, Card, CardHeader, Chip, Dialog, Field, Flag, Icon3D, Input, KeyValue, PageHeader, Reveal, Starfield } from "@kalks/ui";
import { ACCOUNTS, IS_DEMO, ME } from "@kalks/mock";
import { LiveProfile } from "@/components/profile/live-profile";
import { KYC_CHIP, useSession } from "@/components/session";

function countryName(code: string) {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase()) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

function DemoProfile() {
  const me = useSession();
  const kyc = KYC_CHIP[me.kyc_status];
  const since = new Date(me.created_at).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  const live = ACCOUNTS.filter((a) => a.type === "live").length;
  return (
    <div>
      <PageHeader title="Profile" subtitle="Your personal details and account preferences." />

      <Reveal>
        <Card hot className="overflow-hidden">
          <Starfield density={50} />
          <div className="relative flex flex-col gap-6 p-6 md:flex-row md:items-center">
            <div className="relative">
              <Avatar name={me.name} size={96} />
              <button onClick={() => toast("Upload a new photo", { description: "JPG or PNG, max 5 MB" })} className="absolute -bottom-1 -right-1 grid size-9 place-items-center rounded-full border border-line bg-surface text-fg-2 hover:text-fg" aria-label="Change photo">
                <Camera className="size-4" />
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-medium tracking-tight">{me.name}</h2>
                <Chip tone={kyc.tone} dot>{kyc.label}</Chip>
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
                  <Flag country={me.country} className="size-4" /> {countryName(me.country)}
                </span>
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="size-3.5" /> Member since {since}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                ["Client ID", `KL-${String(me.id).padStart(6, "0")}`],
                ["Live accounts", String(live)],
                ["Verification", "Level 1"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-wider text-fg-3">{k}</div>
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
            <CardHeader title="Personal information" subtitle="Name and date of birth are locked after verification." icon={<UserRound />} />
            <form
              className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                toast.success("Profile updated");
              }}
            >
              <Field label="First name" hint={<span className="flex items-center gap-1"><Lock className="size-3" /> Locked after KYC</span>}>
                <Input defaultValue={me.first_name} />
              </Field>
              <Field label="Last name">
                <Input defaultValue={me.last_name} />
              </Field>
              <Field label="Date of birth">
                <Input type="date" defaultValue={me.date_of_birth} leading={<CalendarDays />} />
              </Field>
              <Field label="Nationality">
                <Input placeholder="Add your nationality" leading={<Globe2 />} />
              </Field>
              <Field label="Email" hint={me.email_verified ? <Chip size="sm" tone="up">Verified</Chip> : <Chip size="sm" tone="warn">Not verified</Chip>}>
                <Input defaultValue={me.email} leading={<Mail />} disabled />
              </Field>
              <Field label="Phone" hint="Change requires re-verification">
                <Input defaultValue={`${me.phone_dial} ${me.phone}`} leading={<Phone />} />
              </Field>
              <Field label="Residential address" className="sm:col-span-2">
                <Input placeholder="Street and building" leading={<MapPin />} />
              </Field>
              <Field label="City">
                <Input placeholder="City" />
              </Field>
              <Field label="Postal code">
                <Input placeholder="Postal code" />
              </Field>
              <div className="flex justify-end gap-2 sm:col-span-2">
                <Button type="reset" variant="ghost">
                  Cancel
                </Button>
                <Button type="submit" variant="ember">
                  Save changes
                </Button>
              </div>
            </form>
          </Card>
        </Reveal>

        <div className="space-y-4">
          <Reveal delay={0.1}>
            <Card>
              <CardHeader title="Client type" icon={<Building2 />} />
              <div className="space-y-3 p-6 pt-4">
                <div className="k-row flex items-center gap-3 border-ember/40 p-4">
                  <UserRound className="size-5 text-ember" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">Individual</div>
                    <div className="text-xs text-fg-3">Personal trading account</div>
                  </div>
                  <BadgeCheck className="size-5 text-ember" />
                </div>
                <button onClick={() => toast("Corporate onboarding", { description: "We'll ask for incorporation documents, directors and UBOs." })} className="k-row flex w-full items-center gap-3 p-4 text-left hover:border-[var(--k-border-top)]">
                  <Building2 className="size-5 text-fg-3" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">Upgrade to corporate</div>
                    <div className="text-xs text-fg-3">Trade on behalf of a company</div>
                  </div>
                </button>
              </div>
            </Card>
          </Reveal>
          <Reveal delay={0.15}>
            <Card>
              <CardHeader title="Referral" subtitle="Share your link — every client counts toward your partner level." />
              <div className="p-6 pt-4">
                <KeyValue rows={[["Referral code", <span key="c" className="font-mono">{me.referral_code}</span>], ["Partner level", ME.ibLevelName], ["Referred by", "—"]]} />
                <Link href="/partner">
                  <Button variant="surface" className="mt-3 w-full">
                    Open partner dashboard
                  </Button>
                </Link>
              </div>
            </Card>
          </Reveal>
          <Reveal delay={0.2}>
            <Card>
              <CardHeader title="Your data" />
              <div className="flex flex-col gap-2 p-6 pt-4">
                <Button variant="surface" onClick={() => toast.success("Data export requested", { description: "You'll receive a download link by email within 72 hours." })}>
                  <Download /> Export my data
                </Button>
                <Dialog
                  title="Close your Kalks account"
                  description="All trading accounts must have zero balance and no open positions."
                  trigger={
                    <Button variant="down-outline">
                      <Trash2 /> Request account closure
                    </Button>
                  }
                  footer={
                    <Button variant="sell" onClick={() => toast("Closure request submitted", { description: "Our team will contact you within 2 business days." })}>
                      Submit request
                    </Button>
                  }
                >
                  <div className="flex items-start gap-4">
                    <Icon3D name="warning" size={56} />
                    <p className="text-sm leading-relaxed text-fg-2">
                      Closing your account is permanent. Your records are retained as required by regulation, but you will no longer be able to log in, trade or receive partner commissions.
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
