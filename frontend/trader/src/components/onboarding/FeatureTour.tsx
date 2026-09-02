'use client';

/**
 * FeatureTour — a first-login spotlight walkthrough.
 *
 * On the very first time a user (real or demo) lands on the dashboard,
 * this dims the screen and points, step by step, at the real navigation
 * buttons ("this is where you deposit", "open the trading terminal
 * here", …) so they learn the main features.
 *
 * Anchoring: each step targets an element by `data-tour="<key>"`
 * (added in AppNavbar / DashboardShell). If the target isn't on screen
 * for the current viewport (e.g. the primary nav is behind the hamburger
 * on mobile, or the item lives in a closed dropdown), the step gracefully
 * falls back to a centered description card so the user still learns what
 * the feature does.
 *
 * "Seen once" is tracked per-user in localStorage, so it shows exactly
 * once per device and never blocks a returning user. Users can replay it
 * later (Profile → "Replay tour") by clearing that key — see
 * `resetFeatureTour()`.
 */

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useWarmTheme } from '@/stores/warmThemeStore';

const STORAGE_PREFIX = 'sc-feature-tour:v1:';

type Step = {
  key: string;
  /** data-tour target. Omit for an intentionally centered step (intro/outro). */
  selector?: string;
  title: string;
  body: string;
};

const STEPS: readonly Step[] = [
  {
    key: 'welcome',
    title: 'Welcome 👋',
    body: "Here's a 30-second tour of the main features. You can skip anytime.",
  },
  {
    key: 'home',
    selector: '[data-tour="home"]',
    title: 'Home',
    body: 'Your dashboard — account balance, open positions and a quick snapshot of everything.',
  },
  {
    key: 'accounts',
    selector: '[data-tour="accounts"]',
    title: 'Accounts',
    body: 'Open and manage your trading accounts here — both live and demo.',
  },
  {
    key: 'funds',
    selector: '[data-tour="funds"]',
    title: 'Funds',
    body: 'Deposit, withdraw, and transfer money between your accounts.',
  },
  {
    key: 'deposit',
    selector: '[data-tour="deposit"]',
    title: 'Deposit',
    body: 'Add money here to start trading with real funds. Crypto and card options are supported.',
  },
  {
    key: 'trade',
    selector: '[data-tour="trade"]',
    title: 'Trade',
    body: 'Open the trading terminal (under “More”) to buy and sell FX, gold, indices and crypto.',
  },
  {
    key: 'social',
    selector: '[data-tour="social"]',
    title: 'Copy Trading',
    body: 'Automatically copy expert traders and join PAMM strategies — hands-free investing.',
  },
  {
    key: 'affiliates',
    selector: '[data-tour="affiliates"]',
    title: 'Affiliates',
    body: 'Refer friends and earn commissions as an Introducing Broker.',
  },
  {
    key: 'kyc',
    selector: '[data-tour="kyc"]',
    title: 'Verify (KYC)',
    body: 'Complete KYC (under “More”) to unlock withdrawals and all account features.',
  },
  {
    key: 'support',
    selector: '[data-tour="support"]',
    title: 'Support',
    body: "Stuck? Tap the chat button anytime and our team will help you out. That's it — happy trading!",
  },
];

/** Clear the "seen" flag so the tour replays on next dashboard visit. */
export function resetFeatureTour(userId?: string | null) {
  try {
    if (userId) localStorage.removeItem(`${STORAGE_PREFIX}${userId}`);
  } catch {
    /* ignore */
  }
}

type Rect = { top: number; left: number; width: number; height: number };

export default function FeatureTour() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  // Drives the warm-dark token set inside the portal (see the render root).
  const warmDark = useWarmTheme((st) => st.dark);
  const userId = user?.id ?? null;

  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => setMounted(true), []);

  const storageKey = userId ? `${STORAGE_PREFIX}${userId}` : null;

  // OnboardingGate owns the screen while the email is unverified — starting
  // the tour then stacks two modals on top of each other (worst on phones).
  // Wait for the flag to flip; refreshUser() re-runs this effect.
  // (ProfileCompleteGate no longer renders globally — it lives on /kyc —
  // so profile_complete is deliberately NOT part of this check.)
  const onboardingGateOpen =
    !!user && !user.is_demo && user.email_verified === false;

  // Auto-start once, on the dashboard, for a user who hasn't seen it.
  useEffect(() => {
    if (!mounted || !storageKey) return;
    if (onboardingGateOpen) return;
    // Only kick off on the dashboard so the primary nav is on screen to
    // point at. First login redirects here, so this is the natural spot.
    if (pathname !== '/dashboard') return;
    let seen = false;
    try {
      seen = localStorage.getItem(storageKey) === '1';
    } catch {
      seen = true; // storage blocked — don't nag
    }
    if (seen) return;
    // Small delay so the nav has painted and rects are measurable.
    const t = setTimeout(() => {
      setIndex(0);
      setActive(true);
    }, 700);
    return () => clearTimeout(t);
  }, [mounted, storageKey, pathname, onboardingGateOpen]);

  const finish = useCallback(() => {
    setActive(false);
    try {
      if (storageKey) localStorage.setItem(storageKey, '1');
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  const step = STEPS[index];

  // Measure the current step's target. Re-measured on step change, resize
  // and scroll. A missing / zero-size element (hidden nav, closed dropdown)
  // yields null → the card renders centered.
  const measure = useCallback(() => {
    if (!active || !step?.selector) {
      setRect(null);
      return;
    }
    const el = document.querySelector(step.selector) as HTMLElement | null;
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) {
      setRect(null);
      return;
    }
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [active, step]);

  useEffect(() => {
    measure();
  }, [measure, index]);

  useEffect(() => {
    if (!active) return;
    const onChange = () => measure();
    window.addEventListener('resize', onChange);
    window.addEventListener('scroll', onChange, true);
    return () => {
      window.removeEventListener('resize', onChange);
      window.removeEventListener('scroll', onChange, true);
    };
  }, [active, measure]);

  const isLast = index === STEPS.length - 1;
  const next = useCallback(() => {
    if (isLast) finish();
    else setIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }, [isLast, finish]);
  const back = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), []);

  // Keyboard: Esc closes, arrows navigate.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, finish, next, back]);

  // Card placement: below the target if there's room, else above; centered
  // when there's no target.
  const cardStyle = useMemo<CSSProperties>(() => {
    const CARD_W = 320;
    const GAP = 14;
    if (!rect) {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: `min(${CARD_W}px, calc(100vw - 32px))`,
      };
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const placeBelow = rect.top + rect.height < vh * 0.6;
    const top = placeBelow ? rect.top + rect.height + GAP : undefined;
    const bottom = placeBelow ? undefined : vh - rect.top + GAP;
    let left = rect.left;
    left = Math.max(16, Math.min(left, vw - CARD_W - 16));
    return {
      top,
      bottom,
      left,
      width: `min(${CARD_W}px, calc(100vw - 32px))`,
    };
  }, [rect]);

  if (!mounted || !active || !step) return null;

  const HIGHLIGHT_PAD = 6;

  return createPortal(
    // The portal escapes the DashboardShell wrapper that carries the warm
    // theme tokens, so re-apply them here — same as Modal. Without this the
    // `--crx-*` variables are undefined and `--text-*` falls back to the
    // LIGHT palette from <html>: near-black text and a transparent card over
    // the dark app, i.e. an unreadable box with invisible dots and buttons.
    <div
      data-theme="warm"
      className={`theme-warm font-crextio fixed inset-0 z-[9998]${warmDark ? ' theme-warm-dark' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Feature tour"
    >
      {/* Full-screen click blocker. When there's no target it also provides
          the dim; with a target the spotlight box below supplies the dim. */}
      <div className={rect ? 'absolute inset-0' : 'absolute inset-0 bg-black/60'} onClick={(e) => e.stopPropagation()} />

      {/* Spotlight hole + ring around the live target (box-shadow dims the
          rest of the screen through the "hole"). */}
      {rect && (
        <div
          className="pointer-events-none absolute rounded-xl ring-2 ring-crx-yellow transition-all duration-200"
          style={{
            top: rect.top - HIGHLIGHT_PAD,
            left: rect.left - HIGHLIGHT_PAD,
            width: rect.width + HIGHLIGHT_PAD * 2,
            height: rect.height + HIGHLIGHT_PAD * 2,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)',
          }}
        />
      )}

      {/* Instruction card */}
      <div
        className="absolute z-[10000] rounded-2xl border border-border-primary bg-bg-tertiary p-5 shadow-2xl"
        style={cardStyle}
      >
        <button
          type="button"
          onClick={finish}
          aria-label="Skip tour"
          className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full text-text-tertiary hover:bg-bg-hover hover:text-text-primary transition-colors"
        >
          <X size={16} />
        </button>

        <h3 className="pr-6 text-base font-bold text-text-primary">{step.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">{step.body}</p>

        {/* Progress dots */}
        <div className="mt-4 flex items-center gap-1.5">
          {STEPS.map((s, i) => (
            <span
              key={s.key}
              className={
                i === index
                  ? 'h-1.5 w-4 rounded-full bg-crx-yellow transition-all'
                  : 'h-1.5 w-1.5 rounded-full bg-border-secondary transition-all'
              }
            />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={finish}
            className="text-xs font-medium text-text-tertiary hover:text-text-primary transition-colors"
          >
            Skip
          </button>
          <div className="flex items-center gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={back}
                className="inline-flex items-center gap-1 rounded-full border border-border-primary px-4 py-1.5 text-sm font-medium text-text-primary hover:bg-bg-hover transition-colors"
              >
                <ArrowLeft size={14} />
                Back
              </button>
            )}
            <button
              type="button"
              onClick={next}
              className="inline-flex items-center gap-1 rounded-full bg-crx-charcoal px-4 py-1.5 text-sm font-semibold text-crx-charcoal-ink hover:bg-crx-charcoal-hover transition-colors"
            >
              {isLast ? 'Got it' : 'Next'}
              {!isLast && <ArrowRight size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
