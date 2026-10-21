import { snapImage } from '@/lib/snapshots';
export const dynamic = 'force-dynamic';
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const img = await snapImage(id).catch(() => null);
  if (!img) return new Response(null, { status: 302, headers: { location: '/landing/og.jpg' } });
  return new Response(new Uint8Array(img), { headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' } });
}
