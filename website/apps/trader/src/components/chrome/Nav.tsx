'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ArrowUpRight, Download } from 'lucide-react';
import { EzymexLogo } from '@/components/brand/Logo';
import { NAV_MORE, NAV_PRIMARY } from '@/content/site';
import { LOGIN_HREF, REGISTER_HREF } from '@/lib/crm';
import { LanguagePicker, LanguageSelect } from '@/components/chrome/LanguagePicker';
import { ANDROID_APP, PLAY_STORE_URL, RISK_WARNING } from '@/content/facts';
import { cn } from '@/lib/cn';

/**
 * The Android app in one tap: the Google Play listing (the founder, 13 November 2026: people install from Play, the
 * APK stays on the Platforms page for phones without it). iPhones and iPads have no Play, so there the button opens
 * the Platforms page instead.
 */
function useApkLink() {
  const [ios, setIos] = useState(false);
  useEffect(() => {
    setIos(/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
  }, []);
  return ios ? { href: '/platforms' } : { href: PLAY_STORE_URL, target: '_blank', rel: 'noopener' };
}

export default function Nav() {
  const pathname = usePathname();
  const apk = useApkLink();
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [menu, setMenu] = useState(false);
  const [more, setMore] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const lastY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 24);
      setHidden(y > 480 && y > lastY.current + 4);
      if (y < lastY.current - 4) setHidden(false);
      lastY.current = y;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMenu(false);
    setMore(false);
  }, [pathname]);

  useEffect(() => {
    const lenis = window.__lenis;
    if (menu) {
      lenis?.stop();
      document.body.style.overflow = 'hidden';
    } else {
      lenis?.start();
      document.body.style.overflow = '';
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenu(false);
        setMore(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menu]);

  useEffect(() => {
    if (!more) return;
    const onDoc = (e: MouseEvent) => {
      if (!moreRef.current?.contains(e.target as Node)) setMore(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [more]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');
  const moreActive = NAV_MORE.some((l) => isActive(l.href));

  return (
    <>
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-[70] transition-transform duration-500 ease-out',
          hidden && !menu ? '-translate-y-[120%]' : 'translate-y-0',
        )}
      >
        {/* Soft scrim once the page has scrolled, so content passing underneath never collides with the logo. */}
        <div
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-x-0 top-0 h-[120px] bg-gradient-to-b from-ink/90 via-ink/55 to-transparent transition-opacity duration-500 lg:h-[132px]',
            scrolled && !menu ? 'opacity-100' : 'opacity-0',
          )}
        />
        <div className="container-site relative flex h-[76px] items-center justify-between gap-4 lg:h-[88px]">
          <Link href="/" aria-label="Ezymex home" className="relative z-[2] flex-none text-fg">
            <EzymexLogo className="h-[22px] w-auto lg:h-[26px]" title="Ezymex" />
          </Link>

          {/* Desktop pill */}
          <nav
            aria-label="Main"
            className={cn(
              'hidden items-center gap-1 rounded-full p-1.5 transition-all duration-500 lg:flex',
              scrolled ? 'glass-strong' : 'glass',
            )}
          >
            {NAV_PRIMARY.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={isActive(l.href) ? 'page' : undefined}
                className={cn(
                  'relative flex h-10 items-center gap-2 rounded-full px-4 text-[14px] font-medium transition-colors',
                  isActive(l.href) ? 'bg-white/[0.09] text-fg' : 'text-fg-2 hover:text-fg',
                )}
              >
                {l.label}
                {l.note && <span className="h-1.5 w-1.5 rounded-full bg-ember shadow-[0_0_8px_#ff5a1f]" aria-label="new" />}
              </Link>
            ))}
            <div ref={moreRef} className="relative">
              <button
                type="button"
                aria-expanded={more}
                aria-haspopup="true"
                onClick={() => setMore((v) => !v)}
                className={cn(
                  'flex h-10 items-center gap-1.5 rounded-full px-4 text-[14px] font-medium transition-colors',
                  moreActive || more ? 'bg-white/[0.09] text-fg' : 'text-fg-2 hover:text-fg',
                )}
              >
                More
                <ChevronDown size={14} className={cn('transition-transform duration-300', more && 'rotate-180')} aria-hidden />
              </button>
              {more && (
                <div className="glass-strong absolute left-1/2 top-[52px] w-[360px] -translate-x-1/2 rounded-3xl p-2">
                  {NAV_MORE.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      aria-current={isActive(l.href) ? 'page' : undefined}
                      className="group flex items-center justify-between gap-4 rounded-2xl px-4 py-3 transition-colors hover:bg-white/[0.06]"
                    >
                      <span>
                        <span className="block text-[14px] font-medium text-fg">{l.label}</span>
                        {l.note && <span className="block text-[12px] text-fg-3">{l.note}</span>}
                      </span>
                      <ArrowUpRight size={16} className="text-fg-3 transition-all group-hover:rotate-45 group-hover:text-ember-2" aria-hidden />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </nav>

          <div className="relative z-[2] flex items-center gap-1 sm:gap-1.5">
            <LanguagePicker className="hidden lg:block" />
            <a
              {...apk}
              aria-label={`Get the Ezymex Android app on Google Play (version ${ANDROID_APP.version})`}
              title={`Ezymex on Google Play · version ${ANDROID_APP.version} · updated ${ANDROID_APP.releasedOn}`}
              className="glass relative grid h-10 w-10 place-items-center rounded-full text-fg transition-colors hover:text-ember-2 max-[359px]:hidden sm:h-11 sm:w-11 lg:flex lg:h-10 lg:w-auto lg:gap-2 lg:px-4 lg:text-[14px] lg:font-medium"
            >
              <Download size={16} aria-hidden />
              <span className="hidden lg:inline">Get it on Google Play</span>
              {/* the version, so the button looks different the day a release lands */}
              <span className="hidden rounded-full bg-ember/20 px-1.5 text-[11px] font-semibold leading-[17px] text-ember lg:inline">
                {ANDROID_APP.version}
              </span>
              {/* and the dot this nav already uses for "new", for the narrow layout that shows only the icon */}
              <span
                className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-ember shadow-[0_0_8px_#ff5a1f] lg:hidden"
                aria-hidden
              />
            </a>
            <Link
              href={LOGIN_HREF}
              className="hidden h-10 items-center rounded-full px-4 text-[14px] font-medium text-fg-2 transition-colors hover:text-fg lg:flex"
            >
              Log in
            </Link>
            <Link
              href={REGISTER_HREF}
              className="btn btn-ember btn-sm !h-10 !px-3.5 text-[13px] sm:!px-5 sm:text-[14px]"
            >
              Open account
            </Link>
            <button
              type="button"
              onClick={() => setMenu((v) => !v)}
              aria-expanded={menu}
              aria-controls="mobile-menu"
              aria-label={menu ? 'Close menu' : 'Open menu'}
              className="glass relative ml-0.5 grid h-10 w-10 place-items-center rounded-full sm:ml-1 sm:h-11 sm:w-11 lg:hidden"
            >
              <span className="relative block h-3 w-5" aria-hidden>
                <span
                  className={cn(
                    'absolute left-0 top-0 h-[1.5px] w-5 bg-fg transition-transform duration-500',
                    menu && 'translate-y-[5px] rotate-45',
                  )}
                />
                <span
                  className={cn(
                    'absolute bottom-0 left-0 h-[1.5px] w-5 bg-fg transition-transform duration-500',
                    menu && '-translate-y-[5px] -rotate-45',
                  )}
                />
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      <div
        id="mobile-menu"
        className={cn(
          'fixed inset-0 z-[65] overflow-y-auto bg-[rgba(7,7,10,0.92)] backdrop-blur-2xl transition-[opacity,visibility] duration-500 lg:hidden',
          menu ? 'visible opacity-100' : 'invisible opacity-0',
        )}
        aria-hidden={!menu}
        data-lenis-prevent
      >
        <div aria-hidden className="glow-ember right-[-30%] top-[-10%] h-[60vh] w-[90vw] opacity-40" />
        <nav aria-label="Mobile" className="container-site relative flex min-h-full flex-col gap-10 pb-10 pt-28">
          <ul className="flex flex-col">
            {[...NAV_PRIMARY, ...NAV_MORE].map((l, i) => (
              <li key={l.href} className="border-b border-white/[0.07]">
                <Link
                  href={l.href}
                  tabIndex={menu ? 0 : -1}
                  aria-current={isActive(l.href) ? 'page' : undefined}
                  className={cn(
                    'flex items-baseline gap-4 py-3.5 font-display text-[1.9rem] font-semibold tracking-tighter transition-colors',
                    isActive(l.href) ? 'text-ember-2' : 'text-fg',
                  )}
                  style={{ transitionDelay: menu ? `${i * 30}ms` : '0ms' }}
                >
                  <span className="num w-6 text-xs font-normal text-fg-3">{String(i + 1).padStart(2, '0')}</span>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-3">
            <a {...apk} tabIndex={menu ? 0 : -1} className="btn btn-outline w-full gap-2">
              <Download size={18} aria-hidden />
              Get the Android app on Google Play
            </a>
            <Link href={REGISTER_HREF} tabIndex={menu ? 0 : -1} className="btn btn-ember w-full">
              Open account
            </Link>
            <Link href={LOGIN_HREF} tabIndex={menu ? 0 : -1} className="btn btn-outline w-full">
              Log in
            </Link>
          </div>
          <LanguageSelect />
          <p className="text-xs leading-relaxed text-fg-3">
            <span className="font-semibold text-fg-2">Risk warning:</span> {RISK_WARNING}
          </p>
        </nav>
      </div>
    </>
  );
}
