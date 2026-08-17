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
import { configuracaoSmtp, explicarErroSmtp, montarHtml } from './_email.js';
import {
  configuracaoAgenda, montarEvento, criarEvento,
  textoConfirmacao, textoDataHora, explicarErroAgenda,
} from './_agenda.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const usuario = await exigirUsuario(req, res);
  if (!usuario) return;

  const { lead, dataHora, duracaoMin = 60, observacao = '', enviarEmail = true } = req.body || {};

  if (!lead?.id || !lead?.nome) return res.status(400).json({ error: 'Informe o lead.' });
  if (!textoDataHora(dataHora)) return res.status(400).json({ error: 'Informe a data e a hora da reunião.' });

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
      const evento = montarEvento(lead, { dataHora, duracaoMin, observacao, fuso: cfgAgenda.fuso });
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
      const { assunto, corpo } = textoConfirmacao(lead, { dataHora, duracaoMin, observacao, empresa: smtp.nome });
      const transporte = nodemailer.createTransport({
        host: smtp.host, port: smtp.port, secure: smtp.secure, auth: smtp.auth,
      });
      await transporte.sendMail({
        from: `"${smtp.nome}" <${smtp.remetente}>`,
        to: lead.email,
        replyTo: usuario.email || smtp.remetente,
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

  // ── 3. Tarefa de confirmar por mensagem, e data da reunião no lead ──
  // O e-mail já foi, mas quem responde de verdade é o WhatsApp. A tarefa
  // existe para que essa confirmação não dependa de alguém lembrar.
  try {
    const db = obterBanco();
    const agora = new Date().toISOString();
    const quando = textoDataHora(dataHora);

    const refTarefa = db.ref('crm_data/tarefas').push();
    await comPrazo(refTarefa.set({
      id: refTarefa.key,
      leadId: lead.id,
      leadNome: lead.nome,
      titulo: `Confirmar por mensagem a reunião de ${quando}`,
      descricao: lead.whatsapp || lead.telefone
        ? `Mandar confirmação para ${lead.whatsapp || lead.telefone}.`
        : 'O lead não tem telefone cadastrado.',
      data: String(dataHora).slice(0, 10),
      responsavel: lead.responsavel || '',
      prioridade: 'alta',
      concluida: false,
      createdAt: agora,
      updatedAt: agora,
    }));
    resultado.tarefa.feito = true;

    await comPrazo(db.ref(`crm_data/leads/${lead.id}`).update({
      reuniao: String(dataHora).slice(0, 10),
      updatedAt: agora,
    }));
    resultado.lead.feito = true;

    const refAtividade = db.ref('crm_data/atividades').push();
    await comPrazo(refAtividade.set({
      id: refAtividade.key,
      leadId: lead.id,
      leadNome: lead.nome,
      tipo: 'reuniao',
      descricao: `Reunião marcada para ${quando}`
        + (resultado.agenda.feito ? ', com evento no Google Agenda' : '')
        + (resultado.email.feito ? ' e e-mail de confirmação enviado' : ''),
      autor: usuario.email || '',
      criadoEm: agora,
    }));
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
