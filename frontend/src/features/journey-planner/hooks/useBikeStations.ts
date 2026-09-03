import { useEffect, useState } from 'react';
import { fetchBikeStations } from '../api/bike-stations';
import type { BikeStation } from '../types';

// Matches the backend's own GBFS poll cadence (GbfsService.POLL_INTERVAL_MS)
// — refetching faster would only ever return the same snapshot.
const REFETCH_INTERVAL_MS = 30_000;

export function useBikeStations() {
  const [stations, setStations] = useState<BikeStation[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    function refetch() {
      fetchBikeStations()
        .then((result) => {
          if (!cancelled) {
            setStations(result.stations);
            setFetchedAt(result.fetchedAt);
          }
        })
        .catch(() => {
          // Silent on purpose: stations are a map overlay, not the journey
          // itself — a failed fetch just means no markers, same as the
          // "no snapshot yet" empty-array case.
        });
    }

    refetch();
    const interval = setInterval(refetch, REFETCH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { stations, fetchedAt };
}
