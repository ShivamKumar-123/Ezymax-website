'use client';

import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Globe, Check, X } from 'lucide-react';

/**
 * Custom language switcher that drives Google Translate Element under the
 * hood. Default site language is English; selecting another translates the
 * whole DOM client-side via Google's widget.
 *
 * Implementation:
 *  - Google Translate's official Element JS is loaded once at <head> via
 *    layout.tsx, with `googleTranslateElementInit` defined on window.
 *  - Default UI is hidden via CSS overrides in globals.css.
 *  - This component renders a globe button + modal grid; on selection it
 *    programmatically dispatches `change` on the hidden `.goog-te-combo`
 *    select so Google's widget swaps the page text.
 *  - Cookie `googtrans=/en/<lang>` persists the choice across reloads.
 */

interface Language {
  code: string;       // Google Translate code
  label: string;
  /** ISO 3166-1 alpha-2 country code — feeds the `flag-icons` SVG class (e.g. "gb" → fi-gb). */
  country: string;
}

const LANGUAGES: Language[] = [
  { code: 'en',    label: 'English',     country: 'gb' },
  { code: 'ms',    label: 'Malay',       country: 'my' },
  { code: 'zh-CN', label: '简体中文',     country: 'cn' },
  { code: 'zh-TW', label: '繁體中文',     country: 'hk' },
  { code: 'el',    label: 'Ελληνικά',    country: 'gr' },
  { code: 'hu',    label: 'Magyar',      country: 'hu' },
  { code: 'ru',    label: 'Русский',     country: 'ru' },
  { code: 'id',    label: 'Indonesia',   country: 'id' },
  { code: 'fr',    label: 'Français',    country: 'fr' },
  { code: 'it',    label: 'Italiano',    country: 'it' },
  { code: 'sv',    label: 'Svenska',     country: 'se' },
  { code: 'de',    label: 'Deutsch',     country: 'de' },
  { code: 'pl',    label: 'Polski',      country: 'pl' },
  { code: 'ar',    label: 'العربية',     country: 'sa' },
  { code: 'es',    label: 'Español',     country: 'es' },
  { code: 'ko',    label: '한국어',       country: 'kr' },
  { code: 'pt',    label: 'Português',   country: 'pt' },
  { code: 'vi',    label: 'Tiếng Việt',  country: 'vn' },
  { code: 'th',    label: 'ภาษาไทย',     country: 'th' },
  { code: 'fil',   label: 'Filipino',    country: 'ph' },
  { code: 'nl',    label: 'Dutch',       country: 'nl' },
  { code: 'cs',    label: 'Česky',       country: 'cz' },
  { code: 'bn',    label: 'বাংলা',        country: 'bd' },
  { code: 'ur',    label: 'اردو',         country: 'pk' },
  { code: 'tr',    label: 'Türkçe',      country: 'tr' },
  { code: 'hi',    label: 'हिंदी',         country: 'in' },
  { code: 'si',    label: 'සිංහල',       country: 'lk' },
  { code: 'uz',    label: "O'zbekcha",   country: 'uz' },
  { code: 'mn',    label: 'Монгол',      country: 'mn' },
  { code: 'ja',    label: '日本語',        country: 'jp' },
  { code: 'ta',    label: 'தமிழ்',         country: 'in' },
  { code: 'te',    label: 'తెలుగు',         country: 'in' },
  { code: 'mr',    label: 'मराठी',         country: 'in' },
  { code: 'gu',    label: 'ગુજરાતી',        country: 'in' },
  { code: 'pa',    label: 'ਪੰਜਾਬੀ',          country: 'in' },
  { code: 'fa',    label: 'فارسی',         country: 'ir' },
  // Hebrew: Google Translate still accepts both 'iw' (legacy) and 'he'.
  // We use 'iw' because the cookie format (`/en/iw`) is what Google
  // Translate's own dropdown emits, and switching to 'he' breaks the
  // cookie round-trip with the older Element JS.
  { code: 'iw',    label: 'עברית',         country: 'il' },
  { code: 'uk',    label: 'Українська',   country: 'ua' },
  { code: 'ro',    label: 'Română',       country: 'ro' },
  { code: 'no',    label: 'Norsk',        country: 'no' },
  { code: 'da',    label: 'Dansk',        country: 'dk' },
  { code: 'fi',    label: 'Suomi',        country: 'fi' },
  { code: 'sw',    label: 'Kiswahili',    country: 'ke' },
];

/**
 * Renders a real SVG flag via the `flag-icons` library — looks identical on
 * every OS (no Windows emoji-flag fallback to two-letter codes). The default
 * 4:3 aspect ratio matches the visual rhythm of the language picker rows.
 */
function Flag({ country, className = '' }: { country: string; className?: string }) {
  return (
    <span
      role="img"
      aria-hidden
      className={`fi fi-${country} rounded-sm shadow-sm shrink-0 ${className}`}
      style={{ width: 20, height: 15, backgroundSize: 'cover', backgroundPosition: 'center', display: 'inline-block' }}
    />
  );
}

const COOKIE_NAME = 'googtrans';

function readActiveLang(): string {
  if (typeof document === 'undefined') return 'en';
  const m = document.cookie.match(/(?:^|; )googtrans=([^;]+)/);
  if (!m) return 'en';
  // Cookie format: /en/<target>
  const parts = decodeURIComponent(m[1]).split('/');
  return parts[2] || 'en';
}

function setActiveLang(lang: string) {
  if (typeof document === 'undefined') return;
  // Set on both the current domain and its parent (so subdomains share).
  const value = `/en/${lang}`;
  document.cookie = `${COOKIE_NAME}=${value}; path=/; max-age=${60 * 60 * 24 * 365}`;
  const host = window.location.hostname.replace(/^www\./, '');
  document.cookie = `${COOKIE_NAME}=${value}; path=/; domain=.${host}; max-age=${60 * 60 * 24 * 365}`;
}

export function LanguageSwitcher() {
  const [open, setOpen]     = useState(false);
  const [active, setActive] = useState('en');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setActive(readActiveLang());
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  const pick = useCallback((code: string) => {
    setActive(code);
    setActiveLang(code);
    setOpen(false);

    // Always reload after setting the cookie. Empirically the most reliable
    // way to make EVERY language switch take effect — programmatically
    // dispatching `change` on `.goog-te-combo` works for some target
    // languages but silently fails for others (Google's widget caches
    // the previously-selected source/target pair and skips the swap).
    // A full reload boots Google Translate fresh against the new cookie,
    // so every language in the picker translates the same way.
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }, []);

  const activeLang  = LANGUAGES.find((l) => l.code === active);
  const activeLabel = activeLang?.label ?? 'English';
  const activeCountry = activeLang?.country ?? 'gb';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Change language. Current: ${activeLabel}`}
        /* Sits in the white primary nav next to Log in / Get Started —
           the black utility strip it used to invert against is gone, so
           it now reads as ink-on-white like the rest of the bar. */
        className="notranslate inline-flex items-center gap-1.5 rounded-full px-2.5 py-2 text-xs font-medium text-foreground/70 transition-colors hover:bg-[hsl(var(--muted))] hover:text-foreground"
        translate="no"
        // Browser extensions (form fillers, password managers, etc.) inject
        // `fdprocessedid` onto interactive elements after the server HTML
        // ships but before React hydrates — React then complains about the
        // attribute mismatch. Suppressing the warning here is the canonical
        // fix; the attribute is harmless and React still hydrates correctly.
        suppressHydrationWarning
      >
        <Globe className="size-4" />
        <Flag country={activeCountry} className="hidden sm:inline-block" />
        <span className="hidden md:inline uppercase tracking-wider">{active}</span>
      </button>

      {mounted && createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Select language"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="brand-home fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm notranslate"
              translate="no"
              onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 10 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[hsl(var(--border)/0.10)] bg-white p-5 shadow-[0_28px_70px_rgba(11,11,12,0.28)] sm:p-8"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-[hsl(var(--muted))]">
                      <Globe className="size-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="font-display uppercase text-lg sm:text-xl tracking-tight">Choose Language</h2>
                      <p className="text-xs text-foreground/55">Powered by Google Translate · {LANGUAGES.length} languages</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Close"
                    onClick={() => setOpen(false)}
                    className="flex size-9 items-center justify-center rounded-full border border-[hsl(var(--border)/0.12)] text-foreground transition-colors hover:bg-[hsl(var(--muted))]"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {LANGUAGES.map((lang) => {
                    const isActive = lang.code === active;
                    return (
                      <li key={lang.code}>
                        <button
                          type="button"
                          onClick={() => pick(lang.code)}
                          className={`w-full inline-flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-colors text-left ${
                            isActive
                              ? 'bg-[hsl(var(--muted))] text-primary font-semibold'
                              : 'text-foreground/80 hover:bg-[hsl(var(--muted))]'
                          }`}
                          aria-pressed={isActive}
                        >
                          <Flag country={lang.country} />
                          <span className="flex-1 truncate">{lang.label}</span>
                          {isActive && <Check className="size-4 shrink-0" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
