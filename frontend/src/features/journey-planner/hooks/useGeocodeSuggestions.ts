import { useEffect, useState } from 'react';
import { geocode } from '../api/geocode';
import type { GeocodeResult } from '../types';

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 3;

export function useGeocodeSuggestions(query: string) {
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([]);
  const [resolvedQuery, setResolvedQuery] = useState<string | null>(null);
  const queryTooShort = query.trim().length < MIN_QUERY_LENGTH;

  useEffect(() => {
    if (queryTooShort) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      geocode(query)
        .then((results) => {
          if (cancelled) return;
          setSuggestions(results);
          setResolvedQuery(query);
        })
        .catch(() => {
          if (cancelled) return;
          setSuggestions([]);
          setResolvedQuery(query);
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, queryTooShort]);

  return {
    suggestions: queryTooShort ? [] : suggestions,
    loading: !queryTooShort && resolvedQuery !== query,
  };
}
