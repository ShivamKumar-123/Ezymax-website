"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck, CalendarDays, CheckCircle2, Gift, UserRound } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Button, Field, Flag, Input, Stepper } from "@kalks/ui";
import { FormError, GoogleButton, GoogleMark } from "@/components/auth";
import { authGet, authPost, nextPath, type ApiError } from "@/lib/auth-client";
import { COUNTRIES, maxDob } from "@/lib/countries";

// Profile step after a first "Sign up with Google": Google has verified the email, so this collects
// what the Client Area needs for every account (D34): country, phone, date of birth (18+), referral code
// and acceptance of the Client Agreement / Risk Disclosure / Privacy Policy.

type Profile = { email: string; first_name: string; last_name: string; referral_code: string | null; picture: string | null };
type Form = { first_name: string; last_name: string; country: string; phone: string; date_of_birth: string; referral_code: string };

export default function CompleteProfilePage() {
  const [stage, setStage] = React.useState<"loading" | "form" | "expired" | "done">("loading");
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [form, setForm] = React.useState<Form>({ first_name: "", last_name: "", country: "in", phone: "", date_of_birth: "", referral_code: "" });
  const [agree, setAgree] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<ApiError | null>(null);
  const [dobMax, setDobMax] = React.useState<string>();
  const dial = COUNTRIES.find((c) => c[0] === form.country)?.[2] ?? "+91";

  React.useEffect(() => {
    setDobMax(maxDob());
    void authGet<{ profile: Profile }>("google/complete").then((r) => {
      if (!r.ok) {
        setErr(r.error);
        setStage("expired");
        return;
      }
      const p = r.data.profile;
      setProfile(p);
      setForm((f) => ({ ...f, first_name: p.first_name, last_name: p.last_name, referral_code: p.referral_code ?? "" }));
      setStage("form");
    });
  }, []);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const fieldErr = (f: string) => (err?.field === f ? err.message : undefined);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const r = await authPost("google/complete", { ...form, phone_dial: dial, referral_code: form.referral_code || null, accept_terms: agree });
    setLoading(false);
    if (r.ok) return setStage("done");
    setErr(r.error);
    if (r.error.code === "google_expired") setStage("expired");
  }

  return (
    <div>
      <Stepper steps={["Google account", "Your details", "Done"]} current={stage === "done" ? 2 : 1} className="mb-8" />
      <AnimatePresence mode="wait">
        {stage === "loading" && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-busy="true">
            <div className="h-9 w-3/4 rounded-xl bg-surface-2" />
            <div className="mt-3 h-4 w-2/3 rounded-lg bg-surface-2" />
            <div className="mt-8 h-16 rounded-[18px] bg-surface-2" />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="h-11 rounded-[14px] bg-surface-2" />
              <div className="h-11 rounded-[14px] bg-surface-2" />
            </div>
            <span className="sr-only">Loading your Google profile…</span>
          </motion.div>
        )}

        {stage === "expired" && (
          <motion.div key="expired" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
            <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">Let&apos;s start again</h1>
            <p className="mt-2 text-[14px] text-fg-2">
              {err?.code === "google_account_exists"
                ? "Your account is already set up. Continue with Google to sign in."
                : "Your Google sign-up has expired or was finished in another tab. Continue with Google to pick up where you left off."}
            </p>
            <div className="mt-8">
              <GoogleButton mode={err?.code === "google_account_exists" ? "login" : "register"} label="Continue with Google" />
            </div>
            <p className="mt-6 text-center text-[13.5px] text-fg-3">
              Prefer email?{" "}
              <Link href="/register" className="font-medium text-fg hover:text-ember">
                Sign up with email
              </Link>
            </p>
          </motion.div>
        )}

        {stage === "form" && profile && (
          <motion.div key="form" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
            <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">Complete your profile</h1>
            <p className="mt-2 text-[14px] text-fg-2">A few details we need for every Kalks account. It takes under a minute.</p>

            <div className="mt-6 flex items-center gap-3 rounded-[18px] border border-line bg-surface-2 px-4 py-3 shadow-[inset_0_1px_0_var(--k-border-top)]">
              <span className="grid size-9 shrink-0 place-items-center rounded-full border border-line bg-surface">
                <GoogleMark className="size-[18px]" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] text-fg">{profile.email}</div>
                <div className="text-[12px] text-fg-3">Google account</div>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-up/25 bg-up-soft px-2.5 py-1 text-[11.5px] font-medium text-up">
                <BadgeCheck className="size-3.5" /> Verified
              </span>
            </div>

            <form className="mt-5 space-y-3.5" onSubmit={submit} noValidate>
              <FormError>{err && !err.field ? err.message : null}</FormError>
              {err?.code === "email_taken" && (
                <p className="-mt-1 text-[12.5px] text-fg-3">
                  <Link href="/login" className="text-ember hover:underline">
                    Sign in
                  </Link>{" "}
                  with your password instead, or{" "}
                  <Link href="/forgot" className="text-ember hover:underline">
                    reset it
                  </Link>
                  .
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field label="First name" error={fieldErr("first_name")}>
                  <Input leading={<UserRound />} name="given-name" autoComplete="given-name" value={form.first_name} onChange={set("first_name")} placeholder="Arjun" required />
                </Field>
                <Field label="Last name" error={fieldErr("last_name")}>
                  <Input name="family-name" autoComplete="family-name" value={form.last_name} onChange={set("last_name")} placeholder="Mehta" required />
                </Field>
              </div>
              <div className="grid grid-cols-[1fr_1.2fr] gap-3">
                <Field label="Country of residence" error={fieldErr("country")}>
                  <div className="relative">
                    <select value={form.country} onChange={set("country")} aria-label="Country of residence" className="h-11 w-full appearance-none rounded-[14px] border border-line bg-surface-2 pl-10 pr-3 text-sm outline-none focus:border-ember/50">
                      {COUNTRIES.map(([c, n]) => (
                        <option key={c} value={c}>
                          {n}
                        </option>
                      ))}
                    </select>
                    <Flag country={form.country} className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2" />
                  </div>
                </Field>
                <Field label="Phone" error={fieldErr("phone")}>
                  <Input leading={<span className="k-num text-[13px] text-fg-2">{dial}</span>} inputMode="tel" name="tel-national" autoComplete="tel-national" value={form.phone} onChange={set("phone")} placeholder="98201 44721" required />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date of birth" error={fieldErr("date_of_birth")}>
                  <Input leading={<CalendarDays />} type="date" name="bday" autoComplete="bday" max={dobMax} value={form.date_of_birth} onChange={set("date_of_birth")} required />
                </Field>
                <Field label="Referral code" hint="optional" error={fieldErr("referral_code")}>
                  <Input leading={<Gift />} name="referral" value={form.referral_code} onChange={set("referral_code")} placeholder="ABC1234" />
                </Field>
              </div>
              <label className="flex items-start gap-3 pt-1 text-[12.5px] leading-relaxed text-fg-2">
                <input type="checkbox" name="accept" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 size-4 accent-[var(--k-ember)]" />
                <span>
                  I&apos;m over 18 and agree to the <a className="text-fg underline-offset-2 hover:underline">Client Agreement</a>, <a className="text-fg hover:underline">Risk Disclosure</a> and <a className="text-fg hover:underline">Privacy Policy</a>.
                </span>
              </label>
              {fieldErr("accept_terms") && <p className="text-xs text-down">{fieldErr("accept_terms")}</p>}
              <Button type="submit" variant="ember" size="xl" className="w-full" disabled={!agree || loading} shimmer>
                {loading ? "Creating account…" : "Create account"} <ArrowRight />
              </Button>
            </form>
            <p className="mt-5 text-center text-[13.5px] text-fg-3">
              Not you?{" "}
              <a href={`/api/auth/google/start?mode=register${profile.referral_code ? `&ref=${encodeURIComponent(profile.referral_code)}` : ""}`} className="font-medium text-fg hover:text-ember">
                Use another Google account
              </a>
            </p>
          </motion.div>
        )}

        {stage === "done" && (
          <motion.div key="done" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
            <span className="grid size-14 place-items-center rounded-2xl border border-up/30 bg-up-soft text-up">
              <CheckCircle2 className="size-7" />
            </span>
            <h1 className="mt-4 text-3xl font-medium tracking-tight sm:text-4xl">Welcome to Kalks, {form.first_name.trim()}</h1>
            <p className="mt-2 text-[14px] text-fg-2">Your account is ready and signed in with Google. Follow live markets now; funding and trading accounts are coming soon.</p>
            <Button variant="ember" size="xl" className="mt-8 w-full" onClick={() => window.location.assign(nextPath())}>
              Open client area <ArrowRight />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
