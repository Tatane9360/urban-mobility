import { test, expect } from '@playwright/test';

// The critique found the suggestion popup was pointer-only: origin/destination
// stayed null unless a suggestion was clicked, so a keyboard user could never
// enable the search. These lock the keyboard path in.

const SUGGESTIONS = [
  { displayName: 'Place de la Comédie, Montpellier', lat: 43.6087, lon: 3.8796 },
  { displayName: 'Place Albert 1er, Montpellier', lat: 43.6142, lon: 3.8735 },
];

test.beforeEach(async ({ page }) => {
  await page.route('**/geocode**', (route) =>
    route.fulfill({ json: SUGGESTIONS }),
  );
  await page.route('**/alerts**', (route) => route.fulfill({ json: [] }));
});

test('a suggestion can be chosen with the keyboard alone', async ({ page }) => {
  await page.goto('/');

  const origin = page.getByRole('combobox', { name: 'Départ' });
  await origin.focus();
  await origin.pressSequentially('Comédie');

  const listbox = page.getByRole('listbox', { name: /Suggestions pour Départ/ });
  await expect(listbox).toBeVisible();
  await expect(origin).toHaveAttribute('aria-expanded', 'true');
  // The popup opens on the loading state too; wait for real options.
  await expect(listbox.getByRole('option')).toHaveCount(SUGGESTIONS.length);

  // ArrowDown highlights the first option, and the input points at it.
  await origin.press('ArrowDown');
  const first = listbox.getByRole('option').first();
  await expect(first).toHaveAttribute('aria-selected', 'true');
  const optionId = await first.getAttribute('id');
  await expect(origin).toHaveAttribute('aria-activedescendant', optionId!);

  // Enter commits it without submitting the form.
  await origin.press('Enter');
  await expect(origin).toHaveValue(SUGGESTIONS[0].displayName);
  await expect(listbox).toBeHidden();
});

test('Escape closes the popup without choosing anything', async ({ page }) => {
  await page.goto('/');

  const origin = page.getByRole('combobox', { name: 'Départ' });
  await origin.focus();
  await origin.pressSequentially('Comédie');

  const listbox = page.getByRole('listbox', { name: /Suggestions pour Départ/ });
  await expect(listbox).toBeVisible();

  await origin.press('Escape');
  await expect(listbox).toBeHidden();
  await expect(origin).toHaveValue('Comédie');
});

test('search resolves typed text instead of sitting behind a dead button', async ({ page }) => {
  let planned = false;
  await page.route('**/journeys', (route) => {
    planned = true;
    return route.fulfill({ json: [] });
  });

  await page.goto('/');

  // Neither field is picked from the list — the button must still work.
  await page.getByRole('combobox', { name: 'Départ' }).pressSequentially('Comédie');
  await page.getByRole('combobox', { name: 'Arrivée' }).pressSequentially('Albert');

  const search = page.getByRole('button', { name: /Rechercher/ });
  await expect(search).toBeEnabled();
  await search.click();

  await expect.poll(() => planned).toBe(true);
});

test('an empty field names itself instead of failing silently', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: /Rechercher/ }).click();

  await expect(page.getByRole('alert').filter({ hasText: 'Renseignez une adresse.' }).first())
    .toBeVisible();
});
