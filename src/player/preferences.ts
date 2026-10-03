// Preferências de reprodução, guardadas só no navegador de quem ouve (nunca vão ao servidor).

export type PlaybackPrefs = { autoplay: boolean; repeat: boolean; shuffle: boolean };

export const DEFAULT_PREFS: PlaybackPrefs = { autoplay: true, repeat: false, shuffle: false };

export const PREFS_KEY = 'playback-prefs:v1';

export function loadPrefs(): PlaybackPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const data = JSON.parse(raw) as Partial<Record<keyof PlaybackPrefs, unknown>>;
    const pick = (key: keyof PlaybackPrefs) =>
      typeof data?.[key] === 'boolean' ? (data[key] as boolean) : DEFAULT_PREFS[key];
    return { autoplay: pick('autoplay'), repeat: pick('repeat'), shuffle: pick('shuffle') };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(prefs: PlaybackPrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Armazenamento indisponível (janela privada, cota, bloqueio): segue só em memória.
  }
}
