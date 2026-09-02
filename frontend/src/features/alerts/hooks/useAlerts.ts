import { useEffect, useState } from 'react';
import { fetchAlerts } from '../../journey-planner/api/alerts';
import type { ServiceAlert } from '../../journey-planner/types';

export function useAlerts() {
  const [alerts, setAlerts] = useState<ServiceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchAlerts()
      .then((result) => {
        if (!cancelled) setAlerts(result);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { alerts, loading, error };
}
