'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/api/client';

/**
 * Impersonation landing — admin opens this tab with `?code=<one-time>`.
 * The code is a 32-char hex token (60 s TTL, single-use) issued by the
 * admin API. We GETDEL it server-side via /auth/impersonate/redeem,
 * which sets HttpOnly cookies on the trader domain.
 *
 * The old `?token=<JWT>` form is no longer accepted: it put a 2-hour
 * impersonation credential in the URL (logs / history / Referer). Only the
 * single-use code works.
 */
function ImpersonateInner() {
  const searchParams = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    // Scrub any legacy ?token= from the address bar immediately; never use it.
    if (searchParams.get('token')) {
      try { window.history.replaceState(null, '', window.location.pathname + (code ? `?code=${encodeURIComponent(code)}` : '')); } catch { /* ignore */ }
    }
    if (!code) {
      window.location.replace('/auth/login');
      return;
    }

    void (async () => {
      try {
        // 1) Kill any previous session in this browser (e.g. a demo login
        // left over on localhost:3000) so its cookies don't leak into the
        // impersonated session.
        try {
          await api.post('/auth/logout', {});
        } catch {
          /* no-op — no prior session */
        }
        try {
          api.clearToken();
        } catch {
          /* api client may not expose clearToken in this build */
        }

        // 2) Start the impersonated session via the single-use code.
        await api.post('/auth/impersonate/redeem', { code });

        // 3) Hard redirect so the auth store rehydrates from scratch.
        //    Land on the user's dashboard directly (not the account picker)
        //    so admin "login as user" drops straight into their home view.
        window.location.replace('/dashboard');
      } catch {
        setError('Could not start impersonation session. The link may be expired or invalid.');
      }
    })();
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base">
      <div className="text-center space-y-4">
        {error ? (
          <>
            <p className="text-sell text-sm font-medium">{error}</p>
            <button
              type="button"
              onClick={() => window.location.replace('/auth/login')}
              className="text-xs text-text-tertiary underline"
            >
              Go to Login
            </button>
          </>
        ) : (
          <>
            <div className="w-10 h-10 border-2 border-buy border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-text-tertiary text-sm">Logging in as user…</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function ImpersonatePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-bg-base text-text-tertiary text-sm">
          Loading…
        </div>
      }
    >
      <ImpersonateInner />
    </Suspense>
  );
}
