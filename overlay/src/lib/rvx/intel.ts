/* RemoteView extras: official country indicators for the dossier.
   FCDO travel advice (gov.uk content API, OGL), World Bank WDI + WGI APIs, IMF DataMapper (WEO). */
import { cached, getJson } from './util';
import { matchName } from './country';

const DAY = 24 * 3600_000;
const FCDO_LABEL: Record<string, string> = {
  avoid_all_travel_to_whole_country: 'FCDO advises against ALL travel to the whole country',
  avoid_all_but_essential_travel_to_whole_country: 'FCDO advises against all but essential travel to the whole country',
  avoid_all_travel_to_parts: 'FCDO advises against all travel to parts of the country',
  avoid_all_but_essential_travel_to_parts: 'FCDO advises against all but essential travel to parts of the country',
};
async function fcdo(name: string, long: string) {
  const idx = await cached('fcdo-idx', DAY, () => getJson('https://www.gov.uk/api/content/foreign-travel-advice', { timeout: 20000 }));
  const kids = (idx.links?.children || []).map((k: any) => ({ name: k.details?.country?.name || k.title, path: k.base_path }));
  const hit = matchName(kids, name, long) as any;
  if (!hit) return null;
  const d = await cached('fcdo-' + hit.path, DAY, () => getJson('https://www.gov.uk/api/content' + hit.path, { timeout: 20000 }));
  const st: string[] = d.details?.alert_status || [];
  return { alerts: st.map((s) => FCDO_LABEL[s] || s), level: st.some((s) => s.includes('whole_country') && s.startsWith('avoid_all_travel')) ? 4 : st.some((s) => s.includes('whole_country')) ? 3 : st.length ? 2 : 1,
    change: d.details?.change_description, updated: d.public_updated_at, url: 'https://www.gov.uk' + hit.path, source: 'FCDO travel advice (gov.uk, OGL)' };
}
const WB = [
  ['NY.GDP.MKTP.CD', 'GDP (current US$)'], ['NY.GDP.PCAP.CD', 'GDP per capita (US$)'], ['FP.CPI.TOTL.ZG', 'Inflation (CPI, %)'],
  ['GC.DOD.TOTL.GD.ZS', 'Central government debt (% of GDP)'], ['SP.POP.TOTL', 'Population'],
];
const WGI = [['GOV_WGI_CC.EST', 'Control of corruption'], ['GOV_WGI_GE.EST', 'Government effectiveness'], ['GOV_WGI_PV.EST', 'Political stability / no violence'], ['GOV_WGI_RL.EST', 'Rule of law'], ['GOV_WGI_RQ.EST', 'Regulatory quality'], ['GOV_WGI_VA.EST', 'Voice & accountability']];
async function wb(iso2: string, ind: string, source?: number) {
  const d = await getJson(`https://api.worldbank.org/v2/country/${iso2}/indicator/${ind}?format=json&mrv=1${source ? `&source=${source}` : ''}`, { timeout: 15000 });
  const v = d?.[1]?.[0];
  return v && v.value != null ? { value: v.value, year: v.date } : null;
}
async function worldbank(iso2: string) {
  return cached('wb-' + iso2, DAY, async () => {
    const vals = await Promise.all(WB.map(([id]) => wb(iso2, id).catch(() => null)));
    const gov = await Promise.all(WGI.map(([id]) => wb(iso2, id, 3).catch(() => null)));
    return {
      indicators: WB.map(([id, label], i) => ({ id, label, ...(vals[i] || { value: null }) })).filter((x) => x.value != null),
      wgi: WGI.map(([id, label], i) => ({ id, label, ...(gov[i] || { value: null }) })).filter((x) => x.value != null),
      source: 'World Bank WDI + Worldwide Governance Indicators (API, CC BY 4.0); WGI estimates range about -2.5 to +2.5',
      url: `https://data.worldbank.org/country/${iso2}`,
    };
  });
}
const IMF = [['NGDP_RPCH', 'Real GDP growth (%)'], ['PCPIPCH', 'Inflation (%)'], ['GGXWDG_NGDP', 'Government gross debt (% of GDP)'], ['LUR', 'Unemployment (%)']];
async function imf(iso3: string) {
  const sets = await Promise.all(IMF.map(([id]) => cached('imf-' + id, DAY, () => getJson(`https://www.imf.org/external/datamapper/api/v1/${id}`, { timeout: 30000 })).catch(() => null)));
  const y = new Date().getUTCFullYear();
  const rows = IMF.map(([id, label], i) => {
    const s = sets[i]?.values?.[id]?.[iso3]; if (!s) return null;
    return { id, label, values: [y - 1, y, y + 1, y + 2].map((yy) => ({ year: yy, value: s[String(yy)] ?? null, forecast: yy >= y })) };
  }).filter(Boolean);
  return { rows, source: 'IMF DataMapper (World Economic Outlook); current and future years are IMF projections', url: `https://www.imf.org/external/datamapper/profile/${iso3}` };
}
export async function intel(c: { name: string; long: string; iso2: string; iso3: string }) {
  const [f, w, m] = await Promise.allSettled([fcdo(c.name, c.long), worldbank(c.iso2), imf(c.iso3)]);
  const val = (r: PromiseSettledResult<any>) => (r.status === 'fulfilled' ? r.value : { error: (r.reason as Error)?.message });
  return { fcdo: val(f), worldbank: val(w), imf: val(m),
    skipped: {
      'OECD country risk': 'Published as a PDF/XLSX on oecd.org; not yet integrated',
      'US State Dept advisories': 'not yet integrated',
      'Sovereign ratings': 'No free official machine-readable source (S&P/Moody\'s/Fitch are proprietary)',
      'ReliefWeb': 'API now requires an approved appname (free request at apidoc.reliefweb.int)',
      'trade.gov Consolidated Screening List': 'API requires a free subscription key from developer.trade.gov',
    } };
}
