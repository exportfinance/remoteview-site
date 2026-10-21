import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { getClientIp, isRateLimited } from '@/lib/ssrf-guard';
import { addSignup, USE_CASES, PLANS, CONSENT_TEXT } from '@/lib/waitlist';
import { IS_COMMERCIAL } from '@/lib/edition';

export const dynamic = 'force-dynamic';
const EMAIL = /^[^\s@<>()",;:]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,24}$/;

export async function POST(req: Request) {
  if (!IS_COMMERCIAL) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const ip = getClientIp(req);
  if (isRateLimited('wl:' + ip, 5, 10 * 60_000)) return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
  if (isRateLimited('wl:global', 120, 60_000)) return NextResponse.json({ error: 'Busy. Please try again shortly.' }, { status: 429 });
  let b: any = {};
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }); }
  // Honeypot: real users never see or fill "website". Pretend success for bots.
  if (typeof b.website === 'string' && b.website.trim() !== '') return NextResponse.json({ ok: true });
  const email = String(b.email || '').trim().toLowerCase();
  const name = String(b.name || '').trim().slice(0, 100);
  const useCase = String(b.useCase || '');
  const plan = PLANS.includes(b.plan) ? String(b.plan) : undefined;
  if (!EMAIL.test(email) || email.length > 254) return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  if (!(USE_CASES as readonly string[]).includes(useCase)) return NextResponse.json({ error: 'Please choose a use case.' }, { status: 400 });
  if (b.consent !== true) return NextResponse.json({ error: 'Please tick the consent box.' }, { status: 400 });
  // Minimum time-on-page check (bots post instantly).
  if (typeof b.t === 'number' && Date.now() - b.t < 1500) return NextResponse.json({ ok: true });
  try {
    const ipHash = createHash('sha256').update((process.env.SITE_AUTH_SECRET || 'rv') + ':' + ip).digest('hex').slice(0, 32);
    await addSignup({ email, name, useCase, plan, consentText: CONSENT_TEXT, ipHash, ua: req.headers.get('user-agent') || '' });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[waitlist] insert failed:', (e as Error).message);
    return NextResponse.json({ error: 'Could not save right now. Please try again later.' }, { status: 503 });
  }
}
