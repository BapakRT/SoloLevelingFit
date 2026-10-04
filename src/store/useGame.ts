import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addPenaltyProgress,
  addQuestProgress,
  allocateStat,
  completeOnboarding,
  createInitialState,
  equipTitle,
  evaluateDay,
  logTraining,
  renamePlayer,
  updateSettings,
} from '@/engine/game';
import { migrateSave, parseBackup } from '@/engine/migrate';
import type {
  CardioMode,
  EngineResult,
  GameEvent,
  GameState,
  PenaltyItemId,
  QuestItemId,
  QuestLevel,
  Settings,
  StatKey,
} from '@/engine/types';

interface GameStore {
  game: GameState;
  /** System pop-ups waiting to be shown, oldest first. Not persisted. */
  events: GameEvent[];

  evaluate: () => void;
  onboard: (input: { name: string; questLevel: QuestLevel; cardioMode: CardioMode }) => void;
  addQuest: (id: QuestItemId, delta: number) => void;
  addPenalty: (id: PenaltyItemId, delta: number) => void;
  train: (exerciseId: string, amount: number) => { xp: number; statGain: number };
  allocate: (stat: StatKey) => void;
  equip: (titleId: string) => void;
  rename: (name: string) => void;
  setSettings: (patch: Partial<Settings>) => void;
  dismissEvent: () => void;
  exportBackup: () => string;
  importBackup: (json: string) => boolean;
  reset: () => void;
}

export const useGame = create<GameStore>()(
  persist(
    (set, get) => {
      const apply = ({ state, events }: EngineResult) => {
        if (state === get().game && events.length === 0) return;
        set((s) => ({ game: state, events: [...s.events, ...events] }));
      };

      return {
        game: createInitialState(),
        events: [],

        evaluate: () => apply(evaluateDay(get().game, new Date())),
        onboard: (input) => apply(completeOnboarding(get().game, input, new Date())),
        addQuest: (id, delta) => apply(addQuestProgress(get().game, id, delta, new Date())),
        addPenalty: (id, delta) => apply(addPenaltyProgress(get().game, id, delta, new Date())),
        train: (exerciseId, amount) => {
          const result = logTraining(get().game, exerciseId, amount, new Date());
          apply(result);
          return { xp: result.xp, statGain: result.statGain };
        },
        allocate: (stat) => set({ game: allocateStat(get().game, stat) }),
        equip: (titleId) => set({ game: equipTitle(get().game, titleId) }),
        rename: (name) => set({ game: renamePlayer(get().game, name) }),
        setSettings: (patch) => set({ game: updateSettings(get().game, patch) }),
        dismissEvent: () => set((s) => ({ events: s.events.slice(1) })),
        exportBackup: () => JSON.stringify(get().game),
        importBackup: (json) => {
          const restored = parseBackup(json);
          if (!restored) return false;
          set({ game: restored, events: [] });
          get().evaluate();
          return true;
        },
        reset: () => set({ game: createInitialState(), events: [] }),
      };
    },
    {
      name: 'solo-leveling-system',
      // Keep at 2: save upgrades happen in merge() via migrateSave. Bumping this without a
      // zustand `migrate` option would make zustand drop the stored save entirely.
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ game: s.game }),
      // Hydrated manually from the client so the static web export never touches storage at build time.
      skipHydration: true,
      merge: (persisted, current) => {
        const game = migrateSave((persisted as { game?: unknown } | undefined)?.game);
        return game ? { ...current, game } : current;
      },
    }
  )
);

export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useGame.persist.hasHydrated());
  useEffect(() => {
    const unsubscribe = useGame.persist.onFinishHydration(() => setHydrated(true));
    if (!useGame.persist.hasHydrated()) useGame.persist.rehydrate();
    else setHydrated(true);
    return unsubscribe;
  }, []);
  return hydrated;
}
