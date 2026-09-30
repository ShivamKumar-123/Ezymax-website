// Signed-in area. The tabs are the home of the app; feature screens (wallet, settings, …) are pushed on this
// native stack: app/(app)/<feature>/... (see README › Conventions).
import { Stack } from "expo-router";
import { PlatformRoot } from "@/features/platform/PlatformRoot";
import { TradingController } from "@/features/trading/accounts";
import { colors } from "@/theme/tokens";

const SCREEN_OPTIONS = { headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: "default", gestureEnabled: true, fullScreenGestureEnabled: true } as const;
const LOCK_OPTIONS = { animation: "none" } as const;

export default function AppLayout() {
  return (
    <>
      <Stack screenOptions={SCREEN_OPTIONS}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="lock" options={LOCK_OPTIONS} />
      </Stack>
      {/* the active trading account: default pick, engine stream, quote group (renders nothing; the layout never
          re-renders for account changes) */}
      <TradingController />
      {/* app lock, push notifications, notification taps and deep links (src/features/platform) */}
      <PlatformRoot />
    </>
  );
}
