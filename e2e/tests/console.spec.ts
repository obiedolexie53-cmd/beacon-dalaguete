import { expect, test } from '@playwright/test';
import { RESIDENT_URL } from '../playwright.config';
import {
  LEONA,
  createReportViaApi,
  expectAccessible,
  officerLogin,
  residentNotifications,
} from './helpers';

test('an officer reviews and verifies a resident report', async ({ page, request }) => {
  const reference = await createReportViaApi(
    request,
    RESIDENT_URL,
    'E2E: soil and rocks slid onto the barangay road after rain.',
  );
  await officerLogin(page);
  await expectAccessible(page, 'console dashboard');

  await page.getByRole('link', { name: 'Reports', exact: true }).click();
  await page.getByLabel('Search').fill(reference);
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page.getByText('Showing 1–1 of 1 report')).toBeVisible();
  await expectAccessible(page, 'reports list');
  await page.getByRole('link', { name: `Review report ${reference}` }).click();

  await expect(page.getByRole('heading', { name: 'Reporter' })).toBeVisible();
  await expect(page.getByText('Leona Legaspi', { exact: true })).toBeVisible();
  await expectAccessible(page, 'report review');

  await page.getByRole('button', { name: 'Mark as Under Verification' }).click();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByText('Status updated to Under Verification')).toBeVisible();
  await page.getByRole('button', { name: 'Verify Report' }).click();
  await page.getByLabel('Note (optional)').fill('Confirmed by the barangay captain.');
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByText('Status updated to Verified')).toBeVisible();

  const notifications = await residentNotifications(request, RESIDENT_URL);
  expect(notifications[0]?.title).toBe('Report verified');
  expect(notifications[0]?.body).toContain(reference);
});

test('the map, history and pattern analysis work on the DEMO history', async ({ page }) => {
  await officerLogin(page);

  await page.getByRole('link', { name: 'Disaster Map' }).click();
  await expect(page.getByText(/\d+ reports on the map/)).toBeVisible();
  await expectAccessible(page, 'disaster map');

  await page.getByRole('link', { name: 'Historical Reports' }).click();
  await expect(page.getByRole('heading', { name: 'Dataset' })).toBeVisible();
  await expect(page.getByText('Includes DEMO DATA')).toBeVisible();
  await expectAccessible(page, 'historical reports');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Export CSV/ }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^beacon-incidents-.*\.csv$/);

  await page.getByRole('link', { name: 'Pattern Analysis' }).click();
  await expect(
    page.getByText(/Recurring \w+ incidents were identified in the recorded dataset/).first(),
  ).toBeVisible();
  await expect(page.getByText(/does not predict future disasters/).first()).toBeVisible();
  await expectAccessible(page, 'pattern analysis findings');

  await page.getByRole('button', { name: 'Charts and map' }).click();
  await expect(page.getByRole('heading', { name: 'Hotspot map' })).toBeVisible();
  await expect(
    page.getByRole('table', { name: 'Records by barangay and hazard type' }),
  ).toBeVisible();
  await expectAccessible(page, 'pattern visualization');
});

test('residents cannot use the console', async ({ page, request }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(LEONA.identifier);
  await page.getByLabel('Password', { exact: true }).fill(LEONA.password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
  await expectAccessible(page, 'console login with an error');

  const login = await request.post(`${RESIDENT_URL}/api/v1/auth/login`, { data: LEONA });
  const { access_token } = (await login.json()) as { access_token: string };
  const staff = await request.get(`${RESIDENT_URL}/api/v1/staff/reports`, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  expect(staff.status()).toBe(401);

  await page.goto('/reports');
  await expect(page).toHaveURL(/\/login/);
});
