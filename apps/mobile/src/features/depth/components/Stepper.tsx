// − value + stepper with optional quick chips (order price, lots, alert level). 52 pt targets.
import * as React from "react";
import { View } from "react-native";
import { Minus, Plus } from "lucide-react-native";
import { Mono, PressableScale, Text } from "@/ui";
import { colors, radius, space } from "@/theme/tokens";

export function StepButton({ icon, onPress, label, size = 52 }: { icon: "minus" | "plus"; onPress: () => void; label: string; size?: number }) {
  const Icon = icon === "minus" ? Minus : Plus;
  return (
    <PressableScale onPress={onPress} haptics="select" accessibilityLabel={label} style={{ width: size, height: size, borderRadius: radius.md, backgroundColor: colors.surface3, alignItems: "center", justifyContent: "center" }}>
      <Icon size={20} color={colors.text} />
    </PressableScale>
  );
}

export function Stepper({ label, value, onMinus, onPlus, chips, sub }: { label: string; value: string; onMinus: () => void; onPlus: () => void; chips?: { label: string; onPress: () => void; selected?: boolean }[]; sub?: React.ReactNode }) {
  return (
    <View style={{ gap: space[2] }}>
      <Text variant="label" tone="tertiary">
        {label}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
        <StepButton icon="minus" onPress={onMinus} label={`${label} −`} />
        <View style={{ flex: 1, height: 52, borderRadius: radius.md, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" }}>
          <Mono size={20} weight="bold" accessibilityLabel={`${label} ${value}`}>
            {value}
          </Mono>
          {sub}
        </View>
        <StepButton icon="plus" onPress={onPlus} label={`${label} +`} />
      </View>
      {chips ? (
        <View style={{ flexDirection: "row", gap: space[2] }}>
          {chips.map((c) => (
            <PressableScale
              key={c.label}
              onPress={c.onPress}
              haptics="select"
              accessibilityRole="button"
              accessibilityState={{ selected: !!c.selected }}
              style={{ flex: 1, height: 36, borderRadius: radius.pill, backgroundColor: c.selected ? colors.cream : colors.surface2, alignItems: "center", justifyContent: "center" }}
            >
              <Mono size={12.5} weight="medium" color={c.selected ? colors.ink : colors.text2}>
                {c.label}
              </Mono>
            </PressableScale>
          ))}
        </View>
      ) : null}
    </View>
  );
}
