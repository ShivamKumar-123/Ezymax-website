// Page chrome for the accounts screens: the stack bar (back, a small title that fades in once the big one has
// scrolled away, actions), section headings, chips and label/value metrics. Built only on @/ui and tokens.
import * as React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useLocale, useT } from "@/i18n";
import { Display, IconButton, Mono, Text } from "@/ui";
import { alpha } from "@/theme/alpha";
import { blockColors, colors, GUTTER, radius, space, type BlockColor } from "@/theme/tokens";
import type { Account } from "../types";

/** Mirrors a direction icon (chevrons, arrows) in right-to-left languages. The flip sits on a wrapping view: an
 *  SVG's own transform turns around its corner, not its centre. */
export function Flip({ rtl, children }: { rtl: boolean; children: React.ReactNode }) {
  return <View style={rtl ? { transform: [{ scaleX: -1 }] } : undefined}>{children}</View>;
}

/** A footer's Back next to its main action: as wide as its label while the main action takes the rest (like the
 *  other modules' flows), so the main label isn't cut off on a narrow phone. */
export const BACK = { paddingHorizontal: space[5] } as const;

/** Safe-area page with a fixed bar on top; the body scrolls under it. */
export function Page({ bar, children }: { bar: React.ReactNode; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      {bar}
      {children}
    </View>
  );
}

/** 56 pt bar: back (flips in RTL), a small centred title shown once `scrollY` passes the big title, actions. */
export const StackBar = React.memo(function StackBar({ title, scrollY, right, onBack, backIcon }: { title?: string; scrollY?: SharedValue<number>; right?: React.ReactNode; onBack?: () => void; backIcon?: React.ReactNode }) {
  const router = useRouter();
  const t = useT();
  const { rtl } = useLocale();
  const titleStyle = useAnimatedStyle(() => {
    const y = scrollY ? scrollY.value : 100;
    return { opacity: interpolate(y, [40, 72], [0, 1], "clamp"), transform: [{ translateY: interpolate(y, [40, 72], [6, 0], "clamp") }] };
  });
  const lineStyle = useAnimatedStyle(() => ({ opacity: scrollY ? interpolate(scrollY.value, [0, 24], [0, 1], "clamp") : 0 }));
  return (
    <View style={{ height: 56, paddingHorizontal: GUTTER - 6, flexDirection: "row", alignItems: "center", gap: space[2] }}>
      <IconButton
        accessibilityLabel={t("mobile.a11y.back")}
        tone="ghost"
        icon={backIcon ?? <Flip rtl={rtl}><ChevronLeft size={26} color={colors.text} strokeWidth={2} /></Flip>}
        onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace("/")))}
      />
      <Animated.View style={[{ flex: 1, alignItems: "center" }, titleStyle]} pointerEvents="none">
        {title ? (
          <Text variant="headline" numberOfLines={1}>
            {title}
          </Text>
        ) : null}
      </Animated.View>
      <View style={{ minWidth: 44, flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: space[2] }}>{right}</View>
      <Animated.View pointerEvents="none" style={[{ position: "absolute", start: 0, end: 0, bottom: 0, height: 1, backgroundColor: colors.line }, lineStyle]} />
    </View>
  );
});

/** Eyebrow + tall display title at the top of a page body. */
export function PageTitle({ eyebrow, title, children, style }: { eyebrow?: string; title: string; children?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ paddingHorizontal: GUTTER, paddingTop: space[1], paddingBottom: space[5], gap: space[1], alignItems: "flex-start" }, style]}>
      {eyebrow ? (
        <Text variant="label" tone="tertiary">
          {eyebrow}
        </Text>
      ) : null}
      <Display size="xl" accessibilityRole="header" numberOfLines={2} adjustsFontSizeToFit>
        {title}
      </Display>
      {children}
    </View>
  );
}

/** Section heading inside a page (Anton, uppercase) with an optional trailing element. */
export function SectionTitle({ title, right, style }: { title: string; right?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: space[3], marginBottom: space[3] }, style]}>
      <Display size="sm" accessibilityRole="header" style={{ flexShrink: 1 }}>
        {title}
      </Display>
      {right}
    </View>
  );
}

export type TagTone = BlockColor | "outline" | "warn" | "risk" | "muted";

/** Small pill: a colour fill (ink text), an outline, a gold warning or a red risk (money at risk only). */
export function Tag({ label, tone = "outline", mono, style }: { label: string; tone?: TagTone; mono?: boolean; style?: StyleProp<ViewStyle> }) {
  const filled = tone in blockColors;
  const bg = filled ? blockColors[tone as BlockColor] : tone === "warn" ? colors.warnSoft : tone === "risk" ? colors.downSoft : "transparent";
  const border = filled ? "transparent" : tone === "warn" ? alpha(colors.gold, 0.35) : tone === "risk" ? alpha(colors.down, 0.4) : colors.lineStrong;
  const fg = filled ? colors.ink : tone === "warn" ? colors.gold : tone === "risk" ? colors.down : tone === "muted" ? colors.text3 : colors.text2;
  return (
    <View style={[{ height: 24, paddingHorizontal: 9, borderRadius: radius.pill, backgroundColor: bg, borderWidth: 1, borderColor: border, justifyContent: "center", alignSelf: "flex-start" }, style]}>
      {mono ? (
        <Mono size={12} weight="bold" color={fg} numberOfLines={1}>
          {label}
        </Mono>
      ) : (
        <Text variant="label" color={fg} numberOfLines={1} style={{ fontSize: 10.5, letterSpacing: 0.8 }}>
          {label}
        </Text>
      )}
    </View>
  );
}

export function KindTag({ type }: { type: Account["type"] }) {
  const t = useT();
  return <Tag label={type === "live" ? t("mobileAccounts.kind.live") : t("mobileAccounts.kind.demo")} tone={type === "live" ? "ember" : "periwinkle"} />;
}

/** Only shown when the account isn't simply active. */
export function StatusTag({ status }: { status: Account["status"] }) {
  const t = useT();
  if (status === "active") return null;
  const tone: TagTone = status === "close_only" || status === "read_only" ? "warn" : "muted";
  return <Tag label={t.dyn(`mobileAccounts.status.${status}`, status)} tone={tone} />;
}

/** Small uppercase label over a tabular value. */
export function Metric({ label, value, tone, size = 17, align = "left", style }: { label: string; value: string; tone?: "up" | "down" | "warn" | "risk" | "ok" | null; size?: number; align?: "left" | "right"; style?: StyleProp<ViewStyle> }) {
  // money colours only for P&L (up / down) and a margin level at risk; a healthy level stays neutral
  const color = tone === "up" ? colors.up : tone === "down" || tone === "risk" ? colors.down : tone === "warn" ? colors.gold : colors.text;
  return (
    <View style={[{ gap: 3, minWidth: 0, alignItems: align === "right" ? "flex-end" : "flex-start" }, style]}>
      <Text variant="label" tone="tertiary" numberOfLines={1} style={{ fontSize: 10.5 }}>
        {label}
      </Text>
      <Mono size={size} weight="medium" color={color} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Mono>
    </View>
  );
}
