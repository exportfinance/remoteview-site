import { index } from '@/lib/seo/sitemap';
export const dynamic = 'force-dynamic';
export function GET() { return index(['sitemap-static.xml', 'sitemap-live.xml', 'sitemap-countries.xml']); }
