import type { Metadata } from 'next';
import { BRAND_NAME } from '@/lib/brand';

export const metadata: Metadata = {
  title: `IB Referral Program | Earn Up to $7 per Lot | ${BRAND_NAME}`,
  description: `Become a ${BRAND_NAME} Introducing Broker. Lifetime per-lot commissions, multi-tier rewards, weekly payouts, dedicated manager.`,
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
