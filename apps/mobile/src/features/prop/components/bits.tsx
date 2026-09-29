// Small building blocks of the prop screens (feature-local on purpose: they follow the @/ui look but are specific
// to how prop pages read: status tags, label / value rows, section heads, the stack header).
import * as React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { ChevronLeft, ChevronRight, Copy } from "lucide-react-native";
import { useLocale, useT } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { useOnline } from "@/lib/net";
import { Display, EmptyState, IconButton, Mono, PressableScale, Text, toast } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";

/** `#RRGGBB` at `a` opacity. */
export function alpha(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export type TagTone = "ember" | "gold" | "mint" | "periwinkle" | "cream" | "neutral" | "up" | "down" | "ink";

const TAG: Record<TagTone, { bg: string; fg: string }> = {
  ember: { bg: alpha(colors.ember, 0.16), fg: colors.ember },
  gold: { bg: alpha(colors.gold, 0.16), fg: colors.gold },
  mint: { bg: alpha(colors.mint, 0.16), fg: colors.mint },
  periwinkle: { bg: alpha(colors.periwinkle, 0.18), fg: colors.periwinkle },
  cream: { bg: alpha(colors.cream, 0.12), fg: colors.cream },
  neutral: { bg: colors.surface2, fg: colors.text2 },
  up: { bg: colors.upSoft, fg: colors.up },
  down: { bg: colors.downSoft, fg: colors.down },
  /** on a colour block */
  ink: { bg: "rgba(14,14,16,0.12)", fg: colors.ink },
};

/** A static status tag ("Live", "Funded", "Breached"). */
export function Tag({ label, tone = "neutral", style }: { label: string; tone?: TagTone; style?: StyleProp<ViewStyle> }) {
  const c = TAG[tone];
  return (
    <View style={[{ height: 24, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: c.bg, alignItems: "center", justifyContent: "center", alignSelf: "flex-start" }, style]}>
      <Text variant="label" color={c.fg} style={{ fontSize: 10.5, letterSpacing: 0.7 }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Label on the start side, value on the end side. Wrapped values align to the end: "right" is the end in both
 * directions, since React Native swaps left / right under a right-to-left layout (I18nManager).
 */
export function KV({ label, value, tone, ink, last, mono = true }: { label: string; value: React.ReactNode; tone?: "up" | "down" | "ember" | "gold" | "mint"; ink?: boolean; last?: boolean; mono?: boolean }) {
  return (
    <View style={{ minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[4], paddingVertical: space[2], borderBottomWidth: last ? 0 : 1, borderBottomColor: ink ? "rgba(14,14,16,0.12)" : colors.line }}>
      <Text variant="callout" color={ink ? colors.ink2 : colors.text3} style={{ flexShrink: 1, maxWidth: "48%" }}>
        {label}
      </Text>
      {typeof value === "string" && mono ? (
        <Mono size={14} weight="medium" tone={ink ? "ink" : tone ?? "primary"} align="right" style={{ flexShrink: 1 }}>
          {value}
        </Mono>
      ) : typeof value === "string" ? (
        <Text variant="callout" weight="600" tone={ink ? "ink" : tone ?? "primary"} align="right" style={{ flexShrink: 1 }}>
          {value}
        </Text>
      ) : (
        value
      )}
    </View>
  );
}

/** Section head: small uppercase label, optional action on the end side. */
export function SectionHead({ label, action, onAction, style }: { label: string; action?: string; onAction?: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: GUTTER, marginTop: space[8], marginBottom: space[3], minHeight: 28 }, style]}>
      <Text variant="label" tone="tertiary" accessibilityRole="header">
        {label}
      </Text>
      {action && onAction ? (
        <PressableScale onPress={onAction} scaleTo={1} hitSlop={10} style={{ minHeight: 32, justifyContent: "center" }}>
          <Text variant="caption" tone="ember" weight="700">
            {action}
          </Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

/** Stack screen header: back button, then an editorial eyebrow + tall title. */
export function StackHeader({ eyebrow, title, right, sub }: { eyebrow?: string; title?: string; right?: React.ReactNode; sub?: React.ReactNode }) {
  const t = useT();
  const router = useRouter();
  const { rtl } = useLocale();
  return (
    <View style={{ paddingHorizontal: GUTTER, paddingBottom: space[4] }}>
      <View style={{ height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <IconButton
          accessibilityLabel={t("mobile.a11y.back")}
          icon={rtl ? <ChevronRight size={22} color={colors.text} /> : <ChevronLeft size={22} color={colors.text} />}
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/more"))}
        />
        {right ? <View style={{ flexDirection: "row", gap: space[2] }}>{right}</View> : null}
      </View>
      {eyebrow || title ? (
        <View style={{ marginTop: space[3], gap: space[1] }}>
          {eyebrow ? (
            <Text variant="label" tone="ember">
              {eyebrow}
            </Text>
          ) : null}
          {title ? (
            <Display size="xl" accessibilityRole="header" numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>
              {title}
            </Display>
          ) : null}
          {sub}
        </View>
      ) : null}
    </View>
  );
}

/** Small label over a big tabular value. */
export function Stat({ label, value, tone, sub, style, ink, text }: { label: string; value: string; tone?: "up" | "down" | "primary" | "ember" | "gold" | "mint"; sub?: string; style?: StyleProp<ViewStyle>; ink?: boolean; text?: boolean }) {
  return (
    <View style={[{ gap: 4, minWidth: 0 }, style]}>
      <Text variant="label" color={ink ? colors.ink2 : colors.text3} numberOfLines={1}>
        {label}
      </Text>
      {text ? (
        <Text variant="headline" weight="700" tone={ink ? "ink" : tone ?? "primary"} numberOfLines={1}>
          {value}
        </Text>
      ) : (
        <Mono size={17} weight="bold" tone={ink ? "ink" : tone ?? "primary"} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Mono>
      )}
      {sub ? (
        <Text variant="caption" color={ink ? colors.ink2 : colors.text3} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

/** A value that copies itself on press (logins, codes). */
export function CopyValue({ value, label, mono = true, ink }: { value: string; label: string; mono?: boolean; ink?: boolean }) {
  const t = useT();
  return (
    <PressableScale
      onPress={async () => {
        await Clipboard.setStringAsync(value);
        haptic.select();
        toast.show({ title: t("mobileProp.copied", { what: label }) }, 1600);
      }}
      scaleTo={0.97}
      accessibilityLabel={t("mobileProp.a11y.copy", { what: label })}
      style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: 32 }}
    >
      {mono ? (
        <Mono size={13} weight="medium" color={ink ? colors.ink : colors.text2}>
          {value}
        </Mono>
      ) : (
        <Text variant="caption" color={ink ? colors.ink : colors.text2}>
          {value}
        </Text>
      )}
      <Copy size={13} color={ink ? colors.ink2 : colors.text3} />
    </PressableScale>
  );
}

/** Nothing to show and the fetch failed: the connection-lost art when the phone can't reach Kalks, else the error. */
export function LoadState({ error, onRetry, title }: { error?: { code?: string; message: string; status?: number } | null; onRetry: () => void; title?: string }) {
  const t = useT();
  const online = useOnline();
  if (!online || error?.code === "network") return <EmptyState illustration="connectionLost" title={t("mobile.state.offline.title")} body={t("mobile.state.offline.body")} action={t("mobile.action.retry")} onAction={onRetry} />;
  const unavailable = !error || error.code === "unavailable" || (error.status ?? 0) >= 500;
  return <EmptyState illustration="maintenance" title={title ?? t("mobileProp.load.title")} body={unavailable ? t("mobileProp.load.body") : error.message} action={t("mobile.action.retry")} onAction={onRetry} />;
}

/** Pull-to-refresh with the refresh haptic. */
export function useRefresh(fn: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = React.useCallback(async () => {
    haptic.select();
    setRefreshing(true);
    try {
      await fn();
    } finally {
      setRefreshing(false);
    }
  }, [fn]);
  return { refreshing, onRefresh };
}
