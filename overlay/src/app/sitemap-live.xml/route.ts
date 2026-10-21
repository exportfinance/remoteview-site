import { urlset, hourIso } from '@/lib/seo/sitemap';
import { TOPICS } from '@/lib/seo/live';
import { PUBLIC_URL } from '@/lib/publicUrl';
export const dynamic = 'force-dynamic';
export function GET() { const h = hourIso(); return urlset(TOPICS.map((t, i) => ({ loc: `${PUBLIC_URL}/live/${t.slug}`, lastmod: h, changefreq: 'hourly', priority: i < 8 ? 0.8 : 0.5 }))); }
