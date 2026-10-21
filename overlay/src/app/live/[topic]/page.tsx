import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import SeoShell, { Cta } from '@/components/seo/Shell';
import { TOPICS, topicBySlug, snapshot, dots, dotPath } from '@/lib/seo/live';
import { worldPath } from '@/lib/seo/data';
import { PUBLIC_URL } from '@/lib/publicUrl';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ topic: string }> }): Promise<Metadata> {
  const { topic } = await params; const t = topicBySlug(topic); if (!t) return {};
  const url = `${PUBLIC_URL}/live/${t.slug}`;
  return { title: t.title, description: t.desc, robots: { index: true, follow: true }, alternates: { canonical: url }, openGraph: { title: t.title, description: t.desc, url, type: 'article', siteName: 'RemoteView' }, twitter: { card: 'summary_large_image', title: t.title, description: t.desc } };
}

export default async function Live({ params }: { params: Promise<{ topic: string }> }) {
  const { topic } = await params; const t = topicBySlug(topic); if (!t) notFound();
  const s = await snapshot(t).catch(() => null);
  const W = 640, H = 320;
  const land = s ? await worldPath(s.bbox, W, H).catch(() => '') : '';
  const pts = s ? dots(s.points, s.bbox, W, H, t.kind === 'aurora' ? 3000 : 400) : [];
  const url = `${PUBLIC_URL}/live/${t.slug}`;
  const others = TOPICS.filter((x) => x.slug !== t.slug);
  const jsonLd = [
    { '@context': 'https://schema.org', '@type': 'WebPage', name: t.title, description: t.desc, url, dateModified: s?.fetched, isPartOf: { '@type': 'WebSite', name: 'RemoteView', url: PUBLIC_URL } },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Live maps', item: PUBLIC_URL + '/live' }, { '@type': 'ListItem', position: 2, name: t.h1, item: url }] },
  ];
  return (
    <SeoShell jsonLd={jsonLd}>
      <div className="hud-kick">// LIVE SNAPSHOT · REFRESHED HOURLY</div>
      <h1>{t.h1}</h1>
      <p className="hud-sub">{t.desc}</p>
      {!s ? <p className="hud-lbl">The source did not respond. This page refreshes hourly.</p> : <>
        <div className={'hud-grid ' + (s.stat ? 'hud-g12' : '')} style={s.stat ? undefined : { gridTemplateColumns: '1fr' }}>
          {s.stat && <div className="hud-card" data-file="Count"><div className="hud-big">{s.stat}</div><div className="hud-lbl">{s.statLabel}</div><div className="hud-lbl" style={{ marginTop: 10 }}>Snapshot {s.fetched.slice(0, 16).replace('T', ' ')} UTC</div></div>}
          {s.points.length > 0 || land ? <div className="hud-card" data-file="Map">
            <svg className="hud-map" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Map: ${s.headline}`}>
              <path className="land" d={land} />
              {t.kind === 'aurora' ? <path className="dot hud-tgt" d={dotPath(pts, 1.4)} opacity={0.55} /> : pts.map(([x, y], i) => <circle key={i} className="dot hud-tgt" cx={x} cy={y} r={3} style={{ animationDelay: `${Math.min(i, 60) * 12}ms` }} />)}
            </svg>
          </div> : null}
        </div>
        <div className="hud-card" data-file={`${s.headline.toUpperCase()}`} style={{ marginTop: 14, overflowX: 'auto' }}>
          <table className="hud-t"><thead><tr>{s.cols.map(([, l]) => <th key={l}>{l}</th>)}</tr></thead>
            <tbody>{s.rows.map((r, i) => <tr key={i}>{s.cols.map(([k], j) => <td key={k} className={j ? '' : 'hud-mono'}>{k === 'source' && r.url ? <a href={String(r.url)}>{r[k]}</a> : r[k] ?? '—'}</td>)}</tr>)}</tbody></table>
          {!s.rows.length && <p className="hud-lbl">Nothing to show at snapshot time.</p>}
        </div>
        {s.note && <p className="hud-lbl" style={{ marginTop: 10 }}>{s.note}</p>}
      </>}
      <Cta title="Track it live, as it happens" sub="Conflict signals, outages, shipping chokepoints, country risk and disasters on one live map. 7-day free trial." />
      <h2>Embed this map</h2>
      <pre className="hud-mono" style={{ whiteSpace: 'pre-wrap', fontSize: 12, padding: 12, border: '1px solid rgba(45,212,191,.18)', borderRadius: 4, color: '#9fb3c8' }}>{`<iframe src="${PUBLIC_URL}/embed/live/${t.slug}" width="480" height="320" style="border:0" loading="lazy" title="${t.h1} — RemoteView"></iframe>`}</pre>
      <h2 style={{ marginTop: 30 }}>More live maps</h2>
      <div className="hud-links">{others.map((o) => <a key={o.slug} href={`/live/${o.slug}`}>{o.h1}</a>)}<a href="/country">Country risk →</a></div>
      {s && <p className="hud-src" style={{ marginTop: 26 }}>Source: {s.sourceUrl.startsWith('http') ? <a href={s.sourceUrl}>{s.source}</a> : s.source}. Map outlines: Natural Earth (public domain).</p>}
    </SeoShell>
  );
}
