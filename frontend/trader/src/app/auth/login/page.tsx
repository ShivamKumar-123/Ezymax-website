'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import toast from 'react-hot-toast';

function authErrorContent(err: unknown, kind: 'login' | 'demo' | 'forgot'): { title: string; message: string } {
  const raw = err instanceof Error ? err.message.trim() : 'Something went wrong. Please try again.';
  const lower = raw.toLowerCase();

  if (kind === 'forgot') {
    return { title: 'Request could not be completed', message: raw };
  }
  if (kind === 'demo') {
    if (lower.includes('cannot reach') || lower.includes('timed out') || lower.includes('network'))
      return { title: 'Demo unavailable', message: raw };
    return { title: 'Demo sign-in failed', message: raw };
  }

  if (raw === 'Invalid credentials' || lower === 'invalid credentials')
    return {
      title: 'Sign-in failed',
      message:
        'The email or password you entered is incorrect. Check your details or use Forgot password if you need to reset your account.',
    };
  if (raw === 'Invalid 2FA code' || lower.includes('invalid 2fa'))
    return {
      title: 'Invalid verification code',
      message: 'The code from your authenticator app is incorrect or has expired. Please try again.',
    };
  if (lower.includes('banned'))
    return { title: 'Account unavailable', message: raw };
  if (lower.includes('blocked'))
    return { title: 'Account unavailable', message: raw };
  if (lower.includes('session expired') || lower.includes('not authenticated') || lower.includes('invalid token'))
    return { title: 'Session issue', message: 'Your session is no longer valid. Please sign in again.' };

  return { title: 'Sign-in failed', message: raw };
}

export default function LoginPage() {
  const router = useRouter();
  const { login, demoLogin, forgotPassword, isLoading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [need2FA, setNeed2FA] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSending, setForgotSending] = useState(false);
  const [errorDialog, setErrorDialog] = useState<{ title: string; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorDialog({
        title: 'Missing information',
        message: 'Please enter both your email and password to continue.',
      });
      return;
    }
    try {
      await login(email, password, totpCode || undefined);
      toast.success('Welcome back!');
      router.push('/accounts');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('2FA') && !msg.includes('Invalid')) {
        setNeed2FA(true);
      } else {
        setErrorDialog(authErrorContent(err, 'login'));
      }
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      setErrorDialog({ title: 'Missing email', message: 'Enter the email address for your account.' });
      return;
    }
    setForgotSending(true);
    try {
      await forgotPassword(forgotEmail.trim());
      toast.success('Check your email for reset instructions.');
      setForgotOpen(false);
      setForgotEmail('');
    } catch (err: unknown) {
      setErrorDialog(authErrorContent(err, 'forgot'));
    } finally {
      setForgotSending(false);
    }
  };

  const handleDemoClick = async () => {
    try {
      await demoLogin();
      toast.success('Welcome — demo account');
      router.push('/accounts');
    } catch (err: unknown) {
      setErrorDialog(authErrorContent(err, 'demo'));
    }
  };

  return (
    <div className="auth-page min-h-screen relative overflow-hidden" style={{ background: '#0a0a0a' }}>
      {/* Subtle accent glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[300px] -left-[200px] w-[600px] h-[600px] rounded-full bg-buy/[0.04] blur-[120px] animate-float" />
        <div className="absolute -bottom-[200px] -right-[300px] w-[700px] h-[700px] rounded-full bg-sell/[0.03] blur-[120px] animate-float" style={{ animationDelay: '3s' }} />
      </div>
      {/* Grid pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-[420px]">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <svg width="44" height="44" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="48" height="48" rx="12" fill="#2962FF" />
              <path d="M10 32L18 24L24 30L38 16" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M32 16H38V22" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-2xl font-bold italic tracking-tight">
              <span style={{ color: '#fff' }}>Trust</span>
              <span style={{ color: '#00e676' }}>Edge</span>
            </span>
          </div>

            {/* Glass form card */}
            <div className="glass-panel rounded-3xl p-8 noise-texture overflow-hidden">
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-xl font-bold text-text-primary">Sign in</h2>
                    <p className="text-xs text-text-tertiary mt-1">Access your trading account</p>
                  </div>
                  <Link
                    href="/auth/register"
                    className="text-xxs text-buy hover:text-buy-light transition-fast px-3 py-1.5 rounded-lg glass-light"
                  >
                    Create account
                  </Link>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <Input
                    label="Email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    icon={
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                      </svg>
                    }
                  />

                  <div>
                    <Input
                      label="Password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      autoComplete="current-password"
                      icon={
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                          <path d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                        </svg>
                      }
                      suffix={
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="text-text-tertiary hover:text-text-secondary transition-fast"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          )}
                        </button>
                      }
                    />
                    <div className="flex justify-end mt-1.5">
                      <button
                        type="button"
                        onClick={() => { setForgotEmail(email); setForgotOpen(true); }}
                        className="text-xxs text-text-tertiary hover:text-buy transition-fast"
                      >
                        Forgot password?
                      </button>
                    </div>
                  </div>

                  {need2FA && (
                    <Input
                      label="2FA Code"
                      type="text"
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value)}
                      placeholder="000000"
                      maxLength={6}
                      className="tracking-[0.5em] text-center font-mono text-lg"
                    />
                  )}

                  <Button type="submit" variant="primary" size="xl" fullWidth loading={isLoading}>
                    Start trading
                  </Button>
                </form>

                {/* Divider */}
                <div className="emboss-divider my-6" />

                {/* Demo account */}
                <button
                  type="button"
                  onClick={handleDemoClick}
                  disabled={isLoading}
                  className="w-full py-3 text-xs text-text-tertiary hover:text-text-secondary glass-light rounded-xl transition-all duration-150 hover:border-border-glass-bright skeu-btn disabled:opacity-50"
                >
                  Try with Demo Account
                </button>
              </div>
            </div>

            <p className="text-center text-xxs mt-6 px-4" style={{ color: 'rgba(255,255,255,0.3)' }}>
              By signing in you agree to our Terms of Service and Privacy Policy
            </p>
        </div>
      </div>

      {errorDialog && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="auth-error-title"
          aria-describedby="auth-error-desc"
        >
          <div className="glass-panel rounded-2xl p-6 w-full max-w-sm noise-texture relative z-10 border border-sell/25 shadow-lg shadow-sell/10">
            <div className="flex items-start gap-3 mb-4">
              <div
                className="flex-shrink-0 w-10 h-10 rounded-full bg-sell/15 flex items-center justify-center text-sell"
                aria-hidden
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                  />
                </svg>
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <h3 id="auth-error-title" className="text-lg font-bold text-text-primary leading-tight">
                  {errorDialog.title}
                </h3>
                <p id="auth-error-desc" className="text-sm text-text-secondary mt-2 leading-relaxed">
                  {errorDialog.message}
                </p>
              </div>
            </div>
            <Button type="button" variant="primary" size="md" fullWidth onClick={() => setErrorDialog(null)}>
              OK
            </Button>
          </div>
        </div>
      )}

      {forgotOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="forgot-title"
        >
          <div className="glass-panel rounded-2xl p-6 w-full max-w-sm noise-texture relative z-10">
            <h3 id="forgot-title" className="text-lg font-bold text-text-primary mb-1">
              Reset password
            </h3>
            <p className="text-xxs text-text-tertiary mb-4">
              Enter your email. If an account exists, we will send reset instructions.
            </p>
            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <Input
                label="Email"
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  className="flex-1"
                  onClick={() => setForgotOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="md" className="flex-1" loading={forgotSending}>
                  Send
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
