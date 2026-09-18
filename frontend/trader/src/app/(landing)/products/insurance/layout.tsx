import type { Metadata } from 'next';
import { BRAND_NAME } from '@/lib/brand';

export const metadata: Metadata = {
  title: `Trade Insurance | ${BRAND_NAME}`,
  description: 'On-chain trade insurance — every position policy-backed, automatic claim payout via smart contract.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
