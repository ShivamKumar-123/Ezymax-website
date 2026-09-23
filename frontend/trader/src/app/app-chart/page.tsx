'use client';

/**
 * Shared advanced-chart page (TradingView Charting Library) — the FULL trading
 * chart, embedded chrome-free by the mobile app's WebView (CHART_URL points
 * here). Same widget + on-chart SL/TP (draggable, confirm dialog) + Buy/Sell
 * quick-trade — the mobile app's OWN chart. This route + its AppChart
 * component are a DEDICATED, INDEPENDENT copy for the APK, forked from the web
 * terminal's chart so changes to one never affect the other. The APK's WebView
 * points here (CHART_URL = .../app-chart).
 *
 * The WebView has no session cookie, so auth comes from the URL. The bearer
 * token is passed in the URL *hash* (never sent to the server / logs / Referer):
 *   #token=<jwt>     Bearer token (SecureStore) — used for API + WS.
 *                    A legacy ?token= query is still accepted; either way the
 *                    token is stripped from the URL right after it's read.
 * The remaining, non-sensitive params stay in the query string:
 *   ?account=<id>    active trading account (positions / orders)
 *   ?symbol=EURUSD   active symbol
 *   ?interval=60     TradingView resolution (1|5|15|30|60|240|1D)
 *   ?theme=dark|light
 *   ?api=<url>       backend base (informational; same-origin /api/v1 proxies)
 *
 * We populate the trading store here (the standalone page is outside the
 * trading layout that normally wires it) with token-authenticated fetches +
 * polling + the price WebSocket, then render TradingViewChart.
 */

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useTradingStore, type InstrumentInfo } from '@/stores/tradingStore';
import { api } from '@/lib/api/client';
import { wsManager } from '@/lib/ws/wsManager';
import { extractTicksFromPayload } from '@/lib/ws/normalizePricePayload';
import { mapApiAccount } from '@/lib/mapApiAccount';
import { ChartErrorBoundary } from '@/components/charts/ChartErrorBoundary';

function ChartSpinner({ dark }: { dark: boolean }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: dark ? '#0b0e11' : '#ffffff' }}
    >
      <div
        className="animate-spin"
        style={{ width: 34, height: 34, borderRadius: '50%', border: '3px solid rgba(242,106,31,0.25)', borderTopColor: '#f26a1f' }}
      />
    </div>
  );
}

function param(name: string, fallback = ''): string {
  if (typeof window === 'undefined') return fallback;
  return new URLSearchParams(window.location.search).get(name) || fallback;
}

// H-FE-1: the bearer token must NOT ride in the query string — query params land
// in server access logs, proxy logs, browser history and the Referer header. The
// URL *hash* is never sent to the server, so the app passes the token there
// (#token=<jwt>); we still accept a legacy ?token= for older builds. Whichever
// it is, we strip it from the URL immediately after reading (below) so it does
// not persist in history or leak via Referer on the next navigation.
function paramFromHash(name: string, fallback = ''): string {
  if (typeof window === 'undefined') return fallback;
  const raw = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  return new URLSearchParams(raw).get(name) || fallback;
}

function readToken(): string {
  return paramFromHash('token') || param('token');
}

// Remove the token from the visible/loggable URL once captured, keeping the
// non-sensitive params (symbol/interval/theme) in the address bar.
function stripTokenFromUrl(): void {
  if (typeof window === 'undefined') return;
  try {
    const search = new URLSearchParams(window.location.search);
    search.delete('token');
    const qs = search.toString();
    const clean = window.location.pathname + (qs ? `?${qs}` : '');
    window.history.replaceState(null, '', clean);
  } catch {
    /* history API unavailable — nothing else we can do */
  }
}

const TradingViewChart = dynamic(() => import('@/components/charts/AppChart'), {
  ssr: false,
  // Spinner matches the requested theme so a dark-mode app never flashes a
  // white screen while the chart lib loads.
  loading: () => <ChartSpinner dark={param('theme') === 'dark'} />,
});

export default function ChartPage() {
  // Theme follows the embedding app: the APK passes ?theme=dark|light from
  // its own theme, so the chart always matches the app around it.
  const [theme] = useState<'light' | 'dark'>(() => (param('theme') === 'dark' ? 'dark' : 'light'));
  const [interval] = useState<string>(() => param('interval', '60'));

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const token = readToken();
    const symbol = (param('symbol', 'EURUSD')).toUpperCase();
    const accountId = param('account');

    // Token auth for API (Bearer) — the WebView has no session cookie.
    if (token) api.setToken(token);
    // H-FE-1: drop the token from the URL as soon as it's in memory so it can't
    // leak via history / Referer / logs.
    stripTokenFromUrl();

    const store = useTradingStore.getState();
    store.setSelectedSymbol(symbol);

    let stopped = false;

    (async () => {
      const [accountsRes, instrumentsRes] = await Promise.all([
        api.get<unknown>('/accounts').catch(() => ({ items: [] })),
        api.get<unknown>('/instruments/').catch(() => []),
      ]);
      if (stopped) return;

      const instruments = Array.isArray(instrumentsRes)
        ? instrumentsRes
        : ((instrumentsRes as { items?: unknown[] })?.items ?? []);
      if (instruments.length > 0) {
        store.setInstruments(
          (instruments as Record<string, unknown>[]).map((i): InstrumentInfo => ({
            symbol: String(i.symbol),
            display_name: String(i.display_name || i.symbol),
            segment: String((i.segment as { name?: string })?.name || i.segment || ''),
            digits: Number(i.digits ?? 5),
            pip_size: Number(i.pip_size ?? 0.0001),
            min_lot: Number(i.min_lot ?? 0.01),
            max_lot: Number(i.max_lot ?? 100),
            lot_step: Number(i.lot_step ?? 0.01),
            contract_size: Number(i.contract_size ?? 100000),
            base_currency: i.base_currency ? String(i.base_currency) : null,
            quote_currency: i.quote_currency ? String(i.quote_currency) : null,
          })),
        );
      }

      const rawList = Array.isArray(accountsRes)
        ? accountsRes
        : ((accountsRes as { items?: unknown[] })?.items ?? []);
      const accounts = (rawList as Record<string, unknown>[]).map(mapApiAccount);
      store.setAccounts(accounts);
      const active = accounts.find((a) => a.id === accountId) || accounts[0] || null;
      if (active) store.setActiveAccount(active);
      if (stopped) return;

      await useTradingStore.getState().refreshPositions();
      try {
        const p = await api.get<unknown>('/instruments/prices/all', undefined, { timeoutMs: 15000 });
        useTradingStore.getState().updatePrices(extractTicksFromPayload(p));
      } catch {
        /* ignore */
      }
    })();

    // Live prices over WS + a REST poll fallback; positions polled for P&L and
    // to remove SL/TP lines when the server closes a position. Ticks are
    // applied as one batched store update per payload, and polls pause while
    // the WebView/tab is hidden.
    try { wsManager.connect(); } catch { /* ignore */ }
    const unsubWs = wsManager.onMessage((data) => {
      useTradingStore.getState().updatePrices(extractTicksFromPayload(data));
    });
    const pricePoll = setInterval(async () => {
      if (document.hidden) return;
      try {
        const p = await api.get<unknown>('/instruments/prices/all');
        useTradingStore.getState().updatePrices(extractTicksFromPayload(p));
      } catch { /* ignore */ }
    }, 1500);
    const posPoll = setInterval(() => {
      if (document.hidden) return;
      void useTradingStore.getState().refreshPositions();
    }, 1500);

    // Native side can switch symbol without a reload.
    const onMessage = (e: MessageEvent) => {
      if (e.origin && e.origin !== window.location.origin) return;
      const m = e.data as { type?: string; symbol?: string };
      if (m?.type === 'setSymbol' && m.symbol) useTradingStore.getState().setSelectedSymbol(String(m.symbol).toUpperCase());
    };
    window.addEventListener('message', onMessage);

    return () => {
      stopped = true;
      unsubWs?.();
      clearInterval(pricePoll);
      clearInterval(posPoll);
      window.removeEventListener('message', onMessage);
    };
  }, []);

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: theme === 'dark' ? '#0b0e11' : '#ffffff' }}
    >
      <ChartErrorBoundary>
        {/* Buy/Sell widget hidden here — the mobile app has its own native
            trade panel; the chart keeps SL/TP pill + draggable lines. */}
        <TradingViewChart theme={theme} intervalOverride={interval} showTradeWidget={false} />
      </ChartErrorBoundary>
    </div>
  );
}
