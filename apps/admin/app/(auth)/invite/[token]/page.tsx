"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, KeyRound, Lock, MailCheck, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button, Field, Input, Skeleton } from "@ezymex/ui";
import { OtpInput } from "@/components/auth/otp-input";

// Staff invite (D111): the link proves the invite, a new password activates the account, and the emailed
// sign-in code proves the mailbox before the first session is issued.

type ApiError = { code: string; message: string; field?: string; retry_after?: number };
type Info = { email: string; email_masked: string; name: string; role_label: string; tenant: { name: string }; expires_at: string };
type Challenge = { status: "otp_required"; challenge: string; email_masked: string; expires_in: number; resend_in: number; dev_code?: string };

async function post<T>(action: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; error: ApiError }> {
  try {
    const res = await fetch(`/api/auth/${action}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, data: data as T };
    return { ok: false, error: data?.error ?? { code: "unknown", message: "Something went wrong. Please try again." } };
  } catch {
    return { ok: false, error: { code: "network", message: "Can't reach the Back Office. Check your connection." } };
  }
}

function FormError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <div role="alert" className="rounded-[14px] border border-down/25 bg-down-soft px-4 py-3 text-[13px] text-down">
      {children}
    </div>
  );
}

const RULES: [string, (p: string) => boolean][] = [
  ["8+ characters", (p) => p.length >= 8],
  ["Upper and lower case", (p) => /[a-z]/.test(p) && /[A-Z]/.test(p)],
  ["A number and a symbol", (p) => /\d/.test(p) && /[^A-Za-z0-9]/.test(p)],
];

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = React.useState<Info | null>(null);
  const [gone, setGone] = React.useState<ApiError | null>(null);
  const [step, setStep] = React.useState<"password" | "otp">("password");
  const [pw, setPw] = React.useState("");
  const [pw2, setPw2] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [err, setErr] = React.useState<ApiError | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [otp, setOtp] = React.useState<Challenge | null>(null);
  const [otpKey, setOtpKey] = React.useState(0);

  React.useEffect(() => {
    fetch(`/api/auth/invite?token=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (r.ok) setInfo(d as Info);
        else setGone(d?.error ?? { code: "invite_expired", message: "This invite link has expired." });
      })
      .catch(() => setGone({ code: "network", message: "Can't reach the Back Office. Check your connection." }));
  }, [token]);

  async function activate(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (pw !== pw2) return setErr({ code: "validation", field: "password2", message: "The passwords don't match." });
    setBusy(true);
    const r = await post<Challenge>("invite-accept", { token, password: pw });
    setBusy(false);
    if (!r.ok) {
      if (r.error.code === "invite_expired") setGone(r.error);
      return setErr(r.error);
    }
    setOtp(r.data);
    setStep("otp");
  }

  async function verify(code: string) {
    if (!otp) return;
    setErr(null);
    setBusy(true);
    const r = await post<{ staff: { name: string } }>("verify-otp", { challenge: otp.challenge, code });
    if (r.ok) {
      toast.success("Welcome to the Back Office", { description: r.data.staff.name });
      setTimeout(() => window.location.assign("/"), 300);
      return;
    }
    setBusy(false);
    setErr(r.error);
    setOtpKey((k) => k + 1);
  }

  if (gone) {
    return (
      <div>
        <span className="grid size-12 place-items-center rounded-2xl border border-line bg-surface-2 text-fg-3">
          <Lock className="size-6" />
        </span>
        <h1 className="mt-5 text-[28px] font-medium tracking-[-0.02em]">Invite not available</h1>
        <p className="mt-2 text-[14.5px] text-fg-2">{gone.message}</p>
        <Link href="/login" className="mt-6 inline-flex text-[14px] text-ember hover:underline">
          Go to staff sign-in
        </Link>
      </div>
    );
  }
  if (!info) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (step === "otp") {
    return (
      <div>
        <span className="grid size-12 place-items-center rounded-2xl border border-ember/30 bg-ember-soft text-ember">
          <MailCheck className="size-6" />
        </span>
        <h1 className="mt-5 text-[28px] font-medium tracking-[-0.02em]">Confirm your email</h1>
        <p className="mt-2 text-[14.5px] text-fg-2">
          Password set. We sent a 6-digit code to <span className="text-fg">{otp?.email_masked}</span>; every sign-in asks for one.
        </p>
        <div className="mt-8 space-y-4">
          <FormError>{err?.message}</FormError>
          <OtpInput key={otpKey} onComplete={(c) => void verify(c)} />
        </div>
        {otp?.dev_code && (
          <p className="mt-4 rounded-[14px] border border-dashed border-line px-4 py-2.5 text-[12px] text-fg-3">
            Dev mode: email delivery isn&apos;t configured yet. Your code is <span className="k-num font-mono text-fg">{otp.dev_code}</span>.
          </p>
        )}
        {busy && <p className="mt-4 text-[13px] text-fg-3">Verifying…</p>}
      </div>
    );
  }

  const fieldErr = (f: string) => (err?.field === f ? err.message : undefined);
  return (
    <div>
      <span className="inline-flex items-center gap-2 rounded-full border border-ember/30 bg-ember-soft px-3 py-1 text-[11px] font-semibold tracking-[0.14em] text-ember">
        <ShieldCheck className="size-3.5" /> STAFF INVITE
      </span>
      <h1 className="mt-5 text-[30px] font-medium tracking-[-0.02em]">Welcome, {info.name.split(" ")[0]}</h1>
      <p className="mt-2 text-[14.5px] text-fg-2">
        You&apos;ve been invited to the <span className="text-fg">{info.tenant.name}</span> Back Office as <span className="text-fg">{info.role_label}</span>. Set a password for{" "}
        <span className="text-fg">{info.email}</span>.
      </p>
      <form method="post" className="mt-7 space-y-4" onSubmit={activate} noValidate>
        <FormError>{err && !err.field ? err.message : null}</FormError>
        <Field label="New password" error={fieldErr("password")}>
          <Input
            leading={<KeyRound />}
            type={show ? "text" : "password"}
            autoComplete="new-password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            trailing={
              <button type="button" onClick={() => setShow((s) => !s)} className="hover:text-fg" aria-label="Show password">
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            }
          />
        </Field>
        <Field label="Repeat password" error={fieldErr("password2")}>
          <Input leading={<Lock />} type={show ? "text" : "password"} autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </Field>
        <ul className="grid grid-cols-3 gap-2 text-[11.5px]">
          {RULES.map(([label, ok]) => (
            <li key={label} className={ok(pw) ? "text-up" : "text-fg-3"}>
              {label}
            </li>
          ))}
        </ul>
        <Button type="submit" variant="ember" size="xl" className="w-full" disabled={busy || !pw || !pw2}>
          {busy ? "Activating…" : "Activate account"} <ArrowRight />
        </Button>
      </form>
      <p className="mt-5 text-[12px] text-fg-3">The link works once. Sign-ins are audited and need a code from your work email.</p>
    </div>
  );
}
