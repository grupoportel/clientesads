// Fonte única de verdade das etapas do funil.
// Antes disso, o mesmo STATUS_CONFIG estava copiado em seis arquivos, com
// rótulos que já tinham divergido entre si — e cada tela decidia por conta
// própria o que contava como "ganho", o que dava números diferentes para a
// mesma pergunta no Dashboard e na barra de estatísticas.

export const ETAPAS_PADRAO = [
  { id: 'nenhum',             label: 'Nenhum',              cls: 's-nenhum',             cor: '#5865f2', probabilidade: 0,   ganho: false, perdido: false, ativo: true },
  { id: 'lead-qualificado',   label: 'Lead Qualificado',    cls: 's-lead-qualificado',   cor: '#3b82f6', probabilidade: 10,  ganho: false, perdido: false, ativo: true },
  { id: 'ligacao-feita',      label: 'Ligação Feita',       cls: 's-ligacao-feita',      cor: '#eab308', probabilidade: 20,  ganho: false, perdido: false, ativo: true },
  { id: 'contato-decisor',    label: 'Contato com Decisor', cls: 's-contato-decisor',    cor: '#a855f7', probabilidade: 40,  ganho: false, perdido: false, ativo: true },
  { id: 'reuniao-marcada',    label: 'Reunião Marcada',     cls: 's-reuniao-marcada',    cor: '#22c55e', probabilidade: 60,  ganho: false, perdido: false, ativo: true },
  { id: 'contrato-realizado', label: 'Contrato Realizado',  cls: 's-contrato-realizado', cor: '#ec4899', probabilidade: 90,  ganho: true,  perdido: false, ativo: true },
  { id: 'venda',              label: 'Venda',               cls: 's-venda',              cor: '#14b8a6', probabilidade: 100, ganho: true,  perdido: false, ativo: true },
  { id: 'concluido',          label: 'Concluído',           cls: 's-concluido',          cor: '#8b5cf6', probabilidade: 100, ganho: true,  perdido: false, ativo: true },
  { id: 'perda',              label: 'Perda',               cls: 's-perda',              cor: '#ef4444', probabilidade: 0,   ganho: false, perdido: true,  ativo: true },
];

// Status antigos que ainda podem existir em registros gravados no banco
export const MAPA_STATUS_ANTIGOS = {
  'preparacao':   'lead-qualificado',
  'retornar':     'ligacao-feita',
  'segundo':      'contato-decisor',
  'reuniao-pos':  'reuniao-marcada',
  'quarto':       'contato-decisor',
  'nenhuma':      'nenhum',
  'investigacao': 'lead-qualificado',
  'diagnostico':  'ligacao-feita',
  'resgate':      'contato-decisor',
  'em-conversa':  'contato-decisor',
  'reuniao-marc': 'reuniao-marcada',
  'contrato':     'contrato-realizado',
  'interesse':    'perda',
};

// Junta as etapas padrão com o que estiver salvo em crm_data/config/pipeline.
// O que vem do banco só sobrescreve os campos que existirem, então nunca dá
// para "quebrar" o funil salvando uma configuração incompleta.
export function mesclarEtapas(configSalva) {
  if (!configSalva) return ETAPAS_PADRAO;

  const salvas = Array.isArray(configSalva)
    ? configSalva
    : Object.values(configSalva);

  const porId = new Map(salvas.filter(Boolean).map(e => [e.id, e]));

  const mescladas = ETAPAS_PADRAO.map(padrao => ({
    ...padrao,
    ...(porId.get(padrao.id) || {}),
    // id e classe de estilo nunca vêm do banco
    id: padrao.id,
    cls: padrao.cls,
  }));

  // Etapas criadas pelo usuário (não existem no padrão) entram no fim
  const extras = salvas
    .filter(e => e && e.id && !ETAPAS_PADRAO.some(p => p.id === e.id))
    .map(e => ({
      cls: 's-nenhum', cor: '#5865f2', probabilidade: 0,
      ganho: false, perdido: false, ativo: true,
      ...e,
    }));

  const todas = [...mescladas, ...extras];

  // Respeita a ordem salva, quando houver
  return todas.sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999));
}

// ── Consultas ───────────────────────────────────────────────────────────────

export const acharEtapa = (etapas, status) =>
  etapas.find(e => e.id === status) || etapas.find(e => e.id === 'nenhum') || ETAPAS_PADRAO[0];

export const rotuloStatus = (etapas, status) => acharEtapa(etapas, status).label;
export const corStatus    = (etapas, status) => acharEtapa(etapas, status).cor;
export const classeStatus = (etapas, status) => acharEtapa(etapas, status).cls;

export const ehGanho   = (etapas, status) => acharEtapa(etapas, status).ganho === true;
export const ehPerdido = (etapas, status) => acharEtapa(etapas, status).perdido === true;
export const ehAberto  = (etapas, status) => {
  const e = acharEtapa(etapas, status);
  return !e.ganho && !e.perdido;
};

// Etapas que formam o funil de progressão (fora ganho/perda/sem-ação)
export const etapasDoFunil = (etapas) =>
  etapas.filter(e => e.ativo !== false && !e.perdido && e.id !== 'nenhum');

export const etapasAtivas = (etapas) => etapas.filter(e => e.ativo !== false);

// ── Dinheiro ────────────────────────────────────────────────────────────────

export const valorDoLead = (lead) => Number(lead?.valor) || 0;

// Valor bruto de tudo que ainda está em aberto
export const valorEmAberto = (etapas, leads) =>
  leads.filter(l => ehAberto(etapas, l.status)).reduce((s, l) => s + valorDoLead(l), 0);

// Previsão ponderada: cada lead vale o seu valor × a probabilidade da etapa
export const previsaoPonderada = (etapas, leads) =>
  leads
    .filter(l => ehAberto(etapas, l.status))
    .reduce((s, l) => s + valorDoLead(l) * (acharEtapa(etapas, l.status).probabilidade / 100), 0);

// Receita realmente fechada
export const valorGanho = (etapas, leads) =>
  leads.filter(l => ehGanho(etapas, l.status)).reduce((s, l) => s + valorDoLead(l), 0);

export const formatarBRL = (n) =>
  `R$ ${Math.round(Number(n) || 0).toLocaleString('pt-BR')}`;

export const formatarBRLCurto = (n) => {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1000000) return `R$ ${(v / 1000000).toFixed(1).replace('.', ',')}M`;
  if (Math.abs(v) >= 1000)    return `R$ ${(v / 1000).toFixed(0)}k`;
  return `R$ ${Math.round(v)}`;
};
