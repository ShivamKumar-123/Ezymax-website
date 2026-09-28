"use client";

import * as React from "react";
import { cn } from "@kalks/ui";

/** "Sign in with Google" is shown only once Google OAuth is configured (NEXT_PUBLIC_GOOGLE_LOGIN=1). */
export const GOOGLE_LOGIN = process.env.NEXT_PUBLIC_GOOGLE_LOGIN === "1";

export function GoogleButton({ label = "Continue with Google" }: { label?: string }) {
  return (
    <button type="button" className="flex h-12 w-full items-center justify-center gap-3 rounded-full border border-line bg-surface-2 text-[14px] font-medium text-fg shadow-[inset_0_1px_0_var(--k-border-top)] transition-colors hover:bg-surface-3">
      <svg viewBox="0 0 48 48" className="size-5">
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.3-.4-3.5z" />
      </svg>
      {label}
    </button>
  );
}

export function OrDivider() {
  return (
    <div className="my-6 flex items-center gap-3 text-[12px] text-fg-3">
      <span className="h-px flex-1 bg-line" />
      or with email
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

/** 6-digit OTP input with auto-advance and paste support. */
export function OtpInput({ length = 6, onComplete }: { length?: number; onComplete?: (code: string) => void }) {
  const [vals, setVals] = React.useState<string[]>(Array(length).fill(""));
  const refs = React.useRef<(HTMLInputElement | null)[]>([]);
  function set(i: number, v: string) {
    const digits = v.replace(/\D/g, "");
    if (digits.length > 1) {
      const next = [...vals];
      digits.split("").slice(0, length - i).forEach((d, k) => (next[i + k] = d));
      setVals(next);
      refs.current[Math.min(length - 1, i + digits.length)]?.focus();
      if (next.every(Boolean)) onComplete?.(next.join(""));
      return;
    }
    const next = [...vals];
    next[i] = digits;
    setVals(next);
    if (digits && i < length - 1) refs.current[i + 1]?.focus();
    if (next.every(Boolean)) onComplete?.(next.join(""));
  }
  return (
    <div className="flex justify-between gap-2" dir="ltr">
      {vals.map((v, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={v}
          inputMode="numeric"
          autoComplete="one-time-code"
          onChange={(e) => set(i, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !vals[i] && i > 0) refs.current[i - 1]?.focus();
          }}
          className={cn(
            "k-num h-14 w-full rounded-[14px] border bg-surface-2 text-center font-mono text-xl font-semibold outline-none transition-all focus:border-ember/60 focus:ring-4 focus:ring-ember/10",
            v ? "border-[var(--k-border-top)]" : "border-line",
          )}
        />
      ))}
    </div>
  );
}

export function PasswordStrength({ value }: { value: string }) {
  const checks = [value.length >= 8, /[A-Z]/.test(value), /[0-9]/.test(value), /[^A-Za-z0-9]/.test(value)];
  const score = checks.filter(Boolean).length;
  const label = ["Too weak", "Weak", "Fair", "Good", "Strong"][score];
  return (
    <div className="mt-2">
      <div className="flex gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cn("h-1 flex-1 rounded-full transition-colors", i < score ? (score < 2 ? "bg-down" : score < 4 ? "bg-warn" : "bg-up") : "bg-surface-3")} />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11.5px] text-fg-3">
        <span>8+ chars, uppercase, number & symbol</span>
        <span className={score >= 4 ? "text-up" : ""}>{value ? label : ""}</span>
      </div>
    </div>
  );
}

/** Inline error banner for auth forms. */
export function FormError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <div role="alert" className="rounded-[14px] border border-down/25 bg-down-soft px-4 py-3 text-[13px] text-down">
      {children}
    </div>
  );
}

/** Development only: SMTP isn't configured yet, so the gateway hands back the code it logged. */
export function DevCodeHint({ code }: { code?: string }) {
  if (!code) return null;
  return (
    <p className="mt-4 rounded-[14px] border border-dashed border-line px-4 py-2.5 text-[12px] text-fg-3">
      Dev mode: email delivery isn&apos;t configured yet. Your code is <span className="k-num font-mono text-fg">{code}</span> (also in the gateway log).
    </p>
  );
}

/** "Resend in 0:30" countdown that turns into a resend link. */
export function ResendLink({ seconds, onResend }: { seconds: number; onResend: () => Promise<number | void> }) {
  const [left, setLeft] = React.useState(seconds);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return (
    <button
      type="button"
      disabled={left > 0 || busy}
      onClick={async () => {
        setBusy(true);
        const wait = await onResend();
        setBusy(false);
        setLeft(typeof wait === "number" ? wait : seconds);
      }}
      className="text-ember hover:underline disabled:text-fg-3 disabled:no-underline"
    >
      {left > 0 ? `Resend in 0:${String(left).padStart(2, "0")}` : busy ? "Sending…" : "Resend code"}
    </button>
  );
}
