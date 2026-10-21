import { PUBLIC_URL } from '@/lib/publicUrl';
export type SmUrl = { loc: string; lastmod?: string; changefreq?: string; priority?: number };
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
export function urlset(urls: SmUrl[]) {
  const body = urls.map((u) => `<url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}${u.changefreq ? `<changefreq>${u.changefreq}</changefreq>` : ''}${u.priority != null ? `<priority>${u.priority}</priority>` : ''}</url>`).join('\n');
  return xml(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`);
}
export function index(names: string[]) {
  const now = new Date().toISOString();
  return xml(`<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${names.map((n) => `<sitemap><loc>${PUBLIC_URL}/${n}</loc><lastmod>${now}</lastmod></sitemap>`).join('\n')}\n</sitemapindex>`);
}
function xml(s: string) { return new Response(s, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' } }); }
/** Last full hour, as an honest lastmod for hourly snapshot pages. */
export const hourIso = () => { const d = new Date(); d.setUTCMinutes(0, 0, 0); return d.toISOString(); };
export const dayIso = () => new Date().toISOString().slice(0, 10);
