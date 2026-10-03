import { createContext, useContext, type ReactNode } from 'react';
import { defaultFactories } from './registry';
import type { PlayerFactories } from './types';

const PlayerAdapterContext = createContext<PlayerFactories>(defaultFactories);

/** Permite trocar os adaptadores de player (ex.: adaptadores falsos nos testes). */
export function PlayerAdapterProvider({ factories, children }: { factories: PlayerFactories; children: ReactNode }) {
  return <PlayerAdapterContext.Provider value={factories}>{children}</PlayerAdapterContext.Provider>;
}

export const usePlayerFactories = () => useContext(PlayerAdapterContext);
