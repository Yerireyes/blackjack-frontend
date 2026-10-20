import { create } from 'zustand';
import { DEFAULT_PRESET, presetRules, type PresetId, type Rules } from '@/domain/rules';

export interface RulesState {
  rules: Rules;
  preset: PresetId | 'custom';
  /**
   * Cambia las reglas. Solo el orquestador (`store/actions.ts → applyRules`) debe
   * llamarla, porque toda regla nueva reinicia el zapato y la mesa.
   */
  setRules(rules: Rules, preset: PresetId | 'custom'): void;
}

export const useRulesStore = create<RulesState>()((set) => ({
  rules: presetRules(DEFAULT_PRESET),
  preset: DEFAULT_PRESET,
  setRules: (rules, preset) => set({ rules: { ...rules }, preset }),
}));

export const currentRules = () => useRulesStore.getState().rules;
