// Signed-in area. The tabs are the home of the app; feature screens (wallet, settings, …) are pushed on this
// native stack: app/(app)/<feature>/... (see README › Conventions).
import { Stack } from "expo-router";
import { useTradingController } from "@/features/trading/accounts";
import { colors } from "@/theme/tokens";

export default function AppLayout() {
  // the active trading account: default pick, engine stream, quote group
  useTradingController();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: "default", gestureEnabled: true, fullScreenGestureEnabled: true }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
