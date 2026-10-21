import { NextResponse } from 'next/server';
import { clearSession, sameOrigin } from '@/lib/billing/session';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Bad origin' }, { status: 403 });
  return clearSession(NextResponse.json({ ok: true }));
}
