// Change leverage (D15): pick from the account type's list, confirm with the emailed code (D20), then the server
// applies it. The BFF refuses it while positions are open (before the code is spent) and the engine checks again.
import * as React from "react";
import { View } from "react-native";
import { Lock, TriangleAlert, X } from "lucide-react-native";
import { useT } from "@/i18n";
import { Button, Display, FormError, IconButton, Pill, Sheet, Text, toast, type SheetRef } from "@/ui";
import { colors, radius, space } from "@/theme/tokens";
import { accountError, changeLeverage, isStepupError } from "../api";
import { lev } from "../format";
import { StepUpCode, useStepUp } from "../stepup";
import type { Account } from "../types";
import { BACK, Tag } from "./Chrome";

export function SheetHeader({ title, onClose }: { title: string; onClose: () => void }) {
  const t = useT();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[3], marginBottom: space[3] }}>
      <Display size="md" style={{ flex: 1 }} numberOfLines={1} adjustsFontSizeToFit accessibilityRole="header">
        {title}
      </Display>
      <IconButton accessibilityLabel={t("mobile.a11y.close")} tone="surface" icon={<X size={20} color={colors.text2} />} onPress={onClose} />
    </View>
  );
}

export const LeverageSheet = React.memo(React.forwardRef<SheetRef, { a: Account }>(function LeverageSheet({ a }, ref) {
  const t = useT();
  const sheet = React.useRef<SheetRef>(null);
  React.useImperativeHandle(ref, () => sheet.current as SheetRef, []);
  const [value, setValue] = React.useState(a.leverage);
  const [phase, setPhase] = React.useState<"pick" | "code">("pick");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [code, setCode] = React.useState("");
  const s = useStepUp("leverage", String(a.login));
  const locked = a.positions > 0;
  // the account's leverage right now (the sheet can close before the refreshed account arrives)
  const current = React.useRef(a.leverage);
  current.current = a.leverage;
  // one confirmation at a time: the sixth digit submits, and so can the button
  const inflight = React.useRef(false);

  const reset = React.useCallback(() => {
    setPhase("pick");
    setError(null);
    setBusy(false);
    setValue(current.current);
    s.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.reset]);

  // the choice starts from the account's leverage and follows it when it changes (this change confirmed, another
  // device, staff): never an old value that would offer to change it straight back
  React.useEffect(() => {
    if (phase === "pick") setValue(a.leverage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.leverage]);
  // the type's list changed underneath: keep a choice it still offers
  React.useEffect(() => {
    setValue((v) => (a.leverages.includes(v) ? v : current.current));
  }, [a.leverages]);

  const requestCode = async () => {
    setError(null);
    if (await s.start()) setPhase("code");
  };

  const submit = async (code: string) => {
    if (inflight.current) return;
    inflight.current = true;
    try {
      await apply(code);
    } finally {
      inflight.current = false;
    }
  };

  const apply = async (code: string) => {
    const token = await s.verify(code);
    if (!token) return;
    setBusy(true);
    const r = await changeLeverage(a.login, value, token);
    setBusy(false);
    if (r.ok) {
      toast.show({ title: t("mobileAccounts.leverage.changed"), body: t("mobileAccounts.leverage.changedBody", { login: a.login, from: lev(r.data.from ?? a.leverage), to: lev(r.data.leverage ?? value) }), tone: "success" });
      sheet.current?.dismiss();
      return;
    }
    // the confirmation is spent either way: back to the choice, a new code is sent on the next try
    s.reset();
    setPhase("pick");
    setError(isStepupError(r.error) ? accountError(r.error) : `${t("mobileAccounts.leverage.failed")}: ${accountError(r.error)}`);
  };

  const close = () => sheet.current?.dismiss();

  return (
    <Sheet ref={sheet} onDismiss={reset}>
      {phase === "pick" ? (
        <View style={{ gap: space[4] }}>
          <SheetHeader title={t("mobileAccounts.leverage.sheetTitle")} onClose={close} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
            <Text variant="callout" tone="secondary">
              {t("mobileAccounts.leverage.current")}
            </Text>
            <Tag label={lev(a.leverage)} tone="cream" mono />
            <Text variant="caption" tone="tertiary" numberOfLines={1} style={{ flexShrink: 1 }}>
              · {t("mobileAccounts.leverage.available", { group: a.groupName })}
            </Text>
          </View>
          {locked ? (
            <View style={{ flexDirection: "row", gap: space[3], padding: space[4], borderRadius: radius.lg, backgroundColor: colors.warnSoft, borderWidth: 1, borderColor: "rgba(242,184,75,0.28)" }}>
              <Lock size={18} color={colors.gold} />
              <Text variant="callout" tone="secondary" style={{ flex: 1 }}>
                {t("mobileAccounts.leverage.locked", { count: a.positions })}
              </Text>
            </View>
          ) : (
            <Text tone="secondary">{t("mobileAccounts.leverage.sheetBody")}</Text>
          )}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2], opacity: locked ? 0.45 : 1 }} accessibilityRole="radiogroup" pointerEvents={locked ? "none" : "auto"}>
            {a.leverages.map((l) => (
              <Pill key={l} label={lev(l)} selected={value === l} onPress={() => setValue(l)} style={{ minWidth: 84, alignItems: "center" }} />
            ))}
          </View>
          {value >= 1000 && value !== a.leverage && !locked ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
              <TriangleAlert size={15} color={colors.gold} />
              <Text variant="caption" tone="gold">
                {t("mobileAccounts.leverage.high")}
              </Text>
            </View>
          ) : null}
          <FormError message={error ?? (s.err && !s.challenge ? s.err.message : null)} />
          <Button label={t("mobileAccounts.leverage.apply")} disabled={locked || value === a.leverage} loading={s.sending} onPress={() => void requestCode()} />
        </View>
      ) : (
        <View style={{ gap: space[4] }}>
          <SheetHeader title={t("mobileAccounts.leverage.sheetTitle")} onClose={close} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
            <Tag label={lev(a.leverage)} tone="outline" mono />
            <Text tone="tertiary">→</Text>
            <Tag label={lev(value)} tone="cream" mono />
          </View>
          <StepUpCode s={s} what={t("mobileAccounts.leverage.stepupWhat", { login: a.login, value: lev(value) })} onCode={(c) => void submit(c)} onChange={setCode} />
          <View style={{ flexDirection: "row", gap: space[3] }}>
            <Button
              label={t("mobileAccounts.wizard.back")}
              variant="ghost"
              full={false}
              style={BACK}
              disabled={busy || s.verifying}
              onPress={() => {
                s.reset();
                setPhase("pick");
              }}
            />
            <Button
              label={s.verifying ? t("mobileAccounts.stepup.checking") : busy ? t("mobileAccounts.stepup.saving") : t("mobileAccounts.leverage.confirm")}
              full={false}
              style={{ flex: 1 }}
              loading={busy || s.verifying}
              disabled={code.length !== 6}
              onPress={() => void submit(code)}
            />
          </View>
        </View>
      )}
    </Sheet>
  );
}));
