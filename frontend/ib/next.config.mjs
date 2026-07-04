/** @type {import('next').NextConfig} */
// The IB portal is a standalone app. /api/v1/* is proxied to the gateway by
// the route handler at src/app/api/v1/[...path]/route.ts (set
// TRADER_API_PROXY_TARGET / GATEWAY_URL, e.g. http://localhost:8000).
const isDev = process.env.NODE_ENV !== 'production';

const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  ...(isDev && {
    experimental: {
      staleTimes: { dynamic: 0, static: 0 },
    },
  }),
};

export default nextConfig;
