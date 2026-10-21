'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
// Loaded after hydration so the extras never delay the first map paint.
const RvExtras = dynamic(() => import('./RvExtras'), { ssr: false });
/* Only on the map itself (/ when signed in, or /demo) — never on landing, legal or credits pages. */
const MAP_PATHS = new Set(['/', '/demo']);
export default function RvExtrasLazy() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const p = window.location.pathname.replace(/\/$/, '') || '/';
    setOn(MAP_PATHS.has(p) && !document.querySelector('[data-rv-landing]'));
  }, []);
  return on ? <RvExtras /> : null;
}
