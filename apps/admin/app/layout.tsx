import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Providers } from "@kalks/ui";
import { NotificationRecorder } from "@/components/notifications";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Kalks — Back Office", template: "%s · Kalks Back Office" },
  icons: { icon: "/assets/brand/kalks-mark.svg" },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <Providers>
          {children}
          <NotificationRecorder />
        </Providers>
      </body>
    </html>
  );
}
