import type { Metadata } from 'next';
import LegalShell from '@/components/landing/LegalShell';
export const metadata: Metadata = { title: 'Terms of use', alternates: { canonical: '/terms' } };
export default function Terms() {
  return (
    <LegalShell title="Terms of use" updated="21 October 2026">
      <p>These terms cover this website and the RemoteView preview. Full subscription terms will be published before paid plans open.</p>
      <h2>Pre-launch</h2>
      <p>Plans and prices shown are planned and may change before launch. Nothing is for sale yet, and joining the waitlist does not create any obligation for you or for us.</p>
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
