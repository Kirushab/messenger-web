import { useEffect, useState } from 'react';

const QUERY = '(min-width: 1024px)';

/** true на широких экранах (ПК/планшет-ландшафт) — реактивно на resize. */
export function useIsDesktop(): boolean {
  const [is, setIs] = useState<boolean>(() =>
    typeof window !== 'undefined' && 'matchMedia' in window
      ? window.matchMedia(QUERY).matches
      : false
  );
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const on = () => setIs(mq.matches);
    if (mq.addEventListener) mq.addEventListener('change', on);
    else (mq as any).addListener(on);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', on);
      else (mq as any).removeListener(on);
    };
  }, []);
  return is;
}
