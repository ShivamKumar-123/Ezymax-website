// Step-up confirmation (D20) for credential changes, same flow as the Client Area's components/stepup.tsx:
//   1. auth/stepup {action, target}              -> a 6-digit code is emailed, challenge returned
//   2. auth/stepup-verify {challenge, code, …}    -> single-use step-up token (5 min, bound to action + target)
//   3. the change request carries `stepup_token`; the server redeems it before acting.
// The sheet emails a code as soon as it opens; once the code checks out it calls `onConfirmed(token)`, which
// performs the change and reports its own outcome, and then closes.
import * as React from "react";
import { Pressable, TextInput, View } from "react-native";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { Mail } from "lucide-react-native";
import { authPost, type OtpChallenge } from "@/features/auth/api";
import { DevCodeHint, ResendLink } from "@/features/auth/parts";
import { useT } from "@/i18n";
import type { ApiError } from "@/lib/api";
import { haptic } from "@/lib/haptics";
import { Button, Display, FormError, Sheet, Text, Trans, toast, type SheetRef } from "@/ui";
import { colors, fonts, radius, space } from "@/theme/tokens";

export type StepUpAction = "account_password" | "viewer_access";

/** Errors from the change request that mean the confirmation has to be done again. */
export const STEPUP_CODES = new Set(["stepup_required", "stepup_invalid"]);

export function useStepUp(action: StepUpAction, target = "") {
  const [challenge, setChallenge] = React.useState<OtpChallenge | null>(null);
  const [err, setErr] = React.useState<ApiError | null>(null);
  const [sending, setSending] = React.useState(false);
  const [verifying, setVerifying] = React.useState(false);
  const [otpKey, setOtpKey] = React.useState(0);
  const seq = React.useRef(0);
  const t = useT();

  /** Emails a fresh code; false when it couldn't be sent (error in `err`). */
  const start = React.useCallback(async () => {
    const id = ++seq.current;
    setSending(true);
    setErr(null);
    const r = await authPost<OtpChallenge>("stepup", { action, target });
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

  /** Exchanges the code for a step-up token; null on a wrong / expired code (boxes cleared). */
  const verify = async (code: string): Promise<string | null> => {
    if (!challenge || code.length !== 6 || verifying) return null;
    setVerifying(true);
    setErr(null);
    const r = await authPost<{ stepup_token: string }>("stepup-verify", { challenge: challenge.challenge, code, action, target });
    setVerifying(false);
    if (!r.ok) {
      haptic.error();
      setErr(r.error);
      setOtpKey((k) => k + 1);
      return null;
    }
    return r.data.stepup_token;
  };

  const resend = async (): Promise<number | void> => {
    if (!challenge) return;
    const r = await authPost<OtpChallenge>("stepup-resend", { challenge: challenge.challenge });
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
  };

  const reset = React.useCallback(() => {
    seq.current++;
    setSending(false);
    setVerifying(false);
    setChallenge(null);
    setErr(null);
  }, []);

  return { challenge, err, setErr, sending, verifying, otpKey, start, verify, resend, reset };
}

/** Six code boxes on one hidden input that lives inside a bottom sheet (so the sheet rises with the keyboard). */
const SheetOtpInput = React.forwardRef<TextInput, { onComplete: (code: string) => void; error?: boolean; label: string }>(function SheetOtpInput({ onComplete, error, label }, ref) {
  const [value, setValue] = React.useState("");
  const inner = React.useRef<TextInput>(null);
  React.useImperativeHandle(ref, () => inner.current as TextInput, []);
  return (
    <Pressable onPress={() => inner.current?.focus()} accessibilityLabel={label} accessibilityHint="6 digits">
      <View style={{ flexDirection: "row", gap: space[2], justifyContent: "space-between", direction: "ltr" }}>
        {Array.from({ length: 6 }, (_, i) => {
          const ch = value[i];
          const active = i === value.length;
          return (
            <View key={i} style={{ flex: 1, height: 56, borderRadius: radius.md, backgroundColor: colors.surface2, borderWidth: 1, borderColor: error ? colors.down : active ? colors.ember : colors.line, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontFamily: fonts.monoBold, fontSize: 24, lineHeight: 30 }}>{ch ?? ""}</Text>
            </View>
          );
        })}
      </View>
      <BottomSheetTextInput
        ref={inner as never}
        value={value}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={6}
        caretHidden
        onChangeText={(v) => {
          const digits = v.replace(/\D/g, "").slice(0, 6);
          setValue(digits);
          if (digits.length === 6) onComplete(digits);
        }}
        style={{ position: "absolute", opacity: 0.01, width: 1, height: 1 }}
        accessibilityElementsHidden
        testID="stepup-code"
      />
    </Pressable>
  );
});

export type StepUpSheetHandle = { open: () => void; close: () => void };

type SheetProps = {
  action: StepUpAction;
  target?: string;
  title: string;
  /** lowercase verb phrase completing "To {what}, enter the 6-digit code…" */
  what: string;
  confirmLabel?: string;
  /** performs the change with the token; the sheet closes after it settles */
  onConfirmed: (token: string) => Promise<void>;
};

export const StepUpSheet = React.forwardRef<StepUpSheetHandle, SheetProps>(function StepUpSheet({ action, target = "", title, what, confirmLabel, onConfirmed }, ref) {
  const t = useT();
  const sheet = React.useRef<SheetRef>(null);
  const input = React.useRef<TextInput>(null);
  const s = useStepUp(action, target);
  const [busy, setBusy] = React.useState(false);
  const code = React.useRef("");
  const open = React.useRef(false);
  const { start, reset } = s;

  // the code boxes appear once the code is on its way (and again after a wrong code): put the cursor in them
  React.useEffect(() => {
    if (!open.current || !s.challenge) return;
    const id = setTimeout(() => input.current?.focus(), 80);
    return () => clearTimeout(id);
  }, [s.challenge, s.otpKey]);

  React.useImperativeHandle(ref, () => ({
    open: () => {
      reset();
      code.current = "";
      sheet.current?.present();
      void start();
    },
    close: () => sheet.current?.dismiss(),
  }), [reset, start]);

  const submit = async (c = code.current) => {
    if (busy) return;
    if (c.length !== 6) {
      input.current?.focus();
      return;
    }
    const token = await s.verify(c);
    if (!token) return;
    setBusy(true);
    try {
      await onConfirmed(token);
    } catch {
      // onConfirmed reports its own failures
    } finally {
      setBusy(false);
      sheet.current?.dismiss();
    }
  };

  const mins = Math.max(1, Math.round((s.challenge?.expires_in ?? 600) / 60));
  return (
    <Sheet
      ref={sheet}
      onChange={(i) => {
        open.current = i >= 0;
        if (i >= 0) setTimeout(() => input.current?.focus(), 60);
      }}
      onDismiss={() => {
        open.current = false;
        reset();
        setBusy(false);
      }}
    >
      <View style={{ gap: space[4], paddingTop: space[2] }} testID="stepup-sheet">
        <Display size="md">{title}</Display>
        {s.challenge ? (
          <>
            <View style={{ flexDirection: "row", gap: space[3], alignItems: "flex-start" }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(242,106,61,0.14)", alignItems: "center", justifyContent: "center" }}>
                <Mail size={17} color={colors.ember} />
              </View>
              <View style={{ flex: 1 }}>
                <Trans k="auth.stepup.intro" vars={{ what, email: s.challenge.email_masked, minutes: mins }} />
              </View>
            </View>
            <FormError message={s.err?.message} />
            <SheetOtpInput
              key={s.otpKey}
              ref={input}
              error={!!s.err}
              label={title}
              onComplete={(c) => {
                code.current = c;
                void submit(c);
              }}
            />
            <DevCodeHint code={s.challenge.dev_code} />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[2] }}>
              <Text variant="caption" tone="tertiary" style={{ flex: 1 }}>
                {t("auth.stepup.spam")}
              </Text>
              <ResendLink key={s.challenge.challenge} seconds={s.challenge.resend_in ?? 30} onResend={s.resend} />
            </View>
            <Button label={s.verifying ? t("auth.stepup.checking") : busy ? t("auth.stepup.saving") : (confirmLabel ?? t("common.confirm"))} loading={s.verifying || busy} disabled={s.verifying || busy} onPress={() => void submit()} testID="stepup-confirm" />
          </>
        ) : s.err ? (
          <>
            <FormError message={s.err.message} />
            <Button label={s.sending ? t("auth.otp.sending") : t("auth.stepup.sendAgain")} variant="secondary" loading={s.sending} onPress={() => void start()} />
          </>
        ) : (
          <View style={{ minHeight: 120, justifyContent: "center" }}>
            <Text tone="tertiary">{t("auth.stepup.sendingCode")}</Text>
          </View>
        )}
      </View>
    </Sheet>
  );
});
