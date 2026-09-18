import type { Metadata } from 'next';
import { BRAND_NAME } from '@/lib/brand';

export const metadata: Metadata = {
  title: `${BRAND_NAME} Academy — Trading Blog & Market Insights`,
  description: `Market insights, strategy breakdowns, and platform tips from the ${BRAND_NAME} trading desk. Updated weekly.`,
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
