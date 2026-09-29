// Signed-out area: onboarding (first launch), sign in, sign up, forgot password.
import { Stack } from "expo-router";
import { colors } from "@/theme/tokens";

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: "default" }} />;
}
