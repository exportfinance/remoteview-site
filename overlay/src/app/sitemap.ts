import type { MetadataRoute } from 'next';
import { PUBLIC_URL } from '@/lib/publicUrl';
import { countryList } from '@/lib/seo/data';
import { TOPICS } from '@/lib/seo/live';
export const revalidate = 86400;
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const base: MetadataRoute.Sitemap = ['/', '/country', '/live', '/privacy', '/terms', '/credits', '/pricing'].map((p) => ({ url: PUBLIC_URL + p, lastModified: now, changeFrequency: p === '/' ? 'weekly' : p === '/country' || p === '/live' ? 'daily' : 'monthly', priority: p === '/' ? 1 : p.length < 9 ? 0.8 : 0.3 }));
  const live = TOPICS.map((t) => ({ url: `${PUBLIC_URL}/live/${t.slug}`, lastModified: now, changeFrequency: 'hourly' as const, priority: 0.8 }));
  const countries = (await countryList().catch(() => [])).map((c) => ({ url: `${PUBLIC_URL}/country/${c.slug}`, lastModified: now, changeFrequency: 'daily' as const, priority: 0.6 }));
  return [...base, ...live, ...countries];
}
