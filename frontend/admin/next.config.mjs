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
    /* Production hardening — mirrors the trader app's baseline
     * (trader/next.config.mjs headers()).
     *
     * CSP starts in REPORT-ONLY mode: the admin's confirmed origins are all
     * same-origin (API via the /api rewrite, Inter self-hosted through
     * next/font, local images) plus a cross-origin price WebSocket
     * (NEXT_PUBLIC_WS_URL, e.g. wss://api.swisscresta.com — hence the bare
     * wss: in connect-src). 'unsafe-inline'/'unsafe-eval' stay because the
     * beforeInteractive ThemeInitScript is an inline <script> and the Next.js
     * client runtime needs them (same rationale as the trader config).
     * After ~1 week of monitoring with zero unexpected violations, promote by
     * changing the key 'Content-Security-Policy-Report-Only' →
     * 'Content-Security-Policy'. */
    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      // data:/blob: for inline previews (KYC docs / deposit proofs fetched
      // via the same-origin API and rendered as object URLs).
      // https: for tenant branding logos / banner images that may be hosted
      // on an absolute URL (branding logo_url, banner image_url).
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      // wss: for the live price feed (NEXT_PUBLIC_WS_URL may be cross-origin).
      "connect-src 'self' wss:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; ');

    /* Second block: stale-deploy / ChunkLoadError prevention.
     *
     * Next.js stamps statically-rendered pages with a one-year shared-cache
     * `Cache-Control: s-maxage=31536000`, so a browser/CDN keeps serving old
     * HTML whose content-hashed chunk <script> tags a later deploy replaced →
     * the dynamic import 404s → ChunkLoadError. Force HTML + RSC payloads to
     * revalidate every request; the negative lookahead leaves the immutable
     * `/_next/static/*` chunks and `/_next/image` caching intact. */
    return [
      {
        source: '/(.*)',
        headers: [
          // 1 year HSTS + subdomain coverage + preload eligibility.
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          // Block MIME-type sniffing.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Don't leak full admin URLs (user ids, etc.) cross-origin.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // The admin panel must never be framed — DENY, not SAMEORIGIN.
          { key: 'X-Frame-Options', value: 'DENY' },
          // The admin uses no powerful browser features — lock them all down.
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
          // CSP ENFORCED (promoted from Report-Only). The admin panel controls all
          // funds; a report-only policy stops nothing. Verified the panel loads
          // only same-origin assets/API (/admin-api proxy), wss: for the price
          // feed, and https: images for tenant logos.
          { key: 'Content-Security-Policy', value: cspDirectives },
        ],
      },
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
