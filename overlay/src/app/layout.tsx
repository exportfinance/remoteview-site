import type { Metadata, Viewport } from "next";
import ErrorBoundary from '@/components/ErrorBoundary';
import RvExtras from '@/components/rvx/RvExtrasLazy';
import "./globals.css";
import { IS_COMMERCIAL, browserGuardScript } from '@/lib/edition';
import DemoChrome from '@/components/landing/DemoChrome';
import ShareButton from '@/components/share/ShareButton';
import BillingLink from '@/components/billing/BillingLink';

const SITE_URL = "https://remoteview.online";
const SITE_NAME = "REMOTEVIEW";
const SITE_TITLE = "RemoteView";
const SITE_DESCRIPTION = "Live global intelligence. Track live aircraft, satellites, and worldwide CCTV cameras on a 3D globe. Run Nmap scans, DNS lookups, WHOIS queries, SSL cert analysis & threat intelligence — all from your browser. 20+ data sources including live earthquake, wildfire, cyber threat and conflict feeds, plus mapped reference data such as nuclear facilities. Free & open source.";

export const viewport: Viewport = {
  themeColor: "#2DD4BF",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  colorScheme: "dark",
};

const privateMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s | RemoteView",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    // OSINT Tools - Primary focus
    "OSINT tools", "free OSINT tools", "online OSINT toolkit", "OSINT framework",
    "nmap online", "nmap scanner online", "free nmap scan", "port scanner online",
    "DNS lookup tool", "WHOIS lookup", "reverse DNS", "DNS records",
    "SSL certificate checker", "certificate transparency", "cert lookup",
    "BGP routing lookup", "ASN lookup", "IP geolocation",
    "threat intelligence", "threat intel lookup", "IP reputation check",
    "network reconnaissance", "recon tools", "penetration testing tools",
    "cybersecurity tools", "infosec tools", "security scanner",
    "linux OSINT tools", "kali linux tools online", "OSINT browser tools",
    
    // Intelligence Platform
    "OSINT", "open source intelligence", "intelligence platform", "global intelligence",
    "geospatial intelligence", "GEOINT", "SIGINT", "real-time tracking",
    "intelligence dashboard",
    
    // Tracking & Data
    "flight tracker", "aircraft tracking", "ADS-B tracker", "live flight radar",
    "satellite tracking", "ISS tracker", "space station tracker",
    "CCTV cameras live", "security cameras worldwide", "live cameras",
    "earthquake monitor", "seismic activity", "USGS earthquake",
    "wildfire tracker", "NASA FIRMS", "active fires",
    "nuclear facilities map", "nuclear power plants",
    "severe weather alerts", "weather radar",
    "cyber threats dashboard", "CVE tracker",
    "space weather", "solar storm", "GPS jamming",
    "defense stocks", "commodities tracker",
    
    // Brand
    "remoteview", "remoteview", "remoteview.live",
  ],
  authors: [{ name: "RemoteView Project", url: SITE_URL }],
  creator: "RemoteView Project",
  publisher: "RemoteView Project",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  icons: {
    icon: [
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { url: "/android-chrome-192x192.png", type: "image/png", sizes: "192x192" },
      { url: "/android-chrome-512x512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180" },
    ],
    shortcut: "/favicon.ico",
    other: [
      {
        rel: "apple-touch-icon-precomposed",
        url: "/apple-touch-icon.png",
      },
    ],
  },
  manifest: "/manifest.json",
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: "RemoteView",
    description: "Track 10K+ aircraft, 2K satellites & worldwide CCTV on a 3D globe. Run Nmap, DNS, WHOIS & threat intel scans from your browser. 20+ live intelligence feeds. Free. Open source.",
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    url: SITE_URL,
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "REMOTEVIEW — Open Source Intelligence Platform with Live Tracking & OSINT Tools",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "RemoteView",
    description: "Track 10K+ flights, satellites & CCTV worldwide. Run Nmap, DNS, WHOIS scans from your browser. 20+ live intel feeds. Free & open source.",
    images: [`${SITE_URL}/og-image.png`],
  },
  category: "technology",
  classification: "Intelligence & Security",
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "apple-mobile-web-app-title": "REMOTEVIEW",
    "mobile-web-app-capable": "yes",
    "msapplication-TileColor": "#06101E",
    "msapplication-config": "none",
  },
};

const C_DESC = 'Real-time global intelligence on one live map: conflict signals and situation rooms, internet outages and infrastructure, shipping chokepoints, country risk and breaking disasters, with AI briefings that cite their sources.';
const C_URL = 'https://www.remoteview.online';
const commercialMetadata: Metadata = {
  metadataBase: new URL(C_URL),
  title: { default: 'RemoteView: real-time global intelligence', template: '%s · RemoteView' },
  description: C_DESC,
  applicationName: 'RemoteView',
  icons: privateMetadata.icons,
  manifest: '/manifest.json',
  openGraph: { title: 'RemoteView: real-time global intelligence', description: C_DESC, type: 'website', siteName: 'RemoteView', locale: 'en_US', url: C_URL, images: [{ url: C_URL + '/landing/og.jpg', width: 1200, height: 630, alt: 'RemoteView live intelligence map' }] },
  twitter: { card: 'summary_large_image', title: 'RemoteView: real-time global intelligence', description: C_DESC, images: [C_URL + '/landing/og.jpg'] },
};
export const metadata: Metadata = IS_COMMERCIAL ? commercialMetadata : privateMetadata;

// JSON-LD Structured Data
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "REMOTEVIEW — OSINT Toolkit & Intelligence Platform",
  alternateName: ["REMOTEVIEW", "RemoteViewAI", "RemoteView OSINT"],
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  applicationCategory: "SecurityApplication",
  operatingSystem: "Web",
  browserRequirements: "Requires a modern web browser",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
  },
  featureList: [
    "Nmap port scanning from the browser — no install required",
    "DNS record lookup (A, AAAA, MX, NS, TXT, CNAME)",
    "WHOIS domain registration lookup",
    "SSL/TLS certificate transparency search",
    "BGP routing & ASN lookup",
    "IP geolocation & threat intelligence",
    "Real-time flight tracking via ADS-B",
    "Satellite tracking (including ISS)",
    "Worldwide CCTV camera monitoring",
    "Earthquake monitoring (USGS live feed)",
    "Wildfire detection (NASA FIRMS satellite data)",
    "Nuclear facility mapping (curated reference list, not a live feed)",
    "Severe weather alerts & tracking",
    "Cyber threat & CVE intelligence",
    "Space weather & solar storm monitoring",
    "GPS jamming detection",
    "Defense & commodity market tracking",
    "SIGINT news aggregation feed",
    "Interactive 3D globe with day/night cycle",
    "Region intelligence dossier reports",
  ],
  screenshot: `${SITE_URL}/og-image.png`,
  author: {
    "@type": "Organization",
    name: "RemoteView Project",
    url: SITE_URL,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" dir="ltr">
      <head>
        {IS_COMMERCIAL && <script dangerouslySetInnerHTML={{ __html: browserGuardScript() }} />}
        {/* Self-hosted variable fonts (latin subset): no third-party stylesheet on the critical path. */}
        <link rel="preload" href="/landing/inter-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <style dangerouslySetInnerHTML={{ __html: "@font-face{font-family:'Inter';font-style:normal;font-weight:300 700;font-display:swap;src:url(/landing/inter-latin.woff2) format('woff2');unicode-range:U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD}@font-face{font-family:'JetBrains Mono';font-style:normal;font-weight:300 700;font-display:swap;src:url(/landing/jbmono-latin.woff2) format('woff2');unicode-range:U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD}" }} />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        {!IS_COMMERCIAL && <link rel="canonical" href={SITE_URL} />}
        
        {/* JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: IS_COMMERCIAL ? '{}' : JSON.stringify(jsonLd) }}
        />

      </head>
      <body className="antialiased">
        <ErrorBoundary name="REMOTEVIEW Core">
          {children}
        </ErrorBoundary>
        <RvExtras />
        {IS_COMMERCIAL && <DemoChrome />}
        {IS_COMMERCIAL && <script dangerouslySetInnerHTML={{ __html: "addEventListener('load',function(){setTimeout(function(){var s=document.createElement('script');s.async=true;s.src='/gc/count.js';s.setAttribute('data-goatcounter','/gc/count');document.body.appendChild(s)},1500)})" }} />}
        {IS_COMMERCIAL && <ShareButton />}
        {IS_COMMERCIAL && <BillingLink />}
        {IS_COMMERCIAL && (
          <a href="/credits" style={{ position: 'fixed', left: 8, bottom: 44, zIndex: 40, fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,.55)', background: 'rgba(0,0,0,.45)', padding: '2px 6px', borderRadius: 4, textDecoration: 'none' }}>Data credits</a>
        )}
      </body>
    </html>
  );
}
