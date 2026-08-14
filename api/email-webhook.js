// api/email-webhook.js
// Vercel Serverless Function — Recebimento de E-mails via Google Apps Script
// Este endpoint é chamado pelo script do Google quando um novo e-mail chega
// na caixa do Gmail (timeportel@gmail.com).

import { obterBanco } from './_auth.js';

export default async function handler(req, res) {
  // ── Health check (GET) — sempre retornar 200 ──────────────────────────────
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'ok', service: 'email-webhook' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // ── Verificação de segurança — token secreto enviado pelo Apps Script ──────
  const TOKEN_SECRETO  = process.env.EMAIL_WEBHOOK_SECRET || 'portelcrm_email_secret';
  const tokenRecebido  = req.headers?.['x-webhook-secret'] || req.query?.secret;

  if (tokenRecebido !== TOKEN_SECRETO) {
    console.warn('[EmailWebhook] Token inválido — acesso bloqueado.');
    return res.status(403).json({ error: 'Não autorizado' });
  }

  // ── Validar body ──────────────────────────────────────────────────────────
  const body = req.body || {};
  const { de, assunto, corpo, dataRecebimento } = body;

  if (!de || !corpo) {
    console.warn('[EmailWebhook] Payload inválido — campos obrigatórios ausentes.');
    return res.status(400).json({ error: 'Campos "de" e "corpo" são obrigatórios.' });
  }

  try {
    const db   = obterBanco();
    const agora = dataRecebimento || new Date().toISOString();

    // ── Extrair nome e e-mail do remetente ────────────────────────────────
    // Formato possível: "João Silva <joao@email.com>" ou apenas "joao@email.com"
    const matchNome     = de.match(/^"?([^"<]+)"?\s*</);
    const nomeRemetente = matchNome ? matchNome[1].trim() : de;
    const matchEmail    = de.match(/<([^>]+)>/);
    const emailRemetente = matchEmail ? matchEmail[1].trim() : de.trim();

    // ── Buscar thread existente com esse e-mail no Firebase ───────────────
    const emailsRef = db.ref('crm_data/emails');
    const snapshot  = await emailsRef
      .orderByChild('email')
      .equalTo(emailRemetente)
      .limitToFirst(1)
      .once('value');

    let threadId     = null;
    let threadExiste = false;

    snapshot.forEach((child) => {
      threadId     = child.key;
      threadExiste = true;
    });

    if (!threadExiste) {
      // ── Criar nova thread ──────────────────────────────────────────────
      const novaRef = emailsRef.push();
      threadId      = novaRef.key;
      await novaRef.set({
        id:              threadId,
        nome:            nomeRemetente,
        email:           emailRemetente,
        assunto:         assunto || '(sem assunto)',
        ultimaMensagem:  corpo.substring(0, 120),
        ultimaAt:        agora,
        naoLidas:        1,
        origem:          'entrada',
        criadoPorWebhook: true,
      });
    } else {
      // ── Atualizar thread existente ─────────────────────────────────────
      const threadRef      = db.ref(`crm_data/emails/${threadId}`);
      const snap           = await threadRef.once('value');
      const naoLidasAtual  = snap.val()?.naoLidas || 0;
      await threadRef.update({
        ultimaMensagem: corpo.substring(0, 120),
        ultimaAt:       agora,
        naoLidas:       naoLidasAtual + 1,
        // Marca que a conversa teve resposta do cliente. É isso que mantém a
        // thread na aba "Recebidos" mesmo depois de lida.
        temResposta:    true,
      });
    }

    // ── Salvar mensagem na sub-coleção ────────────────────────────────────
    const msgRef = db.ref(`crm_data/emails/${threadId}/mensagens`).push();
    await msgRef.set({
      texto:    corpo,
      assunto:  assunto || '(sem assunto)',
      criadoEm: agora,
      origem:   'entrada',
      de:       emailRemetente,
      para:     process.env.GMAIL_USER || 'timeportel@gmail.com',
    });

    console.log(`[EmailWebhook] ✅ E-mail de ${emailRemetente} salvo — thread: ${threadId}`);
    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('[EmailWebhook] ❌ Erro:', error.message);
    return res.status(500).json({ error: 'Erro interno do servidor', detail: error.message });
  }
}
