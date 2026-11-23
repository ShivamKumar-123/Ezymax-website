import type { Metadata } from 'next';
import { BRAND_NAME } from '@/lib/brand';

export const metadata: Metadata = {
  title: `Portfolio Management — MAM & PAMM | ${BRAND_NAME}`,
  description:
    'Expert-managed portfolios with MAM (Multi-Account Manager) or PAMM (Percentage Allocation) models. Verified managers, transparent fees, daily reporting.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
