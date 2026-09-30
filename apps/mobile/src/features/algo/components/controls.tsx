// Form controls of the Algo flows: radio cards (account, mode, stop option), a switch row and small selectable
// chips (periods, balances, multipliers). 44 pt targets throughout; selection gives a light haptic.
import * as React from "react";
import { Platform, Switch, View, type StyleProp, type ViewStyle } from "react-native";
import { haptic } from "@/lib/haptics";
import { PressableScale, Text } from "@/ui";
import { colors, fonts, radius, space } from "@/theme/tokens";

/** Text inputs draw their own focus border; in the web preview Chrome would add its focus ring on top (it ignores a
 *  zero outline width, so the outline style goes too). Nothing on phones. */
export const WEB_NO_RING = Platform.OS === "web" ? ({ outlineWidth: 0, outlineStyle: "none" } as object) : undefined;

/** A selectable card with a radio dot, a title and a line of explanation. */
export const RadioCard = React.memo(function RadioCard({
  selected,
  onPress,
  title,
  text,
  right,
  disabled,
  style,
  testID,
}: {
  selected: boolean;
  onPress: () => void;
  title: string;
  text?: string;
  right?: React.ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      haptics="select"
      scaleTo={0.985}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled: !!disabled }}
      accessibilityLabel={text ? `${title}. ${text}` : title}
      style={[
        {
          minHeight: 60,
          flexDirection: "row",
          alignItems: "center",
          gap: space[3],
          paddingHorizontal: space[4],
          paddingVertical: space[3],
          borderRadius: radius.lg,
          borderWidth: 1.5,
          borderColor: selected ? colors.ember : colors.line,
          backgroundColor: selected ? colors.emberSoft : colors.surface,
        },
        style,
      ]}
    >
      <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: selected ? colors.ember : colors.lineStrong, alignItems: "center", justifyContent: "center" }}>
        {selected ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.ember }} /> : null}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="headline" weight="700" numberOfLines={2}>
          {title}
        </Text>
        {text ? (
          <Text variant="caption" tone="secondary" style={{ lineHeight: 17 }}>
            {text}
          </Text>
        ) : null}
      </View>
      {right}
    </PressableScale>
  );
});

/** Title + hint with a switch on the end side. */
export function SwitchRow({ title, hint, value, onChange, testID, disabled }: { title: string; hint?: string; value: boolean; onChange: (v: boolean) => void; testID?: string; disabled?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[3], minHeight: 52 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="headline" weight="700">
          {title}
        </Text>
        {hint ? (
          <Text variant="caption" tone="tertiary" style={{ lineHeight: 17 }}>
            {hint}
          </Text>
        ) : null}
      </View>
      <Switch
        testID={testID}
        value={value}
        disabled={disabled}
        onValueChange={(v) => {
          haptic.select();
          onChange(v);
        }}
        accessibilityLabel={title}
        trackColor={{ false: colors.surface3, true: colors.ember }}
        thumbColor={Platform.OS === "ios" ? undefined : colors.cream}
        ios_backgroundColor={colors.surface3}
        {...(Platform.OS === "web" ? ({ activeThumbColor: colors.cream } as object) : null)}
      />
    </View>
  );
}

/** A small selectable chip (tabular label): periods, balances, multipliers. */
export const Chip = React.memo(function Chip({ label, selected, onPress, disabled, testID, mono = true }: { label: string; selected?: boolean; onPress: () => void; disabled?: boolean; testID?: string; mono?: boolean }) {
  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      haptics="select"
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      accessibilityLabel={label}
      style={{
        height: 40,
        minWidth: 44,
        paddingHorizontal: space[3],
        borderRadius: radius.pill,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
        borderColor: selected ? colors.cream : colors.line,
        backgroundColor: selected ? colors.cream : colors.surface,
      }}
    >
      <Text variant="callout" weight="700" color={selected ? colors.ink : colors.text2} style={mono ? { fontFamily: fonts.monoMedium, fontSize: 13 } : undefined} numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  );
});

/** A wrapping row of chips. */
export function ChipRow({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }, style]}>{children}</View>;
}

/** A labelled block of a form: small uppercase label, then the control. */
export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space[2] }}>
      <Text variant="label" tone="tertiary">
        {label}
      </Text>
      {children}
      {hint ? (
        <Text variant="caption" tone="tertiary" style={{ lineHeight: 17 }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
