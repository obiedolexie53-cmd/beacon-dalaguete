import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { expectAccessible, residentLogin } from './helpers';

const PHOTO = fileURLToPath(new URL('../fixtures/test-photo.jpg', import.meta.url));

/** Inside Dalaguete (the location check rejects points outside the municipality). */
test.use({
  geolocation: { latitude: 9.7612, longitude: 123.5349, accuracy: 12 },
  permissions: ['geolocation'],
});

async function startReport(page: Page) {
  await page.goto('/report');
  const discard = page.getByRole('button', { name: 'Discard draft' });
  if (await discard.isVisible().catch(() => false)) {
    await discard.click();
    await page.getByRole('button', { name: 'Discard', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Start report' }).click();
}

async function fillReport(page: Page, description: string, withPhoto = true, scan = false) {
  const check = async (name: string) => scan && (await expectAccessible(page, name));
  await check('report step: hazard type');
  await page.getByText('Flood', { exact: true }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('What happened?').fill(description);
  await check('report step: details');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Use my current location' }).click();
  await expect(page.getByText('GPS coordinates')).toBeVisible();
  await check('report step: location');
  await page.getByLabel('Barangay').selectOption({ label: 'Poblacion' });
  await page.getByLabel('Nearby landmark').fill('Public market');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Do not put yourself in danger to obtain evidence.')).toBeVisible();
  if (withPhoto) {
    await page.getByTestId('photo-pick').setInputFiles(PHOTO);
    await expect(page.getByAltText('Preview of photo 1')).toBeVisible();
  }
  await check('report step: evidence');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('heading', { name: 'Review your report' })).toBeVisible();
}

test('a resident reports a flood with a photo and follows it', async ({ page }) => {
  await residentLogin(page);
  await expectAccessible(page, 'resident home');
  await startReport(page);
  await fillReport(
    page,
    'E2E: knee-deep flood water on the highway near the public market.',
    true,
    true,
  );
  await expectAccessible(page, 'report review');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Submit report' }).click();

  await expect(page.getByRole('heading', { name: 'Report Submitted Successfully' })).toBeVisible();
  const reference = (await page.locator('.r-submitted__ref').innerText()).trim();
  expect(reference).toMatch(/^BEA-\d{4}-\d{6}$/);
  await expectAccessible(page, 'submission confirmation');

  await page.getByRole('link', { name: 'View report' }).click();
  await expect(page.getByRole('heading', { name: 'Status history' })).toBeVisible();
  await expect(page.getByText('Submitted', { exact: true }).first()).toBeVisible();
  await expect(page.getByAltText(`Photo 1 for ${reference}`)).toBeVisible();
  await expectAccessible(page, 'report details');

  await page.goto('/my-reports');
  await expect(page.getByText(reference).first()).toBeVisible();
  await expectAccessible(page, 'My Reports');
  await page
    .getByRole('link', { name: /Notifications/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();
  await expectAccessible(page, 'notifications');
  await page.getByRole('link', { name: 'Profile' }).first().click();
  await expect(page.getByText('Leona Legaspi').first()).toBeVisible();
  await expectAccessible(page, 'profile');
});

test('a dropped connection keeps the report and it can be sent again', async ({
  page,
  context,
}) => {
  await residentLogin(page);
  await startReport(page);
  await fillReport(page, 'E2E: flood report sent while the connection drops.', false);
  await page.getByRole('checkbox').check();
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Submit report' }).click();
  await expect(page.getByText('Report Not Submitted')).toBeVisible();
  await expect(
    page.getByText(/Please check your connection and try again\./).first(),
  ).toBeVisible();

  await context.setOffline(false);
  await page.getByRole('button', { name: 'Submit report' }).click();
  await expect(page.getByRole('heading', { name: 'Report Submitted Successfully' })).toBeVisible();
});

test.describe('without location permission', () => {
  test('explains how to continue', async ({ page }) => {
    // Headless browsers leave the permission prompt open, so answer it as a
    // browser does when the resident taps "Block".
    await page.addInitScript(() => {
      const denied = { code: 1, message: 'User denied Geolocation', PERMISSION_DENIED: 1 };
      navigator.geolocation.getCurrentPosition = (_ok, fail) =>
        fail?.(denied as unknown as GeolocationPositionError);
      navigator.geolocation.watchPosition = (_ok, fail) => {
        fail?.(denied as unknown as GeolocationPositionError);
        return 0;
      };
    });
    await residentLogin(page);
    await startReport(page);
    await page.getByText('Landslide', { exact: true }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByLabel('What happened?').fill('E2E: checking the location permission message.');
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Use my current location' }).click();
    await expect(page.getByText('Location permission denied')).toBeVisible();
    await expectAccessible(page, 'location step, permission denied');
  });
});

test('public pages are accessible', async ({ page }) => {
  await page.goto('/welcome');
  await expectAccessible(page, 'welcome');
  await page.goto('/login');
  await expectAccessible(page, 'resident login');
  await page.goto('/register');
  await expectAccessible(page, 'registration');
});
