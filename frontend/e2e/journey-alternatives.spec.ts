import { test, expect, type Page } from '@playwright/test';

// #9 reaches the screen: the planner returns several transit departures, and
// the UI must expose them. ModePicker only ever surfaces the fastest candidate
// per mode, so without the alternatives list the other departures the backend
// computed are unreachable — which is exactly what this asserts.

const SUGGESTION = { displayName: 'Place de la Comédie, Montpellier', lat: 43.6086, lon: 3.8794 };

function tramJourney(opts: {
  minutes: number;
  from: string;
  startTime: string;
}) {
  return {
    segments: [
      {
        mode: 'Tram',
        durationSeconds: opts.minutes * 60,
        distanceMeters: 3000,
        from: { name: opts.from, lat: 43.6086, lon: 3.8794 },
        to: { name: 'Odysseum', lat: 43.6045, lon: 3.9199 },
        carbonGrams: 30,
        routeShortName: '1',
        tripHeadsign: 'Odysseum',
        startTime: opts.startTime,
        endTime: opts.startTime,
      },
    ],
    durationSeconds: opts.minutes * 60,
    carbonGrams: 30,
    carComparison: { carCarbonGrams: 1000, savedCarbonGrams: 970, savedPercent: 97 },
    degraded: false,
  };
}

// Three Tram departures plus a walk-only candidate, the shape the planner
// actually returns for a central Montpellier search.
const JOURNEYS = [
  tramJourney({ minutes: 21, from: 'Du Guesclin', startTime: '2026-07-18T08:00:00.000Z' }),
  tramJourney({ minutes: 24, from: 'Gare Saint-Roch', startTime: '2026-07-18T08:02:00.000Z' }),
  tramJourney({ minutes: 25, from: 'Comédie', startTime: '2026-07-18T08:05:00.000Z' }),
  {
    segments: [
      {
        mode: 'Marche',
        durationSeconds: 39 * 60,
        distanceMeters: 3200,
        from: { name: 'Comédie', lat: 43.6086, lon: 3.8794 },
        to: { name: 'Odysseum', lat: 43.6045, lon: 3.9199 },
        carbonGrams: 0,
        startTime: '2026-07-18T08:00:00.000Z',
        endTime: '2026-07-18T08:39:00.000Z',
      },
    ],
    durationSeconds: 39 * 60,
    carbonGrams: 0,
    carComparison: { carCarbonGrams: 1000, savedCarbonGrams: 1000, savedPercent: 100 },
    degraded: false,
  },
];

async function search(page: Page) {
  await page.route('**/geocode*', (route) => route.fulfill({ json: [SUGGESTION] }));
  await page.route('**/journeys', (route) => route.fulfill({ json: JOURNEYS }));
  await page.goto('/');

  for (const label of ['Départ', 'Arrivée']) {
    await page.getByRole('combobox', { name: label }).fill('Comédie');
    await page.getByRole('option', { name: SUGGESTION.displayName }).click();
  }
  await page.getByRole('button', { name: 'Rechercher' }).click();
}

test('lists the other transit departures, not just the fastest one', async ({ page }) => {
  await search(page);

  const others = page.getByRole('region', { name: 'Autres itinéraires' });
  await expect(others).toBeVisible();

  // The two Tram candidates the picker does not surface. The walk-only one is
  // absent: it already has its own picker entry.
  const options = others.getByRole('button');
  await expect(options).toHaveCount(2);
  await expect(options.first()).toContainText('Gare Saint-Roch');
  await expect(others).not.toContainText('39 min');
});

test('switches to an alternative when it is picked', async ({ page }) => {
  await search(page);

  // The fastest Tram (21 min, Du Guesclin) is selected by default. Scoped to
  // the main card, since the alternatives list shows durations too.
  const mainCard = page.locator('main div').filter({ hasText: 'vs voiture' }).first();
  await expect(mainCard).toContainText('21 min');

  await page
    .getByRole('region', { name: 'Autres itinéraires' })
    .getByRole('button', { name: /Gare Saint-Roch/ })
    .click();

  // The chosen alternative becomes the main result, and the one it replaced
  // moves into the list.
  await expect(mainCard).toContainText('24 min');
  await expect(
    page.getByRole('region', { name: 'Autres itinéraires' }).getByRole('button', {
      name: /Du Guesclin/,
    }),
  ).toBeVisible();
});
