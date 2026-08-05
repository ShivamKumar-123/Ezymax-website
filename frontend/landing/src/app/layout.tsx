import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";

import {
  generateMetadata,
  generateViewport,
} from "@/utils/seo/generate-page-metadata";
import { getSiteStructuredData } from "@/utils/seo/structured-data";

import { LazyCookie } from "@/components/common/Cookie";
import { Header } from "@/components/common/chrome/header";
import { NavMenu } from "@/components/common/chrome/nav-menu";
import { RequestModal } from "@/components/common/chrome/request-modal";
import { WaitlistModal } from "@/components/common/chrome/waitlist-modal";
import { WaitlistAutoOpen } from "@/components/common/waitlist-auto-open";
import { SiteFooter } from "@/components/common/chrome/site-footer";
import { AdaptiveGrid } from "@/components/common/grid";
import { ReducedMotion } from "@/components/common/reduced-motion";
import { TubesCursor } from "@/components/common/tubes-cursor";
import { ScrollLayout } from "@/layouts/scroll-layout";

import { navPages } from "@/data/mocks/nav-pages";
import {
  footerContent,
  headerCta,
  modalContent,
  navGroups,
  navLabels,
} from "@/data/mocks/site";

import "@/app/globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = generateMetadata();
export const viewport: Viewport = generateViewport();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} font-sans`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(getSiteStructuredData()),
          }}
        />
        <ScrollLayout>
          <AdaptiveGrid />
          <ReducedMotion />
          <LazyCookie />
          <TubesCursor />
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-60 focus:rounded-control focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:text-white"
          >
            Skip to content
          </a>
          <Header />
          {children}
          <SiteFooter content={footerContent} />
          <NavMenu
            groups={navGroups}
            cta={headerCta}
            labels={navLabels}
            pages={navPages}
          />
          <RequestModal content={modalContent} />
          <WaitlistModal />
          <WaitlistAutoOpen />
        </ScrollLayout>
      </body>
    </html>
  );
}
