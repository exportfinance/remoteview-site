import type { MetadataRoute } from 'next';
import { PUBLIC_URL } from '@/lib/publicUrl';
export const dynamic = 'force-dynamic';
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return ['/', '/privacy', '/terms', '/credits'].map((p) => ({ url: PUBLIC_URL + p, lastModified: now, changeFrequency: p === '/' ? 'weekly' : 'monthly', priority: p === '/' ? 1 : 0.3 }));
}
