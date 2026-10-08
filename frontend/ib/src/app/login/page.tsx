'use client';

/**
 * IB Partner Portal — standalone login (its own app). Signs in with the user's
 * OWN trader email + password (IBs are auto-promoted); legacy portal login-IDs
 * still work server-side. Modern obsidian + lime glass layout.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Mail, Lock, Loader2, AlertCircle, Eye, EyeOff, ShieldCheck,
  TrendingUp, Users, LineChart, ArrowRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const FEATURES: [LucideIcon, string][] = [
  [TrendingUp, 'Real-time commissions & rebates'],
  [Users, 'Your full referral network'],
  [LineChart, 'Trade on your clients’ behalf'],
];

export default function IBPortalLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
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
        body: JSON.stringify({ login_id: email.trim(), password }),
      });
      const raw = await res.text();
      let json: { access_token?: string; name?: string; detail?: unknown } = {};
      try { json = raw ? JSON.parse(raw) : {}; } catch { /* non-JSON */ }
      if (!res.ok || !json.access_token) {
        const d = json.detail;
        throw new Error(typeof d === 'string' ? d : 'Invalid email or password');
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

  const disabled = submitting || !email.trim() || !password;

  return (
    <div className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden bg-[#070707] p-4 text-white sm:p-6">
      {/* Background — grid + lime aura, matching the landing/portal */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(80% 55% at 50% -10%, rgba(255,106,0,0.10), transparent 60%),' +
            'linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px),' +
            'linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 54px 54px, 54px 54px',
        }}
        aria-hidden
      />
      <div className="pointer-events-none absolute -left-40 top-1/4 h-96 w-96 rounded-full bg-[#FF6A00]/10 blur-[130px]" aria-hidden />
      <div className="pointer-events-none absolute -right-32 bottom-0 h-80 w-80 rounded-full bg-[#FF6A00]/[0.06] blur-[130px]" aria-hidden />

      {/* Card */}
      <div
        className="relative grid w-full max-w-4xl overflow-hidden rounded-[28px] border border-white/10 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)] lg:grid-cols-2"
        style={{ background: 'linear-gradient(180deg, rgba(18,18,18,0.92), rgba(6,6,6,0.96))', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
      >
        {/* ── Left showcase ── */}
        <div
          className="relative hidden flex-col justify-between overflow-hidden p-10 lg:flex"
          style={{ background: 'radial-gradient(120% 90% at 0% 0%, rgba(255,106,0,0.13), transparent 55%)', borderRight: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="pointer-events-none absolute right-0 top-1/3 h-72 w-72 translate-x-1/3 rounded-full bg-[#FF6A00]/15 blur-[100px]" aria-hidden />
          <div className="relative flex items-center gap-2.5">
            <img src="/ezymex_icon.png" alt="" className="h-10 w-10 object-contain drop-shadow-[0_0_16px_rgba(255,106,0,0.5)]" />
            <span className="text-lg font-bold tracking-tight"><span className="text-[#FF6A00]">EZY</span>MAX</span>
          </div>

          <div className="relative">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FF6A00]/25 bg-[#FF6A00]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-[#FF6A00]">
              Partner Program
            </span>
            <h1 className="mt-4 text-4xl font-bold leading-[1.1] tracking-tight">IB Partner<br />Portal</h1>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/55">
              Track referrals &amp; commissions, drill into every client, and trade on their behalf — all from one console.
            </p>
            <ul className="mt-8 space-y-3.5">
              {FEATURES.map(([Icon, label]) => (
                <li key={label} className="flex items-center gap-3 text-sm font-medium text-white/85">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#FF6A00]/25 bg-[#FF6A00]/10">
                    <Icon size={15} className="text-[#FF6A00]" />
                  </span>
                  {label}
                </li>
              ))}
            </ul>
          </div>

          <p className="relative text-xs text-white/40">Ezymax — Introducing Broker Program</p>
        </div>

        {/* ── Right form ── */}
        <div className="relative p-8 sm:p-10">
          <div className="mb-6 flex items-center gap-2.5 lg:hidden">
            <img src="/ezymex_icon.png" alt="" className="h-9 w-9 object-contain drop-shadow-[0_0_14px_rgba(255,106,0,0.45)]" />
            <span className="text-lg font-bold tracking-tight"><span className="text-[#FF6A00]">EZY</span>MAX</span>
          </div>

          <h2 className="text-2xl font-bold tracking-tight">Welcome back</h2>
          <p className="mt-1.5 text-sm text-white/55">Sign in with your Ezymax trader email &amp; password.</p>

          <div className="mt-5 inline-flex items-center gap-2 rounded-lg border border-[#FF6A00]/25 bg-[#FF6A00]/[0.07] px-3 py-2 text-xs font-semibold text-[#FF6A00]">
            <ShieldCheck size={13} /> Same login as your trading account
          </div>

          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-white/70">Email</label>
              <div className="relative">
                <Mail size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoFocus
                  autoComplete="email"
                  autoCapitalize="off"
                  spellCheck={false}
                  required
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-3 pl-10 pr-3 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-[#FF6A00]/60 focus:bg-white/[0.05] focus:shadow-[0_0_0_3px_rgba(255,106,0,0.12)]"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-white/70">Password</label>
              <div className="relative">
                <Lock size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  required
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-3 pl-10 pr-11 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-[#FF6A00]/60 focus:bg-white/[0.05] focus:shadow-[0_0_0_3px_rgba(255,106,0,0.12)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 transition-colors hover:text-white/70"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-300">
                <AlertCircle size={14} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={disabled}
              className="group flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-black transition-all disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: 'linear-gradient(90deg, #FFB380, #FF6A00 55%, #C2410C)', boxShadow: '0 10px 30px -8px rgba(255,106,0,0.5)' }}
            >
              {submitting ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>Sign In <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" /></>
              )}
            </button>
          </form>

          <p className="mt-5 text-center text-xs leading-relaxed text-white/45">
            No separate login — use your Ezymax trader email &amp; password.
            <br className="hidden sm:block" /> Refer one trader to unlock your partner portal.
          </p>
        </div>
      </div>
    </div>
  );
}
