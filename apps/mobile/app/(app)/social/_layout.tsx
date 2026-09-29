// Social trading stack (copy trading, PAMM, MAM). Forms that move money or grant authority open as modals
// (a card sheet on iOS, swipe down to dismiss); everything else is pushed. Entering at /social/pamm or /social/mam
// (More tab) starts the stack there, so Back returns to where the user came from; a screen opened with nothing
// underneath (deep link) goes back to the hub (useBack).
import { Stack } from "expo-router";
import { colors } from "@/theme/tokens";

const modal = { presentation: "modal", gestureEnabled: true, fullScreenGestureEnabled: false } as const;

export default function SocialLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: "default", gestureEnabled: true, fullScreenGestureEnabled: true }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="follow/[id]" options={modal} />
      <Stack.Screen name="subscriptions/[id]/settings" options={modal} />
      <Stack.Screen name="pamm/[id]/invest" options={modal} />
      <Stack.Screen name="pamm/[id]/redeem" options={modal} />
      <Stack.Screen name="mam/connect/[id]" options={modal} />
      <Stack.Screen name="mam/links/[id]/limits" options={modal} />
    </Stack>
  );
}
