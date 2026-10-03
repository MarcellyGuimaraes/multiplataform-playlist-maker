// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSdk, resetSdkCache } from './sdk';

const scripts = () => document.head.querySelectorAll('script');

beforeEach(() => {
  resetSdkCache();
  document.head.innerHTML = '';
});
afterEach(() => vi.useRealTimers());

describe('loadSdk', () => {
  it('insere um só script para chamadas repetidas e resolve com a API', async () => {
    const api = { ok: true };
    const a = loadSdk('x', 'https://sdk.example/x.js', { resolveOnLoad: () => api });
    const b = loadSdk('x', 'https://sdk.example/x.js', { resolveOnLoad: () => api });
    expect(scripts()).toHaveLength(1);
    expect(scripts()[0].src).toBe('https://sdk.example/x.js');
    scripts()[0].onload!(new Event('load'));
    await expect(a).resolves.toBe(api);
    expect(b).toBe(a);
  });

  it('resolve pelo callback de prontidão (estilo onYouTubeIframeAPIReady)', async () => {
    const w = window as unknown as { onReady?: () => void };
    const p = loadSdk('y', 'https://sdk.example/y.js', {
      waitReady: (resolve) => {
        w.onReady = () => resolve('api-y');
      },
    });
    w.onReady!();
    await expect(p).resolves.toBe('api-y');
  });

  it('não insere script se a API já existe', async () => {
    const p = loadSdk('z', 'https://sdk.example/z.js', { waitReady: (resolve) => resolve('pronta') });
    await expect(p).resolves.toBe('pronta');
    expect(scripts()).toHaveLength(0);
  });

  it('rejeita no timeout', async () => {
    vi.useFakeTimers();
    const p = loadSdk('t', 'https://sdk.example/t.js', { resolveOnLoad: () => 1, timeoutMs: 50 });
    vi.advanceTimersByTime(60);
    await expect(p).rejects.toThrow(/Tempo esgotado/);
  });

  it('rejeita em erro de rede e permite nova tentativa', async () => {
    const p = loadSdk('e', 'https://sdk.example/e.js', { resolveOnLoad: () => 1 });
    scripts()[0].onerror!(new Event('error'));
    await expect(p).rejects.toThrow(/Falha ao carregar/);
    const retry = loadSdk('e', 'https://sdk.example/e.js', { resolveOnLoad: () => 1 });
    expect(retry).not.toBe(p);
    expect(scripts()).toHaveLength(2);
  });
});
