import { describe, expect, it } from 'vitest';
import {
  addTrackSchema,
  emailSchema,
  passwordSchema,
  playlistNameSchema,
  reorderSchema,
  updateTrackSchema,
} from './schemas.js';

describe('playlistNameSchema', () => {
  it('aceita nome válido e remove espaços nas bordas', () => {
    expect(playlistNameSchema.parse({ name: '  Ao vivo favoritas ' })).toEqual({ name: 'Ao vivo favoritas' });
  });
  it('rejeita nome vazio ou só espaços', () => {
    expect(playlistNameSchema.safeParse({ name: '   ' }).success).toBe(false);
    expect(playlistNameSchema.safeParse({}).success).toBe(false);
  });
  it('aceita 100 caracteres e rejeita 101', () => {
    expect(playlistNameSchema.safeParse({ name: 'a'.repeat(100) }).success).toBe(true);
    expect(playlistNameSchema.safeParse({ name: 'a'.repeat(101) }).success).toBe(false);
  });
  it('conta o limite depois do trim', () => {
    expect(playlistNameSchema.safeParse({ name: `  ${'a'.repeat(100)}  ` }).success).toBe(true);
  });
});

describe('addTrackSchema', () => {
  it('usa rótulo vazio por padrão', () => {
    expect(addTrackSchema.parse({ url: ' https://youtu.be/x ' })).toEqual({ url: 'https://youtu.be/x', label: '' });
  });
  it('aceita rótulo de 200 e rejeita de 201 caracteres', () => {
    expect(addTrackSchema.safeParse({ url: 'u', label: 'a'.repeat(200) }).success).toBe(true);
    expect(addTrackSchema.safeParse({ url: 'u', label: 'a'.repeat(201) }).success).toBe(false);
  });
  it('rejeita URL vazia e URL acima de 2048 caracteres', () => {
    expect(addTrackSchema.safeParse({ url: '  ' }).success).toBe(false);
    expect(addTrackSchema.safeParse({ url: 'h'.repeat(2049) }).success).toBe(false);
  });
});

describe('updateTrackSchema', () => {
  it('permite limpar o rótulo', () => {
    expect(updateTrackSchema.parse({ label: '  ' })).toEqual({ label: '' });
  });
  it('aceita só a versão no YouTube, com espaços nas bordas removidos, ou null para remover', () => {
    expect(updateTrackSchema.parse({ youtubeAlt: ' https://youtu.be/dQw4w9WgXcQ ' })).toEqual({
      youtubeAlt: 'https://youtu.be/dQw4w9WgXcQ',
    });
    expect(updateTrackSchema.parse({ youtubeAlt: null })).toEqual({ youtubeAlt: null });
  });
  it('aceita rótulo e versão juntos', () => {
    expect(updateTrackSchema.parse({ label: 'a', youtubeAlt: null })).toEqual({ label: 'a', youtubeAlt: null });
  });
  it('exige ao menos um campo', () => {
    expect(updateTrackSchema.safeParse({}).success).toBe(false);
  });
  it('rejeita versão vazia ou que não é texto', () => {
    expect(updateTrackSchema.safeParse({ youtubeAlt: '  ' }).success).toBe(false);
    expect(updateTrackSchema.safeParse({ youtubeAlt: 42 }).success).toBe(false);
  });
});

describe('reorderSchema', () => {
  it('exige UUIDs', () => {
    expect(reorderSchema.safeParse({ trackIds: ['nao-uuid'] }).success).toBe(false);
    expect(
      reorderSchema.safeParse({ trackIds: ['3f1c2b8e-9a4d-4c6e-8b2a-1d5e7f9a0b3c'] }).success,
    ).toBe(true);
  });
});

describe('emailSchema', () => {
  it('normaliza espaços nas bordas e maiúsculas', () => {
    expect(emailSchema.parse('Maria@Exemplo.com ')).toBe('maria@exemplo.com');
  });
  it('rejeita formato inválido e vazio', () => {
    expect(emailSchema.safeParse('maria@').success).toBe(false);
    expect(emailSchema.safeParse('maria').success).toBe(false);
    expect(emailSchema.safeParse('   ').success).toBe(false);
    expect(emailSchema.safeParse(undefined).success).toBe(false);
  });
  it('rejeita e-mail acima de 254 caracteres', () => {
    expect(emailSchema.safeParse(`${'a'.repeat(64)}@${'b'.repeat(186)}.com`).success).toBe(false);
  });
});

describe('passwordSchema', () => {
  it('aceita de 8 a 128 caracteres', () => {
    expect(passwordSchema.safeParse('1234567').success).toBe(false);
    expect(passwordSchema.safeParse('12345678').success).toBe(true);
    expect(passwordSchema.safeParse('a'.repeat(128)).success).toBe(true);
    expect(passwordSchema.safeParse('a'.repeat(129)).success).toBe(false);
  });
  it('não apara espaços da senha', () => {
    expect(passwordSchema.parse(' segredo1 ')).toBe(' segredo1 ');
  });
  it('mensagem de senha curta', () => {
    expect(passwordSchema.safeParse('1234567').error?.issues[0].message).toBe('A senha deve ter pelo menos 8 caracteres.');
  });
});
