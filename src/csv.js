// Importação e exportação de CSV.
// Escrito à mão em vez de trazer uma biblioteca: o formato que interessa aqui
// (Excel e Google Planilhas em português) cabe em poucas dezenas de linhas.

// Marca de ordem de bytes. Escrita como escape em vez do caractere literal:
// invisível no código, ela é fácil de apagar sem querer e o Excel deixa de
// reconhecer os acentos do arquivo exportado.
const BOM = '﻿';

// ── Exportar ────────────────────────────────────────────────────────────────

const escaparCampo = (valor) => {
  const texto = valor === null || valor === undefined ? '' : String(valor);
  // Aspas duplas viram duplicadas; envolve sempre que houver separador, aspas ou quebra
  if (/[";\n\r]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`;
  return texto;
};

/**
 * Gera o texto CSV. Usa ponto e vírgula porque é o separador que o Excel em
 * português entende sem pedir configuração de importação.
 */
export function gerarCSV(linhas, colunas) {
  const cabecalho = colunas.map(c => escaparCampo(c.titulo)).join(';');
  const corpo = linhas.map(linha =>
    colunas.map(c => escaparCampo(c.valor ? c.valor(linha) : linha[c.campo])).join(';')
  );
  return [cabecalho, ...corpo].join('\r\n');
}

/** Dispara o download no navegador. BOM no início para o Excel ler acentos. */
export function baixarCSV(nomeArquivo, conteudo) {
  const blob = new Blob([BOM + conteudo], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo.endsWith('.csv') ? nomeArquivo : `${nomeArquivo}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ── Importar ────────────────────────────────────────────────────────────────

/** Descobre se o arquivo usa ";" ou "," olhando a primeira linha. */
function detectarSeparador(texto) {
  const primeiraLinha = texto.split(/\r?\n/)[0] || '';
  const pontoVirgula = (primeiraLinha.match(/;/g) || []).length;
  const virgula = (primeiraLinha.match(/,/g) || []).length;
  return pontoVirgula >= virgula ? ';' : ',';
}

/**
 * Lê CSV respeitando aspas, campos com quebra de linha dentro e aspas escapadas.
 * Devolve { colunas: string[], linhas: string[][] }.
 */
export function lerCSV(texto) {
  const limpo = texto.startsWith(BOM) ? texto.slice(1) : texto;
  const sep = detectarSeparador(limpo);

  const linhas = [];
  let campoAtual = '';
  let linhaAtual = [];
  let dentroDeAspas = false;

  for (let i = 0; i < limpo.length; i++) {
    const c = limpo[i];
    const proximo = limpo[i + 1];

    if (dentroDeAspas) {
      if (c === '"' && proximo === '"') { campoAtual += '"'; i++; }
      else if (c === '"') { dentroDeAspas = false; }
      else { campoAtual += c; }
      continue;
    }

    if (c === '"') { dentroDeAspas = true; }
    else if (c === sep) { linhaAtual.push(campoAtual); campoAtual = ''; }
    else if (c === '\n') { linhaAtual.push(campoAtual); linhas.push(linhaAtual); linhaAtual = []; campoAtual = ''; }
    else if (c === '\r') { /* ignora, o \n seguinte fecha a linha */ }
    else { campoAtual += c; }
  }

  if (campoAtual !== '' || linhaAtual.length > 0) {
    linhaAtual.push(campoAtual);
    linhas.push(linhaAtual);
  }

  const naoVazias = linhas.filter(l => l.some(campo => String(campo).trim() !== ''));
  if (naoVazias.length === 0) return { colunas: [], linhas: [] };

  return {
    colunas: naoVazias[0].map(c => c.trim()),
    linhas: naoVazias.slice(1),
  };
}

/** Normaliza um título de coluna para comparação (sem acento, minúsculo). */
export const normalizarTitulo = (t) =>
  String(t || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

/**
 * Tenta adivinhar qual coluna do arquivo corresponde a cada campo do CRM,
 * comparando o título com o rótulo e com os apelidos conhecidos.
 */
export function sugerirMapeamento(colunasArquivo, camposCrm) {
  const mapa = {};
  const usadas = new Set();

  camposCrm.forEach(campo => {
    const candidatos = [campo.rotulo, campo.campo, ...(campo.apelidos || [])].map(normalizarTitulo);

    const indice = colunasArquivo.findIndex((titulo, i) =>
      !usadas.has(i) && candidatos.includes(normalizarTitulo(titulo))
    );

    if (indice >= 0) {
      mapa[campo.campo] = indice;
      usadas.add(indice);
    } else {
      mapa[campo.campo] = -1;
    }
  });

  return mapa;
}
