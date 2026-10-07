import React from 'react';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import ThemeInitScript from '@/components/ThemeInitScript';
import AppToaster from '@/components/AppToaster';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Ezymax Admin',
  description: 'Ezymax broker administration panel',
  // Same favicon as the trader app — the identical ezymax_icon.png asset,
  // declared the same way (metadata + explicit <head> links below).
  icons: {
    icon: [{ url: '/images/ezymax_icon.png', type: 'image/png' }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable} style={{ ['--font-jetbrains' as string]: "ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace" }}>
      <head>
        {/* Same favicon markup as the trader app so both tabs show the
            identical Ezymax icon instead of the browser default. */}
        <link rel="icon" href="/images/ezymax_icon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/images/ezymax_icon.png" />
      </head>
      <body className={`${inter.className} min-h-screen bg-bg-page text-text-primary antialiased`} suppressHydrationWarning>
        <ThemeInitScript />
        {children}
        <AppToaster />
      </body>
    </html>
  );
}
