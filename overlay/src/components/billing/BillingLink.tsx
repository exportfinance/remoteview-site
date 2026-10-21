'use client';
import { useEffect, useState } from 'react';
/* In-app "Billing" link for signed-in customers (keeps their access check fresh while the app is open). */
export default function BillingLink() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!document.cookie.split('; ').some((c) => c === 'rv_acct=1')) return;
    if (document.querySelector('[data-rv-landing]')) return;
    setOn(true);
    const ping = () => fetch('/api/account/me', { cache: 'no-store' }).then((r) => r.json()).then((j) => { if (j.user && !j.user.entitled) location.href = '/pricing?need=plan'; }).catch(() => {});
    const t = setInterval(ping, 20 * 60_000); return () => clearInterval(t);
  }, []);
  if (!on) return null;
  return <a href="/account" style={{ position: 'fixed', top: 10, right: 12, zIndex: 2147482000, background: 'rgba(3,9,18,.88)', color: '#e6f1ff', border: '1px solid rgba(45,212,191,.5)', borderRadius: 999, padding: '6px 12px', font: '600 12px ui-sans-serif,system-ui,sans-serif', textDecoration: 'none', letterSpacing: '.04em' }}>Billing</a>;
}
