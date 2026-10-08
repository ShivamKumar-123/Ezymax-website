import { Inter, Manrope, Silkscreen, Space_Mono } from "next/font/google";

import "./globals.css";

import { DemoModal } from "@/components/forms/DemoModal";
import { DemoProvider } from "@/components/forms/demo-context";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { Preloader } from "@/components/layout/Preloader";
import { site } from "@/content/site";
import {
  generateMetadata as buildMetadata,
  generateViewport as buildViewport,
} from "@/utils/seo/generate-page-metadata";
import { getSiteStructuredData } from "@/utils/seo/structured-data";

/**
 * The four families the design depends on. Fetched by next/font at BUILD time
 * and self-hosted, so the Docker builder stage needs network access — see the
 * note in the Dockerfile.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});
const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});
const silkscreen = Silkscreen({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-silkscreen",
  display: "swap",
});
const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
  display: "swap",
});

export const metadata = {
  ...buildMetadata({ description: site.positioning }),
  title: {
    default: `${site.name} | ${site.tagline}`,
    template: `%s | ${site.name}`,
  },
  applicationName: site.name,
};

export const viewport = buildViewport();

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${manrope.variable} ${silkscreen.variable} ${spaceMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(getSiteStructuredData()),
          }}
        />
        <DemoProvider>
          <Preloader />
          <Header />
          {/* z-[1] puts the page above the body's ambient gradients; the
              hero's absolutely-positioned glows rely on this stacking
              context, and the footer needs the same one to sit above them. */}
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
