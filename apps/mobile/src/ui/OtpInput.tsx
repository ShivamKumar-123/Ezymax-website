// 6-digit email code: one hidden input (paste / SMS autofill friendly) drawn as six boxes.
import * as React from "react";
import { Pressable, TextInput, View } from "react-native";
import { colors, fonts, radius, space } from "@/theme/tokens";
import { Text } from "./Text";

export function OtpInput({ length = 6, onComplete, autoFocus = true, error, label = "Code" }: { length?: number; onComplete: (code: string) => void; autoFocus?: boolean; error?: boolean; label?: string }) {
  const [value, setValue] = React.useState("");
  const ref = React.useRef<TextInput>(null);
  // focus once the screen has settled (autoFocus alone can lose to a transition or a previous field)
  React.useEffect(() => {
    if (!autoFocus) return;
    const id = setTimeout(() => ref.current?.focus(), 120);
    return () => clearTimeout(id);
  }, [autoFocus]);
  return (
    <Pressable onPress={() => ref.current?.focus()} accessibilityLabel={label} accessibilityHint={`${length} digits`}>
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
                backgroundColor: colors.surface,
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
      <TextInput
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
          if (digits.length === length) onComplete(digits);
        }}
        style={{ position: "absolute", opacity: 0.01, width: 1, height: 1 }}
        accessibilityElementsHidden
      />
    </Pressable>
  );
}
