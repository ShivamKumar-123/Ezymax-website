// Algo stack (strategies, deployments, backtests, marketplace, API keys and webhooks). Forms that grant authority or
// move money open as modals (a card sheet on iOS, swipe down to dismiss): deploying a strategy and subscribing to a
// marketplace strategy. Everything else is pushed. A screen opened with nothing underneath (a link) goes back to
// /algo (useBack).
import { Stack } from "expo-router";
import { colors } from "@/theme/tokens";

const modal = { presentation: "modal", gestureEnabled: true, fullScreenGestureEnabled: false } as const;

export default function AlgoLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: "default", gestureEnabled: true, fullScreenGestureEnabled: true }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="strategies/[id]/deploy" options={modal} />
      <Stack.Screen name="marketplace/[id]/subscribe" options={modal} />
    </Stack>
  );
}
