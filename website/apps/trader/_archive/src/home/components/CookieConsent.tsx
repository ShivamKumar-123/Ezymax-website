'use client';

/**
 * Cookie consent — two surfaces, one preference store.
 *
 * Lifecycle (standard GDPR — surfaces once, then suppressed):
 *   1. On the user's FIRST visit (no localStorage entry yet), a small
 *      banner slides up from the BOTTOM of the viewport (~600 ms after
 *      first paint) with a one-line explainer + 'Manage' / 'Accept All'
 *      buttons. The banner doesn't block clicks above it.
 *   2. 'Accept All' on the banner writes consent and dismisses it.
 *      'Manage' opens the full 3-tab settings modal:
 *        - Change Settings (toggles for promotional / preference cookies;
 *          functional is always-on per the brief).
 *        - What are Cookies? (educational copy).
 *        - Why are Cookies Useful? (educational copy).
 *   3. Saving / accepting from EITHER surface writes prefs + an ISO
 *      timestamp under `${BRAND_SLUG}_cookie_consent`. Banner + modal will
 *      NOT auto-open again on subsequent visits — the user is no
 *      longer interrupted.
 *   4. Users can revisit the dialog at any time via the footer
 *      'Cookie Settings' link, which calls openCookieSettings(). The
 *      modal re-opens with the previously saved toggles pre-loaded so
 *      the user can change their mind.
 *
 * Mounted once in src/app/layout.tsx so it shows on every route.
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Cookie, X, Check, Settings } from 'lucide-react';
import { BRAND_NAME, BRAND_SLUG } from '@/lib/brand';

const STORAGE_KEY = `${BRAND_SLUG}_cookie_consent`;

/** Custom event used to re-open the settings modal from footer/nav links. */
const OPEN_SETTINGS_EVENT = `${BRAND_SLUG}:open-cookie-settings`;

/** Persisted preference object — `functional` always saves as true. */
type StoredPrefs = {
  functional: true;
  promotional: boolean;
  preference: boolean;
  savedAt: string;
};

type EditablePrefs = {
  functional: true;
  promotional: boolean;
  preference: boolean;
};

const DEFAULT_PREFS: EditablePrefs = {
  functional: true,
  promotional: false,
  preference: false,
};

function readPrefs(): StoredPrefs | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredPrefs;
  } catch {
    return null;
  }
}

function writePrefs(prefs: EditablePrefs) {
  if (typeof window === 'undefined') return;
  try {
    const full: StoredPrefs = { ...prefs, savedAt: new Date().toISOString() };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(full));
  } catch {
    /* ignore — private browsing, quota full, etc. */
  }
}

/** Global re-open hook — call from the footer / nav to surface the
 *  settings modal even after the user already saved a preference. */
export function openCookieSettings() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OPEN_SETTINGS_EVENT));
}

type Tab = 'settings' | 'what' | 'why';

export function CookieConsent() {
  const [mounted, setMounted] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [tab, setTab] = useState<Tab>('settings');
  const [prefs, setPrefs] = useState<EditablePrefs>(DEFAULT_PREFS);

  // Auto-open the bottom banner ONLY when no preference is saved yet.
  // Once the user clicks Save / Accept All from either the banner or
  // the modal, the localStorage entry suppresses every subsequent
  // auto-open — the user can still re-surface the modal via the footer
  // 'Cookie Settings' link, but the page no longer interrupts them.
  useEffect(() => {
    setMounted(true);
    const existing = readPrefs();
    if (existing) {
      setPrefs({
        functional: true,
        promotional: existing.promotional,
        preference: existing.preference,
      });
      return;
    }
    // No saved preference → schedule the banner 600 ms after first
    // paint so the splash overlay finishes first.
    const t = window.setTimeout(() => setShowBanner(true), 600);
    return () => window.clearTimeout(t);
  }, []);

  // Listen for footer/nav-triggered open events.
  useEffect(() => {
    const handler = () => setShowModal(true);
    window.addEventListener(OPEN_SETTINGS_EVENT, handler);
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, handler);
  }, []);

  // Lock body scroll while modal open.
  useEffect(() => {
    if (!showModal) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowModal(false); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [showModal]);

  const acceptAll = () => {
    const all: EditablePrefs = { functional: true, promotional: true, preference: true };
    setPrefs(all);
    writePrefs(all);
    setShowBanner(false);
    setShowModal(false);
  };

  const saveAndClose = () => {
    writePrefs(prefs);
    setShowBanner(false);
    setShowModal(false);
  };

  // Closing the modal without explicitly saving leaves localStorage
  // empty — the banner will reappear on the next visit, which is the
  // ePrivacy "no implicit consent" requirement.
  const dismiss = () => setShowModal(false);

  const openModalFromBanner = () => {
    setShowBanner(false);
    setShowModal(true);
  };

  if (!mounted) return null;

  return (
    <>
      {/* Bottom-fixed banner — first surface on first visit. */}
      <AnimatePresence>
        {showBanner && !showModal && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-0 left-0 right-0 z-[240]"
            role="dialog"
            aria-label="Cookie consent"
          >
            <div
              className="w-full px-4 sm:px-8 lg:px-12 py-5 sm:py-6 flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6"
              style={{
                background: '#ffffff',
                borderTop: '1px solid rgba(225, 32, 25,0.45)',
                boxShadow: '0 -10px 40px rgba(0,0,0,0.55)',
              }}
            >
              <div
                className="size-14 shrink-0 rounded-xl flex items-center justify-center"
                style={{
                  background: 'var(--mk-accent-soft)',
                  border: '1px solid rgba(225, 32, 25,0.4)',
                }}
              >
                <Cookie className="size-6" style={{ color: 'var(--mk-accent)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <h3
                  className="font-display uppercase tracking-tight text-base sm:text-lg md:text-xl"
                  style={{ color: '#ffffff' }}
                >
                  We use cookies
                </h3>
                <p
                  className="mt-1.5 text-sm sm:text-base leading-relaxed"
                  style={{ color: 'var(--mk-text-muted)' }}
                >
                  Functional cookies keep your session secure. Promotional and preference cookies
                  are optional. See our{' '}
                  <a
                    href="/privacy"
                    className="underline-offset-2 hover:underline font-semibold"
                    style={{ color: 'var(--mk-accent)' }}
                  >
                    Privacy Policy
                  </a>{' '}
                  for details.
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0 w-full md:w-auto">
                <button
                  type="button"
                  onClick={openModalFromBanner}
                  className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-wider hover:opacity-90 transition-opacity"
                  style={{
                    color: 'var(--mk-text)',
                    background: 'transparent',
                    border: '1px solid var(--mk-line-strong)',
                  }}
                >
                  <Settings className="size-4" /> Manage
                </button>
                <button
                  type="button"
                  onClick={acceptAll}
                  className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold uppercase tracking-wider hover:opacity-90 transition-opacity"
                  style={{ background: 'var(--mk-accent)', color: '#ffffff' }}
                >
                  Accept All <Check className="size-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full cookie-settings dialog. */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[250] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) dismiss(); }}
            role="dialog"
            aria-modal="true"
            aria-label="Your cookie settings"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-2xl max-h-[80vh] rounded-3xl flex flex-col overflow-hidden"
              style={{
                background: '#ffffff',
                border: '1px solid rgba(225, 32, 25,0.35)',
                boxShadow: '0 30px 80px rgba(0,0,0,0.7)',
              }}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between px-5 sm:px-6 py-4 sm:py-5"
                style={{ borderBottom: '1px solid var(--mk-line)' }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="size-10 rounded-xl flex items-center justify-center"
                    style={{
                      background: 'var(--mk-accent-soft)',
                      border: '1px solid rgba(225, 32, 25,0.4)',
                    }}
                  >
                    <Cookie className="size-5" style={{ color: 'var(--mk-accent)' }} />
                  </div>
                  <h2
                    className="font-display uppercase tracking-tight text-base sm:text-lg"
                    style={{ color: '#ffffff' }}
                  >
                    Your Cookie Settings
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="size-9 rounded-full flex items-center justify-center hover:opacity-80 transition-opacity"
                  style={{ color: 'var(--mk-text-faint)', background: 'var(--mk-surface)' }}
                  aria-label="Close"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Tabs — pill style, no border-bottom clipping. Wraps on
                  narrow screens so 'Why are Cookies Useful?' never goes
                  off-canvas. */}
              <div
                className="flex flex-wrap gap-1.5 px-5 sm:px-6 py-3"
                style={{ borderBottom: '1px solid var(--mk-line)' }}
              >
                {(
                  [
                    ['settings', 'Change Settings'],
                    ['what',     'What are Cookies?'],
                    ['why',      'Why are Cookies Useful?'],
                  ] as const
                ).map(([key, label]) => {
                  const active = tab === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setTab(key)}
                      className="px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap"
                      style={{
                        color: active ? 'var(--mk-accent)' : 'var(--mk-text-muted)',
                        background: active ? 'var(--mk-accent-soft)' : 'transparent',
                        border: active
                          ? '1px solid var(--mk-accent-line)'
                          : '1px solid var(--mk-line)',
                      }}
                      aria-pressed={active}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5">
                {tab === 'settings' && <SettingsTab prefs={prefs} setPrefs={setPrefs} />}
                {tab === 'what' && <WhatTab />}
                {tab === 'why' && <WhyTab />}
              </div>

              {/* Footer */}
              <div
                className="px-5 sm:px-6 py-4 flex flex-col sm:flex-row gap-3 sm:justify-end"
                style={{ borderTop: '1px solid var(--mk-line)' }}
              >
                <button
                  type="button"
                  onClick={saveAndClose}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-2.5 text-xs font-semibold uppercase tracking-wider hover:opacity-90 transition-opacity"
                  style={{
                    color: 'var(--mk-text)',
                    background: 'transparent',
                    border: '1px solid var(--mk-line-strong)',
                  }}
                >
                  Save Settings and Close
                </button>
                <button
                  type="button"
                  onClick={acceptAll}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-2.5 text-xs font-semibold uppercase tracking-wider hover:opacity-90 transition-opacity"
                  style={{ background: 'var(--mk-accent)', color: '#ffffff' }}
                >
                  Enable All Cookies and Close <Check className="size-3.5" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ── Tabs ─────────────────────────────────────────────────────────── */

function SettingsTab({
  prefs,
  setPrefs,
}: {
  prefs: EditablePrefs;
  setPrefs: (p: EditablePrefs) => void;
}) {
  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed" style={{ color: 'var(--mk-text-muted)' }}>
        Please select which types of cookies you would like {BRAND_NAME} to store on your device.
      </p>

      <CookieRow
        title="Functional Cookies"
        required
        on
        status="Always Active"
        description={`These cookies are essential for the operation of the ${BRAND_NAME} website, Client Portal, Partner Portal, and trading services. Without these cookies, certain features and services may not function correctly.`}
        examples={[
          'User authentication',
          'Login session management',
          'Security verification',
          'Fraud prevention',
          'Platform performance and stability',
        ]}
        trailing="These cookies cannot be disabled because they are necessary for the provision of our services."
      />

      <CookieRow
        title="Promotional Cookies"
        on={prefs.promotional}
        onToggle={() => setPrefs({ ...prefs, promotional: !prefs.promotional })}
        status="Optional"
        description={`Promotional cookies are used to track visitors across websites and marketing channels. These cookies help ${BRAND_NAME} measure advertising performance, evaluate partner campaigns, and display relevant promotional content.`}
        examples={[
          'Affiliate tracking',
          'Introducing Broker tracking',
          'Advertising campaign measurement',
          'Marketing attribution',
          'Retargeting and remarketing activities',
        ]}
        trailing={`These cookies may be placed by ${BRAND_NAME} or approved third-party advertising providers.`}
      />

      <CookieRow
        title="Preference Cookies"
        on={prefs.preference}
        onToggle={() => setPrefs({ ...prefs, preference: !prefs.preference })}
        status="Optional"
        description={`Preference cookies enable ${BRAND_NAME} to remember information that changes the way our website behaves or appears.`}
        examples={[
          'Language preferences',
          'Regional settings',
          'User interface customization',
          'Trading dashboard preferences',
          'Website display settings',
        ]}
        trailing="These cookies help provide a more personalized user experience."
      />
    </div>
  );
}

function WhatTab() {
  return (
    <div className="space-y-4 text-sm leading-relaxed" style={{ color: 'var(--mk-text-muted)' }}>
      <h3
        className="font-display uppercase tracking-tight text-lg"
        style={{ color: '#ffffff' }}
      >
        What are Cookies?
      </h3>
      <p>
        Cookies are small text files that are stored on your computer, mobile device, or tablet when
        you visit a website. They help websites recognize your device and remember information about
        your visit.
      </p>
      <p>
        Cookies may be temporary (session cookies) that expire when you close your browser, or
        persistent cookies that remain on your device for a specified period.
      </p>
      <p>
        {BRAND_NAME} uses cookies to improve security, enhance functionality, analyze website
        performance, and provide a better overall user experience.
      </p>
    </div>
  );
}

function WhyTab() {
  return (
    <div className="space-y-4 text-sm leading-relaxed" style={{ color: 'var(--mk-text-muted)' }}>
      <h3
        className="font-display uppercase tracking-tight text-lg"
        style={{ color: '#ffffff' }}
      >
        Why are Cookies Useful?
      </h3>
      <p>Cookies help {BRAND_NAME} provide secure, efficient, and personalized services.</p>
      <div>
        <p className="font-semibold mb-2" style={{ color: 'var(--mk-text)' }}>
          They allow us to:
        </p>
        <ul className="space-y-1.5 ml-1">
          {[
            'Maintain secure login sessions',
            'Protect client accounts against unauthorized access',
            'Improve website performance',
            'Remember user preferences',
            'Analyze website usage patterns',
            'Measure marketing effectiveness',
            'Enhance the overall client experience',
          ].map((p) => (
            <li key={p} className="flex items-start gap-2">
              <span
                aria-hidden
                className="size-1.5 mt-2 rounded-full shrink-0"
                style={{ background: 'var(--mk-accent)' }}
              />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </div>
      <p>
        Cookies also help us comply with security, regulatory, and operational requirements
        applicable to financial services providers.
      </p>
      <p>
        By understanding how visitors interact with our website, we can continually improve our
        products, trading services, and customer support experience.
      </p>
    </div>
  );
}

/* ── Primitives ───────────────────────────────────────────────────── */

function CookieRow({
  title,
  on,
  onToggle,
  required,
  status,
  description,
  examples,
  trailing,
}: {
  title: string;
  on: boolean;
  onToggle?: () => void;
  required?: boolean;
  status: string;
  description: string;
  examples: string[];
  trailing?: string;
}) {
  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: 'var(--mk-surface)',
        border: '1px solid var(--mk-line)',
      }}
    >
      <div className="flex items-start sm:items-center justify-between gap-4 mb-3">
        <h3
          className="font-semibold text-base flex items-center gap-2 flex-wrap"
          style={{ color: '#ffffff' }}
        >
          {title}
          {required && (
            <span
              className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full"
              style={{
                color: 'var(--mk-accent)',
                background: 'var(--mk-accent-soft)',
                border: '1px solid rgba(225, 32, 25,0.4)',
              }}
            >
              Required
            </span>
          )}
        </h3>
        <Toggle on={on} disabled={required} onClick={onToggle} />
      </div>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--mk-text-muted)' }}>
        {description}
      </p>
      <div className="mt-3">
        <p className="text-[11px] uppercase tracking-[0.14em] mb-1.5" style={{ color: 'var(--mk-text-faint)' }}>
          Examples
        </p>
        <ul className="space-y-1 text-sm" style={{ color: 'var(--mk-text-muted)' }}>
          {examples.map((e) => (
            <li key={e} className="flex items-start gap-2">
              <span
                aria-hidden
                className="size-1.5 mt-2 rounded-full shrink-0"
                style={{ background: 'var(--mk-accent)' }}
              />
              <span>{e}</span>
            </li>
          ))}
        </ul>
      </div>
      {trailing && (
        <p
          className="mt-3 text-xs leading-relaxed italic"
          style={{ color: 'var(--mk-text-faint)' }}
        >
          {trailing}
        </p>
      )}
      <p className="mt-3 text-xs">
        <span style={{ color: 'var(--mk-text-faint)' }}>Status: </span>
        <span
          className="font-semibold"
          style={{ color: required ? 'var(--mk-accent)' : 'var(--mk-text)' }}
        >
          {status}
        </span>
      </p>
    </div>
  );
}

/**
 * iOS-style pill toggle — classic Tailwind / Headless-UI pattern.
 *
 * Track is `inline-flex items-center` so the knob (an inline-block span)
 * sits vertically centred without needing absolute positioning. Sliding
 * is done with `translate-x` rather than left/top so it never drifts past
 * the track edge on any browser. The required (Functional) row disables
 * the button + dims it; the other two rows toggle through onClick.
 */
function Toggle({
  on,
  onClick,
  disabled,
}: {
  on: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${
        disabled ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'
      }`}
      style={{
        background: on ? 'var(--mk-accent)' : 'var(--mk-line-strong)',
        border: '1px solid var(--mk-line)',
      }}
    >
      <span
        aria-hidden
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
          on ? 'translate-x-6' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}
