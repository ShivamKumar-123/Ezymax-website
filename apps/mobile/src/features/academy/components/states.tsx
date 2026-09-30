// Academy screen states: offline / unavailable / not found / not shared with a view-only login / switched off
// (illustrated, one action), the risk note, and static skeletons shaped like the content they stand in for.
import * as React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useT } from "@/i18n";
import { useOnline } from "@/lib/net";
import { EmptyState, Skeleton, Text } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import type { ApiError } from "../api";

/** Full-screen state when there is nothing cached to show. */
export function AcademyState({ error, onRetry, notFound }: { error?: ApiError | null; onRetry: () => void; notFound?: boolean }) {
  const t = useT();
  const router = useRouter();
  const online = useOnline();
  const style = { paddingTop: space[8] };
  if (notFound || error?.status === 404 || error?.code === "not_found")
    return (
      <EmptyState
        illustration="emptyHistory"
        title={t("academy.unavailable.notFoundTitle")}
        body={t("academy.unavailable.notFoundText")}
        action={t("academy.backToAcademy")}
        onAction={() => router.dismissTo("/academy")}
        style={style}
      />
    );
  if (!online || error?.code === "network")
    return <EmptyState illustration="connectionLost" title={t("mobile.state.offline.title")} body={t("mobile.state.offline.body")} action={t("mobile.action.retry")} onAction={onRetry} style={style} />;
  if (error?.code === "viewer_scope" || error?.code === "viewer_read_only")
    return <EmptyState illustration="security" title={t("mobileAcademy.state.viewer.title")} body={t("mobileAcademy.state.viewer.body")} style={style} />;
  if (error?.code === "module_disabled") return <EmptyState illustration="maintenance" title={t("mobileAcademy.state.disabled.title")} body={t("mobileAcademy.state.disabled.body")} style={style} />;
  if (error?.code === "maintenance")
    return <EmptyState illustration="maintenance" title={t("mobile.state.maintenance.title")} body={t("mobile.state.maintenance.body")} action={t("mobile.action.retry")} onAction={onRetry} style={style} />;
  return <EmptyState illustration="connectionLost" title={t("academy.unavailable.title")} body={t("academy.unavailable.text")} action={t("mobile.action.retry")} onAction={onRetry} style={style} />;
}

export function RiskNote() {
  const t = useT();
  return (
    <Text variant="caption" tone="tertiary" style={{ paddingHorizontal: GUTTER, marginTop: space[8], lineHeight: 18 }}>
      {t("academy.riskNote")}
    </Text>
  );
}

/* ---- skeletons (static on purpose: functional motion only) ---- */

/** Screen readers hear one "Loading…" for a whole skeleton. */
function useLoadingLabel() {
  return useT()("common.loading");
}

export function HomeSkeleton() {
  const loading = useLoadingLabel();
  return (
    <View style={{ paddingHorizontal: GUTTER, gap: space[4] }} accessibilityLabel={loading} accessible>
      <View style={{ height: 262, borderRadius: radius.block, backgroundColor: colors.surface, padding: space[6], gap: space[3] }}>
        <Skeleton w={120} h={12} />
        <Skeleton w="86%" h={34} r={8} />
        <Skeleton w="60%" h={34} r={8} />
        <View style={{ flex: 1 }} />
        <Skeleton w="100%" h={6} r={3} />
        <Skeleton w={160} h={46} r={radius.pill} />
      </View>
      <View style={{ flexDirection: "row", gap: space[3] }}>
        <Skeleton w={undefined} h={112} r={radius.card} style={{ flex: 1 }} />
        <Skeleton w={undefined} h={112} r={radius.card} style={{ flex: 1 }} />
      </View>
      <Skeleton w={200} h={22} style={{ marginTop: space[4] }} />
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} h={176} r={radius.block} />
      ))}
    </View>
  );
}

export function PhaseSkeleton() {
  const loading = useLoadingLabel();
  return (
    <View style={{ gap: space[4] }} accessibilityLabel={loading} accessible>
      <View style={{ marginHorizontal: GUTTER, height: 300, borderRadius: radius.block, backgroundColor: colors.surface, padding: space[6], gap: space[3] }}>
        <Skeleton w={110} h={12} />
        <Skeleton w="80%" h={38} r={8} />
        <Skeleton w="92%" h={14} />
        <Skeleton w="70%" h={14} />
        <View style={{ flex: 1 }} />
        <Skeleton w="100%" h={6} r={3} />
        <Skeleton w={150} h={46} r={radius.pill} />
      </View>
      <View style={{ flexDirection: "row", gap: space[2], paddingHorizontal: GUTTER }}>
        <Skeleton w={110} h={34} r={radius.pill} />
        <Skeleton w={110} h={34} r={radius.pill} />
        <Skeleton w={100} h={34} r={radius.pill} />
      </View>
      <ChapterRowsSkeleton rows={6} />
    </View>
  );
}

export function ChapterRowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <View>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={{ height: 80, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: GUTTER }}>
          <Skeleton w={32} h={32} r={16} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton w="78%" h={14} />
            <Skeleton w={110} h={10} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function ReaderSkeleton() {
  const loading = useLoadingLabel();
  return (
    <View style={{ paddingHorizontal: GUTTER, gap: space[3], paddingTop: space[2] }} accessibilityLabel={loading} accessible>
      <View style={{ flexDirection: "row", gap: space[2] }}>
        <Skeleton w={120} h={26} r={radius.pill} />
        <Skeleton w={90} h={26} r={radius.pill} />
      </View>
      <Skeleton w="92%" h={30} r={8} style={{ marginTop: space[2] }} />
      <Skeleton w="64%" h={30} r={8} />
      <Skeleton w="100%" h={14} style={{ marginTop: space[2] }} />
      <Skeleton w="84%" h={14} />
      <Skeleton w={220} h={11} style={{ marginTop: space[2] }} />
      <View style={{ height: 1, backgroundColor: colors.line, marginVertical: space[3] }} />
      {[100, 96, 98, 72].map((w, i) => (
        <Skeleton key={i} w={`${w}%`} h={15} />
      ))}
      <Skeleton w="50%" h={20} r={6} style={{ marginTop: space[4] }} />
      {[98, 94, 97, 88, 60].map((w, i) => (
        <Skeleton key={`b${i}`} w={`${w}%`} h={15} />
      ))}
    </View>
  );
}

export function GlossarySkeleton({ rows = 7, height = 96 }: { rows?: number; height?: number }) {
  const loading = useLoadingLabel();
  return (
    <View accessibilityLabel={loading} accessible>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={{ height, paddingHorizontal: GUTTER, paddingVertical: space[3], gap: 8, borderBottomWidth: 1, borderBottomColor: colors.line }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Skeleton w={130} h={16} />
            <Skeleton w={84} h={18} r={radius.pill} />
          </View>
          <Skeleton w="94%" h={12} />
          <Skeleton w="70%" h={12} />
        </View>
      ))}
    </View>
  );
}
