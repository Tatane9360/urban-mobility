// The PRD treats geolocation as sensitive data: explicit, revocable consent
// before the browser is ever asked for a position. Nothing is stored server
// side — the choice lives in this browser only, which is also why a private
// window starts over rather than inheriting a past session's answer.
const STORAGE_KEY = 'urbanflow.geolocation-consent';

export type GeolocationConsent = 'granted' | 'denied' | null;

// localStorage throws in real cases (Safari private mode, site data blocked).
// A failed read means "never asked", a failed write means the choice is not
// remembered — neither breaks the page, and neither can become consent.
export function readConsent(): GeolocationConsent {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'granted' || stored === 'denied' ? stored : null;
  } catch {
    return null;
  }
}

export function writeConsent(consent: GeolocationConsent): void {
  try {
    if (consent === null) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, consent);
    }
  } catch {
    // Not remembering the answer is survivable; asking again is the safe side.
  }
}

// Minimal store so the profile screen re-renders when the choice changes.
// A Set of callbacks rather than a state library: one component subscribes.
const listeners = new Set<() => void>();

export function subscribeToConsent(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyConsentChanged(): void {
  listeners.forEach((listener) => listener());
}
