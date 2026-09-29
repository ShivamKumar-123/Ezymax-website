// Sign in: email (or view-only login) + password, then the emailed code when the gateway asks for one
// (email not verified yet, or a new device). The same gateway flow as the Client Area.
import * as React from "react";
import { TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Lock, Mail } from "lucide-react-native";
import { authPost, type OtpChallenge, type SessionAnswer } from "@/features/auth/api";
import { AuthScaffold, DevCodeHint, FooterLink, ResendLink } from "@/features/auth/parts";
import { useT } from "@/i18n";
import type { ApiError } from "@/lib/api";
import { haptic } from "@/lib/haptics";
import { completeSignIn, useSession } from "@/session";
import { Banner, Button, FormError, OtpInput, PressableScale, RevealToggle, Text, TextField, Trans, toast } from "@/ui";
import { colors, space } from "@/theme/tokens";

export default function SignIn() {
  const t = useT();
  const router = useRouter();
  const expired = useSession((s) => s.expired);
  const [step, setStep] = React.useState<"creds" | "otp">("creds");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<ApiError | null>(null);
  const [otp, setOtp] = React.useState<OtpChallenge | null>(null);
  const [otpKey, setOtpKey] = React.useState(0);
  const pwRef = React.useRef<TextInput>(null);

  const finish = async (d: SessionAnswer) => {
    if (!d.session?.token) return;
    haptic.success();
    await completeSignIn(d.session, d.user);
  };

  async function signIn() {
    setErr(null);
    setLoading(true);
    const r = await authPost<SessionAnswer | OtpChallenge>("login", { email: email.trim(), password });
    setLoading(false);
    if (!r.ok) {
      haptic.error();
      setErr(r.error);
      if (r.error.code === "invalid_credentials") setPassword("");
      return;
    }
    if (r.data.status === "ok") return finish(r.data);
    setOtp(r.data);
    setOtpKey((k) => k + 1);
    setStep("otp");
  }

  async function verify(code: string) {
    if (!otp || code.length !== 6) return;
    setErr(null);
    setLoading(true);
    const r = await authPost<SessionAnswer>("verify-email", { challenge: otp.challenge, code });
    setLoading(false);
    if (r.ok) return finish(r.data);
    haptic.error();
    setErr(r.error);
    setOtpKey((k) => k + 1);
  }

  const fieldErr = (f: string) => (err?.field === f ? err.message : null);

  if (step === "otp" && otp) {
    return (
      <AuthScaffold
        back
        onBack={() => {
          setErr(null);
          setStep("creds");
        }}
        eyebrow={t("mobileAuth.otp.eyebrow")}
        title={otp.purpose === "verify_email" ? t("auth.login.verifyEmailTitle") : t("auth.login.verifyDeviceTitle")}
        subtitle={
          <View style={{ gap: space[1] }}>
            <Text tone="secondary">{otp.purpose === "verify_email" ? t("auth.login.emailNotVerified") : t("auth.login.newDevice")}</Text>
            <Trans k="auth.login.codeSent" vars={{ email: otp.email_masked }} />
          </View>
        }
      >
        <FormError message={err?.message} />
        <OtpInput key={otpKey} error={!!err} label={t("auth.login.verifyContinue")} onComplete={(c) => void verify(c)} />
        <DevCodeHint code={otp.dev_code} />
        {loading ? <Button label={t("auth.otp.verifying")} loading onPress={() => {}} /> : null}
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
      </AuthScaffold>
    );
  }

  return (
    <AuthScaffold
      eyebrow={t("mobileAuth.eyebrow")}
      title={t("auth.login.title")}
      subtitle={t("auth.login.subtitle")}
      footer={<FooterLink lead={t("mobileAuth.signIn.newHere")} action={t("mobileAuth.signIn.create")} onPress={() => router.push("/sign-up")} />}
    >
      {expired ? <Banner tone="info" title={t("mobile.state.sessionExpired")} /> : null}
      <FormError message={err && !err.field ? err.message : null} />
      <TextField
        label={t("auth.field.emailOrViewer")}
        value={email}
        onChangeText={setEmail}
        placeholder={t("auth.placeholder.email")}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="username"
        autoComplete="username"
        returnKeyType="next"
        onSubmitEditing={() => pwRef.current?.focus()}
        error={fieldErr("email")}
        leading={<Mail size={18} color={colors.text3} />}
      />
      <TextField
        ref={pwRef}
        label={t("auth.field.password")}
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!show}
        textContentType="password"
        autoComplete="current-password"
        returnKeyType="go"
        onSubmitEditing={() => void signIn()}
        error={fieldErr("password")}
        leading={<Lock size={18} color={colors.text3} />}
        trailing={<RevealToggle shown={show} onToggle={() => setShow((s) => !s)} label={t("auth.togglePassword")} />}
      />
      <PressableScale onPress={() => router.push({ pathname: "/forgot", params: email ? { email } : {} })} scaleTo={1} style={{ alignSelf: "flex-end", minHeight: 44, justifyContent: "center" }}>
        <Text variant="callout" tone="ember" weight="600">
          {t("auth.login.forgot")}
        </Text>
      </PressableScale>
      <Button label={loading ? t("auth.login.signingIn") : t("auth.login.signIn")} loading={loading} disabled={!email.trim() || !password} onPress={() => void signIn()} testID="sign-in" />
    </AuthScaffold>
  );
}
