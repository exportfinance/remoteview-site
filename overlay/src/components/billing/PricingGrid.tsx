'use client';
import { useState } from 'react';
import PlanButton from './PlanButton';
type P = { id: string; name: string; month: number; year: number; blurb: string; features: string[]; featured?: boolean };
const money = (n: number) => '$' + (Number.isInteger(n) ? n.toLocaleString('en-US') : n.toFixed(2));
export default function PricingGrid({ plans, enabled, founder, founderPct, trialDays, teamsHref }: { plans: P[]; enabled: boolean; founder: boolean; founderPct: number; trialDays: number; teamsHref: string }) {
  const [iv, setIv] = useState<'month' | 'year'>('month');
  const f = founder ? (100 - founderPct) / 100 : 1;
  return <>
    <div role="tablist" aria-label="Billing period" style={{ display: 'inline-flex', border: '1px solid rgba(45,212,191,.35)', borderRadius: 999, padding: 4, margin: '6px 0 22px' }}>
      {(['month', 'year'] as const).map((k) => <button key={k} role="tab" aria-selected={iv === k} onClick={() => setIv(k)} style={{ border: 0, cursor: 'pointer', borderRadius: 999, padding: '8px 16px', font: '600 14px inherit', background: iv === k ? '#2DD4BF' : 'transparent', color: iv === k ? '#032024' : '#e6f1ff', transition: 'background .3s,color .3s' }}>{k === 'month' ? 'Monthly' : 'Yearly · 2 months free'}</button>)}
    </div>
    <div className="hud-grid">
      {plans.map((p) => { const list = iv === 'month' ? p.month : p.year; const now = Math.round(list * f * 100) / 100; return (
        <div key={p.id} className="hud-card" data-file={p.name} style={p.featured ? { borderColor: 'rgba(45,212,191,.6)', boxShadow: '0 0 60px rgba(45,212,191,.12)' } : undefined}>
          <div style={{ fontSize: 22, fontWeight: 600 }}>{p.name}</div>
          <div className="hud-lbl" style={{ minHeight: 38 }}>{p.blurb}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '14px 0 2px' }}>
            <span className="hud-big" style={{ fontSize: 40 }}>{money(now)}</span><span className="hud-lbl">/{iv === 'month' ? 'mo' : 'yr'}</span>
            {founder && <s className="hud-lbl">{money(list)}</s>}
          </div>
          <div className="hud-lbl" style={{ marginBottom: 14 }}>{founder ? `Founder price, ${founderPct}% off for life · ` : ''}{trialDays}-day free trial, card required, cancel any time</div>
          <PlanButton plan={p.id} interval={iv} enabled={enabled} label={`Start ${trialDays}-day free trial`} />
          <ul style={{ margin: '16px 0 0', paddingLeft: 18, color: '#c9d8e8', fontSize: 14, lineHeight: 1.7 }}>{p.features.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>); })}
      <div className="hud-card" data-file="Teams">
        <div style={{ fontSize: 22, fontWeight: 600 }}>Teams</div>
        <div className="hud-lbl" style={{ minHeight: 38 }}>Seats, shared case files and admin controls for desks and agencies.</div>
        <div style={{ margin: '14px 0 2px' }}><span className="hud-big" style={{ fontSize: 40 }}>from $299</span><span className="hud-lbl">/mo</span></div>
        <div className="hud-lbl" style={{ marginBottom: 14 }}>Quote-based. Talk to us.</div>
        <a className="hud-ghost" style={{ display: 'block', textAlign: 'center' }} href={teamsHref}>Contact us</a>
      </div>
    </div>
  </>;
}
