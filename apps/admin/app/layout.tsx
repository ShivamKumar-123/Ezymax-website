import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
// subpath imports: a server layout importing the "@kalks/ui" barrel ships every client module of it on every page
import { BrandProvider } from "@kalks/ui/brand";
import { brandCss, isCustomBrand } from "@kalks/ui/brand-vars";
import { Providers } from "@kalks/ui/providers";
import { NotificationRecorder } from "@/components/notifications";
import { tenantBrand } from "@/lib/tenant-brand";
import "./globals.css";

// The broker brand of the host (gateway tenant_domains); Kalks keeps its stock look.
export async function generateMetadata(): Promise<Metadata> {
  const b = await tenantBrand();
  const name = isCustomBrand(b) ? b.name : "Kalks";
  return {
    title: { default: `${name} — Back Office`, template: `%s · ${name} Back Office` },
    icons: { icon: isCustomBrand(b) && b.logo_url ? b.logo_url : "/assets/brand/kalks-mark.svg" },
    robots: { index: false, follow: false },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const brand = await tenantBrand();
  const css = brandCss(brand);
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
        <BrandProvider brand={brand}>
          <Providers>
            {children}
            <NotificationRecorder />
          </Providers>
        </BrandProvider>
      </body>
    </html>
  );
}
