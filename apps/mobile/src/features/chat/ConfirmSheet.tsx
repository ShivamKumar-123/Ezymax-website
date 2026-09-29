// A short yes / no question in a bottom sheet (start over, end the chat).
import * as React from "react";
import { View } from "react-native";
import { Button, Sheet, type SheetRef } from "@/ui";
import { space } from "@/theme/tokens";
import { SheetHeader } from "./SheetHeader";

export const ConfirmSheet = React.forwardRef<SheetRef, { title: string; body: string; confirm: string; cancel: string; onConfirm: () => void; testID?: string }>(function ConfirmSheet({ title, body, confirm, cancel, onConfirm, testID }, ref) {
  const sheet = React.useRef<SheetRef>(null);
  React.useImperativeHandle(ref, () => sheet.current as SheetRef, []);
  const close = () => sheet.current?.dismiss();
  return (
    <Sheet ref={sheet}>
      <View style={{ gap: space[5] }} testID={testID}>
        <SheetHeader title={title} subtitle={body} onClose={close} />
        <View style={{ flexDirection: "row", gap: space[3] }}>
          <Button label={cancel} variant="ghost" full={false} style={{ flex: 1 }} onPress={close} />
          <Button
            label={confirm}
            full={false}
            style={{ flex: 1 }}
            testID={testID ? `${testID}-yes` : undefined}
            onPress={() => {
              close();
              onConfirm();
            }}
          />
        </View>
      </View>
    </Sheet>
  );
});
