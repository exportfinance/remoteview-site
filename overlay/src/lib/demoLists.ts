/* Demo allow-lists (no React; safe for middleware). */
/** Unauthenticated API paths a demo visitor may call (exact or prefix + '/'). No AI routes. */
export const DEMO_API = ['/api/flights', '/api/satellites', '/api/earthquakes', '/api/weather', '/api/space-weather', '/api/proxy-tiles', '/api/health', '/api/share'];
export const DEMO_RVX = new Set(['aurora', 'risk-score', 'iss']);
/** LayerPanel keys shown in the demo. */
export const DEMO_LAYER_KEYS = new Set(['flights', 'private', 'military', 'satellites', 'sat_comms', 'sat_military', 'sat_navigation', 'sat_earth', 'sat_science', 'earthquakes', 'weather', 'day_night', 'live_clouds']);
/** RvExtras layer ids shown in the demo. */
export const DEMO_EXTRA_LAYERS = new Set(['aurora', 'risk-score', 'iss']);
export const DEMO_COOKIE = 'rv_demo';

export function isDemoApi(pathname: string): boolean {
  if (DEMO_API.some((p) => pathname === p || pathname.startsWith(p + '/'))) return true;
  const m = pathname.match(/^\/api\/rvx\/([^/]+)$/);
  return !!m && DEMO_RVX.has(decodeURIComponent(m[1]));
}

