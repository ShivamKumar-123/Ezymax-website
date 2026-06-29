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

export const metadata: Metadata = {
  title: 'FXArtha',
  description: 'FXArtha — professional forex and CFD trading platform',
  icons: {
    icon: [{ url: '/images/fxartha_icon.png', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#ffffff',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/images/fxartha_icon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/images/fxartha_icon.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var L='fxartha-ui',N='fxartha-ui';var o=localStorage.getItem(L),n=localStorage.getItem(N);if(o&&!n){localStorage.setItem(N,o);localStorage.removeItem(L);}var s=localStorage.getItem(N);var t='dark';if(s){var j=JSON.parse(s);t=(j&&j.state&&j.state.theme)||(j&&j.theme)||'dark';}var d=document.documentElement;d.setAttribute('data-theme',t);d.classList.add(t==='light'?'theme-light':'theme-dark');if(t==='light'){d.style.backgroundColor='#ffffff';d.style.color='#111827';}else{d.style.backgroundColor='#0a0a0a';d.style.color='#ffffff';}}catch(e){document.documentElement.setAttribute('data-theme','light');document.documentElement.style.backgroundColor='#ffffff';document.documentElement.style.color='#111827';}})();`,
          }}
        />
      </head>
      <body className="min-h-full" suppressHydrationWarning>
        <Suspense fallback={null}>
          <TopLoader />
        </Suspense>
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
              containerClassName="fxartha-toaster"
              gutter={10}
              toastOptions={{
                duration: 2500,
                className: 'fxartha-hot-toast',
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
                  className: 'fxartha-hot-toast',
                  // White check on a gold disc reads as "good" instantly on
                  // dark surface without losing the brand accent.
                  iconTheme: { primary: '#d6a93d', secondary: '#1a1408' },
                },
                error: {
                  duration: 4000,
                  className: 'fxartha-hot-toast',
                  // White X on a saturated red disc — high contrast on the
                  // dark toast background, no fade-out into the BG colour.
                  iconTheme: { primary: '#ef4444', secondary: '#ffffff' },
                },
                loading: {
                  duration: Infinity,
                  className: 'fxartha-hot-toast',
                  iconTheme: { primary: '#d6a93d', secondary: 'var(--toast-bg)' },
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
