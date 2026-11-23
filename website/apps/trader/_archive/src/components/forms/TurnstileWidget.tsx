'use client';

/**
 * Cloudflare Turnstile widget — mostly-invisible CAPTCHA for the signup
 * form. Solved tokens are passed up to the parent via `onToken`, which
 * wires them into the /auth/register payload as `cf_turnstile_token`.
 *
 * Behaviour:
 *   • If NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY isn't set we render
 *     nothing AND immediately call onToken('') so the form doesn't block
 *     in dev / staging without keys. Backend mirrors this: the server-
 *     side verifier skips verification when SECRET is empty.
 *   • Theme is set to 'dark' to match the rest of the auth pages.
 *   • Cleans up the widget on unmount so React strict-mode double-mounts
 *     don't leave orphan iframes behind.
 *
 * Docs: https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/
 */

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: string | HTMLElement,
        params: {
          sitekey: string;
          callback?: (token: string) => void;
          'error-callback'?: () => void;
          'expired-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
          size?: 'normal' | 'flexible' | 'compact';
        },
      ) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId?: string) => void;
    };
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
const SCRIPT_ID = 'cf-turnstile-script';

interface Props {
  onToken: (token: string) => void;
  className?: string;
}

/** Idempotently inject the Turnstile loader script tag into <head>. */
function loadTurnstileScript(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve();
    if (window.turnstile) return resolve();
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      // Another mount started loading it — poll briefly for window.turnstile.
      let tries = 50;
      const wait = () => {
        if (window.turnstile || tries-- <= 0) return resolve();
        setTimeout(wait, 100);
      };
      wait();
      return;
    }
    const s = document.createElement('script');
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.id = SCRIPT_ID;
    s.onload = () => resolve();
    s.onerror = () => resolve(); // resolve anyway — we'll fall back to skip mode
    document.head.appendChild(s);
  });
}

export default function TurnstileWidget({ onToken, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY?.trim() || '';

  useEffect(() => {
    // No site key — dev / staging mode. Hand the parent an empty token so
    // the form isn't blocked. Backend will allow it (SECRET also empty).
    if (!siteKey) {
      onToken('');
      return;
    }

    let cancelled = false;
    void (async () => {
      await loadTurnstileScript();
      if (cancelled || !containerRef.current || !window.turnstile) return;
      try {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: 'dark',
          size: 'flexible',
          callback: (token: string) => {
            if (!cancelled) onToken(token);
          },
          'error-callback': () => {
            // Network / challenge failed — drop the old token and ask
            // Cloudflare for a fresh challenge so the user doesn't have
            // to reload the page.
            if (cancelled) return;
            onToken('');
            const wid = widgetIdRef.current;
            if (wid && window.turnstile) {
              try { window.turnstile.reset(wid); } catch { /* ignore */ }
            }
          },
          'expired-callback': () => {
            // Turnstile tokens are only valid for ~5 minutes. If the
            // user took longer to fill the form, the previous token is
            // useless — reset to issue a new one before they hit
            // Submit, otherwise they see a misleading
            // "CAPTCHA verification failed" toast and have to reload.
            if (cancelled) return;
            onToken('');
            const wid = widgetIdRef.current;
            if (wid && window.turnstile) {
              try { window.turnstile.reset(wid); } catch { /* ignore */ }
            }
          },
        });
      } catch {
        // Widget failed to render — let the form go through with an
        // empty token; backend will reject if SECRET is configured.
        if (!cancelled) onToken('');
      }
    })();

    return () => {
      cancelled = true;
      const wid = widgetIdRef.current;
      if (wid && window.turnstile) {
        try { window.turnstile.remove(wid); } catch { /* ignore */ }
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  // Render nothing visible when no site key is configured (dev mode).
  if (!siteKey) return null;
  return <div ref={containerRef} className={className} />;
}
