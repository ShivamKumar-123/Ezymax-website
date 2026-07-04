'use client';

/**
 * IB Partner Portal — standalone login (its own app, port :3002). An approved
 * IB signs in with the separate login ID + password emailed on approval; on
 * success we stash the returned access token in sessionStorage and hand off
 * to the dashboard.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';

export default function IBPortalLoginPage() {
  const router = useRouter();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
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
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  const disabled = submitting || !loginId.trim() || !password;

  return (
    <div className="grid min-h-[100dvh] place-items-center bg-bg-base px-4 text-text-primary">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="text-2xl font-bold tracking-tight">
            <span className="text-accent">FX</span><span className="text-text-primary">Artha</span>
          </span>
          <p className="mt-1 text-sm font-semibold text-text-secondary">IB Partner Portal</p>
        </div>
        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border-primary bg-card p-6 noise-texture">
          <div className="space-y-1.5">
            <label className="block text-xs text-text-secondary">Login ID</label>
            <input
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              autoFocus
              autoCapitalize="off"
              spellCheck={false}
              placeholder="IBXXXXXX"
              className="w-full rounded-xl border border-border-primary bg-bg-secondary px-4 py-3 font-mono text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent/50"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs text-text-secondary">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-border-primary bg-bg-secondary px-4 py-3 text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent/50"
            />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={disabled}
            className={clsx(
              'w-full rounded-xl py-3 text-sm font-bold transition-all',
              disabled ? 'cursor-not-allowed bg-bg-hover text-text-tertiary' : 'bg-accent text-black hover:brightness-110',
            )}
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="text-center text-[11px] text-text-tertiary">
            Use the credentials emailed to you after your IB application was approved.
          </p>
        </form>
      </div>
    </div>
  );
}
