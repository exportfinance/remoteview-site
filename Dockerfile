FROM node:22-alpine AS src
WORKDIR /app
COPY bundle/ /bundle/
RUN cat /bundle/part* | base64 -d | tar xz -C /app
COPY tools/ /app/tools/
COPY overlay/ /app/

FROM node:22-alpine AS deps
WORKDIR /app
COPY --from=src /app/package.json /app/package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=src /app/ ./
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV UV_THREADPOOL_SIZE=64
ENV HOSTNAME="0.0.0.0"
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs && mkdir -p /app/.cache && chown nextjs:nodejs /app/.cache
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
