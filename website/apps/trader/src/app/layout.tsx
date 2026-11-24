import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono, Inter_Tight, Doto } from 'next/font/google';
import './globals.css';
import Nav from '@/components/chrome/Nav';
import Footer from '@/components/chrome/Footer';
import GoogleTranslate from '@/components/chrome/GoogleTranslate';
import SmoothScroll from '@/components/motion/SmoothScroll';
import RevealRoot, { REVEAL_BOOT } from '@/components/motion/RevealRoot';
import CampaignForwarder from '@/components/util/CampaignForwarder';
import OfferPopup from '@/components/util/OfferPopup';
import { BRAND_NAME, BRAND_SUPPORT_EMAIL, SITE_URL } from '@/lib/brand';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist', display: 'swap' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', display: 'swap', preload: false });
const display = Inter_Tight({ subsets: ['latin'], weight: ['500', '600'], variable: '--font-display', display: 'swap' });
const pixel = Doto({ subsets: ['latin'], weight: ['800', '900'], variable: '--font-pixel', display: 'swap', preload: false });

const TITLE = `${BRAND_NAME}: forex options, CFDs and copy trading on one account`;
const DESCRIPTION =
  'Global multi-asset trading platform: Ezymex FX Options on forex, gold and oil, 1,389 CFD instruments, copy trading and PAMM, in 22 languages.';

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

/* Organization + WebSite structured data. Google wants a raster logo of at least 112px; the SVG mark is kept for
   the page itself. sameAs lists the official profiles so search engines tie them to this site. */
const ORG_LD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: BRAND_NAME,
  url: SITE_URL,
  logo: { '@type': 'ImageObject', url: `${SITE_URL}/icons/icon-512.png`, width: 512, height: 512 },
  email: BRAND_SUPPORT_EMAIL,
  contactPoint: [{ '@type': 'ContactPoint', contactType: 'customer support', email: BRAND_SUPPORT_EMAIL, availableLanguage: ['en'] }],
  sameAs: ['https://www.facebook.com/61595944184306', 'https://www.instagram.com/ezymex.official/'],
};

const SITE_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  name: BRAND_NAME,
  url: SITE_URL,
  description: DESCRIPTION,
  inLanguage: 'en',
  publisher: { '@id': `${SITE_URL}/#organization` },
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
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SITE_LD) }} />
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
        <OfferPopup />
        <GoogleTranslate />
      </body>
    </html>
  );
}
