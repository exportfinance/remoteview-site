'use client';
import dynamic from 'next/dynamic';
import { useEffect } from 'react';

// Loaded after hydration so the extras never delay the first map paint.
const RvExtras = dynamic(() => import('./RvExtras'), { ssr: false });

function usePolishCss() {
  useEffect(() => {
    if (document.getElementById('rvx-polish')) return;
    const l = document.createElement('link');
    l.id = 'rvx-polish';
    l.rel = 'stylesheet';
    l.href = '/rvx-polish.css';
    document.head.appendChild(l);
  }, []);
}

export default function RvExtrasLazy() {
  usePolishCss();
  return <RvExtras />;
}
