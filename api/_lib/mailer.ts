// Envio de e-mail pelo Gmail (SMTP + senha de app). As credenciais existem só no ambiente do servidor.
// Sem SMTP_USER (dev local), nada é enviado: o link só é registrado no console do servidor.
import nodemailer from 'nodemailer';

export async function sendPasswordResetEmail(to: string, link: string): Promise<void> {
  const user = process.env.SMTP_USER;
  if (!user) {
    console.info(`[mailer] SMTP_USER não configurado; e-mail não enviado. Link de redefinição para ${to}: ${link}`);
    return;
  }
  const transport = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass: process.env.SMTP_APP_PASSWORD },
  });
  await transport.sendMail({
    from: user,
    to,
    subject: 'Redefinição de senha — Playlist Multiplataforma',
    text: [
      'Recebemos um pedido para redefinir a senha da sua conta.',
      '',
      `Para escolher uma nova senha, abra este link (vale por 1 hora e só pode ser usado uma vez):`,
      link,
      '',
      'Se não foi você, ignore este e-mail: sua senha continua a mesma.',
    ].join('\n'),
  });
}
