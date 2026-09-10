// api/agendar-reuniao.js
// Marca a reunião em três lugares de uma vez: evento no Google Agenda, e-mail
// de confirmação para o lead, e tarefa para mandar a confirmação por mensagem.
//
// As três etapas são independentes de propósito. Se o Google recusar o evento,
// o e-mail ainda sai; se o e-mail falhar, a tarefa ainda é criada. Uma reunião
// meio marcada é melhor do que nenhuma, desde que a tela diga com todas as
// letras o que deu certo e o que não deu — por isso a resposta detalha cada
// etapa em vez de devolver um sucesso ou um erro só.

import nodemailer from 'nodemailer';
import { exigirUsuario, obterBanco, comPrazo, explicarErroDeCredencial } from './_auth.js';
import { configuracaoSmtp, explicarErroSmtp, montarHtml, responderPara } from './_email.js';
import {
  configuracaoAgenda, montarEvento, criarEvento,
  textoConfirmacao, textoDataHora, explicarErroAgenda, subtrairHoras,
} from './_agenda.js';
import { podeUsarWhatsApp, validarMudancaStatus, descricaoBloqueio } from '../src/processoProspeccao.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const usuario = await exigirUsuario(req, res);
  if (!usuario) return;

  const {
    lead, dataHora, duracaoMin = 30, objetivo = '', participantes = '',
    linkLocal = '', observacao = '', enviarEmail = true, conviteJaEnviado = false,
  } = req.body || {};

  if (!lead?.id || !lead?.nome) return res.status(400).json({ error: 'Informe o lead.' });
  if (!textoDataHora(dataHora)) return res.status(400).json({ error: 'Informe a data e a hora da reunião.' });
  if (!String(objetivo).trim()) return res.status(400).json({ error: 'Informe o objetivo da reunião.' });
  if (!String(participantes).trim()) return res.status(400).json({ error: 'Informe os participantes da reunião.' });
  if (!String(linkLocal).trim()) return res.status(400).json({ error: 'Informe o link ou local da reunião.' });
  if ((!enviarEmail || !lead.email) && !conviteJaEnviado) {
    return res.status(400).json({ error: 'Envie o convite por e-mail ou confirme que ele já foi enviado por outro canal.' });
  }

  const whatsappPermitido = podeUsarWhatsApp(lead);
  const canal = lead.email ? 'email' : whatsappPermitido ? 'whatsapp' : lead.telefone ? 'telefone' : '';
  const t24 = subtrairHoras(dataHora, 24);
  const t2 = subtrairHoras(dataHora, 2);
  const candidato = {
    ...lead,
    reuniaoDataHora: dataHora,
    reuniaoDuracaoMin: Number(duracaoMin) || 30,
    reuniaoObjetivo: String(objetivo).trim(),
    reuniaoParticipantes: String(participantes).trim(),
    reuniaoLinkLocal: String(linkLocal).trim(),
    conviteEnviado: true,
    proximaAcao: 'Confirmar presença na reunião',
    proximaAcaoDataHora: t24 || dataHora,
    proximaAcaoCanal: canal,
    proximaAcaoResponsavel: lead.responsavel || usuario.email || '',
    proximaAcaoObjetivo: 'Obter aceite explícito do participante',
  };
  const validacao = validarMudancaStatus(candidato, 'reuniao-marcada');
  if (!validacao.ok) return res.status(400).json({ error: descricaoBloqueio(validacao.pendencias) });

  const resultado = {
    agenda: { feito: false, motivo: null, link: null },
    email:  { feito: false, motivo: null },
    tarefa: { feito: false, motivo: null },
    lead:   { feito: false, motivo: null },
  };

  // ── 1. Evento no Google Agenda ──
  const cfgAgenda = configuracaoAgenda();
  if (!cfgAgenda) {
    resultado.agenda.motivo = 'A agenda do Google ainda não foi configurada no servidor.';
  } else {
    try {
      const evento = montarEvento(lead, { dataHora, duracaoMin, objetivo, participantes, linkLocal, observacao, fuso: cfgAgenda.fuso });
      const criado = await criarEvento(cfgAgenda, evento);
      resultado.agenda = { feito: true, motivo: null, link: criado.link };
    } catch (erro) {
      console.error('[agenda] Falha ao criar evento:', erro?.message);
      resultado.agenda.motivo = explicarErroAgenda(erro) || 'Não foi possível criar o evento.';
    }
  }

  // ── 2. E-mail de confirmação para o lead ──
  const smtp = configuracaoSmtp();
  if (!enviarEmail) {
    resultado.email.motivo = 'Envio não solicitado.';
  } else if (!lead.email) {
    resultado.email.motivo = 'O lead não tem e-mail cadastrado.';
  } else if (!smtp) {
    resultado.email.motivo = 'O envio de e-mail ainda não foi configurado no servidor.';
  } else {
    try {
      const { assunto, corpo } = textoConfirmacao(lead, {
        dataHora, duracaoMin, objetivo, participantes, linkLocal, observacao, empresa: smtp.nome,
      });
      const transporte = nodemailer.createTransport({
        host: smtp.host, port: smtp.port, secure: smtp.secure, auth: smtp.auth,
      });
      await transporte.sendMail({
        from: `"${smtp.nome}" <${smtp.remetente}>`,
        to: lead.email,
        replyTo: responderPara(usuario.email, smtp.remetente),
        subject: assunto,
        text: corpo,
        html: montarHtml(corpo),
      });
      resultado.email.feito = true;
    } catch (erro) {
      console.error('[agenda] Falha no e-mail:', erro?.code, erro?.message);
      resultado.email.motivo = explicarErroSmtp(erro) || 'Não foi possível enviar o e-mail.';
    }
  }

  // ── 3. Lembretes e reunião no lead, em uma única gravação ──
  try {
    const db = obterBanco();
    const agora = new Date().toISOString();
    const quando = textoDataHora(dataHora);

    const conviteEnviado = Boolean(conviteJaEnviado || resultado.email.feito);
    const refT24 = db.ref('crm_data/tarefas').push();
    const refT2 = db.ref('crm_data/tarefas').push();
    const refAtividade = db.ref('crm_data/atividades').push();
    const tarefa = (id, antecedencia, vencimento) => ({
      id, leadId: lead.id, leadNome: lead.nome,
      titulo: `${antecedencia}: confirmar reunião de ${quando}`,
      descricao: canal
        ? `Confirmar por ${canal}. Objetivo: ${objetivo}. Link/local: ${linkLocal}.`
        : `Escolher um canal permitido e confirmar. Objetivo: ${objetivo}.`,
      data: String(vencimento || dataHora).slice(0, 10),
      hora: String(vencimento || '').slice(11, 16),
      responsavel: lead.responsavel || '', prioridade: 'alta', concluida: false,
      createdAt: agora, updatedAt: agora,
    });
    const gravacoes = {
      [`crm_data/tarefas/${refT24.key}`]: tarefa(refT24.key, 'T-24h', t24),
      [`crm_data/tarefas/${refT2.key}`]: tarefa(refT2.key, 'T-2h', t2),
      [`crm_data/atividades/${refAtividade.key}`]: {
        id: refAtividade.key, leadId: lead.id, leadNome: lead.nome, tipo: 'reuniao',
        descricao: `Reunião marcada para ${quando}; confirmação explícita pendente`
          + (resultado.agenda.feito ? ', com evento no Google Agenda' : '')
          + (resultado.email.feito ? ' e convite enviado por e-mail' : ''),
        autor: usuario.email || '', criadoEm: agora,
      },
      [`crm_data/leads/${lead.id}/reuniao`]: String(dataHora).slice(0, 10),
      [`crm_data/leads/${lead.id}/reuniaoDataHora`]: dataHora,
      [`crm_data/leads/${lead.id}/reuniaoDuracaoMin`]: Number(duracaoMin) || 30,
      [`crm_data/leads/${lead.id}/reuniaoObjetivo`]: String(objetivo).trim(),
      [`crm_data/leads/${lead.id}/reuniaoParticipantes`]: String(participantes).trim(),
      [`crm_data/leads/${lead.id}/reuniaoLinkLocal`]: String(linkLocal).trim(),
      [`crm_data/leads/${lead.id}/conviteEnviado`]: conviteEnviado,
      [`crm_data/leads/${lead.id}/confirmacaoExplicita`]: false,
      [`crm_data/leads/${lead.id}/status`]: conviteEnviado ? 'reuniao-marcada' : (lead.status || 'contato-decisor'),
      [`crm_data/leads/${lead.id}/proximaAcao`]: 'Confirmar presença na reunião',
      [`crm_data/leads/${lead.id}/proximaAcaoDataHora`]: t24 || dataHora,
      [`crm_data/leads/${lead.id}/proximaAcaoCanal`]: canal,
      [`crm_data/leads/${lead.id}/proximaAcaoResponsavel`]: lead.responsavel || usuario.email || '',
      [`crm_data/leads/${lead.id}/proximaAcaoObjetivo`]: 'Obter aceite explícito do participante',
      [`crm_data/leads/${lead.id}/updatedAt`]: agora,
    };
    await comPrazo(db.ref().update(gravacoes));
    resultado.tarefa.feito = true;
    resultado.lead.feito = conviteEnviado;
    if (!conviteEnviado) resultado.lead.motivo = 'O convite não foi enviado; os dados foram salvos, mas a etapa não avançou.';
  } catch (erro) {
    console.error('[agenda] Falha ao gravar:', erro?.message);
    const motivo = explicarErroDeCredencial(erro) || 'Não foi possível gravar no banco.';
    if (!resultado.tarefa.feito) resultado.tarefa.motivo = motivo;
    if (!resultado.lead.feito) resultado.lead.motivo = motivo;
  }

  console.log(`[agenda] ${usuario.email} marcou reunião com ${lead.nome}: `
    + `agenda=${resultado.agenda.feito} email=${resultado.email.feito} tarefa=${resultado.tarefa.feito}`);

  // 200 mesmo com etapa falha: a tela mostra o que deu certo e o que não deu.
  // Devolver 500 faria a interface descartar o que funcionou.
  return res.status(200).json(resultado);
}

