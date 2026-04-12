import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Suspense } from 'react';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from '@/components/ThemeProvider';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import { AuthProvider } from '@/components/providers/AuthProvider';
import NotificationListener from '@/components/NotificationListener';
import TopLoader from '@/components/TopLoader';

export const metadata: Metadata = {
  title: 'TrustEdge',
  description: 'TrustEdge — professional forex and CFD trading platform',
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#F2EFE9',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var L='trustedge-ui',N='trustedge-ui';var o=localStorage.getItem(L),n=localStorage.getItem(N);if(o&&!n){localStorage.setItem(N,o);localStorage.removeItem(L);}var s=localStorage.getItem(N);var t='light';if(s){var j=JSON.parse(s);t=(j&&j.state&&j.state.theme)||(j&&j.theme)||'light';}var d=document.documentElement;d.setAttribute('data-theme',t);d.classList.add(t==='light'?'theme-light':'theme-dark');if(t==='light'){d.style.backgroundColor='#F2EFE9';d.style.color='#000000';}else{d.style.backgroundColor='#0a0a0a';d.style.color='#ffffff';}}catch(e){document.documentElement.setAttribute('data-theme','light');document.documentElement.style.backgroundColor='#F2EFE9';document.documentElement.style.color='#000000';}})();`,
          }}
        />
      </head>
      <body className="min-h-full">
        <Suspense fallback={null}>
          <TopLoader />
        </Suspense>
        <ThemeProvider>
          <AuthProvider>
            <NotificationListener />
            {children}
            <Suspense fallback={null}>
              <MobileBottomNav />
            </Suspense>
            <Toaster
              position="top-center"
              containerClassName="trustedge-toaster"
              toastOptions={{
                className: 'trustedge-hot-toast',
                style: {
                  background: 'var(--toast-bg)',
                  color: 'var(--toast-fg)',
                  border: '1px solid var(--toast-border)',
                  fontSize: '13px',
                  borderRadius: '12px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                },
                success: {
                  className: 'trustedge-hot-toast',
                  iconTheme: { primary: '#00e676', secondary: 'var(--toast-bg)' },
                },
                error: {
                  className: 'trustedge-hot-toast',
                  iconTheme: { primary: '#f87171', secondary: 'var(--toast-bg)' },
                },
                loading: { className: 'trustedge-hot-toast' },
              }}
            />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
