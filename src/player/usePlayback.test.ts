// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PREFS_KEY } from './preferences';
import { seededRng } from './queue';
import { BLOCKED_TIMEOUT_MS, SKIP_UNAVAILABLE_MS, usePlayback } from './usePlayback';

const ids = ['a', 'b', 'c'];

function setup(initial: string[] = ids, prefs?: object) {
  if (prefs) localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  return renderHook(({ list }) => usePlayback(list, { rng: seededRng(5) }), { initialProps: { list: initial } });
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.useRealTimers());

describe('usePlayback: avanço e limites (3.1)', () => {
  it('não toca nada sozinho ao montar', () => {
    const { result } = setup();
    expect(result.current.currentId).toBeNull();
    expect(result.current.request).toBeNull();
    expect(result.current.status).toBe('idle');
  });

  it('play pede carga com autoplay e marca a faixa atual', () => {
    const { result } = setup();
    act(() => result.current.play('b'));
    expect(result.current.currentId).toBe('b');
    expect(result.current.request).toMatchObject({ id: 'b', autoplay: true });
    expect(result.current.status).toBe('loading');
    act(() => result.current.events.onPlaying());
    expect(result.current.status).toBe('playing');
  });

  it('fim com autoplay avança para a próxima', () => {
    const { result } = setup();
    act(() => result.current.play('a'));
    act(() => result.current.events.onEnded());
    expect(result.current.currentId).toBe('b');
    expect(result.current.request?.id).toBe('b');
  });

  it('fim com autoplay desligado não avança', () => {
    const { result } = setup(ids, { autoplay: false });
    act(() => result.current.play('a'));
    const before = result.current.request;
    act(() => result.current.events.onEnded());
    expect(result.current.currentId).toBe('a');
    expect(result.current.request).toBe(before);
    expect(result.current.status).toBe('ended');
  });

  it('fim da última sem repetir para; com repetir volta à primeira', () => {
    const { result } = setup();
    act(() => result.current.play('c'));
    act(() => result.current.events.onEnded());
    expect(result.current.currentId).toBe('c');
    expect(result.current.status).toBe('ended');

    act(() => result.current.toggleRepeat());
    act(() => result.current.play('c'));
    act(() => result.current.events.onEnded());
    expect(result.current.currentId).toBe('a');
  });

  it('anterior/próxima respeitam limites e repetir', () => {
    const { result } = setup();
    act(() => result.current.play('a'));
    expect(result.current.canPrev).toBe(false);
    expect(result.current.canNext).toBe(true);
    act(() => result.current.next());
    expect(result.current.currentId).toBe('b');
    act(() => result.current.prev());
    expect(result.current.currentId).toBe('a');
    act(() => result.current.prev()); // indisponível: nada muda
    expect(result.current.currentId).toBe('a');
    act(() => result.current.play('c'));
    expect(result.current.canNext).toBe(false);
    act(() => result.current.toggleRepeat());
    expect(result.current.canNext).toBe(true);
    expect(result.current.canPrev).toBe(true);
    act(() => result.current.next());
    expect(result.current.currentId).toBe('a');
  });

  it('próxima manual funciona mesmo com autoplay desligado', () => {
    const { result } = setup(ids, { autoplay: false });
    act(() => result.current.play('a'));
    act(() => result.current.next());
    expect(result.current.request).toMatchObject({ id: 'b', autoplay: true });
  });

  it('tocar a mesma faixa de novo gera novo pedido de carga', () => {
    const { result } = setup();
    act(() => result.current.play('a'));
    const first = result.current.request!.nonce;
    act(() => result.current.play('a'));
    expect(result.current.request!.nonce).toBeGreaterThan(first);
  });

  it('aleatório: percorre todas as faixas uma vez e desligar volta à ordem da playlist', () => {
    const five = ['1', '2', '3', '4', '5'];
    const { result } = setup(five);
    act(() => result.current.play('3'));
    act(() => result.current.toggleShuffle());
    expect(result.current.order[0]).toBe('3');
    const played = ['3'];
    for (let i = 0; i < 4; i++) {
      act(() => result.current.events.onEnded());
      played.push(result.current.currentId!);
    }
    expect(new Set(played).size).toBe(5);
    act(() => result.current.events.onEnded());
    expect(result.current.status).toBe('ended');

    act(() => result.current.play('3'));
    act(() => result.current.toggleShuffle());
    expect(result.current.order).toEqual(five);
    act(() => result.current.next());
    expect(result.current.currentId).toBe('4');
  });

  it('preferências são salvas no navegador', () => {
    const { result } = setup();
    act(() => result.current.toggleAutoplay());
    expect(JSON.parse(localStorage.getItem(PREFS_KEY)!)).toEqual({ autoplay: false, repeat: false, shuffle: false });
    const again = setup();
    expect(again.result.current.prefs.autoplay).toBe(false);
  });
});

describe('usePlayback: temporizadores (3.2)', () => {
  beforeEach(() => vi.useFakeTimers());

  it('erro com autoplay: indisponível e pula em 3 s', () => {
    const { result } = setup();
    act(() => result.current.play('a'));
    act(() => result.current.events.onError('youtube:100'));
    expect(result.current.status).toBe('unavailable');
    act(() => vi.advanceTimersByTime(SKIP_UNAVAILABLE_MS - 1));
    expect(result.current.currentId).toBe('a');
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.currentId).toBe('b');
  });

  it('erro com autoplay desligado fica na faixa', () => {
    const { result } = setup(ids, { autoplay: false });
    act(() => result.current.play('a'));
    act(() => result.current.events.onError('x'));
    act(() => vi.advanceTimersByTime(10_000));
    expect(result.current.currentId).toBe('a');
    expect(result.current.status).toBe('unavailable');
  });

  it('ação manual cancela o pulo agendado', () => {
    const { result } = setup();
    act(() => result.current.play('a'));
    act(() => result.current.events.onError('x'));
    act(() => result.current.play('c'));
    act(() => vi.advanceTimersByTime(SKIP_UNAVAILABLE_MS * 2));
    expect(result.current.currentId).toBe('c');
  });

  it('avanço automático sem "tocando" em 5 s vira bloqueado; onPlaying limpa', () => {
    const { result } = setup();
    act(() => result.current.play('a'));
    act(() => result.current.events.onPlaying());
    act(() => result.current.events.onEnded());
    act(() => vi.advanceTimersByTime(BLOCKED_TIMEOUT_MS));
    expect(result.current.status).toBe('blocked');
    expect(result.current.currentId).toBe('b');
    act(() => result.current.events.onPlaying());
    expect(result.current.status).toBe('playing');
    act(() => result.current.events.onEnded());
    expect(result.current.currentId).toBe('c');
  });

  it('avanço automático que começa a tocar a tempo não vira bloqueado', () => {
    const { result } = setup();
    act(() => result.current.play('a'));
    act(() => result.current.events.onEnded());
    act(() => vi.advanceTimersByTime(1000));
    act(() => result.current.events.onPlaying());
    act(() => vi.advanceTimersByTime(BLOCKED_TIMEOUT_MS));
    expect(result.current.status).toBe('playing');
  });

  it('play manual não dispara o detector de bloqueio', () => {
    const { result } = setup();
    act(() => result.current.play('a'));
    act(() => vi.advanceTimersByTime(BLOCKED_TIMEOUT_MS * 2));
    expect(result.current.status).toBe('loading');
  });
});

describe('usePlayback: lista muda durante a reprodução (3.3)', () => {
  it('reordenar altera a próxima', () => {
    const { result, rerender } = setup();
    act(() => result.current.play('a'));
    rerender({ list: ['a', 'c', 'b'] });
    act(() => result.current.events.onEnded());
    expect(result.current.currentId).toBe('c');
  });

  it('faixa adicionada entra na fila', () => {
    const { result, rerender } = setup();
    act(() => result.current.play('c'));
    rerender({ list: [...ids, 'd'] });
    act(() => result.current.events.onEnded());
    expect(result.current.currentId).toBe('d');
  });

  it('faixa removida sai da fila', () => {
    const { result, rerender } = setup();
    act(() => result.current.play('a'));
    rerender({ list: ['a', 'c'] });
    act(() => result.current.events.onEnded());
    expect(result.current.currentId).toBe('c');
  });

  it('remover a faixa atual fecha o player', () => {
    const { result, rerender } = setup();
    act(() => result.current.play('b'));
    rerender({ list: ['a', 'c'] });
    expect(result.current.currentId).toBeNull();
    expect(result.current.request).toBeNull();
    expect(result.current.status).toBe('idle');
  });

  it('com aleatório, faixa nova entra no fim da permutação', () => {
    const { result, rerender } = setup();
    act(() => result.current.play('a'));
    act(() => result.current.toggleShuffle());
    const before = result.current.order;
    rerender({ list: [...ids, 'd'] });
    expect(result.current.order).toEqual([...before, 'd']);
  });
});
