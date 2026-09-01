import { test, expect, type Page } from '@playwright/test';

// Favourite addresses used to be free text: anything typed was stored, so an
// address the planner's geocoder cannot resolve became dead weight the user
// only discovered later. And the form gave no sign it held unsaved changes.

const TOKEN = 'test-token';
const USER = { id: 'u1', email: 'jean.dupont@example.com' };
const PROFILE = {
  preferredModes: ['Tram'],
  favoriteAddresses: ['12 rue de la Loge, Montpellier'],
  pmrAccessibility: false,
};
const SUGGESTIONS = [
  { displayName: 'Place de la Comédie, Montpellier', lat: 43.6087, lon: 3.8796 },
  { displayName: 'Place Albert 1er, Montpellier', lat: 43.6142, lon: 3.8735 },
];

const mainOf = (page: Page) => page.locator('main');

async function openProfile(page: Page, geocode: unknown[] = SUGGESTIONS) {
  await page.addInitScript((token) => {
    localStorage.setItem('urbanflow.accessToken', token);
  }, TOKEN);
  await page.route('**/auth/me', (route) => route.fulfill({ json: USER }));
  await page.route('http://localhost:3000/profile', (route) => route.fulfill({ json: PROFILE }));
  await page.route('**/geocode*', (route) => route.fulfill({ json: geocode }));
  await page.goto('/profile');
}

test('resolves a typed address through the geocoder before storing it', async ({ page }) => {
  await openProfile(page);
  const field = page.getByRole('combobox', { name: 'Ajouter une adresse favorite' });
  await field.fill('Comédie');

  await page.getByRole('button', { name: 'Ajouter cette adresse' }).click();

  // Stored under the geocoder's canonical name, not the raw typing.
  await expect(mainOf(page).getByText(SUGGESTIONS[0].displayName)).toBeVisible();
});

test('a suggestion can be chosen with the keyboard', async ({ page }) => {
  await openProfile(page);
  const field = page.getByRole('combobox', { name: 'Ajouter une adresse favorite' });
  await field.focus();
  await field.pressSequentially('Albert');

  const listbox = page.getByRole('listbox');
  await expect(listbox.getByRole('option')).toHaveCount(SUGGESTIONS.length);

  await field.press('ArrowDown');
  await field.press('ArrowDown');
  await field.press('Enter');

  await expect(mainOf(page).getByText(SUGGESTIONS[1].displayName)).toBeVisible();
});

test('refuses an address the geocoder cannot resolve', async ({ page }) => {
  await openProfile(page, []);
  const field = page.getByRole('combobox', { name: 'Ajouter une adresse favorite' });
  await field.fill('chez mamie');
  await page.getByRole('button', { name: 'Ajouter cette adresse' }).click();

  await expect(mainOf(page).getByRole('alert')).toContainText('Adresse introuvable');
  await expect(mainOf(page).getByText('chez mamie')).toHaveCount(0);
});

test('refuses a duplicate address', async ({ page }) => {
  await openProfile(page, [{ displayName: PROFILE.favoriteAddresses[0], lat: 43.6, lon: 3.87 }]);
  const field = page.getByRole('combobox', { name: 'Ajouter une adresse favorite' });
  await field.fill('12 rue de la Loge');
  await page.getByRole('button', { name: 'Ajouter cette adresse' }).click();

  await expect(mainOf(page).getByRole('alert')).toContainText('déjà dans vos favoris');
});

test('flags unsaved changes and clears the flag once saved', async ({ page }) => {
  await openProfile(page);
  const main = mainOf(page);
  await expect(main.getByText('Modifications non enregistrées')).toHaveCount(0);

  await page.getByRole('button', { name: 'Vélo' }).click();
  await expect(main.getByText('Modifications non enregistrées')).toBeVisible();

  // Saving returns the updated profile, so the draft is no longer dirty.
  await page.route('http://localhost:3000/profile', (route) =>
    route.fulfill({ json: { ...PROFILE, preferredModes: ['Tram', 'Vélo'] } }),
  );
  await page.getByRole('button', { name: 'Enregistrer' }).click();

  await expect(main.getByText('Modifications non enregistrées')).toHaveCount(0);
  await expect(main.getByRole('status').first()).toContainText('Préférences enregistrées');
});
