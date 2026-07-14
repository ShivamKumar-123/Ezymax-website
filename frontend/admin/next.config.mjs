import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
// Baked at `next build`; use .env.local GATEWAY_INTERNAL_URL=http://127.0.0.1:8000 for local `next dev`.
const gatewayTarget = process.env.GATEWAY_INTERNAL_URL || 'http://gateway:8000';
const isDev = process.env.NODE_ENV !== 'production';

const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,

  // three.js + @react-three/fiber ship as ESM with side-effects that
  // both webpack and Turbopack mis-bundle into the client chunk unless
  // explicitly transpiled. Without this, the chunk's react-reconciler
  // dependency gets a stripped React copy and crashes at module
  // evaluation reading `ReactCurrentOwner`.
  transpilePackages: ['three', '@react-three/fiber'],

  ...(isDev && {
    experimental: {
      staleTimes: { dynamic: 0, static: 0 },
    },
  }),

  // NOTE — React alias removed. The client-only React-to-node_modules
  // alias fixed R3F's `ReactCurrentOwner` crash on the client chunk,
  // but broke Next.js 15's RSC Client Manifest generation: the server
  // registered one React, the client used the aliased copy, and the
  // manifest could not pair client components with their server
  // placeholders. Symptoms when re-enabled:
  //   - "Could not find the module ... segment-explorer-node.js
  //      #SegmentViewNode in the React Client Manifest"
  //   - "TypeError: Cannot read properties of undefined (reading 'call')"
  //   - Every page returned 500 despite `next dev` reporting ✓ Compiled
  //
  // If R3F crashes on /login again, the correct fix is to lazy-import
  // @react-three/fiber inside a useEffect in
  // src/components/ui/canvas-reveal-effect.tsx — that bypasses
  // webpack's static analysis entirely without needing an alias.

  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${gatewayTarget.replace(/\/$/, '')}/api/:path*`,
      },
    ];
  },
  async headers() {
    if (isDev) {
      return [
        {
          source: '/(.*)',
          headers: [
            { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
            { key: 'Pragma', value: 'no-cache' },
          ],
        },
      ];
    }
    /* Stale-deploy / ChunkLoadError prevention (production).
     *
     * Next.js stamps statically-rendered pages with a one-year shared-cache
     * `Cache-Control: s-maxage=31536000`, so a browser/CDN keeps serving old
     * HTML whose content-hashed chunk <script> tags a later deploy replaced →
     * the dynamic import 404s → ChunkLoadError. Force HTML + RSC payloads to
     * revalidate every request; the negative lookahead leaves the immutable
     * `/_next/static/*` chunks and `/_next/image` caching intact. */
    return [
      {
        source: '/((?!_next/static/|_next/image).*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
        ],
      },
    ];
  },
};

export default nextConfig;
