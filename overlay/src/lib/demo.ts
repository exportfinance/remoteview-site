/* Public no-signup demo (/demo, commercial edition only): free, commercially fine layers only. */
import { useEffect, useState } from 'react';

export * from './demoLists';

export const isDemoLocation = () => typeof window !== 'undefined' && window.location.pathname.replace(/\/$/, '') === '/demo';

/** Client hook: true after mount when the page is /demo (avoids hydration mismatch). */
export function useDemo(): boolean {
  const [d, setD] = useState(false);
  useEffect(() => setD(isDemoLocation()), []);
  return d;
}
