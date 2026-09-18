import type { Metadata } from 'next';
import { BRAND_NAME } from '@/lib/brand';

export const metadata: Metadata = {
  title: `${BRAND_NAME} Academy — Downloadable PDFs, Guides & Reports`,
  description: 'Free trading guides, e-books, and quarterly market reports — download and read offline. New releases monthly.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
