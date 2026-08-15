// Motor de automações: regras "quando X acontecer, faça Y".
//
// Este arquivo é lógica pura, sem Firebase: quais regras disparam e o que elas
// produzem. A gravação vive em automacoesRunner.js. A separação é o que permite
// testar as regras sem subir banco nenhum.
//
// Roda no cliente, disparado pelas mesmas ações que já registram a linha do
// tempo. Isso significa que uma regra só executa quando alguém tem o CRM
// aberto — o preço de não ter servidor. Em compensação, não há defasagem:
// a tarefa nasce no mesmo instante em que o status muda.
//
// A avaliação (quais regras casam) é pura e testável. A execução (gravar no
// banco) fica separada, em executarAcoes.

import { acharEtapa } from './pipeline.js';
import { aplicarModelo } from './modelos.js';

/* ═══════════════════════════════════════════════════════════
   Vocabulário
   ═══════════════════════════════════════════════════════════ */

export const GATILHOS = {
  leadCriado:   { rotulo: 'Quando um lead for criado',        precisaEtapa: false },
  statusMudou:  { rotulo: 'Quando o status mudar para…',      precisaEtapa: true  },
  valorDefinido:{ rotulo: 'Quando o valor for preenchido',    precisaEtapa: false },
};

export const ACOES = {
  criarTarefa:   { rotulo: 'Criar uma tarefa' },
  definirCampo:  { rotulo: 'Preencher um campo do lead' },
  registrarNota: { rotulo: 'Anotar na linha do tempo' },
};

export const TIPOS_TAREFA = [
  { valor: 'ligacao',  rotulo: '📞 Ligação' },
  { valor: 'email',    rotulo: '✉️ E-mail' },
  { valor: 'reuniao',  rotulo: '🤝 Reunião' },
  { valor: 'followup', rotulo: '💬 Follow-up' },
];

// Campos que uma regra pode preencher sozinha. De propósito não inclui status:
// uma regra que muda status dispararia outra regra, e duas regras apontando uma
// para a outra entrariam em laço infinito.
export const CAMPOS_DEFINIVEIS = [
  { campo: 'responsavel', rotulo: 'Responsável' },
  { campo: 'valor',       rotulo: 'Valor' },
  { campo: 'nicho',       rotulo: 'Nicho' },
  { campo: 'origem',      rotulo: 'Origem' },
];

/* ═══════════════════════════════════════════════════════════
   Avaliação — pura
   ═══════════════════════════════════════════════════════════ */

/** A regra tem o mínimo para poder rodar? */
export function regraValida(regra) {
  if (!regra || regra.ativa === false) return false;
  if (!GATILHOS[regra.gatilho?.tipo]) return false;
  if (GATILHOS[regra.gatilho.tipo].precisaEtapa && !regra.gatilho.para) return false;
  if (!Array.isArray(regra.acoes) || regra.acoes.length === 0) return false;
  return regra.acoes.every(a => ACOES[a?.tipo]);
}

/** As condições extras da regra batem com este lead? */
export function condicoesBatem(regra, lead) {
  const c = regra?.condicoes;
  if (!c) return true;
  if (c.nicho && lead.nicho !== c.nicho) return false;
  if (c.responsavel && lead.responsavel !== c.responsavel) return false;
  if (c.valorMinimo && !(Number(lead.valor) >= Number(c.valorMinimo))) return false;
  if (c.semResponsavel && lead.responsavel) return false;
  return true;
}

/**
 * Quais regras devem disparar para este evento.
 * @param {Array}  regras
 * @param {Object} evento  { tipo, lead, statusAnterior }
 */
export function regrasQueDisparam(regras = [], evento = {}) {
  const { tipo, lead, statusAnterior } = evento;
  if (!lead) return [];

  return regras.filter(regra => {
    if (!regraValida(regra)) return false;
    if (regra.gatilho.tipo !== tipo) return false;
    if (!condicoesBatem(regra, lead)) return false;

    if (tipo === 'statusMudou') {
      if (regra.gatilho.para !== lead.status) return false;
      // "de" vazio significa "de qualquer etapa"
      if (regra.gatilho.de && regra.gatilho.de !== statusAnterior) return false;
      // Sem mudança real não há disparo — evita reprocessar ao salvar o
      // formulário sem tocar no status.
      if (statusAnterior === lead.status) return false;
    }

    if (tipo === 'valorDefinido' && !(Number(lead.valor) > 0)) return false;

    return true;
  });
}

/** Data da tarefa a partir do prazo em dias, no fuso local. */
export function calcularPrazo(prazoDias, base = new Date()) {
  const d = new Date(base.getTime());
  d.setDate(d.getDate() + (Number(prazoDias) || 0));
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

/**
 * Traduz as ações de uma regra nas gravações que elas produzem.
 * Pura: devolve a descrição do que fazer, sem tocar no banco.
 */
export function planejarAcoes(regra, lead, contexto = {}) {
  const plano = { tarefas: [], camposDoLead: {}, notas: [] };

  (regra.acoes || []).forEach(acao => {
    if (acao.tipo === 'criarTarefa') {
      plano.tarefas.push({
        titulo: aplicarModelo(acao.titulo || 'Follow-up', contexto.vars || {}),
        tipo: acao.tipoTarefa || 'followup',
        prioridade: acao.prioridade || 'media',
        data: calcularPrazo(acao.prazoDias, contexto.agora),
        hora: acao.hora || '',
        leadId: lead.id,
        leadNome: lead.nome,
        // "doLead" mantém a tarefa com quem já cuida da conta
        responsavel: acao.responsavel === 'doLead'
          ? (lead.responsavel || '')
          : (acao.responsavel || ''),
      });
    }

    if (acao.tipo === 'definirCampo' && acao.campo) {
      // Nunca sobrescreve um valor que a pessoa já preencheu
      const atual = lead[acao.campo];
      const vazio = atual === undefined || atual === null || atual === '';
      if (vazio || acao.sobrescrever) {
        plano.camposDoLead[acao.campo] = acao.valor;
      }
    }

    if (acao.tipo === 'registrarNota') {
      plano.notas.push(aplicarModelo(acao.texto || '', contexto.vars || {}));
    }
  });

  return plano;
}

/** Frase curta do que a regra faz, para listar em Configurações. */
export function descreverRegra(regra, etapas = []) {
  if (!regra?.gatilho) return 'Regra incompleta';

  let quando = GATILHOS[regra.gatilho.tipo]?.rotulo || regra.gatilho.tipo;
  if (regra.gatilho.tipo === 'statusMudou') {
    const para = acharEtapa(etapas, regra.gatilho.para).label;
    const de = regra.gatilho.de ? ` (vindo de ${acharEtapa(etapas, regra.gatilho.de).label})` : '';
    quando = `Quando o status mudar para ${para}${de}`;
  }

  const acoes = (regra.acoes || []).map(a => {
    if (a.tipo === 'criarTarefa') {
      const prazo = Number(a.prazoDias) || 0;
      const quandoTarefa = prazo === 0 ? 'para hoje' : prazo === 1 ? 'para amanhã' : `em ${prazo} dias`;
      return `criar a tarefa "${a.titulo}" ${quandoTarefa}`;
    }
    if (a.tipo === 'definirCampo') return `preencher ${a.campo} com "${a.valor}"`;
    if (a.tipo === 'registrarNota') return 'anotar na linha do tempo';
    return a.tipo;
  });

  return `${quando}, ${acoes.join(' e ')}.`;
}
