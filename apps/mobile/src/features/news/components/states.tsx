// Loading, empty and error states of the news and calendar screens. Loading is a static skeleton shaped like the
// content (no shimmer loop); a failed first load says what happened (offline: the connection-lost art; view-only
// login without this section; maintenance or the service down: the maintenance art) with one way forward. With
// cached content on screen, errors never replace it.
import * as React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { useT } from "@/i18n";
import type { ApiError } from "@/lib/api";
import { useOnline } from "@/lib/net";
import { EmptyState, Skeleton } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";

export function LoadError({ error, onRetry, onBack, notFound, style }: { error: ApiError | undefined; onRetry?: () => void; onBack?: () => void; notFound?: { title: string; body: string; action: string }; style?: StyleProp<ViewStyle> }) {
  const t = useT();
  const online = useOnline();
  if (!online || error?.code === "network") {
    return <EmptyState style={style} illustration="connectionLost" title={t("mobile.state.offline.title")} body={t("mobile.state.offline.body")} action={onRetry ? t("mobile.action.retry") : undefined} onAction={onRetry} />;
  }
  if (error?.code === "viewer_scope" || error?.code === "viewer_read_only") {
    return <EmptyState style={style} illustration="security" title={t("mobile.viewOnly")} body={error.message || t("mobile.viewOnlyBody")} action={onBack ? t("common.back") : undefined} onAction={onBack} />;
  }
  if (error?.code === "maintenance") {
    return <EmptyState style={style} illustration="maintenance" title={t("mobile.state.maintenance.title")} body={t("mobile.state.maintenance.body")} action={onRetry ? t("mobile.action.retry") : undefined} onAction={onRetry} />;
  }
  if (notFound && (error?.status === 404 || error?.code === "not_found")) {
    return <EmptyState style={style} illustration="emptyHistory" title={notFound.title} body={notFound.body} action={onBack ? notFound.action : undefined} onAction={onBack} />;
  }
  // online, but the service failed: the "we'll be right back" art (connection lost is for offline)
  return <EmptyState style={style} illustration="maintenance" title={t("mobile.state.error.title")} body={error?.message || t("mobile.state.error.body")} action={onRetry ? t("mobile.action.retry") : undefined} onAction={onRetry} />;
}

/** Skeleton of a story row (kicker, three title lines, chips). */
export function StoryRowSkeleton({ height }: { height: number }) {
  return (
    <View style={{ height, paddingHorizontal: GUTTER, paddingVertical: space[4], gap: space[2], borderBottomWidth: 1, borderBottomColor: colors.line }}>
      <Skeleton w={150} h={10} />
      <Skeleton w="94%" h={15} style={{ marginTop: 4 }} />
      <Skeleton w="70%" h={15} />
      <View style={{ flexDirection: "row", gap: space[2], marginTop: "auto" }}>
        <Skeleton w={78} h={22} r={11} />
        <Skeleton w={60} h={22} r={11} />
        <Skeleton w={64} h={22} r={11} />
      </View>
    </View>
  );
}

export function StoryRowsSkeleton({ rows = 5, height }: { rows?: number; height: number }) {
  return (
    <View accessible accessibilityLabel="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <StoryRowSkeleton key={i} height={height} />
      ))}
    </View>
  );
}

/** Skeleton of a colour block (brief, hero story). */
export function BlockSkeleton({ height, style }: { height: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ height, borderRadius: radius.block, backgroundColor: colors.surface, padding: space[6], gap: space[3] }, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Skeleton w={110} h={11} />
      <Skeleton w="85%" h={22} r={8} />
      <Skeleton w="60%" h={22} r={8} />
      <Skeleton w="40%" h={12} style={{ marginTop: "auto" }} />
    </View>
  );
}

/** Skeleton of calendar rows under a day heading. */
export function EventRowsSkeleton({ rows = 8, height }: { rows?: number; height: number }) {
  return (
    <View accessible accessibilityLabel="Loading">
      <View style={{ height: 64, paddingHorizontal: GUTTER, justifyContent: "center" }}>
        <Skeleton w={140} h={16} />
      </View>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={{ height, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: GUTTER, borderBottomWidth: 1, borderBottomColor: colors.line }}>
          <View style={{ width: 48, gap: 6 }}>
            <Skeleton w={42} h={13} />
            <Skeleton w={20} h={9} />
          </View>
          <View style={{ flex: 1, gap: 7 }}>
            <Skeleton w="72%" h={13} />
            <Skeleton w="48%" h={10} />
          </View>
          <Skeleton w={28} h={28} r={14} />
        </View>
      ))}
    </View>
  );
}
