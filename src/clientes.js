// Lógica de clientes: saúde da conta e conversão a partir de um lead ganho.
// Pura, sem Firebase, para poder ser testada sem subir banco.

import { hojeISO, diasDesde } from './periodo.js';

export const STATUS_CLIENTE = [
  { valor: 'ativo',     rotulo: 'Ativo',     cor: 'var(--green)'  },
  { valor: 'pausado',   rotulo: 'Pausado',   cor: 'var(--yellow)' },
  { valor: 'cancelado', rotulo: 'Cancelado', cor: 'var(--red)'    },
];

export const rotuloStatusCliente = (s) =>
  STATUS_CLIENTE.find(x => x.valor === s)?.rotulo || s || 'Ativo';

/**
 * Saúde da conta, de 0 a 100, com os motivos que levaram ao número.
 *
 * A versão anterior olhava só a data do último contato, o que dava 95% para um
 * cliente pausado e sem telefone contatado ontem. Aqui cada sinal desconta, e
 * os motivos voltam junto para a tela poder explicar em vez de só pintar.
 */
export function saudeCliente(cliente = {}, agoraMs = Date.now()) {
  const motivos = [];

  if (cliente.statusCliente === 'cancelado') {
    return { pct: 0, cor: 'var(--red)', rotulo: 'Cancelado', motivos: ['Contrato cancelado'] };
  }

  let pct = 100;

  // ── Recência do contato: o sinal mais forte ──
  const dias = cliente.ultimoContato
    ? Math.floor((agoraMs - new Date(cliente.ultimoContato).getTime()) / 86400000)
    : null;

  if (dias === null)      { pct -= 70; motivos.push('Nunca foi contactado'); }
  else if (dias > 60)     { pct -= 70; motivos.push(`Sem contato há ${dias} dias`); }
  else if (dias > 30)     { pct -= 55; motivos.push(`Sem contato há ${dias} dias`); }
  else if (dias > 14)     { pct -= 35; motivos.push(`Sem contato há ${dias} dias`); }
  else if (dias > 7)      { pct -= 15; motivos.push(`Último contato há ${dias} dias`); }

  // ── Contrato pausado ──
  if (cliente.statusCliente === 'pausado') {
    pct -= 30;
    motivos.push('Contrato pausado');
  }

  // ── Sem canal de contato: não dá para reagir a nada ──
  if (!cliente.telefone && !cliente.whatsapp && !cliente.email) {
    pct -= 10;
    motivos.push('Sem telefone, WhatsApp ou e-mail');
  }

  // ── Tempo de casa: relação madura resiste melhor a um mês ruim ──
  const diasDeCasa = cliente.dataInicio
    ? Math.floor((agoraMs - new Date(cliente.dataInicio).getTime()) / 86400000)
    : 0;
  if (diasDeCasa >= 180) {
    pct += 10;
    motivos.push(`Cliente há ${Math.floor(diasDeCasa / 30)} meses`);
  }

  pct = Math.max(0, Math.min(100, pct));

  const cor = pct >= 70 ? 'var(--green)' : pct >= 40 ? 'var(--yellow)' : 'var(--red)';
  const rotulo = pct >= 70 ? 'Saudável' : pct >= 40 ? 'Atenção' : 'Em risco';

  if (motivos.length === 0) motivos.push('Contato recente e contrato ativo');

  return { pct, cor, rotulo, motivos };
}

export function textoUltimoContato(ultimoContato, agoraMs = Date.now()) {
  if (!ultimoContato) return 'Nunca contactado';
  const dias = Math.floor((agoraMs - new Date(ultimoContato).getTime()) / 86400000);
  if (dias <= 0) return 'Hoje';
  if (dias === 1) return 'Ontem';
  return `há ${dias} dias`;
}

/**
 * Média de saúde da carteira. Cancelados ficam de fora de propósito: eles
 * puxavam o número para baixo para sempre, mesmo depois de a conta ter sido
 * encerrada em bons termos.
 */
export function saudeMediaDaCarteira(clientes = [], agoraMs = Date.now()) {
  const emCarteira = clientes.filter(c => c.statusCliente !== 'cancelado');
  if (emCarteira.length === 0) return null;
  const soma = emCarteira.reduce((s, c) => s + saudeCliente(c, agoraMs).pct, 0);
  return Math.round(soma / emCarteira.length);
}

/** Receita recorrente mensal — só o que está ativo entra. */
export function receitaRecorrente(clientes = []) {
  return clientes
    .filter(c => c.statusCliente === 'ativo')
    .reduce((s, c) => s + (Number(c.valorMensal) || 0), 0);
}

// ── Conversão de lead em cliente ───────────────────────────────────────────

/**
 * Monta o cliente a partir de um lead ganho, carregando o que já foi digitado.
 * Antes disso, virar cliente era redigitar catorze campos à mão.
 */
export function clienteAPartirDoLead(lead = {}, hoje = hojeISO()) {
  return {
    nome:          lead.nome || '',
    nicho:         lead.nicho || '',
    responsavel:   lead.responsavel || '',
    telefone:      lead.telefone || '',
    whatsapp:      lead.whatsapp || '',
    email:         lead.email || '',
    instagram:     lead.instagram || '',
    site:          lead.site || '',
    // O valor do negócio vira a mensalidade como ponto de partida — quase
    // sempre precisa de ajuste, e o formulário abre para isso.
    valorMensal:   Number(lead.valor) || '',
    plano:         '',
    dataInicio:    hoje,
    ultimoContato: lead.ultimo_contato || hoje,
    statusCliente: 'ativo',
    obs:           lead.obs || '',
    // O vínculo é o que permite não converter o mesmo lead duas vezes
    leadId:        lead.id || null,
  };
}

/** Leads ganhos que ainda não viraram cliente. */
export function ganhosSemCliente(leads = [], clientes = [], ehGanhoFn) {
  const jaConvertidos = new Set(clientes.map(c => c.leadId).filter(Boolean));
  return leads.filter(l => ehGanhoFn(l.status) && !jaConvertidos.has(l.id));
}

export { diasDesde };
