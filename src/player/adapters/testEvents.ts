// Utilitário de teste: eventos de player com spies.
import { vi } from 'vitest';
import type { PlayerEvents } from '../types';

export function spyEvents() {
  return {
    onPlaying: vi.fn(),
    onPaused: vi.fn(),
    onEnded: vi.fn(),
    onError: vi.fn(),
  } satisfies PlayerEvents;
}
