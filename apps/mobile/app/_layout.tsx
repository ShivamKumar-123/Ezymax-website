// Root: fonts, language, session and the price stream are ready before the splash hides, so the first frame is
// real content (cached data), never a spinner. Signed-in routes live in (app), signed-out ones in (auth).
import * as React from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { Anton_400Regular } from "@expo-google-fonts/anton/400Regular";
import { JetBrainsMono_400Regular } from "@expo-google-fonts/jetbrains-mono/400Regular";
import { JetBrainsMono_500Medium } from "@expo-google-fonts/jetbrains-mono/500Medium";
import { JetBrainsMono_700Bold } from "@expo-google-fonts/jetbrains-mono/700Bold";
import { initI18n, useLocale } from "@/i18n";
import { startNetWatch } from "@/lib/net";
import { feed } from "@/market/feed";
import { bootSession, useSession } from "@/session";
import { OfflineBanner } from "@/shell/OfflineBanner";
import { colors } from "@/theme/tokens";

void SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions?.({ duration: 180, fade: true });

const boot = Promise.all([initI18n(), bootSession()]).then(() => {
  startNetWatch();
  feed.start();
});

export default function RootLayout() {
  const [fonts] = useFonts({ Anton_400Regular, JetBrainsMono_400Regular, JetBrainsMono_500Medium, JetBrainsMono_700Bold });
  const [booted, setBooted] = React.useState(false);
  const status = useSession((s) => s.status);
  const { rtl } = useLocale();

  React.useEffect(() => {
    void boot.then(() => setBooted(true));
  }, []);
  const ready = fonts && booted && status !== "loading";
  React.useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => {});
  }, [ready]);
  if (!ready) return null;

  const signedIn = status === "signedIn";
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <View style={{ flex: 1, direction: rtl ? "rtl" : "ltr" }}>
          <BottomSheetModalProvider>
            <StatusBar style="light" />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: "default" }}>
              <Stack.Protected guard={signedIn}>
                <Stack.Screen name="(app)" />
              </Stack.Protected>
              <Stack.Protected guard={!signedIn}>
                <Stack.Screen name="(auth)" />
              </Stack.Protected>
            </Stack>
            <OfflineBanner />
          </BottomSheetModalProvider>
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
