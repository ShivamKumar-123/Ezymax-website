import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
// API proxying is handled by the route handler at src/app/api/v1/[...path]/route.ts.
// Do NOT use rewrites() for /api/v1/* — in standalone mode, Next.js can leak the
// internal gateway URL (http://gateway:8000) to the browser, causing mixed-content
// blocks on HTTPS sites.

const isDev = process.env.NODE_ENV !== 'production';

const nextConfig = {
  // `output: 'standalone'` is only needed for Docker production
  // packaging (it copies a minimal node_modules into .next/standalone).
  // It also triggers a Next.js 15.5.x bug where route-group pages
  // (`(landing)/how-it-works`, `_not-found`, etc.) compile correctly
  // but their manifest entries get the wrong path, producing
  // "PageNotFoundError: Cannot find module for page" during page-data
  // collection — even though the chunk files exist on disk.
  //
  // Re-enable this for the Docker prod build via an env-gated branch
  // when you're ready to package for `docker-compose.prod.yml`. For
  // local dev / `next build` smoke-tests, leave it off.
  ...(process.env.NEXT_OUTPUT_STANDALONE === 'true' && { output: 'standalone' }),
  // StrictMode double-invokes effects in dev, which tears down and remounts the
  // TradingView chart widget mid-async-init and leaves the pane blank locally
  // (the widget mounts fine in the production build, where there is no double
  // invoke). Keep StrictMode on for the prod/standalone build; disable it only
  // for `next dev` so the chart renders while developing.
  reactStrictMode: process.env.NODE_ENV === 'production',
  // Strip console.log / .info / .debug from production bundles to
  // prevent info leakage and shrink JS. Keep console.error and
  // console.warn so they reach Sentry (D.2) and stay visible in
  // browser DevTools during prod debugging.
  compiler: {
    removeConsole: isDev ? false : { exclude: ['error', 'warn'] },
  },
  // Next 15's internal `next build` ESLint runner still passes legacy
  // `useEslintrc` / `extensions` options that flat config rejects. Run
  // lint as a separate `npm run lint` step (CI gate) instead of during
  // build. Disable to revert once Next's runner supports flat config.
  eslint: {
    ignoreDuringBuilds: true,
  },
  // three.js ships as ESM with side-effects that both webpack and
  // Turbopack mis-bundle into client chunks unless explicitly
  // transpiled. Direct three.js consumers (ColorBends + canvas-reveal-
  // effect) need this hint or the chunk crashes at module evaluation.
  // (@react-three/fiber dropped — package removed in dead-code purge;
  // only raw three.js remains in the bundle.)
  transpilePackages: ['three'],
  experimental: {
    /* Per-fetch / per-route cache TTLs. Dev forces zero so changes
     * appear immediately. Prod uses tight values because trader data
     * (balances, positions, prices) is highly dynamic — the App Router
     * default of 5 min for static is far too long for a financial app. */
    staleTimes: isDev
      ? { dynamic: 0, static: 0 }
      : { dynamic: 0, static: 30 },
  },
  // ── react-router-dom shim ────────────────────────────────────────
  // The trader landing pages import a couple of helpers from
  // react-router-dom, but we don't actually ship react-router. The
  // shim at src/landing/router-shim.tsx re-exports Link / NavLink /
  // useLocation / etc. on top of next/navigation so the landing JSX
  // doesn't need to be rewritten.
  //
  // Previous wallet-related webpack tweaks (alias stubs for
  // @coinbase/wallet-sdk, @base-org/account, @safe-global, @metamask/sdk;
  // fallbacks for valtio/vanilla; client-only React de-dup alias) were
  // removed with the wallet-integration purge — wagmi / RainbowKit /
  // viem / ethers / siwe are no longer installed so nothing pulls
  // those packages into the bundle anymore.
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      'react-router-dom': path.resolve(__dirname, 'src/landing/router-shim.tsx'),
    };
    return config;
  },
  /* Turbopack ignores the webpack hook above — duplicate the alias here so
     `next dev --turbo` also resolves react-router-dom to our local shim. */
  turbopack: {
    resolveAlias: {
      'react-router-dom': './src/landing/router-shim.tsx',
    },
  },
  /** Set NEXT_PUBLIC_APP_VERSION at Docker build so each deploy gets new `_next/static` hashes. */
  generateBuildId: async () => {
    const v = process.env.NEXT_PUBLIC_APP_VERSION?.trim();
    if (v) return v.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 48) || 'release';
    return 'development';
  },
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      // Own domain + subdomains only. The previous `hostname: '**'` let the
      // /_next/image optimizer proxy-fetch ANY https host (open-proxy /
      // SSRF-ish surface). No next/image call site in src/ passes a remote
      // https URL today — the external icons (flagcdn.com, cdn.jsdelivr.net,
      // api.qrserver.com) all render through plain <img>, which bypasses the
      // optimizer — so own-domain coverage is sufficient. Add specific hosts
      // here if a next/image ever needs a third-party origin.
      { protocol: 'https', hostname: 'swisscresta.com' },
      { protocol: 'https', hostname: '**.swisscresta.com' },
    ],
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
    /* Production hardening. Order matters for readability, not for HTTP.
     *
     * CSP is now ENFORCED (promoted from Content-Security-Policy-Report-Only
     * after the monitoring period; the stale verify.walletconnect.* entries
     * were dropped at promotion time — the wallet UI was purged).
     *
     * Still open as a follow-up: drop 'unsafe-inline' from script-src by
     * adding a per-request nonce in middleware.ts and passing it to
     * the inline localStorage-migration <script> in app/layout.tsx. */
    const cspDirectives = [
      "default-src 'self'",
      // 'unsafe-inline' needed for: layout.tsx inline bootloader,
      // framer-motion inline styles, TradingView widget script.innerHTML.
      // 'unsafe-eval' needed for: Next.js client runtime in some configs.
      // Kept in sync with the enforced nginx CSP (deploy/nginx/swisscresta.conf).
      // *.razorpay.com covers checkout.js + the cdn.razorpay.com risk script.
      // blob: required by the self-hosted TradingView Charting Library, which
      // spins up Web Workers (and loads some code) from blob: URLs.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://accounts.google.com https://apis.google.com https://*.googleusercontent.com https://s3.tradingview.com https://www.tradingview-widget.com https://www.tradingview.com https://static.cloudflareinsights.com https://*.razorpay.com",
      // Charting Library workers.
      "worker-src 'self' blob:",
      "child-src 'self' blob:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      // wss: for the WebSocket price feed, https: covers gateway + 3rd party.
      "connect-src 'self' https: wss:",
      "frame-src 'self' blob: https://s.tradingview.com https://www.tradingview-widget.com https://www.tradingview.com https://accounts.google.com https://*.razorpay.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
    ].join('; ');

    return [
      {
        source: '/(.*)',
        headers: [
          // 1 year HSTS + subdomain coverage + preload eligibility.
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          // Block MIME-type sniffing — prevents `<script src="img.png">` tricks.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Don't leak full referrer to cross-origin third parties (banks, exchanges, TV charts).
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Clickjacking guard. SAMEORIGIN allows the trader app to iframe itself
          // (used by /s/[code] share previews) but blocks attacker pages.
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // Disable powerful browser features the trader app doesn't use.
          // Camera left open (KYC selfie flows may add it later). Microphone
          // and geolocation should never fire — block them.
          { key: 'Permissions-Policy', value: 'microphone=(), geolocation=(), payment=*' },
          // CSP enforced. See comment above for the nonce follow-up.
          { key: 'Content-Security-Policy', value: cspDirectives },
        ],
      },
      {
        /* Stale-deploy / ChunkLoadError prevention.
         *
         * Next.js statically renders pages that only read the URL via the
         * client `useSearchParams()` hook (e.g. /trading/terminal) and stamps
         * them `Cache-Control: s-maxage=31536000` — a ONE-YEAR shared-cache
         * lifetime. A browser or CDN then keeps serving that year-old HTML,
         * whose <script> tags point at content-hashed chunk files a later
         * deploy has already replaced → the dynamic import 404s → ChunkLoadError
         * ("Something broke on our end"). The error.tsx auto-reload only papers
         * over it AFTER it fires; this stops it happening at all.
         *
         * So force every HTML document + RSC payload to revalidate on each
         * request. The negative lookahead leaves `/_next/static/*` (the
         * immutable, content-hashed chunks — safe to cache forever) and
         * `/_next/image` untouched, so we lose no asset caching. This block is
         * ordered AFTER the security header block so its Cache-Control wins for
         * the matched routes. */
        source: '/((?!_next/static/|_next/image).*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
        ],
      },
    ];
  },
  /* Retired broker-product routes.
   *
   * The site used to sell trading to retail clients, so it carried pages for
   * currency pairs, precious metals, CFDs, account tiers and a demo account.
   * SetupFX sells the platform to the businesses that run those markets, so
   * none of them describe anything we offer.
   *
   * They are redirected rather than deleted outright: the pages were linked
   * from the footer, the marketing sections and each other, and a 404 for a
   * visitor who followed an old link is a worse outcome than landing on the
   * page that now answers their question. Permanent, so search engines drop
   * the old URLs instead of keeping them indexed against us. */
  async redirects() {
    /* The earlier SetupFX pass retired the broker marketing routes and
     * redirected them to /platforms. Those routes are now live pages again
     * (the full site was rebuilt on the new UI, with SetupFX content), and
     * /platforms is not a page, so redirecting them would break the site.
     * Nothing to redirect. */
    return [];
  },
};

export default nextConfig;
