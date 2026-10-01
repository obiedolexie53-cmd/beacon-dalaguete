import { expect, test, type Page } from '@playwright/test';
import { residentLogin } from './helpers';

/**
 * Buttons, links and form controls on the main resident screens must be at least
 * 44 × 44 px (WCAG 2.5.5 target size; the design system aims for 48 px). Links
 * inside sentences are exempt.
 */
async function smallTargets(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const selector =
      'button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=link]';
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue; // not shown
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden') continue;
      if (el.closest('.leaflet-control-attribution')) continue; // map credits
      const inline = el.tagName === 'A' && style.display === 'inline' && el.closest('p, li, dd');
      if (inline) continue;
      const input = el as HTMLInputElement;
      if (input.type === 'checkbox' || input.type === 'radio' || input.type === 'file') {
        // Their visible label is the target.
        const label = el.closest('label') ?? document.querySelector(`label[for="${el.id}"]`);
        const target = (label ?? el).getBoundingClientRect();
        if (target.height >= 44) continue;
      }
      if (box.height < 44 || box.width < 44) {
        const name = (el.getAttribute('aria-label') || el.textContent || el.tagName).trim();
        out.push(`${name.slice(0, 40)} (${Math.round(box.width)}×${Math.round(box.height)})`);
      }
    }
    return out;
  });
}

test('touch targets on the main resident screens are large enough', async ({ page }) => {
  await page.goto('/welcome');
  expect(await smallTargets(page), 'welcome').toEqual([]);
  await page.goto('/login');
  expect(await smallTargets(page), 'login').toEqual([]);
  await residentLogin(page);
  expect(await smallTargets(page), 'home').toEqual([]);
  await page.goto('/my-reports');
  await page.getByRole('heading', { name: 'My Reports' }).waitFor();
  expect(await smallTargets(page), 'my reports').toEqual([]);
  await page.goto('/report');
  await page.getByRole('heading').first().waitFor();
  expect(await smallTargets(page), 'report start').toEqual([]);
});
