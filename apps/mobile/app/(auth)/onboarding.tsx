// First launch: three illustrated slides (welcome, markets, security). The pager follows the finger (native
// paging scroll); the progress bars are driven by the scroll position on the UI thread.
import * as React from "react";
import { useWindowDimensions, View } from "react-native";
import Animated, { interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useT, type MessageKey } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { kv } from "@/lib/kv";
import { PREF } from "@/lib/prefs";
import { Button, ColorBlock, Display, Illustration, KalksMark, Mono, PressableScale, Text, type IllustrationName } from "@/ui";
import { colors, GUTTER, radius, space, type BlockColor } from "@/theme/tokens";

const SLIDES: { key: string; art: IllustrationName; color: BlockColor; title: MessageKey; body: MessageKey }[] = [
  { key: "welcome", art: "welcome", color: "periwinkle", title: "mobile.onboarding.welcome.title", body: "mobile.onboarding.welcome.body" },
  { key: "markets", art: "market", color: "ember", title: "mobile.onboarding.markets.title", body: "mobile.onboarding.markets.body" },
  { key: "security", art: "security", color: "mint", title: "mobile.onboarding.security.title", body: "mobile.onboarding.security.body" },
];

export default function Onboarding() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const x = useSharedValue(0);
  const ref = React.useRef<Animated.ScrollView>(null);
  const [page, setPage] = React.useState(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    x.value = e.contentOffset.x;
  });

  const finish = (to: "/sign-up" | "/sign-in") => {
    kv.set(PREF.onboarded, "1");
    router.replace(to);
  };
  const next = () => {
    haptic.select();
    if (page >= SLIDES.length - 1) return finish("/sign-up");
    ref.current?.scrollTo({ x: (page + 1) * width, animated: true });
    setPage(page + 1);
  };
  const blockH = Math.min(height * 0.46, width * 1.05);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={{ height: 56, paddingHorizontal: GUTTER, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <KalksMark size={30} />
        <PressableScale onPress={() => finish("/sign-in")} scaleTo={1} accessibilityLabel={t("mobile.onboarding.skip")} style={{ minHeight: 44, minWidth: 44, justifyContent: "center", alignItems: "flex-end" }}>
          <Text variant="callout" tone="secondary" weight="600">
            {t("mobile.onboarding.skip")}
          </Text>
        </PressableScale>
      </View>

      <Animated.ScrollView
        ref={ref}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        style={{ flexGrow: 0 }}
      >
        {SLIDES.map((s, i) => (
          <View key={s.key} style={{ width, paddingHorizontal: GUTTER, paddingTop: space[3] }} accessibilityLabel={`${t(s.title)}. ${t(s.body)}`}>
            <ColorBlock color={s.color} padded={false} style={{ height: blockH, alignItems: "center", justifyContent: "center" }}>
              <Mono size={13} weight="bold" color={colors.ink} style={{ position: "absolute", top: space[5], start: space[6] }}>
                {`0${i + 1} / 0${SLIDES.length}`}
              </Mono>
              <Illustration name={s.art} width={width - GUTTER * 2 - space[10]} height={blockH - space[14]} />
            </ColorBlock>
            <Display size="xl" style={{ marginTop: space[6] }} accessibilityRole="header">
              {t(s.title)}
            </Display>
            <Text tone="secondary" style={{ marginTop: space[3], maxWidth: 340 }}>
              {t(s.body)}
            </Text>
          </View>
        ))}
      </Animated.ScrollView>

      <View style={{ flex: 1 }} />
      <View style={{ paddingHorizontal: GUTTER, paddingBottom: Math.max(insets.bottom, space[4]) + space[2], gap: space[4] }}>
        <View style={{ flexDirection: "row", gap: space[2] }} accessibilityLabel={t("mobile.onboarding.step", { n: page + 1, total: SLIDES.length })}>
          {SLIDES.map((s, i) => (
            <Progress key={s.key} i={i} x={x} width={width} />
          ))}
        </View>
        <Button label={page >= SLIDES.length - 1 ? t("mobile.onboarding.getStarted") : t("mobile.onboarding.next")} onPress={next} />
        <Button label={t("mobile.onboarding.haveAccount")} variant="ghost" onPress={() => finish("/sign-in")} />
      </View>
    </View>
  );
}

function Progress({ i, x, width }: { i: number; x: SharedValue<number>; width: number }) {
  const fill = useAnimatedStyle(() => ({ width: `${interpolate(x.value / width, [i - 1, i], [0, 100], "clamp")}%` }));
  return (
    <View style={{ flex: 1, height: 4, borderRadius: radius.pill, backgroundColor: colors.surface3, overflow: "hidden" }}>
      <Animated.View style={[{ height: 4, backgroundColor: colors.cream, borderRadius: radius.pill }, fill]} />
    </View>
  );
}
