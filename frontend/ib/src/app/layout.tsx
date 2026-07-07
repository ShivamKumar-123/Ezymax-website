import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  title: 'FXArtha — IB Partner Portal',
  description: 'Introducing Broker partner portal',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

const THEME_INIT = `(function(){try{var t=localStorage.getItem('ib-theme')||'dark';var e=document.documentElement;e.setAttribute('data-theme',t);e.classList.toggle('theme-dark',t==='dark');}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className="theme-dark" suppressHydrationWarning>
      <head>
        {/* Apply the saved theme before paint to avoid a flash of the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="bg-bg-base text-text-primary antialiased">
        {children}
        <Toaster position="top-center" toastOptions={{ style: { background: 'var(--bg-card, #111)', color: 'var(--text-primary, #fff)', border: '1px solid var(--border-primary, #262626)' } }} />
      </body>
    </html>
  );
}
