// Push notification UI:
// - PushAskSheet: the soft ask before the system prompt (never on the first launch; from the second, on Home, at most
//   three times, two weeks apart). The system prompt only follows "Turn on notifications".
// - PushCard: the same offer at the top of the inbox; after "Don't allow" it links to the phone's settings instead.
// - PushBanner: a push that arrives while the app is open (and unlocked) slides in at the top; tap opens it, a swipe
//   up (following the finger) or 4.5 s puts it away.
import * as React from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BellRing, LifeBuoy, Siren, Wallet, X } from "lucide-react-native";
import { i18n, useT } from "@/i18n";
import { kv } from "@/lib/kv";
import { createStore, useStore } from "@/lib/store";
import { Button, ColorBlock, Display, KalksMark, PressableScale, Sheet, Text, toast, type SheetRef } from "@/ui";
import { alpha } from "@/theme/alpha";
import { colors, GUTTER, motion, radius, space } from "@/theme/tokens";
import { withSystemDialog } from "../lock/state";
import { useSession } from "@/session";
import { openPushSettings, pushAllowed, PUSH_SUPPORTED, requestPermission, usePushState, type PushPayload } from "./index";

/* ---------------- the soft ask ---------------- */

const ASK_KEY = "kalks.push.ask"; // {count, at}
const CARD_KEY = "kalks.push.cardHidden"; // ms
const LAUNCH_KEY = "kalks.launches";
const MAX_ASKS = 3;
const ASK_GAP = 14 * 24 * 3600_000;

// cold starts on this phone (the soft ask never shows on the first one)
const launches = (Number(kv.get(LAUNCH_KEY)) || 0) + 1;
kv.set(LAUNCH_KEY, String(launches));

/** Whether the soft ask may show now (permission never asked, second launch or later, not asked too often). */
export function mayAsk(): boolean {
  if (!PUSH_SUPPORTED || launches < 2) return false;
  const a = kv.getJSON<{ count: number; at: number }>(ASK_KEY);
  return !a || (a.count < MAX_ASKS && Date.now() - a.at > ASK_GAP);
}

function noteAsked() {
  const a = kv.getJSON<{ count: number; at: number }>(ASK_KEY);
  kv.setJSON(ASK_KEY, { count: (a?.count ?? 0) + 1, at: Date.now() });
}

/** Turn on: the system prompt, then the phone registers (index.ts). */
export async function turnOnPush(): Promise<boolean> {
  const t = i18n.t;
  const state = await withSystemDialog(() => requestPermission());
  if (state === "granted") {
    toast.show({ title: t("mobilePlatform.push.enabled"), tone: "success" });
    return true;
  }
  return false;
}

function PreviewNotification() {
  const t = useT();
  return (
    <View style={{ backgroundColor: alpha(colors.cream, 0.96), borderRadius: radius.lg, padding: space[3], gap: 4 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
        <View style={{ width: 20, height: 20, borderRadius: 6, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
          <KalksMark size={12} />
        </View>
        <Text variant="label" color={colors.ink2} style={{ flex: 1, fontSize: 10 }}>
          KALKS
        </Text>
        <Text variant="caption" color={colors.ink3}>
          {t("mobilePlatform.push.ask.now")}
        </Text>
      </View>
      <Text variant="callout" weight="700" color={colors.ink}>
        {t("mobilePlatform.push.ask.sampleTitle")}
      </Text>
      <Text variant="caption" color={colors.ink2} numberOfLines={1}>
        {t("mobilePlatform.push.ask.sampleBody")}
      </Text>
    </View>
  );
}

export const PushAskSheet = React.forwardRef<{ present: () => void }, object>(function PushAskSheet(_props, ref) {
  const t = useT();
  const sheet = React.useRef<SheetRef>(null);
  const [busy, setBusy] = React.useState(false);
  React.useImperativeHandle(ref, () => ({
    present: () => {
      noteAsked();
      sheet.current?.present();
    },
  }));
  const points: [typeof Wallet, string][] = [
    [Wallet, t("mobilePlatform.push.ask.point.money")],
    [Siren, t("mobilePlatform.push.ask.point.risk")],
    [LifeBuoy, t("mobilePlatform.push.ask.point.support")],
  ];
  return (
    <Sheet ref={sheet} scrollable>
      <View style={{ gap: space[4], paddingTop: space[1] }} testID="push-ask">
        <ColorBlock color="ember" style={{ padding: space[5] }}>
          <PreviewNotification />
          <View style={{ height: 10, marginHorizontal: space[4], borderBottomLeftRadius: 12, borderBottomRightRadius: 12, backgroundColor: alpha(colors.cream, 0.55) }} />
          <View style={{ height: 8, marginHorizontal: space[8], borderBottomLeftRadius: 10, borderBottomRightRadius: 10, backgroundColor: alpha(colors.cream, 0.3) }} />
        </ColorBlock>
        <View style={{ gap: space[2] }}>
          <Text variant="label" tone="ember">
            {t("mobilePlatform.push.ask.eyebrow")}
          </Text>
          <Display size="lg">{t("mobilePlatform.push.ask.title")}</Display>
          <Text tone="secondary">{t("mobilePlatform.push.ask.body")}</Text>
        </View>
        <View style={{ gap: space[2] }}>
          {points.map(([Icon, label]) => (
            <View key={label} style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" }}>
                <Icon size={16} color={colors.text} strokeWidth={1.9} />
              </View>
              <Text variant="callout" weight="600">
                {label}
              </Text>
            </View>
          ))}
        </View>
        <Button
          label={t("mobilePlatform.push.ask.allow")}
          loading={busy}
          testID="push-ask-allow"
          onPress={async () => {
            setBusy(true);
            await turnOnPush();
            setBusy(false);
            sheet.current?.dismiss();
          }}
        />
        <Button label={t("mobilePlatform.push.ask.later")} variant="ghost" onPress={() => sheet.current?.dismiss()} testID="push-ask-later" />
        <Text variant="caption" tone="tertiary" align="center">
          {t("mobilePlatform.push.ask.note")}
        </Text>
      </View>
    </Sheet>
  );
});

/** The offer at the top of the inbox (not after the reader hid it, for 30 days). */
export function PushCard() {
  const t = useT();
  const push = usePushState();
  const allowed = useSession(pushAllowed);
  const [hidden, setHidden] = React.useState(() => Date.now() - (Number(kv.get(CARD_KEY)) || 0) < 30 * 24 * 3600_000);
  const [busy, setBusy] = React.useState(false);
  if (!PUSH_SUPPORTED || !allowed || hidden || (push.permission !== "undetermined" && push.permission !== "denied")) return null;
  const denied = push.permission === "denied" || !push.canAskAgain;
  return (
    <View style={{ marginHorizontal: GUTTER, marginBottom: space[3], borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: space[4], flexDirection: "row", gap: space[3] }} testID="push-card">
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: alpha(colors.ember, 0.16), alignItems: "center", justifyContent: "center" }}>
        <BellRing size={19} color={colors.ember} strokeWidth={1.9} />
      </View>
      <View style={{ flex: 1, gap: space[1] }}>
        <Text variant="callout" weight="700">
          {t(denied ? "mobilePlatform.push.card.deniedTitle" : "mobilePlatform.push.card.title")}
        </Text>
        <Text variant="caption" tone="secondary">
          {t(denied ? "mobilePlatform.push.card.deniedBody" : "mobilePlatform.push.card.body")}
        </Text>
        <View style={{ flexDirection: "row", marginTop: space[2] }}>
          <Button
            size="sm"
            full={false}
            loading={busy}
            label={t(denied ? "mobilePlatform.push.card.deniedAction" : "mobilePlatform.push.card.action")}
            onPress={async () => {
              if (denied) return openPushSettings();
              setBusy(true);
              await turnOnPush();
              setBusy(false);
            }}
          />
        </View>
      </View>
      <PressableScale
        onPress={() => {
          kv.set(CARD_KEY, String(Date.now()));
          setHidden(true);
        }}
        scaleTo={1}
        accessibilityLabel={t("mobilePlatform.push.card.dismiss")}
        style={{ width: 44, height: 44, marginTop: -space[2], marginEnd: -space[2], alignItems: "center", justifyContent: "center" }}
      >
        <X size={18} color={colors.text3} />
      </PressableScale>
    </View>
  );
}

/* ---------------- in-app banner ---------------- */

const bannerStore = createStore<PushPayload | null>(null);
export function showPushBanner(p: PushPayload) {
  bannerStore.set(p);
}
const hideBanner = () => bannerStore.set(null);

export function PushBanner({ hidden, onOpen }: { hidden: boolean; onOpen: (p: PushPayload) => void }) {
  const p = useStore(bannerStore);
  if (!p || hidden) return null;
  return <BannerCard key={p.key} p={p} onOpen={onOpen} />;
}

function BannerCard({ p, onOpen }: { p: PushPayload; onOpen: (p: PushPayload) => void }) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const y = useSharedValue(-160);
  const pressed = useSharedValue(0);
  // a finger on the banner holds it: the 4.5 s auto-dismiss waits until it lets go
  const holding = React.useRef(false);
  const hold = React.useCallback((on: boolean) => {
    holding.current = on;
  }, []);
  const away = React.useCallback(() => {
    y.value = withTiming(-180, { duration: 180 }, (done) => {
      if (done) runOnJS(hideBanner)();
    });
  }, [y]);
  React.useEffect(() => {
    y.value = withSpring(0, motion.spring);
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (holding.current) timer = setTimeout(tick, 1500);
      else away();
    };
    timer = setTimeout(tick, 4500);
    return () => clearTimeout(timer);
  }, [y, away]);
  const open = React.useCallback(() => {
    hideBanner();
    onOpen(p);
  }, [onOpen, p]);
  const pan = Gesture.Pan()
    .activeOffsetY([-6, 6])
    .onBegin(() => {
      // immediate press feedback, on the UI thread
      pressed.value = withTiming(1, { duration: 70 });
      runOnJS(hold)(true);
    })
    .onUpdate((e) => {
      // follows the finger upwards; a little give downwards
      y.value = e.translationY < 0 ? e.translationY : e.translationY * 0.2;
    })
    .onEnd((e) => {
      if (e.translationY < -28 || e.velocityY < -600) {
        y.value = withTiming(-180, { duration: 160 }, (done) => {
          if (done) runOnJS(hideBanner)();
        });
      } else {
        y.value = withSpring(0, motion.spring);
      }
    })
    .onFinalize(() => {
      pressed.value = withSpring(0, motion.spring);
      runOnJS(hold)(false);
    });
  const tap = Gesture.Tap().onEnd(() => {
    runOnJS(open)();
  });
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }, { scale: 1 - (1 - motion.pressScale) * pressed.value }] }));
  return (
    <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
      <Animated.View
        style={[{ position: "absolute", top: insets.top + space[2], start: space[3], end: space[3], zIndex: 50 }, style]}
        accessible
        accessibilityRole="button"
        accessibilityLabel={t("mobilePlatform.push.banner.a11y", { title: p.title })}
        testID="push-banner"
      >
        <View style={{ flexDirection: "row", gap: space[3], alignItems: "center", padding: space[3], borderRadius: radius.lg, backgroundColor: colors.surface3, borderWidth: 1, borderColor: colors.lineStrong }}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
            <KalksMark size={18} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="callout" weight="700" numberOfLines={1}>
              {p.title}
            </Text>
            {p.body ? (
              <Text variant="caption" tone="secondary" numberOfLines={2}>
                {p.body}
              </Text>
            ) : null}
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}
