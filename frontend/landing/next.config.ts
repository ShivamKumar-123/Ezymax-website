import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
  // Legal documents are authored as .mdx under src/content/.
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],

  reactStrictMode: true,

  // Emit a self-contained `.next/standalone` server so the Docker runner
  // stage can ship a slim image (just server.js + traced node_modules),
  // mirroring the trader/ib/admin frontends' deploy shape. Required by this
  // app's Dockerfile — without it the runner stage has nothing to copy.
  output: "standalone",

  // Drop the `X-Powered-By: Next.js` response header.
  poweredByHeader: false,

  compiler: {
    // Strip `console.*` from production bundles, keeping error/warn for
    // monitoring. Left on in dev so logs stay available.
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["error", "warn"] }
        : false,
  },

  images: {
    // Modern formats — smaller than JPEG/PNG; the browser picks what it supports.
    formats: ["image/avif", "image/webp"],
    // Breakpoints `next/image` uses to build `srcset`. `deviceSizes` covers
    // full-width images; `imageSizes` covers smaller, fixed-width images and
    // icons. These tracked an adaptive-grid config that no longer exists, so
    // they are now just Tailwind's breakpoints plus the retina steps.
    deviceSizes: [360, 640, 768, 1024, 1280, 1440, 1920, 2560],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],

    // Site photography is still hot-linked from Unsplash's CDN; the optimiser
    // re-encodes it into same-origin /_next/image responses, which is the only
    // reason it satisfies the apex CSP (`img-src 'self' data: blob:`).
    // TEMPORARY — remove once the photos are vendored into public/photos/.
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
  },

  // The routes the previous landing shipped. They are gone; redirect them so
  // inbound links and already-crawled URLs keep working.
  //
  // 307, not 308: a permanent redirect is cached hard by both browsers and
  // Cloudflare, and this URL map is new enough that being able to change a
  // target without fighting other people's caches is worth more than the
  // marginal SEO signal. Promote to `permanent: true` once the logs are quiet.
  async redirects() {
    return [
      { source: "/trade", destination: "/markets", permanent: false },
      { source: "/company", destination: "/about", permanent: false },
      {
        source: "/privacy",
        destination: "/legal/privacy-policy",
        permanent: false,
      },
      {
        source: "/terms",
        destination: "/legal/terms-of-service",
        permanent: false,
      },
      {
        source: "/risk",
        destination: "/legal/risk-disclosure",
        permanent: false,
      },
    ];
  },
};

const withMDX = createMDX({});

export default withMDX(nextConfig);
