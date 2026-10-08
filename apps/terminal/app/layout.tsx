import { preconnect } from "react-dom";
import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { getI18n } from "@ezymex/i18n/server";
// subpath imports: a server layout importing the "@ezymex/ui" barrel ships every client module of it on every page
import { BrandProvider } from "@ezymex/ui/brand";
import { brandCss, isCustomBrand } from "@ezymex/ui/brand-vars";
import { tenantBrand, tenantFeatures } from "@/lib/tenant-brand";
import { FeaturesProvider } from "@/lib/features";
import { TerminalProviders } from "./providers";
import "./globals.css";

// The broker brand of the host (gateway tenant_domains); Ezymex keeps its stock look.
export async function generateMetadata(): Promise<Metadata> {
  const b = await tenantBrand();
  const name = isCustomBrand(b) ? b.name : "Ezymex";
  return {
    title: { default: `${name} Trader`, template: `%s · ${name} Trader` },
    description: `${name} professional trading room`,
    icons: { icon: isCustomBrand(b) && b.logo_url ? b.logo_url : "/assets/brand/ezymex-mark.svg" },
  };
}

export const viewport: Viewport = { themeColor: "#07070a", width: "device-width", initialScale: 1, maximumScale: 1 };

/** Browser-side market-data origin (another host in production), when it is one. */
const MARKET_DATA_ORIGIN = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_MARKET_DATA_URL ?? "").origin;
  } catch {
    return null;
  }
})();

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // quotes, candles and the stream come from the market-data origin: start its DNS + TCP + TLS handshake while the
  // page loads instead of after hydration (the browser fetches it without credentials, hence "anonymous")
  if (MARKET_DATA_ORIGIN) preconnect(MARKET_DATA_ORIGIN, { crossOrigin: "anonymous" });
  // same language cookie as the Client Area (ezymex_locale), else the browser's Accept-Language; the brand and the
  // broker's module switches come from one cached gateway call
  const [{ locale, dir, messages }, brand, features] = await Promise.all([getI18n(), tenantBrand(), tenantFeatures()]);
  const css = brandCss(brand);
  return (
    <html lang={locale} dir={dir} suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="overflow-hidden">
        {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
        <BrandProvider brand={brand}>
          <FeaturesProvider value={features}>
            <TerminalProviders locale={locale} messages={messages}>{children}</TerminalProviders>
          </FeaturesProvider>
        </BrandProvider>
      </body>
    </html>
  );
}
