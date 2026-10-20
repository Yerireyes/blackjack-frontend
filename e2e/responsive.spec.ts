import { expect, test } from '@playwright/test';
import { open, waitCurrent } from './helpers';

test('móvil: sin scroll horizontal y con el análisis debajo de la mesa', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: /Repartir/ }).click();
  await waitCurrent(page).catch(() => {});
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  const table = await page.getByRole('region', { name: 'Mesa' }).boundingBox();
  const panel = await page.getByTestId('hand-analysis').boundingBox();
  expect(panel!.y).toBeGreaterThan(table!.y + table!.height - 1);
});

test('360 px en modo manual: todo cabe', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 760 });
  await open(page);
  await page.locator('label', { hasText: /^Manual$/ }).click();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
