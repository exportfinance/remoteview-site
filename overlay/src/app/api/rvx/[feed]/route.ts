import { NextRequest } from 'next/server';
import { HANDLERS, AI_FEEDS } from '@/lib/rvx/feeds';
import { json, allow } from '@/lib/rvx/util';
import { getClientIp } from '@/lib/ssrf-guard';
import { ensureHistory } from '@/lib/rvx/live';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function handle(req: NextRequest, ctx: { params: Promise<{ feed: string }> }, body?: any) {
  const { feed } = await ctx.params;
  const h = HANDLERS[feed];
  if (!h) return json({ error: 'unknown feed' }, 0, 404);
  ensureHistory();
  const ip = getClientIp(req);
  if (!allow(ip, AI_FEEDS.has(feed) ? 'ai' : 'feed', AI_FEEDS.has(feed) ? 10 : 240)) return json({ error: 'rate limited' }, 0, 429);
  try {
    const data = await h(new URL(req.url).searchParams, body);
    return json(data, AI_FEEDS.has(feed) ? 0 : 30);
  } catch (e) {
    return json({ error: (e as Error).message, feed }, 0, 502);
  }
}
export async function GET(req: NextRequest, ctx: { params: Promise<{ feed: string }> }) { return handle(req, ctx); }
export async function POST(req: NextRequest, ctx: { params: Promise<{ feed: string }> }) {
  const body = await req.json().catch(() => ({}));
  return handle(req, ctx, body);
}
