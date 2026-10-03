import { describe, expect, it, vi } from 'vitest';
import { PARSE_ERRORS } from '../../shared/parseTrackUrl.js';
import { resolveShortLink } from './resolveShortLink.js';

const redirect = (location: string) => new Response(null, { status: 302, headers: { location } });

describe('resolveShortLink', () => {
  it('segue o redirecionamento até a faixa canônica via HEAD, sem redirecionamento automático', async () => {
    const fetchMock = vi.fn().mockResolvedValue(redirect('https://soundcloud.com/Artista/Faixa?utm_source=x'));
    const result = await resolveShortLink('https://on.soundcloud.com/AbC', fetchMock);
    expect(result).toEqual({
      kind: 'track',
      platform: 'soundcloud',
      externalId: 'artista/faixa',
      canonicalUrl: 'https://soundcloud.com/artista/faixa',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://on.soundcloud.com/AbC',
      expect.objectContaining({ method: 'HEAD', redirect: 'manual' }),
    );
  });

  it('rejeita quando o redirecionamento leva a um set', async () => {
    const result = await resolveShortLink(
      'https://on.soundcloud.com/AbC',
      vi.fn().mockResolvedValue(redirect('https://soundcloud.com/artista/sets/ep-1')),
    );
    expect(result).toEqual({ kind: 'error', message: PARSE_ERRORS.notTrack });
  });

  it('desiste após 3 saltos', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => redirect('https://on.soundcloud.com/loop'));
    const result = await resolveShortLink('https://on.soundcloud.com/AbC', fetchMock);
    expect(result).toEqual({ kind: 'error', message: PARSE_ERRORS.invalidId });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('rejeita quando não há redirecionamento', async () => {
    const result = await resolveShortLink(
      'https://on.soundcloud.com/AbC',
      vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
    );
    expect(result).toEqual({ kind: 'error', message: PARSE_ERRORS.invalidId });
  });

  it('cai para GET quando HEAD não é permitido', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 405 }))
      .mockResolvedValueOnce(redirect('https://soundcloud.com/a/b'));
    const result = await resolveShortLink('https://on.soundcloud.com/AbC', fetchMock);
    expect(result).toMatchObject({ kind: 'track', externalId: 'a/b' });
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'GET', redirect: 'manual' });
  });

  it('falha de rede vira erro de validação', async () => {
    const result = await resolveShortLink('https://on.soundcloud.com/AbC', vi.fn().mockRejectedValue(new Error('x')));
    expect(result).toEqual({ kind: 'error', message: PARSE_ERRORS.invalidId });
  });
});
