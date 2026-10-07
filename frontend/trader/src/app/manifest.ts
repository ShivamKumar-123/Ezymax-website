import type { MetadataRoute } from 'next';

/**
 * Web App Manifest — makes the trader app installable ("Add to Home Screen").
 * On iOS this drives the standalone launch + home-screen icon/name; on Android
 * it (plus the service worker) enables the install prompt.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Ezymex — Trading Platform',
    short_name: 'Ezymex',
    description: 'Ezymex — professional forex and CFD trading platform',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',
    icons: [
      { src: '/images/ezymex_icon.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/images/ezymex_icon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/images/ezymex_icon.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
