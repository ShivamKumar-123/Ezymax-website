// Settings › App lock (/settings/app-lock): turn the lock on or off (the phone confirms the owner either way) and
// choose how long Kalks may stay in the background before it asks again (a longer time is confirmed too). The setting
// belongs to this phone. Reached from the More tab (also by view-only logins: it is a phone setting, not an account
// change).
import * as React from "react";
import { Platform, Switch, View } from "react-native";
import Animated from "react-native-reanimated";
import { Check, EyeOff, Smartphone } from "lucide-react-native";
import { useT } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { Banner, Button, ColorBlock, Display, Illustration, PressableScale, Skeleton, Text, toast, useBottomInset } from "@/ui";
import { alpha } from "@/theme/alpha";
import { colors, GUTTER, space } from "@/theme/tokens";
import { Group, LargeTitle, SectionLabel, TopBar, useScrollY } from "../components/Chrome";
import { useMethodLabel } from "./LockOverlay";
import { TIMEOUTS } from "./policy";
import { capability, confirmOwner, lockNow, lockStore, saveLockSettings, useLockSettings, type Capability } from "./state";

export function KSwitch({ value, onValueChange, disabled, accessibilityLabel, testID }: { value: boolean; onValueChange: (v: boolean) => void; disabled?: boolean; accessibilityLabel?: string; testID?: string }) {
  const web = { activeThumbColor: colors.cream, activeTrackColor: colors.ember } as object;
  const sw = <Switch testID={testID} value={value} onValueChange={onValueChange} disabled={disabled} trackColor={{ false: colors.surface3, true: colors.ember }} thumbColor={colors.cream} ios_backgroundColor={colors.surface3} accessibilityLabel={accessibilityLabel} {...web} />;
  // react-native-web draws the thumb from the left even in right-to-left layouts; phones mirror switches themselves
  return Platform.OS === "web" ? <View style={{ direction: "ltr" }}>{sw}</View> : sw;
}

export function AppLockScreen() {
  const t = useT();
  const settings = useLockSettings();
  const bottom = useBottomInset(false);
  const { y, onScroll } = useScrollY();
  const [cap, setCap] = React.useState<Capability | null>(null);
  const [busy, setBusy] = React.useState(false);
  const method = useMethodLabel(cap);

  React.useEffect(() => {
    void capability().then(setCap);
  }, []);

  const unavailable = cap !== null && !cap.available;
  const web = Platform.OS === "web" && unavailable;

  const toggle = async (on: boolean) => {
    if (busy) return;
    // a phone without any screen lock can't confirm anything: turning the (useless) lock off needs no prompt
    if (!on && unavailable) {
      saveLockSettings({ ...lockStore.get().settings, enabled: false });
      return;
    }
    setBusy(true);
    const r = await confirmOwner(t(on ? "mobilePlatform.settings.confirmOn" : "mobilePlatform.settings.confirmOff"));
    setBusy(false);
    if (r === "ok") {
      haptic.select();
      saveLockSettings({ ...lockStore.get().settings, enabled: on });
      toast.show({ title: t(on ? "mobilePlatform.settings.on" : "mobilePlatform.settings.off"), tone: "success" });
    } else if (r !== "cancel") {
      toast.show({ title: t("mobilePlatform.settings.notConfirmed"), body: r === "lockout" ? t("mobilePlatform.lock.lockout") : undefined, tone: "error" });
    }
  };

  // a longer time in the background weakens the lock, so the owner confirms it (a shorter one needs nothing)
  const chooseTimeout = async (sec: number) => {
    if (busy || sec === settings.timeoutSec) return;
    haptic.select();
    if (sec > settings.timeoutSec && !unavailable) {
      setBusy(true);
      const r = await confirmOwner(t("mobilePlatform.settings.confirmTimeout"));
      setBusy(false);
      if (r !== "ok") {
        if (r !== "cancel") toast.show({ title: t("mobilePlatform.settings.notConfirmed"), body: r === "lockout" ? t("mobilePlatform.lock.lockout") : undefined, tone: "error" });
        return;
      }
    }
    saveLockSettings({ ...lockStore.get().settings, timeoutSec: sec });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }} testID="screen-app-lock">
      <TopBar title={t("mobilePlatform.settings.title")} y={y} />
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottom + space[4] }}>
        <LargeTitle eyebrow={t("mobilePlatform.settings.eyebrow")} title={t("mobilePlatform.settings.title")} subtitle={t("mobilePlatform.settings.subtitle", { method })} />

        <View style={{ paddingHorizontal: GUTTER }}>
          <ColorBlock color={settings.enabled ? "mint" : "cream"} style={{ flexDirection: "row", alignItems: "center", gap: space[3], paddingVertical: space[5], minHeight: 156 }}>
            <View style={{ flex: 1, gap: space[2] }}>
              <Text variant="label" color={colors.ink2}>
                {t("mobilePlatform.settings.toggle")}
              </Text>
              {cap === null ? (
                <Skeleton w={150} h={30} style={{ backgroundColor: alpha(colors.ink, 0.12) }} />
              ) : (
                <Display size="md" color={colors.ink} testID="lock-status">
                  {t(settings.enabled ? "mobilePlatform.settings.on" : "mobilePlatform.settings.off")}
                </Display>
              )}
              <Text variant="caption" color={colors.ink2}>
                {t("mobilePlatform.settings.toggleHint", { method })}
              </Text>
            </View>
            <Illustration name="security" width={112} height={100} />
          </ColorBlock>
        </View>

        {web ? (
          <Banner tone="info" icon={<Smartphone size={18} color={colors.periwinkle} />} title={t("mobilePlatform.settings.webTitle")} body={t("mobilePlatform.settings.webBody")} style={{ marginHorizontal: GUTTER, marginTop: space[4] }} />
        ) : unavailable ? (
          <Banner tone="warn" title={t("mobilePlatform.settings.unavailableTitle")} body={t("mobilePlatform.settings.unavailableBody")} style={{ marginHorizontal: GUTTER, marginTop: space[4] }} />
        ) : null}

        <Group style={{ marginTop: space[4] }}>
          <PressableScale
            onPress={() => void toggle(!settings.enabled)}
            disabled={busy || cap === null || (unavailable && !settings.enabled)}
            scaleTo={1}
            accessibilityRole="switch"
            accessibilityState={{ checked: settings.enabled, disabled: busy || cap === null || (unavailable && !settings.enabled) }}
            accessibilityLabel={t("mobilePlatform.settings.toggle")}
            testID="lock-toggle-row"
            style={{ minHeight: 60, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[4], paddingVertical: space[2] }}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="headline" weight="600">
                {t("mobilePlatform.settings.toggle")}
              </Text>
              <Text variant="caption" tone="tertiary">
                {t("mobilePlatform.settings.thisPhone")}
              </Text>
            </View>
            <KSwitch value={settings.enabled} disabled={busy || cap === null || (unavailable && !settings.enabled)} onValueChange={(v) => void toggle(v)} accessibilityLabel={t("mobilePlatform.settings.toggle")} testID="lock-toggle" />
          </PressableScale>
        </Group>

        {settings.enabled ? (
          <>
            <SectionLabel title={t("mobilePlatform.settings.after")} />
            <Group>
              {TIMEOUTS.map((sec) => {
                const selected = settings.timeoutSec === sec;
                return (
                  <PressableScale
                    key={sec}
                    disabled={busy}
                    onPress={() => void chooseTimeout(sec)}
                    scaleTo={0.985}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    testID={`lock-timeout-${sec}`}
                    style={{ minHeight: 52, flexDirection: "row", alignItems: "center", paddingHorizontal: space[4] }}
                  >
                    <Text variant="callout" weight={selected ? "700" : "500"} style={{ flex: 1 }}>
                      {t.dyn(`mobilePlatform.settings.timeout.${sec}`, `${sec}s`)}
                    </Text>
                    {selected ? <Check size={20} color={colors.ember} strokeWidth={2.4} /> : null}
                  </PressableScale>
                );
              })}
            </Group>
            <Text variant="caption" tone="tertiary" style={{ paddingHorizontal: GUTTER, marginTop: space[2] }}>
              {t("mobilePlatform.settings.afterHint")}
            </Text>
          </>
        ) : null}

        <View style={{ flexDirection: "row", gap: space[3], paddingHorizontal: GUTTER, marginTop: space[6], alignItems: "flex-start" }}>
          <EyeOff size={16} color={colors.text3} style={{ marginTop: 2 }} />
          <Text variant="caption" tone="tertiary" style={{ flex: 1 }}>
            {t("mobilePlatform.settings.privacy")}
          </Text>
        </View>

        {settings.enabled ? (
          <View style={{ paddingHorizontal: GUTTER, marginTop: space[6] }}>
            <Button label={t("mobilePlatform.settings.lockNow")} variant="secondary" onPress={lockNow} testID="lock-now" />
          </View>
        ) : null}
      </Animated.ScrollView>
    </View>
  );
}
