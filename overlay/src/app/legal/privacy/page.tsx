import type { Metadata } from 'next';
import LegalShell from '@/components/landing/LegalShell';
export const metadata: Metadata = { title: 'Privacy notice', description: 'What RemoteView collects, why, where it is stored and your rights.', alternates: { canonical: '/privacy' } };
export default function Privacy() {
  return (
    <LegalShell title="Privacy notice" updated="21 October 2026">
      <p>This notice explains what RemoteView collects when you use this website and the app, and why. We collect as little as we can.</p>
      <h2>Accounts and payments</h2>
      <p>If you create an account we store your email, a salted scrypt hash of your password (never the password itself), and your plan, subscription status and renewal dates. Payments are processed by Stripe, Inc., which receives your card and billing details directly; we never see or store your full card number. We keep your Stripe customer and subscription IDs to link your account. Stripe&apos;s own privacy policy covers what it holds.</p>
      <h2>Early-access list</h2>
      <p>If you joined our early-access list before launch, we hold your email (and name if you gave it), the plan and use case you picked, your consent record, a referral code, and a one-way hash of your IP address and browser user-agent used only to stop spam. We use it only to tell you about RemoteView, based on your consent, which you can withdraw at any time.</p>
      <h2>Shared snapshots</h2>
      <p>If you press Share in the app, we store the map view (position, zoom, layer names) and a screenshot of the map so anyone with the link can see it. We store no account or personal details with it, apart from a one-way hash of your IP address for abuse limits.</p>
      <h2>Why, and our legal basis</h2>
      <p>We use account and payment data to provide the service you signed up for (performance of a contract), and to meet tax and accounting duties (legal obligation). We use abuse-prevention data on the basis of our legitimate interest in keeping the service secure.</p>
      <h2>Where it is stored and for how long</h2>
      <p>Our database runs on servers operated by Hetzner Online GmbH in Germany. We keep account data while your account is open and for up to 12 months after it closes, and payment records for as long as tax law requires. We do not sell or share your details, and we use no advertising or tracking cookies.</p>
      <h2>Cookies and the app</h2>
      <p>Signing in sets a single strictly necessary session cookie. Map layers are fetched from the public data sources listed on the <a href="/credits">data credits</a> page; AI features send your question to our AI provider to generate an answer.</p>
      <h2>Your rights</h2>
      <p>You can ask to see, correct, export or delete your data, or withdraw consent, at any time by emailing <a href="mailto:remoteview@mail.grokbot.com">remoteview@mail.grokbot.com</a>. If you are in the UK you can also complain to the Information Commissioner&apos;s Office (ico.org.uk); in the EU, to your local data protection authority.</p>
      <h2>Changes</h2>
      <p>If we change this notice we will update the date above, and tell account holders by email about any significant change.</p>
    </LegalShell>
  );
}
