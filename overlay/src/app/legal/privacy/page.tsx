import type { Metadata } from 'next';
import LegalShell from '@/components/landing/LegalShell';
export const metadata: Metadata = { title: 'Privacy notice', alternates: { canonical: '/privacy' } };
export default function Privacy() {
  return (
    <LegalShell title="Privacy notice" updated="21 October 2026">
      <p>This notice explains what RemoteView collects through this website before launch, and why. RemoteView is not yet on sale; the only personal data we collect publicly is the waitlist form.</p>
      <h2>What we collect</h2>
      <ul>
        <li>Your email address, and your name if you choose to give it.</li>
        <li>The use case and plan you pick on the form.</li>
        <li>That you ticked the consent box, the exact consent wording, and the time you signed up.</li>
        <li>A one-way hash of your IP address and your browser&apos;s user-agent string, used only to stop spam and abuse.</li>
        <li>A random referral code for you, which friend (by code) referred you, and how many people joined with your link. These set your queue position.</li>
      </ul>
      <h2>Shared snapshots</h2>
      <p>If you press Share in the app, we store the map view (position, zoom, layer names) and a screenshot of the map so anyone with the link can see it. We store no account or personal details with it, apart from a one-way hash of your IP address for abuse limits. Anyone with the link can view a snapshot.</p>
      <h2>Why, and our legal basis</h2>
      <p>We use these details only to contact you about early access and the launch of RemoteView, and to understand demand by use case. Our legal basis is your consent, which you can withdraw at any time.</p>
      <h2>Where it is stored and for how long</h2>
      <p>Sign-ups are stored in a database hosted by Railway (Railway Corporation), whose servers may be outside the UK and EEA. We keep waitlist entries until launch plus 12 months, or until you ask us to delete them, whichever is sooner. We do not sell or share your details, and we do not use advertising or tracking cookies on this page.</p>
      <h2>The app itself</h2>
      <p>The RemoteView app is behind a sign-in. Signing in sets a single strictly necessary session cookie. Map layers are fetched from the public data sources listed on the <a href="/credits">data credits</a> page; AI features send your question to our AI provider to generate an answer.</p>
      <h2>Your rights</h2>
      <p>You can ask to see, correct or delete your data, or withdraw consent, at any time. Before launch, reply to any email you receive from us to make a request. If you are in the UK you can also complain to the Information Commissioner&apos;s Office (ico.org.uk).</p>
      <h2>Changes</h2>
      <p>We will update this page before paid plans open, and the date above will change.</p>
    </LegalShell>
  );
}
