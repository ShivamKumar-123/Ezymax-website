"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Gift, Lock, Mail, UserRound, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Button, Field, Input, Stepper, Flag, Icon3D } from "@kalks/ui";
import { IS_DEMO } from "@kalks/mock/mode";
import { DemoEntry, DevCodeHint, FormError, GOOGLE_LOGIN, GoogleButton, OrDivider, OtpInput, PasswordStrength, ResendLink } from "@/components/auth";
import { authPost, type ApiError, type OtpChallenge } from "@/lib/auth-client";

const COUNTRIES = [
  ["in", "India", "+91"],
  ["ae", "United Arab Emirates", "+971"],
  ["sa", "Saudi Arabia", "+966"],
  ["qa", "Qatar", "+974"],
  ["kw", "Kuwait", "+965"],
  ["om", "Oman", "+968"],
  ["bh", "Bahrain", "+973"],
  ["eg", "Egypt", "+20"],
  ["tr", "Turkey", "+90"],
  ["vn", "Vietnam", "+84"],
  ["my", "Malaysia", "+60"],
  ["id", "Indonesia", "+62"],
  ["th", "Thailand", "+66"],
  ["ph", "Philippines", "+63"],
  ["sg", "Singapore", "+65"],
  ["bd", "Bangladesh", "+880"],
  ["lk", "Sri Lanka", "+94"],
  ["np", "Nepal", "+977"],
  ["ng", "Nigeria", "+234"],
  ["ke", "Kenya", "+254"],
  ["za", "South Africa", "+27"],
  ["br", "Brazil", "+55"],
  ["mx", "Mexico", "+52"],
  ["gb", "United Kingdom", "+44"],
] as const;

type Form = { first_name: string; last_name: string; email: string; country: string; phone: string; date_of_birth: string; referral_code: string; password: string };

function maxDob() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().slice(0, 10);
}

export default function RegisterPage() {
  const [step, setStep] = React.useState(0);
  const [form, setForm] = React.useState<Form>({ first_name: "", last_name: "", email: "", country: "in", phone: "", date_of_birth: "", referral_code: "", password: "" });
  const [agree, setAgree] = React.useState(false);
  const [show, setShow] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<ApiError | null>(null);
  const [otp, setOtp] = React.useState<OtpChallenge | null>(null);
  const [otpKey, setOtpKey] = React.useState(0);
  const [code, setCode] = React.useState("");
  const [dobMax, setDobMax] = React.useState<string>();
  const dial = COUNTRIES.find((c) => c[0] === form.country)?.[2] ?? "+91";

  React.useEffect(() => {
    setDobMax(maxDob());
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) setForm((f) => ({ ...f, referral_code: ref.slice(0, 24) }));
  }, []);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const fieldErr = (f: string) => (err?.field === f ? err.message : undefined);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const r = await authPost<OtpChallenge>("register", { ...form, phone_dial: dial, referral_code: form.referral_code || null, accept_terms: agree });
    setLoading(false);
    if (!r.ok) return setErr(r.error);
    setOtp(r.data);
    setOtpKey((k) => k + 1);
    setStep(1);
  }

  async function verify(value = code) {
    if (!otp || value.length !== 6) return;
    setErr(null);
    setLoading(true);
    const r = await authPost("verify-email", { challenge: otp.challenge, code: value });
    setLoading(false);
    if (r.ok) return setStep(2);
    setErr(r.error);
    setCode("");
    setOtpKey((k) => k + 1);
  }

  return (
    <div>
      <Stepper steps={["Details", "Verify email", "Done"]} current={step} className="mb-8" />
      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div key="s0" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
            <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">Create your Kalks account</h1>
            <p className="mt-2 text-[14px] text-fg-2">{IS_DEMO ? "Open a free demo instantly. Go live whenever you're ready." : "Sign up in a minute and follow live markets straight away."}</p>
            {IS_DEMO && <DemoEntry />}
            {GOOGLE_LOGIN && (
              <>
                <div className="mt-6">
                  <GoogleButton label="Sign up with Google" />
                </div>
                <OrDivider />
              </>
            )}
            <form className={GOOGLE_LOGIN ? "space-y-3.5" : "mt-6 space-y-3.5"} onSubmit={submit} noValidate>
              <FormError>{err && !err.field ? err.message : null}</FormError>
              <div className="grid grid-cols-2 gap-3">
                <Field label="First name" error={fieldErr("first_name")}>
                  <Input leading={<UserRound />} name="given-name" autoComplete="given-name" value={form.first_name} onChange={set("first_name")} placeholder="Arjun" required />
                </Field>
                <Field label="Last name" error={fieldErr("last_name")}>
                  <Input name="family-name" autoComplete="family-name" value={form.last_name} onChange={set("last_name")} placeholder="Mehta" required />
                </Field>
              </div>
              <Field label="Email" error={fieldErr("email")}>
                <Input leading={<Mail />} type="email" name="email" autoComplete="email" value={form.email} onChange={set("email")} placeholder="you@example.com" required />
              </Field>
              {err?.code === "email_taken" && (
                <p className="-mt-1 text-[12.5px] text-fg-3">
                  <Link href="/login" className="text-ember hover:underline">
                    Sign in
                  </Link>{" "}
                  or{" "}
                  <Link href="/forgot" className="text-ember hover:underline">
                    reset your password
                  </Link>
                  .
                </p>
              )}
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
              <Field label="Password" error={fieldErr("password")}>
                <Input
                  leading={<Lock />}
                  type={show ? "text" : "password"}
                  name="new-password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={set("password")}
                  placeholder="Create a strong password"
                  required
                  trailing={
                    <button type="button" onClick={() => setShow((s) => !s)} className="hover:text-fg" aria-label="Toggle password">
                      {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  }
                />
                <PasswordStrength value={form.password} />
              </Field>
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
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-fg hover:text-ember">
                Sign in
              </Link>
            </p>
          </motion.div>
        )}
        {step === 1 && (
          <motion.div key="s1" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
            <Icon3D name="bell" size={64} />
            <h1 className="mt-4 text-3xl font-medium tracking-tight sm:text-4xl">Check your inbox</h1>
            <p className="mt-2 text-[14px] text-fg-2">
              Enter the 6-digit code we sent to <span className="text-fg">{otp?.email_masked}</span>.
            </p>
            <div className="mt-8 space-y-4">
              <FormError>{err?.message}</FormError>
              <OtpInput
                key={otpKey}
                onComplete={(c) => {
                  setCode(c);
                  void verify(c);
                }}
              />
            </div>
            <DevCodeHint code={otp?.dev_code} />
            <Button variant="ember" size="xl" className="mt-6 w-full" disabled={loading || code.length !== 6} onClick={() => verify()}>
              {loading ? "Verifying…" : "Verify email"}
            </Button>
            <div className="mt-5 text-right text-[13px] text-fg-3">
              Didn&apos;t get it?{" "}
              <ResendLink
                key={otp?.challenge}
                seconds={otp?.resend_in ?? 30}
                onResend={async () => {
                  if (!otp) return;
                  const r = await authPost<OtpChallenge>("resend", { challenge: otp.challenge });
                  if (!r.ok) {
                    setErr(r.error);
                    return r.error.retry_after;
                  }
                  setErr(null);
                  setOtp(r.data);
                  setOtpKey((k) => k + 1);
                  toast.success("New code sent", { description: `Check ${r.data.email_masked}` });
                }}
              />
            </div>
          </motion.div>
        )}
        {step === 2 && (
          <motion.div key="s2" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
            <span className="grid size-14 place-items-center rounded-2xl border border-up/30 bg-up-soft text-up">
              <CheckCircle2 className="size-7" />
            </span>
            <h1 className="mt-4 text-3xl font-medium tracking-tight sm:text-4xl">Welcome to Kalks, {form.first_name.trim()}</h1>
            <p className="mt-2 text-[14px] text-fg-2">{IS_DEMO ? "Your email is verified and your account is ready. Open a demo account now, or verify your identity to go live." : "Your email is verified and your account is ready. Follow live markets now; funding and trading accounts are coming soon."}</p>
            <Button variant="ember" size="xl" className="mt-8 w-full" onClick={() => window.location.assign("/")}>
              Open client area <ArrowRight />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
