// Confirmation sheet for a money action that needs an emailed code (D20 step-up, the Client Area's StepUpDialog):
//   review -> POST auth/stepup {action, target} (code emailed) -> six digits -> POST auth/stepup-verify -> single-use
//   token -> `onConfirmed(token)` performs the change on the server -> the server's answer (success view or error).
// Nothing is assumed: the success view only appears after the server accepted the request.
// - While the code is typed the summary shrinks to one compact card, so the code boxes stay above the keyboard on a
//   small phone; the content scrolls when it is still taller than the space.
// - Closed while the request is in flight (a tap outside), the sheet comes back with the server's answer: a money
//   action always ends on what the server said.
import * as React from "react";
import { Platform, TextInput, View } from "react-native";
import { BottomSheetScrollView, BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Mail } from "lucide-react-native";
import { useT } from "@/i18n";
import { apiPost, type ApiError } from "@/lib/api";
import { Button, Display, FormError, Mono, PressableScale, Sheet, Text, Trans, type SheetRef } from "@/ui";
import { colors, fonts, radius, space } from "@/theme/tokens";

type Challenge = { challenge: string; email_masked: string; expires_in: number; resend_in: number; dev_code?: string };
type Phase = "review" | "sending" | "code" | "submitting" | "done";

export type StepUpSheetHandle = { open: () => void; close: () => void };

type Props = {
  action: "withdrawal";
  /** bound into the token (the server checks the same value), e.g. "bsc-250.5" */
  target: string;
  title: string;
  /** completes "To {what}, enter the 6-digit code…" */
  what: string;
  /** the full review (amounts, network, address) */
  summary: React.ReactNode;
  /** the same in one compact card, shown while the code is typed */
  compact?: React.ReactNode;
  confirmLabel: string;
  /** performs the change with the token; resolves to an error message, or null when the server accepted it */
  onConfirmed: (token: string) => Promise<string | null>;
  success: React.ReactNode;
  onClosed?: () => void;
};

const codeError = (e: ApiError) => e.message;

/** The sheet's own text input on a phone (the sheet rises above the keyboard for it); a plain one in the web preview,
 *  where the sheet input's blur handler calls a React Native API that react-native-web doesn't have. */
const CodeInput = (Platform.OS === "web" ? TextInput : BottomSheetTextInput) as unknown as typeof TextInput;

export const StepUpSheet = React.forwardRef<StepUpSheetHandle, Props>(function StepUpSheet({ action, target, title, what, summary, compact, confirmLabel, onConfirmed, success, onClosed }, ref) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const sheet = React.useRef<SheetRef>(null);
  const shown = React.useRef(false);
  const [phase, setPhase] = React.useState<Phase>("review");
  const [challenge, setChallenge] = React.useState<Challenge | null>(null);
  const [code, setCode] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [verifying, setVerifying] = React.useState(false);
  const input = React.useRef<TextInput>(null);

  const reset = React.useCallback(() => {
    setPhase("review");
    setChallenge(null);
    setCode("");
    setErr(null);
    setNotice(null);
    setVerifying(false);
  }, []);

  const present = React.useCallback(() => {
    shown.current = true;
    sheet.current?.present();
  }, []);

  React.useImperativeHandle(ref, () => ({
    open: () => {
      reset();
      present();
    },
    close: () => sheet.current?.dismiss(),
  }));

  const send = async () => {
    setPhase("sending");
    setErr(null);
    setNotice(null);
    const r = await apiPost<Challenge>("auth/stepup", { action, target });
    if (!r.ok) {
      setPhase("review");
      setErr(r.error.message);
      return;
    }
    setChallenge(r.data);
    setCode("");
    setPhase("code");
    setTimeout(() => input.current?.focus(), 250);
  };

  const resend = async (): Promise<number | void> => {
    if (!challenge) return;
    setNotice(null);
    const r = await apiPost<Challenge>("auth/stepup-resend", { challenge: challenge.challenge });
    if (!r.ok) {
      if (r.error.code === "code_expired") return void (await send());
      setErr(r.error.message);
      return r.error.retry_after;
    }
    setErr(null);
    setChallenge(r.data);
    setCode("");
    setNotice(t("auth.toast.checkEmail", { email: r.data.email_masked }));
  };

  const verify = async (c: string) => {
    if (!challenge || c.length !== 6 || verifying) return;
    setVerifying(true);
    setErr(null);
    const r = await apiPost<{ stepup_token: string }>("auth/stepup-verify", { challenge: challenge.challenge, code: c, action, target });
    setVerifying(false);
    if (!r.ok) {
      setErr(codeError(r.error));
      setCode("");
      return;
    }
    setPhase("submitting");
    const failure = await onConfirmed(r.data.stepup_token);
    if (failure) {
      // the token is single-use: a retry needs a new code
      setChallenge(null);
      setCode("");
      setErr(failure);
      setPhase("review");
    } else {
      setPhase("done");
    }
    // closed with a tap outside while the server was answering: bring the answer back
    if (!shown.current) present();
  };

  const mins = Math.max(1, Math.round((challenge?.expires_in ?? 600) / 60));
  const coding = phase === "code" || phase === "submitting";

  return (
    <Sheet
      ref={sheet}
      scroll
      topInset={insets.top + space[2]}
      onDismiss={() => {
        shown.current = false;
        onClosed?.();
      }}
      enablePanDownToClose={phase !== "submitting"}
    >
      <BottomSheetScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space[5], paddingBottom: Math.max(insets.bottom, space[4]) + space[2] }}>
        {phase === "done" ? (
          <View style={{ gap: space[4], paddingTop: space[2] }} testID="stepup-done">
            {success}
            <Button label={t("common.done")} onPress={() => sheet.current?.dismiss()} />
          </View>
        ) : (
          <View style={{ gap: space[4], paddingTop: space[2] }} testID={`stepup-${phase}`}>
            <Display size={coding ? "sm" : "md"}>{title}</Display>
            {coding && compact ? compact : summary}
            {coding ? (
              <View style={{ gap: space[3] }}>
                <View style={{ flexDirection: "row", gap: space[3], alignItems: "flex-start", backgroundColor: colors.surface2, borderRadius: radius.md, padding: space[3] }}>
                  <Mail size={18} color={colors.ember} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Trans k="auth.stepup.intro" vars={{ what, email: challenge?.email_masked, minutes: mins }} style={{ fontSize: 13.5, lineHeight: 19 }} />
                  </View>
                </View>
                <CodeBoxes value={code} error={!!err} onPress={() => input.current?.focus()} />
                <CodeInput
                  ref={input}
                  value={code}
                  onChangeText={(v) => {
                    const d = v.replace(/\D/g, "").slice(0, 6);
                    setCode(d);
                    if (d.length === 6) void verify(d);
                  }}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="one-time-code"
                  maxLength={6}
                  caretHidden
                  editable={phase === "code"}
                  accessibilityLabel={t("mobileWallet.stepup.codeLabel")}
                  testID="stepup-code-input"
                  style={{ position: "absolute", width: 1, height: 1, opacity: 0.01 }}
                />
                {challenge?.dev_code ? (
                  <View style={{ borderWidth: 1, borderStyle: "dashed", borderColor: colors.lineStrong, borderRadius: radius.sm, padding: space[3] }}>
                    <Trans k="auth.otp.devHint" vars={{ code: challenge.dev_code }} tone="tertiary" tags={{ code: (c) => <Mono size={13} weight="bold">{c}</Mono> }} />
                  </View>
                ) : null}
                <FormError message={err} />
                {notice ? (
                  <Text variant="caption" tone="secondary">
                    {notice}
                  </Text>
                ) : null}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text variant="caption" tone="tertiary" style={{ flex: 1 }}>
                    {t("auth.stepup.spam")}
                  </Text>
                  {challenge ? <Resend key={challenge.challenge} seconds={challenge.resend_in} onResend={resend} /> : null}
                </View>
                <Button label={verifying ? t("auth.stepup.checking") : confirmLabel} loading={phase === "submitting"} disabled={code.length !== 6 || verifying} onPress={() => void verify(code)} testID="stepup-confirm" />
              </View>
            ) : (
              <View style={{ gap: space[3] }}>
                <FormError message={err} />
                <Text variant="caption" tone="tertiary">
                  {t("mobileWallet.stepup.willEmail")}
                </Text>
                <Button label={t("mobileWallet.stepup.sendCode")} loading={phase === "sending"} onPress={() => void send()} testID="stepup-send" />
                <Button label={t("common.cancel")} variant="ghost" onPress={() => sheet.current?.dismiss()} />
              </View>
            )}
          </View>
        )}
      </BottomSheetScrollView>
    </Sheet>
  );
});

function CodeBoxes({ value, error, onPress }: { value: string; error: boolean; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} scaleTo={1} accessible={false} style={{ flexDirection: "row", gap: space[2], direction: "ltr" }}>
      {Array.from({ length: 6 }, (_, i) => {
        const active = i === value.length;
        return (
          <View key={i} style={{ flex: 1, height: 56, borderRadius: radius.md, backgroundColor: colors.bgRaised, borderWidth: 1, borderColor: error ? colors.down : active ? colors.ember : colors.line, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontFamily: fonts.monoBold, fontSize: 23, lineHeight: 29, color: colors.text }}>{value[i] ?? ""}</Text>
          </View>
        );
      })}
    </PressableScale>
  );
}

function Resend({ seconds, onResend }: { seconds: number; onResend: () => Promise<number | void> }) {
  const t = useT();
  const [left, setLeft] = React.useState(seconds);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);
  return (
    <PressableScale
      disabled={left > 0 || busy}
      scaleTo={1}
      onPress={async () => {
        setBusy(true);
        const wait = await onResend();
        setBusy(false);
        setLeft(typeof wait === "number" ? wait : seconds);
      }}
      style={{ minHeight: 44, justifyContent: "center", paddingStart: space[3] }}
    >
      <Text variant="callout" weight="700" tone={left > 0 || busy ? "tertiary" : "ember"}>
        {left > 0 ? t("auth.otp.resendIn", { seconds: String(left).padStart(2, "0") }) : busy ? t("auth.otp.sending") : t("auth.otp.resendCode")}
      </Text>
    </PressableScale>
  );
}

/** One-card summary for the code step: what arrives, where, on which network. */
export function CompactSummary({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <View style={{ backgroundColor: colors.surface2, borderRadius: radius.md, paddingHorizontal: space[4], paddingVertical: space[3], gap: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: space[3] }}>
        <Text variant="caption" tone="tertiary" numberOfLines={1} style={{ flexShrink: 1 }}>
          {label}
        </Text>
        <Mono size={16} weight="bold" tone="up" numberOfLines={1}>
          {value}
        </Mono>
      </View>
      <Mono size={12.5} tone="secondary" numberOfLines={1}>
        {detail}
      </Mono>
    </View>
  );
}
