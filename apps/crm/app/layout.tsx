import { preconnect, preload } from "react-dom";
import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
// subpath imports: a server layout importing the "@ezymex/ui" barrel ships every client module of it on every page
import { BrandProvider } from "@ezymex/ui/brand";
import { brandCss, isCustomBrand } from "@ezymex/ui/brand-vars";
import { Providers } from "@ezymex/ui/providers";
import { getI18n } from "@ezymex/i18n/server";
import { tenantBrand } from "@/lib/tenant-config";
import "./globals.css";

// The broker brand of the visitor's host (gateway tenant_domains); Ezymex keeps its stock look.
export async function generateMetadata(): Promise<Metadata> {
  const b = await tenantBrand();
  const name = isCustomBrand(b) ? b.name : "Ezymex";
  return {
    title: { default: `${name} — Client Area`, template: `%s · ${name}` },
    description: `Trade Forex, Metals, Indices, Crypto and Stocks with ${name}.`,
    icons: { icon: isCustomBrand(b) && b.logo_url ? b.logo_url : "/assets/brand/ezymex-mark.svg" },
  };
}

// light pastel is the Client Area's default theme (dark stays one tap away in the theme switch)
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0a0f" },
    { media: "(prefers-color-scheme: light)", color: "#f9f6f5" },
  ],
  width: "device-width",
  initialScale: 1,
};

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
  // the display face (latin subset) is on every page: fetch it with the HTML instead of after the stylesheet
  preload("/fonts/plus-jakarta-sans-latin.woff2", { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  // language from the ezymex_locale cookie (set by the switcher) or the browser's Accept-Language
  const [{ locale, dir, messages }, brand] = await Promise.all([getI18n(), tenantBrand()]);
  const css = brandCss(brand);
  return (
    <html lang={locale} dir={dir} suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
        <BrandProvider brand={brand}>
          <Providers defaultTheme="light" i18n={{ locale, messages }}>{children}</Providers>
        </BrandProvider>
      </body>
    </html>
  );
}
