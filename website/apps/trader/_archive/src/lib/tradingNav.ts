const STORAGE_KEY = 'pt_active_trading_account';

export function setPersistedTradingAccountId(id: string | null) {
  if (typeof window === 'undefined') return;
  if (id) sessionStorage.setItem(STORAGE_KEY, id);
  else sessionStorage.removeItem(STORAGE_KEY);
}

export function getPersistedTradingAccountId(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(STORAGE_KEY);
}

/** Terminal URL; without account id returns picker path `/trading`. */
export function tradingTerminalUrl(accountId: string | null | undefined, extra?: Record<string, string>) {
  if (!accountId) return '/trading';
  const q = new URLSearchParams({ account: accountId, ...extra });
  return `/trading/terminal?${q.toString()}`;
}

/**
 * Click handler for "open the terminal" links that carry target="_blank".
 * In a normal browser (incl. desktop) the default new-tab behaviour is kept.
 * In an INSTALLED PWA (standalone) a _blank link escapes to the system browser,
 * breaking out of the app — so there we cancel the new tab and navigate in the
 * same window to stay inside the installed app. Checked at click time so
 * `window` is always available. (client 2026-07-21)
 */
export function handleTerminalOpen(e: { preventDefault: () => void }, href: string) {
  if (typeof window === 'undefined') return;
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  if (standalone) {
    e.preventDefault();
    window.location.assign(href);
  }
}
