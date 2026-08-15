// Modelos de mensagem com variáveis.
// Antes disso, todo WhatsApp e todo e-mail era digitado do zero, toda vez.

import { formatarBRL } from './pipeline.js';
import { formataData } from './periodo.js';

/**
 * Variáveis que um modelo pode usar. A ordem aqui é a ordem mostrada na ajuda
 * do editor, então vão da mais usada para a menos usada.
 */
export const VARIAVEIS = [
  { chave: 'nome',        rotulo: 'Nome do lead',   exemplo: 'Clínica São Lucas' },
  { chave: 'primeiroNome',rotulo: 'Primeiro nome',  exemplo: 'Clínica' },
  { chave: 'decisor',     rotulo: 'Decisor',        exemplo: 'Dra. Marina' },
  { chave: 'responsavel', rotulo: 'Responsável',    exemplo: 'João' },
  { chave: 'nicho',       rotulo: 'Nicho',          exemplo: 'Odontologia' },
  { chave: 'cidade',      rotulo: 'Cidade',         exemplo: 'Sinop' },
  { chave: 'estado',      rotulo: 'Estado',         exemplo: 'MT' },
  { chave: 'valor',       rotulo: 'Valor',          exemplo: 'R$ 2.500' },
  { chave: 'reuniao',     rotulo: 'Data da reunião',exemplo: '20/08/2026' },
  { chave: 'empresa',     rotulo: 'Sua empresa',    exemplo: 'Grupo Portel' },
  { chave: 'meuNome',     rotulo: 'Seu nome',       exemplo: 'Gui' },
];

/** Monta o dicionário de valores a partir do lead e do contexto. */
export function montarContexto(lead = {}, extra = {}) {
  const nome = lead.nome || '';
  return {
    nome,
    primeiroNome: nome.trim().split(/\s+/)[0] || '',
    decisor:      lead.decisor || '',
    responsavel:  lead.responsavel || '',
    nicho:        lead.nicho || '',
    cidade:       lead.cidade || '',
    estado:       lead.estado || '',
    valor:        Number(lead.valor) > 0 ? formatarBRL(lead.valor) : '',
    reuniao:      lead.reuniao ? formataData(lead.reuniao) : '',
    empresa:      extra.empresa || '',
    meuNome:      extra.meuNome || '',
  };
}

/**
 * Troca {{variavel}} pelo valor correspondente.
 * Aceita espaços dentro das chaves ({{ nome }}) porque é o erro de digitação
 * mais comum, e deixar a mensagem sair com "{{ nome }}" cru para o cliente
 * seria pior do que aceitar a folga.
 */
export function aplicarModelo(texto, contexto = {}) {
  if (!texto) return '';
  return String(texto).replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (original, chave) => {
    const valor = contexto[chave];
    // Variável desconhecida fica como está, para o autor perceber o erro.
    if (valor === undefined) return original;
    return valor;
  });
}

/** Variáveis usadas num texto, sem repetição e na ordem de aparição. */
export function variaveisUsadas(texto) {
  const achadas = [];
  String(texto || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, chave) => {
    if (!achadas.includes(chave)) achadas.push(chave);
    return _;
  });
  return achadas;
}

/**
 * Variáveis que o modelo usa mas que estariam vazias para este lead.
 * É o que permite avisar "esse modelo cita o decisor e este lead não tem um"
 * antes de a mensagem sair pela metade.
 */
export function variaveisVazias(texto, contexto = {}) {
  return variaveisUsadas(texto).filter(chave => {
    const valor = contexto[chave];
    return valor === undefined || String(valor).trim() === '';
  });
}

/** Nomes de variáveis escritas no modelo que não existem no sistema. */
export function variaveisDesconhecidas(texto) {
  const conhecidas = new Set(VARIAVEIS.map(v => v.chave));
  return variaveisUsadas(texto).filter(chave => !conhecidas.has(chave));
}

/** Prévia usando os exemplos, para o editor mostrar sem precisar de um lead. */
export function previaComExemplos(texto) {
  const exemplos = Object.fromEntries(VARIAVEIS.map(v => [v.chave, v.exemplo]));
  return aplicarModelo(texto, exemplos);
}
