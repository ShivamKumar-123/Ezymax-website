'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { Lock, Mail, Loader2, AlertCircle, Eye, EyeOff, ShieldCheck, Users, Wallet, CandlestickChart, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthRehydrated } from '@/hooks/useAuthRehydrated';
import './auth.css';

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated } = useAuthStore();
  const authRehydrated = useAuthRehydrated();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authRehydrated) return;
    if (isAuthenticated) router.replace('/dashboard');
  }, [authRehydrated, isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back!');
      router.push('/dashboard');
    } catch (err: any) {
      const msg = err?.message || 'Login failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!authRehydrated) {
    return (
      <div className="auth-wrapper">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--auth-accent)' }} />
      </div>
    );
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card-wrapper">
        <div className="auth-card">
          {/* ── LEFT PANEL ── */}
          <div className="auth-left">
            <div className="auth-left__bg" />
            <div className="auth-left__mandala" aria-hidden="true" />
            <div className="auth-left__content">
              <div>
                <h1 className="auth-left__title">Admin Console</h1>
                <p className="admin-console__lead">One secure panel for the whole brokerage.</p>
              </div>

              <ul className="admin-highlights">
                <li className="admin-highlight"><span className="admin-highlight__ic"><Users size={18} /></span> Users &amp; identity verification</li>
                <li className="admin-highlight"><span className="admin-highlight__ic"><Wallet size={18} /></span> Deposits, withdrawals &amp; wallets</li>
                <li className="admin-highlight"><span className="admin-highlight__ic"><CandlestickChart size={18} /></span> Trading book &amp; risk</li>
                <li className="admin-highlight"><span className="admin-highlight__ic"><Shield size={18} /></span> Insurance &amp; compliance</li>
              </ul>

              <p className="auth-left__subtitle">
                Manage users, KYC, deposits, the trading book, and the
                insurance engine from one secure panel.
              </p>
            </div>
          </div>

          {/* ── RIGHT PANEL ── */}
          <div className="auth-right">
            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              <div className="flex flex-col items-center gap-2 mb-1">
                <img src="/logo.png" alt="Ezymex" className="h-10 w-auto object-contain" />
              </div>
              <div>
                <h2 className="auth-form__title">Ezymex Admin</h2>
                <p className="auth-form__subtitle">Broker administration panel — secure access only.</p>
              </div>

              <div className="auth-demo-badge">
                <ShieldCheck size={14} />
                <span>Authorized personnel only</span>
              </div>

              <div className="auth-field">
                <label className="auth-field__label">Email</label>
                <div className="auth-field__wrap">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder=""
                    required
                    className="auth-field__input"
                    style={{ paddingLeft: '2.5rem' }}
                  />
                  <Mail
                    size={14}
                    style={{
                      position: 'absolute',
                      left: '0.875rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--auth-muted)',
                      pointerEvents: 'none',
                    }}
                  />
                </div>
              </div>

              <div className="auth-field">
                <label className="auth-field__label">Password</label>
                <div className="auth-field__wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    required
                    autoComplete="current-password"
                    className="auth-field__input auth-field__input--has-icon"
                    style={{ paddingLeft: '2.5rem' }}
                  />
                  <Lock
                    size={14}
                    style={{
                      position: 'absolute',
                      left: '0.875rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--auth-muted)',
                      pointerEvents: 'none',
                    }}
                  />
                  <button
                    type="button"
                    className="auth-field__icon"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  className="flex items-center gap-2"
                  style={{
                    fontSize: '0.78rem',
                    color: '#f87171',
                    background: 'rgba(248,113,113,0.08)',
                    border: '1px solid rgba(248,113,113,0.25)',
                    borderRadius: '10px',
                    padding: '8px 12px',
                  }}
                >
                  <AlertCircle size={14} />
                  <span>{error}</span>
                </div>
              )}

              <button type="submit" className="auth-btn" disabled={loading}>
                {loading ? <Loader2 size={18} className="auth-spinner" /> : 'Sign In'}
              </button>

              <p className="auth-footer" style={{ marginTop: '0.5rem' }}>
                Ezymex Admin v1.0 &middot; Secure Access Only
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
