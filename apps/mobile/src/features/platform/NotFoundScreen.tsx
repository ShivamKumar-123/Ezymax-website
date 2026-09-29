// A link that opens the app (kalks://…, a notification) but matches no screen: say so plainly and offer Home.
import * as React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useT } from "@/i18n";
import { EmptyState, Screen } from "@/ui";

export function NotFoundScreen() {
  const t = useT();
  const router = useRouter();
  return (
    <Screen tabBar={false} scroll={false}>
      <View style={{ flex: 1, justifyContent: "center" }} testID="screen-not-found">
        <EmptyState illustration="emptyHistory" size={220} title={t("mobilePlatform.link.notFound.title")} body={t("mobilePlatform.link.notFound.body")} action={t("mobilePlatform.link.notFound.home")} onAction={() => router.replace("/")} />
      </View>
    </Screen>
  );
}
