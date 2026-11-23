import AccountsPage from '@/home-nexola/pages/AccountsPage';
import { BRAND_NAME } from '@/lib/brand';

export const metadata = {
  title: `Account Types | Standard, Pro, ECN & Cent | ${BRAND_NAME}`,
  description: `Compare ${BRAND_NAME} Standard, Pro, ECN and Cent accounts: spreads from 0.0 pips, leverage up to 1:2000, hedging or netting and swap-free options.`,
};

/** Account types: built on the homepage design system (src/home-nexola). */
export default function Page() {
  return <AccountsPage />;
}
