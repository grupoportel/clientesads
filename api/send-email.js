// api/send-email.js
// Vercel Serverless Function — Envio de e-mails por SMTP.
// Exige token de sessão do Firebase: sem isso, qualquer pessoa poderia enviar
// e-mails assinados como Grupo Portel.
//
// O provedor vem das variáveis de ambiente, não do código: ver api/_email.js.

import nodemailer from 'nodemailer';
import { exigirUsuario } from './_auth.js';
import { configuracaoSmtp, explicarErroSmtp } from './_email.js';

// Escapa HTML para que o corpo digitado pelo atendente não injete marcação
// na mensagem enviada.
const escaparHtml = (texto = '') =>
  String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // ── Porteiro ──
  const usuario = await exigirUsuario(req, res);
  if (!usuario) return;

  const { para, assunto, corpo } = req.body || {};

  if (!para || !assunto || !corpo) {
    return res.status(400).json({ error: 'Preencha destinatário, assunto e mensagem.' });
  }

  const smtp = configuracaoSmtp();
  if (!smtp) {
    console.error('[Email] Nenhuma credencial SMTP configurada.');
    return res.status(500).json({
      error: 'O envio de e-mail ainda não foi configurado no servidor. '
        + 'Defina SMTP_HOST, SMTP_USER e SMTP_PASS.',
    });
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.auth,
  });

  try {
    await transporter.sendMail({
      from: `"${smtp.nome}" <${smtp.remetente}>`,
      to: para,
      subject: assunto,
      replyTo: usuario.email || smtp.remetente,
      text: corpo,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <div style="background: linear-gradient(135deg, #00d2df, #6366f1); padding: 20px; border-radius: 8px 8px 0 0;">
            <h2 style="color: white; margin: 0; font-size: 18px;">Grupo Portel</h2>
          </div>
          <div style="padding: 24px; background: #f9f9f9; border: 1px solid #eee; border-top: none; border-radius: 0 0 8px 8px;">
            <p style="white-space: pre-wrap; line-height: 1.7; font-size: 14px;">${escaparHtml(corpo)}</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #888; margin: 0;">
              Esta mensagem foi enviada pelo CRM Grupo Portel.
            </p>
          </div>
        </div>
      `,
    });

    console.log(`[Email] Enviado por ${usuario.email} para ${para} via ${smtp.host}`);
    return res.status(200).json({ success: true, message: 'E-mail enviado com sucesso!' });
  } catch (error) {
    console.error('[Email] Erro ao enviar e-mail:', error?.code, error?.message);
    // Erro de SMTP quase sempre é configuração, não o endereço digitado. Dizer
    // "verifique o endereço" mandava a pessoa procurar no lugar errado.
    return res.status(500).json({
      error: explicarErroSmtp(error) || 'Não foi possível enviar o e-mail. Tente novamente.',
    });
  }
}
