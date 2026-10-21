import { NextResponse } from 'next/server';
import { signupStats } from '@/lib/waitlist';
export const dynamic = 'force-dynamic';
/* Behind the site password (not in the middleware public list). Counts only, no emails. */
export async function GET() {
  try { return NextResponse.json(await signupStats()); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 503 }); }
}
