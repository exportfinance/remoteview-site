/* RemoteView edition switch.
   RV_EDITION=commercial (server) / NEXT_PUBLIC_RV_EDITION=commercial (client, build-time)
   hides and disables every data source whose terms do not allow paid/commercial use,
   or that is not yet verified. The private edition (default) is unaffected. */

export const IS_COMMERCIAL: boolean =
  process.env.NEXT_PUBLIC_RV_EDITION === 'commercial' || process.env.RV_EDITION === 'commercial';

/** Hostname suffixes never contacted in the commercial edition (server or browser). */
export const BLOCKED_HOSTS = [
  'coingecko.com',            // crypto ticker
  'exim.gov',                 // US EXIM cover
  'opensanctions.org',        // replaced by OFAC / UK / EU official lists
  'opensky-network.org',      // adsb.lol only
  'globalfishingwatch.org',
  'skylinewebcams.com',
  'abuse.ch',                 // replaced by MITRE ATT&CK + CISA KEV
  'blitzortung.org',
  'etherscan.io',             // replaced by Blockscout
  'finance.yahoo.com',        // markets dropped
  'ip-api.com', 'ipapi.co',
  'adsb.fi',
  'nuforc.org',
  'receiverbook.de', 'kiwisdr.com', 'openwebrx.de',
  'liveuamap.com',
  'internetdb.shodan.io',
  'globe.adsbexchange.com',
];

/** URL fragments blocked even on otherwise-allowed hosts. */
export const BLOCKED_URL_PARTS = [
  'api.cloudflare.com/client/v4/radar', // Radar API data is CC BY-NC
  'uk-export-finance',                  // UKEF country cover pages on gov.uk
  'country-cover-policy-and-indicators',
];

/** API paths (prefix match) that return 404 in the commercial edition. */
export const BLOCKED_API = [
  '/api/crypto', '/api/markets', '/api/cloudflare-radar', '/api/cyber-attacks', '/api/malware',
  '/api/geo', '/api/osint/ip', '/api/osint/shodan', '/api/osint/sweep', '/api/conflicts',
  '/data/ufo',
];

/** /api/rvx/<feed> handlers removed in the commercial edition. */
export const BLOCKED_FEEDS = new Set([
  'cover-ukef', 'cover-exim', 'ukef', 'exim', 'darkships', 'lightning', 'sdr', 'scanners',
  'markets', 'os-graph',
]);

/** Front-end layer / panel ids hidden in the commercial edition. */
export const HIDDEN_UI = new Set([
  'cover-ukef', 'cover-exim', 'ufo', 'lightning', 'sdr', 'scanners', 'markets', 'darkships',
  'malware', 'cf_outages', 'cf_attacks', 'cyber_attacks', 'conflicts', 'frontlines-liveuamap',
]);

import { DEMO_API, DEMO_RVX } from './demoLists';

export function isBlockedUrl(raw: string): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  const h = u.hostname.toLowerCase();
  if (BLOCKED_HOSTS.some((b) => h === b || h.endsWith('.' + b))) return true;
  const s = (h + u.pathname).toLowerCase();
  return BLOCKED_URL_PARTS.some((p) => s.includes(p));
}

export function isBlockedPath(pathname: string): boolean {
  if (BLOCKED_API.some((p) => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p + '?'))) return true;
  const m = pathname.match(/^\/api\/rvx\/([^/?]+)/);
  return !!m && BLOCKED_FEEDS.has(decodeURIComponent(m[1]));
}

/** FNV-1a 32-bit, so the inline guard carries hashes rather than readable host names. */
function fnv(t: string): number { let x = 2166136261; for (let i = 0; i < t.length; i++) { x ^= t.charCodeAt(i); x = Math.imul(x, 16777619) >>> 0; } return x; }

/** Inline browser guard (stringified into <head>): blocks fetch/EventSource/iframes/img to blocked hosts and paths. */
export function browserGuardScript(): string {
  return `(()=>{const fh=(t)=>{let x=2166136261;for(let i=0;i<t.length;i++){x^=t.charCodeAt(i);x=Math.imul(x,16777619)>>>0}return x},H=${JSON.stringify(BLOCKED_HOSTS.map(fnv))},A=${JSON.stringify(BLOCKED_API.map(fnv))},F=${JSON.stringify([...BLOCKED_FEEDS].map(fnv))};
const bad=(r)=>{try{const u=new URL(String(r&&r.url||r),location.href);if(u.origin===location.origin){const p=u.pathname;{const sg=p.split('/');for(let k=2;k<=sg.length;k++){if(A.includes(fh(sg.slice(0,k).join('/'))))return true}}const m=p.match(/^\\/api\\/rvx\\/([^/]+)/);return !!(m&&F.includes(fh(decodeURIComponent(m[1]))));}const h=u.hostname.toLowerCase().split('.');for(let k=0;k<h.length-1;k++){if(H.includes(fh(h.slice(k).join('.'))))return true}return false}catch(e){return false}};
const DA=${JSON.stringify(DEMO_API)},DR=${JSON.stringify([...DEMO_RVX])};const demo=location.pathname.replace(/\\/$/,'')==='/demo';
const locked=(r)=>{if(!demo)return false;try{const u=new URL(String(r&&r.url||r),location.href);if(u.origin!==location.origin||!u.pathname.startsWith('/api/'))return false;const p=u.pathname;if(DA.some(a=>p===a||p.startsWith(a+'/')))return false;const m=p.match(/^\\/api\\/rvx\\/([^/]+)$/);if(m&&DR.includes(decodeURIComponent(m[1])))return false;return true;}catch(e){return false}};
window.__rvBlocked=bad;const of=window.fetch.bind(window);window.fetch=(r,i)=>locked(r)?(window.dispatchEvent(new CustomEvent('rv-demo-locked',{detail:'this feature'})),Promise.resolve(new Response(JSON.stringify({error:'Available in the full version',upsell:'/pricing'}),{status:402,headers:{'content-type':'application/json'}}))):bad(r)?Promise.resolve(new Response(JSON.stringify({error:'not available in this edition'}),{status:404,headers:{'content-type':'application/json'}})):of(r,i);
const OE=window.EventSource;if(OE){window.EventSource=function(u,o){if(bad(u)||locked(u)){u='data:text/event-stream,';}return new OE(u,o)};window.EventSource.prototype=OE.prototype;}
const strip=(n)=>{if(n&&n.tagName&&/^(IFRAME|IMG|VIDEO|SOURCE|SCRIPT)$/.test(n.tagName)){const s=n.getAttribute('src');if(s&&bad(s)){n.removeAttribute('src');n.setAttribute('data-rv-blocked','1');}}};
new MutationObserver(ms=>{for(const m of ms){if(m.type==='attributes')strip(m.target);else m.addedNodes.forEach(n=>{strip(n);n.querySelectorAll&&n.querySelectorAll('iframe,img,video,source,script').forEach(strip)})}}).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['src']});})();`;
}

/** Camera records that point at an excluded host (e.g. SkylineWebcams) are dropped. */
export function cameraAllowed(cam: unknown): boolean {
  if (!IS_COMMERCIAL || !cam || typeof cam !== 'object') return true;
  for (const v of Object.values(cam as Record<string, unknown>)) {
    if (typeof v === 'string') {
      if (/skyline\s*webcams/i.test(v)) return false;
      if (/^https?:\/\//i.test(v) && isBlockedUrl(v)) return false;
    }
  }
  return true;
}
