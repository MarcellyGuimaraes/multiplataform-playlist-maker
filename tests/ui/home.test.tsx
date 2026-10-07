// @vitest-environment jsdom
// Tela inicial por sessão, com o fetch simulado.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser, PlaylistList } from '../../shared/types';
import { AuthProvider } from '../../src/auth/AuthContext';
import { HomePage } from '../../src/pages/HomePage';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const NOW = '2026-10-02T12:00:00.000Z';

function Where() {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
}

function renderHome(user: AuthUser | null, list: PlaylistList) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request) => {
      const path = String(input);
      if (path === '/api/auth/me') return Response.json({ user });
      if (path === '/api/playlists') return Response.json(list);
      return Response.json({ error: { code: 'not_found', message: '?' } }, { status: 404 });
    }),
  );
  render(
    <MemoryRouter initialEntries={['/']}>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('HomePage — visitante', () => {
  it('vê as públicas com link /s/:token, sem formulário de criação; "Criar" leva ao login', async () => {
    renderHome(null, {
      mine: [],
      public: [{ name: 'Pública de Ana', trackCount: 1, updatedAt: NOW, shareToken: 'AAAAAAAAAAAAAAAAAAAAAA' }],
    });
    const link = await screen.findByRole('link', { name: /Pública de Ana/ });
    expect(link.getAttribute('href')).toBe('/s/AAAAAAAAAAAAAAAAAAAAAA');
    expect(link.textContent).toMatch(/1 faixa/);
    expect(screen.queryByLabelText('Nova playlist')).toBeNull();
    expect(screen.queryByText('Minhas playlists')).toBeNull();

    fireEvent.click(screen.getByRole('link', { name: 'Criar playlist' }));
    expect((await screen.findByTestId('where')).textContent).toBe('/entrar?voltar=%2F');
  });

  it('estado vazio convida a entrar ou criar conta', async () => {
    renderHome(null, { mine: [], public: [] });
    const empty = await screen.findByText(/Ainda não há playlists públicas/);
    expect(within(empty).getByRole('link', { name: 'Entre' }).getAttribute('href')).toBe('/entrar');
    expect(within(empty).getByRole('link', { name: 'crie uma conta' }).getAttribute('href')).toBe('/cadastro');
  });
});

describe('HomePage — logada', () => {
  const maria = { id: 'u1', email: 'maria@exemplo.com' };

  it('"Minhas playlists" com selos e, abaixo, as públicas das outras contas', async () => {
    renderHome(maria, {
      mine: [
        { id: 'p1', name: 'Privada da Maria', trackCount: 2, updatedAt: NOW, visibility: 'private', shareToken: null },
        { id: 'p2', name: 'Pública da Maria', trackCount: 0, updatedAt: NOW, visibility: 'public', shareToken: 'MMMMMMMMMMMMMMMMMMMMMM' },
      ],
      public: [{ name: 'Pública de Ana', trackCount: 3, updatedAt: NOW, shareToken: 'AAAAAAAAAAAAAAAAAAAAAA' }],
    });
    expect(await screen.findByRole('heading', { name: 'Minhas playlists' })).toBeTruthy();
    expect(screen.getByLabelText('Nova playlist')).toBeTruthy();

    const priv = await screen.findByRole('link', { name: /Privada da Maria/ });
    expect(priv.getAttribute('href')).toBe('/p/p1');
    expect(within(priv).getByText('Privada')).toBeTruthy();
    const pub = screen.getByRole('link', { name: /Pública da Maria/ });
    expect(pub.getAttribute('href')).toBe('/p/p2');
    expect(within(pub).getByText('Pública')).toBeTruthy();

    const section = screen.getByRole('region', { name: 'Públicas de outras pessoas' });
    const ana = within(section).getByRole('link', { name: /Pública de Ana/ });
    expect(ana.getAttribute('href')).toBe('/s/AAAAAAAAAAAAAAAAAAAAAA');
    expect(within(section).queryByText(/Maria/)).toBeNull();
  });

  it('estados vazios das duas seções', async () => {
    renderHome(maria, { mine: [], public: [] });
    expect(await screen.findByText(/Você ainda não tem playlists/)).toBeTruthy();
    expect(screen.getByText(/Ainda não há playlists públicas de outras pessoas/)).toBeTruthy();
  });
});
