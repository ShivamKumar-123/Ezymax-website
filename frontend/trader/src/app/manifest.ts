import type { MetadataRoute } from 'next'

/**
 * PWA manifest. Mobile "Add to home screen" prompts pick up the name,
 * icons, and theme colors from here.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Ezymex — Professional Trading Platform',
    short_name: 'Ezymex',
    description: 'Professional forex and CFD trading platform',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#CC0000',
    icons: [
      { src: '/marketing/ezymex_fevicon.png', sizes: 'any', type: 'image/png' },
    ],
  }
}
