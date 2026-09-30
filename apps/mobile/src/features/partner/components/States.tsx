// Screen states shared by the partner and rewards screens when there is nothing cached to show: offline (the
// connection-lost art), the broker switched the module off, outside a view-only login's access, maintenance, the
// profile still being set up, or the service unreachable. Plus content-shaped static skeletons.
import * as React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import type { ApiError } from "@/lib/api";
import { useT } from "@/i18n";
import { useOnline } from "@/lib/net";
import { EmptyState, Skeleton } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";

type Ns = "mobilePartner" | "mobileRewards";

export function ScreenState({ error, onRetry, ns, style }: { error?: ApiError | null; onRetry: () => void; ns: Ns; style?: StyleProp<ViewStyle> }) {
  const t = useT();
  const online = useOnline();
  const s: StyleProp<ViewStyle> = [{ paddingTop: space[6] }, style];
  if (!online || error?.code === "network")
    return <EmptyState illustration="connectionLost" title={t("mobile.state.offline.title")} body={t("mobile.state.offline.body")} action={t("mobile.action.retry")} onAction={onRetry} style={s} />;
  if (error?.code === "maintenance")
    return <EmptyState illustration="maintenance" title={t("mobile.state.maintenance.title")} body={t("mobile.state.maintenance.body")} action={t("mobile.action.retry")} onAction={onRetry} style={s} />;
  if (error?.code === "module_disabled") return <EmptyState illustration={ns === "mobilePartner" ? "partnerIb" : "rewards"} title={t.dyn(`${ns}.state.off.title`)} body={t.dyn(`${ns}.state.off.body`)} style={s} />;
  if (error?.code === "viewer_scope") return <EmptyState illustration="security" title={t("mobile.viewOnly")} body={t.dyn(`${ns}.state.viewerScope`)} style={s} />;
  if (error?.code === "not_ready")
    return <EmptyState illustration={ns === "mobilePartner" ? "partnerIb" : "rewards"} title={t.dyn(`${ns}.state.settingUp.title`)} body={t.dyn(`${ns}.state.settingUp.body`)} action={t("mobile.action.retry")} onAction={onRetry} style={s} />;
  const clientError = !!error && (error.status ?? 0) >= 400 && (error.status ?? 0) < 500 && error.code !== "unavailable";
  return (
    <EmptyState
      illustration="connectionLost"
      title={t.dyn(`${ns}.state.error.title`)}
      body={clientError && error?.message ? error.message : t.dyn(`${ns}.state.error.body`)}
      action={t("mobile.action.retry")}
      onAction={onRetry}
      style={s}
    />
  );
}

/** A partner screen a view-only login may not open (payouts, campaign links: the Client Area's rule too). */
export function ViewerBlocked() {
  const t = useT();
  return <EmptyState illustration="security" title={t("mobile.viewOnly")} body={t("mobilePartner.state.viewerPage")} style={{ paddingTop: space[6] }} />;
}

/** A colour-block-shaped placeholder. */
export function BlockSkeleton({ height = 200, style }: { height?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ marginHorizontal: GUTTER, height, borderRadius: radius.block, backgroundColor: colors.surface, padding: space[6], gap: space[4] }, style]} accessibilityElementsHidden>
      <Skeleton w={96} h={12} />
      <Skeleton w="66%" h={44} r={12} />
      <View style={{ flex: 1 }} />
      <View style={{ flexDirection: "row", gap: space[5] }}>
        <Skeleton w={80} h={26} />
        <Skeleton w={80} h={26} />
        <Skeleton w={64} h={26} />
      </View>
    </View>
  );
}

/** Two-by-two tiles. */
export function TilesSkeleton({ height = 132 }: { height?: number }) {
  return (
    <View style={{ paddingHorizontal: GUTTER, gap: space[3] }} accessibilityElementsHidden>
      {[0, 1].map((r) => (
        <View key={r} style={{ flexDirection: "row", gap: space[3] }}>
          <Skeleton w="48.5%" h={height} r={radius.card} />
          <Skeleton w="48.5%" h={height} r={radius.card} />
        </View>
      ))}
    </View>
  );
}

/** Rows of a card list: circle, two lines, an amount. */
export function RowsSkeleton({ rows = 5, height = 72, inset = true }: { rows?: number; height?: number; inset?: boolean }) {
  return (
    <View style={{ marginHorizontal: inset ? GUTTER : 0, borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, overflow: "hidden" }} accessibilityLabel="Loading" accessible>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={{ height, flexDirection: "row", alignItems: "center", paddingHorizontal: space[5], gap: space[3], borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
          <Skeleton w={38} h={38} r={19} />
          <View style={{ flex: 1, gap: 7 }}>
            <Skeleton w="52%" h={13} />
            <Skeleton w="72%" h={10} />
          </View>
          <Skeleton w={64} h={16} />
        </View>
      ))}
    </View>
  );
}
