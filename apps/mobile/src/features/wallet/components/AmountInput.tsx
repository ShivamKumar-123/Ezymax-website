// The big editorial amount field: tall display digits, the currency beside them, a "Max" pill, and the hint or
// error underneath. Input is cleaned as typed (digits, one decimal point, at most `maxDp` decimals).
import * as React from "react";
import { Platform, TextInput, View, type TextStyle } from "react-native";
import { useT } from "@/i18n";
import { PressableScale, Text } from "@/ui";
import { colors, fonts, HIT, radius, space } from "@/theme/tokens";
import { cleanAmount } from "../lib/money";

/** react-native-web draws the browser focus ring around inputs; the underline already shows focus. */
const WEB_NO_OUTLINE = (Platform.OS === "web" ? { outlineStyle: "none" } : null) as TextStyle | null;

type Props = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  currency?: string;
  hint?: string | null;
  error?: string | null;
  onMax?: () => void;
  maxDp?: number;
  editable?: boolean;
  autoFocus?: boolean;
  accessibilityLabel?: string;
  testID?: string;
};

export function AmountInput({ label, value, onChange, currency = "USDT", hint, error, onMax, maxDp = 2, editable = true, autoFocus, accessibilityLabel, testID }: Props) {
  const t = useT();
  const [focused, setFocused] = React.useState(false);
  const ref = React.useRef<TextInput>(null);
  const size = value.length > 11 ? 38 : value.length > 8 ? 46 : 54;
  return (
    <View style={{ gap: space[2], opacity: editable ? 1 : 0.5 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 34 }}>
        <Text variant="label" tone="tertiary">
          {label}
        </Text>
        {onMax && editable ? (
          <PressableScale onPress={onMax} haptics="select" accessibilityLabel={t("wallet.max")} style={{ height: 34, paddingHorizontal: space[4], borderRadius: radius.pill, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.lineStrong, justifyContent: "center" }}>
            <Text variant="caption" weight="700">
              {t("wallet.max")}
            </Text>
          </PressableScale>
        ) : null}
      </View>
      <PressableScale onPress={() => ref.current?.focus()} scaleTo={1} accessible={false} style={{ flexDirection: "row", alignItems: "flex-end", gap: space[3], paddingBottom: space[2], borderBottomWidth: 2, borderBottomColor: error ? colors.down : focused ? colors.ember : colors.lineStrong, minHeight: 72 }}>
        <TextInput
          ref={ref}
          testID={testID}
          value={value}
          editable={editable}
          autoFocus={autoFocus}
          onChangeText={(v) => onChange(cleanAmount(v, maxDp))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType="decimal-pad"
          inputMode="decimal"
          placeholder="0"
          placeholderTextColor={colors.text3}
          selectionColor={colors.ember}
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityHint={error ?? hint ?? undefined}
          maxLength={16}
          style={[{ flex: 1, minWidth: 0, fontFamily: fonts.display, fontSize: size, lineHeight: size + 6, color: colors.text, paddingVertical: 0, fontVariant: ["tabular-nums"] }, WEB_NO_OUTLINE]}
        />
        <Text variant="headline" tone="tertiary" weight="700" style={{ marginBottom: 8 }}>
          {currency}
        </Text>
      </PressableScale>
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
}

/** Quick amounts under the deposit field. */
export function AmountChips({ amounts, value, onPick }: { amounts: string[]; value: string; onPick: (v: string) => void }) {
  return (
    <View style={{ flexDirection: "row", gap: space[2] }}>
      {amounts.map((a) => {
        const on = value === a;
        return (
          <PressableScale
            key={a}
            haptics="select"
            onPress={() => onPick(a)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={{ flex: 1, height: HIT, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: on ? colors.cream : colors.surface, borderWidth: 1, borderColor: on ? colors.cream : colors.line }}
          >
            <Text variant="callout" weight="700" color={on ? colors.ink : colors.text2}>
              {Number(a).toLocaleString("en-US")}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}
