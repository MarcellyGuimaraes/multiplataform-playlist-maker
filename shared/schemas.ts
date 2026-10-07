import { z } from 'zod';
import {
  EMAIL_MAX,
  PASSWORD_MAX,
  PASSWORD_MIN,
  PLAYLIST_NAME_MAX,
  TRACK_LABEL_MAX,
  TRACK_URL_MAX,
} from './limits.js';

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

/** E-mail normalizado (sem espaços nas bordas, minúsculo) antes de validar. */
export const emailSchema = z
  .string({ error: 'Informe o e-mail.' })
  .trim()
  .toLowerCase()
  .min(1, 'Informe o e-mail.')
  .max(EMAIL_MAX, 'E-mail longo demais.')
  .pipe(z.email({ error: 'Informe um e-mail válido.' }));

/** Senha nova (cadastro e redefinição). Não é aparada: espaços fazem parte da senha. */
export const passwordSchema = z
  .string({ error: 'Informe a senha.' })
  .min(PASSWORD_MIN, `A senha deve ter pelo menos ${PASSWORD_MIN} caracteres.`)
  .max(PASSWORD_MAX, `A senha deve ter no máximo ${PASSWORD_MAX} caracteres.`);

export const visibilitySchema = z.object({
  visibility: z.enum(['public', 'private'], { error: 'Escolha entre pública e privada.' }),
});

export const signupSchema =z.object({ email: emailSchema, password: passwordSchema });

/** No login a senha só precisa existir: qualquer erro de credencial vira a mesma mensagem genérica. */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ error: 'Informe a senha.' }).min(1, 'Informe a senha.').max(PASSWORD_MAX, 'E-mail ou senha inválidos.'),
});

export const passwordResetRequestSchema = z.object({ email: emailSchema });

export const passwordResetConfirmSchema = z.object({
  token: z.string({ error: 'Link inválido ou expirado. Peça um novo.' }),
  password: passwordSchema,
});

export type AddTrackInput = z.infer<typeof addTrackSchema>;
