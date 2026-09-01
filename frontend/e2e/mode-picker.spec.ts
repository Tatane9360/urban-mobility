import { test, expect } from '@playwright/test';

// The picker used to render an icon and a bare duration, so its buttons
// announced "12 min" with no mode identity at all.
const SUGGESTION = { displayName: 'Place de la Comédie, Montpellier', lat: 43.6086, lon: 3.8794 };

function journey(mode: string, durationSeconds: number) {
  return {
    segments: [{
      mode, durationSeconds, distanceMeters: 3000,
      from: { name: 'A', lat: 43.6, lon: 3.87 },
      to: { name: 'B', lat: 43.61, lon: 3.88 },
      carbonGrams: 30, routeShortName: '1', tripHeadsign: 'Odysseum',
      startTime: '2026-07-18T08:00:00.000Z', endTime: '2026-07-18T08:15:00.000Z',
    }],
    durationSeconds, carbonGrams: 30,
    carComparison: { carCarbonGrams: 1000, savedCarbonGrams: 770, savedPercent: 77 },
    degraded: false,
  };
}

test('names each mode, not just its duration', async ({ page }) => {
  await page.route('**/geocode*', (r) => r.fulfill({ json: [SUGGESTION] }));
  await page.route('**/journeys', (r) =>
    r.fulfill({ json: [journey('Tram', 900), journey('Marche', 2400), journey('Vélo', 1200)] }));

  await page.goto('/');
  for (const label of ['Départ', 'Arrivée']) {
    await page.getByRole('combobox', { name: label }).fill('Comédie');
    await page.getByRole('option', { name: SUGGESTION.displayName }).click();
  }
  await page.getByRole('button', { name: 'Rechercher' }).click();

  // Each picker button is reachable by its mode name, not by a bare duration.
  await expect(page.getByRole('button', { name: /^Marche —/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Vélo —/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Transport —/ })).toBeVisible();

  // And the mode is visible, not icon-only.
  await expect(page.getByRole('button', { name: /^Transport —/ })).toContainText('Transport');
});

test('the picker row does not overflow a 390px viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/geocode*', (r) => r.fulfill({ json: [SUGGESTION] }));
  await page.route('**/journeys', (r) =>
    r.fulfill({ json: [journey('Tram', 900), journey('Marche', 2400), journey('Vélo', 1200)] }));

  await page.goto('/');
  for (const label of ['Départ', 'Arrivée']) {
    await page.getByRole('combobox', { name: label }).fill('Comédie');
    await page.getByRole('option', { name: SUGGESTION.displayName }).click();
  }
  await page.getByRole('button', { name: 'Rechercher' }).click();
  await expect(page.getByRole('button', { name: /^Transport —/ })).toBeVisible();

  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
});
