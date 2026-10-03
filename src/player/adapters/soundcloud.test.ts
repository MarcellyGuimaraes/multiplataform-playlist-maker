// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetSdkCache } from '../sdk';
import { createSoundCloudPlayer } from './soundcloud';
import { spyEvents } from './testEvents';

const Events = { PLAY: 'play', PAUSE: 'pause', FINISH: 'finish', ERROR: 'error' };
let widgets: { iframe: HTMLIFrameElement; handlers: Record<string, () => void>; load: ReturnType<typeof vi.fn> }[];

function installSC() {
  const Widget = Object.assign(
    (iframe: HTMLIFrameElement) => {
      const w = { iframe, handlers: {} as Record<string, () => void>, load: vi.fn() };
      widgets.push(w);
      return { bind: (ev: string, cb: () => void) => (w.handlers[ev] = cb), load: w.load };
    },
    { Events },
  );
  (window as unknown as { SC: unknown }).SC = { Widget };
}

beforeEach(() => {
  resetSdkCache();
  widgets = [];
  document.head.innerHTML = '';
  installSC();
});

const track = (path: string) => ({
  platform: 'soundcloud' as const,
  externalId: path,
  canonicalUrl: `https://soundcloud.com/${path}`,
});

describe('adaptador SoundCloud', () => {
  it('primeira faixa cria o iframe oficial com allow=autoplay e auto_play conforme pedido', async () => {
    const container = document.createElement('div');
    const p = await createSoundCloudPlayer(container, spyEvents());
    p.load(track('a/b'), { autoplay: true });
    const iframe = container.querySelector('iframe')!;
    expect(iframe.src).toBe(
      'https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fa%2Fb&auto_play=true&visual=false',
    );
    expect(iframe.allow).toContain('autoplay');
    expect(widgets).toHaveLength(1);
  });

  it('faixas seguintes reaproveitam o mesmo widget via load()', async () => {
    const container = document.createElement('div');
    const p = await createSoundCloudPlayer(container, spyEvents());
    p.load(track('a/b'), { autoplay: false });
    p.load(track('c/d'), { autoplay: true });
    expect(container.querySelectorAll('iframe')).toHaveLength(1);
    expect(widgets).toHaveLength(1);
    expect(widgets[0].load).toHaveBeenCalledWith('https://soundcloud.com/c/d', { auto_play: true, visual: false });
  });

  it('mapeia PLAY/PAUSE/FINISH/ERROR', async () => {
    const events = spyEvents();
    const p = await createSoundCloudPlayer(document.createElement('div'), events);
    p.load(track('a/b'), { autoplay: true });
    const h = widgets[0].handlers;
    h.play();
    h.pause();
    h.finish();
    h.error();
    expect(events.onPlaying).toHaveBeenCalledTimes(1);
    expect(events.onPaused).toHaveBeenCalledTimes(1);
    expect(events.onEnded).toHaveBeenCalledTimes(1);
    expect(events.onError).toHaveBeenCalledWith('soundcloud:error');
  });

  it('destroy remove o iframe', async () => {
    const container = document.createElement('div');
    const p = await createSoundCloudPlayer(container, spyEvents());
    p.load(track('a/b'), { autoplay: true });
    p.destroy();
    expect(container.childElementCount).toBe(0);
  });

  it('sem API, carrega o script oficial do widget', async () => {
    delete (window as unknown as { SC?: unknown }).SC;
    const pending = createSoundCloudPlayer(document.createElement('div'), spyEvents());
    const script = document.head.querySelector('script')!;
    expect(script.src).toBe('https://w.soundcloud.com/player/api.js');
    installSC();
    script.onload!(new Event('load'));
    await expect(pending).resolves.toBeDefined();
  });
});
