// api/lead-in.js
// Porta de entrada de leads vindos de fora: formulário do site, Meta Ads,
// Google Ads, Zapier, Make — qualquer coisa que saiba fazer um POST.
//
// Antes disso, todo lead entrava digitado à mão, e a origem era escolhida num
// select — justamente o campo que alimenta o lead scoring.

import { obterBanco } from './_auth.js';
import {
  achatar, normalizarMeta, extrairCampos, extrairUtm,
  acharDuplicado, camposParaCompletar,
} from './_leadIn.js';

export default async function handler(req, res) {
  // Health check, para a plataforma validar a URL antes de mandar dados
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'ok', service: 'lead-in' });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // ── Segredo ──
  // Sem isso, qualquer um poderia encher a base de lixo.
  const segredo = process.env.LEAD_IN_SECRET;
  if (!segredo) {
    console.error('[lead-in] LEAD_IN_SECRET não configurado.');
    return res.status(500).json({ error: 'Entrada de leads não configurada no servidor.' });
  }

  const recebido = req.headers?.['x-webhook-secret'] || req.query?.secret;
  if (recebido !== segredo) {
    console.warn('[lead-in] Segredo inválido — recusado.');
    return res.status(403).json({ error: 'Não autorizado' });
  }

  try {
    const corpo = req.body || {};
    const plano = normalizarMeta(corpo) || achatar(corpo);
    const campos = extrairCampos(plano);

    if (!campos.nome && !campos.email && !campos.telefone && !campos.whatsapp) {
      return res.status(400).json({
        error: 'Não encontrei nome, e-mail nem telefone no payload.',
        camposRecebidos: Object.keys(plano).slice(0, 20),
      });
    }

    const db = obterBanco();
    const agora = new Date().toISOString();

    // ── Deduplicação ──
    // A mesma pessoa preenchendo o formulário duas vezes não deve virar dois
    // leads. Procura por e-mail e por telefone antes de criar.
    const snap = await db.ref('crm_data/leads').once('value');
    const existentes = snap.val() || {};

    const duplicado = acharDuplicado(existentes, campos);

    const utm = extrairUtm(plano);
    const origem = corpo.origem || utm?.utmsource || 'site';

    if (duplicado) {
      const [idExistente, leadExistente] = duplicado;
      // Não sobrescreve o que já existe: só completa buracos e anota o retorno
      const completar = camposParaCompletar(leadExistente, campos);
      completar.updatedAt = agora;
      completar.ultimoFormulario = agora;

      await db.ref(`crm_data/leads/${idExistente}`).update(completar);

      const atividadeRef = db.ref('crm_data/atividades').push();
      await atividadeRef.set({
        id: atividadeRef.key,
        leadId: idExistente,
        leadNome: leadExistente.nome || campos.nome || '',
        tipo: 'nota',
        descricao: `Preencheu o formulário de novo (${origem})`,
        autorUid: null,
        autorNome: 'Entrada automática',
        criadoEm: agora,
      });

      console.log(`[lead-in] Duplicado — atualizou o lead ${idExistente}`);
      return res.status(200).json({ success: true, duplicado: true, leadId: idExistente });
    }

    // ── Lead novo ──
    const novaRef = db.ref('crm_data/leads').push();
    const lead = {
      id: novaRef.key,
      nome: campos.nome || campos.email || campos.telefone || 'Sem nome',
      status: corpo.status || 'lead-qualificado',
      origem,
      createdAt: agora,
      updatedAt: agora,
      data_entrada: agora.slice(0, 10),
      entradaAutomatica: true,
      ...campos,
    };
    if (utm) lead.utm = utm;
    if (corpo.responsavel) lead.responsavel = corpo.responsavel;

    await novaRef.set(lead);

    const atividadeRef = db.ref('crm_data/atividades').push();
    await atividadeRef.set({
      id: atividadeRef.key,
      leadId: novaRef.key,
      leadNome: lead.nome,
      tipo: 'criado',
      descricao: `Lead entrou automaticamente via ${origem}`,
      detalhe: utm || null,
      autorUid: null,
      autorNome: 'Entrada automática',
      criadoEm: agora,
    });

    console.log(`[lead-in] Lead criado: ${lead.nome} (${origem})`);
    return res.status(201).json({ success: true, leadId: novaRef.key, nome: lead.nome });

  } catch (erro) {
    console.error('[lead-in] Erro:', erro);
    return res.status(500).json({ error: 'Erro ao registrar o lead.' });
  }
}
