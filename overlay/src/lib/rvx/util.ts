/* RemoteView extras: tiny shared helpers (cache + fetch with timeout). */
const store = new Map<string, { t: number; v: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.t < ttlMs) return hit.v as T;
  const running = inflight.get(key);
  if (running) return running as Promise<T>;
  const p = (async () => {
    try {
      const v = await fn();
      store.set(key, { t: Date.now(), v });
      if (store.size > 200) store.delete(store.keys().next().value as string);
      return v;
    } catch (e) {
      if (hit) return hit.v as T; // serve stale on error
      throw e;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

export async function getJson<T = any>(url: string, opts: RequestInit & { timeout?: number } = {}): Promise<T> {
  const r = await fetch(url, {
    ...opts,
    headers: { 'User-Agent': 'RemoteView/1.0 (+https://remoteview.online)', Accept: 'application/json', ...(opts.headers || {}) },
    signal: AbortSignal.timeout(opts.timeout ?? 15000),
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(`${url.split('?')[0]} -> HTTP ${r.status}`);
  return r.json() as Promise<T>;
}

export async function getText(url: string, timeout = 15000): Promise<string> {
  const r = await fetch(url, { headers: { 'User-Agent': 'RemoteView/1.0' }, signal: AbortSignal.timeout(timeout), cache: 'no-store' });
  if (!r.ok) throw new Error(`${url.split('?')[0]} -> HTTP ${r.status}`);
  return r.text();
}

export function selfBase(): string {
  return `http://127.0.0.1:${process.env.PORT || 3000}`;
}

/* Fetch one of our own routes from the server, past the site lock. */
export async function selfJson<T = any>(pathAndQuery: string, timeout = 40000): Promise<T> {
  const { internalKey } = await import('@/lib/siteAuth');
  const secret = process.env.SITE_AUTH_SECRET;
  const headers: Record<string, string> = secret ? { 'x-rv-internal': await internalKey(secret) } : {};
  return getJson<T>(`${selfBase()}${pathAndQuery}`, { timeout, headers });
}

export function fc(features: any[]) {
  return { type: 'FeatureCollection', features };
}
export function pt(lng: number, lat: number, properties: Record<string, unknown>) {
  return { type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] }, properties };
}

export function aiConfigured(): string | null {
  if (process.env.XAI_API_KEY) return 'xai';
  if (process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_1) return 'gemini';
  return null;
}

const aiCache = new Map<string, { t: number; v: string }>();
/* Server-side LLM call: xAI (OpenAI-compatible) first, Gemini as fallback.
   Responses are cached for 5 minutes by prompt. Returns null when no key is set or the call fails. */
export async function ai(system: string, prompt: string, opts: { json?: boolean; maxTokens?: number } = {}): Promise<string | null> {
  const ck = `${opts.json ? 1 : 0}|${system}|${prompt}`;
  const hit = aiCache.get(ck);
  if (hit && Date.now() - hit.t < 5 * 60_000) return hit.v;
  let out: string | null = null;
  const xkey = process.env.XAI_API_KEY;
  if (xkey) {
    try {
      const r = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${xkey}` },
        body: JSON.stringify({
          model: process.env.XAI_MODEL || 'grok-4.3',
          reasoning_effort: (process.env.XAI_MODEL || 'grok-4.3') === 'grok-4.3' ? 'none' : undefined,
          messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
          max_completion_tokens: opts.maxTokens ?? 700,
          temperature: 0.3,
          ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (r.ok) { const d: any = await r.json(); out = d?.choices?.[0]?.message?.content ?? null; }
      else console.warn('[rvx] xai HTTP', r.status);
    } catch (e) { console.warn('[rvx] xai error', (e as Error).message); }
  }
  const gkey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_1;
  if (!out && gkey) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(gkey)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: system + '\n\n' + prompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: opts.maxTokens ?? 700, ...(opts.json ? { responseMimeType: 'application/json' } : {}) } }),
        signal: AbortSignal.timeout(25000),
      });
      if (r.ok) { const d: any = await r.json(); out = d?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') ?? null; }
    } catch { /* ignore */ }
  }
  if (out) { aiCache.set(ck, { t: Date.now(), v: out }); if (aiCache.size > 300) aiCache.delete(aiCache.keys().next().value as string); }
  return out;
}

const hits = new Map<string, { n: number; reset: number }>();
/** Simple per-IP limiter; returns true when allowed. */
export function allow(ip: string, bucket: string, max: number, windowMs = 60_000) {
  const k = bucket + '|' + ip; const now = Date.now(); const h = hits.get(k);
  if (!h || now > h.reset) { hits.set(k, { n: 1, reset: now + windowMs }); if (hits.size > 10000) hits.clear(); return true; }
  h.n++; return h.n <= max;
}

export const json = (data: unknown, maxAge = 60, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${maxAge}` },
  });
