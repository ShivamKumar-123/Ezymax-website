'use client';

import { BRAND_NAME } from '@/lib/brand';

/**
 * /auth/check-email — landing page after a successful sign-up.
 *
 * Tells the user we've sent a verify-link to their inbox and offers a
 * "Resend email" button (rate-limited on the backend) and a "Sign in"
 * link. The verify link in the email points at /auth/verify-email which
 * flips the flag and bounces them to /auth/login?verified=1.
 */
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api/client';
import '../auth.css';

function CheckEmailContent() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get('email') || '';
  const [resending, setResending] = useState(false);

  const handleResend = async () => {
    if (!email) {
      toast.error('No email on file. Please sign in to resend.');
      return;
    }
    setResending(true);
    try {
      await api.post<{ message: string }>('/auth/resend-verification', { email });
      toast.success('Verification email sent. Check your inbox.');
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error(err?.message || 'Could not resend right now. Try again in a few minutes.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card-wrapper">
        <div className="auth-card" style={{ minHeight: 'auto' }}>
          <div className="auth-right" style={{ width: '100%' }}>
            <div style={{ width: '100%', maxWidth: 460, textAlign: 'center', padding: '48px 24px' }}>
              <div style={{
                width: 84, height: 84, borderRadius: '50%',
                background: 'rgba(225, 32, 25,0.14)', border: '2px solid rgba(225, 32, 25,0.4)',
                margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 0 6px rgba(225, 32, 25,0.05)',
              }}>
                <CheckCircle2 size={44} strokeWidth={2.25} style={{ color: '#E12019' }} />
              </div>
              <h2 className="auth-form__title" style={{ fontSize: 28, marginBottom: 16 }}>
                Please check your email.
              </h2>
              <p className="auth-form__subtitle" style={{ marginBottom: 18, fontSize: 15, lineHeight: 1.55 }}>
                An email has been sent to{' '}
                <strong style={{ color: 'var(--text-primary, #fff)' }}>{email || 'your inbox'}</strong>.
                Please verify your email address to complete your {BRAND_NAME} registration
                and start trading.
              </p>
              <p className="auth-form__subtitle" style={{ fontSize: 13, marginBottom: 28, opacity: 0.72, lineHeight: 1.55 }}>
                If you do not see the email in a few minutes, check your{' '}
                <em>&ldquo;junk&rdquo;</em> or <em>&ldquo;spam&rdquo;</em> folder.
                We make every effort to ensure these emails are delivered.
                The verification link is valid for 24 hours.
              </p>
              <button
                type="button"
                className="auth-btn auth-btn--outline"
                onClick={handleResend}
                disabled={resending}
                style={{ marginBottom: 12 }}
              >
                {resending ? <Loader2 size={18} className="auth-spinner" /> : 'Resend verification email'}
              </button>
              <button
                type="button"
                className="auth-btn"
                onClick={() => router.push('/auth/login')}
              >
                Go to sign in
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckEmailPage() {
  return (
    <Suspense fallback={null}>
      <CheckEmailContent />
    </Suspense>
  );
}
