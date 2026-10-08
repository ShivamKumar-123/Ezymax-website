import type { Metadata } from "next";
import { Inter, Manrope, Silkscreen, Space_Mono } from "next/font/google";
import "./globals.css";
import { site } from "@/content/site";
import { DemoProvider } from "@/components/forms/demo-context";
import { DemoModal } from "@/components/forms/DemoModal";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Preloader } from "@/components/layout/Preloader";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });
const silkscreen = Silkscreen({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-silkscreen", display: "swap" });
const spaceMono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-space-mono", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} | Brokerage Technology Partner`,
    template: `%s | ${site.name}`,
  },
  description: site.positioning,
  applicationName: site.name,
  openGraph: { siteName: site.name, type: "website", locale: "en_US" },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: site.name,
  legalName: site.legalName,
  url: site.url,
  logo: `${site.url}/brand/setupzero-wordmark-white.svg`,
  description: site.description,
  slogan: site.tagline,
  address: { "@type": "PostalAddress", addressLocality: "Dubai", addressCountry: "AE" },
  sameAs: site.socials.map((s) => s.href),
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${inter.variable} ${manrope.variable} ${silkscreen.variable} ${spaceMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
        <DemoProvider>
          <Preloader />
          <Header />
          <main className="relative z-[1] flex-1">{children}</main>
          <div className="relative z-[1]">
            <Footer />
          </div>
          <DemoModal />
        </DemoProvider>
      </body>
    </html>
  );
}
