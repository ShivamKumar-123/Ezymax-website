// Step-up confirmation (D20) for credential and leverage changes, the same gateway flow as the Client Area:
//   1. auth/stepup {action, target}                 -> a 6-digit code is emailed, a challenge comes back
//   2. auth/stepup-verify {challenge, code, …}       -> a single-use step-up token (5 min, bound to action + target)
//   3. the change request carries `stepup_token`; the BFF redeems it with the gateway before the engine acts.
import * as React from "react";
import { View } from "react-native";
import { Mail } from "lucide-react-native";
import { DevCodeHint, ResendLink } from "@/features/auth/parts";
import { useT } from "@/i18n";
import { apiPost, type ApiError } from "@/lib/api";
import { FormError, Text, Trans, toast } from "@/ui";
import { colors, radius, space } from "@/theme/tokens";
import { SheetOtpInput } from "./components/SheetInputs";

export type StepUpAction = "trading_password" | "investor_password" | "leverage";

export type Challenge = { challenge: string; email_masked: string; expires_in: number; resend_in: number; dev_code?: string };

export function useStepUp(action: StepUpAction, target: string) {
  const t = useT();
  const [challenge, setChallenge] = React.useState<Challenge | null>(null);
  const [err, setErr] = React.useState<ApiError | null>(null);
  const [sending, setSending] = React.useState(false);
  const [verifying, setVerifying] = React.useState(false);
  const [otpKey, setOtpKey] = React.useState(0);
  // a newer start / reset supersedes answers still in flight
  const seq = React.useRef(0);

  /** Emails a fresh code; false when it couldn't be sent (the reason is in `err`). */
  const start = React.useCallback(async () => {
    const id = ++seq.current;
    setSending(true);
    setErr(null);
    const r = await apiPost<Challenge>("auth/stepup", { action, target });
    if (id !== seq.current) return false;
    setSending(false);
    if (!r.ok) {
      setErr(r.error);
      return false;
    }
    setChallenge(r.data);
    setOtpKey((k) => k + 1);
    return true;
  }, [action, target]);

  /** The code for a step-up token; null on a wrong or expired code (boxes cleared, reason in `err`). */
  const verify = React.useCallback(
    async (code: string): Promise<string | null> => {
      if (!challenge || code.length !== 6) return null;
      const id = seq.current;
      setVerifying(true);
      setErr(null);
      const r = await apiPost<{ stepup_token: string }>("auth/stepup-verify", { challenge: challenge.challenge, code, action, target });
      if (id !== seq.current) return null;
      setVerifying(false);
      if (!r.ok) {
        setErr(r.error);
        setOtpKey((k) => k + 1);
        return null;
      }
      return r.data.stepup_token;
    },
    [challenge, action, target],
  );

  /** Resends the code; returns the wait in seconds when rate limited. An expired challenge starts over. */
  const resend = React.useCallback(async (): Promise<number | void> => {
    if (!challenge) return;
    const r = await apiPost<Challenge>("auth/stepup-resend", { challenge: challenge.challenge });
    if (!r.ok) {
      if (r.error.code === "code_expired") {
        await start();
        return;
      }
      setErr(r.error);
      return r.error.retry_after;
    }
    setErr(null);
    setChallenge(r.data);
    setOtpKey((k) => k + 1);
    toast.show({ title: t("auth.toast.newCodeSent"), body: t("auth.toast.checkEmail", { email: r.data.email_masked }) });
  }, [challenge, start, t]);

  const reset = React.useCallback(() => {
    seq.current++;
    setSending(false);
    setVerifying(false);
    setChallenge(null);
    setErr(null);
  }, []);

  return { challenge, err, setErr, sending, verifying, otpKey, start, verify, resend, reset };
}

export type StepUp = ReturnType<typeof useStepUp>;

/** The code step (inside a sheet): where it went, six boxes (submits on the sixth digit), errors, the dev hint and resend. */
export function StepUpCode({ s, what, onCode, onChange }: { s: StepUp; what: string; onCode: (code: string) => void; onChange?: (code: string) => void }) {
  const t = useT();
  // cleared boxes (a wrong code, a resend) mean an empty code for the parent's Confirm button too
  React.useEffect(() => onChange?.(""), [s.otpKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const minutes = Math.max(1, Math.round((s.challenge?.expires_in ?? 600) / 60));
  return (
    <View style={{ gap: space[4] }}>
      <View style={{ flexDirection: "row", gap: space[3], alignItems: "flex-start", padding: space[4], borderRadius: radius.lg, backgroundColor: colors.surface2 }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.ember, alignItems: "center", justifyContent: "center" }}>
          <Mail size={18} color={colors.ink} strokeWidth={2} />
        </View>
        <View style={{ flex: 1 }}>
          <Trans k="auth.stepup.intro" vars={{ what, email: s.challenge?.email_masked, minutes }} />
        </View>
      </View>
      <FormError message={s.err?.message} />
      <SheetOtpInput key={s.otpKey} error={!!s.err} label={t("mobileAccounts.stepup.codeLabel")} onComplete={onCode} onChange={onChange} />
      <DevCodeHint code={s.challenge?.dev_code} />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[3] }}>
        <Text variant="caption" tone="tertiary" style={{ flex: 1 }}>
          {t("auth.stepup.spam")}
        </Text>
        <ResendLink key={s.challenge?.challenge} seconds={s.challenge?.resend_in ?? 30} onResend={s.resend} />
      </View>
    </View>
  );
}
