// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { SharedTrack } from '../../shared/types';
import { displayName, embedUrl } from '../embed';
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
  it('YouTube: iframe oficial + metadados em cache + link original', () => {
    const { container } = render(<EmbedPlayer track={yt} />);
    const iframes = container.querySelectorAll('iframe');
    expect(iframes).toHaveLength(1);
    expect(iframes[0].getAttribute('src')).toBe(embedUrl(yt));
    expect(screen.getByText('Weird Fishes (ao vivo)')).toBeTruthy();
    expect(screen.getByText(/Radiohead - Weird Fishes Live · Radiohead/)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Abrir no YouTube/ }).getAttribute('href')).toBe(yt.originalUrl);
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('Spotify: mostra o aviso de login e prévia de 30 segundos', () => {
    render(<EmbedPlayer track={sp} />);
    expect(screen.getByRole('note').textContent).toMatch(/login.*30 segundos/s);
  });

  it('SoundCloud: usa a URL canônica mesmo com link curto original', () => {
    const { container } = render(<EmbedPlayer track={sc} />);
    expect(container.querySelector('iframe')!.getAttribute('src')).toContain(encodeURIComponent(sc.canonicalUrl));
  });

  it('trocar de faixa substitui o player (um único ativo)', () => {
    const { container, rerender } = render(<EmbedPlayer track={sp} />);
    rerender(<EmbedPlayer track={yt} />);
    const iframes = container.querySelectorAll('iframe');
    expect(iframes).toHaveLength(1);
    expect(iframes[0].getAttribute('src')).toBe(embedUrl(yt));
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
