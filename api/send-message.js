// api/send-message.js
// Vercel Serverless Function — Envia mensagens via API do WhatsApp (Meta)
// Chamado pelo frontend quando o atendente digita uma resposta no CRM.
// Exige um token de sessão válido do Firebase: sem isso, qualquer pessoa na
// internet poderia disparar WhatsApp pelo número oficial da empresa.

import { exigirUsuario, obterBanco } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // ── Porteiro ──
  const usuario = await exigirUsuario(req, res);
  if (!usuario) return; // exigirUsuario já respondeu 401

  const { conversaId, texto, telefoneDestino } = req.body || {};

  if (!conversaId || !texto || !telefoneDestino) {
    return res.status(400).json({ error: 'Informe a conversa, o texto e o telefone de destino.' });
  }

  const PHONE_ID     = process.env.WHATSAPP_PHONE_ID;
  const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!PHONE_ID || !ACCESS_TOKEN) {
    console.error('[send-message] Variáveis de ambiente da Meta não configuradas.');
    return res.status(500).json({ error: 'O WhatsApp ainda não foi configurado no servidor.' });
  }

  try {
    const db = obterBanco();

    // ── 1. Enviar mensagem pela API da Meta ──
    const metaResponse = await fetch(
      `https://graph.facebook.com/v19.0/${PHONE_ID}/messages`,
      {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type:    'individual',
          to:                telefoneDestino, // Formato: 5511999999999
          type:              'text',
          text:              { body: texto },
        }),
      }
    );

    const metaData = await metaResponse.json();

    if (!metaResponse.ok) {
      console.error('[send-message] Erro da API da Meta:', metaData);

      // Fora da janela de 24h a Meta exige um template aprovado (HSM).
      // Devolvemos o código para o front conseguir explicar isso ao atendente.
      const codigo = metaData?.error?.code;
      const foraDaJanela = codigo === 131047 || codigo === 131026;

      return res.status(502).json({
        error: foraDaJanela
          ? 'Passaram-se mais de 24h desde a última mensagem do cliente. O WhatsApp só permite retomar a conversa com um modelo aprovado pela Meta.'
          : (metaData?.error?.message || 'Não foi possível entregar a mensagem no WhatsApp.'),
        metaCode: codigo || null,
        foraDaJanela,
      });
    }

    // ── 2. Salvar a mensagem enviada no Firebase ──
    const criadoEm = new Date().toISOString();
    const msgRef = db.ref(`crm_data/conversas/${conversaId}/mensagens`).push();

    await msgRef.set({
      texto,
      tipo:        'texto',
      criadoEm,
      origem:      'saida',   // 'saida' = enviado pelo atendente do CRM
      lida:        true,
      autorUid:    usuario.uid,
      autorEmail:  usuario.email || null,
      waMessageId: metaData?.messages?.[0]?.id || null,
    });

    // ── 3. Atualizar o resumo da conversa ──
    await db.ref(`crm_data/conversas/${conversaId}`).update({
      ultimaMensagem: texto,
      ultimaAt:       criadoEm,
    });

    console.log(`[send-message] Enviada por ${usuario.email} — conversa: ${conversaId}`);
    return res.status(200).json({ success: true, waMessageId: metaData?.messages?.[0]?.id });

  } catch (error) {
    console.error('[send-message] Erro interno:', error);
    return res.status(500).json({ error: 'Não foi possível enviar a mensagem. Tente novamente.' });
  }
}
