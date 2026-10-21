/* Commercial edition: install a process-wide egress guard so no excluded data
   source can be contacted, whichever code path tries (fetch, http, https). */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.RV_EDITION !== 'commercial' && process.env.NEXT_PUBLIC_RV_EDITION !== 'commercial') return;
  const { installEgressGuard } = await import('./lib/egressGuard');
  installEgressGuard();
}
