// The profile step after a first "Continue with Google" (/google-profile, signed out): the Client Area's
// /register/complete on the phone. Google has verified the email; the gateway still needs what every Kalks account
// needs (country, phone, date of birth 18+, terms), plus an optional partner code. The gateway checks every field and
// the signed ticket, creates the account and signs in. When the ticket is gone (expired, app restarted) the screen
// offers Google again.
import * as React from "react";
import { TextInput, View } from "react-native";
import { BottomSheetFlatList } from "@gorhom/bottom-sheet";
import { useRouter } from "expo-router";
import { CalendarDays, Check, ChevronDown, Gift, UserRound } from "lucide-react-native";
import { COUNTRIES, maskDob } from "@/features/auth/countries";
import { AuthScaffold } from "@/features/auth/parts";
import { useT } from "@/i18n";
import type { ApiError } from "@/lib/api";
import { haptic } from "@/lib/haptics";
import { Button, Checkbox, Display, FormError, PressableScale, Sheet, Text, TextField, Trans, type SheetRef } from "@/ui";
import { colors, radius, space } from "@/theme/tokens";
import { completeGoogleProfile, pendingGoogleProfile } from "./flow";
import { GOOGLE_BRAND, GoogleMark } from "./GoogleMark";
import { GoogleSignIn } from "./GoogleSignIn";

type Form = { first_name: string; last_name: string; country: string; phone: string; date_of_birth: string; referral_code: string };

export function GoogleProfileScreen() {
  const t = useT();
  const router = useRouter();
  const pending = React.useMemo(() => pendingGoogleProfile(), []);
  const profile = pending?.profile;
  const [expired, setExpired] = React.useState(!pending);
  const [form, setForm] = React.useState<Form>({ first_name: profile?.first_name ?? "", last_name: profile?.last_name ?? "", country: "in", phone: "", date_of_birth: "", referral_code: profile?.referral_code ?? "" });
  const [agree, setAgree] = React.useState(false);
  const [marketing, setMarketing] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<ApiError | null>(null);
  const countrySheet = React.useRef<SheetRef>(null);
  const refs = { last: React.useRef<TextInput>(null), phone: React.useRef<TextInput>(null), dob: React.useRef<TextInput>(null) };

  const country = COUNTRIES.find((c) => c[0] === form.country) ?? COUNTRIES[0]!;
  const set = (k: keyof Form) => (v: string) => setForm((f) => ({ ...f, [k]: k === "date_of_birth" ? maskDob(v) : v }));
  const fieldErr = (f: string) => (err?.field === f ? err.message : null);

  async function submit() {
    setErr(null);
    setLoading(true);
    const r = await completeGoogleProfile({
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      phone_dial: country[2],
      phone: form.phone,
      country: form.country,
      date_of_birth: form.date_of_birth,
      referral_code: form.referral_code.trim() || null,
      accept_terms: agree,
      marketing_consent: marketing,
    });
    setLoading(false);
    if (r.ok) return;
    setErr(r.error);
    if (r.error.code === "google_expired" || r.error.code === "google_account_exists") setExpired(true);
  }

  if (expired) {
    return (
      <AuthScaffold back onBack={() => router.replace("/sign-in")} eyebrow={t("auth.complete.stepGoogle")} title={t("auth.complete.expiredTitle")} subtitle={err?.code === "google_account_exists" ? t("auth.complete.accountExists") : t("auth.complete.expired")}>
        <GoogleSignIn divider={false} />
        <Trans
          k="auth.complete.preferEmail"
          tone="tertiary"
          tags={{
            link: (c) => (
              <Text tone="ember" weight="700" onPress={() => router.replace("/sign-up")}>
                {c}
              </Text>
            ),
          }}
        />
      </AuthScaffold>
    );
  }

  return (
    <AuthScaffold back onBack={() => router.replace("/sign-in")} eyebrow={t("auth.complete.stepDetails")} title={t("auth.complete.title")} subtitle={t("auth.complete.subtitle")}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[3], padding: space[4], borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }} testID="google-account">
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: GOOGLE_BRAND.logoDisc, alignItems: "center", justifyContent: "center" }}>
          <GoogleMark size={18} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="label" tone="tertiary">
            {t("auth.complete.googleAccount")}
          </Text>
          <Text weight="600" numberOfLines={1}>
            {profile?.email ?? ""}
          </Text>
        </View>
      </View>
      <FormError message={err && !err.field && err.code !== "email_taken" ? err.message : null} />
      <View style={{ flexDirection: "row", gap: space[3] }}>
        <View style={{ flex: 1 }}>
          <TextField label={t("auth.field.firstName")} value={form.first_name} onChangeText={set("first_name")} textContentType="givenName" autoComplete="name-given" returnKeyType="next" onSubmitEditing={() => refs.last.current?.focus()} error={fieldErr("first_name")} leading={<UserRound size={18} color={colors.text3} />} />
        </View>
        <View style={{ flex: 1 }}>
          <TextField ref={refs.last} label={t("auth.field.lastName")} value={form.last_name} onChangeText={set("last_name")} textContentType="familyName" autoComplete="name-family" returnKeyType="next" onSubmitEditing={() => refs.phone.current?.focus()} error={fieldErr("last_name")} />
        </View>
      </View>
      {err?.code === "email_taken" ? (
        <Trans
          k="auth.complete.emailTaken"
          tone="tertiary"
          tags={{
            signin: (c) => (
              <Text tone="ember" weight="700" onPress={() => router.replace("/sign-in")}>
                {c}
              </Text>
            ),
            reset: (c) => (
              <Text tone="ember" weight="700" onPress={() => router.push({ pathname: "/forgot", params: profile?.email ? { email: profile.email } : {} })}>
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
        {fieldErr("country") ? (
          <Text variant="caption" tone="down">
            {fieldErr("country")}
          </Text>
        ) : null}
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
      <Button label={loading ? t("auth.register.creating") : t("auth.register.create")} loading={loading} disabled={!agree} onPress={() => void submit()} testID="google-complete" />

      <Sheet ref={countrySheet} enableDynamicSizing={false} snapPoints={["72%"]} scroll>
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
            <PressableScale
              onPress={() => {
                haptic.select();
                setForm((f) => ({ ...f, country: c[0] }));
                countrySheet.current?.dismiss();
              }}
              scaleTo={0.985}
              accessibilityRole="radio"
              accessibilityState={{ selected: c[0] === form.country }}
              style={{ height: 52, flexDirection: "row", alignItems: "center", gap: space[3], borderBottomWidth: 1, borderBottomColor: colors.line }}
            >
              <Text style={{ flex: 1 }} weight={c[0] === form.country ? "700" : "400"}>
                {c[1]}
              </Text>
              <Text tone="tertiary">{c[2]}</Text>
              {c[0] === form.country ? <Check size={18} color={colors.ember} /> : <View style={{ width: 18 }} />}
            </PressableScale>
          )}
        />
      </Sheet>
    </AuthScaffold>
  );
}
