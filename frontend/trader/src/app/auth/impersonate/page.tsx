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
 * Legacy `?token=<JWT>` is still accepted for backward-compat with old
 * admin builds — it routes through the existing bootstrap-session path.
 */
function ImpersonateInner() {
  const searchParams = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const legacyToken = searchParams.get('token');
    if (!code && !legacyToken) {
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

        // 2) Start the impersonated session — prefer the redemption-code
        //    path; fall back to legacy bootstrap-session if only ?token=
        //    is present (older admin build that we haven't deployed yet).
        if (code) {
          await api.post('/auth/impersonate/redeem', { code });
        } else {
          await api.post('/auth/bootstrap-session', { access_token: legacyToken });
        }

        // 3) Hard redirect so the auth store rehydrates from scratch.
        window.location.replace('/accounts');
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
