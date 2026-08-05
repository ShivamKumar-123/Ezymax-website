# ── Marketing landing site (fxartha.com) ────────────────────────
# Separate Next.js app (Next 16 / React 19 / Tailwind v4, yarn). Kept
# apart from the trader app on purpose — its only coupling is the
# NEXT_PUBLIC_TRADE_URL link into the trader platform's auth pages.
#
# NOTE: this app uses yarn (yarn.lock), unlike the npm-based trader/ib
# Dockerfiles. node:20-alpine ships yarn 1.x, so no corepack needed.

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1

# Public site origin (canonical URLs / OG / robots / sitemap / JSON-LD).
ARG NEXT_PUBLIC_SITE_URL=https://fxartha.com
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
# Trader platform origin — every landing CTA links to <url>/auth/login
# and <url>/auth/register. NEXT_PUBLIC_* are inlined at BUILD time, so
# this must be present when `yarn build` runs (it is — passed as a
# build arg from docker-compose).
ARG NEXT_PUBLIC_TRADE_URL=https://trade.fxartha.com
ENV NEXT_PUBLIC_TRADE_URL=$NEXT_PUBLIC_TRADE_URL
# Bust Next's build cache and prove a fresh deploy.
ARG NEXT_PUBLIC_APP_VERSION=docker
ENV NEXT_PUBLIC_APP_VERSION=$NEXT_PUBLIC_APP_VERSION
ENV NODE_OPTIONS="--max-old-space-size=4096"
# next/font/google fetches Space Grotesk + JetBrains Mono at build time,
# so this stage needs network access.
RUN yarn build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
