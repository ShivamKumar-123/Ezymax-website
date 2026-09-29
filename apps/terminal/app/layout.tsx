import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { getI18n } from "@kalks/i18n/server";
import { TerminalProviders } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Kalks Trader", template: "%s · Kalks Trader" },
  description: "Kalks professional trading room",
  icons: { icon: "/assets/brand/kalks-mark.svg" },
};

export const viewport: Viewport = { themeColor: "#07070a", width: "device-width", initialScale: 1, maximumScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // same language cookie as the Client Area (kalks_locale), else the browser's Accept-Language
  const { locale, dir, messages } = await getI18n();
  return (
    <html lang={locale} dir={dir} suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="overflow-hidden">
        <TerminalProviders locale={locale} messages={messages}>{children}</TerminalProviders>
      </body>
    </html>
  );
}
