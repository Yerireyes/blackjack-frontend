import { expect, test } from '@playwright/test';
import { open, waitCurrent } from './helpers';

test('simulación: repartir, ver la recomendada del motor y jugar la ronda', async ({ page }) => {
  await open(page);
  await page.keyboard.press('Enter');
  // Si el dealer o el jugador tienen blackjack la ronda termina sola: repartimos de nuevo.
  for (let i = 0; i < 5; i++) {
    const done = await page.getByRole('button', { name: /Siguiente ronda/ }).isVisible();
    if (!done) break;
    await page.getByRole('button', { name: /Siguiente ronda/ }).click();
  }
  await waitCurrent(page);
  const best = await page.getByTestId('action-best').getAttribute('data-action');
  expect(['hit', 'stand', 'double', 'split', 'surrender']).toContain(best);
  // La recomendada también es el botón en cartulina de la mesa.
  await expect(page.getByRole('button', { name: /\(recomendada\)/ })).toHaveCount(1);

  await page.keyboard.press('s');
  await expect(page.getByRole('button', { name: /Siguiente ronda/ })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByTestId('announcer')).toContainText('Ronda terminada');
});
