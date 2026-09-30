// Small building blocks shared by the More tab and the profile screens: status chips, grouped rows, key / value
// rows, switches, the avatar, notes and the screen-level empty / error / offline states. Built on @/ui and tokens.
import * as React from "react";
import { Platform, Switch, View, type StyleProp, type ViewStyle } from "react-native";
import { AlertTriangle, ArrowRight, ChevronRight, WifiOff, type LucideIcon } from "lucide-react-native";
import { useLocale, useT } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { useOnline } from "@/lib/net";
import { Banner, Display, EmptyState, PressableScale, Skeleton, Text } from "@/ui";
import { colors, fonts, GUTTER, radius, space } from "@/theme/tokens";
import type { BadgeTone } from "../me";
import { OK, tint } from "../tint";

const TONE: Record<BadgeTone, { fg: string; bg: string }> = {
  ok: { fg: OK, bg: tint.ok },
  gold: { fg: colors.gold, bg: tint.gold },
  ember: { fg: colors.ember, bg: tint.ember },
  periwinkle: { fg: colors.periwinkle, bg: tint.periwinkle },
  neutral: { fg: colors.text2, bg: colors.surface2 },
};

/** Status pill: tinted fill, coloured label, optional dot. */
export function StatusChip({ label, tone = "neutral", dot = true, style, onInk }: { label: string; tone?: BadgeTone; dot?: boolean; style?: StyleProp<ViewStyle>; onInk?: boolean }) {
  const c = TONE[tone];
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", gap: 6, height: 26, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: onInk ? tint.inkChip : c.bg }, style]}>
      {dot ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: onInk ? colors.ink : c.fg }} /> : null}
      <Text variant="caption" weight="700" color={onInk ? colors.ink : c.fg} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Small uppercase label above a group, with an optional action on the end side. */
export function SectionHeader({ title, action, onAction, style }: { title: string; action?: string; onAction?: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: GUTTER, marginTop: space[6], marginBottom: space[2], minHeight: 24 }, style]}>
      <Text variant="label" tone="tertiary">
        {title}
      </Text>
      {action && onAction ? (
        <PressableScale onPress={onAction} scaleTo={1} hitSlop={12} style={{ minHeight: 32, justifyContent: "center" }}>
          <Text variant="caption" tone="ember" weight="700">
            {action}
          </Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

/** A rounded group of rows on the dark surface. */
export function Group({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={[{ marginHorizontal: GUTTER, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, overflow: "hidden" }, style]}>
      {items.map((c, i) => (
        <React.Fragment key={i}>
          {i > 0 ? <View style={{ height: 1, backgroundColor: colors.line, marginStart: space[4] }} /> : null}
          {c}
        </React.Fragment>
      ))}
    </View>
  );
}

/** Forward chevron, mirrored for right-to-left (the view is flipped, which works for SVG on every platform). */
export function Chevron({ color = colors.text3, size = 18 }: { color?: string; size?: number }) {
  const { rtl } = useLocale();
  return (
    <View style={rtl ? { transform: [{ scaleX: -1 }] } : undefined}>
      <ChevronRight size={size} color={color} />
    </View>
  );
}

/** "Next" arrow for buttons, pointing the reading direction. */
export function NextArrow({ color = colors.ink, size = 18 }: { color?: string; size?: number }) {
  const { rtl } = useLocale();
  return (
    <View style={rtl ? { transform: [{ scaleX: -1 }] } : undefined}>
      <ArrowRight size={size} color={color} />
    </View>
  );
}

/** Tappable row: tinted icon, title (+ hint), value, chevron. 56 pt tall; prefetch on press-in. */
export const MenuRow = React.memo(function MenuRow({
  icon: Icon,
  iconColor = colors.text2,
  title,
  hint,
  value,
  onPress,
  onPressIn,
  destructive,
  chevron = true,
  testID,
}: {
  icon?: LucideIcon;
  iconColor?: string;
  title: string;
  hint?: string;
  value?: React.ReactNode;
  onPress?: () => void;
  onPressIn?: () => void;
  destructive?: boolean;
  chevron?: boolean;
  testID?: string;
}) {
  return (
    <PressableScale onPress={onPress} onPressIn={onPressIn} scaleTo={0.985} accessibilityLabel={hint ? `${title}. ${hint}` : title} testID={testID} style={{ minHeight: 56, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[4], paddingVertical: space[2] }}>
      {Icon ? (
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" }}>
          <Icon size={18} color={destructive ? colors.ember : iconColor} strokeWidth={1.9} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 1 }}>
        <Text variant="headline" weight="600" color={destructive ? colors.ember : colors.text} numberOfLines={1}>
          {title}
        </Text>
        {hint ? (
          <Text variant="caption" tone="tertiary" numberOfLines={2}>
            {hint}
          </Text>
        ) : null}
      </View>
      {typeof value === "string" ? (
        <Text variant="callout" tone="secondary" numberOfLines={1} style={{ maxWidth: 150 }}>
          {value}
        </Text>
      ) : (
        value
      )}
      {chevron && onPress ? <Chevron /> : null}
    </PressableScale>
  );
});

/** Label on the start side, value on the end side (read-only details). */
export function KeyValue({ label, value, mono, trailing }: { label: string; value: React.ReactNode; mono?: boolean; trailing?: React.ReactNode }) {
  return (
    <View style={{ minHeight: 52, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[4], paddingVertical: space[3] }}>
      <Text variant="callout" tone="tertiary" style={{ flexShrink: 0, maxWidth: "45%" }}>
        {label}
      </Text>
      <View style={{ flex: 1, flexDirection: "row", justifyContent: "flex-end" }}>
        {typeof value === "string" ? (
          <Text variant="callout" weight="600" style={[{ flexShrink: 1 }, mono ? { fontFamily: fonts.monoMedium, fontWeight: "400" } : null]}>
            {value}
          </Text>
        ) : (
          value
        )}
      </View>
      {trailing}
    </View>
  );
}

/** The app's switch: ember track when on, cream thumb (also on the web preview). */
export function KSwitch({ value, onValueChange, disabled, accessibilityLabel }: { value: boolean; onValueChange: (v: boolean) => void; disabled?: boolean; accessibilityLabel?: string }) {
  const { rtl } = useLocale();
  const web = { activeThumbColor: colors.cream, activeTrackColor: colors.ember } as object;
  const sw = <Switch value={value} onValueChange={onValueChange} disabled={disabled} trackColor={{ false: colors.surface3, true: colors.ember }} thumbColor={colors.cream} ios_backgroundColor={colors.surface3} accessibilityLabel={accessibilityLabel} {...web} />;
  if (Platform.OS !== "web") return sw;
  // web preview: react-native-web's switch places its thumb with both physical and logical offsets, which come apart
  // under the app's right-to-left root; lay it out left-to-right and mirror it, like the native switch in RTL
  return <View style={{ direction: "ltr", transform: rtl ? [{ scaleX: -1 }] : undefined }}>{sw}</View>;
}

/** A switch with its label (the whole row toggles; 44 pt+). */
export function ToggleRow({ title, hint, value, onChange, disabled, locked, lockedLabel }: { title: string; hint?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean; locked?: boolean; lockedLabel?: string }) {
  const change = (v: boolean) => {
    haptic.select();
    onChange(v);
  };
  return (
    <PressableScale
      onPress={locked || disabled ? undefined : () => change(!value)}
      scaleTo={1}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: !!(locked || disabled) }}
      accessibilityLabel={title}
      style={{ minHeight: 52, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[4], paddingVertical: space[2] }}
    >
      <View style={{ flex: 1, gap: 1 }}>
        <Text variant="callout" weight="600">
          {title}
        </Text>
        {hint ? (
          <Text variant="caption" tone="tertiary">
            {hint}
          </Text>
        ) : null}
      </View>
      {locked ? (
        <Text variant="caption" tone="tertiary" weight="600">
          {lockedLabel}
        </Text>
      ) : (
        <KSwitch value={value} onValueChange={change} disabled={disabled} accessibilityLabel={title} />
      )}
    </PressableScale>
  );
}

/** Round initials avatar on a colour block. */
export function Avatar({ text, size = 64, color = colors.periwinkle }: { text: string; size?: number; color?: string }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: "center", justifyContent: "center" }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Display color={colors.ink} style={{ fontSize: size * 0.42, lineHeight: size * 0.5 }}>
        {text}
      </Display>
    </View>
  );
}

/** Quiet note with an icon (rules, privacy). */
export function Note({ icon: Icon, children, style }: { icon?: LucideIcon; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: "row", gap: space[3], alignItems: "flex-start", paddingHorizontal: space[4], paddingVertical: space[3], borderRadius: radius.md, backgroundColor: colors.bgRaised, borderWidth: 1, borderColor: colors.line }, style]}>
      {Icon ? <Icon size={16} color={colors.text3} style={{ marginTop: 2 }} /> : null}
      <View style={{ flex: 1 }}>{typeof children === "string" ? <Text variant="caption" tone="secondary" style={{ lineHeight: 18 }}>{children}</Text> : children}</View>
    </View>
  );
}

/** Screen-level state when there is nothing cached to show: offline or error. `compact`: one section of a screen
 *  failed (a notice with Retry instead of the full-screen illustration). */
export function LoadState({ error, onRetry, style, compact }: { error?: { message: string; code?: string } | null; onRetry: () => void; style?: StyleProp<ViewStyle>; compact?: boolean }) {
  const t = useT();
  const online = useOnline();
  const offline = !online || error?.code === "network";
  const title = offline ? t("mobile.state.offline.title") : t("mobile.state.error.title");
  const body = offline ? t("mobile.state.offline.body") : (error?.message ?? t("mobile.state.error.body"));
  if (compact)
    return (
      <View style={[{ marginHorizontal: GUTTER }, style]}>
        <Banner tone="info" icon={offline ? <WifiOff size={18} color={colors.text3} /> : <AlertTriangle size={18} color={colors.gold} />} title={title} body={body} action={t("mobile.action.retry")} onAction={onRetry} />
      </View>
    );
  return <EmptyState illustration="connectionLost" title={title} body={body} action={t("mobile.action.retry")} onAction={onRetry} style={style} />;
}

/** Placeholder shaped like a group of rows. */
export function SkeletonGroup({ rows = 4, style }: { rows?: number; style?: StyleProp<ViewStyle> }) {
  const t = useT();
  return (
    <View style={[{ marginHorizontal: GUTTER, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, overflow: "hidden" }, style]} accessibilityLabel={t("common.loading")} accessible>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={{ height: 56, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[4], borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
          <Skeleton w={34} h={34} r={17} />
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton w={`${55 - (i % 3) * 10}%`} h={13} />
            <Skeleton w={`${35 + (i % 2) * 15}%`} h={10} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** "Offline, showing saved data" line under a title when the cache is all we have. */
export function OfflineHint() {
  const t = useT();
  const online = useOnline();
  if (online) return null;
  return (
    <View style={{ marginHorizontal: GUTTER, marginBottom: space[3] }}>
      <Text variant="caption" tone="tertiary">
        {t("mobileProfile.offline.cached")}
      </Text>
    </View>
  );
}
