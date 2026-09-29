// Sign up: the Client Area's register fields (name, email, country, phone, date of birth, referral code,
// password, terms, marketing consent) -> emailed code -> welcome. A partner link (kalks://sign-up?ref=CODE)
// pre-fills the referral code. Google sign-up stays on the web for now (README › Phase 2).
import * as React from "react";
import { TextInput, View } from "react-native";
import { BottomSheetFlatList } from "@gorhom/bottom-sheet";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CalendarDays, Check, ChevronDown, Gift, Lock, Mail, UserRound } from "lucide-react-native";
import { authPost, type OtpChallenge, type SessionAnswer } from "@/features/auth/api";
import { COUNTRIES, maskDob } from "@/features/auth/countries";
import { AuthScaffold, DevCodeHint, FooterLink, PasswordStrength, ResendLink } from "@/features/auth/parts";
import { useT } from "@/i18n";
import type { ApiError } from "@/lib/api";
import { haptic } from "@/lib/haptics";
import { completeSignIn } from "@/session";
import { Button, Checkbox, ColorBlock, Display, FormError, Illustration, OtpInput, PressableScale, RevealToggle, Sheet, Text, TextField, Trans, toast, type SheetRef } from "@/ui";
import { colors, radius, space } from "@/theme/tokens";

type Form = { first_name: string; last_name: string; email: string; country: string; phone: string; date_of_birth: string; referral_code: string; password: string };

export default function SignUp() {
  const t = useT();
  const router = useRouter();
  const params = useLocalSearchParams<{ ref?: string }>();
  const [step, setStep] = React.useState<0 | 1 | 2>(0);
  const [form, setForm] = React.useState<Form>({ first_name: "", last_name: "", email: "", country: "in", phone: "", date_of_birth: "", referral_code: typeof params.ref === "string" ? params.ref.slice(0, 24) : "", password: "" });
  const [agree, setAgree] = React.useState(false);
  const [marketing, setMarketing] = React.useState(true);
  const [show, setShow] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<ApiError | null>(null);
  const [otp, setOtp] = React.useState<OtpChallenge | null>(null);
  const [otpKey, setOtpKey] = React.useState(0);
  const [session, setSession] = React.useState<SessionAnswer | null>(null);
  const countrySheet = React.useRef<SheetRef>(null);
  const refs = { last: React.useRef<TextInput>(null), email: React.useRef<TextInput>(null), phone: React.useRef<TextInput>(null), dob: React.useRef<TextInput>(null), pw: React.useRef<TextInput>(null) };

  const country = COUNTRIES.find((c) => c[0] === form.country) ?? COUNTRIES[0]!;
  const set = (k: keyof Form) => (v: string) => setForm((f) => ({ ...f, [k]: k === "date_of_birth" ? maskDob(v) : v }));
  const fieldErr = (f: string) => (err?.field === f ? err.message : null);

  async function submit() {
    setErr(null);
    setLoading(true);
    const r = await authPost<OtpChallenge>("register", {
      ...form,
      email: form.email.trim(),
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      phone_dial: country[2],
      referral_code: form.referral_code.trim() || null,
      accept_terms: agree,
      marketing_consent: marketing,
    });
    setLoading(false);
    if (!r.ok) {
      haptic.error();
      return setErr(r.error);
    }
    setOtp(r.data);
    setOtpKey((k) => k + 1);
    setStep(1);
  }

  async function verify(code: string) {
    if (!otp) return;
    setErr(null);
    setLoading(true);
    const r = await authPost<SessionAnswer>("verify-email", { challenge: otp.challenge, code });
    setLoading(false);
    if (!r.ok) {
      haptic.error();
      setErr(r.error);
      setOtpKey((k) => k + 1);
      return;
    }
    haptic.success();
    setSession(r.data);
    setStep(2);
  }

  if (step === 2) {
    return (
      <AuthScaffold eyebrow={t("mobileAuth.signUp.eyebrow")} title={t("auth.register.welcome", { name: form.first_name.trim() })} subtitle={t("auth.register.ready")}>
        <ColorBlock color="mint" style={{ alignItems: "center" }}>
          <Illustration name="kycApproved" width={240} height={200} />
        </ColorBlock>
        <Button label={t("mobileAuth.signUp.continue")} onPress={() => session?.session && void completeSignIn(session.session, session.user)} />
      </AuthScaffold>
    );
  }

  if (step === 1 && otp) {
    return (
      <AuthScaffold back onBack={() => setStep(0)} eyebrow={t("mobileAuth.otp.eyebrow")} title={t("auth.register.checkInbox")} subtitle={<Trans k="auth.register.enterCode" vars={{ email: otp.email_masked }} />}>
        <FormError message={err?.message} />
        <OtpInput key={otpKey} error={!!err} label={t("auth.register.verifyEmail")} onComplete={(c) => void verify(c)} />
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
      back
      eyebrow={t("mobileAuth.signUp.eyebrow")}
      title={t("auth.register.title")}
      subtitle={t("auth.register.subtitle")}
      footer={<FooterLink lead={t("mobileAuth.signUp.haveAccount")} action={t("mobileAuth.signUp.signIn")} onPress={() => router.replace("/sign-in")} />}
    >
      <FormError message={err && !err.field ? err.message : null} />
      <View style={{ flexDirection: "row", gap: space[3] }}>
        <View style={{ flex: 1 }}>
          <TextField label={t("auth.field.firstName")} value={form.first_name} onChangeText={set("first_name")} textContentType="givenName" autoComplete="name-given" returnKeyType="next" onSubmitEditing={() => refs.last.current?.focus()} error={fieldErr("first_name")} leading={<UserRound size={18} color={colors.text3} />} />
        </View>
        <View style={{ flex: 1 }}>
          <TextField ref={refs.last} label={t("auth.field.lastName")} value={form.last_name} onChangeText={set("last_name")} textContentType="familyName" autoComplete="name-family" returnKeyType="next" onSubmitEditing={() => refs.email.current?.focus()} error={fieldErr("last_name")} />
        </View>
      </View>
      <TextField
        ref={refs.email}
        label={t("auth.field.email")}
        value={form.email}
        onChangeText={set("email")}
        placeholder={t("auth.placeholder.email")}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        returnKeyType="next"
        onSubmitEditing={() => refs.phone.current?.focus()}
        error={fieldErr("email")}
        leading={<Mail size={18} color={colors.text3} />}
      />
      {err?.code === "email_taken" ? (
        <Trans
          k="auth.register.emailTaken"
          tone="tertiary"
          tags={{
            signin: (c) => (
              <Text tone="ember" weight="700" onPress={() => router.replace("/sign-in")}>
                {c}
              </Text>
            ),
            reset: (c) => (
              <Text tone="ember" weight="700" onPress={() => router.push({ pathname: "/forgot", params: { email: form.email } })}>
                {c}
              </Text>
            ),
          }}
        />
      ) : null}
      <View style={{ gap: space[2] }}>
        <Text variant="label" tone="tertiary">
          {t("auth.field.country")}
        </Text>
        <PressableScale onPress={() => countrySheet.current?.present()} scaleTo={0.985} accessibilityLabel={`${t("auth.field.country")}: ${country[1]}`} style={{ height: 52, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: fieldErr("country") ? colors.down : colors.line, flexDirection: "row", alignItems: "center", paddingHorizontal: space[4], gap: space[3] }}>
          <Text style={{ flex: 1 }} weight="500">
            {country[1]}
          </Text>
          <ChevronDown size={18} color={colors.text3} />
        </PressableScale>
      </View>
      <TextField
        ref={refs.phone}
        label={t("auth.field.phone")}
        value={form.phone}
        onChangeText={(v) => set("phone")(v.replace(/[^\d ]/g, ""))}
        placeholder={t("mobileAuth.signUp.phonePlaceholder")}
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        autoComplete="tel-national"
        error={fieldErr("phone") ?? fieldErr("phone_dial")}
        leading={<Text weight="600" tone="secondary">{country[2]}</Text>}
        mono
      />
      <View style={{ flexDirection: "row", gap: space[3] }}>
        <View style={{ flex: 1 }}>
          <TextField ref={refs.dob} label={t("auth.field.dateOfBirth")} value={form.date_of_birth} onChangeText={set("date_of_birth")} placeholder={t("mobileAuth.signUp.dobPlaceholder")} keyboardType="number-pad" maxLength={10} error={fieldErr("date_of_birth")} leading={<CalendarDays size={18} color={colors.text3} />} mono />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label={t("auth.field.referralCode")} value={form.referral_code} onChangeText={set("referral_code")} autoCapitalize="characters" autoCorrect={false} placeholder={t("auth.field.optionalHint")} error={fieldErr("referral_code")} leading={<Gift size={18} color={colors.text3} />} />
        </View>
      </View>
      <TextField
        ref={refs.pw}
        label={t("auth.field.password")}
        value={form.password}
        onChangeText={set("password")}
        secureTextEntry={!show}
        textContentType="newPassword"
        autoComplete="new-password"
        placeholder={t("auth.placeholder.createPassword")}
        error={fieldErr("password")}
        leading={<Lock size={18} color={colors.text3} />}
        trailing={<RevealToggle shown={show} onToggle={() => setShow((s) => !s)} label={t("auth.togglePassword")} />}
      />
      <PasswordStrength value={form.password} />
      <Checkbox checked={agree} onChange={setAgree}>
        <Trans k="auth.register.terms" tone="secondary" style={{ fontSize: 13, lineHeight: 19 }} tags={{ agreement: (c) => <Text weight="600" style={{ fontSize: 13 }}>{c}</Text>, risk: (c) => <Text weight="600" style={{ fontSize: 13 }}>{c}</Text>, privacy: (c) => <Text weight="600" style={{ fontSize: 13 }}>{c}</Text> }} />
      </Checkbox>
      {fieldErr("accept_terms") ? (
        <Text variant="caption" tone="down">
          {fieldErr("accept_terms")}
        </Text>
      ) : null}
      <Checkbox checked={marketing} onChange={setMarketing}>
        <Text variant="caption" tone="secondary" style={{ fontSize: 13, lineHeight: 19 }}>
          {t("mobileAuth.signUp.marketing")}
        </Text>
      </Checkbox>
      <Button label={loading ? t("auth.register.creating") : t("auth.register.create")} loading={loading} disabled={!agree} onPress={() => void submit()} testID="sign-up" />

      <Sheet ref={countrySheet} enableDynamicSizing={false} snapPoints={["72%"]} scroll>
        <CountryPicker
          value={form.country}
          onPick={(c) => {
            haptic.select();
            setForm((f) => ({ ...f, country: c }));
            countrySheet.current?.dismiss();
          }}
        />
      </Sheet>
    </AuthScaffold>
  );
}

function CountryPicker({ value, onPick }: { value: string; onPick: (code: string) => void }) {
  const t = useT();
  return (
    <BottomSheetFlatList
      data={COUNTRIES}
      keyExtractor={(c) => c[0]}
      contentContainerStyle={{ paddingHorizontal: space[5], paddingBottom: space[10] }}
      ListHeaderComponent={
        <Display size="md" style={{ marginBottom: space[3] }}>
          {t("mobileAuth.signUp.chooseCountry")}
        </Display>
      }
      renderItem={({ item: c }) => (
        <PressableScale onPress={() => onPick(c[0])} scaleTo={0.985} accessibilityRole="radio" accessibilityState={{ selected: c[0] === value }} style={{ height: 52, flexDirection: "row", alignItems: "center", gap: space[3], borderBottomWidth: 1, borderBottomColor: colors.line }}>
          <Text style={{ flex: 1 }} weight={c[0] === value ? "700" : "400"}>
            {c[1]}
          </Text>
          <Text tone="tertiary">{c[2]}</Text>
          {c[0] === value ? <Check size={18} color={colors.ember} /> : <View style={{ width: 18 }} />}
        </PressableScale>
      )}
    />
  );
}
