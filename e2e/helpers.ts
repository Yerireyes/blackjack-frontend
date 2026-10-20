import { expect, type Page } from '@playwright/test';
import { formatEv } from '../src/lib/format.ts';

export async function open(page: Page) {
  page.on('dialog', (d) => d.accept());
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Blackjack Guide' })).toBeVisible();
}

export async function useOneDeckManual(page: Page) {
  await page.getByTestId('rules-button').click();
  await page.getByTestId('rule-decks').selectOption('1');
  await page.getByTestId('rules-apply').click();
  await page.locator('label', { hasText: /^Manual$/ }).click();
}

export const target = (page: Page, name: RegExp) => page.getByRole('radio', { name }).click();

export async function addCards(page: Page, faces: string[]) {
  for (const f of faces) await page.locator(`[data-face="${f}"]`).click();
}

export const handAnalysis = (page: Page) => page.getByTestId('hand-analysis');

export async function waitCurrent(page: Page, testId = 'hand-analysis') {
  await expect(page.getByTestId(testId)).toHaveAttribute('data-state', 'current', {
    timeout: 15_000,
  });
}

interface EngineHand {
  best: string;
  pBustOnHit: number;
  actions: { action: string; ev: number; exact: boolean }[];
}

/** La UI muestra exactamente lo que devuelve el motor para ese estado. */
export async function expectMatchesEngine(page: Page, res: EngineHand) {
  await waitCurrent(page);
  for (const a of res.actions) {
    await expect(page.getByTestId(`ev-${a.action}`)).toHaveText(
      `${a.exact ? '' : '≈ '}${formatEv(a.ev)}`,
    );
  }
  await expect(page.getByTestId('action-best')).toHaveAttribute('data-action', res.best);
  await expect(page.locator('[data-testid="action-panel"] > li')).toHaveCount(res.actions.length);
}
