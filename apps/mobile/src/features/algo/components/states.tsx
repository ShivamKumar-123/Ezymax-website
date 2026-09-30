// Loading, empty and error states of the Algo screens. Loading is a static skeleton shaped like the content (no
// shimmer loop); an error says what happened (offline, switched off for the account, view-only login, not found,
// service down) with one way forward.
import { View, type StyleProp, type ViewStyle } from "react-native";
import { useT } from "@/i18n";
import type { ApiError } from "@/lib/api";
import { useOnline } from "@/lib/net";
import { EmptyState, Skeleton } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";

/** The full-screen state for a failed load (only when there is no cached answer to show). */
export function LoadError({ error, onRetry, onBack, style }: { error: ApiError | undefined; onRetry?: () => void; onBack?: () => void; style?: StyleProp<ViewStyle> }) {
  const t = useT();
  const online = useOnline();
  if (!online || error?.code === "network") {
    return <EmptyState style={style} illustration="connectionLost" title={t("mobile.state.offline.title")} body={t("mobile.state.offline.body")} action={onRetry ? t("mobile.action.retry") : undefined} onAction={onRetry} />;
  }
  if (error?.code === "module_disabled") {
    return <EmptyState style={style} illustration="maintenance" title={t("mobileAlgo.state.disabled.title")} body={t("mobileAlgo.state.disabled.text")} action={onBack ? t("common.back") : undefined} onAction={onBack} />;
  }
  if (error?.code === "viewer_scope" || error?.code === "viewer_read_only") {
    return <EmptyState style={style} illustration="security" title={t("mobile.viewOnly")} body={t("mobile.viewOnlyBody")} action={onBack ? t("common.back") : undefined} onAction={onBack} />;
  }
  if (error?.code === "maintenance") {
    return <EmptyState style={style} illustration="maintenance" title={t("mobile.state.maintenance.title")} body={t("mobile.state.maintenance.body")} action={onRetry ? t("mobile.action.retry") : undefined} onAction={onRetry} />;
  }
  if (error?.status === 404 || error?.code === "not_found") {
    return <EmptyState style={style} illustration="emptyHistory" title={t("mobileAlgo.state.notFound.title")} body={t("mobileAlgo.state.notFound.text")} action={onBack ? t("mobileAlgo.state.back") : undefined} onAction={onBack} />;
  }
  return (
    <EmptyState
      style={style}
      illustration="connectionLost"
      title={error?.code === "unavailable" ? t("mobileAlgo.state.unavailable.title") : t("mobile.state.error.title")}
      body={error?.message || t("mobileAlgo.state.unavailable.text")}
      action={onRetry ? t("mobile.action.retry") : undefined}
      onAction={onRetry}
    />
  );
}

/** A list row placeholder: tile, two lines, a figure on the end side. */
export function RowSkeleton({ height = 76 }: { height?: number }) {
  return (
    <View style={{ height, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: GUTTER, borderBottomWidth: 1, borderBottomColor: colors.line }}>
      <Skeleton w={44} h={44} r={13} />
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton w="55%" h={14} />
        <Skeleton w="75%" h={11} />
      </View>
      <View style={{ alignItems: "flex-end", gap: 8 }}>
        <Skeleton w={72} h={16} />
        <Skeleton w={48} h={10} />
      </View>
    </View>
  );
}

export function RowsSkeleton({ rows = 4, height = 76 }: { rows?: number; height?: number }) {
  const t = useT();
  return (
    <View accessible accessibilityLabel={t("common.loading")}>
      {Array.from({ length: rows }, (_, i) => (
        <RowSkeleton key={i} height={height} />
      ))}
    </View>
  );
}

/** A big card placeholder (hero, summary). */
export function BlockSkeleton({ height = 180, style }: { height?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ marginHorizontal: GUTTER, height, borderRadius: radius.block, backgroundColor: colors.surface, padding: space[6], gap: space[3] }, style]} accessibilityElementsHidden>
      <Skeleton w={90} h={11} />
      <Skeleton w="55%" h={40} r={10} />
      <Skeleton w="40%" h={12} />
    </View>
  );
}

/** Placeholder of a chart area (same height as the chart it stands for). */
export function ChartSkeleton({ height, style }: { height: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ height, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, justifyContent: "flex-end", padding: space[4], gap: space[2] }, style]} accessibilityElementsHidden>
      <Skeleton w="100%" h={1} />
      <Skeleton w="100%" h={1} />
      <Skeleton w="100%" h={1} />
    </View>
  );
}
