import { expect, test } from '@playwright/test';
import fixtures from './fixtures/engine.json' with { type: 'json' };
import { formatPct } from '../src/lib/format.ts';
import {
  addCards,
  expectMatchesEngine,
  open,
  target,
  useOneDeckManual,
  waitCurrent,
} from './helpers';

test.beforeEach(async ({ page }) => {
  await open(page);
  await useOneDeckManual(page);
});

test('manual, 1 mazo: 10 y 6 contra 10 muestra exactamente lo que devuelve el motor', async ({
  page,
}) => {
  await addCards(page, ['10', '6']);
  await target(page, /Dealer ·/);
  await addCards(page, ['K']);
  await expectMatchesEngine(page, fixtures.hard16vs10);
  await expect(page.getByTestId('bust-meter-value')).toHaveText(
    formatPct(fixtures.hard16vs10.pBustOnHit),
  );
  await expect(page.getByTestId('player-hand-0-total')).toHaveText('16');
});

test('quitar todas las cartas de valor 10 recalcula el panel y lo cambia', async ({ page }) => {
  await addCards(page, ['10', '6']);
  await target(page, /Dealer ·/);
  await addCards(page, ['K']);
  await waitCurrent(page);
  const before = await page.getByTestId('ev-stand').textContent();
  const bustBefore = await page.getByTestId('bust-meter-value').textContent();

  await page.getByTestId('shoe-hud').click();
  for (const f of ['10', 'J', 'Q', 'K']) {
    const minus = page.getByTestId(`shoe-minus-${f}`);
    while (await minus.isEnabled()) await minus.click();
    await expect(page.getByTestId(`shoe-count-${f}`)).toHaveText('0');
  }
  await page.getByRole('button', { name: 'Cerrar' }).click();

  await waitCurrent(page);
  await expect(page.getByTestId('ev-stand')).not.toHaveText(before!);
  await expect(page.getByTestId('bust-meter-value')).not.toHaveText(bustBefore!);
});

test('cambiar de jugador a dealer y volver no pierde cartas ni zapato', async ({ page }) => {
  await addCards(page, ['10', '6']);
  await target(page, /Dealer ·/);
  await addCards(page, ['K']);
  await waitCurrent(page);
  const shoe = await page.getByTestId('shoe-hud').getAttribute('aria-label');

  await page.locator('label', { hasText: /^Dealer$/ }).click();
  await waitCurrent(page, 'dealer-analysis');
  await expect(page.getByTestId('player-hand-0-total')).toHaveText('16');
  await expect(page.getByTestId('shoe-hud')).toHaveAttribute('aria-label', shoe!);

  await page.locator('label', { hasText: /^Jugador$/ }).click();
  await expectMatchesEngine(page, fixtures.hard16vs10);
  await expect(page.getByTestId('shoe-hud')).toHaveAttribute('aria-label', shoe!);
});

test('dividir un par: el análisis sigue a la mano activa', async ({ page }) => {
  await addCards(page, ['8', '8']);
  await target(page, /Dealer ·/);
  await addCards(page, ['6']);
  await waitCurrent(page);
  await page.keyboard.press('p');

  await addCards(page, ['3']);
  await expect(page.getByTestId('player-hand-0')).toHaveAttribute('data-active', 'true');
  await expect(page.getByRole('heading', { name: 'Acciones · mano 1 de 2' })).toBeVisible();
  await expectMatchesEngine(page, fixtures.split1);

  await page.keyboard.press('s');
  await addCards(page, ['2']);
  await expect(page.getByTestId('player-hand-1')).toHaveAttribute('data-active', 'true');
  await expect(page.getByRole('heading', { name: 'Acciones · mano 2 de 2' })).toBeVisible();
  await expectMatchesEngine(page, fixtures.split2);
});

test('una carta agotada queda bloqueada en el selector', async ({ page }) => {
  await target(page, /Descartada/);
  for (let i = 0; i < 4; i++) await page.locator('[data-face="A"]').click();
  await expect(page.locator('[data-face="A"]')).toBeDisabled();
  await expect(page.locator('[data-face="A"]')).toHaveAccessibleName('A, quedan 0');
});
