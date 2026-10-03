import { z } from 'zod';
import { PLAYLIST_NAME_MAX, TRACK_LABEL_MAX, TRACK_URL_MAX } from './limits.js';

const playlistName = z
  .string({ error: 'Informe o nome da playlist.' })
  .trim()
  .min(1, 'O nome da playlist não pode ficar vazio.')
  .max(PLAYLIST_NAME_MAX, `O nome da playlist deve ter no máximo ${PLAYLIST_NAME_MAX} caracteres.`);

const trackLabel = z
  .string({ error: 'Rótulo inválido.' })
  .trim()
  .max(TRACK_LABEL_MAX, `O rótulo deve ter no máximo ${TRACK_LABEL_MAX} caracteres.`);

export const playlistNameSchema = z.object({ name: playlistName });

export const addTrackSchema = z.object({
  url: z
    .string({ error: 'Cole um link.' })
    .trim()
    .min(1, 'Cole um link.')
    .max(TRACK_URL_MAX, `O link deve ter no máximo ${TRACK_URL_MAX} caracteres.`),
  label: trackLabel.optional().default(''),
});

export const updateTrackSchema = z.object({ label: trackLabel });

export const reorderSchema = z.object({
  trackIds: z.array(z.uuid({ error: 'Identificador de faixa inválido.' }), {
    error: 'Envie a lista de faixas na nova ordem.',
  }),
});

export type AddTrackInput = z.infer<typeof addTrackSchema>;
