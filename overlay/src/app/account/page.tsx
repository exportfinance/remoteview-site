import type { Metadata } from 'next';
import SeoShell from '@/components/seo/Shell';
import AccountPanel from '@/components/billing/AccountPanel';
import { billingEnabled } from '@/lib/billing/config';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Your account', robots: { index: false, follow: false } };
export default function Account() {
  return (
    <SeoShell>
      <style>{'.hud-in{display:block;width:100%;box-sizing:border-box;margin-top:6px;background:#030912;color:#e6f1ff;border:1px solid #1e3a5f;border-radius:8px;padding:11px 12px;font:15px inherit;transition:border-color .3s}.hud-in:focus{outline:none;border-color:#2DD4BF}'}</style>
      <div className="hud-kick">// ACCOUNT</div>
      <h1>Your account</h1>
      <p className="hud-sub">Sign in to manage your plan, invoices and card. Billing is handled securely by Stripe.</p>
      <AccountPanel billing={billingEnabled()} />
    </SeoShell>
  );
}
