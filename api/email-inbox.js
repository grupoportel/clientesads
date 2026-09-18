import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { exigirUsuario, obterBanco, comPrazo } from './_auth.js';
import {
  configuracaoImap, explicarErroImap, mascararEndereco, normalizarEndereco,
} from './_email.js';
import {
  acharLeadPorEmail, chaveMensagem, enderecoPrincipal, textoDoEmail,
} from './_emailStore.js';

const MAX_MENSAGENS_INICIAIS = 30;
const MAX_MENSAGENS_POR_SYNC = 50;
const MAX_BYTES_POR_EMAIL = 2 * 1024 * 1024;

const listaDe = (valor) => Object.entries(valor || {}).map(([id, item]) => ({ id, ...item }));

async function carregarContexto(db) {
  const [mensagensSnap, leadsSnap, estadoSnap] = await Promise.all([
    comPrazo(db.ref('crm_data/emailMensagens').orderByChild('recebidoEm').limitToLast(120).once('value')),
    comPrazo(db.ref('crm_data/leads').once('value')),
    comPrazo(db.ref('crm_data/emailSync').once('value')),
  ]);
  return {
    mensagens: mensagensSnap.val() || {},
    leads: leadsSnap.val() || {},
    estado: estadoSnap.val() || {},
  };
}

function prepararLista(mensagens, leads) {
  return listaDe(mensagens)
    .filter(item => item.direcao === 'recebido')
    .map(item => {
      const lead = acharLeadPorEmail(leads, item.remetenteEmail);
      return {
        ...item,
        leadId: lead?.id || item.leadId || '',
        leadNome: lead?.nome || item.leadNome || '',
      };
    })
    .sort((a, b) => String(b.recebidoEm || '').localeCompare(String(a.recebidoEm || '')))
    .slice(0, 100);
}

async function listar(db, imap) {
  const contexto = await carregarContexto(db);
  return {
    configurado: Boolean(imap),
    caixa: imap ? mascararEndereco(imap.caixa) : '',
    ultimaSincronizacao: contexto.estado.ultimaSincronizacao || null,
    mensagens: prepararLista(contexto.mensagens, contexto.leads),
  };
}

async function sincronizar(db, imap, usuario) {
  if (!imap) {
    const erro = new Error('A caixa de entrada ainda não foi configurada no servidor.');
    erro.status = 503;
    throw erro;
  }

  const estadoRef = db.ref('crm_data/emailSync');
  const [estadoSnap, leadsSnap] = await Promise.all([
    comPrazo(estadoRef.once('value')),
    comPrazo(db.ref('crm_data/leads').once('value')),
  ]);
  const estado = estadoSnap.val() || {};
  const leads = leadsSnap.val() || {};
  const ultimoUid = Number(estado.ultimoUid) || 0;
  const cliente = new ImapFlow({
    host: imap.host,
    port: imap.port,
    secure: imap.secure,
    auth: imap.auth,
    logger: false,
    socketTimeout: 20000,
    greetingTimeout: 10000,
  });

  let lock;
  let uids;
  let novos = 0;
  let ignorados = 0;
  const agora = new Date().toISOString();

  try {
    await cliente.connect();
    lock = await cliente.getMailboxLock('INBOX');
    const encontrados = ultimoUid
      ? await cliente.search({ uid: `${ultimoUid + 1}:*` }, { uid: true })
      : await cliente.search({ all: true }, { uid: true });
    uids = Array.isArray(encontrados) ? encontrados.filter(uid => uid > ultimoUid) : [];
    uids = uids.slice(-(ultimoUid ? MAX_MENSAGENS_POR_SYNC : MAX_MENSAGENS_INICIAIS));

    if (uids.length) {
      for await (const item of cliente.fetch(
        uids.join(','),
        { uid: true, flags: true, envelope: true, internalDate: true, size: true, source: { maxLength: MAX_BYTES_POR_EMAIL } },
        { uid: true },
      )) {
        try {
          const parsed = await simpleParser(item.source || Buffer.alloc(0), {
            skipImageLinks: true,
            skipTextToHtml: true,
            maxHtmlLengthToParse: MAX_BYTES_POR_EMAIL,
          });
          const remetente = enderecoPrincipal(parsed.from);
          if (!remetente.email) {
            ignorados += 1;
            continue;
          }
          const id = chaveMensagem(imap.caixa, item.uid, parsed.messageId);
          const existente = await comPrazo(db.ref(`crm_data/emailMensagens/${id}`).once('value'));
          if (existente.exists()) {
            ignorados += 1;
            continue;
          }
          const lead = acharLeadPorEmail(leads, remetente.email);
          const recebidoEm = (parsed.date || item.internalDate || new Date()).toISOString();
          const anexos = (parsed.attachments || []).slice(0, 20).map(anexo => ({
            nome: String(anexo.filename || 'anexo').slice(0, 180),
            tipo: String(anexo.contentType || '').slice(0, 100),
            tamanho: Number(anexo.size) || 0,
          }));
          const mensagem = {
            direcao: 'recebido',
            uid: Number(item.uid),
            messageId: String(parsed.messageId || ''),
            remetenteNome: remetente.nome,
            remetenteEmail: remetente.email,
            destinatarioEmail: normalizarEndereco(imap.caixa),
            assunto: String(parsed.subject || '(sem assunto)').slice(0, 250),
            texto: textoDoEmail(parsed),
            recebidoEm,
            sincronizadoEm: agora,
            lidoNoServidor: item.flags?.has('\\Seen') || false,
            tamanho: Number(item.size) || 0,
            truncado: Number(item.size) > MAX_BYTES_POR_EMAIL,
            anexos,
            leadId: lead?.id || '',
            leadNome: lead?.nome || '',
          };
          const gravacoes = {
            [`crm_data/emailMensagens/${id}`]: mensagem,
          };
          if (lead) {
            const atividade = db.ref('crm_data/atividades').push();
            gravacoes[`crm_data/atividades/${atividade.key}`] = {
              id: atividade.key,
              leadId: lead.id,
              leadNome: lead.nome || '',
              tipo: 'email_recebido',
              descricao: `E-mail recebido: ${mensagem.assunto}`,
              autor: remetente.email,
              criadoEm: recebidoEm,
            };
            gravacoes[`crm_data/leads/${lead.id}/ultimoEmailRecebidoEm`] = recebidoEm;
            gravacoes[`crm_data/leads/${lead.id}/updatedAt`] = agora;
          }
          await comPrazo(db.ref().update(gravacoes));
          novos += 1;
        } catch (erroMensagem) {
          ignorados += 1;
          console.warn('[email-inbox] Mensagem ignorada:', item.uid, erroMensagem?.message);
        }
      }
    }
  } finally {
    if (lock) lock.release();
    if (cliente.usable) await cliente.logout().catch(() => {});
    else cliente.close();
  }

  const maiorUid = uids.length ? Math.max(ultimoUid, ...uids) : ultimoUid;
  await comPrazo(estadoRef.update({
    ultimoUid: maiorUid,
    ultimaSincronizacao: agora,
    sincronizadoPor: usuario.uid,
  }));
  return { novos, ignorados, ultimaSincronizacao: agora };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  const usuario = await exigirUsuario(req, res);
  if (!usuario) return;

  const db = obterBanco();
  const imap = configuracaoImap();
  const acao = req.body?.acao || 'listar';

  try {
    if (acao === 'listar') return res.status(200).json(await listar(db, imap));
    if (acao === 'sincronizar') {
      if (!['Admin', 'Editor'].includes(usuario.role)) {
        return res.status(403).json({ error: 'Seu perfil não permite sincronizar a caixa de entrada.' });
      }
      const resultado = await sincronizar(db, imap, usuario);
      return res.status(200).json({ ...resultado, ...(await listar(db, imap)) });
    }
    if (acao === 'marcar_lido') {
      const id = String(req.body?.id || '');
      if (!/^[a-f0-9]{64}$/.test(id)) return res.status(400).json({ error: 'Mensagem inválida.' });
      await comPrazo(db.ref(`crm_data/emailMensagens/${id}/lidoNoCrm`).set(true));
      return res.status(200).json({ success: true });
    }
    return res.status(400).json({ error: 'Ação de e-mail desconhecida.' });
  } catch (erro) {
    console.error('[email-inbox] Falha:', erro?.code, erro?.message);
    return res.status(erro.status || 500).json({
      error: explicarErroImap(erro) || 'Não foi possível acessar a caixa de entrada. Tente novamente.',
    });
  }
}
