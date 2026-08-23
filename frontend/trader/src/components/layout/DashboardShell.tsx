'use client';

import { cn } from '@/lib/utils';
import AppNavbar from './AppNavbar';
import DashboardFooter from './DashboardFooter';
import SupportChatWidget from '@/components/support/SupportChatWidget';
import FeatureTour from '@/components/onboarding/FeatureTour';
import { useWarmTheme } from '@/stores/warmThemeStore';
import '@/styles/crextio.css';

/**
 * DashboardShell — top-navbar layout for the logged-in app pages.
 *
 * The Vantage-inspired redesign replaces the previous sidebar +
 * AppHeader pair with a single sticky horizontal AppNavbar. Content
 * sits in a max-w-[1600px] centered wrapper directly beneath — 1600 px
 * is wide enough that 4K/ultrawide users no longer see a narrow column
 * with huge empty margins, but still keeps long-form content readable.
 */
export default function DashboardShell({
  children,
  className,
  mainClassName,
}: {
  children: React.ReactNode;
  className?: string;
  mainClassName?: string;
}) {
  const dark = useWarmTheme((s) => s.dark);

  return (
    <div
      data-theme="warm"
      className={cn(
        // Crextio warm theme: cream canvas with butter glow, Poppins
        // type, token overrides scoped by .theme-warm (crextio.css).
        // `.theme-warm-dark` flips the token set to the charcoal
        // variant (navbar sun/moon toggle, persisted per browser).
        'theme-warm theme-warm-canvas font-crextio min-h-[100dvh] flex flex-col text-text-primary',
        dark && 'theme-warm-dark',
        className,
      )}
    >
      <AppNavbar />

      {/* No key={pathname} remount and no fade animation — pages swap
          instantly on navigation (0ms transition by design). */}
      <main
        className={cn(
          'dashboard-main-scroll flex-1',
          mainClassName,
        )}
      >
        {/* w-full is load-bearing: pages that set main to `flex flex-col`
            (e.g. /news) would otherwise let mx-auto shrink-wrap this box to
            its content's intrinsic width instead of stretching full-width.
            For default (block) pages w-full is a no-op. */}
        {/* Extra mobile bottom padding so the last row of buttons/cards can
            scroll clear of the fixed support FAB instead of sitting under it. */}
        <div className="mx-auto max-w-[1600px] w-full px-3 sm:px-4 lg:px-6 pt-4 sm:pt-6 pb-24 sm:pb-6">
          {children}
        </div>
        <DashboardFooter />
      </main>

      {/* Support bubble → in-app assistant (fixed setup answers, human
          hand-off via ticket). The full ticket page stays at /support. */}
      <SupportChatWidget />

      {/* First-login spotlight walkthrough (shows once per user). */}
      <FeatureTour />
    </div>
  );
}
