import { urlset, dayIso } from '@/lib/seo/sitemap';
import { countryList } from '@/lib/seo/data';
import { PUBLIC_URL } from '@/lib/publicUrl';
export const dynamic = 'force-dynamic';
export async function GET() { const d = dayIso(); return urlset((await countryList().catch(() => [])).map((c) => ({ loc: `${PUBLIC_URL}/country/${c.slug}`, lastmod: d, changefreq: 'daily', priority: 0.6 }))); }
