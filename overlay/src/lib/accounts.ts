/* Email + password accounts and subscription state (commercial edition). Same Postgres as the waitlist.
   Passwords: scrypt (N=16384, r=8, p=1), per-user salt. No email is ever sent from here. */
import { randomBytes, scrypt as _scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { pool } from '@/lib/waitlist';
import { ENTITLED } from '@/lib/billing/config';
const scrypt = promisify(_scrypt) as (pw: string, salt: Buffer, len: number, o: any) => Promise<Buffer>;
const g = globalThis as any;
async function ensure() {
  if (g.__rvAcctReady) return;
  await pool().query(`CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY, email TEXT NOT NULL UNIQUE, pw_hash TEXT NOT NULL,
    stripe_customer_id TEXT UNIQUE, subscription_id TEXT UNIQUE, sub_status TEXT, plan TEXT, billing_interval TEXT,
    current_period_end TIMESTAMPTZ, trial_end TIMESTAMPTZ, cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
    founder BOOLEAN NOT NULL DEFAULT false, founder_granted_at TIMESTAMPTZ, last_payment_failed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  await pool().query(`CREATE TABLE IF NOT EXISTS stripe_events (id TEXT PRIMARY KEY, type TEXT NOT NULL, received_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  g.__rvAcctReady = true;
}
export type User = { id: string; email: string; stripe_customer_id: string | null; subscription_id: string | null; sub_status: string | null; plan: string | null; billing_interval: string | null; current_period_end: Date | null; trial_end: Date | null; cancel_at_period_end: boolean; founder: boolean; last_payment_failed_at: Date | null };
const COLS = `id::text, email, stripe_customer_id, subscription_id, sub_status, plan, billing_interval, current_period_end, trial_end, cancel_at_period_end, founder, last_payment_failed_at`;
export const entitled = (u: Pick<User, 'sub_status'> | null) => !!u && !!u.sub_status && ENTITLED.has(u.sub_status);

async function hashPw(pw: string) { const salt = randomBytes(16); const h = await scrypt(pw, salt, 32, { N: 16384, r: 8, p: 1 }); return `s1$${salt.toString('base64')}$${h.toString('base64')}`; }
async function checkPw(pw: string, stored: string) {
  const [v, s, h] = stored.split('$'); if (v !== 's1' || !s || !h) return false;
  const want = Buffer.from(h, 'base64'); const got = await scrypt(pw, Buffer.from(s, 'base64'), want.length, { N: 16384, r: 8, p: 1 });
  return got.length === want.length && timingSafeEqual(got, want);
}
const DUMMY = 's1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

export async function createUser(email: string, pw: string): Promise<User | null> {
  await ensure();
  const r = await pool().query(`INSERT INTO users (email, pw_hash) VALUES ($1,$2) ON CONFLICT (email) DO NOTHING RETURNING ${COLS}`, [email, await hashPw(pw)]);
  return r.rows[0] || null;
}
export async function login(email: string, pw: string): Promise<User | null> {
  await ensure();
  const r = await pool().query(`SELECT ${COLS}, pw_hash FROM users WHERE email = $1`, [email]);
  const row = r.rows[0];
  const ok = await checkPw(pw, row?.pw_hash || DUMMY); // same work whether or not the email exists
  if (!row || !ok) return null;
  delete row.pw_hash; return row;
}
export async function userById(id: string): Promise<User | null> {
  if (!/^\d+$/.test(id)) return null; await ensure();
  return (await pool().query(`SELECT ${COLS} FROM users WHERE id = $1`, [id])).rows[0] || null;
}
export async function userByCustomer(cus: string): Promise<User | null> {
  await ensure(); return (await pool().query(`SELECT ${COLS} FROM users WHERE stripe_customer_id = $1`, [cus])).rows[0] || null;
}
export async function setCustomer(id: string, cus: string) { await ensure(); await pool().query(`UPDATE users SET stripe_customer_id = $2, updated_at = now() WHERE id = $1 AND stripe_customer_id IS NULL`, [id, cus]); }

export async function applySubscription(userId: string, s: { id: string; status: string; plan: string | null; interval: string | null; periodEnd: number | null; trialEnd: number | null; cancelAtPeriodEnd: boolean; customer: string; founder: boolean }) {
  await ensure();
  await pool().query(
    `UPDATE users SET subscription_id = $2, sub_status = $3, plan = COALESCE($4, plan), billing_interval = COALESCE($5, billing_interval),
       current_period_end = to_timestamp($6), trial_end = to_timestamp($7), cancel_at_period_end = $8,
       stripe_customer_id = COALESCE(stripe_customer_id, $9),
       founder = founder OR $10, founder_granted_at = CASE WHEN $10 AND NOT founder THEN now() ELSE founder_granted_at END, updated_at = now()
     WHERE id = $1`,
    [userId, s.id, s.status, s.plan, s.interval, s.periodEnd, s.trialEnd, s.cancelAtPeriodEnd, s.customer, s.founder]);
}
export async function markPaymentFailed(cus: string) { await ensure(); await pool().query(`UPDATE users SET last_payment_failed_at = now(), updated_at = now() WHERE stripe_customer_id = $1`, [cus]); }
/** Founder places used so far (ever granted; cancelling does not free a place). */
export async function founderUsed(): Promise<number> {
  await ensure(); return (await pool().query(`SELECT count(*)::int AS n FROM users WHERE founder`)).rows[0].n;
}
/** Webhook idempotency: true the first time an event id is seen. */
export async function claimEvent(id: string, type: string) {
  await ensure(); return ((await pool().query(`INSERT INTO stripe_events (id, type) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [id, type])).rowCount || 0) > 0;
}
export async function releaseEvent(id: string) { await ensure(); await pool().query(`DELETE FROM stripe_events WHERE id = $1`, [id]); }
