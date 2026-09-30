// Profile › Security › Change password (/profile/password): current + new password, confirmed with an emailed code
// (step-up `account_password`, D20), optionally signing out every other device. Same rules as the gateway.
import * as React from "react";
import { TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { KeyRound, Lock } from "lucide-react-native";
import { PasswordStrength } from "@/features/auth/parts";
import { useT } from "@/i18n";
import { invalidate } from "@/lib/query";
import { signOut, useSession } from "@/session";
import { Button, FormError, RevealToggle, Text, TextField, toast } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { changePassword, passwordProblem, QK } from "./api";
import { Group, ToggleRow } from "./components/bits";
import { StackScreen } from "./components/StackScreen";
import { STEPUP_CODES, StepUpSheet, type StepUpSheetHandle } from "./components/StepUp";

export default function PasswordScreen() {
  const t = useT();
  const router = useRouter();
  const email = useSession((s) => s.user?.email ?? "");
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [repeat, setRepeat] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [others, setOthers] = React.useState(true);
  const [errs, setErrs] = React.useState<{ current?: string; next?: string; form?: string }>({});
  const [resetting, setResetting] = React.useState(false);
  const stepup = React.useRef<StepUpSheetHandle>(null);
  const nextRef = React.useRef<TextInput>(null);
  const repeatRef = React.useRef<TextInput>(null);

  const problem = next ? passwordProblem(next) : null;
  const same = !!next && next === current;
  const mismatch = !!repeat && repeat !== next;
  const ready = !!current && !!next && !problem && !same && next === repeat;

  const save = async (token: string) => {
    const r = await changePassword(current, next, token, others);
    if (!r.ok) {
      const e = r.error;
      if (e.field === "current") setErrs({ current: e.message });
      else if (e.field === "new") setErrs({ next: e.message });
      else setErrs({ form: STEPUP_CODES.has(e.code) ? t("profile.password.expired") : e.message });
      return;
    }
    const n = r.data.sessions_revoked ?? 0;
    toast.show({ title: t("profile.password.changed"), body: n ? t("profile.password.signedOutOthers", { count: n }) : t("profile.password.useNextTime"), tone: "success" });
    invalidate(QK.sessions);
    invalidate(QK.logins);
    setCurrent("");
    setNext("");
    setRepeat("");
    setErrs({});
    if (router.canGoBack()) router.back();
  };

  const reset = async () => {
    setResetting(true);
    toast.show({ title: t("profile.signin.signingOut") });
    await signOut();
    setTimeout(() => router.replace({ pathname: "/forgot", params: email ? { email } : {} }), 60);
  };

  return (
    <StackScreen eyebrow={t("security.page.title")} title={t("mobileProfile.password.title")} subtitle={t("mobileProfile.password.body")} keyboard testID="screen-password">
      <View style={{ paddingHorizontal: GUTTER, gap: space[4] }}>
        <FormError message={errs.form} />
        <TextField
          label={t("profile.password.current")}
          value={current}
          onChangeText={(v) => {
            setCurrent(v);
            setErrs((x) => ({ ...x, current: undefined }));
          }}
          placeholder={t("profile.password.currentPlaceholder")}
          secureTextEntry={!show}
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="next"
          onSubmitEditing={() => nextRef.current?.focus()}
          error={errs.current}
          leading={<Lock size={18} color={colors.text3} />}
          trailing={<RevealToggle shown={show} onToggle={() => setShow((s) => !s)} label={t("auth.togglePassword")} />}
          testID="password-current"
        />
        <TextField
          ref={nextRef}
          label={t("profile.password.new")}
          value={next}
          onChangeText={(v) => {
            setNext(v);
            setErrs((x) => ({ ...x, next: undefined }));
          }}
          placeholder={t("profile.password.newPlaceholder")}
          secureTextEntry={!show}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
          onSubmitEditing={() => repeatRef.current?.focus()}
          error={errs.next ?? (same ? t("profile.password.sameAsCurrent") : next && problem ? t(problem) : undefined)}
          leading={<KeyRound size={18} color={colors.text3} />}
          testID="password-new"
        />
        <PasswordStrength value={next} />
        <TextField
          ref={repeatRef}
          label={t("profile.password.confirm")}
          value={repeat}
          onChangeText={setRepeat}
          placeholder={t("profile.password.confirmPlaceholder")}
          secureTextEntry={!show}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="done"
          error={mismatch ? t("profile.password.mismatch") : undefined}
          leading={<KeyRound size={18} color={colors.text3} />}
          testID="password-repeat"
        />
      </View>
      <Group style={{ marginTop: space[5] }}>
        <ToggleRow title={t("profile.password.signOutOthers")} hint={t("mobileProfile.password.othersHint")} value={others} onChange={setOthers} />
      </Group>
      <View style={{ paddingHorizontal: GUTTER, marginTop: space[5] }}>
        <Button
          label={t("profile.password.submit")}
          disabled={!ready}
          onPress={() => {
            setErrs({});
            stepup.current?.open();
          }}
          testID="password-submit"
        />
      </View>
      <View style={{ marginHorizontal: GUTTER, marginTop: space[6], padding: space[4], borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, gap: space[2] }}>
        <Text variant="headline" weight="700">
          {t("mobileProfile.password.resetTitle")}
        </Text>
        <Text variant="caption" tone="tertiary">
          {t("mobileProfile.password.resetBody")}
        </Text>
        <Button label={t("mobileProfile.password.resetAction")} variant="ghost" size="md" loading={resetting} onPress={() => void reset()} style={{ marginTop: space[1] }} />
      </View>
      <StepUpSheet ref={stepup} action="account_password" title={t("profile.password.stepupTitle")} what={t("mobileProfile.password.stepupWhat")} confirmLabel={t("profile.password.stepupConfirm")} onConfirmed={save} />
    </StackScreen>
  );
}
