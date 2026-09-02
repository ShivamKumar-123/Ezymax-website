'use client';

/**
 * Tenant landing page — the "website" every white-label broker gets on
 * their apex domain, generated entirely from their branding (logo,
 * name, support contacts). Served via a middleware REWRITE of `/` on
 * tenant hosts, so the address bar stays on the broker's domain.
 *
 * Deliberately contains NO platform-specific or legal-entity claims —
 * only generic, true product statements plus a standard risk warning.
 * Brokers who want a full custom website use subdomain mode instead
 * (their own site on the apex, trading on trade.<domain>).
 */

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight, CandlestickChart, ShieldCheck, Wallet, Headphones,
  LineChart, Globe2,
} from 'lucide-react';
import { useBrandDisplay, useBranding } from '@/components/providers/BrandingProvider';

const FEATURES = [
  {
    icon: CandlestickChart,
    title: 'Multi-asset trading',
    body: 'Forex, precious metals, indices and crypto — one account, one terminal.',
  },
  {
    icon: LineChart,
    title: 'Professional charting',
    body: 'Real-time charts with indicators, drawing tools and one-click trading.',
  },
  {
    icon: Wallet,
    title: 'Fast deposits & withdrawals',
    body: 'Multiple funding methods with quick processing on every request.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure accounts',
    body: 'Two-factor authentication, encrypted sessions and full trade history.',
  },
  {
    icon: Globe2,
    title: 'Trade anywhere',
    body: 'Web terminal and mobile-ready platform — your account on every device.',
  },
  {
    icon: Headphones,
    title: 'Dedicated support',
    body: 'A support team that knows your account, ready when you need help.',
  },
];

export default function TenantHomePage() {
  const brand = useBrandDisplay();
  const { loading } = useBranding();
  const router = useRouter();

  // Platform hosts have a real marketing site on '/' — this page is for
  // tenant domains only. If someone reaches it on the platform (or the
  // brand lookup says "not white-label"), send them home.
  useEffect(() => {
    if (!loading && !brand.isWhiteLabel) router.replace('/');
  }, [loading, brand.isWhiteLabel, router]);

  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 md:px-12 py-5 max-w-6xl w-full mx-auto">
        <div className="flex items-center gap-2 min-w-0">
          {brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoUrl} alt={brand.name} className="h-9 w-auto max-w-[180px] object-contain" />
          ) : (
            <span className="font-bold tracking-tight text-xl truncate">{brand.name}</span>
          )}
        </div>
        <nav className="flex items-center gap-3">
          <Link
            href="/auth/login"
            className="px-4 py-2 rounded-lg text-sm font-medium text-white/80 hover:text-white transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/auth/register"
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#E94E1B] hover:bg-[#E94E1B]/90 transition-colors"
          >
            Open account
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16 md:py-24 relative overflow-hidden">
        <div className="absolute -bottom-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#E94E1B] rounded-full opacity-15 blur-3xl pointer-events-none" />
        <p className="text-xs md:text-sm uppercase tracking-[0.3em] text-[#E94E1B] font-semibold mb-4">
          Online trading
        </p>
        <h1 className="text-4xl md:text-6xl font-semibold tracking-tight leading-tight max-w-3xl">
          Trade the markets with{' '}
          <span className="text-[#E94E1B]">{brand.name}</span>
        </h1>
        <p className="mt-5 max-w-xl text-white/60 text-base md:text-lg">
          Forex, metals, indices and crypto on a fast, professional trading
          platform — with live prices, advanced charts and instant execution.
        </p>
        <div className="mt-9 flex flex-col sm:flex-row items-center gap-3">
          <Link
            href="/auth/register"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-[#E94E1B] hover:bg-[#E94E1B]/90 font-semibold text-base transition-colors"
          >
            Start trading <ArrowRight size={18} />
          </Link>
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl border border-white/20 hover:bg-white/5 font-medium text-base transition-colors"
          >
            I already have an account
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 md:px-12 pb-20 max-w-6xl w-full mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 hover:bg-white/[0.05] transition-colors"
            >
              <f.icon size={22} className="text-[#E94E1B] mb-3" />
              <h3 className="font-semibold mb-1.5">{f.title}</h3>
              <p className="text-sm text-white/55 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 md:px-12 py-8">
        <div className="max-w-6xl mx-auto flex flex-col gap-4">
          <p className="text-xs text-white/40 leading-relaxed max-w-3xl">
            Risk warning: Trading leveraged products such as forex and CFDs
            involves a significant risk of loss and may not be suitable for
            all investors. You should not risk more than you can afford to
            lose. Please ensure you fully understand the risks involved
            before trading.
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-white/50">
            <span>© {year} {brand.name}. All rights reserved.</span>
            {brand.supportEmail && (
              <a href={`mailto:${brand.supportEmail}`} className="hover:text-white transition-colors">
                {brand.supportEmail}
              </a>
            )}
            {brand.supportWhatsapp && (
              <span>WhatsApp: {brand.supportWhatsapp}</span>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
