import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { BrandProvider, Providers, brandCss, isCustomBrand } from "@kalks/ui";
import { getI18n } from "@kalks/i18n/server";
import { tenantBrand } from "@/lib/tenant-config";
import "./globals.css";

// The broker brand of the visitor's host (gateway tenant_domains); Kalks keeps its stock look.
export async function generateMetadata(): Promise<Metadata> {
  const b = await tenantBrand();
  const name = isCustomBrand(b) ? b.name : "Kalks";
  return {
    title: { default: `${name} — Client Area`, template: `%s · ${name}` },
    description: `Trade Forex, Metals, Indices, Crypto and Stocks with ${name}.`,
    icons: { icon: isCustomBrand(b) && b.logo_url ? b.logo_url : "/assets/brand/kalks-mark.svg" },
  };
}

export const viewport: Viewport = { themeColor: "#07070a", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // language from the kalks_locale cookie (set by the switcher) or the browser's Accept-Language
  const { locale, dir, messages } = await getI18n();
  const brand = await tenantBrand();
  const css = brandCss(brand);
  return (
    <html lang={locale} dir={dir} suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
        <BrandProvider brand={brand}>
          <Providers i18n={{ locale, messages }}>{children}</Providers>
        </BrandProvider>
      </body>
    </html>
  );
}
