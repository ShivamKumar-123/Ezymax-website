import MarketsPage from '@/home-nexola/pages/MarketsPage';
import { BRAND_NAME } from '@/lib/brand';

export const metadata = {
  title: `Markets | Forex, Metals, Indices, Crypto & Stock CFDs | ${BRAND_NAME}`,
  description: `Trade Forex, Metals, Indices, Energies, Crypto and Stock CFDs from one ${BRAND_NAME} account. Go long or short with tight spreads and flexible leverage.`,
};

/** Markets: built on the homepage design system (src/home-nexola). */
export default function Page() {
  return <MarketsPage />;
}
