'use client';

import { Suspense, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import { useEffect } from 'react';
import { AlertTriangle, Eye, EyeOff, Loader2, Lock, Mail, Star } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { usePlatformStatusStore } from '@/stores/platformStatusStore';
import toast from 'react-hot-toast';
import GoogleAuthButton from '@/components/auth/GoogleAuthButton';
import ConnectWalletButton from '@/components/auth/ConnectWalletButton';
import '../auth.css';

/* ── animation helpers ── */
const fadeUp = (delay: number) => ({
  initial: { y: 16, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  transition: { delay, duration: 0.45, ease: 'easeOut' as const },
});

const formVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
};

/* ── brand-panel copy (flat split-screen design) ── */
const TRUST_MARKS = ['NOVAQUANT', 'HELIXFX', 'MERIDIAN', 'OAKBRIDGE'];

/* ── error helper ── */
function authErrorMessage(err: unknown, kind: 'login' | 'demo' | 'forgot'): string {
  const raw = err instanceof Error ? err.message.trim() : 'Something went wrong.';
  const lower = raw.toLowerCase();
  if (kind === 'login' && (raw === 'Invalid credentials' || lower === 'invalid credentials'))
    return 'The email or password you entered is incorrect.';
  if (lower.includes('invalid 2fa'))
    return 'The verification code is incorrect or expired.';
  return raw;
}

/* ── Input Field ── */
function AuthInput({
  label, type = 'text', placeholder, value, onChange, error, helper, leftIcon, rightIcon, onIconClick,
}: {
  label: string; type?: string; placeholder?: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string; helper?: string; leftIcon?: React.ReactNode; rightIcon?: React.ReactNode; onIconClick?: () => void;
}) {
  return (
    <div className="auth-field">
      <label className="auth-field__label">{label}</label>
      <div className="auth-field__wrap">
        {leftIcon && <span className="auth-field__lead">{leftIcon}</span>}
        <input
          className={`auth-field__input${rightIcon ? ' auth-field__input--has-icon' : ''}${error ? ' auth-field__input--error' : ''}`}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          autoComplete={type === 'email' ? 'email' : type === 'password' ? 'current-password' : undefined}
        />
        {rightIcon && (
          <button type="button" className="auth-field__icon" onClick={onIconClick}>{rightIcon}</button>
        )}
      </div>
      {error && <span className="auth-field__error">{error}</span>}
      {!error && helper && <span className="auth-field__helper">{helper}</span>}
    </div>
  );
}

/* ═══════ PAGE ═══════ */
export default function LoginPage() {
  const router = useRouter();
  const { login, demoLogin, forgotPassword, isLoading } = useAuthStore();
  const [activeStep, setActiveStep] = useState(1);

  /* Sign-in state */
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [need2FA, setNeed2FA] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  /* Demo state */
  const [demoLoading, setDemoLoading] = useState(false);

  /* Forgot state */
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSending, setForgotSending] = useState(false);

  /* Error dialog */
  const [errorDialog, setErrorDialog] = useState<{ title: string; message: string } | null>(null);

  /* Platform maintenance status */
  const maintenance = usePlatformStatusStore((s) => s.maintenance_mode);
  const fetchStatus = usePlatformStatusStore((s) => s.fetch);
  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 15000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  /* ── Sign-in handler ── */
  const handleSignIn = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e: Record<string, string> = {};
    if (!email.includes('@') || !email.includes('.')) e.email = 'Please enter a valid email address.';
    if (password.length < 8) e.password = 'Password must be at least 8 characters.';
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setLoading(true);
    try {
      await login(email, password, totpCode || undefined);
      toast.success('Welcome back!');
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('2FA') && !msg.includes('Invalid')) {
        setNeed2FA(true);
      } else {
        setErrorDialog({ title: 'Sign-in failed', message: authErrorMessage(err, 'login') });
      }
    } finally {
      setLoading(false);
    }
  };

  /* ── Demo handler ── */
  const handleDemo = async () => {
    setDemoLoading(true);
    try {
      await demoLogin();
      toast.success('Welcome — demo account');
      router.push('/dashboard');
    } catch (err: unknown) {
      setErrorDialog({ title: 'Demo sign-in failed', message: authErrorMessage(err, 'demo') });
    } finally {
      setDemoLoading(false);
    }
  };

  /* ── Forgot handler ── */
  const handleForgot = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotSending(true);
    try {
      await forgotPassword(forgotEmail.trim());
      toast.success('Check your email for reset instructions.');
      setForgotOpen(false);
      setForgotEmail('');
    } catch (err: unknown) {
      setErrorDialog({ title: 'Error', message: authErrorMessage(err, 'forgot') });
    } finally {
      setForgotSending(false);
    }
  };

  /* ── Step change: 2 → go to register ── */
  const handleStepClick = (step: number) => {
    if (step === 2) {
      router.push('/auth/register');
      return;
    }
    setActiveStep(step);
  };

  return (
    <MotionConfig reducedMotion="always">
    <div className="auth-wrapper">
      {maintenance && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 100,
            background: 'linear-gradient(90deg, rgba(234,179,8,0.18), rgba(234,179,8,0.08))',
            borderBottom: '1px solid rgba(234,179,8,0.45)',
            color: '#fde68a',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontSize: 13,
            fontWeight: 500,
            backdropFilter: 'blur(6px)',
          }}
        >
          <AlertTriangle size={16} />
          Platform is under maintenance. Sign-in is temporarily disabled. Please check back soon.
        </div>
      )}
      <div className="auth-card-wrapper">
        <div className="auth-card">
          {/* ── LEFT PANEL ── */}
          <motion.div
            className="auth-left"
            initial={{ x: -60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          >
            <motion.div
              className="auth-left__bg"
              animate={{ scale: [1, 1.18, 1], y: [0, -20, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            />
            <div className="auth-left__mandala" aria-hidden="true" />
            <div className="auth-left__content">
              <motion.a className="auth-brand" href="/" {...fadeUp(0.15)}>
                <img src="/images/fxartha-logo.png" alt="" />
                FXARTHA
              </motion.a>

              <div>
                <motion.h1 className="auth-brand__headline" {...fadeUp(0.3)}>
                  Trade with your money still{' '}
                  <span className="auth-brand__uword">yours.</span>
                </motion.h1>
                <motion.p className="auth-brand__support" {...fadeUp(0.4)}>
                  Only margin locks when you open a trade — the rest stays
                  withdrawable, and settlement is automatic.
                </motion.p>

                <motion.figure className="auth-quote" {...fadeUp(0.5)}>
                  <div className="auth-quote__stars" aria-hidden="true">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Star key={i} size={14} fill="currentColor" />
                    ))}
                  </div>
                  <blockquote className="auth-quote__text">
                    &ldquo;The first platform where I never wonder whether I can
                    withdraw.&rdquo;
                  </blockquote>
                  <figcaption className="auth-quote__who">
                    <span className="auth-quote__avatar">AR</span>
                    <span>
                      <span className="auth-quote__name">A. Rao</span>
                      <br />
                      <span className="auth-quote__role">Derivatives trader · demo community</span>
                    </span>
                  </figcaption>
                </motion.figure>
              </div>

              <motion.div className="auth-trust" {...fadeUp(0.6)}>
                <p className="auth-trust__eyebrow">Trusted by modern trading desks</p>
                <div className="auth-trust__row">
                  {TRUST_MARKS.map((mark) => (
                    <span key={mark}>{mark}</span>
                  ))}
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* ── RIGHT PANEL ── */}
          <div className="auth-right">
            <div className="auth-topline">
              New here?{' '}
              <a onClick={() => router.push('/auth/register')}>Create account</a>
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeStep}
                variants={formVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.28, ease: 'easeInOut' }}
                style={{ width: '100%', maxWidth: 380 }}
              >
                {/* ── SIGN IN ── */}
                {activeStep === 1 && (
                  <form className="auth-form" onSubmit={handleSignIn} noValidate>
                    <motion.div {...fadeUp(0.25)}>
                      <h2 className="auth-form__title">Welcome back</h2>
                      <p className="auth-form__subtitle">Sign in to your account to continue.</p>
                    </motion.div>

                    <motion.div className="auth-sso" {...fadeUp(0.32)}>
                      <Suspense fallback={null}>
                        <GoogleAuthButton disabled={loading || isLoading || demoLoading || maintenance} />
                      </Suspense>
                      <ConnectWalletButton
                        variant="login"
                        disabled={loading || isLoading || demoLoading || maintenance}
                      />
                    </motion.div>

                    <motion.div className="auth-divider" {...fadeUp(0.36)}>
                      <span className="auth-divider__line" />
                      <span className="auth-divider__text">or continue with email</span>
                      <span className="auth-divider__line" />
                    </motion.div>

                    <motion.div {...fadeUp(0.4)}>
                      <AuthInput
                        label="Email address"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: '' })); }}
                        error={errors.email}
                        leftIcon={<Mail size={16} />}
                      />
                    </motion.div>

                    <motion.div {...fadeUp(0.45)}>
                      <AuthInput
                        label="Password"
                        type={showPass ? 'text' : 'password'}
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: '' })); }}
                        error={errors.password}
                        leftIcon={<Lock size={16} />}
                        rightIcon={showPass ? <Eye size={18} /> : <EyeOff size={18} />}
                        onIconClick={() => setShowPass(!showPass)}
                      />
                    </motion.div>

                    <motion.div className="auth-row" {...fadeUp(0.48)}>
                      <span />
                      <button
                        type="button"
                        onClick={() => { setForgotEmail(email); setForgotOpen(true); }}
                      >
                        Forgot password?
                      </button>
                    </motion.div>

                    {need2FA && (
                      <motion.div {...fadeUp(0.5)}>
                        <AuthInput
                          label="2FA Code"
                          type="text"
                          placeholder="000000"
                          value={totpCode}
                          onChange={(e) => setTotpCode(e.target.value)}
                        />
                      </motion.div>
                    )}

                    <motion.div initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.52, duration: 0.35 }}>
                      <button type="submit" className="auth-btn" disabled={loading || isLoading || maintenance}>
                        {(loading || isLoading) ? <Loader2 size={18} className="auth-spinner" /> : (maintenance ? 'Unavailable (Maintenance)' : 'Sign in')}
                      </button>
                    </motion.div>

                    <motion.div {...fadeUp(0.56)}>
                      <button
                        type="button"
                        onClick={handleDemo}
                        disabled={demoLoading || isLoading || maintenance}
                        className="auth-btn auth-btn--outline"
                      >
                        {demoLoading ? <Loader2 size={18} className="auth-spinner" /> : 'Try with Demo Account'}
                      </button>
                    </motion.div>

                    <motion.p className="auth-footer" {...fadeUp(0.6)}>
                      Don&apos;t have an account?{' '}
                      <a onClick={() => handleStepClick(2)}>Sign up</a>
                    </motion.p>

                    <motion.p className="auth-legal" {...fadeUp(0.62)}>
                      By signing in, you agree to our{' '}
                      <Link href="/risk">Risk Disclosure</Link> and{' '}
                      <Link href="/privacy">Privacy Policy</Link>.
                    </motion.p>
                  </form>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── Error Dialog ── */}
      {errorDialog && (
        <div className="auth-overlay" onClick={() => setErrorDialog(null)}>
          <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="auth-modal__title">{errorDialog.title}</h3>
            <p className="auth-modal__desc">{errorDialog.message}</p>
            <button type="button" className="auth-btn" onClick={() => setErrorDialog(null)}>OK</button>
          </div>
        </div>
      )}

      {/* ── Forgot Password Modal ── */}
      {forgotOpen && (
        <div className="auth-overlay" onClick={() => setForgotOpen(false)}>
          <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="auth-modal__title">Reset Password</h3>
            <p className="auth-modal__desc">Enter your email. If an account exists, we&apos;ll send reset instructions.</p>
            <form onSubmit={handleForgot}>
              <AuthInput
                label="Email"
                type="email"
                placeholder=""
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
              />
              <div className="auth-modal__actions">
                <button type="button" className="auth-btn auth-btn--outline" onClick={() => setForgotOpen(false)}>Cancel</button>
                <button type="submit" className="auth-btn" disabled={forgotSending}>
                  {forgotSending ? <Loader2 size={18} className="auth-spinner" /> : 'Send'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </MotionConfig>
  );
}
