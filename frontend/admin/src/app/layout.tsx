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
  title: 'FXArtha Admin',
  description: 'FXArtha broker administration panel',
  // Browser-tab favicon. The admin app shipped without any icon declared
  // (no app/favicon.ico, no metadata.icons), so tabs fell back to Chrome's
  // default globe. Point every slot at the existing public/logo.png.
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable} style={{ ['--font-jetbrains' as string]: "ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace" }}>
      <body className={`${inter.className} min-h-screen bg-bg-page text-text-primary antialiased`} suppressHydrationWarning>
        <ThemeInitScript />
        {children}
        <AppToaster />
      </body>
    </html>
  );
}
