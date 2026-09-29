// Form controls of the social flows: a slider that follows the finger on the UI thread, a numeric field with
// a unit, radio cards, a consent checkbox and a switch row. 44 pt targets throughout.
import * as React from "react";
import { Platform, Switch, View, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { Check } from "lucide-react-native";
import { haptic } from "@/lib/haptics";
import { PressableScale, Text, TextField } from "@/ui";
import { colors, motion, radius, space } from "@/theme/tokens";
import { cleanAmount } from "../format";

/* ------------------------------------------------------------------ */
/* Slider                                                              */
/* ------------------------------------------------------------------ */

const THUMB = 28;

/**
 * Integer slider (min..max, `step`). The thumb follows the finger 1:1 on the UI thread; React only hears about a
 * change when the stepped value changes. A light selection haptic marks the `ticks`. Always left-to-right.
 */
export function Slider({
  value,
  onChange,
  min,
  max,
  step = 1,
  ticks = [],
  color = colors.ember,
  disabled,
  accessibilityLabel,
  format = (v: number) => String(v),
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  ticks?: number[];
  color?: string;
  disabled?: boolean;
  accessibilityLabel: string;
  format?: (v: number) => string;
}) {
  const [width, setWidth] = React.useState(0);
  const w = useSharedValue(0);
  const x = useSharedValue(0);
  const last = useSharedValue(value);
  const dragging = useSharedValue(0);
  const range = Math.max(1, max - min);

  React.useEffect(() => {
    w.value = width;
    if (!dragging.value) x.value = width ? ((value - min) / range) * width : 0;
    last.value = value;
  }, [value, width, min, range, w, x, last, dragging]);

  const emit = React.useCallback(
    (v: number, tick: boolean) => {
      if (tick) haptic.select();
      onChange(v);
    },
    [onChange],
  );

  const gesture = React.useMemo(() => {
    const tickSet = ticks;
    // finger x (in the 44 pt row) -> track position -> stepped value; the thumb follows the finger 1:1
    const follow = (fx: number, fromTap: boolean) => {
      "worklet";
      const nx = Math.max(0, Math.min(w.value, fx - THUMB / 2));
      x.value = fromTap ? withSpring(nx, motion.spring) : nx;
      const v = Math.min(max, Math.max(min, Math.round((min + (nx / Math.max(1, w.value)) * range) / step) * step));
      if (v !== last.value) {
        last.value = v;
        runOnJS(emit)(v, !fromTap && tickSet.includes(v));
      }
    };
    const settle = () => {
      "worklet";
      dragging.value = 0;
      x.value = withSpring(((last.value - min) / range) * w.value, motion.spring);
    };
    // horizontal drags move the thumb; vertical drags stay with the page scroll
    const pan = Gesture.Pan()
      .enabled(!disabled)
      .activeOffsetX([-3, 3])
      .failOffsetY([-12, 12])
      .onStart((e) => {
        dragging.value = 1;
        follow(e.x, false);
      })
      .onUpdate((e) => follow(e.x, false))
      .onFinalize(settle);
    const tap = Gesture.Tap()
      .enabled(!disabled)
      .onEnd((e) => {
        follow(e.x, true);
        settle();
      });
    return Gesture.Race(pan, tap);
  }, [disabled, emit, min, max, range, step, ticks, w, x, last, dragging]);

  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const fill = useAnimatedStyle(() => ({ width: x.value }));

  return (
    <View
      style={{ direction: "ltr", opacity: disabled ? 0.4 : 1 }}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min, max, now: value, text: format(value) }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => {
        if (disabled) return;
        const next = e.nativeEvent.actionName === "increment" ? Math.min(max, value + step) : Math.max(min, value - step);
        if (next !== value) emit(next, false);
      }}
    >
      <GestureDetector gesture={gesture}>
        <View style={{ height: 44, justifyContent: "center", paddingHorizontal: THUMB / 2 }} collapsable={false}>
          <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height: 6, borderRadius: 3, backgroundColor: colors.surface3 }}>
            <Animated.View style={[{ position: "absolute", start: 0, top: 0, bottom: 0, borderRadius: 3, backgroundColor: color }, fill]} />
          </View>
          <Animated.View
            pointerEvents="none"
            style={[
              { position: "absolute", start: 0, top: (44 - THUMB) / 2, width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: colors.cream, borderWidth: 3, borderColor: color },
              thumb,
            ]}
          />
        </View>
      </GestureDetector>
      {ticks.length ? (
        <View style={{ height: 16, marginHorizontal: THUMB / 2 }}>
          {visibleTicks(ticks, min, range, width).map((tk) => (
            <Text key={tk} variant="caption" tone="tertiary" style={{ position: "absolute", start: `${((tk - min) / range) * 100}%`, width: 40, marginStart: -20, textAlign: "center", fontSize: 11 }}>
              {format(tk)}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Tick labels that don't collide (at least 36 pt apart on the track). */
function visibleTicks(ticks: number[], min: number, range: number, width: number) {
  const out: number[] = [];
  let last = -Infinity;
  for (const tk of ticks) {
    const x = ((tk - min) / range) * width;
    if (!width || x - last >= 36) {
      out.push(tk);
      last = x;
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Numeric field                                                       */
/* ------------------------------------------------------------------ */

/** Decimal input with a leading symbol / trailing unit; keeps the raw text so the user can clear and retype. */
export const AmountField = React.forwardRef(function AmountField(
  {
    label,
    value,
    onChange,
    prefix,
    unit,
    decimals = 2,
    error,
    hint,
    placeholder,
    testID,
    ...rest
  }: {
    label: string;
    value: string;
    onChange: (raw: string) => void;
    prefix?: string;
    unit?: string;
    decimals?: number;
    error?: string | null;
    hint?: string;
    placeholder?: string;
    testID?: string;
  } & Pick<TextInputProps, "autoFocus" | "returnKeyType" | "onSubmitEditing">,
  ref: React.Ref<import("react-native").TextInput>,
) {
  return (
    <TextField
      ref={ref}
      testID={testID}
      label={label}
      value={value}
      onChangeText={(v) => onChange(cleanAmount(v, decimals))}
      keyboardType={decimals ? "decimal-pad" : "number-pad"}
      inputMode="decimal"
      mono
      placeholder={placeholder}
      error={error}
      hint={hint}
      leading={
        prefix ? (
          <Text variant="headline" tone="tertiary" style={{ fontFamily: "JetBrainsMono_500Medium" }}>
            {prefix}
          </Text>
        ) : undefined
      }
      trailing={
        unit ? (
          <Text variant="callout" tone="tertiary">
            {unit}
          </Text>
        ) : undefined
      }
      {...rest}
    />
  );
});

/* ------------------------------------------------------------------ */
/* Choices                                                             */
/* ------------------------------------------------------------------ */

/** A selectable card with a radio dot, a title and a line of explanation. */
export const RadioCard = React.memo(function RadioCard({
  selected,
  onPress,
  title,
  text,
  icon,
  disabled,
  right,
  style,
  testID,
}: {
  selected: boolean;
  onPress: () => void;
  title: string;
  text?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  right?: React.ReactNode;
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
          minHeight: 56,
          flexDirection: "row",
          alignItems: "center",
          gap: space[3],
          padding: space[4],
          borderRadius: radius.lg,
          borderWidth: 1.5,
          borderColor: selected ? colors.ember : colors.line,
          backgroundColor: selected ? "rgba(242,106,61,0.08)" : colors.surface,
        },
        style,
      ]}
    >
      <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: selected ? colors.ember : colors.lineStrong, alignItems: "center", justifyContent: "center" }}>
        {selected ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.ember }} /> : null}
      </View>
      {icon}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="headline" weight="700">
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

/** Consent checkbox: the whole row is the target. */
export function Consent({ checked, onChange, children, testID }: { checked: boolean; onChange: (v: boolean) => void; children: string; testID?: string }) {
  return (
    <PressableScale
      testID={testID}
      onPress={() => onChange(!checked)}
      haptics="select"
      scaleTo={1}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={children}
      style={{ flexDirection: "row", gap: space[3], alignItems: "flex-start", minHeight: 44, paddingVertical: space[1] }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          marginTop: 1,
          borderRadius: radius.xs,
          borderWidth: 1.5,
          borderColor: checked ? colors.ember : colors.lineStrong,
          backgroundColor: checked ? colors.ember : "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {checked ? <Check size={16} color={colors.ink} strokeWidth={3} /> : null}
      </View>
      <Text variant="callout" tone="secondary" style={{ flex: 1, lineHeight: 20 }}>
        {children}
      </Text>
    </PressableScale>
  );
}

/** Title + hint with a switch on the end side. */
export function SwitchRow({ title, hint, value, onChange, testID }: { title: string; hint?: string; value: boolean; onChange: (v: boolean) => void; testID?: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[3], minHeight: 48 }}>
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

/** Wrapping row of small selectable chips (amount presets, symbols). */
export function ChipChoice({ label, selected, onPress, tone = "neutral", testID }: { label: string; selected?: boolean; onPress: () => void; tone?: "neutral" | "down"; testID?: string }) {
  const on = selected ? (tone === "down" ? colors.down : colors.cream) : undefined;
  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      haptics="select"
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={{
        height: 36,
        paddingHorizontal: space[3],
        borderRadius: radius.pill,
        justifyContent: "center",
        borderWidth: 1,
        borderColor: on ?? colors.line,
        backgroundColor: selected ? (tone === "down" ? colors.downSoft : colors.cream) : colors.surface,
      }}
    >
      <Text variant="callout" weight="600" color={selected ? (tone === "down" ? colors.down : colors.ink) : colors.text2} style={{ fontFamily: "JetBrainsMono_500Medium", fontSize: 13 }}>
        {label}
      </Text>
    </PressableScale>
  );
}
