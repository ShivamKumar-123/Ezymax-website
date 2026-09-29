// Screen helpers shared by the Academy screens.
import * as React from "react";
import { useFocusEffect } from "expo-router";
import { haptic } from "@/lib/haptics";
import { useOnline } from "@/lib/net";

/** Refresh a query when its screen comes back into focus and its data is older than `staleMs` (e.g. back from a
 *  chapter to its phase: the phase shows the progress the reader just made). */
export function useRefreshOnFocus(q: { updatedAt: number; refresh: () => Promise<void> }, staleMs = 15_000) {
  const ref = React.useRef(q);
  ref.current = q;
  useFocusEffect(
    React.useCallback(() => {
      if (ref.current.updatedAt && Date.now() - ref.current.updatedAt > staleMs) void ref.current.refresh();
    }, [staleMs]),
  );
}

/** Pull-to-refresh state for a list or scroll view (haptic on pull, as everywhere in the app). */
export function usePull(refresh: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = React.useCallback(async () => {
    haptic.select();
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);
  return { refreshing, onRefresh };
}

/** A screen showing an error with nothing cached retries by itself when the connection comes back. */
export function useRetryOnReconnect(q: { data: unknown; error: unknown; refresh: () => Promise<void> }) {
  const online = useOnline();
  const was = React.useRef(online);
  const ref = React.useRef(q);
  ref.current = q;
  React.useEffect(() => {
    const cur = ref.current;
    if (online && !was.current && cur.error && cur.data === undefined) void cur.refresh();
    was.current = online;
  }, [online]);
}
