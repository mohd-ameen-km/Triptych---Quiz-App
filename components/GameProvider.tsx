'use client';

/**
 * GameContext — React Context + Provider for the quiz game state.
 *
 * Wraps the game reducer in a context so any component in the tree
 * can read state and dispatch actions. Automatically:
 *   - Rehydrates from localStorage on mount
 *   - Persists to localStorage on every dispatch
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
} from 'react';
import type { GameAction, GameState } from '@/types';
import {
  createInitialState,
  gameReducer,
  loadState,
  saveState,
} from '@/lib/gameReducer';

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface GameContextValue {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

const GameContext = createContext<GameContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, rawDispatch] = useReducer(
    gameReducer,
    undefined,
    createInitialState,
  );
  const hydrated = useRef(false);

  // ── Rehydrate from localStorage on first client mount ─────────────
  useEffect(() => {
    const saved = loadState();
    if (saved) {
      rawDispatch({ type: 'HYDRATE', payload: saved });
    }
    hydrated.current = true;
  }, []);

  // ── Persist to localStorage whenever state changes (after hydration) ─
  useEffect(() => {
    if (hydrated.current) {
      saveState(state);
    }
  }, [state]);

  // ── Wrapped dispatch (for future middleware hooks if needed) ───────
  const dispatch = useCallback((action: GameAction) => {
    rawDispatch(action);
  }, []);

  const value: GameContextValue = { state, dispatch };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Access the game state and dispatch from any component.
 *
 * @throws if used outside of a `<GameProvider>`.
 */
export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error('useGame() must be used within a <GameProvider>.');
  }
  return ctx;
}
