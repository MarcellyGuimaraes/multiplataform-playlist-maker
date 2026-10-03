// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SPOTIFY_ORIGIN, createProgressTracker, createSpotifyPlayer, type PlaybackUpdate } from './spotify';
import { spyEvents } from './testEvents';

const u = (position: number, isPaused = false, duration = 200_000): PlaybackUpdate => ({ position, isPaused, duration });

describe('inferência de fim do Spotify', () => {
  it('fim normal: progresso alcança a duração → um único onEnded', () => {
    const ev = spyEvents();
    const t = createProgressTracker(ev);
    [u(0), u(1000), u(100_000), u(199_500), u(200_000, true), u(0, true)].forEach((x) => t.update(x));
    expect(ev.onPlaying).toHaveBeenCalledTimes(1);
    expect(ev.onEnded).toHaveBeenCalledTimes(1);
  });

  it('fim da prévia de 30 s (sem login)', () => {
    const ev = spyEvents();
    const t = createProgressTracker(ev);
    [u(0, false, 30_000), u(15_000, false, 30_000), u(29_400, false, 30_000)].forEach((x) => t.update(x));
    expect(ev.onEnded).toHaveBeenCalledTimes(1);
  });

  it('fim detectado quando volta a 0 pausado logo depois de estar no fim', () => {
    const ev = spyEvents();
    const t = createProgressTracker(ev);
    // último salto antes do fim ficou fora da margem de 1 s, mas dentro da janela final de 5 s
    [u(0), u(196_500)].forEach((x) => t.update(x));
    expect(ev.onEnded).not.toHaveBeenCalled();
    t.update(u(0, true));
    expect(ev.onEnded).toHaveBeenCalledTimes(1);
  });

  it('pausa no meio não é fim', () => {
    const ev = spyEvents();
    const t = createProgressTracker(ev);
    [u(0), u(50_000), u(50_000, true)].forEach((x) => t.update(x));
    expect(ev.onPaused).toHaveBeenCalledTimes(1);
    expect(ev.onEnded).not.toHaveBeenCalled();
  });

  it('seek para o início pausado no meio da faixa não é fim', () => {
    const ev = spyEvents();
    const t = createProgressTracker(ev);
    [u(0), u(80_000), u(0, true)].forEach((x) => t.update(x));
    expect(ev.onEnded).not.toHaveBeenCalled();
  });

  it('eventos repetidos após o fim não disparam de novo; reset rearma', () => {
    const ev = spyEvents();
    const t = createProgressTracker(ev);
    [u(0), u(200_000), u(200_000, true), u(200_000, true)].forEach((x) => t.update(x));
    expect(ev.onEnded).toHaveBeenCalledTimes(1);
    t.reset();
    [u(0), u(200_000)].forEach((x) => t.update(x));
    expect(ev.onEnded).toHaveBeenCalledTimes(2);
  });

  it('duração 0 (ainda carregando) nunca é fim', () => {
    const ev = spyEvents();
    const t = createProgressTracker(ev);
    [u(0, true, 0), u(0, false, 0)].forEach((x) => t.update(x));
    expect(ev.onEnded).not.toHaveBeenCalled();
  });
});

// Adaptador: iframe simples do MVP + mensagens do embed (sem o script da iFrame API).
async function setup() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const events = spyEvents();
  const player = await createSpotifyPlayer(container, events);
  const iframe = () => container.querySelector('iframe')!;
  // No jsdom, trocar o src recria o contentWindow: fixamos uma janela falsa estável para o embed.
  const embedWindow = { postMessage: vi.fn() };
  Object.defineProperty(iframe(), 'contentWindow', { get: () => embedWindow });
  const posted = () => embedWindow.postMessage.mock.calls.map((c) => c[0]);
  const fromEmbed = (data: unknown, origin = SPOTIFY_ORIGIN, source: unknown = embedWindow) => {
    const ev = Object.assign(new Event('message'), { data, origin, source });
    window.dispatchEvent(ev);
  };
  return { container, events, player, iframe, posted, fromEmbed };
}

const track = (id: string) => ({ platform: 'spotify' as const, externalId: id, canonicalUrl: '' });
const A = 'a'.repeat(22);
const B = 'b'.repeat(22);

beforeEach(() => {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});

describe('adaptador Spotify (iframe do MVP)', () => {
  it('não carrega script nenhum e usa a mesma URL do iframe do MVP, com autoplay delegado', async () => {
    const { player, iframe } = await setup();
    player.load(track('4uLU6hMCjMI75M1A2tKUQC'), { autoplay: true });
    expect(document.querySelectorAll('script')).toHaveLength(0);
    expect(iframe().src).toBe('https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC');
    expect(iframe().allow).toContain('autoplay');
    expect(iframe().allow).toContain('encrypted-media');
  });

  it('com autoplay manda play quando o embed avisa ready', async () => {
    const { player, posted, fromEmbed } = await setup();
    player.load(track(A), { autoplay: true });
    expect(posted()).toEqual([]);
    fromEmbed({ type: 'ready' });
    expect(posted()).toEqual([{ command: 'play' }]);
    fromEmbed({ type: 'ready' }); // ready repetido não toca de novo
    expect(posted()).toHaveLength(1);
  });

  it('sem autoplay não manda play', async () => {
    const { player, posted, fromEmbed } = await setup();
    player.load(track(A), { autoplay: false });
    fromEmbed({ type: 'ready' });
    expect(posted()).toEqual([]);
  });

  it('próxima faixa reaproveita o iframe trocando o src e toca após o novo ready', async () => {
    const { player, container, iframe, posted, fromEmbed } = await setup();
    player.load(track(A), { autoplay: true });
    fromEmbed({ type: 'ready' });
    player.load(track(B), { autoplay: true });
    expect(container.querySelectorAll('iframe')).toHaveLength(1);
    expect(iframe().src).toBe(`https://open.spotify.com/embed/track/${B}`);
    expect(posted()).toHaveLength(1);
    fromEmbed({ type: 'ready' });
    expect(posted()).toEqual([{ command: 'play' }, { command: 'play' }]);
  });

  it('mesma faixa de novo (iframe já pronto) manda play_from_start', async () => {
    const { player, posted, fromEmbed } = await setup();
    player.load(track(A), { autoplay: true });
    fromEmbed({ type: 'ready' });
    player.load(track(A), { autoplay: true });
    expect(posted()).toEqual([{ command: 'play' }, { command: 'play_from_start' }]);
  });

  it('playback_update vira onPlaying/onEnded e rearma a cada faixa', async () => {
    const { player, events, fromEmbed } = await setup();
    player.load(track(A), { autoplay: true });
    fromEmbed({ type: 'ready' });
    const send = (d: PlaybackUpdate) => fromEmbed({ type: 'playback_update', payload: d });
    send(u(0));
    send(u(1000));
    send(u(200_000));
    expect(events.onPlaying).toHaveBeenCalledTimes(1);
    expect(events.onEnded).toHaveBeenCalledTimes(1);
    player.load(track(B), { autoplay: true });
    send(u(0));
    send(u(200_000));
    expect(events.onEnded).toHaveBeenCalledTimes(2);
  });

  it('erro irrecuperável do embed vira onError; recuperável é ignorado', async () => {
    const { player, events, fromEmbed } = await setup();
    player.load(track(A), { autoplay: true });
    fromEmbed({ type: 'error', payload: { code: 'playback_error', message: 'x', recoverable: true } });
    expect(events.onError).not.toHaveBeenCalled();
    fromEmbed({ type: 'error', payload: { code: 'playback_error', message: 'indisponível', recoverable: false } });
    expect(events.onError).toHaveBeenCalledWith('spotify:indisponível');
  });

  it('ignora mensagens de outra origem ou de outro iframe', async () => {
    const { player, events, posted, fromEmbed } = await setup();
    player.load(track(A), { autoplay: true });
    fromEmbed({ type: 'ready' }, 'https://evil.example');
    fromEmbed({ type: 'ready' }, SPOTIFY_ORIGIN, window);
    fromEmbed({ type: 'playback_update', payload: u(200_000) }, 'https://evil.example');
    expect(posted()).toEqual([]);
    expect(events.onEnded).not.toHaveBeenCalled();
  });

  it('destroy remove o iframe e para de ouvir mensagens', async () => {
    const { player, container, events, fromEmbed } = await setup();
    player.load(track(A), { autoplay: true });
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    player.destroy();
    expect(container.childElementCount).toBe(0);
    expect(removeSpy).toHaveBeenCalledWith('message', expect.any(Function));
    fromEmbed({ type: 'playback_update', payload: u(200_000) }, SPOTIFY_ORIGIN, null);
    expect(events.onEnded).not.toHaveBeenCalled();
  });
});
