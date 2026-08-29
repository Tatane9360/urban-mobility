import { test, expect, type Page, type Request } from '@playwright/test';

// Covers the two input paths the planner gained: a chosen departure time (#11)
// and picking origin/destination straight off the map (#4).

const SUGGESTION = { displayName: 'Place de la Comédie, Montpellier', lat: 43.6086, lon: 3.8794 };

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
  durationSeconds: 1380,
  carbonGrams: 230,
  carComparison: { carCarbonGrams: 1000, savedCarbonGrams: 770, savedPercent: 77 },
  degraded: false,
};

// Returns the body of the POST /journeys the search fires, so each test can
// assert on what actually went over the wire rather than on the UI alone.
async function mockApi(page: Page): Promise<() => Request> {
  let planRequest: Request | null = null;

  await page.route('**/geocode*', (route) => route.fulfill({ json: [SUGGESTION] }));
  await page.route('**/journeys', async (route) => {
    planRequest = route.request();
    await route.fulfill({ json: [MOCK_JOURNEY] });
  });

  return () => {
    if (!planRequest) throw new Error('POST /journeys was never called');
    return planRequest;
  };
}

async function fillViaGeocoder(page: Page, label: string) {
  await page.getByLabel(label, { exact: true }).fill('Comédie');
  await page.getByRole('button', { name: SUGGESTION.displayName }).click();
}

test('sends the chosen departure time in the POST /journeys body', async ({ page }) => {
  const planRequest = await mockApi(page);
  await page.goto('/');

  await fillViaGeocoder(page, 'Départ');
  await fillViaGeocoder(page, 'Arrivée');

  await page.getByLabel('Heure de départ').fill('2026-09-15T14:30');
  await page.getByRole('button', { name: 'Rechercher' }).click();
  await expect(page.getByText('230 g CO₂e')).toBeVisible();

  const body = planRequest().postDataJSON();
  // Must go out as an absolute instant (UTC "Z" form), never the bare local
  // string datetime-local produces: the backend parses it with new Date(), so
  // an offset-less value would be reread against the server's timezone.
  expect(body.departureTime).toMatch(/Z$/);
  expect(body.departureTime).toBe(new Date('2026-09-15T14:30').toISOString());
});

test('searches without a departure time when the field is left empty', async ({ page }) => {
  const planRequest = await mockApi(page);
  await page.goto('/');

  await fillViaGeocoder(page, 'Départ');
  await fillViaGeocoder(page, 'Arrivée');

  await page.getByRole('button', { name: 'Rechercher' }).click();
  await expect(page.getByText('230 g CO₂e')).toBeVisible();

  // Absent, not empty — the backend defaults to "now" for a missing field but
  // rejects an unparsable one.
  expect(planRequest().postDataJSON().departureTime).toBeUndefined();
});

// Clicks the middle of the Leaflet canvas, which the default view centres on
// Montpellier — the exact latlng doesn't matter, only that one arrives.
async function clickMap(page: Page) {
  await page.locator('.leaflet-container').click({ position: { x: 200, y: 120 } });
}

test('fills the origin from a click on the map', async ({ page }) => {
  const planRequest = await mockApi(page);
  await page.goto('/');

  await page.getByRole('button', { name: 'Choisir Départ sur la carte' }).click();
  await expect(page.getByText('Cliquez pour choisir le départ')).toBeVisible();
  await clickMap(page);

  // The picked point is labelled by its coordinates (no reverse geocoding).
  await expect(page.getByLabel('Départ', { exact: true })).toHaveValue(/^4[0-9.]+, [0-9.]+$/);
  await expect(page.getByText('Cliquez pour choisir le départ')).toBeHidden();

  await fillViaGeocoder(page, 'Arrivée');
  await page.getByRole('button', { name: 'Rechercher' }).click();
  await expect(page.getByText('230 g CO₂e')).toBeVisible();

  const body = planRequest().postDataJSON();
  expect(body.origin.coordinates.lat).toBeCloseTo(43.6, 0);
  expect(body.origin.coordinates.lon).toBeCloseTo(3.9, 0);
});

test('fills the destination from a click on the map', async ({ page }) => {
  const planRequest = await mockApi(page);
  await page.goto('/');

  await fillViaGeocoder(page, 'Départ');

  await page.getByRole('button', { name: "Choisir Arrivée sur la carte" }).click();
  await expect(page.getByText("Cliquez pour choisir l'arrivée")).toBeVisible();
  await clickMap(page);

  await expect(page.getByLabel('Arrivée', { exact: true })).toHaveValue(/^4[0-9.]+, [0-9.]+$/);

  await page.getByRole('button', { name: 'Rechercher' }).click();
  await expect(page.getByText('230 g CO₂e')).toBeVisible();

  const body = planRequest().postDataJSON();
  expect(body.destination.coordinates.lat).toBeCloseTo(43.6, 0);
  // The origin still came from the geocoder, untouched by the pick.
  expect(body.origin.coordinates.lat).toBe(SUGGESTION.lat);
});

test('cancels pick mode without selecting a point', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');

  const pickOrigin = page.getByRole('button', { name: 'Choisir Départ sur la carte' });
  await pickOrigin.click();
  await expect(pickOrigin).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'Annuler' }).click();

  await expect(page.getByText('Cliquez pour choisir le départ')).toBeHidden();
  await expect(pickOrigin).toHaveAttribute('aria-pressed', 'false');
  // Mode off: a click on the map must no longer fill the field.
  await clickMap(page);
  await expect(page.getByLabel('Départ', { exact: true })).toHaveValue('');
});
