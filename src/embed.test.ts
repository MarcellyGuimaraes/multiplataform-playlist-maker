import { describe, expect, it } from 'vitest';
import { spotifyPreviewHint } from './embed';

const UA = {
  firefoxWindows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0',
  firefoxAndroid: 'Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0',
  chromeWindows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36',
  chromeAndroid:
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36 Edg/155.0.0.0',
  safariMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  safariIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  chromeIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/155.0.0.0 Mobile/15E148 Safari/604.1',
};

describe('spotifyPreviewHint', () => {
  it.each([
    ['firefoxWindows', 'firefox'],
    ['firefoxAndroid', 'só prévia'],
    ['chromeWindows', 'demais'],
    ['chromeAndroid', 'só prévia'],
    ['edge', 'demais'],
    ['safariMac', 'só prévia'],
    ['safariIphone', 'só prévia'],
    ['chromeIos', 'só prévia'],
  ] as const)('%s → %s', (key, kind) => {
    const text = spotifyPreviewHint(UA[key]);
    if (kind === 'firefox') expect(text).toMatch(/clique uma vez no play dentro do player/);
    if (kind === 'só prévia') expect(text).toMatch(/toca só a prévia de 30 segundos no player embutido/);
    if (kind === 'demais') expect(text).toMatch(/faça login no Spotify neste navegador.*bloqueando/);
  });
});
