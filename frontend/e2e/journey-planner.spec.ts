import { test, expect } from '@playwright/test';

// Mocked geocode results — one per field, distinguished by displayName so
// each AddressInput's suggestion click is unambiguous.
const ORIGIN_SUGGESTION = { displayName: 'Place de la Comédie, Montpellier', lat: 43.6086, lon: 3.8794 };
const DESTINATION_SUGGESTION = { displayName: 'Gare Saint-Roch, Montpellier', lat: 43.6045, lon: 3.8807 };

const MOCK_JOURNEY = {
  segments: [
    {
      mode: 'Tram',
      durationSeconds: 900,
      distanceMeters: 3000,
      from: { name: 'Comédie', lat: 43.6086, lon: 3.8794 },
      to: { name: 'Gare Saint-Roch', lat: 43.6045, lon: 3.8807 },
      carbonGrams: 30,
      routeShortName: '1',
      tripHeadsign: 'Odysseum',
      startTime: '2026-07-18T08:00:00.000Z',
      endTime: '2026-07-18T08:15:00.000Z',
    },
  ],
  durationSeconds: 1380, // 23 min
  carbonGrams: 230,
  carComparison: { carCarbonGrams: 1000, savedCarbonGrams: 770, savedPercent: 77 },
  degraded: false,
};

test('plans a journey and shows duration and carbon footprint', async ({ page }) => {
  await page.route('**/geocode*', async (route) => {
    const url = new URL(route.request().url());
    const q = url.searchParams.get('q') ?? '';
    const body = q.startsWith('Comédie') ? [ORIGIN_SUGGESTION] : [DESTINATION_SUGGESTION];
    await route.fulfill({ json: body });
  });

  await page.route('**/journeys', async (route) => {
    await route.fulfill({ json: [MOCK_JOURNEY] });
  });

  await page.goto('/');

  const origin = page.getByLabel('Départ', { exact: true });
  await origin.fill('Comédie Montpellier');
  await page.getByRole('button', { name: ORIGIN_SUGGESTION.displayName }).click();

  const destination = page.getByLabel('Arrivée', { exact: true });
  await destination.fill('Gare Saint-Roch');
  await page.getByRole('button', { name: DESTINATION_SUGGESTION.displayName }).click();

  await page.getByRole('button', { name: 'Rechercher' }).click();

  await expect(page.getByText('230 g CO₂e')).toBeVisible();
  await expect(page.getByText('23 min').last()).toBeVisible();
});
