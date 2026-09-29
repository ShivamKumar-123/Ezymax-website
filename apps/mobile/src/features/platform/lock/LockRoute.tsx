// /lock: locks the app now (the lock covers whatever was open) and steps back to it, so unlocking returns there.
// With the app lock off it opens Settings › App lock instead, to turn it on.
import * as React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { colors } from "@/theme/tokens";
import { lockNow, lockStore } from "./state";

export function LockRoute() {
  const router = useRouter();
  React.useEffect(() => {
    if (!lockStore.get().settings.enabled) {
      router.replace("/settings/app-lock");
      return;
    }
    lockNow();
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }, [router]);
  return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
}
