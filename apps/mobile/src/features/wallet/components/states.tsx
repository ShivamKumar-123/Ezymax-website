// Screen states shared by the wallet screens: offline / unavailable / maintenance (illustrated), the identity
// check notice, the view-only notice, a ticking countdown leaf and content-shaped skeletons.
import * as React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { useRouter } from "expo-router";
import { Eye, IdCard } from "lucide-react-native";
import { useT } from "@/i18n";
import { useOnline } from "@/lib/net";
import { useSession } from "@/session";
import { Banner, EmptyState, Mono, Skeleton } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import type { ApiError } from "../api";

/** Full-screen state when there is nothing cached to show: offline, maintenance, or the wallet being unreachable. */
export function WalletState({ error, onRetry }: { error?: ApiError | null; onRetry: () => void }) {
  const t = useT();
  const online = useOnline();
  if (!online || error?.code === "network")
    return <EmptyState illustration="connectionLost" title={t("mobile.state.offline.title")} body={t("mobile.state.offline.body")} action={t("mobile.action.retry")} onAction={onRetry} style={{ paddingTop: space[10] }} />;
  if (error?.code === "maintenance")
    return <EmptyState illustration="maintenance" title={t("mobile.state.maintenance.title")} body={t("mobile.state.maintenance.body")} action={t("mobile.action.retry")} onAction={onRetry} style={{ paddingTop: space[10] }} />;
  const clientError = !!error && (error.status ?? 0) >= 400 && (error.status ?? 0) < 500 && error.code !== "unavailable";
  return (
    <EmptyState
      illustration="connectionLost"
      title={t("wallet.unavailable.title")}
      body={clientError && error?.message ? error.message : t("wallet.unavailable.text")}
      action={t("mobile.action.retry")}
      onAction={onRetry}
      style={{ paddingTop: space[10] }}
    />
  );
}

/** Withdrawals need a verified identity; deposits, transfers and trading don't. */
export function KycNotice({ status, style }: { status: string | undefined; style?: StyleProp<ViewStyle> }) {
  const t = useT();
  const router = useRouter();
  if (!status || status === "verified") return null;
  const pending = status === "pending";
  return (
    <Banner
      tone="warn"
      icon={<IdCard size={18} color={colors.gold} />}
      title={pending ? t("wallet.kyc.inReview") : status === "rejected" ? t("wallet.kyc.needsAttention") : t("wallet.kyc.verifyToWithdraw")}
      body={pending ? t("wallet.kyc.pendingText") : t("wallet.kyc.requiredText")}
      action={pending ? t("wallet.kyc.viewVerification") : t("wallet.kyc.verifyNow")}
      onAction={() => router.push("/profile/verification")}
      style={style}
    />
  );
}

/** A view-only login (shared access) can look but not move money; the server refuses changes too. */
export function ViewOnlyNotice({ style }: { style?: StyleProp<ViewStyle> }) {
  const t = useT();
  const viewer = useSession((s) => s.viewer);
  if (!viewer) return null;
  return <Banner tone="info" icon={<Eye size={18} color={colors.text2} />} title={t("mobile.viewOnly")} body={t("mobile.viewOnlyBody")} style={style} />;
}

/** mm:ss until `until` (only this text re-renders every second). */
export function Countdown({ until, onExpire, size = 15 }: { until: string; onExpire?: () => void; size?: number }) {
  const end = React.useMemo(() => Date.parse(until), [until]);
  const [now, setNow] = React.useState(() => Date.now());
  const left = Math.max(0, Math.floor((end - now) / 1000));
  const expired = left === 0;
  React.useEffect(() => {
    if (expired) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [expired]);
  const fired = React.useRef(false);
  React.useEffect(() => {
    if (expired && !fired.current) {
      fired.current = true;
      onExpire?.();
    }
  }, [expired, onExpire]);
  const h = Math.floor(left / 3600);
  const m = Math.floor((left % 3600) / 60);
  const s = String(left % 60).padStart(2, "0");
  return (
    <Mono size={size} weight="bold" accessibilityLiveRegion="none">
      {h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`}
    </Mono>
  );
}

/* ---- skeletons shaped like the content ---- */

export function HeroSkeleton({ height = 208 }: { height?: number }) {
  return (
    <View style={{ marginHorizontal: GUTTER, height, borderRadius: radius.block, backgroundColor: colors.surface, padding: space[6], gap: space[4] }}>
      <Skeleton w={90} h={12} />
      <Skeleton w="72%" h={52} r={12} />
      <View style={{ flex: 1 }} />
      <View style={{ flexDirection: "row", gap: space[6] }}>
        <Skeleton w={90} h={28} />
        <Skeleton w={90} h={28} />
      </View>
    </View>
  );
}

export function FormSkeleton() {
  const t = useT();
  return (
    <View style={{ paddingHorizontal: GUTTER, gap: space[5] }} accessibilityLabel={t("common.loading")} accessible>
      <View style={{ flexDirection: "row", gap: space[3] }}>
        <Skeleton w="48%" h={124} r={radius.lg + 2} />
        <Skeleton w="48%" h={124} r={radius.lg + 2} />
      </View>
      <Skeleton w={80} h={12} />
      <Skeleton w="100%" h={64} r={12} />
      <Skeleton w="100%" h={54} r={radius.pill} />
    </View>
  );
}
