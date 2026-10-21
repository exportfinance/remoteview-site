import http from 'node:http';
import https from 'node:https';
import { isBlockedUrl } from './edition';

const g = globalThis as any;

function urlOf(a: any, b?: any): string {
  if (typeof a === 'string') return a;
  if (a instanceof URL) return a.href;
  if (a && typeof a === 'object' && 'url' in a && typeof a.url === 'string') return a.url;
  const o = (a && typeof a === 'object' ? a : b) || {};
  const host = o.hostname || o.host || '';
  return host ? `${o.protocol || 'https:'}//${host}${o.path || '/'}` : '';
}

export function installEgressGuard() {
  if (g.__rvEgressGuard) return;
  g.__rvEgressGuard = true;
  const blockedErr = (u: string) => new Error(`Blocked in commercial edition: ${new URL(u).hostname}`);

  const of = g.fetch;
  g.fetch = (input: any, init?: any) => {
    const u = urlOf(input);
    if (u && isBlockedUrl(u)) { console.warn('[egress-guard] blocked fetch', new URL(u).hostname); return Promise.reject(blockedErr(u)); }
    return of(input, init);
  };
  for (const mod of [http, https] as any[]) {
    for (const fn of ['request', 'get']) {
      const orig = mod[fn];
      mod[fn] = function (this: any, ...args: any[]) {
        const u = urlOf(args[0], args[1]);
        if (u && isBlockedUrl(u)) { console.warn('[egress-guard] blocked', fn, new URL(u).hostname); throw blockedErr(u); }
        return orig.apply(this, args);
      };
    }
  }
  console.log('[egress-guard] commercial edition: excluded sources blocked');
}
