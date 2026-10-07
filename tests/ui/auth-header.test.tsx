// @vitest-environment jsdom
// Sessão no front: AuthProvider carrega /api/auth/me e o cabeçalho mostra Entrar ou e-mail + Sair.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../../src/auth/AuthContext';
import { SiteHeader } from '../../src/components/SiteHeader';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderHeader(me: unknown) {
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const path = String(input);
    if (path === '/api/auth/me') return Response.json(me);
    if (path === '/api/auth/logout' && init?.method === 'POST') return new Response(null, { status: 204 });
    return Response.json({ error: { code: 'not_found', message: 'x' } }, { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  render(
    <MemoryRouter>
      <AuthProvider>
        <SiteHeader />
      </AuthProvider>
    </MemoryRouter>,
  );
  return fetchMock;
}

describe('cabeçalho de sessão', () => {
  it('visitante vê "Entrar" levando ao login', async () => {
    const fetchMock = renderHeader({ user: null });
    const link = await screen.findByRole('link', { name: 'Entrar' });
    expect(link.getAttribute('href')).toBe('/entrar');
    expect(screen.queryByRole('button', { name: 'Sair' })).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/me', expect.objectContaining({ method: 'GET' }));
  });

  it('logada vê o e-mail e "Sair"; sair volta a mostrar "Entrar"', async () => {
    const fetchMock = renderHeader({ user: { id: 'u1', email: 'maria@exemplo.com' } });
    expect(await screen.findByText('maria@exemplo.com')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Entrar' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));
    expect(await screen.findByRole('link', { name: 'Entrar' })).toBeTruthy();
    expect(screen.queryByText('maria@exemplo.com')).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({ method: 'POST' }));
  });

  it('enquanto a sessão carrega, não mostra nenhum dos dois', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    render(
      <MemoryRouter>
        <AuthProvider>
          <SiteHeader />
        </AuthProvider>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText('Playlist Multiplataforma')).toBeTruthy());
    expect(screen.queryByRole('link', { name: 'Entrar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sair' })).toBeNull();
  });
});
