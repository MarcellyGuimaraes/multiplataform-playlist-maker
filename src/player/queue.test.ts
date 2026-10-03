import { describe, expect, it } from 'vitest';
import { buildOrder, nextId, prevId, reconcileOrder, seededRng, shuffled } from './queue';

const ids = ['a', 'b', 'c', 'd'];
const off = { repeat: false };
const on = { repeat: true };

describe('nextId / prevId', () => {
  it('avança e volta na ordem', () => {
    expect(nextId(ids, 'b', off)).toBe('c');
    expect(prevId(ids, 'b', off)).toBe('a');
  });
  it('sem repetir: fim e início retornam null', () => {
    expect(nextId(ids, 'd', off)).toBeNull();
    expect(prevId(ids, 'a', off)).toBeNull();
  });
  it('com repetir: dá a volta', () => {
    expect(nextId(ids, 'd', on)).toBe('a');
    expect(prevId(ids, 'a', on)).toBe('d');
  });
  it('sem faixa atual, próxima é a primeira e anterior não existe', () => {
    expect(nextId(ids, null, off)).toBe('a');
    expect(prevId(ids, null, off)).toBeNull();
  });
  it('fila vazia ou faixa fora da fila retornam null', () => {
    expect(nextId([], null, on)).toBeNull();
    expect(nextId(ids, 'x', on)).toBeNull();
    expect(prevId(ids, 'x', on)).toBeNull();
  });
  it('playlist de uma faixa com repetir volta para ela mesma', () => {
    expect(nextId(['a'], 'a', on)).toBe('a');
    expect(nextId(['a'], 'a', off)).toBeNull();
  });
});

describe('aleatório', () => {
  it('mantém a faixa atual como primeira e contém cada faixa exatamente uma vez', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const order = shuffled(ids, 'c', seededRng(seed));
      expect(order[0]).toBe('c');
      expect([...order].sort()).toEqual([...ids].sort());
    }
  });

  it('sem faixa atual, é só uma permutação', () => {
    const order = shuffled(ids, null, seededRng(7));
    expect([...order].sort()).toEqual(ids);
  });

  it('é determinístico com a mesma seed e varia entre seeds', () => {
    expect(shuffled(ids, null, seededRng(3))).toEqual(shuffled(ids, null, seededRng(3)));
    const variants = new Set(Array.from({ length: 30 }, (_, s) => shuffled(ids, null, seededRng(s)).join('')));
    expect(variants.size).toBeGreaterThan(5);
  });

  it('percorrer a fila até o fim toca cada faixa exatamente uma vez', () => {
    const five = ['1', '2', '3', '4', '5'];
    const order = buildOrder(five, { shuffle: true, currentId: '3', rng: seededRng(11) });
    const played = ['3'];
    let cur: string | null = '3';
    while ((cur = nextId(order, cur, off)) !== null) played.push(cur);
    expect(played).toHaveLength(5);
    expect(new Set(played).size).toBe(5);
  });

  it('desligar o aleatório volta à ordem da playlist a partir da faixa atual', () => {
    const order = buildOrder(ids, { shuffle: false, currentId: 'c' });
    expect(order).toEqual(ids);
    expect(nextId(order, 'c', off)).toBe('d');
  });

  it('buildOrder não altera a lista original', () => {
    const original = [...ids];
    buildOrder(ids, { shuffle: true, currentId: 'a', rng: seededRng(1) });
    expect(ids).toEqual(original);
  });
});

describe('reconcileOrder', () => {
  it('sem aleatório segue a nova ordem da playlist (reordenação)', () => {
    expect(reconcileOrder(['a', 'b', 'c'], ['a', 'c', 'b'], false)).toEqual(['a', 'c', 'b']);
  });
  it('com aleatório preserva a permutação, remove ids sumidos e acrescenta novos ao fim', () => {
    expect(reconcileOrder(['c', 'a', 'b'], ['a', 'b', 'c', 'd'], true)).toEqual(['c', 'a', 'b', 'd']);
    expect(reconcileOrder(['c', 'a', 'b'], ['a', 'c'], true)).toEqual(['c', 'a']);
  });
  it('com aleatório ignora mudança de ordem da playlist', () => {
    expect(reconcileOrder(['c', 'a', 'b'], ['b', 'a', 'c'], true)).toEqual(['c', 'a', 'b']);
  });
});
