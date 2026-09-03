import { useEffect, useState } from 'react';
import { fetchAlerts } from '../../journey-planner/api/alerts';
import type { ServiceAlert } from '../../journey-planner/types';

// The backend re-reads TaM every 5 minutes; this polls at the same cadence so
// a page left open eventually agrees with it. Without this the list froze at
// whatever it read on mount — a disruption published afterwards never showed,
// and one that ended stayed on screen until a manual reload.
const POLL_INTERVAL_MS = 5 * 60_000;

export function useAlerts() {
  const [alerts, setAlerts] = useState<ServiceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // `initial` separates the first read from the refreshes: a refresh must
    // not drop the list back into its loading state, and a failed refresh must
    // keep showing the alerts it already has rather than blanking them — an
    // empty disruption list is a claim, not an absence of one.
    function load(initial: boolean) {
      fetchAlerts()
        .then((result) => {
          if (cancelled) return;
          setAlerts(result);
          setError(false);
        })
        .catch(() => {
          if (!cancelled && initial) setError(true);
        })
        .finally(() => {
          if (!cancelled && initial) setLoading(false);
        });
    }

    load(true);
    const interval = setInterval(() => load(false), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { alerts, loading, error };
}
