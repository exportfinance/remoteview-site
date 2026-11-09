import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { viewer, db } from '@/lib/orbital/server';
export const dynamic = 'force-dynamic';
/** Serves a before/after/change JPEG to the owner of the watch area only. */
export async function GET(req: Request) {
  const v = await viewer(); if (!v.addon || !v.key) return new NextResponse('Paid add-on required', { status: 402 });
  const p = new URL(req.url).searchParams.get('p') || '';
  const m = /^(\d+)\/(s2|ls|s1)\/[0-9T]{13}_(before|after|change)\.jpg$/.exec(p);
  if (!m) return new NextResponse('Bad path', { status: 400 });
  const own = await (await db()).query('SELECT 1 FROM ow_sites WHERE id = $1 AND user_id = $2', [m[1], v.key]);
  if (!own.rowCount) return new NextResponse('Not found', { status: 404 });
  const root = process.env.OW_DATA_DIR || '/data/imagery';
  try {
    const buf = await readFile(path.join(root, p));
    return new NextResponse(new Uint8Array(buf), { headers: { 'content-type': 'image/jpeg', 'cache-control': 'private, max-age=86400' } });
  } catch { return new NextResponse('Not found', { status: 404 }); }
}
