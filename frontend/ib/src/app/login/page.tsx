'use client';

/**
 * IB Partner Portal — standalone login (its own app, port :3002). An approved
 * IB signs in with the separate login ID + password emailed on approval; on
 * success we stash the returned access token in sessionStorage and hand off
 * to the portal. Two-panel layout shared with the admin console (auth.css).
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Lock, Loader2, AlertCircle, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import './auth.css';

const STEPS = [
  { number: 1, label: 'Sign in to portal' },
  { number: 2, label: 'Partner dashboard' },
];

export default function IBPortalLoginPage() {
  const router = useRouter();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/business/ib-portal/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login_id: loginId.trim(), password }),
      });
      const raw = await res.text();
      let json: { access_token?: string; name?: string; detail?: unknown } = {};
      try { json = raw ? JSON.parse(raw) : {}; } catch { /* non-JSON */ }
      if (!res.ok || !json.access_token) {
        const d = json.detail;
        throw new Error(typeof d === 'string' ? d : 'Invalid login ID or password');
      }
      sessionStorage.setItem('ib_portal_token', json.access_token);
      sessionStorage.setItem('ib_portal_name', json.name || '');
      router.replace('/overview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  const disabled = submitting || !loginId.trim() || !password;

  return (
    <div className="auth-wrapper">
      <div className="auth-card-wrapper">
        <div className="auth-card">
          {/* ── LEFT PANEL ── */}
          <div className="auth-left">
            <div className="auth-left__bg" />
            <div className="auth-left__mandala" aria-hidden="true" />
            <div className="auth-left__content">
              <h1 className="auth-left__title">IB Partner Portal</h1>
              <p className="auth-left__subtitle">
                Track your referrals and commissions, drill into every client,
                and trade on their behalf — all from one partner console.
              </p>
              <div className="auth-left__steps">
                {STEPS.map((s) => (
                  <div
                    key={s.number}
                    className={`auth-step ${s.number === 1 ? 'auth-step--active' : 'auth-step--inactive'}`}
                  >
                    <span className="auth-step__num">{s.number}</span>
                    <span className="auth-step__label">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── RIGHT PANEL ── */}
          <div className="auth-right">
            <form className="auth-form" onSubmit={submit} noValidate>
              <div className="flex justify-center mb-2">
                <img src="/logo.png" alt="FXArtha" className="w-16 h-16 object-contain" />
              </div>
              <div>
                <h2 className="auth-form__title">FXArtha IB</h2>
                <p className="auth-form__subtitle">Introducing Broker portal — approved partners only.</p>
              </div>

              <div className="auth-demo-badge">
                <ShieldCheck size={14} />
                <span>Approved partners only</span>
              </div>

              <div className="auth-field">
                <label className="auth-field__label">Login ID</label>
                <div className="auth-field__wrap">
                  <input
                    type="text"
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    placeholder="IBXXXXXX"
                    autoFocus
                    autoCapitalize="off"
                    spellCheck={false}
                    required
                    className="auth-field__input"
                    style={{ paddingLeft: '2.5rem' }}
                  />
                  <KeyRound
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

              <button type="submit" className="auth-btn" disabled={disabled}>
                {submitting ? <Loader2 size={18} className="auth-spinner" /> : 'Sign In'}
              </button>

              <p className="auth-footer" style={{ marginTop: '0.5rem' }}>
                Use the credentials emailed after your IB application was approved.
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
