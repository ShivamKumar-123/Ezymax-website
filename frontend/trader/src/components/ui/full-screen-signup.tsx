'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Eye, EyeOff, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';

import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api/client';
import { scorePassword } from '@/lib/passwordStrength';
import { useBrandDisplay } from '@/components/providers/BrandingProvider';

type Mode = 'login' | 'signup';
type SignupStep = 'credentials' | 'otp';

interface FullScreenSignupProps {
  /** 'signup' renders the create-account form, 'login' renders the sign-in
   *  form against the same chrome. Defaults to 'signup'. */
  mode?: Mode;
}

const COPY: Record<Mode, {
  hero: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  cta: string;
  switchPrompt: string;
  switchLink: string;
  switchHref: string;
}> = {
  signup: {
    hero: 'A Swiss-precision trading platform for serious investors.',
    eyebrow: 'Welcome to SwissCresta',
    title: 'Create your account',
    subtitle: 'Trade FX, indices, metals and crypto with bank-grade execution.',
    cta: 'Create account',
    switchPrompt: 'Already have an account?',
    switchLink: 'Sign in',
    switchHref: '/auth/login',
  },
  login: {
    hero: 'A Swiss-precision trading platform for serious investors.',
    eyebrow: 'Welcome back',
    title: 'Sign in to SwissCresta',
    subtitle: 'Access your portfolio, positions and watchlists.',
    cta: 'Sign in',
    switchPrompt: "Don't have an account yet?",
    switchLink: 'Create one',
    switchHref: '/auth/register',
  },
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export const FullScreenSignup = ({ mode = 'signup' }: FullScreenSignupProps) => {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const demoLogin = useAuthStore((s) => s.demoLogin);
  const refreshUser = useAuthStore((s) => s.refreshUser);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<SignupStep>('credentials');
  // IB referral code from the signup link (?ref=CODE). Captured on mount so
  // it survives the credentials → OTP step transition, then sent to
  // /auth/register/start where the backend stages it and attributes the
  // referral on verify. Without this the IB never gets credited.
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const brand = useBrandDisplay();
  // White-label tenants get their own name in every piece of copy and
  // a neutral hero line (the platform's Swiss-precision pitch is
  // SwissCresta marketing, not theirs).
  const copy = brand.isWhiteLabel
    ? {
        ...COPY[mode],
        hero: 'A professional multi-asset trading platform.',
        eyebrow: mode === 'signup' ? `Welcome to ${brand.name}` : 'Welcome back',
        title: mode === 'signup' ? 'Create your account' : `Sign in to ${brand.name}`,
      }
    : COPY[mode];

  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get('ref');
      if (ref && ref.trim()) setReferralCode(ref.trim());
    } catch {
      /* no query string / SSR guard — ignore */
    }
  }, []);

  const submitCredentials = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // In-flight guard: a double-click fires two submit events before React
    // re-renders the disabled button — without this the OTP email went out
    // twice on registration.
    if (submitting) return;
    const next: Record<string, string> = {};

    if (!isValidEmail(email)) next.email = 'Please enter a valid email address.';

    if (mode === 'signup') {
      const strength = scorePassword(password);
      if (!strength.ok) next.password = strength.issues[0] ?? 'Choose a stronger password.';
      if (confirmPassword !== password) next.confirmPassword = 'Passwords do not match.';
    } else if (password.length === 0) {
      next.password = 'Enter your password.';
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    try {
      setSubmitting(true);
      const normalizedEmail = email.trim().toLowerCase();
      if (mode === 'login') {
        await login(normalizedEmail, password);
        router.push('/dashboard');
        return;
      }

      // signup: stage the registration in Redis and send an OTP. The
      // `users` row + auth cookies are NOT created here — that happens
      // only after the OTP is verified in submitOtp(). If the user
      // typo'd their email, they can hit the X / "Use a different
      // email" button and the pending entry expires harmlessly.
      await api.post('/auth/register/start', {
        email: normalizedEmail,
        password,
        first_name: 'New',
        last_name: 'Trader',
        ...(referralCode ? { referral_code: referralCode } : {}),
      });
      toast.success('Verification code sent. Check your email.');
      setStep('otp');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const submitOtp = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return; // double-click guard
    const code = otp.replace(/\D/g, '');
    if (code.length !== 6) {
      setErrors({ otp: 'Enter the 6-digit code.' });
      return;
    }
    setErrors({});
    try {
      setSubmitting(true);
      // This is now the ONLY step that actually creates the user row
      // and issues auth cookies. The response sets the cookies via
      // Set-Cookie; refreshUser() then hydrates the trader store.
      await api.post('/auth/register/verify', {
        email: email.trim().toLowerCase(),
        otp: code,
      });
      await refreshUser();
      toast.success(`Email verified. Welcome to ${brand.name}.`);
      router.push('/dashboard');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid or expired code.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  /** Back out of the OTP step. Tells the server to drop the pending
   *  registration so the address is freed immediately (otherwise it
   *  Redis-TTLs out in 10 minutes), then returns to the credentials
   *  form so the user can fix a typo. Errors are swallowed — the
   *  Redis key will expire even if the cancel call fails. */
  const cancelPendingRegistration = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail) {
      try {
        await api.post('/auth/register/cancel', { email: normalizedEmail });
      } catch {
        /* ignore — TTL will handle it */
      }
    }
    setOtp('');
    setErrors({});
    setStep('credentials');
  };

  const handleDemo = async () => {
    try {
      setSubmitting(true);
      await demoLogin();
      toast.success(`Demo account ready. Welcome to ${brand.name}.`);
      router.push('/dashboard');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not start a demo session.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const resendOtp = async () => {
    if (submitting) return; // double-click guard
    try {
      setSubmitting(true);
      await api.post('/auth/register/resend', { email: email.trim().toLowerCase() });
      toast.success('Code resent.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not send code.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center overflow-hidden bg-[#FAFAFA] p-4">
      <div className="w-full relative max-w-5xl rounded-3xl overflow-hidden flex flex-col md:flex-row shadow-2xl ring-1 ring-black/5">
        {/* Decorative orange ball + blurred bands behind the left panel */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-t from-transparent to-black/60" />
          <div className="absolute -bottom-12 -left-8 w-60 h-60 bg-[#E94E1B] rounded-full opacity-90" />
          <div className="absolute -bottom-6 left-32 w-32 h-20 bg-white rounded-full opacity-90 blur-2xl" />
          <div className="absolute bottom-2 left-12 w-32 h-20 bg-white rounded-full opacity-70 blur-xl" />
        </div>

        {/* Left dark hero panel */}
        <div className="bg-black text-white p-8 md:p-12 md:w-1/2 relative overflow-hidden z-10 flex flex-col justify-between min-h-[20rem] md:min-h-[36rem]">
          <Link
            href="/"
            aria-label={`${brand.name} home`}
            className="inline-flex items-center self-start relative z-10 bg-white/95 rounded-lg px-3 py-1.5"
          >
            {brand.isWhiteLabel ? (
              brand.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={brand.logoUrl}
                  alt={brand.name}
                  className="h-8 w-auto max-w-[180px] object-contain"
                />
              ) : (
                <span className="font-bold tracking-tight text-lg text-[#0A0A0A] select-none">
                  {brand.name}
                </span>
              )
            ) : (
              <Image
                src="/marketing/swisscresta-logo.png"
                alt="SwissCresta"
                width={220}
                height={48}
                priority
                className="h-8 w-auto"
              />
            )}
          </Link>
          <h1 className="text-2xl md:text-3xl font-medium leading-tight tracking-tight relative z-10">
            {copy.hero}
          </h1>
        </div>

        {/* Right form panel */}
        <div className="p-8 md:p-12 md:w-1/2 flex flex-col bg-white text-[#0A0A0A] relative z-20">
          {step === 'credentials' && (
            <>
              <div className="mb-8">
                <p className="text-sm uppercase tracking-wider text-[#E94E1B] font-semibold mb-3">
                  {copy.eyebrow}
                </p>
                <h2 className="text-3xl font-medium mb-2 tracking-tight">{copy.title}</h2>
                <p className="text-[#5B5B5B]">{copy.subtitle}</p>
              </div>

              <form className="flex flex-col gap-4" onSubmit={submitCredentials} noValidate>
                <Field
                  id="email"
                  label="Email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={setEmail}
                  error={errors.email}
                />

                <Field
                  id="password"
                  label={mode === 'signup' ? 'Create password' : 'Password'}
                  type="password"
                  revealable
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  placeholder={mode === 'signup' ? 'At least 8 characters' : ''}
                  value={password}
                  onChange={setPassword}
                  error={errors.password}
                  rightSlot={
                    mode === 'login' ? (
                      <Link
                        href="/auth/reset-password"
                        className="text-xs text-[#5B5B5B] hover:text-[#E94E1B] transition-colors"
                      >
                        Forgot password?
                      </Link>
                    ) : null
                  }
                />

                {mode === 'signup' && <PasswordStrengthMeter password={password} />}

                {mode === 'signup' && (
                  <Field
                    id="confirm-password"
                    label="Confirm password"
                    type="password"
                    revealable
                    autoComplete="new-password"
                    placeholder="Re-type your password"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    error={errors.confirmPassword}
                  />
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-[#E94E1B] hover:bg-[#C73E11] disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2.5 px-4 rounded-lg transition-colors inline-flex items-center justify-center gap-2 mt-2"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {submitting ? 'Please wait…' : copy.cta}
                </button>

                <div className="flex items-center gap-3 my-1">
                  <span className="flex-1 h-px bg-[#E5E5E5]" aria-hidden />
                  <span className="text-xs uppercase tracking-wider text-[#9A9A9A]">or</span>
                  <span className="flex-1 h-px bg-[#E5E5E5]" aria-hidden />
                </div>

                <button
                  type="button"
                  onClick={handleDemo}
                  disabled={submitting}
                  className="w-full bg-white hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed border border-[#E5E5E5] text-[#0A0A0A] font-medium py-2.5 px-4 rounded-lg transition-colors inline-flex items-center justify-center gap-2"
                >
                  Try with demo
                </button>

                <div className="text-center text-[#5B5B5B] text-sm">
                  {copy.switchPrompt}{' '}
                  <Link
                    href={copy.switchHref}
                    className="text-[#0A0A0A] font-medium underline underline-offset-2 hover:text-[#E94E1B]"
                  >
                    {copy.switchLink}
                  </Link>
                </div>
              </form>
            </>
          )}

          {step === 'otp' && (
            <>
              {/* Prominent close — lets the user back out of the OTP
                  step if they typo'd their email. Wired to cancel the
                  pending registration server-side so the address is
                  freed immediately, then drops them back on the
                  credentials form with their previous email pre-filled
                  for quick editing. */}
              <button
                type="button"
                onClick={cancelPendingRegistration}
                aria-label="Close verification — use a different email"
                className="absolute top-4 right-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full text-[#5B5B5B] hover:text-[#0A0A0A] hover:bg-[#F0F0F0] transition-colors"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="mb-8">
                <p className="text-sm uppercase tracking-wider text-[#E94E1B] font-semibold mb-3">
                  Verify your email
                </p>
                <h2 className="text-3xl font-medium mb-2 tracking-tight">Enter the code</h2>
                <p className="text-[#5B5B5B]">
                  We sent a 6-digit code to <span className="font-medium text-[#0A0A0A]">{email}</span>.
                </p>
              </div>

              <form className="flex flex-col gap-4" onSubmit={submitOtp} noValidate>
                <Field
                  id="otp"
                  label="Verification code"
                  type="text"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  placeholder="123456"
                  value={otp}
                  onChange={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))}
                  error={errors.otp}
                  maxLength={6}
                />

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-[#E94E1B] hover:bg-[#C73E11] disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2.5 px-4 rounded-lg transition-colors inline-flex items-center justify-center gap-2 mt-2"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {submitting ? 'Verifying…' : 'Verify and continue'}
                </button>

                <div className="flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={cancelPendingRegistration}
                    className="text-[#5B5B5B] hover:text-[#0A0A0A] transition-colors"
                  >
                    ← Use a different email
                  </button>
                  <button
                    type="button"
                    onClick={resendOtp}
                    className="text-[#0A0A0A] font-medium hover:text-[#E94E1B] transition-colors"
                  >
                    Resend code
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FullScreenSignup;

/* ────────────────────────────────────────────────────────────────────── */

interface FieldProps {
  id: string;
  label: string;
  type: string;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  placeholder?: string;
  value: string;
  onChange: (next: string) => void;
  error?: string;
  rightSlot?: React.ReactNode;
  maxLength?: number;
  /** Password fields: render an eye toggle that reveals/hides the value. */
  revealable?: boolean;
}

function Field({
  id, label, type, autoComplete, inputMode, placeholder,
  value, onChange, error, rightSlot, maxLength, revealable,
}: FieldProps) {
  const [revealed, setRevealed] = useState(false);
  const effectiveType = revealable && revealed ? 'text' : type;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label htmlFor={id} className="block text-sm text-[#0A0A0A]">
          {label}
        </label>
        {rightSlot}
      </div>
      <div className="relative">
        <input
          type={effectiveType}
          id={id}
          autoComplete={autoComplete}
          inputMode={inputMode}
          maxLength={maxLength}
          placeholder={placeholder}
          className={`text-sm w-full py-2.5 px-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E94E1B]/20 bg-white text-black transition-colors ${
            revealable ? 'pr-10' : ''
          } ${error ? 'border-red-500' : 'border-[#E5E5E5] focus:border-[#E94E1B]'}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        {revealable && (
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            tabIndex={-1}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-[#9A9A9A] hover:text-[#0A0A0A] transition-colors"
          >
            {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} className="text-red-500 text-xs mt-1">
          {error}
        </p>
      )}
    </div>
  );
}

/* Live strength meter for the signup password: 4-segment bar coloured by
   score, the score label, and the specific unmet requirements. */
function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) return null;
  const s = scorePassword(password);
  const segColors = ['#EF4444', '#EF4444', '#F59E0B', '#84CC16', '#22C55E'];
  const color = segColors[s.score];
  return (
    <div className="-mt-2" aria-live="polite">
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4].map((seg) => (
          <span
            key={seg}
            className="h-1 flex-1 rounded-full transition-colors"
            style={{ backgroundColor: s.score >= seg ? color : '#E5E5E5' }}
          />
        ))}
        <span className="text-xs ml-1 shrink-0" style={{ color: s.score >= 2 ? color : '#EF4444' }}>
          {s.label}
        </span>
      </div>
      {s.issues.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {s.issues.map((issue) => (
            <li key={issue} className="text-xs text-[#9A9A9A] flex items-start gap-1.5">
              <span className="text-[#EF4444] leading-4">•</span>
              {issue}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
