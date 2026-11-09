# Orbital Watch (paid add-on) — v1

Watch areas drawn on the RemoteView map; a worker checks free satellite imagery every few hours and
raises alerts when something changes. **Paid add-on for Personal and Pro only — never on the free tier.**

## Pieces
- `src/lib/orbital/server.ts` — schema, paid gate (`viewer()`: Personal/Pro + add-on, or site owner), polygon checks.
- `src/app/api/orbital/*` — `me`, `activate` (staging stub, `OW_BILLING_STUB=1`), `sites` (GET/POST/DELETE),
  `sites/[id]/run`, `passes`, `alerts`, `img` (owner-checked JPEGs), `push/subscribe`, `push/pending`,
  `internal/notify` (worker → app, header `x-ow-internal` = `OW_INTERNAL_KEY`).
- `src/components/OrbitalWatch.tsx` + `public/orbital-sw.js` — panel (locked view for free users), before/after
  slider, change mask, alerts feed, live flights over the area, browser push (payload-less VAPID).
  Mounted in `src/app/page.tsx` only when built with `NEXT_PUBLIC_OW=1`.
- `orbital-watch/worker/ow_worker.py` — Python worker (rasterio/numpy/scipy):
  - Sentinel-2 L2A (Earth Search `sentinel-2-c1-l2a`, SCL cloud mask), Landsat 8/9 C2 L2 (Planetary Computer, QA_PIXEL),
    Sentinel-1 RTC (Planetary Computer, same relative orbit + pass direction).
  - Optical: baseline = median of up to 3 clear scenes ≥10 days older; NDVI / NBR / NDWI / NDBI / brightness differencing →
    vegetation loss, burn scar, new water/flooding, water→land, new construction/bare ground.
  - SAR: 5×5 boxcar, log-ratio ±3 dB on land; open water masked (VV+VH); ship-like bright targets counted on water.
  - NASA FIRMS VIIRS (S-NPP, NOAA-20, NOAA-21) 24 h + S-NPP 7 d, point-in-polygon.
  - AI summary via xAI (`XAI_API_KEY`, model `OW_XAI_MODEL`, default grok-4.3) for significant passes; template otherwise.
- `orbital-watch/deploy/` — staging compose (own Postgres, CPU/RAM caps) and thin app image FROM the live image.

## Env
App: `OW_BILLING_STUB`, `OW_INTERNAL_KEY`, `OW_DATA_DIR`, `OW_MAX_SITES`, `OW_MAX_KM2`, `VAPID_*`, `DATABASE_URL`.
Worker: `DATABASE_URL`, `OW_INTERNAL_KEY`, `OW_APP_URL`, `OW_DATA_DIR`, `XAI_API_KEY`, `OW_CYCLE_SECONDS`,
`OW_SITE_EVERY_HOURS`, `OW_MAX_PX`, `OW_LOOKBACK_DAYS`.

## Not done yet (before paid launch)
Stripe add-on price + checkout/webhook (staging uses the stub), email alerts, CX33 upgrade, Hetzner Volume for imagery.
