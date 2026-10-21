import type { Metadata } from 'next';
import LegalShell from '@/components/landing/LegalShell';
export const metadata: Metadata = { title: 'Terms of use', alternates: { canonical: '/terms' } };
export default function Terms() {
  return (
    <LegalShell title="Terms of use" updated="21 October 2026">
      <p>These terms cover this website, RemoteView accounts and paid subscriptions.</p>
      <h2>Waitlist</h2>
      <p>Joining the waitlist does not create any obligation for you or for us.</p>
      <h2 id="subscriptions">Subscriptions, cancellation and refunds <span style={{ color: '#fbbf24', fontSize: 13 }}>(DRAFT, not yet reviewed by a lawyer)</span></h2>
      <ul>
        <li><b>Plans and prices.</b> Personal is $34.99 a month or $349 a year; Pro is $99 a month or $990 a year, in US dollars. Taxes are added where the law requires. Teams is quoted separately.</li>
        <li><b>Free trial.</b> Each plan starts with a 7-day free trial. We take your card at sign-up through Stripe, but charge nothing during the trial. If you do not cancel before the trial ends, your subscription starts and the first payment is taken automatically. One trial per person.</li>
        <li><b>Founder pricing.</b> The first 500 subscribers get 50% off for as long as that subscription stays active. If you cancel and later resubscribe, the founder discount may not be available.</li>
        <li><b>Renewal.</b> Subscriptions renew automatically each month or year at the then-current price for your plan, until cancelled. We will tell you before any price change takes effect.</li>
        <li><b>Cancelling.</b> Cancel any time from Account → Manage billing. Cancelling stops future renewals; you keep access until the end of the period you have paid for (or until the trial ends).</li>
        <li><b>Refunds.</b> If you are a consumer in the UK or EU, you have 14 days from your first payment to cancel and get a full refund, unless you asked us to start the service immediately and used it, in which case we may deduct a proportionate amount for the time used. After that, payments are non-refundable except where the law requires or the service was materially unavailable. To ask for a refund, email remoteview@mail.grokbot.com.</li>
        <li><b>Failed payments.</b> If a payment fails, Stripe will retry. Access to the full app pauses while a payment is overdue and returns once it succeeds.</li>
        <li><b>Accounts.</b> Keep your password safe; you are responsible for activity on your account. Accounts are for one person unless you are on Teams.</li>
        <li><b>Changes and ending.</b> We may change or withdraw features with reasonable notice. If we stop the service, we will refund the unused part of any prepaid period.</li>
      </ul>
      <h2>Information, not advice</h2>
      <p>RemoteView combines third-party open and public-sector data that can be delayed, incomplete or wrong. Estimates and simulations are labelled as such. Do not rely on RemoteView for navigation, safety-critical, legal, financial or compliance decisions; for sanctions screening, always check the official lists directly.</p>
      <h2>Acceptable use</h2>
      <ul>
        <li>Use RemoteView lawfully, and only for legitimate research, journalism, education, security or risk purposes.</li>
        <li>Do not use it to track, stalk, harass or target private individuals.</li>
        <li>Do not scrape, resell or redistribute the data feeds, or try to get around access controls or rate limits.</li>
        <li>Respect each data source&apos;s licence and attribution, listed on the <a href="/credits">data credits</a> page.</li>
      </ul>
      <h2>Availability and liability</h2>
      <p>The preview is provided as is, without warranties, and may change or stop at any time. To the extent the law allows, we are not liable for losses arising from its use. Nothing in these terms limits liability that cannot be limited by law.</p>
      <h2>Software</h2>
      <p>RemoteView is built on MIT-licensed source code; the licence notice ships with the code.</p>
    </LegalShell>
  );
}
