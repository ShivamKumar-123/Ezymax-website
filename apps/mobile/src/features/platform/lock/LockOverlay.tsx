// The app lock over everything (tabs, stack screens, modal screens, bottom sheets), so nothing the client had open
// shows or takes touches until the phone confirms the owner. While the app sits in the app switcher the same layer
// shows a plain cover instead of balances.
// - iOS: react-native-screens' FullWindowOverlay, a layer on the app's window above every presented view controller.
//   A React Native <Modal> is presented by its own screen's view controller, and UIKit refuses to present it while a
//   native-stack modal (Algo deploy, copy-trading forms …) is open: the lock would silently not appear.
// - Android and the web preview: a React Native <Modal> (a dialog window above the activity and its screens).
// A focused text field loses the keyboard when the lock or the cover appears, so nothing can be typed underneath.
//
// Unlock: the system prompt opens by itself when the lock appears with the app in the foreground (once; after a
// cancel the button stays). "Sign out" is the way out for someone who can't unlock (the password signs back in).
import * as React from "react";
import { AppState, Keyboard, Modal, Platform, ScrollView, useWindowDimensions, View } from "react-native";
import { FullWindowOverlay } from "react-native-screens";
import Animated, { cancelAnimation, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Fingerprint, Lock, ScanFace, type LucideIcon } from "lucide-react-native";
import { useLocale, useT } from "@/i18n";
import { signOut, useMe } from "@/session";
import { Button, ColorBlock, Display, Illustration, KalksMark, PressableScale, Text } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { capability, unlock, useCover, useLocked, type Capability } from "./state";

const METHOD_ICON: Record<string, LucideIcon> = { faceId: ScanFace, face: ScanFace, touchId: Fingerprint, fingerprint: Fingerprint, iris: ScanFace, passcode: Lock };

export function useMethodLabel(cap: Capability | null): string {
  const t = useT();
  return cap?.method ? t.dyn(`mobilePlatform.lock.method.${cap.method}`, "passcode") : t("mobilePlatform.lock.method.passcode");
}

/**
 * Appears at once (no fade-in: nothing behind it may show, not even for a frame) and fades out in 180 ms after an
 * unlock, keeping what it showed until it is gone.
 */
export function LockOverlay() {
  const locked = useLocked();
  const cover = useCover();
  const want = locked || cover;
  const [shown, setShown] = React.useState(want);
  const [mode, setMode] = React.useState<"lock" | "cover">(locked ? "lock" : "cover");
  const opacity = useSharedValue(want ? 1 : 0);
  React.useEffect(() => {
    if (want) {
      cancelAnimation(opacity);
      opacity.value = 1;
      setMode(locked ? "lock" : "cover");
      setShown(true);
      Keyboard.dismiss();
    } else {
      opacity.value = withTiming(0, { duration: 180 }, (done) => {
        if (done) runOnJS(setShown)(false);
      });
    }
  }, [want, locked, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  // a modal window is outside the root view that sets the reading direction: set it again here
  const { rtl } = useLocale();
  const layer = (
    <Animated.View style={[{ flex: 1, backgroundColor: colors.bg, direction: rtl ? "rtl" : "ltr" }, style]} pointerEvents={want ? "auto" : "none"}>
      {mode === "lock" ? <LockScreen /> : <PrivacyCover />}
    </Animated.View>
  );
  if (Platform.OS === "ios") return shown ? <FullWindowOverlay unstable_accessibilityContainerViewIsModal>{layer}</FullWindowOverlay> : null;
  return (
    <Modal visible={shown} transparent animationType="none" presentationStyle="overFullScreen" statusBarTranslucent navigationBarTranslucent onRequestClose={() => {}} supportedOrientations={["portrait"]}>
      {layer}
    </Modal>
  );
}

/** What the app switcher shows while the app is locked away. */
function PrivacyCover() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }} testID="privacy-cover">
      <KalksMark size={56} />
    </View>
  );
}

export function LockScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  // short phones (iPhone SE, 360 x 640 Androids): a smaller heading and art, so Unlock and Sign out stay on screen
  const { height } = useWindowDimensions();
  const compact = height - insets.top - insets.bottom < 720;
  const me = useMe();
  const [cap, setCap] = React.useState<Capability | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [confirmOut, setConfirmOut] = React.useState(false);
  const [leaving, setLeaving] = React.useState(false);
  const method = useMethodLabel(cap);
  const Icon = (cap?.method && METHOD_ICON[cap.method]) || Lock;

  const tryUnlock = React.useCallback(async () => {
    setBusy(true);
    setMessage(null);
    const r = await unlock();
    setBusy(false);
    if (r === "ok" || r === "cancel") return;
    setMessage(r === "lockout" ? t("mobilePlatform.lock.lockout") : r === "unavailable" ? t("mobilePlatform.lock.noScreenLock") : t("mobilePlatform.lock.failed"));
  }, [t]);

  // ask once by itself, as soon as the app is in the foreground
  React.useEffect(() => {
    let done = false;
    const go = () => {
      if (done || AppState.currentState !== "active") return;
      done = true;
      void tryUnlock();
    };
    void capability().then(setCap);
    const timer = setTimeout(go, 250);
    const sub = AppState.addEventListener("change", (s) => s === "active" && setTimeout(go, 250));
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [tryUnlock]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + space[3], paddingBottom: Math.max(insets.bottom, space[4]) + space[2], paddingHorizontal: GUTTER }}
      bounces={false}
      showsVerticalScrollIndicator={false}
      testID="lock-screen"
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 44 }}>
        <KalksMark size={28} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 28, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.surface2 }}>
          <Lock size={13} color={colors.text2} strokeWidth={2.2} />
          <Text variant="label" tone="secondary">
            {t("mobilePlatform.lock.eyebrow")}
          </Text>
        </View>
      </View>

      <View style={{ marginTop: compact ? space[5] : space[8], gap: space[2] }}>
        <Display size={compact ? "xl" : "hero"} accessibilityRole="header">
          {t("mobilePlatform.lock.title")}
        </Display>
        {me?.first_name ? (
          <Text variant="headline" tone="ember" numberOfLines={1}>
            {me.first_name}
          </Text>
        ) : null}
        <Text tone="secondary">{t("mobilePlatform.lock.subtitle")}</Text>
      </View>

      <ColorBlock color="periwinkle" style={{ marginTop: compact ? space[4] : space[6], alignItems: "center", paddingVertical: compact ? space[3] : space[5] }}>
        <Illustration name="security" width={compact ? 170 : 220} height={compact ? 112 : 170} />
      </ColorBlock>

      <View style={{ flex: 1, minHeight: space[5] }} />

      {message ? (
        <Text variant="callout" tone="gold" align="center" accessibilityLiveRegion="polite" style={{ marginBottom: space[3] }}>
          {message}
        </Text>
      ) : null}

      {confirmOut ? (
        <View style={{ gap: space[3], padding: space[4], borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }} testID="lock-signout-confirm">
          <Text variant="headline" weight="700">
            {t("mobilePlatform.lock.signOutTitle")}
          </Text>
          <Text variant="caption" tone="secondary">
            {t("mobilePlatform.lock.signOutBody")}
          </Text>
          <View style={{ flexDirection: "row", gap: space[3] }}>
            <Button label={t("common.cancel")} variant="secondary" size="md" style={{ flex: 1 }} onPress={() => setConfirmOut(false)} />
            <Button
              label={t("mobilePlatform.lock.signOut")}
              variant="cream"
              size="md"
              loading={leaving}
              style={{ flex: 1 }}
              testID="lock-signout"
              onPress={async () => {
                setLeaving(true);
                await signOut();
              }}
            />
          </View>
        </View>
      ) : (
        <>
          <Button
            label={cap?.method && cap.method !== "passcode" ? t("mobilePlatform.lock.unlockWith", { method }) : t("mobilePlatform.lock.unlock")}
            icon={<Icon size={20} color={colors.ink} strokeWidth={2} />}
            loading={busy}
            onPress={() => void tryUnlock()}
            testID="lock-unlock"
          />
          <PressableScale onPress={() => setConfirmOut(true)} scaleTo={1} style={{ minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: space[2] }} accessibilityLabel={`${t("mobilePlatform.lock.notYou")} ${t("mobilePlatform.lock.signOut")}`}>
            <Text variant="callout" tone="tertiary">
              {t("mobilePlatform.lock.notYou")}{" "}
              <Text variant="callout" weight="700" tone="primary">
                {t("mobilePlatform.lock.signOut")}
              </Text>
            </Text>
          </PressableScale>
        </>
      )}
    </ScrollView>
  );
}
