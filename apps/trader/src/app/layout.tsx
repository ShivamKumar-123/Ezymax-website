import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono, Inter_Tight, Doto } from 'next/font/google';
import './globals.css';
import Nav from '@/components/chrome/Nav';
import Footer from '@/components/chrome/Footer';
import GoogleTranslate from '@/components/chrome/GoogleTranslate';
import SmoothScroll from '@/components/motion/SmoothScroll';
import RevealRoot, { REVEAL_BOOT } from '@/components/motion/RevealRoot';
import CampaignForwarder from '@/components/util/CampaignForwarder';
import { BRAND_NAME, SITE_URL } from '@/lib/brand';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist', display: 'swap' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', display: 'swap', preload: false });
const display = Inter_Tight({ subsets: ['latin'], weight: ['500', '600'], variable: '--font-display', display: 'swap' });
const pixel = Doto({ subsets: ['latin'], weight: ['800', '900'], variable: '--font-pixel', display: 'swap', preload: false });

const TITLE = `${BRAND_NAME}: forex options, CFDs and copy trading on one account`;
const DESCRIPTION =
  'Ezymex is a global multi-asset trading platform: Ezymex FX Options with real option chains on forex, gold and oil, 1,389 CFD instruments, copy trading and PAMM, in 22 languages.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: `%s | ${BRAND_NAME}` },
  description: DESCRIPTION,
  applicationName: BRAND_NAME,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: BRAND_NAME,
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    locale: 'en_US',
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
  robots: { index: true, follow: true },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#07070a',
  colorScheme: 'dark',
};

const ORG_LD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: BRAND_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/brand/ezymex-mark.svg`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable} ${display.variable} ${pixel.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: REVEAL_BOOT }} />
        <link rel="preconnect" href="https://api.ezymex.com" crossOrigin="anonymous" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_LD) }} />
      </head>
      <body suppressHydrationWarning>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <Nav />
        <main id="main">{children}</main>
        <Footer />
        <div aria-hidden className="grain" />
        <SmoothScroll />
        <RevealRoot />
        <CampaignForwarder />
        <GoogleTranslate />
      </body>
    </html>
  );
}
