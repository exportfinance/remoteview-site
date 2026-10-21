'use client';
import dynamic from 'next/dynamic';
// Loaded after hydration so the extras never delay the first map paint.
const RvExtras = dynamic(() => import('./RvExtras'), { ssr: false });
export default function RvExtrasLazy() { return <RvExtras />; }
