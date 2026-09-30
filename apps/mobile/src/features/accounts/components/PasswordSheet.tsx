// Change the trading or investor password: new password (rules checked as you type), the emailed code (D20),
// then the new password is shown once. Terminal sessions that used the old one are signed out by the engine.
import * as React from "react";
import { View, type TextInput } from "react-native";
import { Sparkles, TriangleAlert } from "lucide-react-native";
import { useT } from "@/i18n";
import { Button, FormError, PressableScale, RevealToggle, Sheet, Text, toast, type SheetRef } from "@/ui";
import { alpha } from "@/theme/alpha";
import { colors, radius, space } from "@/theme/tokens";
import { accountError, changePassword, isStepupError } from "../api";
import { passwordOk } from "../format";
import { generatePassword } from "../password";
import { StepUpCode, useStepUp } from "../stepup";
import type { Account, PasswordKind } from "../types";
import { PasswordRules, SecretRow } from "./Credentials";
import { BACK } from "./Chrome";
import { SheetHeader } from "./LeverageSheet";
import { SheetTextField } from "./SheetInputs";

type Phase = "form" | "code" | "done";

export const PasswordSheet = React.memo(React.forwardRef<SheetRef, { a: Account; kind: PasswordKind }>(function PasswordSheet({ a, kind }, ref) {
  const t = useT();
  const sheet = React.useRef<SheetRef>(null);
  React.useImperativeHandle(ref, () => sheet.current as SheetRef, []);
  const [phase, setPhase] = React.useState<Phase>("form");
  const [pw, setPw] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [shown, setShown] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [done, setDone] = React.useState<string | null>(null);
  const confirmRef = React.useRef<TextInput>(null);
  const s = useStepUp(kind === "trading" ? "trading_password" : "investor_password", String(a.login));
  const ok = passwordOk(pw) && pw === confirm;

  const reset = React.useCallback(() => {
    setPhase("form");
    setPw("");
    setConfirm("");
    setShown(false);
    setError(null);
    setBusy(false);
    setDone(null);
    s.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.reset]);

  // a different password kind starts clean
  React.useEffect(() => reset(), [kind, reset]);

  const requestCode = async () => {
    setError(null);
    if (await s.start()) setPhase("code");
  };

  // one confirmation at a time: the sixth digit submits, and so can the button
  const inflight = React.useRef(false);
  const submit = async (c: string) => {
    if (inflight.current) return;
    inflight.current = true;
    try {
      await apply(c);
    } finally {
      inflight.current = false;
    }
  };

  const apply = async (c: string) => {
    const token = await s.verify(c);
    if (!token) return;
    setBusy(true);
    const r = await changePassword(a.login, kind, pw, token);
    setBusy(false);
    if (r.ok) {
      const n = r.data.sessionsRevoked ?? 0;
      toast.show({ title: t(kind === "trading" ? "mobileAccounts.password.changed.trading" : "mobileAccounts.password.changed.investor"), body: n ? `#${a.login} · ${t("mobileAccounts.password.sessionsOut", { count: n })}` : `#${a.login}`, tone: "success" });
      setDone(pw);
      setPw("");
      setConfirm("");
      setPhase("done");
      return;
    }
    // the confirmation is spent either way: back to the form; the next try emails a new code
    s.reset();
    setPhase("form");
    setError(isStepupError(r.error) ? accountError(r.error) : `${t("mobileAccounts.password.failed")}: ${accountError(r.error)}`);
  };

  const close = () => sheet.current?.dismiss();
  const title = t(kind === "trading" ? "mobileAccounts.password.title.trading" : "mobileAccounts.password.title.investor");

  return (
    <Sheet ref={sheet} onDismiss={reset}>
      {phase === "form" ? (
        <View style={{ gap: space[4] }}>
          <SheetHeader title={title} onClose={close} />
          <Text tone="secondary">
            #{a.login} · {t(kind === "trading" ? "mobileAccounts.password.body.trading" : "mobileAccounts.password.body.investor")}
          </Text>
          <FormError message={error ?? (s.err && !s.challenge ? s.err.message : null)} />
          <SheetTextField
            label={t("mobileAccounts.password.new")}
            value={pw}
            onChangeText={setPw}
            secureTextEntry={!shown}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="next"
            maxLength={64}
            onSubmitEditing={() => confirmRef.current?.focus()}
            mono={shown}
            trailing={<RevealToggle shown={shown} onToggle={() => setShown((v) => !v)} label={shown ? t("mobileAccounts.password.hide") : t("mobileAccounts.password.show")} />}
          />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[3] }}>
            <View style={{ flex: 1 }}>
              <PasswordRules password={pw} />
            </View>
            <PressableScale
              onPress={() => {
                const p = generatePassword();
                setPw(p);
                setConfirm(p);
                setShown(true);
              }}
              scaleTo={0.95}
              accessibilityLabel={t("mobileAccounts.password.generate")}
              style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, paddingHorizontal: space[3], borderRadius: radius.pill, borderWidth: 1, borderColor: colors.lineStrong }}
            >
              <Sparkles size={15} color={colors.gold} />
              <Text variant="caption" weight="700">
                {t("mobileAccounts.password.generate")}
              </Text>
            </PressableScale>
          </View>
          <SheetTextField
            ref={confirmRef}
            label={t("mobileAccounts.password.confirm")}
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry={!shown}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="done"
            maxLength={64}
            mono={shown}
            error={confirm && confirm !== pw ? t("mobileAccounts.password.mismatch") : null}
            onSubmitEditing={() => ok && void requestCode()}
          />
          <Text variant="caption" tone="tertiary">
            {t("mobileAccounts.password.differ")}
          </Text>
          <Button label={t("mobileAccounts.password.continue")} disabled={!ok} loading={s.sending} onPress={() => void requestCode()} />
        </View>
      ) : phase === "code" ? (
        <View style={{ gap: space[4] }}>
          <SheetHeader title={title} onClose={close} />
          <StepUpCode s={s} what={t(kind === "trading" ? "mobileAccounts.password.stepupWhat.trading" : "mobileAccounts.password.stepupWhat.investor", { login: a.login })} onCode={(c) => void submit(c)} onChange={setCode} />
          <View style={{ flexDirection: "row", gap: space[3] }}>
            <Button
              label={t("mobileAccounts.wizard.back")}
              variant="ghost"
              full={false}
              style={BACK}
              disabled={busy || s.verifying}
              onPress={() => {
                s.reset();
                setPhase("form");
              }}
            />
            <Button
              label={s.verifying ? t("mobileAccounts.stepup.checking") : busy ? t("mobileAccounts.stepup.saving") : t("mobileAccounts.password.set")}
              full={false}
              style={{ flex: 1 }}
              loading={busy || s.verifying}
              disabled={code.length !== 6}
              onPress={() => void submit(code)}
            />
          </View>
        </View>
      ) : (
        <View style={{ gap: space[4] }}>
          <SheetHeader title={t("mobileAccounts.password.doneTitle")} onClose={close} />
          {done ? <SecretRow label={title} value={done} secret /> : null}
          <View style={{ flexDirection: "row", gap: space[3], padding: space[4], borderRadius: radius.lg, backgroundColor: colors.warnSoft, borderWidth: 1, borderColor: alpha(colors.warn, 0.28) }}>
            <TriangleAlert size={18} color={colors.gold} />
            <Text variant="callout" tone="secondary" style={{ flex: 1 }}>
              {t("mobileAccounts.password.shownOnce")}
            </Text>
          </View>
          <Button label={t("mobileAccounts.created.done")} variant="cream" onPress={close} />
        </View>
      )}
    </Sheet>
  );
}));
