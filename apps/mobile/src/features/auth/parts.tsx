// Shared pieces of the sign-in / sign-up / reset screens.
import * as React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useT } from "@/i18n";
import { Display, IconButton, KalksMark, Mono, PressableScale, Screen, Text, Trans } from "@/ui";
import { colors, GUTTER, space } from "@/theme/tokens";

/** Signed-out screen: back button or the Kalks mark, eyebrow, tall title, subtitle, form, footer. */
export function AuthScaffold({ eyebrow, title, subtitle, back, onBack, children, footer }: { eyebrow?: string; title: string; subtitle?: React.ReactNode; back?: boolean; onBack?: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  const router = useRouter();
  const t = useT();
  return (
    <Screen tabBar={false} keyboard contentStyle={{ paddingHorizontal: GUTTER, flexGrow: 1 }}>
      <View style={{ height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        {back ? (
          <IconButton accessibilityLabel={t("mobile.a11y.back")} icon={<ChevronLeft size={22} color={colors.text} />} onPress={() => (onBack ? onBack() : router.canGoBack() ? router.back() : router.replace("/sign-in"))} />
        ) : (
          <KalksMark size={30} />
        )}
      </View>
      <View style={{ marginTop: space[6], gap: space[2] }}>
        {eyebrow ? (
          <Text variant="label" tone="ember">
            {eyebrow}
          </Text>
        ) : null}
        <Display size="xl" accessibilityRole="header">
          {title}
        </Display>
        {subtitle ? typeof subtitle === "string" ? <Text tone="secondary">{subtitle}</Text> : subtitle : null}
      </View>
      <View style={{ marginTop: space[8], gap: space[4] }}>{children}</View>
      <View style={{ flex: 1, minHeight: space[8] }} />
      {footer ? <View style={{ paddingVertical: space[6], alignItems: "center" }}>{footer}</View> : null}
    </Screen>
  );
}

/** "Resend in 0:30" that turns into a resend link. `onResend` may return a wait in seconds (rate limit). */
export function ResendLink({ seconds, onResend }: { seconds: number; onResend: () => Promise<number | void> }) {
  const t = useT();
  const [left, setLeft] = React.useState(seconds);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);
  const label = left > 0 ? t("auth.otp.resendIn", { seconds: String(left).padStart(2, "0") }) : busy ? t("auth.otp.sending") : t("auth.otp.resendCode");
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
      style={{ minHeight: 44, justifyContent: "center" }}
    >
      <Text variant="callout" weight="600" tone={left > 0 || busy ? "tertiary" : "ember"}>
        {label}
      </Text>
    </PressableScale>
  );
}

/** Development servers without SMTP hand back the code; show it like the Client Area does. */
export function DevCodeHint({ code }: { code?: string }) {
  if (!code) return null;
  return (
    <View style={{ borderWidth: 1, borderStyle: "dashed", borderColor: colors.lineStrong, borderRadius: 14, padding: space[3] }}>
      <Trans k="auth.otp.devHint" vars={{ code }} tone="tertiary" tags={{ code: (c) => <Mono size={13} weight="bold">{c}</Mono> }} />
    </View>
  );
}

/** Password strength (same rule as the Client Area: 8+ chars, uppercase, number, symbol). */
export function PasswordStrength({ value }: { value: string }) {
  const t = useT();
  const checks = [value.length >= 8, /[A-Z]/.test(value), /[0-9]/.test(value), /[^A-Za-z0-9]/.test(value)];
  const score = checks.filter(Boolean).length;
  const label = [t("auth.strength.tooWeak"), t("auth.strength.weak"), t("auth.strength.fair"), t("auth.strength.good"), t("auth.strength.strong")][score];
  const color = score < 2 ? colors.ember : score < 4 ? colors.gold : colors.mint;
  return (
    <View style={{ gap: space[2] }}>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < score ? color : colors.surface3 }} />
        ))}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text variant="caption" tone="tertiary">
          {t("auth.strength.rule")}
        </Text>
        {value ? (
          <Text variant="caption" weight="700" color={color}>
            {label}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** A centred text link row, e.g. "New to Kalks? Create an account". */
export function FooterLink({ lead, action, onPress }: { lead: string; action: string; onPress: () => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[1], flexWrap: "wrap", justifyContent: "center" }}>
      <Text tone="tertiary">{lead}</Text>
      <PressableScale onPress={onPress} scaleTo={1} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: space[1] }}>
        <Text weight="700">{action}</Text>
      </PressableScale>
    </View>
  );
}
