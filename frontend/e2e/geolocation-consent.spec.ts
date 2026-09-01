import { test, expect, type Page } from '@playwright/test';

// #8: geolocation is sensitive data under the PRD — explicit, revocable
// consent before the browser API is ever touched.

const SUGGESTION = { displayName: 'Place de la Comédie, Montpellier', lat: 43.6086, lon: 3.8794 };
const CONSENT_KEY = 'urbanflow.geolocation-consent';

// Replaces getCurrentPosition with a counting stub, so a test can assert the
// API was NOT called — the actual privacy guarantee. Installed as an init
// script so it is in place before any app code runs.
async function spyOnGeolocation(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __geoCalls: number }).__geoCalls = 0;
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (success: PositionCallback) => {
          (window as unknown as { __geoCalls: number }).__geoCalls += 1;
          success({
            coords: { latitude: 43.61, longitude: 3.877 },
          } as GeolocationPosition);
        },
      },
    });
  });
}

const geoCalls = (page: Page) =>
  page.evaluate(() => (window as unknown as { __geoCalls: number }).__geoCalls);

test.beforeEach(async ({ page }) => {
  await spyOnGeolocation(page);
  await page.route('**/geocode*', (route) => route.fulfill({ json: [SUGGESTION] }));
});

const locateButton = (page: Page) =>
  page.getByRole('button', { name: 'Utiliser ma position actuelle' });

test('asks for consent and calls no geolocation API before the user answers', async ({ page }) => {
  await page.goto('/');

  await locateButton(page).click();

  await expect(page.getByRole('dialog', { name: 'Consentement à la géolocalisation' })).toBeVisible();
  // The whole point: the prompt is shown INSTEAD of locating, not alongside it.
  expect(await geoCalls(page)).toBe(0);
});

test('locates only after consent is granted, and remembers it', async ({ page }) => {
  await page.goto('/');

  await locateButton(page).click();
  await page.getByRole('button', { name: 'Autoriser' }).click();

  await expect(page.getByRole('combobox', { name: 'Départ' })).toHaveValue('Ma position actuelle');
  expect(await geoCalls(page)).toBe(1);
  expect(await page.evaluate((k) => localStorage.getItem(k), CONSENT_KEY)).toBe('granted');

  // A second click must not ask again.
  await locateButton(page).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  expect(await geoCalls(page)).toBe(2);
});

test('never locates after the user refuses, on this click or the next', async ({ page }) => {
  await page.goto('/');

  await locateButton(page).click();
  await page.getByRole('button', { name: 'Refuser' }).click();

  await expect(page.getByRole('dialog')).toBeHidden();
  expect(await geoCalls(page)).toBe(0);
  expect(await page.evaluate((k) => localStorage.getItem(k), CONSENT_KEY)).toBe('denied');

  // Refusing is not a one-off dismissal: clicking again re-asks rather than
  // silently locating.
  await locateButton(page).click();
  await expect(page.getByRole('dialog', { name: 'Consentement à la géolocalisation' })).toBeVisible();
  expect(await geoCalls(page)).toBe(0);
});

test('starts over in a fresh browser context, inheriting no past consent', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await spyOnGeolocation(page);
  await page.route('**/geocode*', (route) => route.fulfill({ json: [SUGGESTION] }));

  await page.goto('/');
  await locateButton(page).click();

  await expect(page.getByRole('dialog', { name: 'Consentement à la géolocalisation' })).toBeVisible();
  expect(await geoCalls(page)).toBe(0);
  await context.close();
});
