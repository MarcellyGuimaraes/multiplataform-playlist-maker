// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PREFS, PREFS_KEY, loadPrefs, savePrefs } from './preferences';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('preferências', () => {
  it('padrões: autoplay ligado, repetir e aleatório desligados', () => {
    expect(loadPrefs()).toEqual({ autoplay: true, repeat: false, shuffle: false });
  });

  it('salva e lê de volta', () => {
    savePrefs({ autoplay: false, repeat: true, shuffle: true });
    expect(loadPrefs()).toEqual({ autoplay: false, repeat: true, shuffle: true });
  });

  it('JSON inválido ou campos com tipo errado caem nos padrões', () => {
    localStorage.setItem(PREFS_KEY, '{nao-json');
    expect(loadPrefs()).toEqual(DEFAULT_PREFS);
    localStorage.setItem(PREFS_KEY, JSON.stringify({ autoplay: 'sim', repeat: true }));
    expect(loadPrefs()).toEqual({ autoplay: true, repeat: true, shuffle: false });
  });

  it('localStorage lançando exceção não quebra leitura nem escrita', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('bloqueado', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('bloqueado', 'SecurityError');
    });
    expect(loadPrefs()).toEqual(DEFAULT_PREFS);
    expect(() => savePrefs({ autoplay: false, repeat: false, shuffle: false })).not.toThrow();
  });

  it('loadPrefs devolve cópia (mutar não afeta os padrões)', () => {
    const p = loadPrefs();
    p.autoplay = false;
    expect(DEFAULT_PREFS.autoplay).toBe(true);
  });
});
