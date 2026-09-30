// Form field: label above, 52 pt input, error below. Accessible (label, error announced), RTL-safe.
// Inside a bottom sheet it uses the sheet's own text input (the sheet then rises above the keyboard) and a raised
// fill that stands off the sheet's surface; everywhere else it is a plain TextInput.
import * as React from "react";
import { Platform, TextInput, View, type TextInputProps } from "react-native";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { Eye, EyeOff } from "lucide-react-native";
import { colors, radius, space } from "@/theme/tokens";
import { PressableScale } from "./PressableScale";
import { useInSheet } from "./Sheet";
import { Text } from "./Text";

/** The sheet-aware input on phones; a plain one on the web preview (no keyboard to avoid there, and the sheet
 *  input's blur handler relies on a React Native API react-native-web doesn't have). */
export const SheetTextInput = (Platform.OS === "web" ? TextInput : BottomSheetTextInput) as unknown as typeof TextInput;

/** The field draws its own focus border; the browser's focus ring would double it in the web preview. */
export const NO_WEB_OUTLINE = Platform.OS === "web" ? ({ outlineWidth: 0 } as object) : null;

export type TextFieldProps = TextInputProps & { label: string; error?: string | null; hint?: string; leading?: React.ReactNode; trailing?: React.ReactNode; mono?: boolean };

export const TextField = React.forwardRef<TextInput, TextFieldProps>(function TextField({ label, error, hint, leading, trailing, mono, style, onFocus, onBlur, ...rest }, ref) {
  const [focused, setFocused] = React.useState(false);
  const inSheet = useInSheet();
  const Input = inSheet ? SheetTextInput : TextInput;
  return (
    <View style={{ gap: space[2] }}>
      <Text variant="label" tone="tertiary">
        {label}
      </Text>
      <View
        style={{
          height: 52,
          borderRadius: radius.md,
          backgroundColor: inSheet ? colors.surface2 : colors.surface,
          borderWidth: 1,
          borderColor: error ? colors.down : focused ? colors.ember : colors.line,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: space[4],
          gap: space[3],
        }}
      >
        {leading}
        <Input
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
          style={[{ flex: 1, height: "100%", color: colors.text, fontSize: 16, fontFamily: mono ? "JetBrainsMono_500Medium" : undefined }, NO_WEB_OUTLINE, style]}
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
