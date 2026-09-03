import { test, expect, type Page } from '@playwright/test';

// Favourite addresses used to be free text: anything typed was stored, so an
// address the planner's geocoder cannot resolve became dead weight the user
// only discovered later. And the form gave no sign it held unsaved changes.
//
// The field now lives in a modal opened by "Ajouter une adresse", and a
// favourite is {label, address} where the label is Maison or Travail — so
// every test here opens the modal and picks a kind before typing.

const TOKEN = 'test-token';
const USER = { id: 'u1', email: 'jean.dupont@example.com' };
const EXISTING = { label: 'Maison', address: '12 rue de la Loge, Montpellier' };
const PROFILE = {
  preferredModes: ['Tram'],
  favoriteAddresses: [EXISTING],
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
  // The list the form renders comes from the server's response, so the PATCH
  // has to echo back what it was sent — replying with the original PROFILE
  // would make every add look like it silently did nothing.
  await page.route('http://localhost:3000/profile', (route) => {
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      return route.fulfill({ json: { ...PROFILE, ...body } });
    }
    return route.fulfill({ json: PROFILE });
  });
  await page.route('**/geocode*', (route) => route.fulfill({ json: geocode }));
  await page.goto('/profile');
}

// Opens the modal and selects a kind, leaving the address field focused-ready.
// Maison is already taken by PROFILE, so Travail is the free slot.
async function openAddressModal(page: Page, kind = 'Travail') {
  await page.getByRole('button', { name: 'Ajouter une adresse' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: kind }).click();
  return dialog;
}

test('resolves a typed address through the geocoder before storing it', async ({ page }) => {
  await openProfile(page);
  const dialog = await openAddressModal(page);
  await dialog.getByRole('combobox', { name: 'Adresse' }).fill('Comédie');

  // Picking the suggestion is what a user does — the open listbox sits over
  // the Ajouter button, as an autocomplete popup should.
  await page.getByRole('option', { name: SUGGESTIONS[0].displayName }).click();

  // Stored under the geocoder's canonical name, not the raw typing.
  await expect(mainOf(page).getByText(SUGGESTIONS[0].displayName)).toBeVisible();
});

test('resolves a typed address even when no suggestion is picked', async ({ page }) => {
  await openProfile(page);
  const dialog = await openAddressModal(page);
  const field = dialog.getByRole('combobox', { name: 'Adresse' });
  await field.fill('Comédie');
  // Blur to dismiss the popup covering the confirm button. Not Escape: the
  // input's handler closes the listbox but does not preventDefault, so the
  // event reaches <dialog> and closes the whole modal.
  await field.blur();

  await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();

  await expect(mainOf(page).getByText(SUGGESTIONS[0].displayName)).toBeVisible();
});

test('a suggestion can be chosen with the keyboard', async ({ page }) => {
  await openProfile(page);
  const dialog = await openAddressModal(page);
  const field = dialog.getByRole('combobox', { name: 'Adresse' });
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
  const dialog = await openAddressModal(page);
  await dialog.getByRole('combobox', { name: 'Adresse' }).fill('chez mamie');
  await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();

  await expect(dialog.getByRole('alert')).toContainText('Adresse introuvable');
  await expect(mainOf(page).getByText('chez mamie')).toHaveCount(0);
});

test('offers only the kinds not already saved', async ({ page }) => {
  // Maison is taken by PROFILE, so it cannot be picked again — the modal
  // prevents the label collision instead of letting the form reject it after.
  await openProfile(page);
  await page.getByRole('button', { name: 'Ajouter une adresse' }).click();
  const dialog = page.getByRole('dialog');

  await expect(dialog.getByRole('button', { name: /Maison/ })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Travail' })).toBeEnabled();
});

test('saves a mode toggle immediately', async ({ page }) => {
  // The form holds no draft: every control saves on the spot, so there is no
  // dirty flag and no Enregistrer button. The pressed state reflects what the
  // server returned, so it only flips once the save actually landed.
  await openProfile(page);
  const velo = page.getByRole('button', { name: 'Vélo' });
  await expect(velo).toHaveAttribute('aria-pressed', 'false');

  await velo.click();

  await expect(velo).toHaveAttribute('aria-pressed', 'true');
  // Tram came from the profile and is untouched by the toggle.
  await expect(page.getByRole('button', { name: 'Tram' })).toHaveAttribute('aria-pressed', 'true');
});
