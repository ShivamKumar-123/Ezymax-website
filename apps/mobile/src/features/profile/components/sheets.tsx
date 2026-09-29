// Bottom sheets used by the profile screens: a confirmation (title, text, one action) and a list of choices.
// Destructive actions use the ember primary button: red is reserved for money.
import * as React from "react";
import { View } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { useT } from "@/i18n";
import { Button, Display, Sheet, Text, type SheetRef } from "@/ui";
import { colors, space } from "@/theme/tokens";
import { Group, MenuRow } from "./bits";

type ConfirmProps = {
  title: string;
  cancelLabel?: string;
  body?: string;
  confirm: string;
  busy?: boolean;
  busyLabel?: string;
  onConfirm: () => void;
  onDismiss?: () => void;
  children?: React.ReactNode;
  testID?: string;
};

export const ConfirmSheet = React.forwardRef<SheetRef, ConfirmProps>(function ConfirmSheet({ title, cancelLabel, body, confirm, busy, busyLabel, onConfirm, onDismiss, children, testID }, ref) {
  const t = useT();
  const inner = React.useRef<SheetRef>(null);
  React.useImperativeHandle(ref, () => inner.current as SheetRef, []);
  return (
    <Sheet ref={inner} onDismiss={onDismiss}>
      <View style={{ gap: space[3], paddingTop: space[2] }} testID={testID}>
        <Display size="md">{title}</Display>
        {body ? <Text tone="secondary">{body}</Text> : null}
        {children}
        <View style={{ gap: space[2], marginTop: space[3] }}>
          <Button label={busy && busyLabel ? busyLabel : confirm} loading={busy} onPress={onConfirm} testID={testID ? `${testID}-confirm` : undefined} />
          <Button label={cancelLabel ?? t("common.cancel")} variant="ghost" disabled={busy} onPress={() => inner.current?.dismiss()} />
        </View>
      </View>
    </Sheet>
  );
});

export type Choice = { key: string; icon?: LucideIcon; title: string; hint?: string; onPress: () => void };

export const ChoiceSheet = React.forwardRef<SheetRef, { title: string; body?: string; choices: Choice[]; footer?: React.ReactNode }>(function ChoiceSheet({ title, body, choices, footer }, ref) {
  return (
    <Sheet ref={ref}>
      <View style={{ gap: space[3], paddingTop: space[2] }}>
        <Display size="md">{title}</Display>
        {body ? <Text tone="secondary">{body}</Text> : null}
        <Group style={{ marginHorizontal: 0, marginTop: space[1], backgroundColor: colors.surface2 }}>
          {choices.map((c) => (
            <MenuRow key={c.key} icon={c.icon} title={c.title} hint={c.hint} onPress={c.onPress} />
          ))}
        </Group>
        {footer}
      </View>
    </Sheet>
  );
});
