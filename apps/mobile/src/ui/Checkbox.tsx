// Checkbox row (terms, consents): the whole row is the 44 pt target.
import * as React from "react";
import { View } from "react-native";
import { Check } from "lucide-react-native";
import { colors, radius, space } from "@/theme/tokens";
import { PressableScale } from "./PressableScale";

export function Checkbox({ checked, onChange, children, accessibilityLabel }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode; accessibilityLabel?: string }) {
  return (
    <PressableScale
      onPress={() => onChange(!checked)}
      haptics="select"
      scaleTo={1}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={accessibilityLabel}
      style={{ flexDirection: "row", gap: space[3], alignItems: "flex-start", minHeight: 44, paddingVertical: space[1] }}
    >
      <View style={{ width: 24, height: 24, borderRadius: radius.xs, borderWidth: 1.5, borderColor: checked ? colors.ember : colors.lineStrong, backgroundColor: checked ? colors.ember : "transparent", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
        {checked ? <Check size={16} color={colors.ink} strokeWidth={3} /> : null}
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </PressableScale>
  );
}
