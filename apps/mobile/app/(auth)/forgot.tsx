// Forgot password: email -> 6-digit code -> new password (the gateway checks the code with the reset).
import * as React from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Lock, Mail } from "lucide-react-native";
import { authPost, type OtpChallenge } from "@/features/auth/api";
import { AuthScaffold, DevCodeHint, PasswordStrength, ResendLink } from "@/features/auth/parts";
import { useT } from "@/i18n";
import type { ApiError } from "@/lib/api";
import { haptic } from "@/lib/haptics";
import { Button, FormError, OtpInput, RevealToggle, Text, TextField, Trans, toast } from "@/ui";
import { colors, space } from "@/theme/tokens";

export default function Forgot() {
  const t = useT();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const [step, setStep] = React.useState<0 | 1 | 2>(0);
  const [email, setEmail] = React.useState(typeof params.email === "string" ? params.email : "");
  const [code, setCode] = React.useState("");
  const [pw, setPw] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [otp, setOtp] = React.useState<OtpChallenge | null>(null);
  const [otpKey, setOtpKey] = React.useState(0);
  const [err, setErr] = React.useState<ApiError | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function sendCode() {
    setErr(null);
    setLoading(true);
    const r = await authPost<OtpChallenge>("forgot", { email: email.trim() });
    setLoading(false);
    if (!r.ok) return setErr(r.error);
    setOtp(r.data);
    setOtpKey((k) => k + 1);
    setStep(1);
  }

  async function reset() {
    if (!otp) return;
    setErr(null);
    setLoading(true);
    const r = await authPost("reset", { challenge: otp.challenge, code, password: pw });
    setLoading(false);
    if (r.ok) {
      haptic.success();
      toast.show({ title: t("auth.forgot.toastUpdated"), body: t("auth.forgot.toastUpdatedBody"), tone: "success" });
      router.replace("/sign-in");
      return;
    }
    haptic.error();
    setErr(r.error);
    if (r.error.field !== "password") {
      // wrong or expired code: back to the code step
      setCode("");
      setOtpKey((k) => k + 1);
      setStep(1);
    }
  }

  const title = step === 0 ? t("auth.forgot.titleReset") : step === 1 ? t("auth.forgot.titleCode") : t("auth.forgot.titleNew");
  const subtitle = step === 0 ? t("auth.forgot.intro") : step === 1 ? <Trans k="auth.forgot.codeSent" vars={{ email: otp?.email_masked }} /> : t("auth.forgot.passwordRule");

  return (
    <AuthScaffold back onBack={step > 0 ? () => setStep((s) => (s - 1) as 0 | 1) : undefined} eyebrow={t("mobileAuth.forgot.eyebrow")} title={title} subtitle={subtitle}>
      <FormError message={err && (step !== 2 || !err.field) ? err.message : null} />
      {step === 0 ? (
        <>
          <TextField
            label={t("auth.field.email")}
            value={email}
            onChangeText={setEmail}
            placeholder={t("auth.placeholder.email")}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            returnKeyType="send"
            onSubmitEditing={() => void sendCode()}
            error={err?.field === "email" ? err.message : null}
            leading={<Mail size={18} color={colors.text3} />}
          />
          <Button label={t("auth.forgot.sendCode")} loading={loading} disabled={!email.trim()} onPress={() => void sendCode()} />
        </>
      ) : null}
      {step === 1 && otp ? (
        <>
          <OtpInput
            key={otpKey}
            error={!!err}
            onComplete={(c) => {
              setCode(c);
              setErr(null);
              setStep(2);
            }}
          />
          <DevCodeHint code={otp.dev_code} />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space[1] }}>
            <Text variant="callout" tone="tertiary">
              {t("auth.otp.didntGetIt")}
            </Text>
            <ResendLink
              key={otp.challenge}
              seconds={otp.resend_in ?? 30}
              onResend={async () => {
                const r = await authPost<OtpChallenge>("resend", { challenge: otp.challenge });
                if (!r.ok) {
                  setErr(r.error);
                  return r.error.retry_after;
                }
                setErr(null);
                setOtp(r.data);
                setOtpKey((k) => k + 1);
                toast.show({ title: t("auth.toast.newCodeSent"), body: t("auth.toast.checkEmail", { email: r.data.email_masked }) });
              }}
            />
          </View>
        </>
      ) : null}
      {step === 2 ? (
        <>
          <TextField
            label={t("auth.field.newPassword")}
            value={pw}
            onChangeText={setPw}
            secureTextEntry={!show}
            textContentType="newPassword"
            autoComplete="new-password"
            placeholder={t("auth.placeholder.createPassword")}
            error={err?.field === "password" ? err.message : null}
            leading={<Lock size={18} color={colors.text3} />}
            trailing={<RevealToggle shown={show} onToggle={() => setShow((s) => !s)} label={t("auth.togglePassword")} />}
          />
          <PasswordStrength value={pw} />
          <Button label={loading ? t("auth.forgot.updating") : t("auth.forgot.update")} loading={loading} disabled={pw.length < 8} onPress={() => void reset()} />
        </>
      ) : null}
    </AuthScaffold>
  );
}
