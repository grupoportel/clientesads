// api/send-email.js
// Vercel Serverless Function — Envio de e-mails por SMTP.
// Exige token de sessão do Firebase: sem isso, qualquer pessoa poderia enviar
// e-mails assinados como Grupo Portel.
//
// O provedor vem das variáveis de ambiente, não do código: ver api/_email.js.

import nodemailer from 'nodemailer';
import { exigirUsuario } from './_auth.js';
import { configuracaoSmtp, explicarErroSmtp, montarHtml, responderPara } from './_email.js';

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
      replyTo: responderPara(usuario.email, smtp.remetente),
      text: corpo,
      html: montarHtml(corpo),
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
