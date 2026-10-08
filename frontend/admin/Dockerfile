FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# npm 10 on node 20 fails this install with "Exit handler never called!"
# and still exits 0, so the build carries on with an empty node_modules and
# only dies two stages later on "next: not found". Node 22 ships the fixed
# npm; the guard makes any future silent failure stop here instead.
RUN npm ci --legacy-peer-deps && test -x node_modules/.bin/next

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3001
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
