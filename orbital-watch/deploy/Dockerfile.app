# Thin staging image: the exact live commercial-fix40 runtime (node_modules incl. native sharp) plus the
# Orbital Watch build output (.next standalone server + static) and source. No new npm dependencies.
FROM ghcr.io/exportfinance/remoteview-site:commercial-fix40
USER root
RUN rm -rf /app/.next
COPY --chown=1001:65533 next-standalone/.next /app/.next
COPY --chown=1001:65533 next-static /app/.next/static
COPY --chown=1001:65533 public/orbital-sw.js /app/public/orbital-sw.js
COPY --chown=1001:65533 server.js /app/server.js
COPY --chown=1001:65533 src /app/src
USER nextjs
