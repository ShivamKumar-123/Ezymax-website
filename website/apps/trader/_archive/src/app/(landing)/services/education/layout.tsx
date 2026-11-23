import type { Metadata } from 'next';
import { BRAND_NAME } from '@/lib/brand';

export const metadata: Metadata = {
  title: `Educational Resources | Trading Academy | ${BRAND_NAME}`,
  description:
    'Learn to trade — beginner to advanced. Video courses, written guides, live webinars, and a structured curriculum across forex majors, minors and exotics.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
