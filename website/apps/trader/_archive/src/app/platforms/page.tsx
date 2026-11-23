import PlatformsPage from '@/home-nexola/pages/PlatformsPage';
import { BRAND_NAME } from '@/lib/brand';

export const metadata = {
  title: `Trading Platforms | Web, Mobile, API & Algo | ${BRAND_NAME}`,
  description: `Trade on the ${BRAND_NAME} Web Terminal with TradingView charts, install the mobile app, connect via REST, WebSocket or FIX API, or automate with Strategy Builder.`,
};

/** Platforms: built on the homepage design system (src/home-nexola). */
export default function Page() {
  return <PlatformsPage />;
}
