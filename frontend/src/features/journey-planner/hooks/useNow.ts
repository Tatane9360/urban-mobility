import { useEffect, useState } from 'react';

// Ticks once a minute so a component showing "il y a X min" re-renders even
// when no new data has arrived — otherwise the text freezes at whatever it
// read on the last fetch.
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs]);

  return now;
}
