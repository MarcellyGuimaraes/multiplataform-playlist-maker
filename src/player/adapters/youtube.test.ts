// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetSdkCache } from '../sdk';
import { spyEvents } from './testEvents';
import { YT_STATE, createYouTubePlayer } from './youtube';

type Opts = {
  host?: string;
  playerVars?: Record<string, unknown>;
  events: { onReady(): void; onStateChange(e: { data: number }): void; onError(e: { data: number }): void };
};

let instances: FakePlayer[];
class FakePlayer {
  loadVideoById = vi.fn();
  cueVideoById = vi.fn();
  destroy = vi.fn();
  constructor(
    readonly el: HTMLElement,
    readonly opts: Opts,
  ) {
    instances.push(this);
    queueMicrotask(() => opts.events.onReady());
  }
}

beforeEach(() => {
  resetSdkCache();
  instances = [];
  document.head.innerHTML = '';
  (window as unknown as { YT: unknown }).YT = { loaded: 1, Player: FakePlayer };
});

const track = (id: string) => ({ platform: 'youtube' as const, externalId: id, canonicalUrl: '' });

describe('adaptador YouTube', () => {
  it('cria o player oficial com host nocookie, sem carregar script quando a API já existe', async () => {
    const container = document.createElement('div');
    await createYouTubePlayer(container, spyEvents());
    expect(instances).toHaveLength(1);
    expect(instances[0].opts.host).toBe('https://www.youtube-nocookie.com');
    expect(container.contains(instances[0].el)).toBe(true);
    expect(document.head.querySelectorAll('script')).toHaveLength(0);
  });

  it('autoplay usa loadVideoById; sem autoplay usa cueVideoById; mesma instância entre faixas', async () => {
    const p = await createYouTubePlayer(document.createElement('div'), spyEvents());
    p.load(track('aaaaaaaaaaa'), { autoplay: true });
    p.load(track('bbbbbbbbbbb'), { autoplay: false });
    expect(instances).toHaveLength(1);
    expect(instances[0].loadVideoById).toHaveBeenCalledWith('aaaaaaaaaaa');
    expect(instances[0].cueVideoById).toHaveBeenCalledWith('bbbbbbbbbbb');
  });

  it('mapeia estados e erros', async () => {
    const events = spyEvents();
    await createYouTubePlayer(document.createElement('div'), events);
    const { onStateChange, onError } = instances[0].opts.events;
    onStateChange({ data: YT_STATE.PLAYING });
    onStateChange({ data: YT_STATE.PAUSED });
    onStateChange({ data: 3 }); // buffering: ignorado
    onStateChange({ data: YT_STATE.ENDED });
    onError({ data: 150 });
    expect(events.onPlaying).toHaveBeenCalledTimes(1);
    expect(events.onPaused).toHaveBeenCalledTimes(1);
    expect(events.onEnded).toHaveBeenCalledTimes(1);
    expect(events.onError).toHaveBeenCalledWith('youtube:150');
  });

  it('destroy remove o player do contêiner', async () => {
    const container = document.createElement('div');
    const p = await createYouTubePlayer(container, spyEvents());
    p.destroy();
    expect(instances[0].destroy).toHaveBeenCalled();
    expect(container.childElementCount).toBe(0);
  });

  it('sem API, injeta o script oficial e espera onYouTubeIframeAPIReady', async () => {
    const w = window as unknown as { YT?: unknown; onYouTubeIframeAPIReady?: () => void };
    delete w.YT;
    const pending = createYouTubePlayer(document.createElement('div'), spyEvents());
    const script = document.head.querySelector('script')!;
    expect(script.src).toBe('https://www.youtube.com/iframe_api');
    w.YT = { loaded: 1, Player: FakePlayer };
    w.onYouTubeIframeAPIReady!();
    await pending;
    expect(instances).toHaveLength(1);
  });
});
