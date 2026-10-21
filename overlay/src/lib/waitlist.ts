/* Waitlist storage (commercial edition). Postgres via DATABASE_URL (Railway reference variable). */
import { Pool } from 'pg';
import { randomBytes } from 'node:crypto';

const g = globalThis as any;
export function pool(): Pool {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not configured');
  if (!g.__rvWaitlistPool) {
    const internal = /\.railway\.internal|@localhost[:/]|@127\.0\.0\.1[:/]/.test(process.env.DATABASE_URL);
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
  await pool().query(`ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS ref_code TEXT UNIQUE, ADD COLUMN IF NOT EXISTS referred_by TEXT, ADD COLUMN IF NOT EXISTS referrals INT NOT NULL DEFAULT 0`);
  g.__rvWaitlistReady = true;
}
export const USE_CASES = ['osint-research', 'journalism', 'security-risk', 'aviation-ship-spotting', 'other'] as const;
export const PLANS = ['personal', 'pro', 'teams', 'undecided'] as const;

/** Each confirmed referral moves you this many places up the queue. */
export const JUMP_PER_REFERRAL = 5;
const ALPH = 'abcdefghjkmnpqrstuvwxyz23456789';
function newCode() { const b = randomBytes(8); let o = ''; for (const x of b) o += ALPH[x % ALPH.length]; return o; }
export const REF_RE = /^[a-z0-9]{6,12}$/;

export async function addSignup(s: { email: string; name?: string; useCase: string; plan?: string; consentText: string; ipHash: string; ua: string; ref?: string }) {
  await ensure();
  const ref = s.ref && REF_RE.test(s.ref) ? s.ref : null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = newCode();
    try {
      const r = await pool().query(
        `INSERT INTO waitlist (email, name, use_case, plan, consent, consent_text, ip_hash, user_agent, ref_code, referred_by)
         VALUES ($1,$2,$3,$4,true,$5,$6,$7,$8,$9) ON CONFLICT (email) DO NOTHING RETURNING id`,
        [s.email, s.name || null, s.useCase, s.plan || null, s.consentText, s.ipHash, s.ua.slice(0, 300), code, ref],
      );
      if (!r.rowCount) return { created: false as const };
      // Credit the referrer, but not self-referrals from the same network.
      if (ref) await pool().query(`UPDATE waitlist SET referrals = referrals + 1 WHERE ref_code = $1 AND (ip_hash IS DISTINCT FROM $2)`, [ref, s.ipHash]);
      return { created: true as const, code, position: await positionOf(code) };
    } catch (e: any) { if (e?.code === '23505' && /ref_code/.test(e?.constraint || e?.detail || '')) continue; throw e; }
  }
  throw new Error('could not allocate referral code');
}
/** Queue position: signup order, minus JUMP_PER_REFERRAL places per referral (ties by signup time). */
export async function positionOf(code: string): Promise<{ position: number; referrals: number; total: number } | null> {
  await ensure();
  const r = await pool().query(
    `WITH q AS (SELECT ref_code, referrals, row_number() OVER (ORDER BY id) - referrals * $2 AS score, id FROM waitlist),
          me AS (SELECT * FROM q WHERE ref_code = $1)
     SELECT (SELECT count(*) FROM q, me WHERE q.score < me.score OR (q.score = me.score AND q.id < me.id))::int + 1 AS position,
            me.referrals, (SELECT count(*) FROM waitlist)::int AS total FROM me`, [code, JUMP_PER_REFERRAL]);
  return r.rows[0] ? { position: r.rows[0].position, referrals: r.rows[0].referrals, total: r.rows[0].total } : null;
}
export async function signupStats() {
  await ensure();
  const r = await pool().query(`SELECT count(*)::int AS total, max(created_at) AS latest FROM waitlist`);
  const by = await pool().query(`SELECT use_case, count(*)::int AS n FROM waitlist GROUP BY use_case ORDER BY n DESC`);
  return { total: r.rows[0].total, latest: r.rows[0].latest, byUseCase: by.rows };
}
export const CONSENT_TEXT = 'I agree to RemoteView storing my email and the details above to contact me about early access and launch. I can ask to be removed at any time.';
