// api/send-message.js
// Vercel Serverless Function — Envia mensagens via API do WhatsApp (Meta)
// Chamado pelo frontend quando o atendente digita uma resposta no CRM

import admin from 'firebase-admin';

// ── Inicializa o Firebase Admin (uma única vez) ──
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
}

const db = admin.database();

// ── Handler Principal ──
export default async function handler(req, res) {
  // Segurança: apenas aceitar POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { conversaId, texto, telefoneDestino } = req.body;

  // Validação dos campos obrigatórios
  if (!conversaId || !texto || !telefoneDestino) {
    return res.status(400).json({ error: 'Campos obrigatórios: conversaId, texto, telefoneDestino' });
  }

  const PHONE_ID    = process.env.WHATSAPP_PHONE_ID;
  const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!PHONE_ID || !ACCESS_TOKEN) {
    console.error('[send-message] Variáveis de ambiente da Meta não configuradas.');
    return res.status(500).json({ error: 'Configuração de WhatsApp incompleta no servidor' });
  }

  try {
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
      return res.status(502).json({
        error:   'Erro ao enviar mensagem pela Meta',
        details: metaData?.error?.message || 'Erro desconhecido',
      });
    }

    // ── 2. Salvar a mensagem enviada no Firebase ──
    const criadoEm = new Date().toISOString();
    const msgRef = db.ref(`crm_data/conversas/${conversaId}/mensagens`).push();

    await msgRef.set({
      texto,
      tipo:       'texto',
      criadoEm,
      origem:     'saida',   // 'saida' = enviado pelo atendente do CRM
      lida:       true,
      waMessageId: metaData?.messages?.[0]?.id || null,
    });

    // ── 3. Atualizar o resumo da conversa ──
    await db.ref(`crm_data/conversas/${conversaId}`).update({
      ultimaMensagem: texto,
      ultimaAt:       criadoEm,
    });

    console.log(`[send-message] Mensagem enviada com sucesso — conversa: ${conversaId}`);
    return res.status(200).json({ success: true, waMessageId: metaData?.messages?.[0]?.id });

  } catch (error) {
    console.error('[send-message] Erro interno:', error);
    return res.status(500).json({ error: 'Erro interno do servidor ao enviar mensagem' });
  }
}
