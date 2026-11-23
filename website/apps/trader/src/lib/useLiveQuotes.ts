'use client';

import { useEffect, useRef, useState } from 'react';
import { MARKET_API, MARKET_WS } from '@/lib/crm';
import { applyFrame, type QuoteMap, type StreamQuote } from '@/lib/quotes';

/**
 * Live quotes for a set of symbols.
 *
 * Gentle with the price provider: the WebSocket subscription is passive ("passive": true), so the website only
 * listens to symbols the platform already streams and never asks the provider for new ones. Anything not streaming
 * keeps its REST snapshot (refreshed every 60 s while the page is visible).
 */
export function useLiveQuotes(symbols: string[], initial: QuoteMap = {}, enabled = true) {
  const [quotes, setQuotes] = useState<QuoteMap>(initial);
  const [live, setLive] = useState(false);
  const key = symbols.join(',');
  const pending = useRef<QuoteMap>({});
  const flushTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || !key) return;
    let stopped = false;
    let ws: WebSocket | null = null;
    let retry = 0;
    let retryTimer: number | null = null;

    const snapshot = async () => {
      try {
        const res = await fetch(`${MARKET_API}/v1/quotes?symbols=${encodeURIComponent(key)}`, { cache: 'no-store' });
        if (!res.ok || stopped) return;
        const data = (await res.json()) as QuoteMap;
        setQuotes((prev) => {
          const next = { ...prev };
          for (const [s, q] of Object.entries(data)) next[s] = { ...prev[s], ...q };
          return next;
        });
      } catch {
        /* keep what we have */
      }
    };

    // Batch stream frames into at most ~4 renders a second.
    const flush = () => {
      flushTimer.current = null;
      const batch = pending.current;
      pending.current = {};
      setQuotes((prev) => {
        let next = prev;
        for (const f of Object.values(batch)) next = applyFrame(next, f as unknown as StreamQuote);
        return next;
      });
    };

    const connect = () => {
      if (stopped || ws || document.visibilityState === 'hidden') return;
      try {
        ws = new WebSocket(MARKET_WS);
      } catch {
        return;
      }
      ws.onopen = () => {
        retry = 0;
        setLive(true);
        ws?.send(JSON.stringify({ op: 'subscribe', symbols: key.split(','), passive: true }));
      };
      ws.onmessage = (ev) => {
        try {
          const f = JSON.parse(String(ev.data));
          if (f?.type !== 'quote' || !f.s) return;
          (pending.current as Record<string, unknown>)[f.s] = f;
          if (flushTimer.current === null) flushTimer.current = window.setTimeout(flush, 250);
        } catch {
          /* ignore */
        }
      };
      ws.onclose = () => {
        setLive(false);
        ws = null;
        if (stopped) return;
        retry = Math.min(retry + 1, 6);
        retryTimer = window.setTimeout(connect, 1000 * 2 ** retry);
      };
      ws.onerror = () => ws?.close();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        ws?.close();
      } else if (!ws) {
        snapshot();
        connect();
      }
    };

    if (!Object.keys(initial).length) snapshot();
    connect();
    const poll = window.setInterval(() => document.visibilityState === 'visible' && snapshot(), 60_000);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stopped = true;
      window.clearInterval(poll);
      if (retryTimer) window.clearTimeout(retryTimer);
      if (flushTimer.current) window.clearTimeout(flushTimer.current);
      document.removeEventListener('visibilitychange', onVisibility);
      ws?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  return { quotes, live };
}
