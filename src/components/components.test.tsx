// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SharedTrack } from '../../shared/types';
import { displayName, embedUrl } from '../embed';
import { PlayerAdapterProvider } from '../player/PlayerAdapterContext';
import { createFakeFactories } from '../player/testing';
import type { LoadRequest } from '../player/usePlayback';
import { EmbedPlayer } from './EmbedPlayer';
import { TrackList } from './TrackList';

afterEach(cleanup);

const base = { label: '', title: null, artist: null, thumbnailUrl: null, position: 0 };
const yt: SharedTrack = {
  ...base,
  platform: 'youtube',
  externalId: 'dQw4w9WgXcQ',
  originalUrl: 'https://youtu.be/dQw4w9WgXcQ',
  canonicalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  label: 'Weird Fishes (ao vivo)',
  title: 'Radiohead - Weird Fishes Live',
  artist: 'Radiohead',
  thumbnailUrl: 'https://i.ytimg.com/vi/x/hq.jpg',
};
const sp: SharedTrack = {
  ...base,
  platform: 'spotify',
  externalId: '4uLU6hMCjMI75M1A2tKUQC',
  originalUrl: 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC',
  canonicalUrl: 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC',
  position: 1,
};
const sc: SharedTrack = {
  ...base,
  platform: 'soundcloud',
  externalId: 'artista/faixa',
  originalUrl: 'https://on.soundcloud.com/AbC',
  canonicalUrl: 'https://soundcloud.com/artista/faixa',
  title: 'Faixa',
  position: 2,
};

describe('embedUrl', () => {
  it('monta as URLs dos players oficiais, sem autoplay', () => {
    expect(embedUrl(yt)).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0');
    expect(embedUrl(sp)).toBe('https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC');
    expect(embedUrl(sc)).toBe(
      'https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fartista%2Ffaixa&auto_play=false&visual=false',
    );
    for (const t of [yt, sp, sc]) expect(embedUrl(t)).not.toMatch(/autoplay=1|auto_play=true/);
  });
});

describe('displayName', () => {
  it('prioriza rótulo, depois título, depois URL', () => {
    expect(displayName(yt)).toBe('Weird Fishes (ao vivo)');
    expect(displayName(sc)).toBe('Faixa');
    expect(displayName(sp)).toBe(sp.originalUrl);
  });
});

describe('EmbedPlayer', () => {
  let nonce = 0;
  const req = (id: string): LoadRequest => ({ id, autoplay: true, nonce: ++nonce });
  const noop = { onPlaying() {}, onPaused() {}, onEnded() {}, onError() {} };

  function renderPlayer(track: SharedTrack, extra: Partial<Parameters<typeof EmbedPlayer>[0]> = {}) {
    const fake = createFakeFactories();
    const ui = (t: SharedTrack, e = extra) => (
      <PlayerAdapterProvider factories={fake.factories}>
        <EmbedPlayer track={t} request={req(t.externalId)} events={noop} {...e} />
      </PlayerAdapterProvider>
    );
    const r = render(ui(track));
    return { ...r, fake, rerenderTrack: (t: SharedTrack, e?: typeof extra) => r.rerender(ui(t, e)) };
  }

  it('YouTube: monta o player e carrega a faixa; metadados em cache + link original', async () => {
    const { container, fake } = renderPlayer(yt);
    await waitFor(() => expect(container.querySelector('iframe')?.getAttribute('src')).toBe(embedUrl(yt)));
    expect(fake.loads()).toEqual([{ platform: 'youtube', action: 'load', id: yt.externalId, autoplay: true }]);
    expect(screen.getByText('Weird Fishes (ao vivo)')).toBeTruthy();
    expect(screen.getByText(/Radiohead - Weird Fishes Live · Radiohead/)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Abrir no YouTube/ }).getAttribute('href')).toBe(yt.originalUrl);
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('Spotify: mostra o aviso de login e prévia de 30 segundos', () => {
    renderPlayer(sp);
    expect(screen.getByRole('note').textContent).toMatch(/login.*30 segundos/s);
  });

  it('SoundCloud: o player recebe a URL canônica mesmo com link curto original', async () => {
    const { container } = renderPlayer(sc);
    await waitFor(() =>
      expect(container.querySelector('iframe')?.getAttribute('src')).toContain(encodeURIComponent(sc.canonicalUrl)),
    );
  });

  it('trocar de plataforma destrói o player anterior (um único ativo)', async () => {
    const { container, fake, rerenderTrack } = renderPlayer(sp);
    await waitFor(() => expect(fake.loads()).toHaveLength(1));
    rerenderTrack(yt);
    await waitFor(() => expect(fake.loads()).toHaveLength(2));
    expect(fake.log.map((e) => `${e.platform}:${e.action}`)).toEqual([
      'spotify:mount', 'spotify:load', 'spotify:destroy', 'youtube:mount', 'youtube:load',
    ]);
    expect(container.querySelectorAll('iframe')).toHaveLength(1);
  });

  it('mesma plataforma reaproveita o player', async () => {
    const yt2 = { ...yt, externalId: 'aaaaaaaaaaa', label: 'outra' };
    const { fake, rerenderTrack } = renderPlayer(yt);
    await waitFor(() => expect(fake.loads()).toHaveLength(1));
    rerenderTrack(yt2);
    await waitFor(() => expect(fake.loads()).toHaveLength(2));
    expect(fake.log.filter((e) => e.action === 'mount')).toHaveLength(1);
    expect(fake.log.some((e) => e.action === 'destroy')).toBe(false);
  });

  it('avisos de indisponível, bloqueado e fim', () => {
    const { rerenderTrack } = renderPlayer(yt, { status: 'unavailable', autoplay: true });
    expect(screen.getByRole('status').textContent).toMatch(/indisponível.*Pulando/);
    rerenderTrack(yt, { status: 'blocked' });
    expect(screen.getByRole('status').textContent).toMatch(/bloqueou o início automático/);
    rerenderTrack(yt, { status: 'playing' });
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('SDK indisponível: cai para iframe simples e avisa', async () => {
    const failing = createFakeFactories();
    failing.factories.youtube = async () => {
      throw new Error('falhou');
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = render(
      <PlayerAdapterProvider factories={failing.factories}>
        <EmbedPlayer track={yt} request={req('x')} events={noop} />
      </PlayerAdapterProvider>,
    );
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/avance as faixas manualmente/));
    expect(container.querySelector('iframe')!.getAttribute('src')).toBe(embedUrl(yt));
    warn.mockRestore();
  });
});

describe('TrackList somente leitura', () => {
  it('não exibe nenhum controle de edição, apenas tocar', () => {
    render(<TrackList tracks={[yt, sp, sc]} currentIndex={null} onPlay={() => {}} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(3);
    for (const b of buttons) expect(b.textContent).toBe('Tocar');
    expect(screen.queryByRole('button', { name: /Remover|Subir|Descer|rótulo/i })).toBeNull();
  });

  it('mostra plataforma e link original de cada faixa', () => {
    render(<TrackList tracks={[yt, sp, sc]} currentIndex={1} onPlay={() => {}} />);
    const items = screen.getAllByRole('listitem');
    expect(within(items[0]).getByText('YouTube')).toBeTruthy();
    expect(within(items[1]).getByText('Spotify')).toBeTruthy();
    expect(within(items[2]).getByText('SoundCloud')).toBeTruthy();
    expect(within(items[2]).getByRole('link', { name: 'link original' }).getAttribute('href')).toBe(sc.originalUrl);
    expect(within(items[1]).getByRole('button', { name: /Tocando/ }).getAttribute('aria-pressed')).toBe('true');
  });

  it('estado vazio', () => {
    render(<TrackList tracks={[]} currentIndex={null} onPlay={() => {}} emptyState="Sem faixas." />);
    expect(screen.getByText('Sem faixas.')).toBeTruthy();
  });
});
