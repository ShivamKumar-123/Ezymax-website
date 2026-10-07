"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Check, Eye, EyeOff, Mail, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button, CopyButton, Input, cn } from "@/components/kit";
import { ME } from "@kalks/mock";
import { Trans, useT } from "@kalks/i18n/react";

/* ------------------------------------------------------------------ */
/* Password strength                                                   */
/* ------------------------------------------------------------------ */

export const PASSWORD_RULES = [
  { key: "len", label: "accountDetail.pwRule.len" as const, test: (p: string) => p.length >= 8 && p.length <= 16 },
  { key: "lower", label: "accountDetail.pwRule.lower" as const, test: (p: string) => /[a-z]/.test(p) },
  { key: "upper", label: "accountDetail.pwRule.upper" as const, test: (p: string) => /[A-Z]/.test(p) },
  { key: "num", label: "accountDetail.pwRule.num" as const, test: (p: string) => /\d/.test(p) },
  { key: "sym", label: "accountDetail.pwRule.sym" as const, test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export function passwordScore(p: string) {
  if (!p) return 0;
  const passed = PASSWORD_RULES.filter((r) => r.test(p)).length;
  const bonus = p.length >= 12 ? 1 : 0;
  return Math.min(4, Math.max(1, passed - 1 + bonus));
}

const LEVELS = [
  { label: "accountDetail.pwStrength.tooShort" as const, tone: "bg-fg-3", text: "text-fg-3" },
  { label: "accountDetail.pwStrength.weak" as const, tone: "bg-down", text: "text-down" },
  { label: "accountDetail.pwStrength.fair" as const, tone: "bg-warn", text: "text-warn" },
  { label: "accountDetail.pwStrength.good" as const, tone: "bg-gold", text: "text-gold" },
  { label: "accountDetail.pwStrength.strong" as const, tone: "bg-up", text: "text-up" },
];

export function isPasswordValid(p: string) {
  return PASSWORD_RULES.every((r) => r.test(p));
}

export function PasswordStrength({ password, showRules = true }: { password: string; showRules?: boolean }) {
  const t = useT();
  const score = passwordScore(password);
  const lvl = LEVELS[score]!;
  return (
    <div>
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
            <motion.div className={cn("h-full rounded-full", lvl.tone)} initial={false} animate={{ width: score >= i ? "100%" : "0%" }} transition={{ duration: 0.35 }} />
          </div>
        ))}
        <span className={cn("ms-2 w-16 text-end text-[12px] font-medium", lvl.text)}>{password ? t(lvl.label) : ""}</span>
      </div>
      {showRules && (
        <ul className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {PASSWORD_RULES.map((r) => {
            const ok = r.test(password);
            return (
              <li key={r.key} className={cn("flex items-center gap-2 text-[12.5px] transition-colors", ok ? "text-up" : "text-fg-3")}>
                <span className={cn("grid size-4 place-items-center rounded-full border", ok ? "border-up/40 bg-up-soft" : "border-line")}>{ok && <Check className="size-2.5" />}</span>
                {t(r.label)}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function generatePassword(len = 12) {
  const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnopqrstuvwxyz", "23456789", "!@#$%&*?"];
  const all = sets.join("");
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)]!;
  const chars = sets.map(pick);
  while (chars.length < len) chars.push(pick(all));
  return chars.sort(() => Math.random() - 0.5).join("");
}

export function PasswordInput({ value, onChange, placeholder, generate }: { value: string; onChange: (v: string) => void; placeholder?: string; generate?: boolean }) {
  const t = useT();
  const [show, setShow] = React.useState(false);
  return (
    <Input
      type={show ? "text" : "password"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? t("accountDetail.pwInput.placeholder")}
      // monospace only for the typed value (easier to read a generated password); the placeholder stays in the UI font
      inputClassName={cn(value && "font-mono")}
      autoComplete="new-password"
      trailing={
        <>
          {generate && (
            <button
              type="button"
              className="flex items-center gap-1 rounded-full px-2 py-1 text-[11.5px] font-medium text-ember hover:bg-ember-soft"
              onClick={() => {
                onChange(generatePassword());
                setShow(true);
                toast.success(t("accountDetail.pwInput.generated"));
              }}
            >
              <RefreshCw className="size-3" /> {t("accountDetail.pwInput.generate")}
            </button>
          )}
          <button type="button" onClick={() => setShow((s) => !s)} className="hover:text-fg" aria-label={show ? t("accountDetail.pwInput.hide") : t("accountDetail.pwInput.show")}>
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </>
      }
    />
  );
}

/* ------------------------------------------------------------------ */
/* Email OTP                                                           */
/* ------------------------------------------------------------------ */

export function maskEmail(e: string) {
  const [u, d] = e.split("@");
  return `${u!.slice(0, 2)}•••${u!.slice(-1)}@${d}`;
}

export function OtpInput({ value, onChange, length = 6, autoFocus }: { value: string; onChange: (v: string) => void; length?: number; autoFocus?: boolean }) {
  const t = useT();
  const refs = React.useRef<(HTMLInputElement | null)[]>([]);
  const set = (i: number, ch: string) => {
    const arr = value.padEnd(length, " ").split("");
    arr[i] = ch || " ";
    onChange(arr.join("").replace(/\s+$/, ""));
  };
  return (
    <div className="flex gap-2" dir="ltr">
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          autoFocus={autoFocus && i === 0}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          value={value[i]?.trim() ?? ""}
          onChange={(e) => {
            let v = e.target.value.replace(/\D/g, "");
            const had = !!value[i]?.trim();
            if (v.length > 2 || (v.length === 2 && !had)) {
              // pasted / autofilled code
              const code = (value.slice(0, i).replace(/\s/g, "") + v).slice(0, length);
              onChange(code);
              refs.current[Math.min(length - 1, code.length)]?.focus();
              return;
            }
            if (v.length === 2) v = v.replace(value[i]!, "").slice(-1) || v.slice(-1);
            set(i, v);
            if (v && i < length - 1) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !value[i]?.trim() && i > 0) refs.current[i - 1]?.focus();
          }}
          onPaste={(e) => {
            const v = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
            if (v) {
              e.preventDefault();
              onChange(v);
              refs.current[Math.min(length - 1, v.length)]?.focus();
            }
          }}
          className={cn(
            "k-num h-12 w-full min-w-0 max-w-12 rounded-[14px] border bg-surface-2 text-center font-mono text-lg font-semibold text-fg outline-none transition-colors focus:border-ember/60 focus:ring-4 focus:ring-ember/10",
            value[i]?.trim() ? "border-ember/30" : "border-line",
          )}
          aria-label={t("accountDetail.otp.digit", { n: i + 1 })}
        />
      ))}
    </div>
  );
}

/** "Send code" → 6-digit input with resend countdown. `onChange` reports the code. */
export function EmailOtp({ code, onCode, purpose: purposeProp }: { code: string; onCode: (v: string) => void; purpose?: string }) {
  const t = useT();
  const purpose = purposeProp ?? t("accountDetail.otp.defaultPurpose");
  const [sent, setSent] = React.useState(false);
  const [left, setLeft] = React.useState(0);
  React.useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  const send = () => {
    setSent(true);
    setLeft(59);
    toast.success(t("accountDetail.otp.sent"), { description: t("accountDetail.otp.check", { email: maskEmail(ME.email) }) });
  };
  return (
    <div className="k-row p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full border border-ember/30 bg-ember-soft text-ember">
          <Mail className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-medium">{t("accountDetail.otp.title")}</div>
          <div className="text-[12.5px] text-fg-3">
            {sent ? (
              <Trans k="accountDetail.otp.enterCode" vars={{ email: maskEmail(ME.email), purpose }} tags={{ email: (c) => <span className="text-fg-2">{c}</span> }} />
            ) : (
              <>{t("accountDetail.otp.willSend", { email: maskEmail(ME.email), purpose })}</>
            )}
          </div>
        </div>
        {!sent && (
          <Button size="sm" variant="surface" type="button" onClick={send}>
            {t("accountDetail.otp.send")}
          </Button>
        )}
      </div>
      {sent && (
        <div className="mt-4">
          <OtpInput value={code} onChange={onCode} autoFocus />
          <div className="mt-3 flex items-center justify-between text-[12px] text-fg-3">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-up" /> {t("accountDetail.otp.validFor")}
            </span>
            {left > 0 ? (
              <span className="k-num">{t("accountDetail.otp.resendIn", { time: `0:${String(left).padStart(2, "0")}` })}</span>
            ) : (
              <button type="button" className="font-medium text-ember hover:underline" onClick={send}>
                {t("accountDetail.otp.resend")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Credential field                                                    */
/* ------------------------------------------------------------------ */

export function CredentialField({ label, value, secret, mono = true, hint }: { label: string; value: string; secret?: boolean; mono?: boolean; hint?: React.ReactNode }) {
  const t = useT();
  const [show, setShow] = React.useState(!secret);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[12px] font-medium text-fg-2">
        {label}
        {hint && <span className="font-normal text-fg-3">{hint}</span>}
      </div>
      <div className="flex h-11 items-center gap-2 rounded-[14px] border border-line bg-surface-2 px-3.5">
        <span className={cn("min-w-0 flex-1 truncate text-[14px] text-fg", mono && "font-mono")}>{show ? value : "•".repeat(Math.min(12, value.length))}</span>
        {secret && (
          <button type="button" onClick={() => setShow((s) => !s)} className="text-fg-3 hover:text-fg" aria-label={show ? t("accountDetail.field.hide") : t("accountDetail.field.show")}>
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
        <CopyButton value={value} label={label} />
      </div>
    </div>
  );
}
