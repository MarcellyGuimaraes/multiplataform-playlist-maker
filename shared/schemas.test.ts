import { describe, expect, it } from 'vitest';
import { addTrackSchema, playlistNameSchema, reorderSchema, updateTrackSchema } from './schemas.js';

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
});

describe('reorderSchema', () => {
  it('exige UUIDs', () => {
    expect(reorderSchema.safeParse({ trackIds: ['nao-uuid'] }).success).toBe(false);
    expect(
      reorderSchema.safeParse({ trackIds: ['3f1c2b8e-9a4d-4c6e-8b2a-1d5e7f9a0b3c'] }).success,
    ).toBe(true);
  });
});
