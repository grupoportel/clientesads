// Execução das automações: a única parte que toca o banco.
// A decisão de quais regras disparam vive em automacoes.js, sem Firebase.

import { ref, push, update, get } from 'firebase/database';
import { database } from './firebase';
import { acharEtapa } from './pipeline';
import { montarContexto } from './modelos';
import { regrasQueDisparam, planejarAcoes } from './automacoes';

// Chave que identifica um disparo já feito. Sem ela, dois vendedores com o CRM
// aberto criariam duas tarefas para a mesma mudança de status.
const chaveDisparo = (regraId, leadId, statusAlvo) =>
  `${regraId}__${leadId}__${statusAlvo || 'x'}`;

/**
 * Executa as regras que casam com o evento.
 * Devolve um resumo do que foi feito, para a interface avisar o usuário.
 */
export async function rodarAutomacoes({ regras, evento, empresa = '', meuNome = '', etapas = [] }) {
  const disparadas = regras ? regrasQueDisparam(regras, evento) : [];
  if (disparadas.length === 0) return { tarefasCriadas: 0, camposPreenchidos: 0, regras: [] };

  const lead = evento.lead;
  const vars = montarContexto(lead, { empresa, meuNome });
  const agora = new Date();
  const agoraISO = agora.toISOString();

  const resumo = { tarefasCriadas: 0, camposPreenchidos: 0, regras: [] };
  const gravacoesTarefas = {};
  const gravacoesLead = {};
  const gravacoesLog = {};
  const atividades = [];

  for (const regra of disparadas) {
    const chave = chaveDisparo(regra.id, lead.id, lead.status);

    // Trava contra disparo duplicado: se o log já tem a chave, pula.
    // Sequencial de propósito — são poucas regras, e paralelizar aqui só
    // trocaria uma leitura barata por complexidade.
    const jaRodou = await get(ref(database, `crm_data/automacoes_log/${chave}`))
      .then(s => s.exists())
      .catch(() => false); // falha de leitura não deve travar a ação principal

    if (jaRodou) continue;

    const plano = planejarAcoes(regra, lead, { vars, agora });

    plano.tarefas.forEach(tarefa => {
      const novaRef = push(ref(database, 'crm_data/tarefas'));
      gravacoesTarefas[novaRef.key] = {
        ...tarefa,
        id: novaRef.key,
        concluida: false,
        createdAt: agoraISO,
        updatedAt: agoraISO,
        criadaPorAutomacao: regra.id,
      };
      resumo.tarefasCriadas++;
      atividades.push({
        leadId: lead.id, leadNome: lead.nome, tipo: 'tarefaCriada',
        descricao: `Automação "${regra.nome}" criou a tarefa "${tarefa.titulo}"`,
      });
    });

    Object.entries(plano.camposDoLead).forEach(([campo, valor]) => {
      gravacoesLead[`${lead.id}/${campo}`] = valor;
      resumo.camposPreenchidos++;
      atividades.push({
        leadId: lead.id, leadNome: lead.nome, tipo: 'editado',
        descricao: `Automação "${regra.nome}" preencheu ${campo} com "${valor}"`,
      });
    });

    plano.notas.forEach(texto => {
      atividades.push({
        leadId: lead.id, leadNome: lead.nome, tipo: 'nota',
        descricao: texto,
      });
    });

    gravacoesLog[chave] = {
      regraId: regra.id,
      regraNome: regra.nome,
      leadId: lead.id,
      status: lead.status || null,
      em: agoraISO,
    };
    resumo.regras.push(regra.nome);
  }

  if (resumo.regras.length === 0) return resumo;

  try {
    const gravacoes = [];
    if (Object.keys(gravacoesTarefas).length) {
      gravacoes.push(update(ref(database, 'crm_data/tarefas'), gravacoesTarefas));
    }
    if (Object.keys(gravacoesLead).length) {
      gravacoes.push(update(ref(database, 'crm_data/leads'), {
        ...gravacoesLead,
        [`${lead.id}/updatedAt`]: agoraISO,
      }));
    }
    gravacoes.push(update(ref(database, 'crm_data/automacoes_log'), gravacoesLog));
    await Promise.all(gravacoes);
  } catch (erro) {
    console.warn('[automacoes] Falha ao executar:', erro?.message);
    return { tarefasCriadas: 0, camposPreenchidos: 0, regras: [], erro: erro?.message };
  }

  resumo.atividades = atividades;
  // etapas entra só para a interface poder nomear a etapa no aviso
  resumo.etapaAlvo = etapas.length ? acharEtapa(etapas, lead.status).label : lead.status;
  return resumo;
}

