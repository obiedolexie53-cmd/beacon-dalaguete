import AxeBuilder from '@axe-core/playwright';
import { expect, type APIRequestContext, type Page } from '@playwright/test';

/** Fictional DEMO accounts created by `app.cli seed-demo`. */
export const LEONA = { identifier: 'leona.legaspi@demo.beacon.local', password: 'BeaconDemo-2026' };
export const OFFICER = { email: 'mdrrmo.officer@demo.beacon.local', password: 'BeaconDemo-2026' };

export async function residentLogin(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email or mobile number').fill(LEONA.identifier);
  await page.getByLabel('Password', { exact: true }).fill(LEONA.password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL('**/home');
}

export async function officerLogin(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(OFFICER.email);
  await page.getByLabel('Password', { exact: true }).fill(OFFICER.password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL('**/dashboard');
}

/**
 * Fails on serious or critical WCAG 2.1 A/AA problems found by axe-core.
 * Map tiles are left out: they are third-party images blocked in some test
 * environments.
 */
export async function expectAccessible(page: Page, name: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .exclude('.leaflet-tile-container')
    .analyze();
  const blocking = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  const summary = blocking.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help}\n    ${v.nodes.map((n) => n.target.join(' ')).join('\n    ')}`,
  );
  expect(summary, `Accessibility problems on ${name}`).toEqual([]);
}

/** Submit a report for Leona straight through the API (used to set up console tests). */
export async function createReportViaApi(
  request: APIRequestContext,
  residentBase: string,
  description: string,
): Promise<string> {
  const login = await request.post(`${residentBase}/api/v1/auth/login`, { data: LEONA });
  expect(login.ok()).toBeTruthy();
  const { access_token } = (await login.json()) as { access_token: string };
  const headers = { Authorization: `Bearer ${access_token}` };
  const hazards = (await (
    await request.get(`${residentBase}/api/v1/hazard-types`)
  ).json()) as Array<{
    id: number;
    code: string;
  }>;
  const barangays = (await (
    await request.get(`${residentBase}/api/v1/barangays`)
  ).json()) as Array<{
    id: number;
    name: string;
  }>;
  const today = new Date();
  const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const response = await request.post(`${residentBase}/api/v1/me/reports`, {
    headers,
    data: {
      client_request_id: crypto.randomUUID(),
      hazard_type_id: hazards.find((h) => h.code === 'landslide')!.id,
      description,
      incident_date: date,
      barangay_id: barangays.find((b) => b.name === 'Mantalongon')!.id,
      landmark: 'Vegetable trading post',
    },
  });
  expect(response.status()).toBe(201);
  return ((await response.json()) as { reference_no: string }).reference_no;
}

export async function residentNotifications(request: APIRequestContext, residentBase: string) {
  const login = await request.post(`${residentBase}/api/v1/auth/login`, { data: LEONA });
  const { access_token } = (await login.json()) as { access_token: string };
  const response = await request.get(`${residentBase}/api/v1/me/notifications`, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  return ((await response.json()) as { items: Array<{ title: string; body: string }> }).items;
}
