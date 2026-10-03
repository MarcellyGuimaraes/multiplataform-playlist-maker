import { useState, type FormEvent } from 'react';
import { TRACK_LABEL_MAX, TRACK_URL_MAX } from '../../shared/limits';
import { parseTrackUrl } from '../../shared/parseTrackUrl';
import { PLATFORM_NAME } from '../embed';

type Props = { onAdd: (url: string, label: string) => Promise<void> };

/** Adição de faixa sempre por link colado — não há busca de músicas. */
export function AddTrackForm({ onAdd }: Props) {
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const parsed = url.trim() ? parseTrackUrl(url) : null;
  const hint =
    parsed?.kind === 'track'
      ? { ok: true, text: `${PLATFORM_NAME[parsed.platform]} detectado` }
      : parsed?.kind === 'short-link'
        ? { ok: true, text: 'Link curto do SoundCloud — será resolvido ao adicionar' }
        : parsed?.kind === 'error'
          ? { ok: false, text: parsed.message }
          : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!parsed || parsed.kind === 'error') return;
    setSubmitting(true);
    setServerError(null);
    try {
      await onAdd(url.trim(), label.trim());
      setUrl('');
      setLabel('');
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Não foi possível adicionar a faixa.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="card add-track" onSubmit={submit}>
      <label>
        Link da faixa
        <input
          type="text"
          inputMode="url"
          placeholder="Cole um link do YouTube, Spotify ou SoundCloud"
          value={url}
          maxLength={TRACK_URL_MAX}
          onChange={(e) => {
            setUrl(e.target.value);
            setServerError(null);
          }}
          aria-describedby="add-track-hint"
          aria-invalid={hint ? !hint.ok : undefined}
        />
      </label>
      <p id="add-track-hint" className={hint ? (hint.ok ? 'hint ok' : 'hint error') : 'hint'} aria-live="polite">
        {hint?.text ?? ' '}
      </p>
      <label>
        Rótulo (opcional)
        <input
          type="text"
          placeholder="Ex.: Radiohead – Weird Fishes (ao vivo, Lollapalooza 2016)"
          value={label}
          maxLength={TRACK_LABEL_MAX}
          onChange={(e) => setLabel(e.target.value)}
        />
      </label>
      {serverError && (
        <p className="error" role="alert">
          {serverError}
        </p>
      )}
      <button type="submit" disabled={submitting || !parsed || parsed.kind === 'error'}>
        {submitting ? 'Adicionando…' : 'Adicionar faixa'}
      </button>
    </form>
  );
}
