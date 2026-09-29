// The five tabs. Screens stay mounted after their first visit (state kept) and are frozen while hidden, so a
// price tick on one tab never renders another. Tab bar: src/shell/TabBar.tsx (floating pill).
import { Tabs } from "expo-router";
import { TabBar } from "@/shell/TabBar";
import { colors } from "@/theme/tokens";

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, freezeOnBlur: true, lazy: true, animation: "none", sceneStyle: { backgroundColor: colors.bg } }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="markets" />
      <Tabs.Screen name="trade" />
      <Tabs.Screen name="portfolio" />
      <Tabs.Screen name="more" />
    </Tabs>
  );
}
