// @vitest-environment jsdom
// Fluxos de ponta a ponta da interface: páginas React reais, com o fetch do navegador roteado para os
// handlers reais da API (mesmo roteamento por arquivos do servidor de desenvolvimento) sobre Postgres (PGlite).
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSql } from '../../api/_lib/db.js';
import { discoverRoutes, matchRoute } from '../../scripts/vite-dev-api.js';
import { App } from '../../src/App';
import { PlayerAdapterProvider } from '../../src/player/PlayerAdapterContext';
import { createFakeFactories } from '../../src/player/testing';
import { fakeReq, fakeRes } from '../helpers.js';
import { createTestDb } from '../pgdb.js';

vi.mock('../../api/_lib/db.js', () => ({ getSql: vi.fn() }));

const ROOT = join(import.meta.dirname, '..', '..');
const routes = discoverRoutes(ROOT);
let testDb: Awaited<ReturnType<typeof createTestDb>>;
const apiCalls: string[] = [];
// Os SDKs oficiais de player não rodam em jsdom: os fluxos usam adaptadores falsos que registram as cargas.
let fake: ReturnType<typeof createFakeFactories>;

async function fakeFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = new URL(String(input), 'http://localhost');
  if (url.hostname !== 'localhost') {
    // oEmbed das plataformas (chamado pelos handlers)
    return Response.json({ title: `Título ${url.hostname}`, author_name: 'Autor', thumbnail_url: 'https://img.example/t.jpg' });
  }
  apiCalls.push(`${init?.method ?? 'GET'} ${url.pathname}`);
  const match = matchRoute(routes, url.pathname);
  if (!match) return Response.json({ error: { code: 'not_found', message: 'Rota não encontrada.' } }, { status: 404 });
  const mod = await import(/* @vite-ignore */ join(ROOT, match.file));
  const res = fakeRes();
  await mod.default(
    fakeReq({
      method: init?.method ?? 'GET',
      query: { ...Object.fromEntries(url.searchParams), ...match.params },
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    }),
    res,
  );
  if (res.statusCode === 204) return new Response(null, { status: 204 });
  return Response.json(res.body, { status: res.statusCode });
}

beforeAll(async () => {
  testDb = await createTestDb();
  vi.mocked(getSql).mockReturnValue(testDb.sql as unknown as ReturnType<typeof getSql>);
});
afterAll(() => testDb.db.close());

beforeEach(async () => {
  await testDb.reset();
  apiCalls.length = 0;
  fake = createFakeFactories();
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(fakeFetch));
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function open(path: string) {
  window.history.pushState({}, '', path);
  return render(
    <PlayerAdapterProvider factories={fake.factories}>
      <App />
    </PlayerAdapterProvider>,
  );
}

const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });

async function createPlaylist(name: string) {
  open('/');
  await screen.findByText(/ainda não tem playlists/);
  type(screen.getByLabelText('Nova playlist'), name);
  fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
  await screen.findByRole('heading', { name });
}

async function addTrack(url: string, label = '') {
  type(screen.getByLabelText('Link da faixa'), url);
  if (label) type(screen.getByLabelText('Rótulo (opcional)'), label);
  const countBefore = screen.queryAllByRole('listitem').length;
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar faixa' }));
  await waitFor(() => expect(screen.queryAllByRole('listitem')).toHaveLength(countBefore + 1));
}

const trackNames = () =>
  screen.getAllByRole('listitem').map((li) => within(li).getAllByText(/./, { selector: '.track-name' })[0].textContent);

describe('tela inicial (8.2)', () => {
  it('estado vazio, validação de nome e criação', async () => {
    open('/');
    expect(await screen.findByText(/ainda não tem playlists/)).toBeTruthy();

    type(screen.getByLabelText('Nova playlist'), '   ');
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/não pode ficar vazio/);
    expect(apiCalls).not.toContain('POST /api/playlists');

    type(screen.getByLabelText('Nova playlist'), 'Ao vivo favoritas');
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    expect(await screen.findByRole('heading', { name: 'Ao vivo favoritas' })).toBeTruthy();
    expect(window.location.pathname).toMatch(/^\/p\/[0-9a-f-]{36}$/);
  });

  it('lista playlists com contagem de faixas', async () => {
    await createPlaylist('Mix');
    await addTrack('https://youtu.be/dQw4w9WgXcQ');
    cleanup();
    open('/');
    const link = await screen.findByRole('link', { name: /Mix/ });
    expect(link.textContent).toMatch(/1 faixa/);
  });
});

describe('edição de playlist (8.3, 9.x)', () => {
  it('feedback de plataforma, adição, rótulo, reordenação e remoção', async () => {
    await createPlaylist('Teste');
    expect(screen.getByText(/ainda não tem faixas/)).toBeTruthy();

    // 9.1 feedback imediato
    type(screen.getByLabelText('Link da faixa'), 'https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3');
    expect(screen.getByText(/Apenas faixas individuais/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Adicionar faixa' }) as HTMLButtonElement).disabled).toBe(true);
    type(screen.getByLabelText('Link da faixa'), 'https://youtu.be/dQw4w9WgXcQ');
    expect(screen.getByText('YouTube detectado')).toBeTruthy();

    await addTrack('https://youtu.be/dQw4w9WgXcQ', 'Weird Fishes (ao vivo)');
    await addTrack('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC');
    await addTrack('https://soundcloud.com/artista/faixa', 'Demo');

    // 9.2 sem rótulo → usa o título em cache
    expect(trackNames()).toEqual(['Weird Fishes (ao vivo)', 'Título open.spotify.com', 'Demo']);

    // 9.3 reordenar com botões
    fireEvent.click(screen.getByRole('button', { name: 'Subir: Demo' }));
    await waitFor(() => expect(trackNames()).toEqual(['Weird Fishes (ao vivo)', 'Demo', 'Título open.spotify.com']));
    await waitFor(() => expect(apiCalls.some((c) => c.endsWith('/tracks/order'))).toBe(true));
    // espera a reordenação terminar: durante a mutação os controles ficam desabilitados (busy)
    await waitFor(() =>
      expect((screen.getByRole('button', { name: 'Remover: Demo' }) as HTMLButtonElement).disabled).toBe(false),
    );

    // 9.3 editar rótulo
    fireEvent.click(screen.getByRole('button', { name: 'Editar rótulo: Título open.spotify.com' }));
    type(screen.getByLabelText('Rótulo da faixa'), 'Versão de estúdio');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await screen.findByText('Versão de estúdio');

    // 9.3 remover
    fireEvent.click(screen.getByRole('button', { name: 'Remover: Weird Fishes (ao vivo)' }));
    await waitFor(() => expect(trackNames()).toEqual(['Demo', 'Versão de estúdio']));

    // 9.4 alça de arrastar presente em cada item
    expect(screen.getAllByRole('button', { name: /Arrastar para reordenar/ })).toHaveLength(2);

    // persistência: recarregar a página mantém ordem e rótulos
    const path = window.location.pathname;
    cleanup();
    open(path);
    await screen.findByRole('heading', { name: 'Teste' });
    expect(trackNames()).toEqual(['Demo', 'Versão de estúdio']);
  });

  it('player: tocar troca o embed e mostra aviso só no Spotify (10.2)', async () => {
    await createPlaylist('Player');
    await addTrack('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC', 'Spotify');
    await addTrack('https://youtu.be/dQw4w9WgXcQ', 'YouTube');

    fireEvent.click(screen.getByRole('button', { name: 'Tocar: Spotify' }));
    let player = screen.getByRole('region', { name: 'Tocando agora' });
    await waitFor(() =>
      expect(player.querySelector('iframe')?.src).toBe('https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC'),
    );
    expect(within(player).getByRole('note').textContent).toMatch(/30 segundos/);

    fireEvent.click(screen.getByRole('button', { name: 'Tocar: YouTube' }));
    player = screen.getByRole('region', { name: 'Tocando agora' });
    await waitFor(() => expect(player.querySelector('iframe')?.src).toMatch(/youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/));
    expect(document.querySelectorAll('iframe')).toHaveLength(1);
    expect(within(player).queryByRole('note')).toBeNull();
    expect(within(player).getByRole('link', { name: /Abrir no YouTube/ }).getAttribute('href')).toBe(
      'https://youtu.be/dQw4w9WgXcQ',
    );
  });

  it('renomear, copiar link, regenerar e excluir (8.3)', async () => {
    await createPlaylist('Antiga');
    fireEvent.click(screen.getByRole('button', { name: 'Renomear' }));
    type(screen.getByLabelText('Nome da playlist'), 'Nova');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await screen.findByRole('heading', { name: 'Nova' });

    const linkInput = screen.getByLabelText(/Link público/) as HTMLInputElement;
    const firstLink = linkInput.value;
    expect(firstLink).toMatch(/\/s\/[A-Za-z0-9_-]{22}$/);
    fireEvent.click(screen.getByRole('button', { name: 'Copiar link público' }));
    await screen.findByText('Link copiado!');
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(firstLink);

    fireEvent.click(screen.getByRole('button', { name: 'Gerar novo link' }));
    await waitFor(() => expect(linkInput.value).not.toBe(firstLink));

    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    await screen.findByRole('heading', { name: 'Minhas playlists' });
    expect(window.confirm).toHaveBeenCalledTimes(2);
  });

  it('cancelar a exclusão não remove nada', async () => {
    await createPlaylist('Fica');
    vi.mocked(window.confirm).mockReturnValue(false);
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    expect(apiCalls.filter((c) => c.startsWith('DELETE'))).toHaveLength(0);
    expect(screen.getByRole('heading', { name: 'Fica' })).toBeTruthy();
  });
});

describe('visualização compartilhada (10.3)', () => {
  it('somente leitura, com player; token antigo vira "não encontrada"', async () => {
    await createPlaylist('Pública');
    await addTrack('https://youtu.be/dQw4w9WgXcQ', 'Faixa um');
    const oldLink = (screen.getByLabelText(/Link público/) as HTMLInputElement).value;
    const oldPath = new URL(oldLink).pathname;

    cleanup();
    open(oldPath);
    await screen.findByRole('heading', { name: 'Pública' });
    expect(screen.getByText('Faixa um')).toBeTruthy();
    const buttons = screen.getAllByRole('button').map((b) => b.textContent);
    expect(buttons).toEqual(['Tocar']);
    expect(screen.queryByLabelText('Link da faixa')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Tocar: Faixa um' }));
    await waitFor(() => expect(document.querySelector('iframe')?.src).toMatch(/youtube-nocookie/));
    expect(screen.queryByRole('button', { name: /Remover|Subir|Descer|Renomear|Excluir|rótulo/i })).toBeNull();

    // regenerar invalida o link antigo
    const [{ id }] = (await testDb.sql`select id from playlists`) as { id: string }[];
    cleanup();
    open(`/p/${id}`);
    await screen.findByRole('heading', { name: 'Pública' });
    fireEvent.click(screen.getByRole('button', { name: 'Gerar novo link' }));
    await waitFor(() => expect((screen.getByLabelText(/Link público/) as HTMLInputElement).value).not.toBe(oldLink));

    cleanup();
    open(oldPath);
    expect(await screen.findByRole('heading', { name: 'Playlist não encontrada.' })).toBeTruthy();
  });
});

describe('reprodução contínua (5.x)', () => {
  const playing = () =>
    screen
      .getAllByRole('button', { name: /^Tocando: / })
      .map((b) => b.getAttribute('aria-label')!.replace('Tocando: ', ''));
  const lastLoadId = () => fake.loads().at(-1)?.id;

  async function threeTrackPlaylist() {
    await createPlaylist('Contínua');
    await addTrack('https://youtu.be/dQw4w9WgXcQ', 'Um');
    await addTrack('https://soundcloud.com/artista/faixa', 'Dois');
    await addTrack('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC', 'Três');
  }

  it('fim da faixa avança para a próxima, inclusive trocando de plataforma (5.1)', async () => {
    await threeTrackPlaylist();
    fireEvent.click(screen.getByRole('button', { name: 'Tocar: Um' }));
    await waitFor(() => expect(lastLoadId()).toBe('dQw4w9WgXcQ'));
    act(() => fake.events().onEnded());
    await waitFor(() => expect(lastLoadId()).toBe('artista/faixa'));
    expect(playing()).toEqual(['Dois']);
    expect(fake.log.map((e) => `${e.platform}:${e.action}`)).toContain('youtube:destroy');
  });

  it('reordenar durante a reprodução altera a próxima; remover a atual fecha o player (5.1)', async () => {
    await threeTrackPlaylist();
    fireEvent.click(screen.getByRole('button', { name: 'Tocar: Um' }));
    await waitFor(() => expect(lastLoadId()).toBe('dQw4w9WgXcQ'));
    fireEvent.click(screen.getByRole('button', { name: 'Subir: Três' }));
    await waitFor(() => expect(trackNames()).toEqual(['Um', 'Três', 'Dois']));
    act(() => fake.events().onEnded());
    await waitFor(() => expect(lastLoadId()).toBe('4uLU6hMCjMI75M1A2tKUQC'));
    expect(playing()).toEqual(['Três']);

    fireEvent.click(screen.getByRole('button', { name: 'Remover: Três' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Tocando agora' })).toBeNull());
  });

  it('anterior/próxima e fim da playlist sem repetir (5.1)', async () => {
    await threeTrackPlaylist();
    fireEvent.click(screen.getByRole('button', { name: 'Tocar: Dois' }));
    await waitFor(() => expect(lastLoadId()).toBe('artista/faixa'));
    fireEvent.click(screen.getByRole('button', { name: 'Próxima faixa' }));
    await waitFor(() => expect(playing()).toEqual(['Três']));
    expect((screen.getByRole('button', { name: 'Próxima faixa' }) as HTMLButtonElement).disabled).toBe(true);
    act(() => fake.events().onEnded());
    await screen.findByText('Fim da reprodução.');
    expect(playing()).toEqual(['Três']);
    fireEvent.click(screen.getByRole('button', { name: 'Faixa anterior' }));
    await waitFor(() => expect(playing()).toEqual(['Dois']));
  });

  it('link público: reprodução contínua com controles e sem edição (5.2)', async () => {
    await threeTrackPlaylist();
    const path = new URL((screen.getByLabelText(/Link público/) as HTMLInputElement).value).pathname;
    cleanup();
    open(path);
    await screen.findByRole('heading', { name: 'Contínua' });
    fireEvent.click(screen.getByRole('button', { name: 'Tocar: Um' }));
    await waitFor(() => expect(lastLoadId()).toBe('dQw4w9WgXcQ'));
    act(() => fake.events().onEnded());
    await waitFor(() => expect(lastLoadId()).toBe('artista/faixa'));
    expect(playing()).toEqual(['Dois']);
    expect(screen.getByRole('group', { name: 'Controles de reprodução' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Remover|Subir|Descer|Renomear|Excluir|rótulo|Arrastar/i })).toBeNull();
    expect(screen.queryByLabelText('Link da faixa')).toBeNull();
  });

  it('abrir não toca nada sozinho; preferências persistem entre recarregamentos (5.3)', async () => {
    await threeTrackPlaylist();
    const path = window.location.pathname;
    expect(screen.queryByRole('region', { name: 'Tocando agora' })).toBeNull();
    expect(fake.loads()).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Tocar: Um' }));
    await waitFor(() => expect(lastLoadId()).toBe('dQw4w9WgXcQ'));
    fireEvent.click(screen.getByRole('button', { name: 'Autoplay' }));
    expect(screen.getByRole('button', { name: 'Autoplay' }).getAttribute('aria-pressed')).toBe('false');

    cleanup();
    fake = createFakeFactories();
    open(path);
    await screen.findByRole('heading', { name: 'Contínua' });
    expect(fake.loads()).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Tocar: Um' }));
    await waitFor(() => expect(lastLoadId()).toBe('dQw4w9WgXcQ'));
    expect(screen.getByRole('button', { name: 'Autoplay' }).getAttribute('aria-pressed')).toBe('false');
    act(() => fake.events().onEnded());
    expect(fake.loads()).toHaveLength(1);
    expect(playing()).toEqual(['Um']);
  });
});
