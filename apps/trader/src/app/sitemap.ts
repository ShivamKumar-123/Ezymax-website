import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/brand';

/** Public pages, served at /sitemap.xml with canonical https://ezymex.com URLs. */
const PAGES: { path: string; priority: number; freq: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
  { path: '/', priority: 1, freq: 'weekly' },
  { path: '/options', priority: 0.9, freq: 'weekly' },
  { path: '/markets', priority: 0.9, freq: 'daily' },
  { path: '/accounts', priority: 0.8, freq: 'monthly' },
  { path: '/platforms', priority: 0.8, freq: 'monthly' },
  { path: '/prop', priority: 0.8, freq: 'monthly' },
  { path: '/copy-trading', priority: 0.7, freq: 'monthly' },
  { path: '/partners', priority: 0.7, freq: 'monthly' },
  { path: '/academy', priority: 0.7, freq: 'monthly' },
  { path: '/white-label', priority: 0.6, freq: 'monthly' },
  { path: '/about', priority: 0.6, freq: 'monthly' },
  { path: '/contact', priority: 0.5, freq: 'yearly' },
  { path: '/faq', priority: 0.6, freq: 'monthly' },
  { path: '/risk-warning', priority: 0.3, freq: 'yearly' },
  { path: '/risk', priority: 0.3, freq: 'yearly' },
  { path: '/terms', priority: 0.3, freq: 'yearly' },
  { path: '/privacy', priority: 0.3, freq: 'yearly' },
  { path: '/deposit-withdrawal', priority: 0.3, freq: 'yearly' },
  { path: '/restricted-countries', priority: 0.3, freq: 'yearly' },
  { path: '/delete-account', priority: 0.2, freq: 'yearly' },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return PAGES.map((p) => ({ url: `${SITE_URL}${p.path === '/' ? '' : p.path}`, lastModified: now, changeFrequency: p.freq, priority: p.priority }));
}
