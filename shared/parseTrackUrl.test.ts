import { describe, expect, it } from 'vitest';
import { PARSE_ERRORS, parseTrackUrl } from './parseTrackUrl.js';

const track = (platform: string, externalId: string) =>
  expect.objectContaining({ kind: 'track', platform, externalId });

describe('YouTube', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=PL123', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?si=abc', 'dQw4w9WgXcQ'],
    ['https://youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://m.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://music.youtube.com/watch?v=dQw4w9WgXcQ&feature=share', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/shorts/aBcD3fGh_-1', 'aBcD3fGh_-1'],
    ['https://www.youtube.com/live/aBcD3fGh_-1?si=x', 'aBcD3fGh_-1'],
    ['https://www.youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['  youtu.be/dQw4w9WgXcQ  ', 'dQw4w9WgXcQ'],
    ['http://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
  ])('%s → %s', (input, id) => {
    expect(parseTrackUrl(input)).toEqual(track('youtube', id));
  });

  it('gera URL canônica', () => {
    expect(parseTrackUrl('https://youtu.be/dQw4w9WgXcQ')).toMatchObject({
      canonicalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    });
  });

  it.each([
    'https://www.youtube.com/watch?v=curto',
    'https://www.youtube.com/watch?list=PL123',
    'https://youtu.be/',
    'https://www.youtube.com/',
  ])('rejeita id ausente ou inválido: %s', (input) => {
    expect(parseTrackUrl(input)).toEqual({ kind: 'error', message: PARSE_ERRORS.invalidId });
  });

  it.each(['https://www.youtube.com/playlist?list=PL123', 'https://www.youtube.com/@artista'])(
    'rejeita o que não é vídeo: %s',
    (input) => {
      expect(parseTrackUrl(input)).toEqual({ kind: 'error', message: PARSE_ERRORS.notTrack });
    },
  );
});

describe('Spotify', () => {
  it.each([
    ['https://open.spotify.com/intl-pt/track/4uLU6hMCjMI75M1A2tKUQC?si=xyz', '4uLU6hMCjMI75M1A2tKUQC'],
    ['https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC', '4uLU6hMCjMI75M1A2tKUQC'],
    ['https://open.spotify.com/intl-pt-br/track/4uLU6hMCjMI75M1A2tKUQC', '4uLU6hMCjMI75M1A2tKUQC'],
    ['spotify:track:4uLU6hMCjMI75M1A2tKUQC', '4uLU6hMCjMI75M1A2tKUQC'],
  ])('%s → %s', (input, id) => {
    expect(parseTrackUrl(input)).toEqual(track('spotify', id));
  });

  it('gera URL canônica', () => {
    expect(parseTrackUrl('spotify:track:4uLU6hMCjMI75M1A2tKUQC')).toMatchObject({
      canonicalUrl: 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC',
    });
  });

  it.each([
    'https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3',
    'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
    'https://open.spotify.com/artist/0OdUWJ0sBjDrqHygGUXeCF',
    'https://open.spotify.com/episode/512ojhOuo1ktJprKbVcKyQ',
    'https://open.spotify.com/show/2MAi0BvDc6GTFvKFPXnkCL',
    'https://open.spotify.com/intl-pt/album/1DFixLWuPkv3KT3TnV35m3',
    'spotify:album:1DFixLWuPkv3KT3TnV35m3',
  ])('rejeita o que não é faixa: %s', (input) => {
    expect(parseTrackUrl(input)).toEqual({ kind: 'error', message: PARSE_ERRORS.notTrack });
  });

  it('rejeita id com tamanho errado', () => {
    expect(parseTrackUrl('https://open.spotify.com/track/abc')).toEqual({
      kind: 'error',
      message: PARSE_ERRORS.invalidId,
    });
  });
});

describe('SoundCloud', () => {
  it.each([
    ['https://soundcloud.com/Artista-Pequeno/demo-2024?in=foo', 'artista-pequeno/demo-2024'],
    ['https://www.soundcloud.com/artista/faixa_1/', 'artista/faixa_1'],
    ['https://m.soundcloud.com/artista/faixa', 'artista/faixa'],
  ])('%s → %s', (input, id) => {
    expect(parseTrackUrl(input)).toEqual(track('soundcloud', id));
  });

  it('gera URL canônica em minúsculas', () => {
    expect(parseTrackUrl('https://soundcloud.com/Artista/Faixa')).toMatchObject({
      canonicalUrl: 'https://soundcloud.com/artista/faixa',
    });
  });

  it('sinaliza link curto para resolução no servidor', () => {
    expect(parseTrackUrl('https://on.soundcloud.com/AbC123')).toEqual({
      kind: 'short-link',
      platform: 'soundcloud',
      url: 'https://on.soundcloud.com/AbC123',
    });
  });

  it.each([
    'https://soundcloud.com/artista/sets/ep-1',
    'https://soundcloud.com/artista',
    'https://soundcloud.com/artista/likes',
    'https://soundcloud.com/artista/reposts',
    'https://soundcloud.com/artista/tracks',
    'https://soundcloud.com/discover/sets/charts-top',
    'https://soundcloud.com/search/sounds',
  ])('rejeita o que não é faixa: %s', (input) => {
    expect(parseTrackUrl(input)).toEqual({ kind: 'error', message: PARSE_ERRORS.notTrack });
  });
});

describe('entradas inválidas', () => {
  it.each([
    ['', PARSE_ERRORS.empty],
    ['   ', PARSE_ERRORS.empty],
    ['radiohead weird fishes', PARSE_ERRORS.notUrl],
    ['ftp://youtube.com/watch?v=dQw4w9WgXcQ', PARSE_ERRORS.notUrl],
    ['https://www.deezer.com/track/12345', PARSE_ERRORS.unsupported],
    ['https://evil-youtube.com/watch?v=dQw4w9WgXcQ', PARSE_ERRORS.unsupported],
    ['https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ', PARSE_ERRORS.unsupported],
    [`https://youtu.be/dQw4w9WgXcQ?x=${'a'.repeat(2048)}`, PARSE_ERRORS.tooLong],
  ])('%j → erro', (input, message) => {
    expect(parseTrackUrl(input)).toEqual({ kind: 'error', message });
  });

  it('mensagens de erro estão em pt-BR', () => {
    expect(PARSE_ERRORS.unsupported).toMatch(/YouTube, Spotify e SoundCloud/);
  });
});
