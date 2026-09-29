"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mail, Lock, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button, Field, Input } from "@kalks/ui";
import { useT, Trans } from "@kalks/i18n/react";
import { DevCodeHint, FormError, OtpInput, PasswordStrength, ResendLink } from "@/components/auth";
import { authPost, type ApiError, type OtpChallenge } from "@/lib/auth-client";

export default function ForgotPage() {
  const t = useT();
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [email, setEmail] = React.useState("");
  const [pw, setPw] = React.useState("");
  const [code, setCode] = React.useState("");
  const [otp, setOtp] = React.useState<OtpChallenge | null>(null);
  const [otpKey, setOtpKey] = React.useState(0);
  const [err, setErr] = React.useState<ApiError | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setErr(null);
    setLoading(true);
    const r = await authPost<OtpChallenge>("forgot", { email });
    setLoading(false);
    if (!r.ok) return setErr(r.error);
    setOtp(r.data);
    setOtpKey((k) => k + 1);
    setStep(1);
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    if (!otp) return;
    setErr(null);
    setLoading(true);
    const r = await authPost("reset", { challenge: otp.challenge, code, password: pw });
    setLoading(false);
    if (r.ok) {
      toast.success(t("auth.forgot.toastUpdated"), { description: t("auth.forgot.toastUpdatedBody") });
      router.push("/login");
      return;
    }
    setErr(r.error);
    if (r.error.field !== "password") {
      // wrong / expired code: go back to the code step
      setCode("");
      setOtpKey((k) => k + 1);
      setStep(1);
    }
  }

  return (
    <div>
      <Link href="/login" className="mb-8 inline-flex items-center gap-2 text-[13px] text-fg-3 hover:text-fg">
        <ArrowLeft className="size-4 rtl:-scale-x-100" /> {t("auth.forgot.backToSignIn")}
      </Link>
      <span className="grid size-12 place-items-center rounded-2xl border border-ember/30 bg-ember-soft text-ember">
        <KeyRound className="size-6" />
      </span>
      <h1 className="mt-5 text-3xl font-medium tracking-tight sm:text-4xl">{step === 0 ? t("auth.forgot.titleReset") : step === 1 ? t("auth.forgot.titleCode") : t("auth.forgot.titleNew")}</h1>
      <p className="mt-2 text-[14px] text-fg-2">
        {step === 0 ? (
          t("auth.forgot.intro")
        ) : step === 1 ? (
          <Trans k="auth.forgot.codeSent" vars={{ email: otp?.email_masked }} tags={{ b: (c) => <span className="text-fg">{c}</span> }} />
        ) : (
          t("auth.forgot.passwordRule")
        )}
      </p>
      <div className="mt-8 space-y-4">
        <FormError>{err && (step !== 2 || !err.field) ? err.message : null}</FormError>
        {step === 0 && (
          <form method="post" className="space-y-4" onSubmit={sendCode} noValidate>
            <Field label={t("auth.field.email")} error={err?.field === "email" ? err.message : undefined}>
              <Input leading={<Mail />} type="email" name="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("auth.placeholder.email")} />
            </Field>
            <Button type="submit" variant="ember" size="xl" className="w-full" disabled={loading}>
              {loading ? t("auth.otp.sending") : t("auth.forgot.sendCode")}
            </Button>
          </form>
        )}
        {step === 1 && (
          <>
            <OtpInput
              key={otpKey}
              onComplete={(c) => {
                setCode(c);
                setErr(null);
                setTimeout(() => setStep(2), 300);
              }}
            />
            <DevCodeHint code={otp?.dev_code} />
            <div className="text-end text-[13px] text-fg-3">
              {t("auth.otp.didntGetIt")}{" "}
              <ResendLink
                key={otp?.challenge}
                seconds={otp?.resend_in ?? 30}
                onResend={async () => {
                  if (!otp) return;
                  const r = await authPost<OtpChallenge>("resend", { challenge: otp.challenge });
                  if (!r.ok) {
                    // unknown email (no real challenge) or too many sends: start over
                    if (r.error.code === "code_expired") return void sendCode();
                    setErr(r.error);
                    return r.error.retry_after;
                  }
                  setErr(null);
                  setOtp(r.data);
                  setOtpKey((k) => k + 1);
                  toast.success(t("auth.toast.newCodeSent"), { description: t("auth.toast.checkEmail", { email: r.data.email_masked }) });
                }}
              />
            </div>
          </>
        )}
        {step === 2 && (
          <form method="post" className="space-y-4" onSubmit={reset} noValidate>
            <Field label={t("auth.field.newPassword")} error={err?.field === "password" ? err.message : undefined}>
              <Input leading={<Lock />} type="password" name="new-password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
              <PasswordStrength value={pw} />
            </Field>
            <Button type="submit" variant="ember" size="xl" className="w-full" disabled={loading || !pw}>
              {loading ? t("auth.forgot.updating") : t("auth.forgot.update")}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
