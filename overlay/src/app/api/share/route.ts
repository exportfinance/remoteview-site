import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { getClientIp, isRateLimited } from '@/lib/ssrf-guard';
import { IS_COMMERCIAL } from '@/lib/edition';
import { createSnap } from '@/lib/snapshots';
import { countryAt } from '@/lib/rvx/country';
import { PUBLIC_URL } from '@/lib/publicUrl';
export const dynamic = 'force-dynamic';
const MAX_IMG = 450_000;
const LAYER_RE = /^[a-z0-9_,-]{0,600}$/;
export async function POST(req: Request) {
  if (!IS_COMMERCIAL) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const ip = getClientIp(req);
  if (isRateLimited('share:' + ip, 12, 10 * 60_000)) return NextResponse.json({ error: 'Too many shares. Try again in a few minutes.' }, { status: 429 });
  if (isRateLimited('share:global', 300, 60_000)) return NextResponse.json({ error: 'Busy. Try again shortly.' }, { status: 429 });
  let b: any; try { b = await req.json(); } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }); }
  const num = (v: any, lo: number, hi: number) => { const n = Number(v); return Number.isFinite(n) && n >= lo && n <= hi ? n : null; };
  const lat = num(b.lat, -90, 90), lng = num(b.lng, -180, 180), zoom = num(b.zoom, 0, 22);
  if (lat == null || lng == null || zoom == null) return NextResponse.json({ error: 'Bad view' }, { status: 400 });
  const layers = String(b.layers || '');
  if (!LAYER_RE.test(layers)) return NextResponse.json({ error: 'Bad layers' }, { status: 400 });
  let image: Buffer | null = null;
  if (typeof b.image === 'string' && b.image.startsWith('data:image/jpeg;base64,')) {
    const buf = Buffer.from(b.image.slice(23), 'base64');
    // Must really be a JPEG (SOI marker) and small.
    if (buf.length <= MAX_IMG && buf[0] === 0xff && buf[1] === 0xd8) image = buf;
  }
  try {
    const c = await countryAt(lng, lat).catch(() => null);
    const ipHash = createHash('sha256').update((process.env.SITE_AUTH_SECRET || 'rv') + ':' + ip).digest('hex').slice(0, 32);
    const id = await createSnap({ lat, lng, zoom, bearing: num(b.bearing, -360, 360) ?? 0, pitch: num(b.pitch, 0, 85) ?? 0, layers, place: c?.name || null, image, ipHash });
    return NextResponse.json({ id, url: `${PUBLIC_URL}/s/${id}` });
  } catch (e) {
    console.error('[share] failed:', (e as Error).message);
    return NextResponse.json({ error: 'Could not create a share link right now.' }, { status: 503 });
  }
}
