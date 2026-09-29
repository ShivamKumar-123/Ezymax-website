// Credential rows (login, server, passwords shown once) with show / hide and copy, and the password rules.
import * as React from "react";
import { View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Check, Copy, Eye, EyeOff } from "lucide-react-native";
import { useT } from "@/i18n";
import { Mono, PressableScale, Text, toast } from "@/ui";
import { colors, radius, space } from "@/theme/tokens";
import { PASSWORD_RULES } from "../format";

export async function copyText(value: string, what: string, t: ReturnType<typeof useT>) {
  try {
    await Clipboard.setStringAsync(value);
    toast.show({ title: t("mobileAccounts.copied", { what }) });
  } catch {
    toast.show({ title: t("mobileAccounts.copyFailed"), tone: "error" });
  }
}

function RoundAction({ label, onPress, children }: { label: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={label} scaleTo={0.9} style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface3 }}>
      {children}
    </PressableScale>
  );
}

/** Label over a value with copy (and show / hide for secrets, hidden by default). */
export function SecretRow({ label, value, secret, hint }: { label: string; value: string; secret?: boolean; hint?: string }) {
  const t = useT();
  const [shown, setShown] = React.useState(!secret);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[3], minHeight: 64, paddingVertical: space[2] }}>
      <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
        <Text variant="label" tone="tertiary" numberOfLines={1}>
          {label}
        </Text>
        <Mono size={17} weight="medium" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ writingDirection: "ltr" }} accessibilityLabel={shown ? value : t("mobileAccounts.secret.hiddenA11y", { what: label })}>
          {shown ? value : "•".repeat(Math.min(12, Math.max(8, value.length)))}
        </Mono>
        {hint ? (
          <Text variant="caption" tone="tertiary" numberOfLines={1}>
            {hint}
          </Text>
        ) : null}
      </View>
      {secret ? (
        <RoundAction label={shown ? t("mobileAccounts.secret.hide", { what: label }) : t("mobileAccounts.secret.show", { what: label })} onPress={() => setShown((s) => !s)}>
          {shown ? <EyeOff size={19} color={colors.text2} strokeWidth={1.9} /> : <Eye size={19} color={colors.text2} strokeWidth={1.9} />}
        </RoundAction>
      ) : null}
      <RoundAction label={t("mobileAccounts.copyA11y", { what: label })} onPress={() => void copyText(value, label, t)}>
        <Copy size={18} color={colors.text2} strokeWidth={1.9} />
      </RoundAction>
    </View>
  );
}

/** Live checklist of the trading-password rule (8–64 characters, a letter and a digit). */
export function PasswordRules({ password }: { password: string }) {
  const t = useT();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }} accessibilityRole="summary">
      {PASSWORD_RULES.map((r) => {
        const ok = r.test(password);
        return (
          <View key={r.key} style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 28, paddingHorizontal: space[3], borderRadius: radius.pill, backgroundColor: ok ? "rgba(127,209,185,0.14)" : colors.surface2 }} accessibilityState={{ checked: ok }}>
            {ok ? <Check size={13} color={colors.mint} strokeWidth={3} /> : <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.text3 }} />}
            <Text variant="caption" color={ok ? colors.mint : colors.text3}>
              {t.dyn(`mobileAccounts.password.rule.${r.key}`, r.key)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
