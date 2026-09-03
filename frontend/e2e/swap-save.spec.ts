import { test, expect } from '@playwright/test';

const A = { displayName: 'Place de la Comédie, Montpellier', lat: 43.6087, lon: 3.8796 };
const B = { displayName: 'Gare Saint-Roch, Montpellier', lat: 43.6045, lon: 3.8807 };
const JOURNEY = {
  segments: [{ mode: 'Tram', durationSeconds: 900, distanceMeters: 3000,
    from: { name: 'Comédie', lat: 43.6087, lon: 3.8796 },
    to: { name: 'Saint-Roch', lat: 43.6045, lon: 3.8807 },
    carbonGrams: 30, routeShortName: '1', tripHeadsign: 'Odysseum',
    startTime: '2026-07-18T08:00:00.000Z', endTime: '2026-07-18T08:15:00.000Z' }],
  durationSeconds: 900, carbonGrams: 230,
  carComparison: { carCarbonGrams: 1000, savedCarbonGrams: 770, savedPercent: 77 }, degraded: false,
};

test('swaps origin and destination', async ({ page }) => {
  await page.route('**/geocode*', (r) => {
    const q = decodeURIComponent(new URL(r.request().url()).search);
    return r.fulfill({ json: q.includes('Gare') ? [B] : [A] });
  });
  await page.goto('/');

  const origin = page.getByRole('combobox', { name: 'Départ' });
  const destination = page.getByRole('combobox', { name: 'Arrivée' });

  await origin.fill('Comédie');
  await page.getByRole('option', { name: A.displayName }).click();
  await destination.fill('Gare');
  await page.getByRole('option', { name: B.displayName }).click();

  await expect(origin).toHaveValue(A.displayName);
  await expect(destination).toHaveValue(B.displayName);

  await page.getByRole('button', { name: /Inverser/ }).click();

  // Both the text and the underlying points must have traded places.
  await expect(page.getByRole('combobox', { name: 'Départ' })).toHaveValue(B.displayName);
  await expect(page.getByRole('combobox', { name: 'Arrivée' })).toHaveValue(A.displayName);
});

test('says so when saving a journey fails', async ({ page }) => {
  // A journey reaches the history when the trip is finished, not when it is
  // searched: the save fires from the navigation walkthrough's "Trajet
  // terminé", so that is the path this drives.
  await page.route('**/geocode*', (r) => r.fulfill({ json: [A] }));
  await page.route('**/journeys', (r) => r.fulfill({ json: [JOURNEY] }));
  await page.route('**/journeys/saved', (r) => r.fulfill({ status: 500, json: {} }));
  await page.route('**/auth/me', (r) => r.fulfill({ json: { id: 'u1', email: 'a@b.com' } }));
  await page.addInitScript(() => localStorage.setItem('urbanflow.accessToken', 't'));

  await page.goto('/');
  await page.getByRole('combobox', { name: 'Départ' }).fill('Comédie');
  await page.getByRole('option', { name: A.displayName }).click();
  await page.getByRole('combobox', { name: 'Arrivée' }).fill('Comédie');
  await page.getByRole('option', { name: A.displayName }).click();
  await page.getByRole('button', { name: 'Rechercher' }).click();

  await page.getByRole('button', { name: /Démarrer l'itinéraire/ }).first().click();
  // JOURNEY has a single segment, so the walkthrough opens on its only step
  // and the finish button is there straight away.
  await page.getByRole('button', { name: /Trajet terminé/ }).click();

  // The failed save keeps the walkthrough open with an inline error rather
  // than redirecting to a history that never received the trip.
  // .first(): Next renders its own empty role="alert" route announcer.
  await expect(page.getByRole('alert').first()).toContainText("Impossible d'enregistrer");
  await expect(page).toHaveURL(/\/$/);
});
