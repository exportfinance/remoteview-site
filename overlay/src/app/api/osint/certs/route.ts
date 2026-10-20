import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp } from '@/lib/ssrf-guard';

// Certificate Transparency lookup via crt.sh (free, no key)
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
    // crt.sh first (2 tries), then Cert Spotter (free, keyless) as fallback.
    let certs: any[] | null = null;
    let source = 'crt.sh';
    for (let i = 0; i < 2 && !certs; i++) {
      try {
        const res = await fetch(`https://crt.sh/?q=%25.${encodeURIComponent(domain)}&output=json`, {
          signal: AbortSignal.timeout(12000),
          headers: { 'User-Agent': 'RemoteView-OSINT/3.0' },
        });
        if (res.ok) { const j = await res.json(); if (Array.isArray(j)) certs = j; }
      } catch { /* retry / fall back */ }
    }
    if (!certs) {
      try {
        const res = await fetch(`https://api.certspotter.com/v1/issuances?domain=${encodeURIComponent(domain)}&include_subdomains=true&expand=dns_names&expand=issuer`, {
          signal: AbortSignal.timeout(15000),
          headers: { 'User-Agent': 'RemoteView-OSINT/3.0' },
        });
        if (res.ok) {
          const j = await res.json();
          if (Array.isArray(j)) {
            source = 'certspotter';
            certs = j.reverse().map((c: any) => ({
              id: c.id,
              issuer_name: c.issuer?.name || c.issuer?.friendly_name,
              common_name: (c.dns_names || [])[0] || '',
              name_value: (c.dns_names || []).join('\n'),
              not_before: c.not_before,
              not_after: c.not_after,
              serial_number: c.cert_sha256 || c.id,
            }));
          }
        }
      } catch { /* both failed */ }
    }
    if (!certs) {
      return NextResponse.json({ domain, certificates: [], subdomains: [], error: 'Certificate sources unavailable (crt.sh, certspotter)' });
    }

    // Deduplicate by common name and extract subdomains
    const seen = new Set<string>();
    const subdomains = new Set<string>();
    const uniqueCerts = [];

    for (const cert of certs.slice(0, 200)) {
      const key = `${cert.common_name}-${cert.serial_number}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // Extract subdomains
      const name = cert.name_value || '';
      name.split('\n').forEach((n: string) => {
        const clean = n.trim().replace(/^\*\./, '');
        if (clean.endsWith(domain)) subdomains.add(clean);
      });

      uniqueCerts.push({
        id: cert.id,
        issuer: cert.issuer_name,
        common_name: cert.common_name,
        name_value: cert.name_value,
        not_before: cert.not_before,
        not_after: cert.not_after,
        serial: cert.serial_number,
      });
    }

    return NextResponse.json({
      domain,
      certificates: uniqueCerts.slice(0, 50),
      subdomains: Array.from(subdomains).sort(),
      total_certs: certs.length,
      unique_subdomains: subdomains.size,
      source,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ domain, certificates: [], subdomains: [], error: 'Lookup failed' }, { status: 500 });
  }
}
