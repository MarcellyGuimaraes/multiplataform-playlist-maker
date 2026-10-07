// @vitest-environment jsdom
// Controle de visibilidade na edição, com o fetch simulado.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlaylistDetail } from '../../shared/types';
import { AuthProvider } from '../../src/auth/AuthContext';
import { PlaylistPage } from '../../src/pages/PlaylistPage';
import { PlayerAdapterProvider } from '../../src/player/PlayerAdapterContext';
import { createFakeFactories } from '../../src/player/testing';

const ID = '3f1c2b8e-9a4d-4c6e-8b2a-1d5e7f9a0b3c';
const TOKEN = 'AAAAAAAAAAAAAAAAAAAAAA';
const NOW = '2026-10-02T12:00:00.000Z';
const privatePlaylist: PlaylistDetail = {
  id: ID,
  name: 'Mix',
  visibility: 'private',
  shareToken: null,
  createdAt: NOW,
  updatedAt: NOW,
  tracks: [],
};

let routes: Record<string, (body: unknown) => Response>;
let calls: string[];

beforeEach(() => {
  calls = [];
  routes = { 'GET /api/auth/me': () => Response.json({ user: { id: 'u1', email: 'maria@exemplo.com' } }) };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const key = `${init?.method ?? 'GET'} ${String(input)}`;
      calls.push(key);
      const handler = routes[key];
      return handler
        ? handler(init?.body ? JSON.parse(String(init.body)) : undefined)
        : Response.json({ error: { code: 'not_found', message: '?' } }, { status: 404 });
    }),
  );
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function Where() {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
}

function renderPage() {
  render(
    <PlayerAdapterProvider factories={createFakeFactories().factories}>
      <MemoryRouter initialEntries={[`/p/${ID}`]}>
        <AuthProvider>
          <Routes>
            <Route path="/p/:id" element={<PlaylistPage />} />
            <Route path="*" element={<Where />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </PlayerAdapterProvider>,
  );
}

describe('PlaylistPage — visibilidade', () => {
  it('privada não mostra link; publicar faz o link aparecer; privar o esconde de novo', async () => {
    routes[`GET /api/playlists/${ID}`] = () => Response.json(privatePlaylist);
    routes[`PUT /api/playlists/${ID}/visibility`] = (body) => {
      const { visibility } = body as { visibility: 'public' | 'private' };
      const { tracks: _t, ...rest } = privatePlaylist;
      return Response.json({ ...rest, visibility, shareToken: visibility === 'public' ? TOKEN : null });
    };
    renderPage();

    await screen.findByRole('heading', { name: 'Mix' });
    expect(screen.getByText('Privada')).toBeTruthy();
    expect(screen.queryByLabelText(/Link público/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Copiar link público' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Gerar novo link' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Tornar pública' }));
    const input = (await screen.findByLabelText(/Link público/)) as HTMLInputElement;
    expect(input.value).toBe(`${window.location.origin}/s/${TOKEN}`);
    expect(screen.getByText('Pública')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copiar link público' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Gerar novo link' })).toBeTruthy();
    expect(calls).toContain(`PUT /api/playlists/${ID}/visibility`);

    fireEvent.click(screen.getByRole('button', { name: 'Tornar privada' }));
    await waitFor(() => expect(screen.queryByLabelText(/Link público/)).toBeNull());
    expect(window.confirm).toHaveBeenCalledWith(expect.stringMatching(/deixará de funcionar/));
  });

  it('sem sessão (401) redireciona para o login com volta para a playlist', async () => {
    routes['GET /api/auth/me'] = () => Response.json({ user: null });
    routes[`GET /api/playlists/${ID}`] = () =>
      Response.json({ error: { code: 'unauthorized', message: 'Entre na sua conta para continuar.' } }, { status: 401 });
    renderPage();
    expect((await screen.findByTestId('where')).textContent).toBe(`/entrar?voltar=${encodeURIComponent(`/p/${ID}`)}`);
  });

  it('401 numa ação também leva ao login', async () => {
    routes[`GET /api/playlists/${ID}`] = () => Response.json(privatePlaylist);
    routes[`PUT /api/playlists/${ID}/visibility`] = () =>
      Response.json({ error: { code: 'unauthorized', message: 'Entre na sua conta para continuar.' } }, { status: 401 });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Tornar pública' }));
    expect((await screen.findByTestId('where')).textContent).toMatch(/^\/entrar\?voltar=/);
  });
});
