import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Providers } from "@kalks/ui";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Kalks — Client Area", template: "%s · Kalks" },
  description: "Trade Forex, Metals, Indices, Crypto and Stocks with Kalks.",
  icons: { icon: "/assets/brand/kalks-mark.svg" },
};

export const viewport: Viewport = { themeColor: "#07070a", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
