// The live depth-of-market book of one symbol for the ladder. Frames come from the quote feed's depth subscription
// (market-data: the account group's spread; `indicative` when built from the live bid / ask). They are written to a
// shared value once per frame, so the Skia ladder redraws on the UI thread and React never re-renders on a tick;
// React state changes only when the source (feed / indicative) changes or the first book arrives.
import * as React from "react";
import { useSharedValue, type SharedValue } from "react-native-reanimated";
import { feed, type DepthBook } from "@/market/feed";

/** Levels per side on the ladder. */
export const LEVELS = 10;

/** Flattened for the UI thread: [bid price, bid lots] × LEVELS, then [ask price, ask lots] × LEVELS (0 = no level). */
export function flatten(d: DepthBook | null): number[] {
  const out = new Array<number>(LEVELS * 4).fill(0);
  if (!d) return out;
  for (let i = 0; i < LEVELS; i++) {
    const b = d.bids[i];
    const a = d.asks[i];
    if (b) {
      out[i * 2] = b[0];
      out[i * 2 + 1] = b[1];
    }
    if (a) {
      out[LEVELS * 2 + i * 2] = a[0];
      out[LEVELS * 2 + i * 2 + 1] = a[1];
    }
  }
  return out;
}

export type LiveBook = {
  /** the ladder's shared value (UI thread) */
  book: SharedValue<number[]>;
  /** the latest frame, for a tap (JS) */
  latest: React.RefObject<DepthBook | null>;
  /** null until the first frame */
  src: DepthBook["src"] | null;
  /** no frame for a while after subscribing (the service has no price for the symbol, or the stream is down) */
  silent: boolean;
};

export function useDepthBook(symbol: string): LiveBook {
  const book = useSharedValue<number[]>(flatten(null));
  const latest = React.useRef<DepthBook | null>(null);
  const [src, setSrc] = React.useState<DepthBook["src"] | null>(null);
  const [silent, setSilent] = React.useState(false);
  React.useEffect(() => {
    if (!symbol) return;
    let raf = 0;
    let shown: DepthBook["src"] | null = null;
    latest.current = null;
    setSrc(null);
    setSilent(false);
    book.value = flatten(null);
    const flush = () => {
      raf = 0;
      book.value = flatten(latest.current);
    };
    const off = feed.subscribeDepth(
      symbol,
      (d) => {
        latest.current = d;
        if (d.src !== shown) {
          shown = d.src;
          setSrc(d.src);
          setSilent(false);
        }
        if (!raf) raf = requestAnimationFrame(flush);
      },
      LEVELS,
    );
    const timer = setTimeout(() => {
      if (!latest.current) setSilent(true);
    }, 6000);
    return () => {
      off();
      clearTimeout(timer);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [symbol, book]);
  // stable while nothing but the book's numbers change, so memoised consumers skip the screen's renders
  return React.useMemo(() => ({ book, latest, src, silent }), [book, src, silent]);
}
