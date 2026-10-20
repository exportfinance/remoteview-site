import { NextResponse } from 'next/server';
import { safeFetch, isRateLimited, getClientIp } from '@/lib/ssrf-guard';
import { matchExact, type SanctionEntry } from '@/lib/sanctions';

// WHOIS + Domain Intelligence via RDAP (free, standardized).
// Cross-checks any registrant / org names returned by RDAP against the
// OFAC SDN list so a sanctioned registrant surfaces alongside the WHOIS
// metadata (still keyless — the SDN snapshot is sourced from the open
// OpenSanctions mirror).
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const domain = searchParams.get('domain');
  if (!domain) return NextResponse.json({ error: 'Missing domain parameter' }, { status: 400 });

  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp, 20, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
    return NextResponse.json({ error: 'Invalid domain format' }, { status: 400 });
  }

  try {
    const results: any = { domain, timestamp: new Date().toISOString() };

    // RDAP (Registration Data Access Protocol) — successor to WHOIS
    try {
      // Registry RDAP first (known TLDs, then IANA bootstrap), rdap.org last —
      // rdap.org sits behind Cloudflare and 403s datacenter/Node clients.
      const KNOWN: Record<string, string> = {
        com: 'https://rdap.verisign.com/com/v1/', net: 'https://rdap.verisign.com/net/v1/',
        org: 'https://rdap.publicinterestregistry.org/rdap/', io: 'https://rdap.identitydigital.services/rdap/',
        uk: 'https://rdap.nominet.uk/uk/', online: 'https://rdap.centralnic.com/online/',
        dev: 'https://pubapi.registry.google/rdap/', app: 'https://pubapi.registry.google/rdap/',
      };
      const rdapErrors: string[] = [];
      const tld = domain.toLowerCase().split('.').pop()!;
      const bases: string[] = [];
      if (KNOWN[tld]) bases.push(KNOWN[tld]);
      try {
        const boot = await fetch('https://data.iana.org/rdap/dns.json', { signal: AbortSignal.timeout(10000), cache: 'force-cache' } as RequestInit).then(r => r.json());
        const svc = (boot.services || []).find((s: any) => s[0].includes(tld));
        for (const u of svc?.[1] || []) if (!bases.includes(u)) bases.push(u);
      } catch (e) { rdapErrors.push(`iana: ${e instanceof Error ? e.message : e}`); }
      bases.push('https://rdap.org/');
      let res: Response | null = null;
      for (const base of bases) {
        for (let i = 0; i < 2 && !res; i++) {
          try {
            const r = await fetch(`${base.replace(/\/$/, '')}/domain/${encodeURIComponent(domain)}`, {
              signal: AbortSignal.timeout(12000),
              headers: { 'Accept': 'application/rdap+json, application/json', 'User-Agent': 'Mozilla/5.0 (RemoteView-OSINT)' },
            });
            if (r.ok) res = r; else { rdapErrors.push(`${new URL(base).host}: ${r.status}`); if (r.status === 404) break; }
          } catch (e) { rdapErrors.push(`${new URL(base).host}: ${e instanceof Error ? e.message : e}`); }
        }
        if (res) break;
      }
      if (!res && rdapErrors.length) results.rdap_error = rdapErrors.join('; ');
      if (res) {
        const data = await res.json();
        results.rdap = {
          handle: data.handle,
          name: data.ldhName,
          status: data.status,
          events: (data.events || []).map((e: any) => ({
            action: e.eventAction,
            date: e.eventDate,
          })),
          nameservers: (data.nameservers || []).map((ns: any) => ns.ldhName),
          entities: (data.entities || []).map((e: any) => ({
            handle: e.handle,
            roles: e.roles,
            name: e.vcardArray?.[1]?.find((v: any) => v[0] === 'fn')?.[3],
            org: e.vcardArray?.[1]?.find((v: any) => v[0] === 'org')?.[3],
          })).filter((e: any) => e.name || e.org),
        };

        // Extract key dates
        const events = results.rdap.events || [];
        results.registration = events.find((e: any) => e.action === 'registration')?.date;
        results.expiration = events.find((e: any) => e.action === 'expiration')?.date;
        results.last_changed = events.find((e: any) => e.action === 'last changed')?.date;
      }
    } catch (e) { console.warn('[REMOTEVIEW] Suppressed error:', e instanceof Error ? e.message : e); }

    // HTTP headers for tech fingerprinting — go through safeFetch so the
    // attacker can't aim a HEAD request at internal infrastructure with a
    // hostname that resolves to a reserved range, or chain a redirect from a
    // public host to one. Redirects are followed manually with re-validation.
    try {
      const res = await safeFetch(`https://${domain}`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
        maxRedirects: 3,
      });
      const headers: Record<string, string> = {};
      ['server', 'x-powered-by', 'x-frame-options', 'strict-transport-security',
       'content-security-policy', 'x-content-type-options', 'x-xss-protection',
       'referrer-policy', 'permissions-policy'].forEach(h => {
        const v = res.headers.get(h);
        if (v) headers[h] = v;
      });
      results.http = {
        status: res.status,
        headers,
        redirected: res.redirected,
        final_url: res.url,
      };

      // Security score
      let score = 0;
      if (headers['strict-transport-security']) score += 2;
      if (headers['content-security-policy']) score += 2;
      if (headers['x-frame-options']) score += 1;
      if (headers['x-content-type-options']) score += 1;
      if (headers['referrer-policy']) score += 1;
      results.security_score = { score, max: 7, grade: score >= 5 ? 'A' : score >= 3 ? 'B' : score >= 1 ? 'C' : 'F' };
    } catch (e) { console.warn('[REMOTEVIEW] Suppressed error:', e instanceof Error ? e.message : e); }

    // OFAC SDN cross-check on RDAP entity names/orgs.
    try {
      const candidates = new Set<string>();
      for (const ent of results.rdap?.entities ?? []) {
        if (ent.name) candidates.add(ent.name);
        if (ent.org) candidates.add(ent.org);
      }
      const hits: Array<{ matched_value: string; entries: SanctionEntry[] }> = [];
      for (const value of candidates) {
        const entries = await matchExact(value);
        if (entries.length) hits.push({ matched_value: value, entries });
      }
      results.sanctions_match = hits.length
        ? { source: 'OFAC SDN', hits }
        : null;
    } catch (e) { console.warn('[REMOTEVIEW] Sanctions cross-check failed:', e instanceof Error ? e.message : e); }

    return NextResponse.json(results);
  } catch {
    return NextResponse.json({ error: 'WHOIS lookup failed' }, { status: 500 });
  }
}
