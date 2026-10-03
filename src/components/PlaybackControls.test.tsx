// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlaybackControls } from './PlaybackControls';

afterEach(cleanup);

function setup(over: Partial<Parameters<typeof PlaybackControls>[0]> = {}) {
  const props = {
    prefs: { autoplay: true, repeat: false, shuffle: false },
    canPrev: true,
    canNext: true,
    prev: vi.fn(),
    next: vi.fn(),
    toggleAutoplay: vi.fn(),
    toggleRepeat: vi.fn(),
    toggleShuffle: vi.fn(),
    ...over,
  };
  render(<PlaybackControls {...props} />);
  return props;
}

describe('PlaybackControls', () => {
  it('rótulos acessíveis e estado dos interruptores via aria-pressed', () => {
    setup({ prefs: { autoplay: true, repeat: false, shuffle: true } });
    expect(screen.getByRole('group', { name: 'Controles de reprodução' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Autoplay' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Repetir' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Aleatório' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('aciona anterior, próxima e os interruptores', () => {
    const p = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Faixa anterior' }));
    fireEvent.click(screen.getByRole('button', { name: 'Próxima faixa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Autoplay' }));
    fireEvent.click(screen.getByRole('button', { name: 'Repetir' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aleatório' }));
    expect(p.prev).toHaveBeenCalledOnce();
    expect(p.next).toHaveBeenCalledOnce();
    expect(p.toggleAutoplay).toHaveBeenCalledOnce();
    expect(p.toggleRepeat).toHaveBeenCalledOnce();
    expect(p.toggleShuffle).toHaveBeenCalledOnce();
  });

  it('limites desabilitam anterior/próxima', () => {
    const p = setup({ canPrev: false, canNext: false });
    const prev = screen.getByRole('button', { name: 'Faixa anterior' }) as HTMLButtonElement;
    const next = screen.getByRole('button', { name: 'Próxima faixa' }) as HTMLButtonElement;
    expect(prev.disabled).toBe(true);
    expect(next.disabled).toBe(true);
    fireEvent.click(prev);
    expect(p.prev).not.toHaveBeenCalled();
  });

  it('todos os controles são botões nativos (operáveis por teclado) na ordem de tabulação', () => {
    setup();
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.tagName)).toEqual(Array(5).fill('BUTTON'));
    for (const b of buttons) expect(b.getAttribute('tabindex')).toBeNull();
  });
});
