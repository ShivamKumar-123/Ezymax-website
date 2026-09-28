"use client";

import * as React from "react";
import Link from "next/link";
import { Eye, EyeOff, Lock, Mail, ArrowRight, ShieldCheck } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Button, Field, Input } from "@kalks/ui";
import { DevCodeHint, FormError, GoogleButton, OrDivider, OtpInput, ResendLink } from "@/components/auth";
import { authPost, nextPath, type ApiError, type OtpChallenge } from "@/lib/auth-client";

export default function LoginPage() {
  const [show, setShow] = React.useState(false);
  const [step, setStep] = React.useState<"creds" | "otp">("creds");
  const [loading, setLoading] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [err, setErr] = React.useState<ApiError | null>(null);
  const [otp, setOtp] = React.useState<OtpChallenge | null>(null);
  const [otpKey, setOtpKey] = React.useState(0);
  const [code, setCode] = React.useState("");

  const done = () => window.location.assign(nextPath());

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const r = await authPost<{ status: "ok" } | OtpChallenge>("login", { email, password });
    setLoading(false);
    if (!r.ok) {
      setErr(r.error);
      if (r.error.code === "invalid_credentials") setPassword("");
      return;
    }
    if (r.data.status === "ok") return done();
    setOtp(r.data);
    setCode("");
    setOtpKey((k) => k + 1);
    setStep("otp");
  }

  async function verify(value = code) {
    if (!otp || value.length !== 6) return;
    setErr(null);
    setLoading(true);
    const r = await authPost("verify-email", { challenge: otp.challenge, code: value });
    if (r.ok) return done();
    setLoading(false);
    setErr(r.error);
    setCode("");
    setOtpKey((k) => k + 1);
  }

  const fieldErr = (f: string) => (err?.field === f ? err.message : undefined);
  const formErr = err && !err.field ? err.message : null;

  return (
    <AnimatePresence mode="wait">
      {step === "creds" ? (
        <motion.div key="creds" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
          <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">Welcome back</h1>
          <p className="mt-2 text-[14.5px] text-fg-2">Sign in to your Kalks client area.</p>
          <div className="mt-8">
            <GoogleButton />
          </div>
          <OrDivider />
          <form className="space-y-4" onSubmit={signIn} noValidate>
            <FormError>{formErr}</FormError>
            <Field label="Email" error={fieldErr("email")}>
              <Input leading={<Mail />} type="email" name="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
            </Field>
            <Field label="Password" error={fieldErr("password")} hint={<Link href="/forgot" className="text-ember hover:underline">Forgot password?</Link>}>
              <Input
                leading={<Lock />}
                type={show ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                trailing={
                  <button type="button" onClick={() => setShow((s) => !s)} className="hover:text-fg" aria-label="Toggle password">
                    {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                }
              />
            </Field>
            <Button type="submit" variant="ember" size="xl" className="w-full" shimmer disabled={loading}>
              {loading ? "Signing in…" : "Sign in"} <ArrowRight />
            </Button>
          </form>
          <p className="mt-6 text-center text-[13.5px] text-fg-3">
            New to Kalks?{" "}
            <Link href="/register" className="font-medium text-fg hover:text-ember">
              Create an account
            </Link>
          </p>
        </motion.div>
      ) : (
        <motion.div key="otp" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
          <span className="grid size-12 place-items-center rounded-2xl border border-ember/30 bg-ember-soft text-ember">
            <ShieldCheck className="size-6" />
          </span>
          <h1 className="mt-5 text-3xl font-medium tracking-tight sm:text-4xl">{otp?.purpose === "verify_email" ? "Verify your email" : "Verify it's you"}</h1>
          <p className="mt-2 text-[14.5px] text-fg-2">
            {otp?.purpose === "verify_email" ? "Your email isn't verified yet." : "New device detected."} We sent a 6-digit code to <span className="text-fg">{otp?.email_masked}</span>.
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
            {loading ? "Verifying…" : "Verify & continue"}
          </Button>
          <div className="mt-5 flex items-center justify-between text-[13px] text-fg-3">
            <button
              onClick={() => {
                setErr(null);
                setStep("creds");
              }}
              className="hover:text-fg"
            >
              ← Back
            </button>
            <span>
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
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
