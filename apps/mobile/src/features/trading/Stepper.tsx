// Number entry for the order ticket and the portfolio sheets (price, volume, stop loss, take profit): type the
// number (decimal pad, comma or point), or step it with − / + (press and hold repeats, then speeds up).
// Inside a bottom sheet the field uses the sheet's own text input, so the sheet rises above the keyboard.
// While typing, every valid number is reported as is; leaving the field (or the caller, before it submits) rounds
// and clamps it with `normalize`.
import * as React from "react";
import { TextInput, View } from "react-native";
import { Minus, Plus } from "lucide-react-native";
import { haptic } from "@/lib/haptics";
import { Mono, NO_WEB_OUTLINE, PressableScale, SheetTextInput, Text, useInSheet } from "@/ui";
import { colors, fonts, radius, space } from "@/theme/tokens";

export type StepperProps = {
  label: string;
  value: number;
  /** decimals shown (and typed) */
  digits: number;
  step: number;
  onChange: (v: number) => void;
  /** round / clamp a typed or stepped value (lot step, limits, price digits) */
  normalize?: (v: number) => number;
  /** under the number, e.g. "If hit +$12.30 · 20 pips" */
  caption?: React.ReactNode;
  /** at the end of the label row (e.g. a clear button) */
  labelEnd?: React.ReactNode;
  chips?: { label: string; value: number }[];
  testID?: string;
};

export const parseNumber = (text: string): number => {
  const t = text.replace(/\s/g, "").replace(",", ".");
  return /^-?\d*\.?\d*$/.test(t) && t !== "" && t !== "." && t !== "-" ? Number(t) : NaN;
};

export function Stepper({ label, value, digits, step, onChange, normalize = (v) => v, caption, labelEnd, chips, testID }: StepperProps) {
  const inSheet = useInSheet();
  const Input = inSheet ? SheetTextInput : TextInput;
  const [focused, setFocused] = React.useState(false);
  const [text, setText] = React.useState(() => value.toFixed(digits));
  const latest = React.useRef(value);
  latest.current = value;
  // follow the value from outside (steps, chips, a new side) unless the reader is typing
  React.useEffect(() => {
    if (!focused) setText(value.toFixed(digits));
  }, [value, digits, focused]);

  const stepBy = React.useCallback(
    (dir: 1 | -1, n: number) => {
      const next = normalize(+(latest.current + dir * step * n).toFixed(Math.max(digits, 0)));
      if (next === latest.current) return false;
      latest.current = next;
      onChange(next);
      return true;
    },
    [normalize, step, digits, onChange],
  );

  const commit = () => {
    const v = parseNumber(text);
    const next = Number.isFinite(v) && v > 0 ? normalize(v) : latest.current;
    if (next !== latest.current) onChange(next);
    setText(next.toFixed(digits));
  };

  return (
    <View style={{ gap: space[2] }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 20 }}>
        <Text variant="label" tone="tertiary">
          {label}
        </Text>
        {labelEnd}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
        <StepButton dir={-1} label={`${label} −`} onStep={stepBy} />
        <View style={{ flex: 1, height: caption ? 60 : 52, borderRadius: radius.md, backgroundColor: colors.surface2, borderWidth: 1, borderColor: focused ? colors.ember : colors.surface2, alignItems: "center", justifyContent: "center", paddingHorizontal: space[2] }}>
          <Input
            value={text}
            onChangeText={(v) => {
              setText(v);
              const n = parseNumber(v);
              if (Number.isFinite(n) && n > 0) onChange(n);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              commit();
            }}
            onSubmitEditing={commit}
            keyboardType="decimal-pad"
            returnKeyType="done"
            selectTextOnFocus
            selectionColor={colors.ember}
            accessibilityLabel={label}
            testID={testID}
            style={[{ alignSelf: "stretch", textAlign: "center", color: colors.text, fontFamily: fonts.monoBold, fontSize: 20, lineHeight: 26, height: 30, padding: 0 }, NO_WEB_OUTLINE]}
          />
          {caption ? <View style={{ marginTop: 2 }}>{caption}</View> : null}
        </View>
        <StepButton dir={1} label={`${label} +`} onStep={stepBy} />
      </View>
      {chips ? (
        <View style={{ flexDirection: "row", gap: space[2] }}>
          {chips.map((c) => (
            <PressableScale
              key={c.label}
              onPress={() => {
                const next = normalize(c.value);
                latest.current = next;
                onChange(next);
              }}
              haptics="select"
              accessibilityLabel={`${label} ${c.label}`}
              style={{ flex: 1, height: 34, borderRadius: radius.pill, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" }}
            >
              <Mono size={12.5} weight="medium" tone="secondary">
                {c.label}
              </Mono>
            </PressableScale>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** − / +: a tap steps once; press and hold repeats (every 110 ms, then 60 ms, then 5 steps at a time). */
function StepButton({ dir, label, onStep }: { dir: 1 | -1; label: string; onStep: (dir: 1 | -1, n: number) => boolean }) {
  const Icon = dir < 0 ? Minus : Plus;
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const count = React.useRef(0);
  const stop = React.useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  React.useEffect(() => stop, [stop]);
  const repeat = () => {
    count.current++;
    const moved = onStep(dir, count.current > 16 ? 5 : 1);
    if (!moved) {
      haptic.select(); // at a limit
      return stop();
    }
    timer.current = setTimeout(repeat, count.current > 5 ? 60 : 110);
  };
  return (
    <PressableScale
      onPress={() => onStep(dir, 1)}
      onLongPress={() => {
        count.current = 0;
        haptic.select();
        repeat();
      }}
      delayLongPress={320}
      onPressOut={stop}
      haptics="select"
      accessibilityLabel={label}
      style={{ width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.surface3, alignItems: "center", justifyContent: "center" }}
    >
      <Icon size={20} color={colors.text} />
    </PressableScale>
  );
}
