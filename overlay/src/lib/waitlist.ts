/* Waitlist storage (commercial edition). Postgres via DATABASE_URL (Railway reference variable). */
import { Pool } from 'pg';

const g = globalThis as any;
function pool(): Pool {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not configured');
  if (!g.__rvWaitlistPool) {
    const internal = /\.railway\.internal/.test(process.env.DATABASE_URL);
    g.__rvWaitlistPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3, ssl: internal ? false : { rejectUnauthorized: false } });
  }
  return g.__rvWaitlistPool;
}
async function ensure() {
  if (g.__rvWaitlistReady) return;
  await pool().query(`CREATE TABLE IF NOT EXISTS waitlist (
    id BIGSERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    use_case TEXT NOT NULL,
    plan TEXT,
    consent BOOLEAN NOT NULL,
    consent_text TEXT NOT NULL,
    ip_hash TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  g.__rvWaitlistReady = true;
}
export const USE_CASES = ['osint-research', 'journalism', 'security-risk', 'aviation-ship-spotting', 'other'] as const;
export const PLANS = ['personal', 'pro', 'teams', 'undecided'] as const;

export async function addSignup(s: { email: string; name?: string; useCase: string; plan?: string; consentText: string; ipHash: string; ua: string }) {
  await ensure();
  const r = await pool().query(
    `INSERT INTO waitlist (email, name, use_case, plan, consent, consent_text, ip_hash, user_agent)
     VALUES ($1,$2,$3,$4,true,$5,$6,$7) ON CONFLICT (email) DO NOTHING RETURNING id`,
    [s.email, s.name || null, s.useCase, s.plan || null, s.consentText, s.ipHash, s.ua.slice(0, 300)],
  );
  return { created: (r.rowCount || 0) > 0 };
}
export async function signupStats() {
  await ensure();
  const r = await pool().query(`SELECT count(*)::int AS total, max(created_at) AS latest FROM waitlist`);
  const by = await pool().query(`SELECT use_case, count(*)::int AS n FROM waitlist GROUP BY use_case ORDER BY n DESC`);
  return { total: r.rows[0].total, latest: r.rows[0].latest, byUseCase: by.rows };
}
export const CONSENT_TEXT = 'I agree to RemoteView storing my email and the details above to contact me about early access and launch. I can ask to be removed at any time.';
