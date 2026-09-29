// Inputs for bottom sheets. @gorhom/bottom-sheet only lifts a sheet above the keyboard for its own
// BottomSheetTextInput, so these mirror @/ui's TextField and OtpInput (same look) on top of it.
import * as React from "react";
import { Platform, Pressable, TextInput as RNTextInput, View, type TextInput, type TextInputProps } from "react-native";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { Text } from "@/ui";
import { colors, fonts, radius, space } from "@/theme/tokens";

/** The sheet-aware input on phones; a plain one on the web preview (no keyboard to avoid, and the sheet's blur
 *  handler relies on a React Native API react-native-web doesn't have). */
const Input = (Platform.OS === "web" ? RNTextInput : BottomSheetTextInput) as unknown as React.ComponentType<TextInputProps & { ref?: React.Ref<TextInput> }>;

/** The field draws its own focus border; the browser's focus ring would double it in the web preview. */
const WEB_NO_OUTLINE = Platform.OS === "web" ? ({ outlineWidth: 0 } as object) : null;

type FieldProps = TextInputProps & { label: string; error?: string | null; hint?: string; trailing?: React.ReactNode; mono?: boolean };

export const SheetTextField = React.forwardRef<TextInput, FieldProps>(function SheetTextField({ label, error, hint, trailing, mono, style, onFocus, onBlur, ...rest }, ref) {
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
          backgroundColor: colors.surface2,
          borderWidth: 1,
          borderColor: error ? colors.down : focused ? colors.ember : colors.line,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: space[4],
          gap: space[3],
        }}
      >
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
          style={[{ flex: 1, height: "100%", color: colors.text, fontSize: 16, fontFamily: mono ? fonts.monoMedium : undefined }, WEB_NO_OUTLINE, style]}
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

/** Six code boxes over one hidden input (paste / one-time-code autofill friendly), for sheets. */
export function SheetOtpInput({ length = 6, onComplete, onChange, error, label, autoFocus = true }: { length?: number; onComplete: (code: string) => void; onChange?: (code: string) => void; error?: boolean; label: string; autoFocus?: boolean }) {
  const [value, setValue] = React.useState("");
  const ref = React.useRef<TextInput>(null);
  return (
    <Pressable onPress={() => ref.current?.focus()} accessibilityLabel={label} accessibilityHint={`${length}`}>
      <View style={{ flexDirection: "row", gap: space[2], justifyContent: "space-between", direction: "ltr" }}>
        {Array.from({ length }, (_, i) => {
          const ch = value[i];
          const active = i === value.length;
          return (
            <View
              key={i}
              style={{
                flex: 1,
                height: 58,
                borderRadius: radius.md,
                backgroundColor: colors.surface2,
                borderWidth: 1,
                borderColor: error ? colors.down : active ? colors.ember : colors.line,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontFamily: fonts.monoBold, fontSize: 24, lineHeight: 30 }}>{ch ?? ""}</Text>
            </View>
          );
        })}
      </View>
      <Input
        ref={ref}
        value={value}
        autoFocus={autoFocus}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={length}
        caretHidden
        onChangeText={(v) => {
          const digits = v.replace(/\D/g, "").slice(0, length);
          setValue(digits);
          onChange?.(digits);
          if (digits.length === length) onComplete(digits);
        }}
        style={{ position: "absolute", opacity: 0.01, width: 1, height: 1 }}
        accessibilityElementsHidden
      />
    </Pressable>
  );
}
