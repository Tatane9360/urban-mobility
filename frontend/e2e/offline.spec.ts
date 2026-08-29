import { test, expect, type Page } from '@playwright/test';

// The offline tests run against the production build on 3002, not the dev
// server: `next dev` serves on-demand JS chunks the service worker can't
// cache, so an offline page would never hydrate there (measured — dev renders
// an empty shell, prod renders the cached journeys).
const PROD = 'http://localhost:3002';

// #12: offline, the user still reaches the journeys they have already seen,
// and a new search says why it can't run instead of failing opaquely.

const TOKEN = 'test-token';
const USER = { id: 'u1', email: 'offline@example.com' };

const SAVED_JOURNEY = {
  id: 'j1',
  segments: [
    {
      mode: 'Tram',
      durationSeconds: 900,
      carbonGrams: 30,
      from: { name: 'Comédie', lat: 43.6086, lon: 3.8794 },
      to: { name: 'Odysseum', lat: 43.6045, lon: 3.8807 },
    },
  ],
  durationSeconds: 900,
  carbonGrams: 30,
  degraded: false,
  savedAt: '2026-08-01T08:00:00.000Z',
};

const STATS = {
  journeyCount: 1,
  carbonGrams: 30,
  carCarbonGrams: 600,
  savedCarbonGrams: 570,
  savedPercent: 95,
  byMode: [{ mode: 'Tram', carbonGrams: 30, distanceMeters: 3000 }],
};

// Signs in by seeding the token the AuthProvider reads at mount, so these
// tests never depend on the login form.
async function signIn(page: Page) {
  await page.addInitScript((token) => {
    localStorage.setItem('urbanflow.accessToken', token);
  }, TOKEN);
  await page.route('**/auth/me', (route) => route.fulfill({ json: USER }));
  await page.route('**/journeys/saved/stats', (route) => route.fulfill({ json: STATS }));
  await page.route('**/journeys/saved', (route) => route.fulfill({ json: [SAVED_JOURNEY] }));
}

test('shows the cached journeys and says so when offline', async ({ page, context }) => {
  await signIn(page);

  // First visit online: this is what fills the local copy.
  await page.goto(`${PROD}/history`);
  await expect(page.getByText('Odysseum')).toBeVisible();

  // The service worker only sees requests it controls, and it takes control
  // after the first load — so the page's own JS chunks are cached on the
  // second visit, not the first. Without this reload the offline page serves
  // HTML that can never hydrate.
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.reload();
  await expect(page.getByText('Odysseum')).toBeVisible();

  // setOffline alone doesn't cut a page.route'd request — Playwright keeps
  // fulfilling it — so the API mock is switched to a real network failure,
  // which is what the app actually sees offline.
  // /auth/me fails offline too. It must NOT sign the user out: dropping the
  // token on a network error locks them out of the very data cached for this
  // case, sending them to /login instead of their journeys.
  await page.route('**/auth/me', (route) => route.abort('internetdisconnected'));
  await page.route('**/journeys/saved', (route) => route.abort('internetdisconnected'));
  await context.setOffline(true);
  await page.reload();

  await expect(page.getByText('Odysseum')).toBeVisible();
  await expect(page.getByRole('status')).toContainText('hors ligne');
});

test('keeps no cached journeys for the next account after logout', async ({ page }) => {
  await signIn(page);
  await page.goto(`${PROD}/history`);
  await expect(page.getByText('Odysseum')).toBeVisible();

  expect(
    await page.evaluate(() => localStorage.getItem('urbanflow.saved-journeys-cache')),
  ).not.toBeNull();

  // Logging out must drop the offline copy — otherwise the next account on
  // this device reads the previous one's journeys. Clicking the real control,
  // with no fallback: if the button isn't there, this test must fail rather
  // than quietly assert on a hand-cleared key.
  await page.getByRole('button', { name: /déconnexion/i }).click();

  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem('urbanflow.saved-journeys-cache')),
    )
    .toBeNull();
});

test('explains that a new search needs the network', async ({ page, context }) => {
  await page.route('**/geocode*', (route) =>
    route.fulfill({ json: [{ displayName: 'Comédie, Montpellier', lat: 43.6086, lon: 3.8794 }] }),
  );
  await page.goto(`${PROD}/`);

  for (const label of ['Départ', 'Arrivée']) {
    await page.getByLabel(label, { exact: true }).fill('Comédie');
    await page.getByRole('button', { name: 'Comédie, Montpellier' }).click();
  }

  await context.setOffline(true);
  await page.getByRole('button', { name: 'Rechercher' }).click();

  // A clear cause, not a raw failure.
  await expect(page.getByText(/hors ligne/i)).toBeVisible();
});
