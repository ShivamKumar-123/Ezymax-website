// Who a master is: an initials block (masters are shown by nickname only, never a photo or a personal name),
// the house-account disclosure, programme tags and the system risk score (1–10).
import * as React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { Building2 } from "lucide-react-native";
import { useT } from "@/i18n";
import { Text } from "@/ui";
import { blockColors, colors, fonts, radius, space, type BlockColor } from "@/theme/tokens";
import { clampRisk, riskLevel } from "../format";
import type { Program } from "../api";
import { Tag, tagColor, type TagTone } from "./primitives";

const BLOCKS: BlockColor[] = ["ember", "gold", "mint", "periwinkle", "cream"];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "?";
  const b = parts.length > 1 ? parts[1]![0]! : (parts[0]?.[1] ?? "");
  return (a + b).toUpperCase();
}

/** Initials on a colour block picked from the nickname (stable per master). */
export const Avatar = React.memo(function Avatar({ name, size = 44, house }: { name: string; size?: number; house?: boolean }) {
  const bg = house ? colors.periwinkle : blockColors[BLOCKS[hash(name) % BLOCKS.length]!];
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, borderRadius: size * 0.34, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}
    >
      {house ? (
        <Building2 size={size * 0.46} color={colors.ink} strokeWidth={2} />
      ) : (
        <Text style={{ fontFamily: fonts.display, fontSize: size * 0.42, lineHeight: size * 0.5, color: colors.ink, letterSpacing: 0.5 }}>{initials(name)}</Text>
      )}
    </View>
  );
});

/** "House strategy · Operated by Kalks": exactly the web label, on every house master. */
export const HouseBadge = React.memo(function HouseBadge({ style, compact }: { style?: StyleProp<ViewStyle>; compact?: boolean }) {
  const t = useT();
  return (
    <Tag
      tone="periwinkle"
      compact={compact}
      label={t("mobileSocial.house.badge")}
      icon={<Building2 size={compact ? 11 : 12} color={colors.periwinkle} strokeWidth={2.2} />}
      style={[{ alignSelf: "flex-start" }, style]}
    />
  );
});

/** The full house disclosure (master profile, follow wizard). */
export function HouseDisclosure({ style }: { style?: StyleProp<ViewStyle> }) {
  const t = useT();
  return (
    <View
      accessibilityRole="text"
      style={[
        { flexDirection: "row", gap: space[3], padding: space[4], borderRadius: radius.lg, backgroundColor: "rgba(140,140,240,0.10)", borderWidth: 1, borderColor: "rgba(140,140,240,0.3)" },
        style,
      ]}
    >
      <Building2 size={18} color={colors.periwinkle} strokeWidth={2} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="callout" weight="700">
          {t("mobileSocial.house.badge")}
        </Text>
        <Text variant="caption" tone="secondary" style={{ lineHeight: 18 }}>
          {t("mobileSocial.house.disclosure")}
        </Text>
      </View>
    </View>
  );
}

export function ProgramTags({ program, hasFund = true }: { program: Program; hasFund?: boolean }) {
  const t = useT();
  return (
    <View style={{ flexDirection: "row", gap: space[1] }}>
      {program === "copy" || program === "both" ? <Tag tone="ember" label={t("mobileSocial.program.copy")} /> : null}
      {(program === "pamm" || program === "both") && hasFund ? <Tag tone="gold" label={t("mobileSocial.program.pamm")} /> : null}
    </View>
  );
}

const riskTone = (r: number): TagTone => (r <= 3 ? "mint" : r <= 6 ? "gold" : "ember");

/** Risk score 1–10 as a 10-bar meter plus the number (palette colours: risk isn't money). */
export const RiskMeter = React.memo(function RiskMeter({ risk, showLabel, size = "sm" }: { risk: number; showLabel?: boolean; size?: "sm" | "lg" }) {
  const t = useT();
  const r = clampRisk(risk);
  const tone = riskTone(r);
  const c = tagColor(tone);
  const level = t(`mobileSocial.risk.${riskLevel(r)}`);
  const lg = size === "lg";
  return (
    <View accessible accessibilityLabel={t("mobileSocial.risk.a11y", { r, level })} style={{ flexDirection: "row", alignItems: "center", gap: lg ? space[2] : 6 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: lg ? 3 : 1.5, height: lg ? 22 : 12 }}>
        {Array.from({ length: 10 }, (_, i) => (
          <View key={i} style={{ width: lg ? 5 : 2.5, height: (lg ? 8 : 4) + i * (lg ? 1.4 : 0.8), borderRadius: 2, backgroundColor: i < r ? c : colors.surface3 }} />
        ))}
      </View>
      <Text variant={lg ? "headline" : "caption"} weight="700" color={c}>
        {showLabel ? `${r} · ${level}` : String(r)}
      </Text>
    </View>
  );
});
