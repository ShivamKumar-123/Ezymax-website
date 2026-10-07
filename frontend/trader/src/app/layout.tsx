import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Suspense } from 'react';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from '@/components/ThemeProvider';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import { AuthProvider } from '@/components/providers/AuthProvider';
import GoogleAuthProvider from '@/components/providers/GoogleAuthProvider';
import NotificationListener from '@/components/NotificationListener';
import ProfileCompleteGate from '@/components/profile/ProfileCompleteGate';
import OnboardingGate from '@/components/auth/OnboardingGate';
import OnboardingTourLazy from '@/components/Onboarding/OnboardingTourLazy';
import TopLoader from '@/components/TopLoader';
import PWARegister from '@/components/PWARegister';

const SHARE_DESCRIPTION =
  'Trade CFDs while your funds stay in a smart contract you control — only open-trade margin is locked, the rest stays withdrawable.';

export const metadata: Metadata = {
  // Makes the relative share image below resolve to an absolute URL, which
  // every social scraper requires.
  metadataBase: new URL('https://trade.ezymex.com'),
  title: 'Ezymex',
  description: 'Ezymex — professional forex and CFD trading platform',
  applicationName: 'Ezymex',
  manifest: '/manifest.webmanifest',
  // Without these, a shared link showed whatever image the scraper found first
  // on the page.
  openGraph: {
    type: 'website',
    siteName: 'Ezymex',
    title: 'Ezymex — trade with your funds still yours',
    description: SHARE_DESCRIPTION,
    url: '/',
    images: [{ url: '/open-graph.png', width: 1200, height: 630 }],
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ezymex — trade with your funds still yours',
    description: SHARE_DESCRIPTION,
    images: ['/open-graph.png'],
  },
  // Drives iOS "Add to Home Screen": standalone launch, app title, status bar.
  appleWebApp: {
    capable: true,
    title: 'Ezymex',
    // 'default' = the iOS status bar keeps its own space (does NOT overlay
    // content), so no page's top is ever hidden under the notch/clock.
    statusBarStyle: 'default',
  },
  icons: {
    icon: [{ url: '/images/ezymex_icon.png', type: 'image/png' }],
    apple: [{ url: '/images/ezymex_icon.png' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // `cover` lets the app paint under the notch / home indicator; components use
  // env(safe-area-inset-*) so nothing is hidden behind them on iPhone.
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/images/ezymex_icon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/images/ezymex_icon.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var L='ezymex-ui',N='ezymex-ui';var o=localStorage.getItem(L),n=localStorage.getItem(N);if(o&&!n){localStorage.setItem(N,o);localStorage.removeItem(L);}var s=localStorage.getItem(N);var t='dark';if(s){var j=JSON.parse(s);t=(j&&j.state&&j.state.theme)||(j&&j.theme)||'dark';}var d=document.documentElement;d.setAttribute('data-theme',t);d.classList.add(t==='light'?'theme-light':'theme-dark');if(t==='light'){d.style.backgroundColor='#ffffff';d.style.color='#111827';}else{d.style.backgroundColor='#0a0a0a';d.style.color='#ffffff';}}catch(e){document.documentElement.setAttribute('data-theme','light');document.documentElement.style.backgroundColor='#ffffff';document.documentElement.style.color='#111827';}})();`,
          }}
        />
      </head>
      <body className="min-h-full" suppressHydrationWarning>
        <Suspense fallback={null}>
          <TopLoader />
        </Suspense>
        <PWARegister />
        <ThemeProvider>
          <AuthProvider>
            <GoogleAuthProvider>
            <NotificationListener />
            {/* Two-stage onboarding gate. ProfileCompleteGate enforces the
                profile-fields step (always renders first if profile is
                incomplete); OnboardingGate then enforces wallet + email
                verification on top. Order matters: only one of them ever
                shows at a time, and they chain — finish the profile, then
                the wallet/email gate kicks in. Both are non-dismissible. */}
            <ProfileCompleteGate />
            <OnboardingGate />
            {/* First-time product tour (react-joyride). Renders after the
                onboarding gates so it only runs once dashboard access is
                unlocked. Lazy/ssr:false → not in the main bundle. */}
            <OnboardingTourLazy />
            {children}
            <Suspense fallback={null}>
              <MobileBottomNav />
            </Suspense>
            <Toaster
              position="top-center"
              containerClassName="ezymex-toaster"
              gutter={10}
              toastOptions={{
                duration: 2500,
                className: 'ezymex-hot-toast',
                // maxWidth caps the toast at a readable column so long
                // backend error messages (e.g. balance-gate copy) wrap
                // onto a second line instead of stretching across the
                // chart and overlapping other UI. Tested down to 320 px
                // mobile widths — copy still readable.
                style: {
                  background: 'var(--toast-bg)',
                  color: 'var(--toast-fg)',
                  border: '1px solid var(--toast-border)',
                  maxWidth: '380px',
                  lineHeight: 1.4,
                },
                success: {
                  duration: 2200,
                  className: 'ezymex-hot-toast',
                  // White check on a gold disc reads as "good" instantly on
                  // dark surface without losing the brand accent.
                  iconTheme: { primary: '#1E88FF', secondary: '#1a1408' },
                },
                error: {
                  duration: 4000,
                  className: 'ezymex-hot-toast',
                  // White X on a saturated red disc — high contrast on the
                  // dark toast background, no fade-out into the BG colour.
                  iconTheme: { primary: '#ef4444', secondary: '#ffffff' },
                },
                loading: {
                  duration: Infinity,
                  className: 'ezymex-hot-toast',
                  iconTheme: { primary: '#1E88FF', secondary: 'var(--toast-bg)' },
                },
              }}
            />
            </GoogleAuthProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
