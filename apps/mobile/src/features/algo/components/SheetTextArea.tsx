// A multi-line text box for bottom sheets (a review comment). @gorhom/bottom-sheet only lifts a sheet above the
// keyboard for its own text input, so this uses @/ui's SheetTextInput (that input on phones, a plain one on the web).
import * as React from "react";
import { View } from "react-native";
import { SheetTextInput, Text } from "@/ui";
import { colors, radius, space } from "@/theme/tokens";
import { WEB_NO_RING } from "./controls";

export function SheetTextArea({ label, value, onChangeText, placeholder, maxLength = 1000, testID }: { label: string; value: string; onChangeText: (v: string) => void; placeholder?: string; maxLength?: number; testID?: string }) {
  const [focused, setFocused] = React.useState(false);
  return (
    <View style={{ gap: space[2] }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text variant="label" tone="tertiary">
          {label}
        </Text>
        <Text variant="caption" tone="tertiary" style={{ fontVariant: ["tabular-nums"] }}>
          {`${value.length}/${maxLength}`}
        </Text>
      </View>
      <SheetTextInput
        testID={testID}
        value={value}
        onChangeText={(v: string) => onChangeText(v.slice(0, maxLength))}
        placeholder={placeholder}
        placeholderTextColor={colors.text3}
        selectionColor={colors.ember}
        accessibilityLabel={label}
        multiline
        maxLength={maxLength}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          {
            minHeight: 96,
            maxHeight: 180,
            borderRadius: radius.md,
            backgroundColor: colors.surface2,
            borderWidth: 1,
            borderColor: focused ? colors.ember : colors.line,
            paddingHorizontal: space[4],
            paddingTop: space[3],
            paddingBottom: space[3],
            color: colors.text,
            fontSize: 16,
            lineHeight: 22,
            textAlignVertical: "top",
          },
          WEB_NO_RING,
        ]}
      />
    </View>
  );
}
