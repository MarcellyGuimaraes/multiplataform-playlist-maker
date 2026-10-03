import { describe, expect, it, vi } from 'vitest';
import { EMPTY_METADATA, fetchMetadata } from './oembed.js';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('fetchMetadata', () => {
  it('mapeia título, autor e thumbnail do oEmbed do SoundCloud', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      json({ title: 'Demo 2024', author_name: 'Artista Pequeno', thumbnail_url: 'https://i1.sndcdn.com/a.jpg' }),
    );
    const meta = await fetchMetadata({ platform: 'soundcloud', canonicalUrl: 'https://soundcloud.com/a/b' }, fetchMock);
    expect(meta).toEqual({ title: 'Demo 2024', artist: 'Artista Pequeno', thumbnailUrl: 'https://i1.sndcdn.com/a.jpg' });
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://soundcloud.com/oembed?format=json&url=https%3A%2F%2Fsoundcloud.com%2Fa%2Fb',
    );
  });

  it('usa os endpoints do YouTube e do Spotify', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => json({ title: 'x' }));
    await fetchMetadata({ platform: 'youtube', canonicalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }, fetchMock);
    await fetchMetadata({ platform: 'spotify', canonicalUrl: 'https://open.spotify.com/track/abc' }, fetchMock);
    expect(fetchMock.mock.calls[0][0]).toMatch(/^https:\/\/www\.youtube\.com\/oembed\?format=json&url=/);
    expect(fetchMock.mock.calls[1][0]).toMatch(/^https:\/\/open\.spotify\.com\/oembed\?url=/);
  });

  it('Spotify sem autor resulta em artista nulo', async () => {
    const meta = await fetchMetadata(
      { platform: 'spotify', canonicalUrl: 'https://open.spotify.com/track/abc' },
      vi.fn().mockResolvedValue(json({ title: 'Weird Fishes', thumbnail_url: 'https://i.scdn.co/x' })),
    );
    expect(meta).toEqual({ title: 'Weird Fishes', artist: null, thumbnailUrl: 'https://i.scdn.co/x' });
  });

  it('descarta thumbnail que não é https', async () => {
    const meta = await fetchMetadata(
      { platform: 'youtube', canonicalUrl: 'u' },
      vi.fn().mockResolvedValue(json({ title: 't', thumbnail_url: 'javascript:alert(1)' })),
    );
    expect(meta.thumbnailUrl).toBeNull();
  });

  it('erro HTTP resulta em metadados vazios', async () => {
    const meta = await fetchMetadata(
      { platform: 'youtube', canonicalUrl: 'u' },
      vi.fn().mockResolvedValue(json({ error: 'Not Found' }, 404)),
    );
    expect(meta).toEqual(EMPTY_METADATA);
  });

  it('falha de rede resulta em metadados vazios', async () => {
    const meta = await fetchMetadata(
      { platform: 'youtube', canonicalUrl: 'u' },
      vi.fn().mockRejectedValue(new TypeError('fetch failed')),
    );
    expect(meta).toEqual(EMPTY_METADATA);
  });

  it('timeout resulta em metadados vazios', async () => {
    const neverResolves = (_url: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    const meta = await fetchMetadata({ platform: 'youtube', canonicalUrl: 'u' }, neverResolves as typeof fetch, 20);
    expect(meta).toEqual(EMPTY_METADATA);
  });
});
