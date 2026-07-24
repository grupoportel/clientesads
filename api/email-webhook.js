// api/email-webhook.js
// Vercel Serverless Function — Recebimento de E-mails via Google Apps Script
// Este endpoint é chamado pelo script do Google quando um novo e-mail chega
// na caixa do Gmail (timeportel@gmail.com).

import admin from 'firebase-admin';

export default async function handler(req, res) {
  // Segurança: verificar o token secreto enviado pelo Google Apps Script
  const TOKEN_SECRETO = process.env.EMAIL_WEBHOOK_SECRET || 'portelcrm_email_secret';
  const tokenRecebido = req.headers['x-webhook-secret'] || req.query.secret;

  if (tokenRecebido !== TOKEN_SECRETO) {
    console.warn('[EmailWebhook] Token inválido — acesso bloqueado.');
    return res.status(403).json({ error: 'Não autorizado' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // ── Inicializar Firebase Admin ─────────────────────────────────────────────
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

  try {
    const { de, assunto, corpo, dataRecebimento } = req.body;

    if (!de || !corpo) {
      return res.status(400).json({ error: 'Campos "de" e "corpo" são obrigatórios.' });
    }

    const agora = dataRecebimento || new Date().toISOString();
    
    // ── Extrair nome do remetente (ex: "João Silva <joao@email.com>" → "João Silva") ──
    const matchNome = de.match(/^"?([^"<]+)"?\s*</);
    const nomeRemetente = matchNome ? matchNome[1].trim() : de;
    const matchEmail = de.match(/<([^>]+)>/);
    const emailRemetente = matchEmail ? matchEmail[1] : de;

    // ── Buscar thread existente com esse e-mail ────────────────────────────
    const emailsRef = db.ref('crm_data/emails');
    const snapshot = await emailsRef
      .orderByChild('email')
      .equalTo(emailRemetente)
      .limitToFirst(1)
      .once('value');

    let threadId = null;
    let threadExiste = false;

    snapshot.forEach((child) => {
      threadId = child.key;
      threadExiste = true;
    });

    if (!threadExiste) {
      // ── Criar nova thread ──────────────────────────────────────────────
      const novaRef = emailsRef.push();
      threadId = novaRef.key;
      await novaRef.set({
        id: threadId,
        nome: nomeRemetente,
        email: emailRemetente,
        assunto: assunto || '(sem assunto)',
        ultimaMensagem: corpo.substring(0, 120),
        ultimaAt: agora,
        naoLidas: 1,
        origem: 'entrada',
        criadoPorWebhook: true,
      });
    } else {
      // ── Atualizar thread existente ─────────────────────────────────────
      const threadRef = db.ref(`crm_data/emails/${threadId}`);
      const snap = await threadRef.once('value');
      const naoLidasAtual = snap.val()?.naoLidas || 0;
      await threadRef.update({
        ultimaMensagem: corpo.substring(0, 120),
        ultimaAt: agora,
        naoLidas: naoLidasAtual + 1,
      });
    }

    // ── Salvar mensagem na sub-coleção ─────────────────────────────────────
    const msgRef = db.ref(`crm_data/emails/${threadId}/mensagens`).push();
    await msgRef.set({
      texto: corpo,
      assunto: assunto || '(sem assunto)',
      criadoEm: agora,
      origem: 'entrada',
      de: emailRemetente,
      para: process.env.GMAIL_USER || 'timeportel@gmail.com',
    });

    console.log(`[EmailWebhook] E-mail recebido de ${emailRemetente} salvo na thread ${threadId}`);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[EmailWebhook] Erro:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
