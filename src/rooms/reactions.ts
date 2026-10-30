import type { Reaction } from '@/engine/contract';

/** Catálogo fijo del servidor (no hay chat de texto). */
export const REACTIONS: { id: Reaction; emoji: string; label: string }[] = [
  { id: 'thumbsUp', emoji: '👍', label: 'Bien' },
  { id: 'clap', emoji: '👏', label: 'Aplausos' },
  { id: 'laugh', emoji: '😂', label: 'Risa' },
  { id: 'wow', emoji: '😮', label: 'Sorpresa' },
  { id: 'sad', emoji: '😢', label: 'Pena' },
  { id: 'fire', emoji: '🔥', label: 'En racha' },
  { id: 'cool', emoji: '😎', label: 'Tranquilo' },
  { id: 'gg', emoji: 'GG', label: 'Buena partida' },
];

export const reactionOf = (id: Reaction) => REACTIONS.find((r) => r.id === id);
