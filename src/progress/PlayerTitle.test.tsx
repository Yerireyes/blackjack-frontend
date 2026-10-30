// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { CosmeticId, DailyLeaderboard } from '@/engine/contract';
import { DailyPanel } from '@/daily/DailyPanel';
import { useDailyStore } from '@/daily/dailyStore';
import { PlayerTitle } from './PlayerTitle';

afterEach(() => useDailyStore.setState({ board: null }));

describe('título en los rankings', () => {
  it('va tras el nombre con el nombre de la pantalla de cosméticos', () => {
    const { container } = render(
      <p>
        Ana
        <PlayerTitle id="titleCoolHead" />
      </p>,
    );
    expect(container.textContent).toBe('Ana · Cabeza fría');
  });

  it('sin título, o con uno desconocido, no muestra nada', () => {
    const { container } = render(
      <p>
        Ana
        <PlayerTitle />
        <PlayerTitle id={'titleDelFuturo' as CosmeticId} />
      </p>,
    );
    expect(container.textContent).toBe('Ana');
  });

  it('el ranking del día lo muestra en top y en me', () => {
    const board: DailyLeaderboard = {
      day: '2026-10-29',
      top: [
        {
          rank: 1,
          displayName: 'Ana',
          title: 'titleMedalist',
          balance: 900,
          hands: 30,
          finished: true,
          isMe: false,
        },
        { rank: 2, displayName: 'Beto', balance: 700, hands: 30, finished: true, isMe: false },
      ],
      me: {
        rank: 14,
        displayName: 'Yo',
        title: 'titleRookie',
        balance: 400,
        hands: 30,
        finished: true,
        isMe: true,
      },
    };
    useDailyStore.setState({ board, boardDay: null });
    render(<DailyPanel />);
    expect(screen.getAllByTestId('player-title').map((t) => t.textContent)).toEqual([
      ' · Medallista',
      ' · Novato',
    ]);
  });
});
