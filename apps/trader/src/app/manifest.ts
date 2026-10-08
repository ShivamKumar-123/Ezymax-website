import type { MetadataRoute } from 'next';
import { BRAND_NAME } from '@/lib/brand';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND_NAME}: forex options, CFDs and prop trading`,
    short_name: BRAND_NAME,
    description: 'Ezymex FX Options, CFDs, prop challenges, copy trading and PAMM on one account.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#07070a',
    theme_color: '#07070a',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
