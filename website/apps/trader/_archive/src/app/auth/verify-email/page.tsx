'use client';

import { BRAND_NAME } from '@/lib/brand';
import { BrandLogo } from '@/components/BrandLogo';

/**
 * /auth/verify-email — landing page the email-verify link points at.
 *
 * Reads ?token= from the URL, calls GET /auth/verify-email?token=…, and on
 * success lands the user on /accounts. The verify endpoint now AUTO-LOGS-IN
 * (sets the same HttpOnly session cookies a login would), so this page is
 * the single entry point that grants a session to a freshly-signed-up
 * trader. /auth/register no longer issues cookies — bypassing this page is
 * not possible.
 */
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import api from '@/lib/api/client';
import { useAuthStore } from '@/stores/authStore';
import '../auth.css';

function VerifyEmailContent() {
  const router = useRouter();
  const params = useSearchParams();
  const loadUser = useAuthStore((s) => s.loadUser);
  const token = params.get('token');
  const [state, setState] = useState<'loading' | 'ok' | 'fail'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setState('fail');
      setMessage('Missing verification token. Please open the link from the email we sent you.');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        // Backend sets session cookies on this response (auto-login).
        await api.get(`/auth/verify-email?token=${encodeURIComponent(token)}`);
        if (cancelled) return;
        // Pull the user into the store now that cookies are set so the
        // dashboard / ProfileCompleteGate render with the correct identity.
        await loadUser();
        if (cancelled) return;
        setState('ok');
        setMessage('Email verified. Taking you to your account…');
        setTimeout(() => router.push('/accounts'), 900);
      } catch (e: unknown) {
        if (cancelled) return;
        const err = e as { message?: string };
        setState('fail');
        setMessage(err?.message || 'Verification link is invalid or expired.');
      }
    })();
    return () => { cancelled = true; };
  }, [token, router, loadUser]);

  return (
    <div className="auth-wrapper">
      <div className="auth-card-wrapper">
        <div className="auth-card" style={{ minHeight: 'auto' }}>
          <div className="auth-right" style={{ width: '100%' }}>
            <div style={{ width: '100%', maxWidth: 380, textAlign: 'center', padding: '40px 20px' }}>
              {/* auth-card is white in both themes — pinned to ink. */}
              <BrandLogo
                tone="ink"
                style={{ width: 64, height: 64, objectFit: 'contain', margin: '0 auto 24px' }}
              />
              {state === 'loading' && (
                <>
                  <Loader2 size={36} className="auth-spinner" style={{ margin: '0 auto 16px', color: '#E12019' }} />
                  <h2 className="auth-form__title">Verifying…</h2>
                  <p className="auth-form__subtitle">Hold on while we confirm your email.</p>
                </>
              )}
              {state === 'ok' && (
                <>
                  <CheckCircle2 size={48} style={{ color: '#E12019', margin: '0 auto 16px', display: 'block' }} />
                  <h2 className="auth-form__title">Email verified</h2>
                  <p className="auth-form__subtitle">{message}</p>
                </>
              )}
              {state === 'fail' && (
                <>
                  <XCircle size={48} style={{ color: '#ef4444', margin: '0 auto 16px', display: 'block' }} />
                  <h2 className="auth-form__title">Verification failed</h2>
                  <p className="auth-form__subtitle" style={{ marginBottom: 24 }}>{message}</p>
                  <button
                    type="button"
                    className="auth-btn"
                    onClick={() => router.push('/auth/login')}
                  >
                    Go to sign in
                  </button>
                  <p className="auth-form__subtitle" style={{ marginTop: 16, fontSize: 12 }}>
                    Need a new link? Sign in and we&apos;ll show a resend button.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}
