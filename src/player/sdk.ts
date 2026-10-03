// Carregamento sob demanda dos scripts oficiais de player (uma vez por SDK), com timeout.

export const SDK_TIMEOUT_MS = 10_000;

const cache = new Map<string, Promise<unknown>>();

/**
 * Insere o script `src` uma única vez e resolve com a API do SDK.
 * `waitReady` recebe `resolve` e é chamado antes da inserção, para registrar callbacks globais
 * (ex.: onYouTubeIframeAPIReady) ou resolver na hora se a API já existir.
 * `resolveOnLoad` resolve quando o script carrega (SDKs sem callback de prontidão).
 */
export function loadSdk<T>(
  key: string,
  src: string,
  opts: { waitReady?: (resolve: (api: T) => void) => void; resolveOnLoad?: () => T | undefined; timeoutMs?: number },
): Promise<T> {
  const cached = cache.get(key);
  if (cached) return cached as Promise<T>;

  const promise = new Promise<T>((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };
    const timer = setTimeout(
      () => finish(() => reject(new Error(`Tempo esgotado ao carregar ${src}`))),
      opts.timeoutMs ?? SDK_TIMEOUT_MS,
    );

    opts.waitReady?.((api) => finish(() => resolve(api)));
    if (settled) return;

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => {
      const api = opts.resolveOnLoad?.();
      if (api !== undefined) finish(() => resolve(api));
    };
    script.onerror = () => finish(() => reject(new Error(`Falha ao carregar ${src}`)));
    document.head.appendChild(script);
  });

  cache.set(key, promise);
  // Em caso de falha, permite tentar de novo numa próxima faixa.
  promise.catch(() => cache.delete(key));
  return promise;
}

/** Só para testes: esquece SDKs já carregados. */
export function resetSdkCache() {
  cache.clear();
}
