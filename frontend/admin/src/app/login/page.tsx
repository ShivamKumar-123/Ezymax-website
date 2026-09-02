'use client';

/**
 * Admin sign-in (SwissCresta Admin) — two-panel card matching the
 * trader auth page: dark hero on the left, white form on the right,
 * orange accent. Functional layer unchanged: email + password against
 * the admin JWT store; redirect to /dashboard on success; the
 * security context (audit-logged, isolated JWT, IP-fingerprinted) is
 * surfaced as chips on the hero panel.
 */

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Lock, Mail, Loader2, AlertCircle, Eye, EyeOff,
  ShieldCheck, KeyRound, Activity,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { useAuthStore } from '@/stores/authStore';
import { useAuthRehydrated } from '@/hooks/useAuthRehydrated';

export default function AdminLoginPage() {
  const router = useRouter();
  const { login, isAuthenticated } = useAuthStore();
  const authRehydrated = useAuthRehydrated();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // White-label: on a tenant admin host (admin.<broker-domain>) the login
  // page carries the BROKER's identity, not the platform's. The /api/*
  // rewrite proxies this to the gateway's public by-domain lookup.
  const [brand, setBrand] = useState<{ name: string; logoUrl: string | null } | null>(null);
  useEffect(() => {
    const host = window.location.hostname.toLowerCase();
    const platformHosts = new Set(['admin.swisscresta.com', 'localhost', '127.0.0.1']);
    if (platformHosts.has(host)) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/v1/branding/by-domain?host=${encodeURIComponent(host)}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data?.is_white_label) return;
        const name = (data.brand_name || '').trim() || 'Broker';
        const logoUrl = data.logo_url || null;
        setBrand({ name, logoUrl });
        document.title = `${name} Admin`;
        if (logoUrl) {
          const icon = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
          if (icon) icon.href = logoUrl;
          const link = document.createElement('link');
          link.rel = 'icon';
          link.href = logoUrl;
          link.setAttribute('data-wl-icon', '1');
          document.head.appendChild(link);
        }
      } catch {
        /* platform branding stays */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!authRehydrated) return;
    if (isAuthenticated) router.replace('/dashboard');
  }, [authRehydrated, isAuthenticated, router]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      toast.success('Welcome back');
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center overflow-hidden bg-[#FAFAFA] p-4">
      <div className="w-full relative max-w-5xl rounded-3xl overflow-hidden flex flex-col md:flex-row shadow-2xl ring-1 ring-black/5">
        {/* Decorative orange ball behind the left panel */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-t from-transparent to-black/60" />
          <div className="absolute -bottom-12 -left-8 w-60 h-60 bg-[#E94E1B] rounded-full opacity-90" />
          <div className="absolute -bottom-6 left-32 w-32 h-20 bg-white rounded-full opacity-90 blur-2xl" />
        </div>

        {/* Left dark hero panel */}
        <div className="bg-black text-white p-8 md:p-12 md:w-1/2 relative overflow-hidden z-10 flex flex-col justify-between min-h-[22rem] md:min-h-[38rem]">
          <span className="inline-flex items-center self-start relative z-10 bg-white/95 rounded-lg px-3 py-1.5">
            {brand ? (
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
                src="/logo.png"
                alt="SwissCresta"
                width={200}
                height={44}
                priority
                className="h-8 w-auto"
              />
            )}
          </span>

          <div className="relative z-10">
            <h1 className="text-2xl md:text-3xl font-medium leading-tight tracking-tight">
              Operator console for the {brand ? brand.name : 'SwissCresta'} platform.
            </h1>
            <div className="mt-6 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80">
                <ShieldCheck size={13} /> Audit-logged
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80">
                <KeyRound size={13} /> Isolated admin JWT
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80">
                <Activity size={13} /> IP-fingerprinted
              </span>
            </div>
          </div>
        </div>

        {/* Right form panel */}
        <div className="p-8 md:p-12 md:w-1/2 flex flex-col justify-center bg-white text-[#0A0A0A] relative z-20">
          <div className="mb-8">
            <p className="text-sm uppercase tracking-wider text-[#E94E1B] font-semibold mb-3">
              Admin access
            </p>
            <h2 className="text-3xl font-medium mb-2 tracking-tight">Operator console</h2>
            <p className="text-[#5B5B5B]">Authorised personnel only.</p>
          </div>

          <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
            <div>
              <label htmlFor="email" className="block text-sm mb-2 text-[#0A0A0A]">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A9A] pointer-events-none" />
                <input
                  type="email"
                  id="email"
                  autoComplete="email"
                  placeholder={brand ? `admin@${window.location.hostname.replace(/^admin\./, "")}` : "admin@swisscresta.com"}
                  className="text-sm w-full py-2.5 pl-10 pr-3 border border-[#E5E5E5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E94E1B]/20 focus:border-[#E94E1B] bg-white text-black transition-colors"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm mb-2 text-[#0A0A0A]">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A9A] pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="text-sm w-full py-2.5 pl-10 pr-10 border border-[#E5E5E5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E94E1B]/20 focus:border-[#E94E1B] bg-white text-black transition-colors"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9A9A9A] hover:text-[#0A0A0A] transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                <AlertCircle size={15} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#E94E1B] hover:bg-[#C73E11] disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2.5 px-4 rounded-lg transition-colors inline-flex items-center justify-center gap-2 mt-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>

            <p className="text-center text-xs text-[#9A9A9A] mt-1">
              All sign-in attempts are logged with IP and device fingerprint.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
