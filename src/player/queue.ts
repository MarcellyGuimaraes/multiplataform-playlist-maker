// Fila de reprodução: funções puras sobre listas de ids, sem React nem SDKs.

export type Rng = () => number;

/** Permutação aleatória (Fisher–Yates) com a faixa atual, se houver, fixada na primeira posição. */
export function shuffled(ids: readonly string[], currentId: string | null, rng: Rng = Math.random): string[] {
  const rest = ids.filter((id) => id !== currentId);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return currentId !== null && ids.includes(currentId) ? [currentId, ...rest] : rest;
}

/** Ordem efetiva da fila: a da playlist, ou uma permutação nova quando o aleatório está ligado. */
export function buildOrder(
  trackIds: readonly string[],
  { shuffle, currentId, rng }: { shuffle: boolean; currentId: string | null; rng?: Rng },
): string[] {
  return shuffle ? shuffled(trackIds, currentId, rng) : [...trackIds];
}

/** Próxima faixa; null quando a fila acabou sem "repetir". Sem faixa atual, começa pela primeira. */
export function nextId(order: readonly string[], currentId: string | null, { repeat }: { repeat: boolean }) {
  if (order.length === 0) return null;
  if (currentId === null) return order[0];
  const i = order.indexOf(currentId);
  if (i === -1) return null;
  if (i < order.length - 1) return order[i + 1];
  return repeat ? order[0] : null;
}

/** Faixa anterior; null no início da fila sem "repetir". */
export function prevId(order: readonly string[], currentId: string | null, { repeat }: { repeat: boolean }) {
  if (order.length === 0 || currentId === null) return null;
  const i = order.indexOf(currentId);
  if (i === -1) return null;
  if (i > 0) return order[i - 1];
  return repeat ? order[order.length - 1] : null;
}

/**
 * Ajusta a fila quando a lista de faixas muda. Sem aleatório, a fila é sempre a ordem da playlist.
 * Com aleatório, mantém a permutação existente: tira os ids removidos e acrescenta os novos ao fim.
 */
export function reconcileOrder(prevOrder: readonly string[], trackIds: readonly string[], shuffle: boolean): string[] {
  if (!shuffle) return [...trackIds];
  const present = new Set(trackIds);
  const kept = prevOrder.filter((id) => present.has(id));
  const keptSet = new Set(kept);
  return [...kept, ...trackIds.filter((id) => !keptSet.has(id))];
}

/** Gerador pseudoaleatório determinístico (mulberry32), para testes reprodutíveis. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
