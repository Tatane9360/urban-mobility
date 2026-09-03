import type { SavedJourney } from './types';

// #12: the saved journeys a user has already seen stay readable without a
// network. Deliberately NOT cached in the service worker: sw.js excludes the
// API on purpose, so one browser profile can't serve another account's data
// from a shared cache. Here the payload is cleared on logout instead.
const STORAGE_KEY = 'urbanflow.saved-journeys-cache';

// localStorage, not IndexedDB: a handful of journeys is a few KB. Move if the
// list ever approaches the ~5MB quota.
export function readCachedJourneys(): SavedJourney[] | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed: unknown = JSON.parse(stored);
    // A hand-edited or truncated entry must read as "no cache", never crash
    // the history page.
    return Array.isArray(parsed) ? (parsed as SavedJourney[]) : null;
  } catch {
    return null;
  }
}

export function writeCachedJourneys(journeys: SavedJourney[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(journeys));
  } catch {
    // Quota or blocked storage: the page still works online.
  }
}

// Called on logout: the next account on this device must not inherit the
// previous one's journeys.
export function clearCachedJourneys(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}
