import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Providers } from "@kalks/ui";
import { getI18n } from "@kalks/i18n/server";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Kalks — Client Area", template: "%s · Kalks" },
  description: "Trade Forex, Metals, Indices, Crypto and Stocks with Kalks.",
  icons: { icon: "/assets/brand/kalks-mark.svg" },
};

export const viewport: Viewport = { themeColor: "#07070a", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // language from the kalks_locale cookie (set by the switcher) or the browser's Accept-Language
  const { locale, dir, messages } = await getI18n();
  return (
    <html lang={locale} dir={dir} suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <Providers i18n={{ locale, messages, persistUrl: "/api/auth/locale" }}>{children}</Providers>
      </body>
    </html>
  );
}
