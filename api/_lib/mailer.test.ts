import nodemailer from 'nodemailer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendPasswordResetEmail } from './mailer.js';

vi.mock('nodemailer', () => ({ default: { createTransport: vi.fn() } }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.mocked(nodemailer.createTransport).mockReset();
});

const LINK = 'http://localhost:5173/redefinir-senha#abc';

describe('sendPasswordResetEmail', () => {
  it('sem SMTP_USER só registra o link no console, sem tentar conectar', async () => {
    vi.stubEnv('SMTP_USER', '');
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    await sendPasswordResetEmail('maria@exemplo.com', LINK);
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith(expect.stringContaining(LINK));
  });

  it('com SMTP_USER envia pelo Gmail com a senha de app', async () => {
    vi.stubEnv('SMTP_USER', 'envios@gmail.com');
    vi.stubEnv('SMTP_APP_PASSWORD', 'senha-de-app');
    const sendMail = vi.fn().mockResolvedValue({});
    vi.mocked(nodemailer.createTransport).mockReturnValue({ sendMail } as never);
    await sendPasswordResetEmail('maria@exemplo.com', LINK);
    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: 'envios@gmail.com', pass: 'senha-de-app' },
    });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'envios@gmail.com', to: 'maria@exemplo.com', text: expect.stringContaining(LINK) }),
    );
  });
});
