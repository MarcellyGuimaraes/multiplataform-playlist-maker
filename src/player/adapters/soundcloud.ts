// SoundCloud Widget API (oficial). https://developers.soundcloud.com/docs/api/html5-widget
import { EMBED_HEIGHT } from '../../embed';
import { loadSdk } from '../sdk';
import { IFRAME_ALLOW, type PlayerFactory } from '../types';

type SCWidget = {
  bind(event: string, cb: () => void): void;
  load(url: string, opts: { auto_play: boolean; visual?: boolean }): void;
};

type SCNamespace = {
  Widget: ((iframe: HTMLIFrameElement) => SCWidget) & {
    Events: { PLAY: string; PAUSE: string; FINISH: string; ERROR: string };
  };
};

const widgetSrc = (url: string, autoplay: boolean) =>
  `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&auto_play=${autoplay}&visual=false`;

function loadSoundCloud(): Promise<SCNamespace> {
  const w = window as Window & { SC?: SCNamespace };
  return loadSdk<SCNamespace>('soundcloud', 'https://w.soundcloud.com/player/api.js', {
    waitReady: (resolve) => {
      if (w.SC?.Widget) resolve(w.SC);
    },
    resolveOnLoad: () => w.SC,
  });
}

export const createSoundCloudPlayer: PlayerFactory = async (container, events) => {
  const SC = await loadSoundCloud();
  let iframe: HTMLIFrameElement | null = null;
  let widget: SCWidget | null = null;

  return {
    load(track, { autoplay }) {
      if (widget) {
        widget.load(track.canonicalUrl, { auto_play: autoplay, visual: false });
        return;
      }
      // O widget precisa de um iframe já apontando para uma faixa; as próximas reaproveitam o mesmo iframe.
      iframe = document.createElement('iframe');
      iframe.title = 'Player do SoundCloud';
      iframe.src = widgetSrc(track.canonicalUrl, autoplay);
      iframe.width = '100%';
      iframe.height = String(EMBED_HEIGHT.soundcloud);
      iframe.allow = IFRAME_ALLOW;
      iframe.style.border = '0';
      container.appendChild(iframe);
      widget = SC.Widget(iframe);
      const { PLAY, PAUSE, FINISH, ERROR } = SC.Widget.Events;
      widget.bind(PLAY, () => events.onPlaying());
      widget.bind(PAUSE, () => events.onPaused());
      widget.bind(FINISH, () => events.onEnded());
      widget.bind(ERROR, () => events.onError('soundcloud:error'));
    },
    destroy() {
      iframe?.remove();
      iframe = null;
      widget = null;
      container.replaceChildren();
    },
  };
};
