FROM node:22-alpine AS src
WORKDIR /app
COPY bundle/ /bundle/
RUN cat /bundle/part* | base64 -d | tar xz -C /app
COPY tools/ /app/tools/
COPY overlay/ /app/
COPY landing-b64/ /landing-b64/
RUN mkdir -p /app/public/landing && for f in /landing-b64/*.b64; do base64 -d "$f" > /app/public/landing/$(basename "$f" .b64); done

FROM node:22-alpine AS deps
WORKDIR /app
COPY --from=src /app/package.json /app/package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
ARG RV_EDITION=private
ENV RV_EDITION=${RV_EDITION} NEXT_PUBLIC_RV_EDITION=${RV_EDITION}
COPY --from=deps /app/node_modules ./node_modules
COPY --from=src /app/ ./
ENV NEXT_TELEMETRY_DISABLED=1
RUN if [ "$RV_EDITION" != "commercial" ]; then node tools/build-ufo.mjs; else echo 'commercial edition: UFO data not built'; fi
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ARG RV_EDITION=private
ENV RV_EDITION=${RV_EDITION} NEXT_PUBLIC_RV_EDITION=${RV_EDITION}
RUN apk add --no-cache poppler-utils
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
