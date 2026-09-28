"use client";

// Step-up confirmation (D20): sensitive changes (trading / investor passwords, leverage, the Client Area password,
// withdrawals) need a 6-digit code emailed to the client, even inside a session.
//
//   1. /api/auth/stepup {action, target}            -> code emailed, challenge returned
//   2. /api/auth/stepup-verify {challenge, code, …}  -> single-use step-up token (5 min, bound to action + target)
//   3. the change request carries `stepup_token`; the server redeems it with the gateway before acting.

import * as React from "react";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { Button, Dialog } from "@kalks/ui";
import { DevCodeHint, FormError, OtpInput, ResendLink } from "@/components/auth";
import { authPost, type ApiError, type OtpChallenge } from "@/lib/auth-client";

export type StepUpAction = "trading_password" | "investor_password" | "leverage" | "withdrawal" | "account_password" | "profile_email" | "profile_phone";

/** Errors from the change request that mean the confirmation has to be done again. */
export const STEPUP_CODES = new Set(["stepup_required", "stepup_invalid"]);

function signInAgain() {
  window.location.assign(`/api/auth/expired?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
}

export function useStepUp(action: StepUpAction, target = "") {
  const [challenge, setChallenge] = React.useState<OtpChallenge | null>(null);
  const [err, setErr] = React.useState<ApiError | null>(null);
  const [sending, setSending] = React.useState(false);
  const [verifying, setVerifying] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [otpKey, setOtpKey] = React.useState(0);
  const seq = React.useRef(0);

  const fail = React.useCallback((e: ApiError) => {
    if (e.code === "unauthorized") signInAgain();
    setErr(e);
  }, []);

  /** Emails a fresh code. Resolves false when it couldn't be sent (error in `err`). */
  const start = React.useCallback(async () => {
    const id = ++seq.current;
    setSending(true);
    setErr(null);
    setCode("");
    const r = await authPost<OtpChallenge>("stepup", { action, target });
    if (id !== seq.current) return false; // a newer request superseded this one
    setSending(false);
    if (!r.ok) {
      fail(r.error);
      return false;
    }
    setChallenge(r.data);
    setOtpKey((k) => k + 1);
    return true;
  }, [action, target, fail]);

  /** Exchanges the code for a step-up token; null on a wrong / expired code (error in `err`, boxes cleared). */
  const verify = async (c = code): Promise<string | null> => {
    if (!challenge || c.length !== 6 || verifying) return null;
    setVerifying(true);
    setErr(null);
    const r = await authPost<{ stepup_token: string }>("stepup-verify", { challenge: challenge.challenge, code: c, action, target });
    setVerifying(false);
    if (!r.ok) {
      fail(r.error);
      setCode("");
      setOtpKey((k) => k + 1);
      return null;
    }
    return r.data.stepup_token;
  };

  const resend = async (): Promise<number | void> => {
    if (!challenge) return;
    const r = await authPost<OtpChallenge>("stepup-resend", { challenge: challenge.challenge });
    if (!r.ok) {
      // used up or expired: start over with a new challenge
      if (r.error.code === "code_expired") {
        await start();
        return;
      }
      fail(r.error);
      return r.error.retry_after;
    }
    setErr(null);
    setChallenge(r.data);
    setCode("");
    setOtpKey((k) => k + 1);
    toast.success("New code sent", { description: `Check ${r.data.email_masked}` });
  };

  const reset = React.useCallback(() => {
    seq.current++;
    setSending(false);
    setChallenge(null);
    setErr(null);
    setCode("");
  }, []);

  return { action, target, challenge, err, setErr, sending, verifying, code, setCode, otpKey, start, verify, resend, reset };
}

export type StepUp = ReturnType<typeof useStepUp>;

/** The code step: where it was sent, six boxes (submits on the sixth digit), errors and the resend countdown. */
export function StepUpCode({ s, what, onSubmit }: { s: StepUp; what: string; onSubmit: (code: string) => void }) {
  const mins = Math.max(1, Math.round((s.challenge?.expires_in ?? 600) / 60));
  return (
    <div className="space-y-4">
      <div className="k-row flex items-start gap-3 p-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-full border border-ember/30 bg-ember-soft text-ember">
          <Mail className="size-4" />
        </span>
        <div className="min-w-0 text-[13px] leading-relaxed text-fg-2">
          To {what}, enter the 6-digit code we sent to <span className="text-fg">{s.challenge?.email_masked}</span>. It expires in {mins} minutes.
        </div>
      </div>
      <FormError>{s.err?.message}</FormError>
      <OtpInput
        key={s.otpKey}
        onComplete={(c) => {
          s.setCode(c);
          onSubmit(c);
        }}
      />
      <DevCodeHint code={s.challenge?.dev_code} />
      <div className="flex items-center justify-between gap-3 text-[12.5px] text-fg-3">
        <span>Didn&apos;t get it? Check your spam folder.</span>
        <ResendLink key={s.challenge?.challenge} seconds={s.challenge?.resend_in ?? 30} onResend={s.resend} />
      </div>
    </div>
  );
}

/**
 * A dialog that emails a code as soon as it opens and, once the code checks out, calls `onConfirmed(token)`.
 * `onConfirmed` performs the change (sending `stepup_token`) and reports its own outcome; the dialog closes after it.
 */
export function StepUpDialog({
  open,
  onOpenChange,
  action,
  target = "",
  title,
  description,
  what,
  confirmLabel = "Confirm",
  onConfirmed,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  action: StepUpAction;
  target?: string;
  title: string;
  description?: React.ReactNode;
  /** "change the leverage of #10000123": completes "To …, enter the code". */
  what: string;
  confirmLabel?: string;
  onConfirmed: (token: string) => Promise<void>;
}) {
  const s = useStepUp(action, target);
  const [busy, setBusy] = React.useState(false);
  const { start, reset } = s;
  const sent = React.useRef(false);

  // one code per opening (the ref also keeps React's dev double-effect from sending two)
  React.useEffect(() => {
    if (open && !sent.current) {
      sent.current = true;
      void start();
    } else if (!open) {
      sent.current = false;
      reset();
    }
  }, [open, start, reset]);

  const submit = async (c?: string) => {
    if (busy) return;
    const token = await s.verify(c);
    if (!token) return;
    setBusy(true);
    try {
      await onConfirmed(token);
    } catch {
      // onConfirmed reports its own failures
    } finally {
      setBusy(false);
      onOpenChange(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      width={480}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="ember" disabled={!s.challenge || s.code.length !== 6 || s.verifying || busy} onClick={() => void submit()}>
            {s.verifying ? "Checking…" : busy ? "Saving…" : confirmLabel}
          </Button>
        </>
      }
    >
      {s.challenge ? (
        <StepUpCode s={s} what={what} onSubmit={(c) => void submit(c)} />
      ) : s.err ? (
        <div className="space-y-4">
          <FormError>{s.err.message}</FormError>
          <Button variant="surface" disabled={s.sending} onClick={() => void start()}>
            {s.sending ? "Sending…" : "Send the code again"}
          </Button>
        </div>
      ) : (
        <p className="text-[13px] text-fg-3">Sending a confirmation code to your email…</p>
      )}
    </Dialog>
  );
}
