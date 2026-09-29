import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { getI18n } from "@kalks/i18n/server";
import { BrandProvider, brandCss, isCustomBrand } from "@kalks/ui";
import { tenantBrand } from "@/lib/tenant-brand";
import { TerminalProviders } from "./providers";
import "./globals.css";

// The broker brand of the host (gateway tenant_domains); Kalks keeps its stock look.
export async function generateMetadata(): Promise<Metadata> {
  const b = await tenantBrand();
  const name = isCustomBrand(b) ? b.name : "Kalks";
  return {
    title: { default: `${name} Trader`, template: `%s · ${name} Trader` },
    description: `${name} professional trading room`,
    icons: { icon: isCustomBrand(b) && b.logo_url ? b.logo_url : "/assets/brand/kalks-mark.svg" },
  };
}

export const viewport: Viewport = { themeColor: "#07070a", width: "device-width", initialScale: 1, maximumScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // same language cookie as the Client Area (kalks_locale), else the browser's Accept-Language
  const { locale, dir, messages } = await getI18n();
  const brand = await tenantBrand();
  const css = brandCss(brand);
  return (
    <html lang={locale} dir={dir} suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="overflow-hidden">
        {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
        <BrandProvider brand={brand}>
          <TerminalProviders locale={locale} messages={messages}>{children}</TerminalProviders>
        </BrandProvider>
      </body>
    </html>
  );
}
