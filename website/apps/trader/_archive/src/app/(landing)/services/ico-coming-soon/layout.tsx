import type { Metadata } from 'next';
import { BRAND_NAME } from '@/lib/brand';

export const metadata: Metadata = {
  title: `ICO & Early-Stage Investments — Coming Soon | ${BRAND_NAME}`,
  description:
    `Early access to vetted blockchain projects, launching soon on ${BRAND_NAME}. Join the early-access list to be notified the moment the first ICO drops.`,
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
