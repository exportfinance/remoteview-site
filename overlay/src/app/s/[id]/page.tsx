import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import SeoShell, { Cta } from '@/components/seo/Shell';
import { getSnap } from '@/lib/snapshots';
import { PUBLIC_URL } from '@/lib/publicUrl';
export const dynamic = 'force-dynamic';
const LABELS: Record<string, string> = { flights: 'Live flights', military: 'Military aircraft', private: 'Private aircraft', satellites: 'Satellites', earthquakes: 'Earthquakes', weather: 'Weather', day_night: 'Day / night', live_clouds: 'Clouds', ships: 'Ships', aurora: 'Aurora' };
const pretty = (k: string) => LABELS[k] || k.replace(/^sat_/, 'Satellites: ').replace(/_/g, ' ');
const shown = (k: string) => k in LABELS || k.startsWith('sat_');
const coord = (lat: number, lng: number) => `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lng).toFixed(2)}°${lng >= 0 ? 'E' : 'W'}`;
async function load(id: string) { return getSnap(id).catch(() => null); }
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params; const s = await load(id); if (!s) return { title: 'Snapshot not found', robots: { index: false } };
  const title = `Live view${s.place ? ` over ${s.place}` : ''} · RemoteView`;
  const description = `A shared RemoteView snapshot at ${coord(s.lat, s.lng)}. Open it live: flights, satellites, quakes, weather and risk on one globe.`;
  const img = `${PUBLIC_URL}/s/${s.id}/image`;
  return { title, description, robots: { index: false, follow: true }, openGraph: { title, description, url: `${PUBLIC_URL}/s/${s.id}`, images: [{ url: img, width: 1200, height: 630 }], type: 'website', siteName: 'RemoteView' }, twitter: { card: 'summary_large_image', title, description, images: [img] } };
}
export default async function Snapshot({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const s = await load(id); if (!s) notFound();
  const layers = s.layers.split(',').filter((k) => k && shown(k));
  const live = `/demo?layers=${encodeURIComponent(s.layers)}&at=${s.lat.toFixed(4)},${s.lng.toFixed(4)},${s.zoom.toFixed(2)},${s.bearing.toFixed(0)},${s.pitch.toFixed(0)}`;
  return (
    <SeoShell>
      <div className="hud-kick">// SHARED SNAPSHOT · {new Date(s.created_at as any).toISOString().slice(0, 16).replace('T', ' ')} UTC</div>
      <h1>{s.place ? `Live view over ${s.place}` : 'Shared live view'}</h1>
      <p className="hud-sub hud-mono" style={{ fontSize: 14 }}>{coord(s.lat, s.lng)} · zoom {s.zoom.toFixed(1)}</p>
      <div className="hud-card" data-file="FILE // SNAPSHOT" style={{ padding: '38px 8px 8px' }}>
        {s.hasImage ? <img src={`/s/${s.id}/image`} width={1200} height={630} alt={`Map snapshot${s.place ? ` over ${s.place}` : ''}`} style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 3, aspectRatio: '1200/630', objectFit: 'cover', background: '#06182a' }} /> : <div className="hud-lbl" style={{ padding: 40, textAlign: 'center' }}>No image was captured for this view.</div>}
      </div>
      {layers.length > 0 && <div className="hud-links" style={{ marginTop: 14 }}>{layers.slice(0, 20).map((l) => <span key={l} style={{ fontSize: 13, border: '1px solid rgba(45,212,191,.18)', padding: '6px 10px', borderRadius: 999 }}>{pretty(l)}</span>)}</div>}
      <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}><a className="hud-btn" href={live}>Open this view live</a><a className="hud-ghost" href="/pricing">Start 7-day free trial</a></div>
      <p className="hud-lbl" style={{ marginTop: 10 }}>A read-only picture of the map when it was shared. Opening it live shows what is happening now.</p>
      <Cta />
    </SeoShell>
  );
}
