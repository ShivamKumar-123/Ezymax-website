'use client';

import { BRAND_NAME } from '@/lib/brand';
import { BrandLogo } from '@/components/BrandLogo';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import toast from 'react-hot-toast';
import GoogleAuthButton from '@/components/auth/GoogleAuthButton';
import { AuthLeftPanel } from '@/components/auth/AuthLeftPanel';
// import ConnectWalletButton from '@/components/auth/ConnectWalletButton'; // Re-enable when wallet login goes live
import PhoneInput from '@/components/forms/PhoneInput';
import TurnstileWidget from '@/components/forms/TurnstileWidget';
import { scorePassword, PASSWORD_REQUIREMENTS } from '@/lib/passwordPolicy';
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

/* ── Input Field ── */
function AuthInput({
  label, type = 'text', placeholder, value, onChange, error, helper, rightIcon, onIconClick,
}: {
  label: string; type?: string; placeholder?: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string; helper?: string; rightIcon?: React.ReactNode; onIconClick?: () => void;
}) {
  return (
    <div className="auth-field">
      <label className="auth-field__label">{label}</label>
      <div className="auth-field__wrap">
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
  // Cloudflare Turnstile token, set when the widget solves the challenge.
  // Backend rejects the register call with HTTP 400 if SECRET is
  // configured AND this is empty/invalid; the widget short-circuits and
  // emits '' when no NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY is set
  // (dev mode) so the form keeps working without keys.
  const [turnstileToken, setTurnstileToken] = useState('');
  // Bumped on captcha-related submit failures so the TurnstileWidget
  // remounts and Cloudflare issues a fresh challenge. Combined with the
  // widget's own expired/error auto-reset it covers both the
  // user-took-too-long and the click-immediately-after-expiry timing
  // windows without forcing a page reload.
  const [turnstileNonce, setTurnstileNonce] = useState(0);
  // Terms & Conditions / Privacy / Risk Disclaimer agreement. Required
  // before the Sign Up button can submit — gives the user an explicit
  // opt-in for the legal pages they're agreeing to. Unchecked by default
  // so consent is affirmative, not pre-ticked.
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Company / 'House' IB referral code, fetched once on mount. Powers the
  // 'Apply' shortcut on the referral input so an unreferred signup still
  // lands under the broker's own IB code.
  const [companyIbCode, setCompanyIbCode] = useState<string | null>(null);
  /* Referral is optional and most signups have no code, so the field stays
     folded behind a one-line link rather than occupying a labelled input
     plus an Apply button plus two lines of helper text on first paint. It
     opens on its own when a ?ref= link pre-filled a code. */
  const [referralOpen, setReferralOpen] = useState(false);

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) setForm((prev) => ({ ...prev, referral_code: ref }));
  }, [searchParams]);

  // "Try free demo" CTAs link here with ?type=demo: start the demo session
  // straight away instead of showing the blank signup form.
  const demoAuto = useRef(false);
  useEffect(() => {
    if (searchParams.get('type') === 'demo' && !demoAuto.current) {
      demoAuto.current = true;
      void handleDemo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    // Same-origin call to the public endpoint — no auth header needed.
    // Silent failure: a missing/disabled company IB just leaves the
    // Apply button as a no-op, the input still works for typed codes.
    (async () => {
      try {
        const res = await fetch('/api/v1/auth/company-ib-code', { credentials: 'omit' });
        if (!res.ok) return;
        const data = await res.json();
        if (data && typeof data.referral_code === 'string') {
          setCompanyIbCode(data.referral_code);
        }
      } catch { /* offline / blocked — fall through */ }
    })();
  }, []);

  const applyCompanyIb = () => {
    if (!companyIbCode) {
      toast.error('No house referral code is configured. Ask support for a code.');
      return;
    }
    setForm((prev) => ({ ...prev, referral_code: companyIbCode }));
    toast.success(`Applied ${companyIbCode} — house referral code added to your signup.`);
  };

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
    // Password is validated against the shared policy (passwordPolicy.ts) —
    // length + character classes + not-in-common-list + not-like-email.
    // The `disallow` list seeds substring checks so users can't reuse their
    // email local-part or first name as the password.
    const pwCheck = scorePassword(form.password, [
      form.email.split('@')[0] || '',
      form.first_name,
      form.last_name,
    ]);
    if (!pwCheck.acceptable) {
      e.password = pwCheck.issues[0] || 'Password is too weak — pick a stronger one.';
    }
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match.';
    if (!agreedToTerms) e.terms = 'You must agree to the Terms & Conditions and Privacy Policy.';
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
        // Forwarded to Cloudflare siteverify on the backend. Empty
        // string is fine when no site key is configured — server-side
        // verifier short-circuits the same way (dev parity).
        cf_turnstile_token: turnstileToken || undefined,
      });
      // Account created. The backend does NOT issue session cookies here
      // — the user has to click the verify link in their inbox, which is
      // the only path that grants a session. Bounce to /auth/check-email
      // so the user knows to check their inbox.
      toast.success('Account created — check your email to verify and sign in.');
      router.push(`/auth/check-email?email=${encodeURIComponent(form.email)}`);
    } catch (err: any) {
      const msg = err?.message || 'Registration failed';
      toast.error(msg);
      // If the rejection mentions CAPTCHA, force a fresh widget so
      // the user can re-submit without reloading the entire form.
      if (/captcha/i.test(msg)) {
        setTurnstileToken('');
        setTurnstileNonce((n) => n + 1);
      }
    } finally {
      setLoading(false);
    }
  };

  /* password strength — uses the shared policy module so the meter agrees
     with the submit-time validation and with the server-side check.   */
  const pwCheck = scorePassword(form.password, [
    form.email.split('@')[0] || '',
    form.first_name,
    form.last_name,
  ]);
  const strength = pwCheck.score;
  const missingRequirements = PASSWORD_REQUIREMENTS.filter((r) => !pwCheck.checks[r.id]);

  return (
    <MotionConfig reducedMotion="always">
    <div className="auth-wrapper">
      <div className="auth-card-wrapper">
        <div className="auth-card">
          {/* ── LEFT PANEL ── */}
          <AuthLeftPanel />

          {/* ── RIGHT PANEL ── */}
          <div className="auth-right auth-right--top">
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
                  <motion.div {...fadeUp(0.25)} className="mb-1">
                    {/* Pinned to ink — see the note on the login page. */}
                    <BrandLogo tone="ink" className="h-9 w-auto object-contain" />
                  </motion.div>
                  <motion.div {...fadeUp(0.3)}>
                    <h2 className="auth-form__title">Get Started</h2>
                    <p className="auth-form__subtitle">
                      Already have an account?{' '}
                      <Link href="/auth/login" className="auth-inline-link">Sign in</Link>
                    </p>
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
                      label="Email"
                      type="email"
                      placeholder=""
                      value={form.email}
                      onChange={(e) => update('email', e.target.value)}
                      error={errors.email}
                    />
                  </motion.div>

                  <motion.div {...fadeUp(0.5)}>
                    <div className="auth-field">
                      <label className="auth-field__label">Phone</label>
                      <PhoneInput
                        value={form.phone}
                        onChange={(v) => update('phone', v)}
                        defaultCountry="IN"
                        placeholder=""
                        hasError={!!errors.phone}
                      />
                      {errors.phone && (
                        <span className="auth-field__error">{errors.phone}</span>
                      )}
                    </div>
                  </motion.div>

                  <motion.div {...fadeUp(0.56)}>
                    {/*
                     * Referral input + Apply shortcut, folded away until
                     * asked for. Apply pulls the company / house IB code so
                     * an unreferred user is still attributed. A ?ref=<code>
                     * link pre-fills the input via the useEffect above,
                     * which also forces the row open.
                     */}
                    {!referralOpen && !form.referral_code ? (
                      <button
                        type="button"
                        className="auth-reveal"
                        onClick={() => setReferralOpen(true)}
                      >
                        Have a referral code?
                      </button>
                    ) : (
                      <div className="auth-field">
                        <label className="auth-field__label">
                          Referral Code (optional)
                        </label>
                        <div className="auth-field__wrap" style={{ display: 'flex', gap: '0.5rem' }}>
                          <input
                            className="auth-field__input"
                            type="text"
                            placeholder="Enter code"
                            value={form.referral_code}
                            onChange={(e) => update('referral_code', e.target.value)}
                            style={{ flex: 1 }}
                            /* Focus only when the trader opened the row
                               themselves — a ?ref= link renders it already
                               open, and stealing focus on load would scroll
                               the form past the name fields. */
                            autoFocus={referralOpen}
                          />
                          <button
                            type="button"
                            onClick={applyCompanyIb}
                            className="auth-apply-btn"
                            disabled={!companyIbCode}
                            title={
                              companyIbCode
                                ? 'Apply the platform house referral code'
                                : 'No house code configured'
                            }
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>

                  <motion.div {...fadeUp(0.62)}>
                    <AuthInput
                      label="Password"
                      type={showPass ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={form.password}
                      onChange={(e) => update('password', e.target.value)}
                      error={errors.password}
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
                              style={{ background: i <= strength ? pwCheck.color : undefined }}
                            />
                          ))}
                        </div>
                        <div
                          style={{
                            marginTop: 4, fontSize: 11, fontWeight: 600,
                            color: pwCheck.color,
                          }}
                        >
                          {pwCheck.label}
                        </div>
                        {/* Only what is still missing. The six-line ✓/○
                            checklist this replaced restated every rule on
                            every keystroke, including the ones already
                            satisfied — four fifths of it was noise. */}
                        {!pwCheck.acceptable && missingRequirements.length > 0 && (
                          <p className="auth-field__helper" style={{ marginTop: 4 }}>
                            Still needed: {missingRequirements.map((r) => r.label).join(' · ')}
                          </p>
                        )}
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

                  {/* Cloudflare Turnstile — quietly verifies that a real
                      browser is filling the form. Mostly invisible to real
                      users (Cloudflare's heuristic check passes most of the
                      time without any UI). Renders nothing if no site key
                      is configured in env. */}
                  <motion.div {...fadeUp(0.7)} style={{ marginTop: 4 }}>
                    <TurnstileWidget key={turnstileNonce} onToken={setTurnstileToken} />
                  </motion.div>

                  {/* Terms & Conditions / Privacy consent. Required —
                      submit button stays disabled until checked, and
                      submit-time validation surfaces an inline error if
                      somehow bypassed. Styled via .auth-terms in auth.css
                      so the colours match the rest of the form (green
                      accent, dark themed border, no clashing blue links). */}
                  <motion.div {...fadeUp(0.71)} style={{ marginTop: 4 }}>
                    <label className="auth-terms">
                      <input
                        type="checkbox"
                        className="auth-terms__checkbox"
                        checked={agreedToTerms}
                        onChange={(e) => {
                          setAgreedToTerms(e.target.checked);
                          if (e.target.checked) setErrors((prev) => ({ ...prev, terms: '' }));
                        }}
                      />
                      <span className="auth-terms__text">
                        I agree to the{' '}
                        <a
                          href="/terms"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="auth-terms__link"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Terms &amp; Conditions
                        </a>
                        {' '}and{' '}
                        <a
                          href="/privacy"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="auth-terms__link"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Privacy Policy
                        </a>
                        .
                      </span>
                    </label>
                    {errors.terms && (
                      <span className="auth-terms__error">{errors.terms}</span>
                    )}
                  </motion.div>

                  <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.72, duration: 0.4 }}>
                    <button
                      type="submit"
                      className="auth-btn"
                      disabled={loading || isLoading || !agreedToTerms}
                    >
                      {(loading || isLoading) ? <Loader2 size={18} className="auth-spinner" /> : 'Sign Up'}
                    </button>
                  </motion.div>

                  <motion.div className="auth-divider" {...fadeUp(0.74)}>
                    <span className="auth-divider__line" />
                    <span className="auth-divider__text">or</span>
                    <span className="auth-divider__line" />
                  </motion.div>

                  <motion.div {...fadeUp(0.75)}>
                    <GoogleAuthButton disabled={loading || isLoading || demoLoading} />
                  </motion.div>

                  {/* Connect wallet — hidden for now, will re-enable when wallet login is ready.
                     <motion.div {...fadeUp(0.755)}>
                       <ConnectWalletButton
                         variant="login"
                         disabled={loading || isLoading || demoLoading}
                       />
                     </motion.div> */}

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
