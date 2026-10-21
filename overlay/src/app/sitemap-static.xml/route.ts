import { urlset } from '@/lib/seo/sitemap';
import { PUBLIC_URL } from '@/lib/publicUrl';
export const dynamic = 'force-dynamic';
const UPDATED = '2026-10-21';
export function GET() {
  return urlset([['/', 1, 'weekly'], ['/pricing', 0.9, 'weekly'], ['/country', 0.8, 'daily'], ['/live', 0.8, 'hourly'], ['/terms', 0.2, 'yearly'], ['/privacy', 0.2, 'yearly'], ['/credits', 0.2, 'monthly']].map(([p, pr, cf]) => ({ loc: PUBLIC_URL + p, lastmod: UPDATED, priority: pr as number, changefreq: cf as string })));
}
