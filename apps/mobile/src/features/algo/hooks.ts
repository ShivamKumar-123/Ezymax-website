// Small hooks shared by the Algo screens: polling only while a screen is in front, the read-only session check,
// back navigation that survives deep links, and pull to refresh.
import * as React from "react";
import { useIsFocused, useRouter, type Href } from "expo-router";
import { haptic } from "@/lib/haptics";
import { useSession } from "@/session";

/** `ms` while this screen is the one in front, else no polling (a pushed screen stops the one below). */
export function usePoll(ms: number | undefined): number | undefined {
  const focused = useIsFocused();
  return focused ? ms : undefined;
}

/**
 * A view-only login or a read-only staff session: every change is hidden (the Client Area proxy refuses them anyway,
 * before the algo service is reached).
 */
export function useReadOnly(): boolean {
  const viewer = useSession((s) => !!s.viewer);
  const staffReadOnly = useSession((s) => (s.user as { impersonation?: { mode?: string } | null } | null)?.impersonation?.mode === "read_only");
  return viewer || staffReadOnly;
}

/** Trading restrictions set by the broker (new strategy orders would be refused by the engine). */
export function useTradingRestricted(): boolean {
  return useSession((s) => s.restricted.includes("trading") || s.restricted.includes("close_only"));
}

/** Back to the previous screen, or to `fallback` when this screen was opened directly (a link). */
export function useBack(fallback: Href = "/algo") {
  const router = useRouter();
  return React.useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback);
  }, [router, fallback]);
}

/** Pull to refresh over several queries: one haptic, the spinner until every refresh settled. */
export function usePullRefresh(refresh: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = React.useState(false);
  const ref = React.useRef(refresh);
  ref.current = refresh;
  const onRefresh = React.useCallback(async () => {
    haptic.select();
    setRefreshing(true);
    try {
      await ref.current();
    } finally {
      setRefreshing(false);
    }
  }, []);
  return { refreshing, onRefresh };
}

/** Re-renders every `ms` while mounted (relative times: "2 min ago"). */
export function useNow(ms = 30_000): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}
