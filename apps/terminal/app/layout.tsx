import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { TerminalProviders } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Kalks Trader", template: "%s · Kalks Trader" },
  description: "Kalks professional trading room",
  icons: { icon: "/assets/brand/kalks-mark.svg" },
};

export const viewport: Viewport = { themeColor: "#07070a", width: "device-width", initialScale: 1, maximumScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="overflow-hidden">
        <TerminalProviders>{children}</TerminalProviders>
      </body>
    </html>
  );
}
