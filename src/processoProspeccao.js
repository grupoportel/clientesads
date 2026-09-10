// Regras operacionais do playbook de prospecção.
// Este módulo é puro para que formulário, tabela, Kanban, API e testes usem
// exatamente a mesma definição do que significa avançar uma oportunidade.

export const CADENCIAS = {
  A: { rotulo: 'A — Prioridade máxima', contatos: 7, diasUteis: 12 },
  B: { rotulo: 'B — Prioridade média', contatos: 6, diasUteis: 10 },
  C: { rotulo: 'C — Prioridade seletiva', contatos: 4, diasUteis: 8 },
};

export const CAMPOS_PROSPECCAO_INICIAIS = {
  prioridadeProspeccao: '',
  objetivoContato: '',
  evidencia: '',
  hipotese: '',
  processoAtual: '',
  problemaConfirmado: '',
  impacto: '',
  momento: '',
  decisorPapel: '',
  permissaoWhatsApp: false,
  origemPermissaoWhatsApp: '',
  optOut: false,
  proximaAcao: '',
  proximaAcaoDataHora: '',
  proximaAcaoCanal: '',
  proximaAcaoResponsavel: '',
  proximaAcaoObjetivo: '',
  reuniaoDataHora: '',
  reuniaoObjetivo: '',
  reuniaoDuracaoMin: 30,
  reuniaoLinkLocal: '',
  reuniaoParticipantes: '',
  conviteEnviado: false,
  confirmacaoExplicita: false,
  confirmadoEm: '',
};

const texto = (valor) => String(valor ?? '').trim();
const verdadeiro = (valor) => valor === true || valor === 'true';

export function podeUsarWhatsApp(lead = {}) {
  return Boolean(lead.whatsapp) && verdadeiro(lead.permissaoWhatsApp) && !verdadeiro(lead.optOut);
}

export function pendenciasProximaAcao(lead = {}) {
  const pendencias = [];
  if (!texto(lead.proximaAcao)) pendencias.push('ação concreta');
  if (!texto(lead.proximaAcaoDataHora)) pendencias.push('data e hora');
  if (!texto(lead.proximaAcaoCanal)) pendencias.push('canal');
  if (!texto(lead.proximaAcaoResponsavel || lead.responsavel)) pendencias.push('responsável');
  if (!texto(lead.proximaAcaoObjetivo)) pendencias.push('objetivo da próxima ação');
  if (lead.proximaAcaoCanal === 'whatsapp' && !podeUsarWhatsApp(lead)) {
    pendencias.push('permissão para usar WhatsApp');
  }
  return pendencias;
}

function pendenciasReuniaoMarcada(lead) {
  const pendencias = [];
  if (!texto(lead.reuniaoDataHora)) pendencias.push('data e hora da reunião');
  if (!texto(lead.reuniaoObjetivo)) pendencias.push('objetivo da reunião');
  if (!texto(lead.reuniaoParticipantes || lead.decisor)) pendencias.push('participante/decisor');
  if (!Number(lead.reuniaoDuracaoMin)) pendencias.push('duração prevista');
  if (!texto(lead.reuniaoLinkLocal)) pendencias.push('link ou local');
  if (!verdadeiro(lead.conviteEnviado)) pendencias.push('convite enviado');
  return pendencias;
}

const ETAPAS_ATIVAS_DE_PROSPECCAO = new Set([
  'lead-qualificado', 'ligacao-feita', 'contato-decisor',
  'reuniao-marcada', 'reuniao-confirmada',
]);

export function pendenciasParaStatus(lead = {}, status = lead.status || 'nenhum') {
  const pendencias = [];

  if (verdadeiro(lead.optOut) && ETAPAS_ATIVAS_DE_PROSPECCAO.has(status)) {
    pendencias.push('o contato pediu para não receber novas abordagens; registre como perda');
    return pendencias;
  }

  if (status === 'perda') {
    if (!texto(lead.motivoPerda)) pendencias.push('motivo da perda');
    return pendencias;
  }

  if (status === 'lead-qualificado') {
    if (!texto(lead.evidencia)) pendencias.push('evidência observável');
    if (!texto(lead.hipotese)) pendencias.push('hipótese a validar');
    if (!texto(lead.objetivoContato)) pendencias.push('objetivo do primeiro contato');
  }

  if (ETAPAS_ATIVAS_DE_PROSPECCAO.has(status)) {
    pendencias.push(...pendenciasProximaAcao(lead));
  }

  if (['contato-decisor', 'reuniao-marcada', 'reuniao-confirmada'].includes(status)) {
    if (!texto(lead.decisor)) pendencias.push('nome do decisor');
    if (!texto(lead.decisorPapel)) pendencias.push('papel do decisor');
  }

  if (['reuniao-marcada', 'reuniao-confirmada'].includes(status)) {
    pendencias.push(...pendenciasReuniaoMarcada(lead));
  }

  if (status === 'reuniao-confirmada' && !verdadeiro(lead.confirmacaoExplicita)) {
    pendencias.push('aceite explícito do participante');
  }

  return [...new Set(pendencias)];
}

export function validarMudancaStatus(lead = {}, novoStatus) {
  if (!novoStatus || novoStatus === lead.status) return { ok: true, pendencias: [] };
  const candidato = { ...lead, status: novoStatus };
  const pendencias = pendenciasParaStatus(candidato, novoStatus);
  return { ok: pendencias.length === 0, pendencias };
}

export function descricaoBloqueio(pendencias = []) {
  if (!pendencias.length) return '';
  return `Antes de avançar, complete: ${pendencias.join(', ')}.`;
}

export function qualidadeRegistroProspeccao(lead = {}) {
  const itens = [
    texto(lead.evidencia), texto(lead.hipotese), texto(lead.objetivoContato),
    texto(lead.responsavel), texto(lead.proximaAcao), texto(lead.proximaAcaoDataHora),
    texto(lead.proximaAcaoCanal), texto(lead.proximaAcaoResponsavel || lead.responsavel),
    texto(lead.proximaAcaoObjetivo),
  ];
  const completos = itens.filter(Boolean).length;
  return Math.round((completos / itens.length) * 100);
}


