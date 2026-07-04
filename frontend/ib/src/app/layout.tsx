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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className="theme-dark">
      <body className="bg-bg-base text-text-primary antialiased">
        {children}
        <Toaster position="top-center" toastOptions={{ style: { background: '#111', color: '#fff', border: '1px solid #262626' } }} />
      </body>
    </html>
  );
}
