'use client';

/**
 * Custom-styled "Continue with Google" button.
 *
 * Replaces @react-oauth/google's <GoogleLogin> iframe (which forces a white
 * surface and a fixed "personalized" pill shape) with a dark FXArtha
 * `.auth-btn--outline` button so it visually matches the wallet + demo
 * buttons stacked below it on the auth page.
 *
 * Auth-flow contract is preserved: we still get an id_token credential
 * which the backend verifies against Google's JWKS at /auth/google. The
 * GIS SDK is loaded by GoogleAuthProvider (the <GoogleOAuthProvider>
 * wrapper) — we just call into it directly via window.google.accounts.id
 * instead of letting the library render its iframe button.
 *
 * Failure modes handled:
 *   - SDK still loading           → button shows as "Loading…", disabled
 *   - One Tap dismissed/cooldown  → toast: "Couldn't show Google sign-in — try again or use email"
 *   - Credential null             → toast: "Google sign-in did not return a credential"
 *   - Backend 409/401/503         → mapped error toasts (same as before)
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { useAuthStore } from '@/stores/authStore';

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: GoogleIdConfig) => void;
          prompt: (cb?: (notification: GoogleNotification) => void) => void;
          cancel: () => void;
          disableAutoSelect: () => void;
          renderButton: (parent: HTMLElement, options: object) => void;
        };
      };
    };
  }
}

type GoogleIdConfig = {
  client_id: string;
  callback: (response: { credential?: string }) => void;
  auto_select?: boolean;
  cancel_on_tap_outside?: boolean;
  use_fedcm_for_prompt?: boolean;
  ux_mode?: 'popup' | 'redirect';
};

type GoogleNotification = {
  isDisplayed?: () => boolean;
  isNotDisplayed?: () => boolean;
  isSkippedMoment?: () => boolean;
  isDismissedMoment?: () => boolean;
  getNotDisplayedReason?: () => string;
  getSkippedReason?: () => string;
  getDismissedReason?: () => string;
};


function GoogleGlyph({ size = 18 }: { size?: number }) {
  // Inline multicoloured Google "G" — keeps the button identifiable as
  // Google sign-in even on a dark surface where a monochrome icon would
  // look unbranded.
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285F4" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#34A853" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#EA4335" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}


export default function GoogleAuthButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { googleLogin } = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const initializedRef = useRef(false);
  const fallbackParentRef = useRef<HTMLDivElement | null>(null);

  /* The GIS SDK is loaded by <GoogleOAuthProvider> on app boot. Poll for
   * its presence — but DO NOT initialize() on mount. Initializing too
   * early causes Google's FedCM SDK to auto-display its white "Continue
   * as <name>" personalized card on top of the page (it ignores our
   * dark theme). We defer init until the user actually clicks our dark
   * button, then call initialize() + prompt() back-to-back. Net result:
   * Google's UI only ever shows after an explicit user action. */
  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;
    const check = () => {
      if (cancelled) return;
      if (window.google?.accounts?.id) {
        setSdkReady(true);
      } else {
        setTimeout(check, 200);
      }
    };
    check();
    return () => {
      cancelled = true;
      // Belt-and-braces: dismiss any FedCM card that snuck through (e.g.
      // mounted by a stale bundle) when this component unmounts.
      try {
        window.google?.accounts?.id?.cancel();
      } catch {
        /* SDK not loaded; nothing to cancel */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCredential = useCallback(async (response: { credential?: string }) => {
    if (!response?.credential) {
      toast.error('Google sign-in did not return a credential. Please try again.');
      return;
    }
    setLoading(true);
    try {
      const ref = searchParams.get('ref') || undefined;
      await googleLogin(response.credential, ref);
      toast.success('Signed in with Google');
      router.push('/accounts');
    } catch (err: any) {
      const status = err?.status ?? err?.response?.status;
      const detail = err?.detail || err?.response?.data?.detail || err?.message;
      // The sign-in actually succeeded server-side (session created, email
      // dispatched) — we just couldn't load the profile in time. Send the
      // user to /accounts; the layout's loadUser() will resolve identity
      // there. Don't show the misleading "could not be verified" toast.
      if (err?.profileLoadFailed) {
        toast.success('Signed in with Google');
        router.push('/accounts');
        return;
      }
      let msg = detail || 'Google sign-in failed';
      if (status === 409) msg = detail || 'Email already linked to another Google account';
      else if (status === 503) msg = 'Google sign-in is not available right now';
      else if (status === 401) msg = 'Google sign-in could not be verified. Please try again.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleLogin, router, searchParams]);

  const handleClick = () => {
    if (loading || disabled || !sdkReady) return;
    const id = window.google?.accounts?.id;
    if (!id || !CLIENT_ID) {
      toast.error('Google sign-in is loading — please try again in a moment.');
      return;
    }
    // Lazy initialize on first click. cancel() any pending FedCM card
    // first so we never have two stacked.
    try {
      id.cancel();
    } catch {
      /* nothing to cancel */
    }
    if (!initializedRef.current) {
      id.initialize({
        client_id: CLIENT_ID,
        callback: handleCredential,
        auto_select: false,
        cancel_on_tap_outside: true,
        use_fedcm_for_prompt: true,
      });
      initializedRef.current = true;
    }
    id.prompt((notification) => {
      // FedCM / One Tap may refuse to show for a few reasons:
      //   - exponential cooldown after recent dismissals
      //   - third-party cookies disabled
      //   - opt_out_or_no_session
      // When that happens, render the iframe button into our hidden host
      // and click it programmatically — gives the user a guaranteed path
      // to sign in even when One Tap is suppressed.
      const blocked =
        notification?.isNotDisplayed?.() ||
        notification?.isSkippedMoment?.() ||
        notification?.isDismissedMoment?.();
      if (blocked && fallbackParentRef.current) {
        fallbackParentRef.current.innerHTML = '';
        try {
          id.renderButton(fallbackParentRef.current, {
            theme: 'filled_black',
            size: 'large',
            type: 'standard',
            shape: 'pill',
            text: 'continue_with',
            logo_alignment: 'left',
          });
          // Click the rendered iframe-button so the popup opens directly.
          const realBtn = fallbackParentRef.current.querySelector(
            'div[role="button"], iframe',
          ) as HTMLElement | null;
          realBtn?.click();
        } catch {
          toast.error('Could not open Google sign-in. Please try again or use email.');
        }
      }
    });
  };

  if (!CLIENT_ID) return null;

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || loading || !sdkReady}
        className="auth-btn auth-btn--outline"
        aria-label="Continue with Google"
      >
        {loading ? (
          <Loader2 size={18} className="auth-spinner" />
        ) : (
          <GoogleGlyph size={18} />
        )}
        <span>{loading ? 'Signing in…' : 'Continue with Google'}</span>
      </button>
      {/* Hidden host for the fallback iframe button — only used if One Tap
       *  is suppressed by the browser. Off-screen so it never affects layout. */}
      <div
        ref={fallbackParentRef}
        style={{
          position: 'fixed',
          top: '-9999px',
          left: '-9999px',
          width: 0,
          height: 0,
          overflow: 'hidden',
        }}
        aria-hidden="true"
      />
    </>
  );
}
