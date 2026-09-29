// A bottom sheet with a short list of actions (chat options, attach). Each row is a 56 pt target with an icon.
import * as React from "react";
import { View } from "react-native";
import { PressableScale, Sheet, Text, type SheetRef } from "@/ui";
import { colors, radius, space } from "@/theme/tokens";
import { SheetHeader } from "./SheetHeader";

export type Action = { key: string; label: string; hint?: string; icon: React.ReactNode; onPress: () => void; destructive?: boolean };

export const ActionSheet = React.forwardRef<SheetRef, { title: string; actions: Action[]; testID?: string }>(function ActionSheet({ title, actions, testID }, ref) {
  const sheet = React.useRef<SheetRef>(null);
  React.useImperativeHandle(ref, () => sheet.current as SheetRef, []);
  return (
    <Sheet ref={sheet}>
      <View style={{ gap: space[3] }} testID={testID}>
        <SheetHeader title={title} onClose={() => sheet.current?.dismiss()} />
        <View style={{ borderRadius: radius.lg, backgroundColor: colors.surface2, overflow: "hidden" }}>
          {actions.map((a, i) => (
            <PressableScale
              key={a.key}
              scaleTo={0.985}
              accessibilityLabel={a.label}
              testID={testID ? `${testID}-${a.key}` : undefined}
              onPress={() => {
                sheet.current?.dismiss();
                a.onPress();
              }}
              style={{ minHeight: 56, paddingHorizontal: space[4], paddingVertical: space[3], flexDirection: "row", alignItems: "center", gap: space[3], borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface3, alignItems: "center", justifyContent: "center" }}>{a.icon}</View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="headline" weight="600" tone={a.destructive ? "ember" : "primary"}>
                  {a.label}
                </Text>
                {a.hint ? (
                  <Text variant="caption" tone="tertiary">
                    {a.hint}
                  </Text>
                ) : null}
              </View>
            </PressableScale>
          ))}
        </View>
      </View>
    </Sheet>
  );
});
