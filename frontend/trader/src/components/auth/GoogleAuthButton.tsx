'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { useAuthStore } from '@/stores/authStore';

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

export default function GoogleAuthButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { googleLogin } = useAuthStore();
  const [loading, setLoading] = useState(false);

  if (!CLIENT_ID) return null;

  const handleSuccess = async (resp: CredentialResponse) => {
    const idToken = resp.credential;
    if (!idToken) {
      toast.error('Google sign-in did not return a credential. Please try again.');
      return;
    }
    setLoading(true);
    try {
      const ref = searchParams.get('ref') || undefined;
      await googleLogin(idToken, ref);
      toast.success('Signed in with Google');
      router.push('/accounts');
    } catch (err: any) {
      // Surface server-side reasons (409 conflict for already-linked email,
      // 401 invalid token, 503 not configured, etc.) verbatim so the user
      // gets actionable feedback instead of a generic "failed".
      const status = err?.status ?? err?.response?.status;
      const detail = err?.detail || err?.response?.data?.detail || err?.message;
      let msg = detail || 'Google sign-in failed';
      if (status === 409) msg = detail || 'Email already linked to another Google account';
      else if (status === 503) msg = 'Google sign-in is not available right now';
      else if (status === 401) msg = 'Google sign-in could not be verified. Please try again.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Google fires onError when the popup is dismissed, the iframe fails to
  // load, third-party cookies are blocked, etc. Disambiguating these on
  // the client is unreliable — show a single helpful message.
  const handleError = () => {
    toast.error('Google sign-in was cancelled or could not load. Please try again.');
  };

  return (
    <div style={{ position: 'relative', width: '100%' }} aria-disabled={disabled || loading}>
      <div
        style={{
          display: loading ? 'none' : 'flex',
          justifyContent: 'center',
          pointerEvents: disabled ? 'none' : 'auto',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <GoogleLogin
          onSuccess={handleSuccess}
          onError={handleError}
          theme="outline"
          size="large"
          width="380"
          text="continue_with"
          shape="rectangular"
          logo_alignment="left"
        />
      </div>
      {loading && (
        <button type="button" className="auth-btn auth-btn--outline" disabled>
          <Loader2 size={18} className="auth-spinner" />
        </button>
      )}
    </div>
  );
}
