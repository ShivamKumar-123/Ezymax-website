'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import { Eye, EyeOff, Loader2, Check, Lock, Mail, Star, X } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
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

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterContent />
    </Suspense>
  );
}

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { register, demoLogin, isLoading } = useAuthStore();
  const [demoLoading, setDemoLoading] = useState(false);

  const handleDemo = async () => {
    setDemoLoading(true);
    try {
      await demoLogin();
      toast.success('Welcome — demo account');
      router.push('/accounts');
    } catch (err: any) {
      toast.error(err?.message || 'Demo sign-in failed');
    } finally {
      setDemoLoading(false);
    }
  };

  const [form, setForm] = useState({
    email: '', password: '', confirmPassword: '',
    first_name: '', last_name: '', phone: '', referral_code: '',
  });
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) setForm((prev) => ({ ...prev, referral_code: ref }));
  }, [searchParams]);

  const update = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e: Record<string, string> = {};
    if (!form.first_name.trim()) e.first_name = 'First name is required.';
    if (!form.last_name.trim()) e.last_name = 'Last name is required.';
    if (!form.email.includes('@') || !form.email.includes('.')) e.email = 'Please enter a valid email address.';
    if (!form.phone.trim()) {
      e.phone = 'Phone number is required.';
    } else if (!/^\+?[0-9 \-()]{6,20}$/.test(form.phone.trim())) {
      e.phone = 'Please enter a valid phone number.';
    }
    if (!pwChecks.length) e.password = 'Password must be at least 8 characters.';
    else if (pwCommon) e.password = 'This password is too common and easy to guess. Please choose a stronger one.';
    else if (pwVariety < 2) e.password = 'Use a mix of letters, numbers or symbols — not just one type.';
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match.';
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setLoading(true);
    try {
      await register({
        email: form.email,
        password: form.password,
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone.trim(),
        referral_code: form.referral_code || undefined,
      });
      toast.success('Account created successfully!');
      router.push('/accounts');
    } catch (err: any) {
      toast.error(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  /* ── Password strength & policy ──────────────────────────────────────
     Length alone isn't enough — "12345678" is 8 chars but trivially weak.
     We grade on character variety and block common passwords so users
     can't register with "123456" / "password" etc. */
  const pwd = form.password;
  const pwChecks = {
    length: pwd.length >= 8,
    lower: /[a-z]/.test(pwd),
    upper: /[A-Z]/.test(pwd),
    number: /[0-9]/.test(pwd),
    symbol: /[^A-Za-z0-9]/.test(pwd),
  };
  const pwVariety = [pwChecks.lower, pwChecks.upper, pwChecks.number, pwChecks.symbol].filter(Boolean).length;
  const COMMON_PASSWORDS = [
    '123456', '1234567', '12345678', '123456789', '1234567890', '12345',
    'password', 'password1', 'passw0rd', 'qwerty', 'qwerty123', 'abc123',
    '111111', '000000', 'iloveyou', 'admin', 'welcome', 'letmein', 'monkey',
  ];
  const pwCommon = pwd.length > 0 && COMMON_PASSWORDS.includes(pwd.toLowerCase());
  // Minimum policy to allow registration.
  const pwValid = pwChecks.length && pwVariety >= 2 && !pwCommon;
  // 0 empty · 1 weak · 2 fair · 3 good · 4 strong
  const strength = (() => {
    if (pwd.length === 0) return 0;
    if (!pwValid) return 1;
    if (pwd.length >= 12 && pwVariety >= 3) return 4;
    if (pwd.length >= 10 && pwVariety >= 3) return 3;
    return 2;
  })();
  const strengthColors = ['#ef4444', '#f59e0b', '#22c55e', '#5f7800'];
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strength];

  return (
    <MotionConfig reducedMotion="always">
    <div className="auth-wrapper">
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
                  Open your account in{' '}
                  <span className="auth-brand__uword">minutes.</span>
                </motion.h1>
                <motion.p className="auth-brand__support" {...fadeUp(0.4)}>
                  Connect a wallet or an email, allocate into the trading
                  contract, and only your margin ever locks.
                </motion.p>

                <motion.figure className="auth-quote" {...fadeUp(0.5)}>
                  <div className="auth-quote__stars" aria-hidden="true">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Star key={i} size={14} fill="currentColor" />
                    ))}
                  </div>
                  <blockquote className="auth-quote__text">
                    &ldquo;Signed up, allocated, first trade — before my coffee
                    went cold.&rdquo;
                  </blockquote>
                  <figcaption className="auth-quote__who">
                    <span className="auth-quote__avatar">MK</span>
                    <span>
                      <span className="auth-quote__name">M. Kaur</span>
                      <br />
                      <span className="auth-quote__role">Swing trader · demo community</span>
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
              Have an account?{' '}
              <a onClick={() => router.push('/auth/login')}>Sign in</a>
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key="signup"
                variants={formVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.28, ease: 'easeInOut' }}
                style={{ width: '100%', maxWidth: 380 }}
              >
                <form className="auth-form" onSubmit={handleSubmit} noValidate>
                  <motion.div {...fadeUp(0.25)}>
                    <h2 className="auth-form__title">Create your account</h2>
                    <p className="auth-form__subtitle">Start trading in minutes.</p>
                  </motion.div>

                  <motion.div className="auth-sso" {...fadeUp(0.3)}>
                    <GoogleAuthButton disabled={loading || isLoading || demoLoading} />
                    <ConnectWalletButton
                      variant="login"
                      disabled={loading || isLoading || demoLoading}
                    />
                  </motion.div>

                  <motion.div className="auth-divider" {...fadeUp(0.34)}>
                    <span className="auth-divider__line" />
                    <span className="auth-divider__text">or continue with email</span>
                    <span className="auth-divider__line" />
                  </motion.div>

                  <motion.div className="auth-name-row" {...fadeUp(0.37)}>
                    <AuthInput
                      label="First Name"
                      placeholder="eg. John"
                      value={form.first_name}
                      onChange={(e) => update('first_name', e.target.value)}
                      error={errors.first_name}
                    />
                    <AuthInput
                      label="Last Name"
                      placeholder="eg. Francisco"
                      value={form.last_name}
                      onChange={(e) => update('last_name', e.target.value)}
                      error={errors.last_name}
                    />
                  </motion.div>

                  <motion.div {...fadeUp(0.44)}>
                    <AuthInput
                      label="Email address"
                      type="email"
                      placeholder="you@example.com"
                      value={form.email}
                      onChange={(e) => update('email', e.target.value)}
                      error={errors.email}
                      leftIcon={<Mail size={16} />}
                    />
                  </motion.div>

                  <motion.div {...fadeUp(0.5)}>
                    <AuthInput
                      label="Phone"
                      type="tel"
                      placeholder="+91 9876543210"
                      value={form.phone}
                      onChange={(e) => update('phone', e.target.value)}
                      error={errors.phone}
                    />
                  </motion.div>

                  <motion.div {...fadeUp(0.56)}>
                    <AuthInput
                      label="Referral Code (optional)"
                      placeholder="Enter code"
                      value={form.referral_code}
                      onChange={(e) => update('referral_code', e.target.value)}
                    />
                  </motion.div>

                  <motion.div {...fadeUp(0.62)}>
                    <AuthInput
                      label="Password"
                      type={showPass ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={form.password}
                      onChange={(e) => update('password', e.target.value)}
                      error={errors.password}
                      helper={strength > 0 ? undefined : 'Use 8+ characters with a mix of letters, numbers or symbols.'}
                      leftIcon={<Lock size={16} />}
                      rightIcon={showPass ? <Eye size={18} /> : <EyeOff size={18} />}
                      onIconClick={() => setShowPass(!showPass)}
                    />
                    {strength > 0 && (
                      <>
                        <div className="auth-strength" style={{ marginTop: 6 }}>
                          {[1, 2, 3, 4].map((i) => (
                            <div
                              key={i}
                              className="auth-strength__bar"
                              style={{ background: i <= strength ? strengthColors[strength - 1] : undefined }}
                            />
                          ))}
                        </div>
                        <div
                          style={{
                            marginTop: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            color: strengthColors[strength - 1],
                          }}
                        >
                          {pwCommon ? 'Too common — easily guessed' : `Password strength: ${strengthLabel}`}
                        </div>
                        <ul style={{ marginTop: 6, display: 'grid', gap: 3, listStyle: 'none', padding: 0 }}>
                          {[
                            { ok: pwChecks.length, text: 'At least 8 characters' },
                            { ok: pwVariety >= 2, text: 'Mix of letters, numbers or symbols' },
                            { ok: !pwCommon, text: 'Not a common password' },
                          ].map((req) => (
                            <li
                              key={req.text}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                fontSize: 12,
                                color: req.ok ? '#22c55e' : 'rgba(148,163,184,0.9)',
                              }}
                            >
                              {req.ok ? <Check size={13} /> : <X size={13} />}
                              {req.text}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </motion.div>

                  <motion.div {...fadeUp(0.68)}>
                    <AuthInput
                      label="Confirm Password"
                      type={showConfirmPass ? 'text' : 'password'}
                      placeholder="Re-enter password"
                      value={form.confirmPassword}
                      onChange={(e) => update('confirmPassword', e.target.value)}
                      error={errors.confirmPassword}
                      rightIcon={showConfirmPass ? <Eye size={18} /> : <EyeOff size={18} />}
                      onIconClick={() => setShowConfirmPass(!showConfirmPass)}
                    />
                  </motion.div>

                  <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.72, duration: 0.4 }}>
                    <button type="submit" className="auth-btn" disabled={loading || isLoading}>
                      {(loading || isLoading) ? <Loader2 size={18} className="auth-spinner" /> : 'Sign Up'}
                    </button>
                  </motion.div>

                  <motion.div {...fadeUp(0.76)}>
                    <button
                      type="button"
                      onClick={handleDemo}
                      disabled={demoLoading || isLoading}
                      className="auth-btn auth-btn--outline"
                    >
                      {demoLoading ? <Loader2 size={18} className="auth-spinner" /> : 'Try with Demo Account'}
                    </button>
                  </motion.div>

                  <motion.p className="auth-footer" {...fadeUp(0.78)}>
                    Already have an account?{' '}
                    <a onClick={() => router.push('/auth/login')}>Sign in</a>
                  </motion.p>

                  <motion.p className="auth-legal" {...fadeUp(0.8)}>
                    By creating an account, you agree to our{' '}
                    <a href="/risk">Risk Disclosure</a> and{' '}
                    <a href="/privacy">Privacy Policy</a>.
                  </motion.p>
                </form>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
    </MotionConfig>
  );
}
