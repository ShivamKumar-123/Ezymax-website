'use client';

import { Component, type ReactNode } from 'react';

const CHUNK_RE =
  /ChunkLoadError|Loading chunk\s+[^\s]+\s+failed|Failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed/i;

/**
 * Contains any chart failure so it can NEVER take down the whole terminal page
 * (the global error.tsx "Something broke on our end" screen). Wraps the
 * dynamically-imported TradingView chart, so it also catches a stale-deploy
 * chunk-load failure — in that case it does a one-time hard reload to pick up
 * the fresh chunks; any other error is caught and shown as a small inline
 * "Chart couldn't load / Retry" instead of crashing the page.
 */
export class ChartErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    const msg = `${error?.name || ''} ${error?.message || ''}`;
    if (CHUNK_RE.test(msg) && typeof window !== 'undefined') {
      try {
        const KEY = 'sc-chart-chunk-reload-at';
        const last = Number(sessionStorage.getItem(KEY) || 0);
        // One-time reload (guarded) so a genuinely broken build never loops.
        if (Date.now() - last > 20000) {
          sessionStorage.setItem(KEY, String(Date.now()));
          window.location.reload();
          return;
        }
      } catch {
        /* ignore */
      }
    }
    // eslint-disable-next-line no-console
    console.error('[chart] contained error (page kept alive):', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full min-h-[200px] grid place-items-center bg-bg-base text-text-tertiary text-sm">
          <div className="text-center">
            <p className="mb-2">Chart couldn’t load.</p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false })}
              className="rounded-md border border-border-primary px-3 py-1 text-xs hover:bg-bg-hover"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
