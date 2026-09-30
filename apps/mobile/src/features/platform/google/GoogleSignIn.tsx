// "Continue with Google" for the sign-in and sign-up screens (app/(auth)/…):
//
//   import { GoogleSignIn } from "@/features/platform/google/GoogleSignIn";
//   <GoogleSignIn />                          // sign-in: "Continue with Google"
//   <GoogleSignIn mode="signUp" referral={ref} />  // sign-up: "Sign up with Google" (+ the partner code)
//
// Renders nothing when this build has no Google OAuth client for the platform (config.ts), so it can be placed
// unconditionally. Otherwise: the Google button (Google's dark style, the pill shape of the app), its own error line,
// and the "or with email" divider under it. A known Google account signs straight in; a new one goes to the profile
// step (/google-profile).
import * as React from "react";
import { ActivityIndicator, View, type StyleProp, type ViewStyle } from "react-native";
import { useRouter } from "expo-router";
import { useT } from "@/i18n";
import { PressableScale, Text } from "@/ui";
import { colors, radius, space } from "@/theme/tokens";
import { GOOGLE_AVAILABLE } from "./config";
import { continueWithGoogle } from "./flow";
import { GOOGLE_BRAND, GoogleMark } from "./GoogleMark";

export { GOOGLE_AVAILABLE };

type Props = {
  mode?: "signIn" | "signUp";
  /** partner referral code to carry into a Google sign-up */
  referral?: string | null;
  /** show "or with email" under the button (default true) */
  divider?: boolean;
  /** called with the message when sign-in fails (the component also shows it) */
  onError?: (message: string) => void;
  style?: StyleProp<ViewStyle>;
};

export function GoogleSignIn({ mode = "signIn", referral, divider = true, onError, style }: Props) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  if (!GOOGLE_AVAILABLE) return null;

  const run = async () => {
    setError(null);
    setBusy(true);
    const out = await continueWithGoogle(referral);
    setBusy(false);
    if (out.kind === "profile") router.push("/google-profile");
    else if (out.kind === "error") {
      setError(out.message);
      onError?.(out.message);
    }
  };

  const label = busy ? t("auth.google.opening") : t(mode === "signUp" ? "auth.google.signUp" : "auth.google.continue");
  return (
    <View style={[{ gap: space[3] }, style]} testID="google-sign-in">
      <PressableScale
        onPress={() => void run()}
        disabled={busy}
        accessibilityLabel={label}
        testID="google-button"
        style={{ height: 54, borderRadius: radius.pill, backgroundColor: GOOGLE_BRAND.fill, borderWidth: 1, borderColor: GOOGLE_BRAND.stroke, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space[3], paddingHorizontal: space[5] }}
      >
        {busy ? <ActivityIndicator color={GOOGLE_BRAND.text} /> : <GoogleMark size={20} />}
        <Text variant="headline" weight="600" color={GOOGLE_BRAND.text} numberOfLines={1}>
          {label}
        </Text>
      </PressableScale>
      {error ? (
        <Text variant="caption" tone="gold" accessibilityLiveRegion="polite" testID="google-error">
          {error}
        </Text>
      ) : null}
      {divider ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[3], marginTop: space[1] }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
          <Text variant="caption" tone="tertiary">
            {t("auth.google.orWithEmail")}
          </Text>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
        </View>
      ) : null}
    </View>
  );
}
