// Form field: label above, 52 pt input, error below. Accessible (label, error announced), RTL-safe.
import * as React from "react";
import { TextInput, View, type TextInputProps } from "react-native";
import { Eye, EyeOff } from "lucide-react-native";
import { colors, radius, space } from "@/theme/tokens";
import { PressableScale } from "./PressableScale";
import { Text } from "./Text";

export type TextFieldProps = TextInputProps & { label: string; error?: string | null; hint?: string; leading?: React.ReactNode; trailing?: React.ReactNode; mono?: boolean };

export const TextField = React.forwardRef<TextInput, TextFieldProps>(function TextField({ label, error, hint, leading, trailing, mono, style, onFocus, onBlur, ...rest }, ref) {
  const [focused, setFocused] = React.useState(false);
  return (
    <View style={{ gap: space[2] }}>
      <Text variant="label" tone="tertiary">
        {label}
      </Text>
      <View
        style={{
          height: 52,
          borderRadius: radius.md,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: error ? colors.down : focused ? colors.ember : colors.line,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: space[4],
          gap: space[3],
        }}
      >
        {leading}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.text3}
          selectionColor={colors.ember}
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[{ flex: 1, height: "100%", color: colors.text, fontSize: 16, fontFamily: mono ? "JetBrainsMono_500Medium" : undefined }, style]}
          {...rest}
        />
        {trailing}
      </View>
      {error ? (
        <Text variant="caption" tone="down" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="tertiary">
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

/** Eye toggle for password fields. */
export function RevealToggle({ shown, onToggle, label }: { shown: boolean; onToggle: () => void; label: string }) {
  const Icon = shown ? EyeOff : Eye;
  return (
    <PressableScale onPress={onToggle} accessibilityLabel={label} scaleTo={1} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
      <Icon size={20} color={colors.text3} strokeWidth={1.75} />
    </PressableScale>
  );
}
