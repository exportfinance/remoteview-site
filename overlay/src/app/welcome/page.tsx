import type { Metadata } from 'next';
import { billingEnabled, founderCoupon, FOUNDER_LIMIT } from '@/lib/billing/config';
import { founderUsed } from '@/lib/accounts';
import { PUBLIC_URL } from '@/lib/publicUrl';

export const dynamic = 'force-dynamic';
const TITLE = 'RemoteView: real-time global intelligence, as it happens';
const DESC = 'Real-time global intelligence on one live map: conflict signals and situation rooms, internet outages and infrastructure, shipping chokepoints, country risk and breaking disasters, with AI briefings that cite their sources. 7-day free trial.';


export async function generateMetadata(): Promise<Metadata> {
  return {
    title: { absolute: TITLE }, description: DESC, metadataBase: new URL(PUBLIC_URL),
    alternates: { canonical: '/' },
    robots: { index: true, follow: true },
    openGraph: { title: TITLE, description: DESC, url: PUBLIC_URL + '/', siteName: 'RemoteView', type: 'website', images: [{ url: '/landing/og.jpg', width: 1200, height: 630, alt: 'RemoteView live intelligence map' }] },
    twitter: { card: 'summary_large_image', title: TITLE, description: DESC, images: ['/landing/og.jpg'] },
  };
}

const FEATURES = [
  ['Conflict signals and situation rooms', 'Unrest and conflict-related events from GDELT, GPS jamming hot spots and military aircraft activity, pulled together into situation rooms you can watch for any region.'],
  ['Infrastructure and outages', 'Internet outage alerts by country from IODA, submarine cables and landing points, power plants and exploited-vulnerability feeds.'],
  ['Shipping chokepoints', 'Live vessel positions and slow-moving traffic at Hormuz, Bab el-Mandeb, Suez, Malacca and the other chokepoints that move world trade.'],
  ['Economic and country risk', 'OECD country risk, FCDO and US State Department travel advice, World Bank indicators and a combined 0\u2013100 risk score for every country.'],
  ['Breaking disasters', 'Earthquakes, tsunamis, volcanoes, wildfires, smoke and tropical storms from USGS, NOAA and NASA, the moment they are published.'],
  ['AI briefings', 'Ask the map a question, or get a briefing of what changed in the last 24 hours. Every answer names its sources.'],
  ['Sanctions search', 'Search the official US OFAC, UK and EU sanctions lists in one place, and see targets mapped by country.'],
  ['Investigation tools', 'Link graphs, a 24-hour replay scrubber, case files and one-click PDF reports for any country.'],
  ['Air, space and weather', 'Live aircraft from open ADS-B data, satellites and launches, space weather and severe weather alerts.'],
];

const PLANS = [
  { name: 'Personal', price: '$19.99', per: '/mo', alt: 'or $199/yr', blurb: 'For enthusiasts and independent researchers.', items: ['Every live layer', 'AI briefings and Q&A (fair use)', 'Saved watchlists and alerts', '1 user'] },
  { name: 'Pro', price: '$49.50', per: '/mo', alt: 'or $495/yr', blurb: 'For analysts, journalists and risk professionals.', items: ['Everything in Personal', 'Higher AI limits', 'PDF country reports and case files', 'Priority support'], featured: true },
  { name: 'Teams', price: 'From $299', per: '/mo', alt: 'Quote on request', blurb: 'For newsrooms, security and risk teams.', items: ['Everything in Pro', 'Multiple seats', 'Shared cases and situation rooms', 'Onboarding'] },
];

const css = `
.rvl{--teal:#2DD4BF;--ink:#e6f1ff;--mut:#9fb3c8;background:#030912;color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;height:100vh;height:100dvh;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain}
body:has([data-rv-landing])>a[href="/credits"]{display:none}
.rvl a{color:var(--ink)}
.rvl-wrap{max-width:1160px;margin:0 auto;padding:0 20px}
.rvl-nav{position:sticky;top:0;z-index:20;backdrop-filter:blur(12px);background:rgba(3,9,18,.7);border-bottom:1px solid rgba(45,212,191,.15)}
.rvl-nav .rvl-wrap{display:flex;align-items:center;justify-content:space-between;height:60px}
.rvl-logo{display:flex;align-items:center;gap:10px;letter-spacing:.35em;font-weight:600;font-size:14px;color:var(--teal);text-decoration:none}
.rvl-navlinks{display:flex;gap:18px;align-items:center;font-size:14px}
.rvl-navlinks a{text-decoration:none;color:var(--mut)}
.rvl-hero{position:relative;min-height:88vh;display:flex;align-items:center;overflow:hidden}
.rvl-hero::after{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at 30% 50%,rgba(3,9,18,.2),rgba(3,9,18,.92) 70%),linear-gradient(180deg,rgba(3,9,18,.2),#030912)}
@keyframes rvlz{from{transform:scale(1.04) translateX(0)}to{transform:scale(1.14) translateX(-2%)}}
.rvl-hero .rvl-wrap{position:relative;z-index:1}
.rvl-kicker{display:inline-block;font-size:12px;letter-spacing:.3em;color:var(--teal);border:1px solid rgba(45,212,191,.4);padding:6px 12px;border-radius:999px;margin-bottom:22px}
.rvl h1{font-size:clamp(38px,6.4vw,78px);line-height:1.02;margin:0 0 20px;letter-spacing:-.02em;max-width:900px}
.rvl h1 span{background:linear-gradient(90deg,#2DD4BF,#7dd3fc);-webkit-background-clip:text;background-clip:text;color:transparent}
.rvl-lead{font-size:clamp(17px,2vw,21px);color:var(--mut);max-width:640px;line-height:1.5;margin:0 0 32px}
.rvl-cta{display:flex;gap:12px;flex-wrap:wrap}
.rvl-btn{background:var(--teal);color:#032024;border:0;border-radius:10px;padding:14px 22px;font-weight:700;font-size:15px;cursor:pointer;text-decoration:none;display:inline-block}
.rvl-btn:disabled{opacity:.6}
.rvl-ghost{border:1px solid rgba(230,241,255,.25);border-radius:10px;padding:13px 20px;text-decoration:none;font-size:15px}
.rvl-sec{padding:96px 0}
.rvl h2{font-size:clamp(28px,3.6vw,44px);margin:0 0 12px;letter-spacing:-.01em}
.rvl-sub{color:var(--mut);margin:0 0 40px;max-width:680px;line-height:1.55}
.rvl-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.rvl-card{background:linear-gradient(180deg,rgba(13,30,52,.75),rgba(6,16,30,.75));border:1px solid rgba(45,212,191,.18);border-radius:16px;padding:22px;position:relative}
.rvl-card h3{margin:0 0 8px;font-size:17px}
.rvl-card p{margin:0;color:var(--mut);line-height:1.55;font-size:14.5px}
.rvl-shots{display:grid;grid-template-columns:2fr 1fr;gap:16px}
.rvl-shots img{width:100%;height:100%;object-fit:cover;border-radius:14px;border:1px solid rgba(45,212,191,.2);display:block}
.rvl-shots .rvl-stack{display:grid;gap:16px}
.rvl-cap{font-size:12px;color:var(--mut);margin-top:6px}
.rvl-price{font-size:40px;font-weight:700;margin:10px 0 0}
.rvl-price small{font-size:15px;color:var(--mut);font-weight:400}
.rvl-feat{border-color:rgba(45,212,191,.6);box-shadow:0 0 60px rgba(45,212,191,.12)}
.rvl-badge{position:absolute;top:16px;right:16px;font-size:11px;letter-spacing:.15em;color:var(--teal);border:1px solid rgba(45,212,191,.4);border-radius:999px;padding:3px 9px}
.rvl-card ul{padding-left:18px;color:var(--mut);line-height:1.9;font-size:14.5px;margin:16px 0 0}
.rvl-form{display:grid;gap:14px;max-width:760px}
.rvl-row{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.rvl-form label{display:grid;gap:6px;font-size:13px;color:var(--mut)}
.rvl-form input[type=email],.rvl-form input[type=text],.rvl-form select{background:#071526;border:1px solid #1e3a5f;color:var(--ink);border-radius:10px;padding:12px;font-size:15px}
.rvl-opt{color:#5f7a96}
.rvl-consent{display:flex!important;grid-template-columns:none!important;gap:10px!important;align-items:flex-start;line-height:1.5}
.rvl-consent input{margin-top:4px}
.rvl-foot{border-top:1px solid rgba(45,212,191,.15);padding:32px 0 48px;color:var(--mut);font-size:13px}
.rvl-foot .rvl-wrap{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}
.rvl-foot a{color:var(--mut);margin-right:16px}

.rvl{scroll-behavior:smooth;-webkit-font-smoothing:antialiased}
.rvl-promo{background:linear-gradient(90deg,#0b3b3a,#0c2a44 50%,#0b3b3a);background-size:200% 100%;animation:rvlsh 9s linear infinite;color:#d7fffa;text-align:center;font-size:13.5px;padding:9px 14px;letter-spacing:.02em}
.rvl-promo b{color:#5eead4}
@keyframes rvlsh{to{background-position:200% 0}}
.rvl-hero{isolation:isolate}
.rvl-hero::before{display:none}
.rvl-heroimg{position:absolute;inset:-4%;width:108%;height:108%;object-fit:cover;opacity:.6;z-index:-2;animation:rvlz 30s ease-in-out infinite alternate;will-change:transform}
.rvl-hero::after{z-index:-1}
.rvl-scan{position:absolute;inset:0;z-index:-1;background:conic-gradient(from 0deg at 62% 50%,rgba(45,212,191,.0),rgba(45,212,191,.10) 8%,rgba(45,212,191,0) 16%);animation:rvlspin 9s linear infinite;mix-blend-mode:screen;pointer-events:none}
@keyframes rvlspin{to{transform:rotate(360deg)}}
.rvl-count{display:inline-flex;align-items:center;gap:8px;margin-top:22px;font-size:14px;color:#c9f7f0}
.rvl-dot{width:8px;height:8px;border-radius:50%;background:#2DD4BF;box-shadow:0 0 0 0 rgba(45,212,191,.7);animation:rvlp 2s infinite}
@keyframes rvlp{70%{box-shadow:0 0 0 10px rgba(45,212,191,0)}100%{box-shadow:0 0 0 0 rgba(45,212,191,0)}}
.rvl-card,.rvl-btn,.rvl-ghost,.rvl-shots img{transition:transform .45s cubic-bezier(.2,.8,.2,1),box-shadow .45s,border-color .45s,background .3s,opacity .3s}
.rvl-card:hover{transform:translateY(-4px);border-color:rgba(45,212,191,.5);box-shadow:0 18px 50px -20px rgba(45,212,191,.35)}
.rvl-btn:hover{transform:translateY(-1px);box-shadow:0 10px 30px -10px rgba(45,212,191,.8)}
.rvl-ghost:hover{border-color:rgba(45,212,191,.6);background:rgba(45,212,191,.06)}
.rvl-shots figure{margin:0;overflow:hidden;border-radius:14px}
.rvl-shots figure:hover img{transform:scale(1.035)}
.rvl-shots img{aspect-ratio:991/745;height:auto}
.rvl-shots .rvl-big img{aspect-ratio:1440/900}
.rvl-js .rvl-r{opacity:0;transform:translateY(18px);transition:opacity .9s cubic-bezier(.2,.8,.2,1),transform .9s cubic-bezier(.2,.8,.2,1)}
.rvl-js .rvl-r.rvl-in{opacity:1;transform:none}
.rvl-js .rvl-grid .rvl-r:nth-child(3n+2){transition-delay:.08s}.rvl-js .rvl-grid .rvl-r:nth-child(3n+3){transition-delay:.16s}
.rvl-navlinks a{white-space:nowrap}.rvl-navlinks a.rvl-btn,.rvl-navlinks a.rvl-btn span{color:#032024}.rvl-show{display:none}@media(max-width:860px){.rvl-show{display:inline}.rvl-btn .rvl-hide{display:none}}
.rvl-mcta{display:none;opacity:0;transform:translateY(24px);pointer-events:none;transition:opacity .4s,transform .4s cubic-bezier(.2,.8,.2,1)}.rvl-mcta.on{opacity:1;transform:none;pointer-events:auto}
@media(max-width:860px){.rvl-mcta{display:flex;position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:30;justify-content:center;gap:10px}.rvl-mcta a{flex:1;text-align:center;box-shadow:0 10px 30px -8px rgba(0,0,0,.8)}.rvl-foot{padding-bottom:96px}.rvl-hero{min-height:82svh}.rvl h1{font-size:40px}.rvl-card:hover{transform:none}}

.rvl-mono{font-family:'JetBrains Mono',ui-monospace,monospace}
.rvl-ov{position:absolute;inset:0;pointer-events:none;z-index:-1}
.rvl-gridov{background-image:linear-gradient(rgba(45,212,191,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(45,212,191,.07) 1px,transparent 1px);background-size:64px 64px;mask-image:radial-gradient(ellipse at 60% 50%,#000 30%,transparent 80%);-webkit-mask-image:radial-gradient(ellipse at 60% 50%,#000 30%,transparent 80%)}
.rvl-lines{background:repeating-linear-gradient(0deg,rgba(0,0,0,.28) 0 1px,transparent 1px 3px);opacity:.5}
.rvl-sweep{background:linear-gradient(180deg,transparent,rgba(45,212,191,.12) 48%,rgba(45,212,191,.35) 50%,transparent 52%);height:30%;top:-30%;bottom:auto;animation:rvlsw 7s cubic-bezier(.5,0,.5,1) infinite}
@keyframes rvlsw{to{transform:translateY(440%)}}
.rvl-tgt{position:absolute;width:46px;height:46px;z-index:-1;pointer-events:none;opacity:0;animation:rvltg .5s cubic-bezier(.2,1.6,.4,1) forwards}
.rvl-tgt::before,.rvl-tgt::after{content:"";position:absolute;inset:0;border:2px solid #2DD4BF;clip-path:polygon(0 0,30% 0,30% 2px,2px 2px,2px 30%,0 30%,0 0,100% 0,100% 30%,calc(100% - 2px) 30%,calc(100% - 2px) 2px,70% 2px,70% 0,100% 0,100% 100%,70% 100%,70% calc(100% - 2px),calc(100% - 2px) calc(100% - 2px),calc(100% - 2px) 70%,100% 70%,100% 100%,0 100%,0 70%,2px 70%,2px calc(100% - 2px),30% calc(100% - 2px),30% 100%,0 100%);filter:drop-shadow(0 0 6px rgba(45,212,191,.7))}
.rvl-tgt::after{inset:20px;border-radius:50%;clip-path:none;border-width:1px;background:#2DD4BF}
.rvl-tgt span{position:absolute;left:54px;top:12px;font:10px 'JetBrains Mono',monospace;letter-spacing:.15em;color:#5eead4;white-space:nowrap}
@keyframes rvltg{0%{opacity:0;transform:scale(2.2)}60%{opacity:1}100%{opacity:1;transform:scale(1)}}
.rvl-hero h1{position:relative}
.rvl-dec{position:absolute;inset:0;pointer-events:none;display:block;font-weight:inherit}
.rvl-decoding{color:transparent!important}.rvl-decoding span{color:transparent!important;-webkit-text-fill-color:transparent!important}
.rvl-glitch{position:relative}
.rvl-glitch:hover{animation:rvlgl .35s steps(2) 1}
@keyframes rvlgl{0%{text-shadow:2px 0 #f43f5e,-2px 0 #22d3ee;clip-path:inset(0 0 40% 0)}33%{text-shadow:-2px 0 #f43f5e,2px 0 #22d3ee;clip-path:inset(40% 0 0 0)}66%{text-shadow:1px 0 #f43f5e,-1px 0 #22d3ee;clip-path:inset(20% 0 20% 0)}100%{text-shadow:none;clip-path:inset(0)}}
.rvl-dossier{position:relative;border-radius:4px!important;background:linear-gradient(180deg,rgba(13,24,40,.9),rgba(6,14,26,.9))!important;padding-top:46px!important}
.rvl-dossier::before{content:attr(data-file);position:absolute;top:0;left:0;right:0;padding:9px 16px;font:10.5px 'JetBrains Mono',monospace;letter-spacing:.2em;color:#5eead4;border-bottom:1px dashed rgba(45,212,191,.3);background:rgba(45,212,191,.05)}
.rvl-dossier::after{content:"OPEN SOURCE";position:absolute;top:34px;right:12px;font:700 9px 'JetBrains Mono',monospace;letter-spacing:.2em;color:rgba(244,63,94,.75);border:1px solid rgba(244,63,94,.55);padding:3px 6px;transform:rotate(6deg)}
.rvl-nostamp::after{display:none}
.rvl-dossier h3{font-family:'JetBrains Mono',monospace;text-transform:uppercase;letter-spacing:.06em;font-size:14.5px}
@media(max-width:860px){.rvl-tgt.rvl-tgt-x{display:none}}
@media(prefers-reduced-motion:reduce){.rvl-decoding{color:inherit!important}.rvl *,.rvl *::before,.rvl *::after{animation:none!important;transition:none!important}.rvl-js .rvl-r{opacity:1;transform:none}}

@media(max-width:860px){.rvl-grid{grid-template-columns:1fr}.rvl-shots{grid-template-columns:1fr}.rvl-row{grid-template-columns:1fr}.rvl-navlinks .rvl-hide{display:none}.rvl-sec{padding:64px 0}}
`;

const reveal = `(()=>{const run=()=>{(()=>{const h=document.querySelector('.rvl-hero h1');if(h&&!matchMedia('(prefers-reduced-motion: reduce)').matches){const T=h.textContent||'',C='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%/<>',o=h.querySelector('.rvl-dec');if(!o)return;h.classList.add('rvl-decoding');o.style.color='#e6f1ff';let f=0;const n=T.length,tick=()=>{f++;const k=Math.floor(f*n/38);let out='';for(let i=0;i<n;i++){const c=T[i];out+=(i<k||c===' '||c===','||c==='.')?c:C[(Math.random()*C.length)|0]}o.textContent=out;if(k<n)requestAnimationFrame(tick);else{o.textContent='';h.classList.remove('rvl-decoding')}};setTimeout(()=>requestAnimationFrame(tick),250)}})();(()=>{const r=document.querySelector('.rvl');if(!r||!('IntersectionObserver' in window))return;r.classList.add('rvl-js');const io=new IntersectionObserver((es)=>{for(const e of es)if(e.isIntersecting){e.target.classList.add('rvl-in');io.unobserve(e.target)}},{root:r,rootMargin:'0px 0px -8% 0px',threshold:.08});const m=r.querySelector('.rvl-mcta'),w=r.querySelector('#start');if(m)r.addEventListener('scroll',()=>{const wb=w?w.getBoundingClientRect():null;m.classList.toggle('on',r.scrollTop>innerHeight*.7&&!(wb&&wb.top<innerHeight&&wb.bottom>0))},{passive:true});r.querySelectorAll('.rvl-r').forEach(el=>{const b=el.getBoundingClientRect();if(b.top<innerHeight)el.classList.add('rvl-in');io.observe(el)})})();};if(document.readyState==='complete')setTimeout(run,300);else addEventListener('load',()=>setTimeout(run,300));})();`;

export default async function Welcome() {
  const live = billingEnabled();
  const founderOpen = !live || !founderCoupon() ? true : await founderUsed().then((n) => n < FOUNDER_LIMIT).catch(() => true);
  return (
    <div className="rvl" data-rv-landing="">
      <link rel="preload" as="image" href="/landing/hero.webp" imageSrcSet="/landing/hero-sm.webp 828w, /landing/hero.webp 1440w" imageSizes="100vw" fetchPriority="high" />
      <style dangerouslySetInnerHTML={{ __html: css }} />
      {founderOpen && <div className="rvl-promo">Founder pricing: <b>first 500 members get 50% off for life.</b> <a href="/pricing" style={{ color: '#5eead4' }}>Claim your spot</a></div>}
      <nav className="rvl-nav"><div className="rvl-wrap">
        <a className="rvl-logo" href="/"><img src="/remoteview-icon.png" alt="" width={26} height={26} />REMOTEVIEW</a>
        <div className="rvl-navlinks"><a className="rvl-hide" href="#features">Features</a><a className="rvl-hide" href="#pricing">Pricing</a><a href="/account?signin=1">Sign in</a><a className="rvl-btn" style={{ padding: '9px 14px', fontSize: 14 }} href="/pricing"><span className="rvl-hide">Start free trial</span><span className="rvl-show">Free trial</span></a></div>
      </div></nav>

      <header className="rvl-hero">
        <img className="rvl-heroimg" src="/landing/hero.webp" srcSet="/landing/hero-sm.webp 828w, /landing/hero.webp 1440w" sizes="100vw" width={1440} height={900} alt="" fetchPriority="high" decoding="async" />
        <div className="rvl-scan" aria-hidden="true" />
        <div className="rvl-ov rvl-gridov" aria-hidden="true" /><div className="rvl-ov rvl-lines" aria-hidden="true" /><div className="rvl-ov rvl-sweep" aria-hidden="true" />
        {[['62%', '34%', 'TRACK 01', '.9s', ''], ['74%', '58%', 'TRACK 02', '1.4s', ' rvl-tgt-x'], ['55%', '66%', 'TRACK 03', '1.9s', ' rvl-tgt-x'], ['82%', '28%', 'TRACK 04', '2.4s', '']].map(([l, t, n, d, x]) => <div key={n} className={'rvl-tgt' + x} aria-hidden="true" style={{ left: l, top: t, animationDelay: d }}><span>{n}</span></div>)}
        <div className="rvl-wrap">
        <div className="rvl-kicker rvl-mono">// LIVE NOW · 7-DAY FREE TRIAL</div>
        <h1>Critical world events, <span>as they happen.</span><b className="rvl-dec" aria-hidden="true" suppressHydrationWarning /></h1>
        <p className="rvl-lead">Real-time intelligence on one live map: conflict signals and situation rooms, internet outages, shipping chokepoints, country risk and breaking disasters, with AI briefings that tell you what changed and why it matters.</p>
        <div className="rvl-cta"><a className="rvl-btn rvl-glitch" href="/pricing">Start 7-day free trial</a><a className="rvl-ghost rvl-glitch" href="/demo">Try the live demo</a></div>
        {founderOpen && <div className="rvl-count"><span className="rvl-dot" />Founder offer: 50% off forever for the first 500</div>}
      </div></header>

      <section className="rvl-sec" id="features"><div className="rvl-wrap">
        <h2 className="rvl-r">One map. Every signal.</h2>
        <p className="rvl-sub">RemoteView brings dozens of open and public-sector data feeds together so you stop juggling tabs. Every layer shows where its data came from.</p>
        <div className="rvl-grid">{FEATURES.map(([t, d]) => <div key={t} className="rvl-card rvl-r rvl-dossier rvl-glitch-h" data-file={'DOSSIER // ' + String(FEATURES.findIndex((f) => f[0] === t) + 1).padStart(2, '0')}><h3>{t}</h3><p>{d}</p></div>)}</div>
      </div></section>

      <section className="rvl-sec" style={{ paddingTop: 0 }}><div className="rvl-wrap">
        <h2>See it for yourself</h2>
        <p className="rvl-sub">Real screenshots from the live app, or try it yourself.</p>
        <div className="rvl-shots rvl-r">
          <figure className="rvl-big"><img src="/landing/layers.webp" srcSet="/landing/layers-sm.webp 828w, /landing/layers.webp 1440w" sizes="(max-width:860px) 100vw, 760px" width={1440} height={900} alt="RemoteView globe with live aircraft and the layer panel" loading="lazy" decoding="async" /><figcaption className="rvl-cap">Live globe with the layer panel</figcaption></figure>
          <div className="rvl-stack">
            <figure><img src="/landing/night.webp" srcSet="/landing/night-sm.webp 560w, /landing/night.webp 991w" sizes="(max-width:860px) 100vw, 380px" width={991} height={745} alt="Night city lights layer with live aircraft" loading="lazy" decoding="async" /><figcaption className="rvl-cap">Night lights with live aircraft</figcaption></figure>
            <figure><img src="/landing/weather.webp" srcSet="/landing/weather-sm.webp 560w, /landing/weather.webp 991w" sizes="(max-width:860px) 100vw, 380px" width={991} height={745} alt="US weather alerts layer" loading="lazy" decoding="async" /><figcaption className="rvl-cap">Severe weather alerts</figcaption></figure>
          </div>
        </div>
        <div className="rvl-shots rvl-r" style={{ marginTop: 16, gridTemplateColumns: '1fr 1fr' }}>
          <figure><img src="/landing/aurora.webp" srcSet="/landing/aurora-sm.webp 560w, /landing/aurora.webp 991w" sizes="(max-width:860px) 100vw, 570px" width={991} height={745} alt="Aurora forecast over the globe" loading="lazy" decoding="async" /><figcaption className="rvl-cap">Aurora forecast</figcaption></figure>
          <figure><img src="/landing/imagery.webp" srcSet="/landing/imagery-sm.webp 560w, /landing/imagery.webp 991w" sizes="(max-width:860px) 100vw, 570px" width={991} height={745} alt="NASA daily satellite imagery layer" loading="lazy" decoding="async" /><figcaption className="rvl-cap">NASA daily satellite imagery</figcaption></figure>
        </div>
        <div className="rvl-r" style={{ marginTop: 28, textAlign: 'center' }}><a className="rvl-btn" href="/demo">Open the live demo</a><div className="rvl-cap" style={{ marginTop: 8 }}>No sign-up. Live flights, satellites, quakes, weather and country risk.</div></div>
      </div></section>

      <section className="rvl-sec" id="pricing"><div className="rvl-wrap">
        <h2 className="rvl-r">Simple pricing</h2>
        <p className="rvl-sub rvl-r">{'Every plan starts with a 7-day free trial.'}{founderOpen ? ' The first 500 members lock in 50% off for life.' : ''}</p>
        <div className="rvl-grid">{PLANS.map((p) => (
          <div key={p.name} className={'rvl-card rvl-r' + (p.featured ? ' rvl-feat' : '')}>
            <span className="rvl-badge">7-DAY FREE TRIAL</span>
            <h3 style={{ fontSize: 20 }}>{p.name}</h3>
            <p>{p.blurb}</p>
            <div className="rvl-price">{p.price}<small>{p.per}</small></div>
            <div className="rvl-cap">{p.alt} · 7-day free trial</div>
            <ul>{p.items.map((i) => <li key={i}>{i}</li>)}</ul>
            <a className={p.featured ? 'rvl-btn' : 'rvl-ghost'} style={{ display: 'block', textAlign: 'center', marginTop: 14 }} href={p.name === 'Teams' ? 'mailto:remoteview@mail.grokbot.com?subject=RemoteView%20Teams' : '/pricing'}>{p.name === 'Teams' ? 'Contact us' : 'Start free trial'}</a>
          </div>
        ))}</div>
        <p className="rvl-cap" style={{ marginTop: 16 }}><>Prices in US dollars. Taxes may apply. <a href="/pricing">Full pricing</a> · <a href="/terms#subscriptions">subscription terms</a>.</></p>
      </div></section>

      <section className="rvl-sec" id="start"><div className="rvl-wrap" style={{ textAlign: 'center' }}>
        <h2>Start your 7-day free trial</h2>
        <p className="rvl-sub" style={{ margin: '0 auto 28px' }}>Full access to every live layer and AI briefing. Cancel any time before the trial ends and you won&apos;t be charged.</p>
        <div className="rvl-cta" style={{ justifyContent: 'center' }}><a className="rvl-btn" href="/pricing">Start 7-day free trial</a><a className="rvl-ghost" href="/demo">Try the live demo</a></div>
        {founderOpen && <p className="rvl-cap" style={{ marginTop: 14 }}>Founder offer: 50% off forever for the first 500</p>}
      </div></section>

      <footer className="rvl-foot"><div className="rvl-wrap">
        <div>© {new Date().getFullYear()} RemoteView</div>
        <div><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/credits">Data credits</a><a href="/demo">Demo</a><a href="https://discord.gg/T6VuJTnKC" target="_blank" rel="noopener noreferrer">Discord</a><a href="mailto:remoteview@mail.grokbot.com">remoteview@mail.grokbot.com</a><a href="/account?signin=1">Sign in</a></div>
      </div></footer>
      <div className="rvl-mcta"><a className="rvl-ghost" style={{ background: 'rgba(3,9,18,.92)' }} href="/demo">Live demo</a><a className="rvl-btn" href="/pricing">Start free trial</a></div>
      <script dangerouslySetInnerHTML={{ __html: reveal }} />
    </div>
  );
}
