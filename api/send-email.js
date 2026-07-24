// api/send-email.js
// Vercel Serverless Function — Envio de E-mails via Gmail (SMTP)
// Usa nodemailer com a conta timeportel@gmail.com

import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { para, assunto, corpo } = req.body;

  if (!para || !assunto || !corpo) {
    return res.status(400).json({ error: 'Campos "para", "assunto" e "corpo" são obrigatórios.' });
  }

  // ── Configurar o transporte Gmail ──────────────────────────────────────────
  // GMAIL_USER e GMAIL_APP_PASSWORD devem ser configurados no Vercel
  // (Environment Variables). NUNCA coloque as credenciais aqui no código.
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // SSL
    auth: {
      user: process.env.GMAIL_USER,        // timeportel@gmail.com
      pass: process.env.GMAIL_APP_PASSWORD, // Senha de Aplicativo de 16 dígitos
    },
  });

  try {
    await transporter.sendMail({
      from: `"Grupo Portel" <${process.env.GMAIL_USER}>`,
      to: para,
      subject: assunto,
      // Versão texto simples
      text: corpo,
      // Versão HTML com formatação básica
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <div style="background: linear-gradient(135deg, #00d2df, #6366f1); padding: 20px; border-radius: 8px 8px 0 0;">
            <h2 style="color: white; margin: 0; font-size: 18px;">Grupo Portel</h2>
          </div>
          <div style="padding: 24px; background: #f9f9f9; border: 1px solid #eee; border-top: none; border-radius: 0 0 8px 8px;">
            <p style="white-space: pre-wrap; line-height: 1.7; font-size: 14px;">${corpo}</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #888; margin: 0;">
              Esta mensagem foi enviada pelo CRM Grupo Portel.
            </p>
          </div>
        </div>
      `,
    });

    console.log(`[Email] E-mail enviado com sucesso para: ${para}`);
    return res.status(200).json({ success: true, message: 'E-mail enviado com sucesso!' });
  } catch (error) {
    console.error('[Email] Erro ao enviar e-mail:', error);
    return res.status(500).json({ error: error.message || 'Erro ao enviar e-mail.' });
  }
}
