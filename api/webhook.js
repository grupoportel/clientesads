// api/webhook.js
// Vercel Serverless Function — Meta WhatsApp Webhook
// GET: Verificação do Webhook pela Meta
// POST: Recebimento de mensagens dos clientes

import admin from 'firebase-admin';

// ── Inicializa o Firebase Admin (uma única vez) ──
// As credenciais vêm de variáveis de ambiente configuradas no Vercel
// NUNCA colocar chaves diretamente aqui no código
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // A chave privada tem quebras de linha escapadas no Vercel — o replace corrige isso
      privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
}

const db = admin.database();

// ── Handler Principal ──
export default async function handler(req, res) {
  // Segurança: apenas aceitar requisições da Meta
  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

  // ────────────────────────────────────────────
  // GET: Verificação do Webhook pela Meta
  // A Meta faz um GET com esses parâmetros para confirmar que somos nós
  // ────────────────────────────────────────────
  if (req.method === 'GET') {
    const mode      = req.query['hub.mode'];
    const token     = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('[Webhook] Verificação bem-sucedida pela Meta.');
      return res.status(200).send(challenge); // resposta obrigatória
    }

    console.warn('[Webhook] Token de verificação incorreto.');
    return res.status(403).json({ error: 'Token inválido' });
  }

  // ────────────────────────────────────────────
  // POST: Mensagem recebida de um cliente
  // ────────────────────────────────────────────
  if (req.method === 'POST') {
    try {
      const body = req.body;

      // Confirma que é uma mensagem de WhatsApp Business
      if (body?.object !== 'whatsapp_business_account') {
        return res.sendStatus(404);
      }

      const changes = body?.entry?.[0]?.changes?.[0]?.value;
      const messages = changes?.messages;

      if (!messages || messages.length === 0) {
        // Pode ser uma notificação de status (entregue, lido) — ignorar silenciosamente
        return res.sendStatus(200);
      }

      for (const msg of messages) {
        const remetente = msg.from;            // Número do cliente (ex: 5511999999999)
        const timestamp = new Date(parseInt(msg.timestamp) * 1000).toISOString();

        // Extrair o texto da mensagem (texto, imagem, áudio, etc.)
        let texto = '';
        let tipo  = 'texto';

        if (msg.type === 'text') {
          texto = msg.text?.body || '';
        } else if (msg.type === 'image') {
          texto = '📷 [Imagem recebida]';
          tipo  = 'imagem';
        } else if (msg.type === 'audio') {
          texto = '🎵 [Áudio recebido]';
          tipo  = 'audio';
        } else if (msg.type === 'document') {
          texto = `📄 [Documento: ${msg.document?.filename || 'arquivo'}]`;
          tipo  = 'documento';
        } else if (msg.type === 'video') {
          texto = '🎬 [Vídeo recebido]';
          tipo  = 'video';
        } else {
          texto = `[Mensagem do tipo: ${msg.type}]`;
        }

        // Nome do contato (se disponível)
        const nomeContato = changes?.contacts?.[0]?.profile?.name || remetente;

        // ── Buscar ou criar a conversa no Firebase ──
        const conversasRef = db.ref('crm_data/conversas');
        const snapshot = await conversasRef.orderByChild('telefone').equalTo(remetente).limitToFirst(1).once('value');

        let conversaId = null;
        let conversaExistente = false;

        snapshot.forEach((child) => {
          conversaId = child.key;
          conversaExistente = true;
        });

        if (!conversaExistente) {
          // Criar nova conversa automaticamente
          const novaConversaRef = conversasRef.push();
          conversaId = novaConversaRef.key;
          await novaConversaRef.set({
            id:              conversaId,
            leadId:          null,              // Pode ser vinculado manualmente depois
            nome:            nomeContato,
            telefone:        remetente,
            nicho:           '',
            ultimaMensagem:  texto,
            ultimaAt:        timestamp,
            naoLidas:        1,
            arquivada:       false,
            tipo:            'individual',
            criadoPorWebhook: true,
          });
        } else {
          // Atualizar última mensagem e contador de não lidas
          const conversaRef = db.ref(`crm_data/conversas/${conversaId}`);
          const snap = await conversaRef.once('value');
          const naoLidasAtual = snap.val()?.naoLidas || 0;

          await conversaRef.update({
            ultimaMensagem: texto,
            ultimaAt:       timestamp,
            naoLidas:       naoLidasAtual + 1,
          });
        }

        // ── Salvar a mensagem na sub-coleção ──
        const msgRef = db.ref(`crm_data/conversas/${conversaId}/mensagens`).push();
        await msgRef.set({
          texto,
          tipo,
          criadoEm: timestamp,
          origem:   'entrada',  // 'entrada' = veio do cliente, 'saida' = enviou o CRM
          lida:     false,
          waMessageId: msg.id,  // ID original da Meta (para evitar duplicatas futuramente)
        });

        console.log(`[Webhook] Mensagem salva — conversa: ${conversaId}`);
      }

      return res.sendStatus(200);
    } catch (error) {
      console.error('[Webhook] Erro ao processar mensagem:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  // Qualquer outro método HTTP
  return res.status(405).json({ error: 'Método não permitido' });
}
