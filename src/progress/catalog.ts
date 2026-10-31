// Nombres, descripciones e iconos de los logros y los cosméticos. El servidor decide cuándo
// se cumple cada logro y qué cosmético se tiene; aquí solo se pone cómo se llaman y se ven.
import {
  Brain,
  CalendarCheck,
  Crown,
  Coins,
  Medal,
  Scale,
  Scissors,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import type { AchievementId, CosmeticId, CosmeticSlot, EquippedCosmetics } from '@/engine/contract';

export interface AchievementInfo {
  name: string;
  description: string;
  icon: LucideIcon;
}

/** En el orden en que se muestran: de los primeros pasos a los de temporada. */
export const ACHIEVEMENTS: Record<AchievementId, AchievementInfo> = {
  firstWin: {
    name: 'Primera victoria',
    description: 'Gana una ronda contra el servidor.',
    icon: Trophy,
  },
  blackjack: { name: '¡Blackjack!', description: 'Saca un blackjack natural.', icon: Sparkles },
  perfectSplit: {
    name: 'Divide y vencerás',
    description: 'Divide y gana todas las manos de la ronda.',
    icon: Scissors,
  },
  doubleUp: {
    name: 'Doble o nada',
    description: 'Llega a 1.000 fichas en una partida casual.',
    icon: Coins,
  },
  sixToFiveSurvivor: {
    name: 'Superviviente del 6:5',
    description: 'Llega a 50 manos en una partida casual que paga 6:5.',
    icon: Shield,
  },
  optimal10: {
    name: 'Cabeza fría',
    description: '10 decisiones óptimas seguidas en Ranked o el reto diario.',
    icon: Brain,
  },
  optimal50: {
    name: 'Jugador de libro',
    description: '50 decisiones óptimas seguidas en Ranked o el reto diario.',
    icon: Scale,
  },
  dailyComplete: {
    name: 'Reto cumplido',
    description: 'Juega las 30 manos del reto diario.',
    icon: CalendarCheck,
  },
  rankedQualified: {
    name: 'Clasificado',
    description: 'Juega 200 manos en una temporada ranked.',
    icon: Swords,
  },
  rankedMedal: {
    name: 'Medallista',
    description: 'Termina una temporada ranked con medalla.',
    icon: Medal,
  },
  tournamentWin: {
    name: 'Campeón',
    description: 'Gana un torneo en una sala.',
    icon: Crown,
  },
};

export const ACHIEVEMENT_IDS = Object.keys(ACHIEVEMENTS) as AchievementId[];

/** Un id que el front todavía no conoce (logro nuevo del backend) se ignora. */
export const isKnownAchievement = (id: string): id is AchievementId => id in ACHIEVEMENTS;

export const SLOTS: { slot: CosmeticSlot; name: string }[] = [
  { slot: 'felt', name: 'Paño' },
  { slot: 'cardBack', name: 'Dorso de las cartas' },
  { slot: 'chips', name: 'Fichas' },
  { slot: 'title', name: 'Título' },
];

export const COSMETICS: Record<CosmeticId, { name: string; slot: CosmeticSlot }> = {
  feltGreen: { name: 'Verde clásico', slot: 'felt' },
  feltBlue: { name: 'Azul', slot: 'felt' },
  feltRed: { name: 'Rojo', slot: 'felt' },
  feltBlack: { name: 'Negro', slot: 'felt' },
  backClassic: { name: 'Clásico', slot: 'cardBack' },
  backGold: { name: 'Dorado', slot: 'cardBack' },
  backMidnight: { name: 'Medianoche', slot: 'cardBack' },
  chipsClassic: { name: 'Clásicas', slot: 'chips' },
  chipsNeon: { name: 'Neón', slot: 'chips' },
  chipsGold: { name: 'Doradas', slot: 'chips' },
  titleRookie: { name: 'Novato', slot: 'title' },
  titleCoolHead: { name: 'Cabeza fría', slot: 'title' },
  titleByTheBook: { name: 'De libro', slot: 'title' },
  titleMedalist: { name: 'Medallista', slot: 'title' },
  titleChampion: { name: 'Campeón', slot: 'title' },
};

export const isKnownCosmetic = (id: string): id is CosmeticId => id in COSMETICS;

/** Lo de serie: sin sesión (o hasta que llegue lo del servidor) la mesa se ve así. */
export const DEFAULT_EQUIPPED: EquippedCosmetics = {
  felt: 'feltGreen',
  cardBack: 'backClassic',
  chips: 'chipsClassic',
  title: null,
};

/** El valor de `data-felt`, `data-back` y `data-chips` en <html> (ver index.css). */
export const themeKey = (id: CosmeticId) => id.replace(/^(felt|back|chips)/, '').toLowerCase();

export const titleName = (id: CosmeticId | null) => (id ? (COSMETICS[id]?.name ?? null) : null);
