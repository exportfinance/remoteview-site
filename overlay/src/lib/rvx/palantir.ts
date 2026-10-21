import { IS_COMMERCIAL } from '@/lib/edition';
/* Palantir pack: entity graphs, OpenSanctions links, threat intel, cases, analytics helpers.
   Free/public data only — no keyed OpenSanctions/Aleph/OTX APIs. */
import fs from 'node:fs';
import path from 'node:path';
import { cached, getJson, getText, selfJson } from './util';
import { S, ensureHistory, ensureAis } from './live';

type Q = URLSearchParams;

const meta = (source: string, extra: Record<string, unknown> = {}) => ({ source, fetched: new Date().toISOString(), ...extra });

/* ── OpenSanctions slim relationship index (OFAC SDN nested NDJSON, public) ── */
const OS_URL = 'https://data.opensanctions.org/datasets/latest/us_ofac_sdn/targets.nested.json';
const OS_CACHE = path.join(process.cwd(), '.cache', 'rvx-os-graph.json');
const REL_KEYS = [
  'ownershipAsset', 'ownershipOwner', 'familyPerson', 'familyRelative',
  'directorshipDirector', 'directorshipOrganization',
  'unknownLinkTo', 'unknownLinkFrom',
  'agencyClient', 'agentRepresentation',
  'membershipMember', 'membershipOrganization',
] as const;

type OsNode = { id: string; caption: string; schema: string };
type OsLink = { source: string; target: string; rel: string; role?: string };

type OsIndex = {
  builtAt: number;
  nodes: Record<string, OsNode>;
  /** adjacency: entityId -> links */
  adj: Record<string, OsLink[]>;
  linkCount: number;
};

let osIndex: OsIndex | null = null;
let osBuilding: Promise<OsIndex> | null = null;

function nestPeer(relKey: string, ownerId: string, nest: any): { peerId: string; peerCap: string; peerSchema: string; role?: string } | null {
  const props = nest?.properties || {};
  const role = (props.role || props.relationship || [])[0];
  const pick = (keys: string[]) => {
    for (const k of keys) {
      const v = props[k]?.[0];
      if (!v) continue;
      if (typeof v === 'string') {
        if (v === ownerId) continue;
        const looksId = /^(NK-|ofac-|Q\d)/.test(v);
        return { peerId: looksId ? v : `name:${v}`, peerCap: v, peerSchema: 'Entity', role };
      }
      if (typeof v === 'object' && v.id) {
        if (v.id === ownerId) continue;
        return { peerId: v.id, peerCap: v.caption || v.id, peerSchema: v.schema || 'Entity', role };
      }
    }
    return null;
  };
  if (relKey.startsWith('ownership')) return pick(['owner', 'asset']);
  if (relKey.startsWith('family')) return pick(['person', 'relative']);
  if (relKey.startsWith('directorship')) return pick(['director', 'organization']);
  if (relKey.startsWith('unknownLink')) return pick(['subject', 'object']);
  if (relKey === 'agencyClient' || relKey === 'agentRepresentation') return pick(['client', 'agent']);
  if (relKey.startsWith('membership')) return pick(['member', 'organization']);
  return null;
}

async function buildOsIndex(): Promise<OsIndex> {
  try {
    const old = JSON.parse(fs.readFileSync(OS_CACHE, 'utf8')) as OsIndex;
    if (old?.builtAt && Date.now() - old.builtAt < 24 * 3600_000 && old.linkCount > 100) {
      osIndex = old;
      return old;
    }
  } catch { /* none */ }

  const nodes: Record<string, OsNode> = {};
  const adj: Record<string, OsLink[]> = {};
  const addNode = (id: string, caption: string, schema: string) => {
    if (!nodes[id]) nodes[id] = { id, caption: caption || id, schema: schema || 'Entity' };
  };
  const addLink = (a: string, b: string, rel: string, role?: string) => {
    if (!a || !b || a === b) return;
    const L: OsLink = { source: a, target: b, rel, role };
    (adj[a] ??= []).push(L);
    (adj[b] ??= []).push({ source: b, target: a, rel, role });
  };

  const res = await fetch(OS_URL, {
    headers: { 'User-Agent': 'RemoteView/1.0 (+https://remoteview.online)', Accept: 'application/x-ndjson' },
    signal: AbortSignal.timeout(180_000),
  });
  if (!res.ok || !res.body) throw new Error(`OpenSanctions nested fetch HTTP ${res.status}`);

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let lines = 0;
  let links = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
      if (!line.trim()) continue;
      lines++;
      let o: any;
      try { o = JSON.parse(line); } catch { continue; }
      const id = o.id; if (!id) continue;
      const props = o.properties || {};
      let touched = false;
      for (const rk of REL_KEYS) {
        const arr = props[rk];
        if (!Array.isArray(arr)) continue;
        for (const nest of arr) {
          if (!nest || typeof nest !== 'object') continue;
          const peer = nestPeer(rk, id, nest);
          if (!peer) continue;
          if (!touched) { addNode(id, o.caption || id, o.schema || 'Entity'); touched = true; }
          addNode(peer.peerId, peer.peerCap, peer.peerSchema);
          addLink(id, peer.peerId, rk, peer.role);
          links++;
        }
      }
      // Cap memory on small Railway boxes
      if (links > 40000) { try { reader.cancel(); } catch {} break; }
    }
  }

  const idx: OsIndex = { builtAt: Date.now(), nodes, adj, linkCount: links };
  osIndex = idx;
  try {
    fs.mkdirSync(path.dirname(OS_CACHE), { recursive: true });
    fs.writeFileSync(OS_CACHE, JSON.stringify(idx));
  } catch { /* read-only */ }
  return idx;
}

function ensureOsIndex(): Promise<OsIndex> {
  if (osIndex && Date.now() - osIndex.builtAt < 24 * 3600_000) return Promise.resolve(osIndex);
  if (osBuilding) return osBuilding;
  osBuilding = buildOsIndex().finally(() => { osBuilding = null; });
  return osBuilding;
}

/** Search sanctioned entities via existing local OFAC mirror (no API key). */
async function sanctionsSearch(q: string, limit = 12) {
  const d = await selfJson(`/api/osint/sanctions?query=${encodeURIComponent(q)}&limit=${limit}`, 30000).catch(() => null);
  const results = (d?.results || d?.matches || d?.entries || []).map((r: any) => ({
    id: r.id, caption: r.name || r.caption, schema: r.schema,
    countries: r.countries || [], programs: r.programs || [],
    url: `https://www.opensanctions.org/entities/${r.id}/`,
  }));
  return { results, meta: meta('OpenSanctions us_ofac_sdn via /api/osint/sanctions (CC-BY 4.0)', { total: d?.total ?? results.length }) };
}

/** OpenSanctions ownership/family/associate graph for one entity (or search then graph). */
async function osGraph(q: Q) {
  const id = (q.get('id') || '').trim();
  const name = (q.get('q') || '').trim();
  const depth = Math.min(2, Math.max(1, Number(q.get('depth') || 1)));
  let seedId = id;
  let search: any = null;
  if (!seedId && name.length >= 2) {
    search = await sanctionsSearch(name, 8);
    seedId = search.results[0]?.id;
  }
  if (!seedId) return { nodes: [], links: [], search, meta: meta('OpenSanctions OFAC SDN nested (public bulk)', { hint: 'pass ?id= or ?q=' }) };

  let idx: OsIndex;
  try {
    idx = await ensureOsIndex();
  } catch (e) {
    // Fallback: HTML scrape of entity page for linked entities
    const html = await getText(`https://www.opensanctions.org/entities/${encodeURIComponent(seedId)}/`, 25000).catch(() => '');
    const nodes: any[] = [{ id: seedId, label: seedId, schema: 'Entity', group: 'seed' }];
    const links: any[] = [];
    const re = /href="\/entities\/([^"]+)\/"[^>]*>([^<]{2,80})<\/a>/g;
    let mm: RegExpExecArray | null;
    const seen = new Set<string>([seedId]);
    while ((mm = re.exec(html)) && nodes.length < 40) {
      const pid = mm[1]; if (seen.has(pid)) continue; seen.add(pid);
      nodes.push({ id: pid, label: mm[2].trim(), schema: 'Entity', group: 'related' });
      links.push({ source: seedId, target: pid, rel: 'related', label: 'related' });
    }
    return {
      seed: seedId, nodes, links, search,
      meta: meta('OpenSanctions entity HTML (fallback — nested index unavailable)', { error: (e as Error).message, note: 'Ownership/family roles need the nested bulk index' }),
    };
  }

  const nodes = new Map<string, any>();
  const links: any[] = [];
  const queue: { id: string; d: number }[] = [{ id: seedId, d: 0 }];
  const visited = new Set<string>();
  while (queue.length) {
    const { id: cur, d } = queue.shift()!;
    if (visited.has(cur)) continue;
    visited.add(cur);
    const n = idx.nodes[cur] || { id: cur, caption: cur, schema: 'Entity' };
    nodes.set(cur, { id: cur, label: n.caption, schema: n.schema, group: cur === seedId ? 'seed' : n.schema });
    if (d >= depth) continue;
    for (const L of idx.adj[cur] || []) {
      links.push({ source: L.source, target: L.target, rel: L.rel, label: L.role || L.rel });
      if (!visited.has(L.target)) queue.push({ id: L.target, d: d + 1 });
    }
  }
  // Ensure seed present even with no links
  if (!nodes.has(seedId)) {
    const hit = search?.results?.[0];
    nodes.set(seedId, { id: seedId, label: hit?.caption || seedId, schema: hit?.schema || 'Entity', group: 'seed' });
  }
  return {
    seed: seedId,
    nodes: [...nodes.values()],
    links,
    search,
    meta: meta('OpenSanctions us_ofac_sdn targets.nested.json (public bulk, CC-BY 4.0)', {
      indexed_links: idx.linkCount, indexed_nodes: Object.keys(idx.nodes).length, depth,
      note: 'Paid OpenSanctions API skipped (requires API key)',
    }),
  };
}

/** Gotham-style link graph from data we already have (flights, ships, sanctions, countries). */
async function entityGraph(q: Q) {
  const type = (q.get('type') || 'auto').toLowerCase();
  const id = (q.get('id') || q.get('q') || '').trim();
  if (id.length < 2) return { nodes: [], links: [], meta: meta('RemoteView entity graph', { hint: 'pass ?type=ship|jet|company|person|country&id=' }) };

  const nodes: any[] = [];
  const links: any[] = [];
  const add = (n: any) => { if (!nodes.find((x) => x.id === n.id)) nodes.push(n); };
  const link = (a: string, b: string, label: string) => links.push({ source: a, target: b, label });

  const seedId = `${type}:${id}`;
  add({ id: seedId, label: id, group: type === 'auto' ? 'entity' : type });

  // Country path
  if (type === 'country' || (type === 'auto' && /^[A-Z]{2}$/i.test(id))) {
    const cc = id.toUpperCase();
    add({ id: seedId, label: cc, group: 'country' });
    const [san, risk, flights] = await Promise.allSettled([
      selfJson('/api/rvx/sanctions-map', 20000),
      selfJson('/api/rvx/risk-score', 20000),
      selfJson('/api/flights', 20000),
    ]);
    if (san.status === 'fulfilled') {
      const f = (san.value.features || []).find((x: any) => (x.properties?.iso2 || x.properties?.code) === cc);
      if (f) {
        add({ id: `sanctions:${cc}`, label: `${f.properties?.name || cc} sanctions targets: ${f.properties?.v ?? f.properties?.count ?? '?'}`, group: 'sanctions' });
        link(seedId, `sanctions:${cc}`, 'sanctions targets');
      }
    }
    if (risk.status === 'fulfilled') {
      const f = (risk.value.features || []).find((x: any) => (x.properties?.iso2 || x.properties?.code) === cc);
      if (f) {
        add({ id: `risk:${cc}`, label: `Risk score ${f.properties?.v ?? '?'}`, group: 'risk' });
        link(seedId, `risk:${cc}`, 'risk score');
      }
    }
    if (flights.status === 'fulfilled') {
      const d: any = flights.value;
      let n = 0;
      for (const k of ['military_flights', 'private_jets', 'commercial_flights', 'private_flights']) {
        for (const f of d[k] || []) {
          if (n >= 8) break;
          // No country on flight — skip geographic filter; sample nearby from history instead
        }
      }
    }
  }

  // Person / company / sanctioned entity — via local sanctions + OS graph
  if (['person', 'company', 'sanctioned', 'auto'].includes(type)) {
    const os = await osGraph(new URLSearchParams({ q: id, depth: '1' }));
    for (const n of os.nodes || []) {
      add({ id: n.id, label: n.label, group: n.group || n.schema || 'entity' });
    }
    for (const L of os.links || []) {
      link(L.source, L.target, L.label || L.rel);
    }
    if (os.seed) {
      link(seedId, os.seed, 'OpenSanctions match');
      const seedNode = (os.nodes || []).find((n: any) => n.id === os.seed);
      if (seedNode) nodes.find((x) => x.id === seedId)!.label = seedNode.label;
    }
  }

  // Ship by MMSI
  if (type === 'ship' || (type === 'auto' && /^\d{9}$/.test(id))) {
    ensureAis();
    const ship = S.ships?.get?.(Number(id)) || S.ships?.get?.(id);
    add({ id: seedId, label: ship?.name || `MMSI ${id}`, group: 'ship' });
    if (ship) {
      if (ship.dest) { add({ id: `dest:${ship.dest}`, label: ship.dest, group: 'place' }); link(seedId, `dest:${ship.dest}`, 'destination' ); }
      if (ship.imo) { add({ id: `imo:${ship.imo}`, label: `IMO ${ship.imo}`, group: 'id' }); link(seedId, `imo:${ship.imo}`, 'IMO' ); }
      const san = await sanctionsSearch(ship.name || id, 5);
      for (const r of san.results.slice(0, 5)) {
        add({ id: r.id, label: r.caption, group: r.schema || 'sanctions' });
        link(seedId, r.id, 'sanctions hit');
      }
    } else {
      const story = await selfJson(`/api/rvx/story?mmsi=${encodeURIComponent(id)}`, 20000).catch(() => null);
      if (story?.facts) {
        const name = story.facts.ais?.name || story.facts.registry?.name;
        if (name) nodes.find((x) => x.id === seedId)!.label = name;
        for (const r of (story.facts.sanctions?.results || []).slice(0, 5)) {
          add({ id: r.id, label: r.name || r.caption, group: 'sanctions' });
          link(seedId, r.id, 'sanctions');
        }
      }
    }
  }

  // Jet / aircraft by hex
  if (type === 'jet' || type === 'aircraft' || (type === 'auto' && /^[a-f0-9]{6}$/i.test(id))) {
    const hex = id.toLowerCase();
    add({ id: seedId, label: hex, group: 'aircraft' });
    const story = await selfJson(`/api/rvx/story?hex=${encodeURIComponent(hex)}`, 25000).catch(() => null);
    const reg = story?.facts?.registry;
    if (reg) {
      if (reg.registration) { add({ id: `reg:${reg.registration}`, label: reg.registration, group: 'id' }); link(seedId, `reg:${reg.registration}`, 'registration'); }
      if (reg.manufacturericao || reg.typecode) {
        const t = reg.typecode || reg.manufacturericao;
        add({ id: `type:${t}`, label: t, group: 'aircraft-type' }); link(seedId, `type:${t}`, 'type');
      }
      if (reg.owner || reg.registeredOwners) {
        const owner = reg.owner || reg.registeredOwners;
        add({ id: `owner:${owner}`, label: owner, group: 'company' }); link(seedId, `owner:${owner}`, 'owner');
        const san = await sanctionsSearch(String(owner), 5);
        for (const r of san.results.slice(0, 5)) {
          add({ id: r.id, label: r.caption, group: 'sanctions' });
          link(`owner:${owner}`, r.id, 'sanctions');
        }
      }
    }
    // Track points from history as weak "seen at" nodes (sample)
    ensureHistory();
    let seen = 0;
    for (const s of S.history.slice(-12)) {
      const f = (s.flights || []).find((x: any) => x[0] === hex);
      if (f && seen < 4) {
        const pid = `pos:${f[1]},${f[2]}`;
        add({ id: pid, label: `${f[1]},${f[2]}`, group: 'position' });
        link(seedId, pid, 'track');
        seen++;
      }
    }
  }

  return {
    nodes, links,
    meta: meta('RemoteView entity graph (flights, AIS, OpenSanctions OFAC mirror, country risk)', {
      seed: { type, id },
      note: 'Only public/legal sources; no private-individual tracking beyond sanctioned-entity lists',
    }),
  };
}

/* ── Threat intel (keyless public feeds) ── */
async function threatIntel() {
  return cached('threat-intel', 30 * 60_000, async () => {
    const sources: any[] = [];
    const items: any[] = [];

    // 1) CIRCL MISP OSINT feed — manifest + a few recent events
    try {
      const manifest = await getJson<Record<string, any>>('https://www.circl.lu/doc/misp/feed-osint/manifest.json', { timeout: 30000 });
      const entries = Object.entries(manifest)
        .map(([uuid, v]) => ({ uuid, info: v.info || '', date: v.date || v.timestamp || '' }))
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))
        .slice(0, 8);
      sources.push({ id: 'circl-misp', label: 'CIRCL MISP OSINT feed', url: 'https://www.circl.lu/doc/misp/feed-osint/', keyless: true });
      for (const e of entries) {
        items.push({
          source: 'circl-misp', sourceLabel: 'CIRCL MISP OSINT',
          id: e.uuid, title: e.info, date: e.date,
          url: `https://www.circl.lu/doc/misp/feed-osint/${e.uuid}.json`,
          kind: 'misp-event',
        });
      }
    } catch (e) {
      sources.push({ id: 'circl-misp', label: 'CIRCL MISP OSINT feed', error: (e as Error).message, keyless: true });
    }

    if (!IS_COMMERCIAL) {
    // 2) abuse.ch Feodotracker (recommended botnet C2)
    try {
      const list = await getJson<any[]>('https://feodotracker.abuse.ch/downloads/ipblocklist.json', { timeout: 20000 });
      sources.push({ id: 'abusech-feodo', label: 'abuse.ch Feodo Tracker', url: 'https://feodotracker.abuse.ch/', keyless: true });
      const recent = (Array.isArray(list) ? list : []).filter((x) => x.status === 'online' || x.last_online).slice(0, 40);
      for (const x of recent.slice(0, 40)) {
        items.push({
          source: 'abusech-feodo', sourceLabel: 'abuse.ch Feodo Tracker',
          id: `${x.ip_address}:${x.port}`, title: `${x.malware || 'botnet'} C2 ${x.ip_address}:${x.port}`,
          date: x.last_online || x.first_seen, country: x.country, as_name: x.as_name,
          kind: 'c2', url: 'https://feodotracker.abuse.ch/',
        });
      }
      // ThreatFox / URLhaus APIs now require auth — report skip
      sources.push({ id: 'abusech-threatfox', label: 'abuse.ch ThreatFox', skipped: true, reason: 'API returns Unauthorized without a key', keyless: false });
      sources.push({ id: 'abusech-urlhaus', label: 'abuse.ch URLhaus API', skipped: true, reason: 'API returns Unauthorized without a key; FeodoTracker JSON used instead', keyless: false });
    } catch (e) {
      sources.push({ id: 'abusech-feodo', label: 'abuse.ch Feodo Tracker', error: (e as Error).message, keyless: true });
    }

    }

    // 2b) CISA Known Exploited Vulnerabilities (US govt, public domain)
    try {
      const kev = await getJson<any>('https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json', { timeout: 30000 });
      const vulns = (kev?.vulnerabilities || []).slice().sort((x: any, y: any) => String(y.dateAdded).localeCompare(String(x.dateAdded))).slice(0, 40);
      sources.push({ id: 'cisa-kev', label: 'CISA Known Exploited Vulnerabilities', url: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog', keyless: true, count: kev?.count });
      for (const v of vulns) items.push({ source: 'cisa-kev', sourceLabel: 'CISA KEV', id: v.cveID, title: `${v.cveID} ${v.vendorProject} ${v.product}: ${v.vulnerabilityName}`, date: v.dateAdded, detail: v.shortDescription, url: `https://nvd.nist.gov/vuln/detail/${v.cveID}`, kind: 'kev' });
    } catch (e) {
      sources.push({ id: 'cisa-kev', label: 'CISA KEV', error: (e as Error).message, keyless: true });
    }

    // 3) MITRE ATT&CK groups (intrusion-set JSON from mitre/cti on GitHub)
    try {
      const groups = await cached('mitre-groups', 24 * 3600_000, async () => {
        const files = await getJson<any[]>('https://api.github.com/repos/mitre/cti/contents/enterprise-attack/intrusion-set', {
          timeout: 30000, headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'RemoteView/1.0' },
        });
        // Fetch in batches of 20
        const out: any[] = [];
        for (let i = 0; i < files.length; i += 20) {
          const batch = files.slice(i, i + 20);
          const parts = await Promise.all(batch.map(async (f) => {
            try {
              const d = await getJson<any>(f.download_url, { timeout: 20000 });
              const o = d.objects?.[0] || d;
              let eid: string | undefined;
              for (const r of o.external_references || []) if (r.source_name === 'mitre-attack') eid = r.external_id;
              return {
                id: eid || o.id, name: o.name, aliases: (o.aliases || []).slice(0, 6),
                desc: String(o.description || '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').slice(0, 280),
                url: eid ? `https://attack.mitre.org/groups/${eid}/` : undefined,
              };
            } catch { return null; }
          }));
          out.push(...parts.filter(Boolean));
        }
        return out;
      });
      sources.push({ id: 'mitre-attack', label: 'MITRE ATT&CK groups', url: 'https://attack.mitre.org/groups/', keyless: true, count: groups.length });
      for (const g of groups.slice(0, 60)) {
        items.push({
          source: 'mitre-attack', sourceLabel: 'MITRE ATT&CK',
          id: g.id, title: g.name, aliases: g.aliases, detail: g.desc, url: g.url, kind: 'threat-group',
        });
      }
    } catch (e) {
      sources.push({ id: 'mitre-attack', label: 'MITRE ATT&CK groups', error: (e as Error).message, keyless: true });
    }

    // 4) AlienVault OTX — requires key
    sources.push({
      id: 'otx', label: 'AlienVault OTX', skipped: true, keyless: false,
      reason: 'OTX API returns Authentication required without a key — skipped per pack rules',
      url: 'https://otx.alienvault.com/',
    });

    return {
      items, sources,
      meta: meta('Public keyless threat intel (CIRCL MISP, abuse.ch Feodo, MITRE ATT&CK)', {
        item_count: items.length,
        skipped: sources.filter((s) => s.skipped).map((s) => s.id),
      }),
    };
  });
}

/* ── Aleph OCCRP — probe; skip if keyed ── */
async function alephSearch(q: Q) {
  const query = (q.get('q') || '').trim();
  // Probe metadata (often public) then search
  let metaInfo: any = null;
  try {
    metaInfo = await getJson('https://aleph.occrp.org/api/2/metadata', { timeout: 15000 });
  } catch { /* */ }
  if (!query) {
    return {
      results: [], skipped: true,
      meta: meta('OCCRP Aleph', {
        skipped: true,
        reason: 'Search requires authentication (HTTP 401/404 on /api/2/search without a key). Metadata endpoint may be public.',
        metadata_ok: !!metaInfo,
        hint: 'pass ?q= only after configuring an Aleph API key (not done — keyless only)',
      }),
    };
  }
  try {
    const d = await getJson(`https://aleph.occrp.org/api/2/search?q=${encodeURIComponent(query)}&limit=10`, { timeout: 20000 });
    return { results: d.results || d, skipped: false, meta: meta('OCCRP Aleph search (public)') };
  } catch (e) {
    return {
      results: [], skipped: true,
      meta: meta('OCCRP Aleph', {
        skipped: true,
        reason: `Search failed without API key: ${(e as Error).message}`,
        metadata_ok: !!metaInfo,
      }),
    };
  }
}

/* ── Case files (optional server storage + client localStorage) ── */
const CASES_FILE = path.join(process.cwd(), '.cache', 'rvx-cases.json');
type CaseFile = {
  id: string; name: string; notes: string;
  entities: { type: string; id: string; label?: string }[];
  updatedAt: number; createdAt: number;
};

function readCases(): CaseFile[] {
  try { return JSON.parse(fs.readFileSync(CASES_FILE, 'utf8')); } catch { return []; }
}
function writeCases(list: CaseFile[]) {
  try {
    fs.mkdirSync(path.dirname(CASES_FILE), { recursive: true });
    fs.writeFileSync(CASES_FILE, JSON.stringify(list.slice(0, 50)));
  } catch { /* */ }
}

async function cases(q: Q, body?: any) {
  const action = (q.get('action') || body?.action || 'list').toLowerCase();
  if (action === 'list') {
    return { cases: readCases(), meta: meta('RemoteView case files (.cache, max 50; also use localStorage in the browser)') };
  }
  if (action === 'save' && body?.case) {
    const list = readCases();
    const c: CaseFile = {
      id: String(body.case.id || `case-${Date.now()}`),
      name: String(body.case.name || 'Untitled').slice(0, 120),
      notes: String(body.case.notes || '').slice(0, 20000),
      entities: Array.isArray(body.case.entities) ? body.case.entities.slice(0, 200).map((e: any) => ({
        type: String(e.type || 'entity').slice(0, 40),
        id: String(e.id || '').slice(0, 200),
        label: e.label ? String(e.label).slice(0, 200) : undefined,
      })) : [],
      createdAt: Number(body.case.createdAt) || Date.now(),
      updatedAt: Date.now(),
    };
    const i = list.findIndex((x) => x.id === c.id);
    if (i >= 0) list[i] = c; else list.unshift(c);
    writeCases(list);
    return { ok: true, case: c, meta: meta('RemoteView case files') };
  }
  if (action === 'delete') {
    const id = body?.id || q.get('id');
    writeCases(readCases().filter((c) => c.id !== id));
    return { ok: true, meta: meta('RemoteView case files') };
  }
  if (action === 'export') {
    const id = body?.id || q.get('id');
    const c = readCases().find((x) => x.id === id);
    if (!c) return { error: 'not found', meta: meta('RemoteView case files') };
    const format = (q.get('format') || body?.format || 'json').toLowerCase();
    if (format === 'pdf') {
      // Minimal PDF (text)
      const lines = [
        `RemoteView Case File: ${c.name}`,
        `Updated: ${new Date(c.updatedAt).toISOString()}`,
        '',
        'Notes:',
        c.notes || '(none)',
        '',
        'Entities:',
        ...c.entities.map((e) => `- [${e.type}] ${e.label || e.id}`),
        '',
        'Source: RemoteView case files (user-authored). Public data only.',
      ];
      const pdf = simplePdf(lines);
      return { filename: `${c.id}.pdf`, base64: Buffer.from(pdf).toString('base64'), meta: meta('RemoteView case PDF') };
    }
    return { case: c, meta: meta('RemoteView case files') };
  }
  return { error: 'unknown action', meta: meta('RemoteView case files') };
}

/** Tiny single-page PDF writer (Helvetica, no deps). */
function simplePdf(lines: string[]): Uint8Array {
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const content: string[] = ['BT', '/F1 10 Tf', '50 780 Td', '12 TL'];
  for (const line of lines.slice(0, 60)) {
    content.push(`(${esc(line.slice(0, 100))}) Tj`, 'T*');
  }
  content.push('ET');
  const stream = content.join('\n');
  const objs: string[] = [];
  objs.push('1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n');
  objs.push('2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n');
  objs.push('3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj\n');
  objs.push(`4 0 obj<< /Length ${stream.length} >>stream\n${stream}\nendstream\nendobj\n`);
  objs.push('5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n');
  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (const o of objs) { offsets.push(Buffer.byteLength(body)); body += o; }
  const xref = body.length;
  body += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objs.length; i++) body += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  body += `trailer<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(body);
}

/* ── Analytics: lightweight flight/ship points for deck.gl client ── */
async function analytics() {
  ensureHistory();
  ensureAis();
  const last = S.history[S.history.length - 1];
  const flights = (last?.flights || []).slice(0, 1200).map((f: any) => ({
    position: [f[1], f[2]], hex: f[0], callsign: f[4], cat: f[3],
  }));
  const ships: any[] = [];
  if (S.ships?.size) {
    for (const s of S.ships.values()) {
      if (ships.length >= 800) break;
      if (typeof s.lat === 'number' && typeof s.lng === 'number') {
        ships.push({ position: [s.lng, s.lat], name: s.name, mmsi: s.mmsi, kind: s.type });
      }
    }
  }
  // Sample arcs: pair random flights that share similar longitude bands (visual only, not routes)
  const arcs: any[] = [];
  for (let i = 0; i < Math.min(80, flights.length - 1); i += 3) {
    const a = flights[i], b = flights[i + 1];
    if (a && b) arcs.push({ source: a.position, target: b.position, cat: a.cat });
  }
  return {
    flights, ships, arcs,
    snapshot_t: last?.t || null,
    meta: meta('RemoteView history + AIS snapshot for deck.gl hexbin/arcs', {
      flights: flights.length, ships: ships.length, arcs: arcs.length,
      note: 'Arcs are visual samples between concurrent positions, not filed routes',
    }),
  };
}

export const PALANTIR: Record<string, (q: Q, body?: any) => Promise<any>> = {
  'entity-graph': (q) => entityGraph(q),
  'os-graph': (q) => osGraph(q),
  'threat-intel': () => threatIntel(),
  aleph: (q) => alephSearch(q),
  cases: (q, b) => cases(q, b),
  analytics: () => analytics(),
};
