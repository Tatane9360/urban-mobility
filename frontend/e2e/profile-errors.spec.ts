import { test, expect, type Page } from '@playwright/test';

// Every failure path on the profile screen used to be silent: the API calls ran
// in try/finally with no catch, so a failed save, export or account deletion
// left the UI back at rest as though it had worked, and a failed profile fetch
// rendered a permanently blank page.

const TOKEN = 'test-token';
const USER = { id: 'u1', email: 'jean.dupont@example.com' };
const PROFILE = {
  preferredModes: ['Tram'],
  favoriteAddresses: [{ label: 'Maison', address: '12 rue de la Loge, Montpellier' }],
  pmrAccessibility: false,
};

const mainOf = (page: Page) => page.locator('main');

async function signIn(page: Page) {
  await page.addInitScript((token) => {
    localStorage.setItem('urbanflow.accessToken', token);
  }, TOKEN);
  await page.route('**/auth/me', (route) => route.fulfill({ json: USER }));
}

test('explains a failed profile load and offers a way out', async ({ page }) => {
  const main = mainOf(page);
  await signIn(page);
  let attempts = 0;
  await page.route('http://localhost:3000/profile', (route) => {
    attempts++;
    // Fail first, succeed on the retry.
    return attempts === 1 ? route.fulfill({ status: 500, json: {} }) : route.fulfill({ json: PROFILE });
  });

  await page.goto('/profile');

  const alert = main.getByRole('alert');
  await expect(alert).toContainText('Impossible de charger votre profil');
  await expect(alert.getByRole('link', { name: /planificateur/ })).toBeVisible();

  // Retry actually re-requests and recovers: the form replaces the error.
  await alert.getByRole('button', { name: 'Réessayer' }).click();
  await expect(main.getByRole('group', { name: 'Modes de transport préférés' })).toBeVisible();
  expect(attempts).toBe(2);
});

test('reflects a successful save in the control itself', async ({ page }) => {
  // Every control saves on click — there is no Enregistrer button. The pressed
  // state is driven by the server's response, so it only flips once the PATCH
  // came back.
  await signIn(page);
  await page.route('http://localhost:3000/profile', (route) => {
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      return route.fulfill({ json: { ...PROFILE, ...body } });
    }
    return route.fulfill({ json: PROFILE });
  });

  await page.goto('/profile');
  const velo = page.getByRole('button', { name: 'Vélo' });
  await expect(velo).toHaveAttribute('aria-pressed', 'false');

  await velo.click();

  await expect(velo).toHaveAttribute('aria-pressed', 'true');
});

test('reports a failed save rather than looking like it worked', async ({ page }) => {
  const main = mainOf(page);
  await signIn(page);
  await page.route('http://localhost:3000/profile', (route) =>
    route.request().method() === 'PATCH'
      ? route.fulfill({ status: 500, json: { message: 'Erreur serveur' } })
      : route.fulfill({ json: PROFILE }),
  );

  await page.goto('/profile');
  await page.getByRole('button', { name: 'Vélo' }).click();

  await expect(main.getByRole('alert')).toBeVisible();
  // The rejected change must not look applied.
  await expect(page.getByRole('button', { name: 'Vélo' })).toHaveAttribute('aria-pressed', 'false');
});

test('reports a failed export', async ({ page }) => {
  const main = mainOf(page);
  await signIn(page);
  await page.route('http://localhost:3000/profile', (route) => route.fulfill({ json: PROFILE }));
  await page.route('**/auth/me/export', (route) => route.fulfill({ status: 500, json: {} }));

  await page.goto('/profile');
  await page.getByRole('button', { name: /Télécharger/ }).click();

  await expect(main.getByRole('alert')).toContainText('téléchargement de vos données a échoué');
});

test('says the account still exists when deletion fails', async ({ page }) => {
  const main = mainOf(page);
  await signIn(page);
  await page.route('http://localhost:3000/profile', (route) => route.fulfill({ json: PROFILE }));
  await page.route('**/auth/me', (route) =>
    route.request().method() === 'DELETE'
      ? route.fulfill({ status: 500, json: {} })
      : route.fulfill({ json: USER }),
  );

  await page.goto('/profile');
  await page.getByRole('button', { name: /Supprimer définitivement mon compte/ }).click();
  await page.getByLabel(/pour confirmer/).fill(USER.email);
  await page.getByRole('button', { name: /Confirmer la suppression/ }).click();

  // The worst possible outcome is a silent failure that reads as success.
  await expect(main.getByRole('alert')).toContainText('toujours actif');
  await expect(page).toHaveURL(/\/profile$/);
});

test('the address field has an accessible name of its own', async ({ page }) => {
  await signIn(page);
  await page.route('http://localhost:3000/profile', (route) => route.fulfill({ json: PROFILE }));

  await page.goto('/profile');
  await page.getByRole('button', { name: 'Ajouter une adresse' }).click();

  // Named by its label, not merely by its placeholder.
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('combobox', { name: 'Adresse' })).toBeVisible();
});

test('confirms a successful deletion before redirecting away', async ({ page }) => {
  const main = mainOf(page);
  await signIn(page);
  await page.route('http://localhost:3000/profile', (route) => route.fulfill({ json: PROFILE }));
  await page.route('**/auth/me', (route) =>
    route.request().method() === 'DELETE'
      ? route.fulfill({ status: 204, body: '' })
      : route.fulfill({ json: USER }),
  );

  await page.goto('/profile');
  await page.getByRole('button', { name: /Supprimer définitivement mon compte/ }).click();
  await page.getByLabel(/pour confirmer/).fill(USER.email);
  await page.getByRole('button', { name: /Confirmer la suppression/ }).click();

  // The erasure is acknowledged rather than ending in a bare bounce home.
  await expect(main.getByRole('heading', { name: 'Compte supprimé' })).toBeVisible();
  await expect(main.getByText(/définitivement effacés/)).toBeVisible();

  // And the user leaves on their own terms.
  await main.getByRole('button', { name: /Retour au planificateur/ }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: 5000 });
});
