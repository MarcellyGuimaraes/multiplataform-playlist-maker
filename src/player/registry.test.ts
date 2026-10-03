// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { spyEvents } from './adapters/testEvents';
import { mountPlayer } from './registry';
import type { PlayerFactories, PlatformPlayer } from './types';

const ok: PlatformPlayer = { load: vi.fn(), destroy: vi.fn() };
const factories = (spotify: PlayerFactories['spotify']): PlayerFactories => ({
  youtube: async () => ok,
  soundcloud: async () => ok,
  spotify,
});

describe('mountPlayer', () => {
  it('usa o adaptador oficial quando o SDK carrega', async () => {
    const r = await mountPlayer(factories(async () => ok), 'spotify', document.createElement('div'), spyEvents());
    expect(r).toEqual({ player: ok, degraded: false });
  });

  it('cai para o iframe simples quando o SDK falha', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const container = document.createElement('div');
    const r = await mountPlayer(
      factories(async () => {
        throw new Error('Tempo esgotado');
      }),
      'spotify',
      container,
      spyEvents(),
    );
    expect(r.degraded).toBe(true);
    r.player.load({ platform: 'spotify', externalId: '4uLU6hMCjMI75M1A2tKUQC', canonicalUrl: '' }, { autoplay: true });
    const iframe = container.querySelector('iframe')!;
    expect(iframe.src).toBe('https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC');
    expect(iframe.allow).toContain('autoplay');
    r.player.destroy();
    expect(container.childElementCount).toBe(0);
  });
});
