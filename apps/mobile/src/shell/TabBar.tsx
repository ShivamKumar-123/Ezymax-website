// Floating pill tab bar: solid surface (no blur), the active tab is a cream capsule with its label; the others
// are icons. The capsule moves with a spring (functional motion only). 64 pt tall, 44 pt+ targets.
import * as React from "react";
import { View } from "react-native";
import Animated, { LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "expo-router/tabs";
import { CandlestickChart, House, LayoutGrid, LineChart, Wallet } from "lucide-react-native";
import { useT, type MessageKey } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { PressableScale, Text } from "@/ui";
import { colors, motion, radius, space, TAB_BAR } from "@/theme/tokens";

const TABS: Record<string, { icon: typeof House; label: MessageKey }> = {
  index: { icon: House, label: "mobile.tab.home" },
  markets: { icon: LineChart, label: "mobile.tab.markets" },
  trade: { icon: CandlestickChart, label: "mobile.tab.trade" },
  portfolio: { icon: Wallet, label: "mobile.tab.portfolio" },
  more: { icon: LayoutGrid, label: "mobile.tab.more" },
};

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const t = useT();
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", start: 0, end: 0, bottom: Math.max(insets.bottom - 8, 0) + TAB_BAR.margin, alignItems: "center" }}>
      <View
        accessibilityRole="tablist"
        style={{
          height: TAB_BAR.height,
          flexDirection: "row",
          alignItems: "center",
          gap: space[1],
          paddingHorizontal: 8,
          borderRadius: radius.pill,
          backgroundColor: colors.surface2,
          borderWidth: 1,
          borderColor: colors.lineStrong,
          shadowColor: "#000",
          shadowOpacity: 0.35,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 10,
        }}
      >
        {state.routes.map((route, i) => {
          const def = TABS[route.name];
          if (!def) return null;
          const focused = state.index === i;
          const Icon = def.icon;
          const label = t(def.label);
          return (
            <Animated.View key={route.key} layout={LinearTransition.springify().damping(motion.spring.damping).stiffness(motion.spring.stiffness)}>
              <PressableScale
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={label}
                onPress={() => {
                  const e = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                  if (!focused && !e.defaultPrevented) {
                    haptic.select();
                    navigation.navigate(route.name, route.params);
                  }
                }}
                onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
                style={{
                  height: 48,
                  minWidth: 48,
                  paddingHorizontal: focused ? space[4] : space[3],
                  borderRadius: radius.pill,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: space[2],
                  backgroundColor: focused ? colors.cream : "transparent",
                }}
              >
                <Icon size={21} strokeWidth={focused ? 2.1 : 1.8} color={focused ? colors.ink : colors.text3} />
                {focused ? (
                  <Text variant="callout" weight="700" color={colors.ink} numberOfLines={1}>
                    {label}
                  </Text>
                ) : null}
              </PressableScale>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}
