import type { Metadata } from 'next';
import { BRAND_NAME } from '@/lib/brand';

export const metadata: Metadata = {
  title: `Referral Program | ${BRAND_NAME}`,
  description: `${BRAND_NAME} referral program — share your link, earn rewards on every funded friend.`,
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
