// Turning one-tap trading on: what it does and the risk of a mistaken tap, then one explicit button (the same
// acknowledgement MT5 asks for before one-click trading). Turning it off needs no sheet.
import * as React from "react";
import { View } from "react-native";
import { Zap } from "lucide-react-native";
import { useT } from "@/i18n";
import { Banner, Button, Display, Sheet, Text, toast, type SheetRef } from "@/ui";
import { colors, radius, space } from "@/theme/tokens";
import { setOneTap } from "../oneTap";

export const OneTapSheet = React.forwardRef<SheetRef>(function OneTapSheet(_, ref) {
  const t = useT();
  const dismiss = () => (ref && typeof ref !== "function" ? ref.current?.dismiss() : undefined);
  return (
    <Sheet ref={ref}>
      <View style={{ gap: space[4] }}>
        <View style={{ width: 52, height: 52, borderRadius: radius.lg, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" }}>
          <Zap size={24} color={colors.ink} strokeWidth={2} />
        </View>
        <Display size="md">{t("mobileDepth.oneTap.sheet.title")}</Display>
        <Text tone="secondary">{t("mobileDepth.oneTap.sheet.body")}</Text>
        <Banner tone="warn" title={t("mobileDepth.oneTap.sheet.risk")} />
        <Button
          label={t("mobileDepth.oneTap.sheet.enable")}
          testID="one-tap-enable"
          onPress={() => {
            setOneTap(true);
            toast.show({ title: t("mobileDepth.oneTap.on") });
            dismiss();
          }}
        />
        <Button label={t("common.cancel")} variant="ghost" onPress={dismiss} />
      </View>
    </Sheet>
  );
});
