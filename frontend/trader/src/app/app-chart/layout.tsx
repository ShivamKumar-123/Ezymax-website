import type { ReactNode } from 'react';

export const metadata = {
  title: 'Chart — SwissCresta',
  // Chrome-free: the mobile app's WebView embeds this, so it renders nothing
  // but the chart. Dedicated APK route (independent from the web /chart).
};

export default function AppChartLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
