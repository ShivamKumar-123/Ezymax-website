// Reading progress, synced like the Client Area's reader: the furthest point seen (0-100 %) goes to the service at
// most every 1.5 s while reading, once when the chapter opens (registers the visit and the learning day), and again
// when the reader leaves the chapter, the app goes to the background or the connection comes back. The service keeps
// the maximum, so a late or repeated report is harmless. Scroll handling itself stays on the UI thread (the reader
// calls report() only when the furthest point moves by a few percent).
import * as React from "react";
import { AppState } from "react-native";
import { netStore } from "@/lib/net";
import { postProgress, settleProgress } from "./api";

const THROTTLE_MS = 1500;
const OPEN_DELAY_MS = 800;

export function useReadingSync(slug: string | null, lang: string, initial: number, enabled = true) {
  const max = React.useRef(initial);
  const sent = React.useRef(initial);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = React.useRef(false);

  const flush = React.useCallback((final = false) => {
    if (!slug || !enabled) return;
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const v = max.current;
    if (v <= sent.current) {
      if (final) settleProgress(slug);
      return;
    }
    // the reply of the report in flight schedules the next one; leaving the chapter reports at once (the service
    // keeps the maximum, so an overlap is harmless)
    if (inflight.current && !final) return;
    const before = sent.current;
    sent.current = v;
    inflight.current = true;
    // while reading only the server hears about it; leaving the chapter also updates the cached screens
    void postProgress(slug, v, lang, final).then((r) => {
      inflight.current = false;
      // not stored (offline, server busy): report again on the next flush; refused (read-only session): stop
      if (!r.ok && (r.status === 0 || r.status >= 500)) sent.current = Math.min(sent.current, before);
      if (!final && max.current > sent.current && r.ok) flushLater();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, lang, enabled]);

  const flushLater = React.useCallback(() => {
    if (!timer.current) timer.current = setTimeout(() => ((timer.current = null), flush(false)), THROTTLE_MS);
  }, [flush]);

  /** The furthest point seen moved (0-100). */
  const report = React.useCallback(
    (pct: number) => {
      const p = Math.max(0, Math.min(100, Math.round(pct)));
      if (p <= max.current) return;
      max.current = p;
      flushLater();
    },
    [flushLater],
  );

  // a new chapter (next / previous) starts from its own stored progress
  React.useEffect(() => {
    max.current = Math.max(max.current, initial);
    sent.current = Math.max(sent.current, initial);
  }, [initial]);

  React.useEffect(() => {
    if (!slug || !enabled) return;
    max.current = initial;
    sent.current = initial;
    // register the visit once the chapter settled (a first open posts 0 %, like the web)
    const first = setTimeout(() => {
      if (sent.current === 0 && max.current === 0) void postProgress(slug, 0, lang, false);
      else flush(false);
    }, OPEN_DELAY_MS);
    const app = AppState.addEventListener("change", (s) => s !== "active" && flush(false));
    const net = netStore.subscribe(() => netStore.get().online && flush(false));
    return () => {
      clearTimeout(first);
      app.remove();
      net();
      flush(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, lang, enabled]);

  return React.useMemo(() => ({ report, flush }), [report, flush]);
}
