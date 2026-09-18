// api/send-email.js
// Vercel Serverless Function — Envio de e-mails por SMTP.
// Exige token de sessão do Firebase: sem isso, qualquer pessoa poderia enviar
// e-mails assinados como Grupo Portel.
//
// O provedor vem das variáveis de ambiente, não do código: ver api/_email.js.

import nodemailer from 'nodemailer';
import { exigirUsuario, obterBanco, comPrazo } from './_auth.js';
import {
  configuracaoSmtp, explicarErroSmtp, montarEmailVisual, prepararAnexos, prepararImagemInline, responderPara,
} from './_email.js';
import { chaveMensagem } from './_emailStore.js';

const INTERVALO_GLOBAL_MS = 8000;
const INTERVALO_POR_LEAD_MS = 72 * 60 * 60 * 1000;

async function reservarEnvio(db, uid, leadId, resposta = false) {
  const agora = Date.now();
  const globalRef = db.ref(`crm_data/controles/envioEmail/usuarios/${uid}/ultimoEnvioMs`);
  const global = await comPrazo(globalRef.transaction(atual => {
    const anterior = Number(atual) || 0;
    return agora - anterior < INTERVALO_GLOBAL_MS ? undefined : agora;
  }));
  if (!global.committed) return { ok: false, tipo: 'global' };

  const leadRef = db.ref(`crm_data/controles/envioEmail/leads/${leadId}`);
  const lead = await comPrazo(leadRef.transaction(atual => {
    const ultimo = Number(atual?.ultimoEnvioMs) || 0;
    const reservado = Number(atual?.reservadoEmMs) || 0;
    // Uma resposta a uma mensagem recebida faz parte de uma conversa em
    // andamento; ela não é uma nova abordagem e não deve esperar 72 horas.
    if ((!resposta && agora - ultimo < INTERVALO_POR_LEAD_MS) || agora - reservado < 2 * 60 * 1000) return undefined;
    return { ...atual, reservadoEmMs: agora, reservadoPor: uid };
  }));
  if (!lead.committed) return { ok: false, tipo: 'lead' };
  return { ok: true, agora, leadRef };
}

const emailValido = (valor) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(valor || '').trim());
const httpsValida = (valor) => {
  if (!valor) return true;
  try { return new URL(String(valor)).protocol === 'https:'; } catch { return false; }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // ── Porteiro ──
  const usuario = await exigirUsuario(req, res, { papeis: ['Admin', 'Editor'] });
  if (!usuario) return;

  const {
    leadId, para, assunto, corpo,
    imagemUrl = '', imagemDataUrl = '', ctaTexto = '', ctaUrl = '', campanha = false,
    respostaAId = '', anexos = [],
  } = req.body || {};

  if (!leadId) return res.status(400).json({ error: 'Selecione um lead do CRM.' });
  if (!emailValido(para) || !String(assunto).trim() || !String(corpo).trim())
    return res.status(400).json({ error: 'Preencha destinatário, assunto e mensagem.' });
  if (String(assunto).length > 150 || String(corpo).length > 10000)
    return res.status(400).json({ error: 'O assunto ou a mensagem ultrapassa o limite permitido.' });
  if (String(ctaTexto).length > 60 || String(imagemUrl).length > 2048 || String(ctaUrl).length > 2048)
    return res.status(400).json({ error: 'A imagem ou o botão ultrapassa o limite permitido.' });
  if (String(imagemDataUrl).length > 2100000)
    return res.status(400).json({ error: 'A imagem incorporada ultrapassa o limite de 1,5 MB.' });
  if (!Array.isArray(anexos) || anexos.length > 3 || JSON.stringify(anexos).length > 4200000)
    return res.status(400).json({ error: 'Os anexos ultrapassam o limite permitido.' });
  if (!httpsValida(imagemUrl) || !httpsValida(ctaUrl))
    return res.status(400).json({ error: 'Imagem e botão devem usar links públicos HTTPS.' });
  if (Boolean(String(ctaTexto).trim()) !== Boolean(String(ctaUrl).trim()))
    return res.status(400).json({ error: 'Preencha o texto e o link do botão, ou deixe ambos vazios.' });

  let imagemInline;
  let anexosPreparados;
  try {
    imagemInline = prepararImagemInline(imagemDataUrl);
    anexosPreparados = prepararAnexos(anexos, imagemInline?.content.length || 0);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  const db = obterBanco();
  const leadSnap = await comPrazo(db.ref(`crm_data/leads/${leadId}`).once('value'));
  const lead = leadSnap.val();
  if (!lead) return res.status(404).json({ error: 'O lead não existe mais.' });
  if (String(lead.email || '').trim().toLowerCase() !== String(para).trim().toLowerCase())
    return res.status(400).json({ error: 'O destinatário não corresponde ao e-mail cadastrado no lead.' });
  if (lead.optOut === true || lead.optOut === 'true')
    return res.status(403).json({ error: 'Este contato pediu para não receber novas abordagens.' });
  if (campanha && !(lead.permissaoEmail === true || lead.permissaoEmail === 'true'))
    return res.status(403).json({ error: 'Este lead não autorizou receber campanhas por e-mail.' });

  let mensagemOrigem = null;
  if (respostaAId) {
    if (!/^[a-f0-9]{64}$/.test(String(respostaAId))) {
      return res.status(400).json({ error: 'A mensagem respondida é inválida.' });
    }
    const origemSnap = await comPrazo(db.ref(`crm_data/emailMensagens/${respostaAId}`).once('value'));
    mensagemOrigem = origemSnap.val();
    if (!mensagemOrigem || mensagemOrigem.direcao !== 'recebido') {
      return res.status(404).json({ error: 'A mensagem respondida não foi encontrada.' });
    }
    if (String(mensagemOrigem.leadId || '') && String(mensagemOrigem.leadId) !== String(leadId)) {
      return res.status(400).json({ error: 'A mensagem pertence a outro lead.' });
    }
    if (String(mensagemOrigem.remetenteEmail || '').toLowerCase() !== String(para).trim().toLowerCase()) {
      return res.status(400).json({ error: 'O destinatário não corresponde à mensagem recebida.' });
    }
  }

  const smtp = configuracaoSmtp();
  if (!smtp) {
    console.error('[Email] Nenhuma credencial SMTP configurada.');
    return res.status(500).json({
      error: 'O envio de e-mail ainda não foi configurado no servidor. '
        + 'Defina SMTP_HOST, SMTP_USER e SMTP_PASS.',
    });
  }

  const reserva = await reservarEnvio(db, usuario.uid, leadId, Boolean(mensagemOrigem));
  if (!reserva.ok) {
    return res.status(429).json({
      error: reserva.tipo === 'lead'
        ? 'Este lead já recebeu um e-mail nas últimas 72 horas.'
        : 'Aguarde alguns segundos antes do próximo envio.',
      motivo: reserva.tipo,
    });
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.auth,
  });

  let enviado;
  try {
    enviado = await transporter.sendMail({
      from: `"${smtp.nome}" <${smtp.remetente}>`,
      to: para,
      subject: assunto,
      replyTo: responderPara(usuario.email, smtp.remetente),
      inReplyTo: mensagemOrigem?.messageId || undefined,
      references: mensagemOrigem?.messageId ? [mensagemOrigem.messageId] : undefined,
      text: `${corpo}${ctaUrl ? `\n\n${ctaTexto}: ${ctaUrl}` : ''}`,
      html: montarEmailVisual(corpo, {
        imagemUrl: imagemInline ? '' : imagemUrl,
        imagemCid: imagemInline?.cid,
        ctaTexto,
        ctaUrl,
        nomeEmpresa: smtp.nome,
      }),
      attachments: [imagemInline, ...anexosPreparados].filter(Boolean),
    });
  } catch (error) {
    // Libera a reserva do lead quando o SMTP falha; assim uma tentativa
    // malsucedida não bloqueia o contato por 72 horas.
    if (reserva?.leadRef) {
      await reserva.leadRef.transaction(atual =>
        Number(atual?.reservadoEmMs) === reserva.agora ? null : atual
      ).catch(() => {});
    }
    console.error('[Email] Erro ao enviar e-mail:', error?.code, error?.message);
    return res.status(500).json({
      error: explicarErroSmtp(error) || 'Não foi possível enviar o e-mail. Tente novamente.',
    });
  }

  try {
    const agora = new Date().toISOString();
    await comPrazo(reserva.leadRef.set({
      ultimoEnvioMs: reserva.agora,
      ultimoEnvioEm: agora,
      ultimoAssunto: String(assunto).trim().slice(0, 150),
      enviadoPor: usuario.uid,
    }));
    await comPrazo(db.ref(`crm_data/leads/${leadId}`).update({
      ultimoEmailEnviadoEm: agora,
      ultimoEmailAssunto: String(assunto).trim().slice(0, 150),
      updatedAt: agora,
    }));
    const atividade = db.ref('crm_data/atividades').push();
    const idMensagem = chaveMensagem(smtp.remetente, reserva.agora, enviado.messageId);
    await comPrazo(db.ref().update({
      [`crm_data/atividades/${atividade.key}`]: {
        id: atividade.key, leadId, leadNome: lead.nome || '', tipo: 'email',
        descricao: `${mensagemOrigem ? 'Resposta enviada' : 'E-mail enviado'}: ${String(assunto).trim()}`,
        autor: usuario.email || '', criadoEm: agora,
      },
      [`crm_data/emailMensagens/${idMensagem}`]: {
        direcao: 'enviado',
        messageId: String(enviado.messageId || ''),
        respostaAId: mensagemOrigem ? String(respostaAId) : '',
        remetenteNome: smtp.nome,
        remetenteEmail: smtp.remetente,
        destinatarioEmail: String(para).trim().toLowerCase(),
        assunto: String(assunto).trim().slice(0, 250),
        texto: String(corpo).slice(0, 50000),
        imagemIncluida: Boolean(imagemInline || imagemUrl),
        anexos: anexosPreparados.map(item => ({ nome: item.filename, tipo: item.contentType })),
        enviadoEm: agora,
        leadId,
        leadNome: lead.nome || '',
        enviadoPor: usuario.uid,
      },
    }));

    console.log(`[Email] Enviado por ${usuario.email} para ${para} via ${smtp.host}`);
    return res.status(200).json({ success: true, message: mensagemOrigem ? 'Resposta enviada com sucesso!' : 'E-mail enviado com sucesso!' });
  } catch (erroRegistro) {
    // O SMTP já confirmou a entrega ao servidor. Responder 500 aqui induziria
    // a pessoa a clicar novamente e poderia duplicar a mensagem.
    console.error('[Email] Enviado, mas sem registro completo:', erroRegistro?.message);
    return res.status(200).json({
      success: true,
      warning: true,
      message: 'O e-mail foi enviado, mas o CRM não conseguiu completar o registro no histórico. Não envie novamente.',
    });
  }
}
