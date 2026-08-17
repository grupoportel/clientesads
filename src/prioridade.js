// Prioridade da carteira. Pura, sem Firebase e sem IA, para poder ser testada
// e para rodar nos 691 leads de uma vez sem custo nenhum.
//
// A tentação era mandar cada lead para o modelo e pedir uma nota. Seria caro,
// lento e pior: "a IA deu 73" não convence ninguém a ligar. "Nota 4,5 com 67
// avaliações, decisor identificado, 40 dias sem contato" convence — e dá para
// discordar, o que é o ponto. Pontuação que não se explica não é usada.

import { acharEtapa, ehGanho, ehPerdido } from './pipeline.js';

const dias = (data, agoraMs) => {
  if (!data) return null;
  const ms = new Date(String(data).slice(0, 10) + 'T12:00:00').getTime();
  if (Number.isNaN(ms)) return null;
  return Math.floor((agoraMs - ms) / 86400000);
};

const numero = (v) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Recência do contato. É o sinal que mais separa lead que anda de lead parado,
 * e o único que piora sozinho enquanto ninguém faz nada.
 */
function pontosDeContato(lead, agoraMs, etapa) {
  const d = dias(lead.ultimo_contato, agoraMs);

  if (d === null) {
    // Campo vazio não é o mesmo que nunca ter falado. Ninguém marca reunião
    // com quem nunca atendeu: a partir de "Ligação Feita" a própria etapa é
    // prova de contato, e o que falta é o cadastro, não o relacionamento.
    // Tratar os dois como iguais derrubava a nota de lead adiantado e fazia a
    // explicação se contradizer na mesma linha.
    if (etapa?.probabilidade >= 20) {
      return { pontos: 8, motivo: 'Último contato não registrado no cadastro' };
    }
    return { pontos: 0, motivo: 'Nunca teve contato registrado' };
  }

  if (d <= 7)   return { pontos: 25, motivo: `Contato há ${d === 0 ? 'menos de um dia' : `${d} dia(s)`}` };
  if (d <= 30)  return { pontos: 18, motivo: `Contato há ${d} dias` };
  if (d <= 60)  return { pontos: 10, motivo: `Contato há ${d} dias, esfriando` };
  if (d <= 120) return { pontos: 4,  motivo: `Contato há ${d} dias, frio` };
  return { pontos: 0, motivo: `Sem contato há ${d} dias` };
}

/** Dá para trabalhar este lead? Sem canal de contato, nada mais importa. */
function pontosDeContatabilidade(lead) {
  let pontos = 0;
  const motivos = [];
  if (lead.whatsapp || lead.telefone) pontos += 6; else motivos.push('Sem telefone');
  if (lead.decisor) { pontos += 5; motivos.push('Decisor identificado'); }
  if (lead.email) pontos += 4; else motivos.push('Sem e-mail');
  return { pontos, motivos };
}

/**
 * Sinais de que o negócio existe e se importa com presença digital — que é
 * exatamente o que a agência vende. Nota alta com muitas avaliações é empresa
 * que já entendeu que reputação importa; é conversa mais curta.
 */
function pontosDoNegocio(lead) {
  let pontos = 0;
  const motivos = [];

  const nota = numero(lead.nota);
  const avaliacoes = numero(lead.avaliacoes);

  if (nota >= 4.5 && avaliacoes >= 20) { pontos += 6; motivos.push(`Nota ${nota} com ${avaliacoes} avaliações`); }
  else if (nota >= 4.0) { pontos += 3; motivos.push(`Nota ${nota} no Google`); }
  else if (nota > 0 && nota < 3.5) { motivos.push(`Nota baixa (${nota})`); }

  if (avaliacoes >= 50) { pontos += 2; }
  if (lead.site) pontos += 2;
  if (lead.instagram) pontos += 2;
  if (!lead.site && !lead.instagram) motivos.push('Sem site nem Instagram');

  return { pontos, motivos };
}

/** Valor pesa, mas pouco: negócio grande que não atende não vale mais que um médio que atende. */
function pontosDoValor(lead) {
  const v = numero(lead.valor);
  if (v <= 0) return { pontos: 0, motivo: null };
  if (v >= 5000) return { pontos: 8, motivo: 'Ticket alto' };
  if (v >= 2000) return { pontos: 5, motivo: null };
  return { pontos: 2, motivo: null };
}

export const FAIXAS = [
  { id: 'quente', rotulo: 'Atacar agora', minimo: 62, cor: 'var(--green)' },
  { id: 'morno',  rotulo: 'Vale insistir', minimo: 38, cor: 'var(--yellow)' },
  { id: 'frio',   rotulo: 'Baixa chance',  minimo: 0,  cor: 'var(--text3)' },
];

export const faixaDe = (pontos) => FAIXAS.find(f => pontos >= f.minimo) || FAIXAS[FAIXAS.length - 1];

/**
 * Pontua um lead de 0 a 100.
 *
 * `alerta` é separado da pontuação de propósito: uma reunião marcada que já
 * passou não muda a chance de fechar, mas muda o que fazer hoje. Misturar os
 * dois esconderia justamente o caso mais urgente da carteira.
 */
export function pontuarLead(lead = {}, etapas = [], agoraMs = Date.now()) {
  const etapa = acharEtapa(etapas, lead.status);

  // Ganho e perdido saem da fila: não são carteira a trabalhar.
  if (ehGanho(etapas, lead.status) || ehPerdido(etapas, lead.status)) {
    return { pontos: 0, faixa: FAIXAS[2], motivos: [], alerta: null, urgente: false, foraDaFila: true };
  }

  const contato = pontosDeContato(lead, agoraMs, etapa);
  const contatabilidade = pontosDeContatabilidade(lead);
  const negocio = pontosDoNegocio(lead);
  const valor = pontosDoValor(lead);

  const daEtapa = Math.round((etapa.probabilidade / 100) * 40);
  const bruto = daEtapa + contato.pontos + contatabilidade.pontos + negocio.pontos + valor.pontos;
  const pontos = Math.max(0, Math.min(100, bruto));

  const motivos = [
    etapa.probabilidade > 0 ? `${etapa.label} (${etapa.probabilidade}% na etapa)` : null,
    contato.motivo,
    ...contatabilidade.motivos,
    ...negocio.motivos,
    valor.motivo,
  ].filter(Boolean);

  // ── Alertas ──
  // Dois tipos, e a diferença importa na hora de ordenar. "Reunião é hoje" é
  // urgente: manda para o topo. "Sem canal de contato" é problema de cadastro:
  // avisa, mas não pode passar na frente de um lead quente — o primeiro pede
  // ação hoje, o segundo diz que não há ação possível.
  let alerta = null;
  let urgente = false;

  const diasDaReuniao = dias(lead.reuniao, agoraMs);
  if (diasDaReuniao !== null && diasDaReuniao > 0 && etapa.id === 'reuniao-marcada') {
    alerta = `Reunião era há ${diasDaReuniao} dia(s) e o status não mudou`;
    urgente = true;
  } else if (diasDaReuniao !== null && diasDaReuniao <= 0 && diasDaReuniao >= -2) {
    alerta = diasDaReuniao === 0 ? 'Reunião é hoje' : `Reunião em ${Math.abs(diasDaReuniao)} dia(s)`;
    urgente = true;
  } else if (!lead.whatsapp && !lead.telefone && !lead.email) {
    alerta = 'Sem nenhum canal de contato';
  }

  return { pontos, faixa: faixaDe(pontos), motivos, alerta, urgente, foraDaFila: false };
}

/** Ordena a carteira do mais promissor para o menos, já sem ganhos e perdas. */
export function ordenarPorPrioridade(leads = [], etapas = [], agoraMs = Date.now()) {
  return leads
    .map(lead => ({ lead, ...pontuarLead(lead, etapas, agoraMs) }))
    .filter(x => !x.foraDaFila)
    // Só o urgente sobe: uma reunião de hoje importa mais que dois pontos de
    // nota. Cadastro incompleto não, senão lead morto sem telefone passaria na
    // frente de lead quente só por estar mal preenchido.
    .sort((a, b) => (Boolean(b.urgente) - Boolean(a.urgente)) || (b.pontos - a.pontos));
}

/** Resumo por faixa, para o topo da tela. */
export function resumoDaCarteira(leads = [], etapas = [], agoraMs = Date.now()) {
  const fila = ordenarPorPrioridade(leads, etapas, agoraMs);
  const contagem = { quente: 0, morno: 0, frio: 0 };
  fila.forEach(x => { contagem[x.faixa.id] += 1; });
  return {
    total: fila.length,
    ...contagem,
    urgentes: fila.filter(x => x.urgente).length,
    semContato: fila.filter(x => x.alerta && !x.urgente).length,
  };
}
