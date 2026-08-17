#!/usr/bin/env node
// Extrai leads dos dados abertos da Receita Federal.
//
// Roda na sua máquina, não no servidor: são arquivos de gigabytes que a Vercel
// não aguentaria e que só precisam ser processados quando a Receita publica
// uma versão nova, uma vez por mês.
//
// Lê linha a linha em vez de carregar o arquivo na memória — Estabelecimentos
// tem dezenas de milhões de linhas e derrubaria o Node de outro jeito.
//
// USO
//   node scripts/receita-leads.mjs --pasta ./dados --uf MT --cidades Sinop \
//        --cnaes 5611,5620,9602 --saida pizzarias-sinop.csv
//
// ONDE BAIXAR
//   https://arquivos.receitafederal.gov.br/dados/cnpj/dados_abertos_cnpj/
//   Baixe a pasta do mês mais recente e descompacte na pasta que você passar
//   em --pasta. Precisa de: Estabelecimentos*, Municipios, Cnaes. O arquivo
//   Empresas é opcional e só serve para quem não tem nome fantasia.

import { createReadStream, createWriteStream, readdirSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join } from 'node:path';
import {
  dividirLinha, linhaInteressa, linhaParaLead, leadParaCsv, COLUNAS_SAIDA,
} from './_receita.mjs';

// ── Argumentos ──────────────────────────────────────────────────────────────

function lerArgumentos(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    args[argv[i].slice(2)] = argv[i + 1]?.startsWith('--') ? true : argv[++i];
  }
  return args;
}

const args = lerArgumentos(process.argv.slice(2));
const pasta = args.pasta || './dados';
const saida = args.saida || 'leads-receita.csv';
const uf = args.uf ? String(args.uf).toUpperCase() : null;
const cnaes = args.cnaes ? String(args.cnaes).split(',').map(c => c.trim()).filter(Boolean) : [];
const cidadesPedidas = args.cidades ? String(args.cidades).split(',').map(c => c.trim()).filter(Boolean) : [];
const limite = args.limite ? Number(args.limite) : Infinity;
const comRazaoSocial = Boolean(args['com-razao-social']);

if (!existsSync(pasta)) {
  console.error(`\nNão achei a pasta "${pasta}".`);
  console.error('Baixe os dados em https://arquivos.receitafederal.gov.br/dados/cnpj/dados_abertos_cnpj/');
  console.error('descompacte, e passe o caminho em --pasta.\n');
  process.exit(1);
}

const semAcento = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();

// A Receita distribui ZIPs com nome amigável, mas o CSV lá dentro sai com nome
// críptico: "F.K03200$Z.D50510.MUNICCSV". Depois de descompactar, nada começa
// com "Municipios" — procurar por prefixo achava zero arquivos e o script
// terminava dizendo que a cidade não existe.
const MARCADORES = {
  Municipios: ['MUNIC'],
  Cnaes: ['CNAE'],
  Empresas: ['EMPRE'],
  Estabelecimentos: ['ESTABELE', 'ESTABELECIMENTO'],
};

/** Acha os arquivos pelo trecho que a Receita põe no nome, com ZIP ou sem. */
function acharArquivos(tipo) {
  const marcas = [semAcento(tipo), ...(MARCADORES[tipo] || [])];
  return readdirSync(pasta)
    .filter(nome => {
      const limpo = semAcento(nome);
      if (limpo.endsWith('.ZIP')) return false; // ainda compactado, não serve
      return marcas.some(m => limpo.includes(m));
    })
    .map(nome => join(pasta, nome));
}

/** Lê um arquivo linha a linha, em Latin-1 como a Receita publica. */
async function porLinha(caminho, aoLer) {
  const leitor = createInterface({
    input: createReadStream(caminho, { encoding: 'latin1' }),
    crlfDelay: Infinity,
  });
  for await (const linha of leitor) {
    if (linha.trim()) aoLer(dividirLinha(linha));
  }
}

// ── Tabelas de apoio ────────────────────────────────────────────────────────

async function carregarTabela(prefixo, rotulo) {
  const arquivos = acharArquivos(prefixo);
  if (arquivos.length === 0) {
    console.warn(`⚠️  Não achei o arquivo de ${rotulo}. Essa coluna vai sair vazia.`);
    return {};
  }
  const mapa = {};
  for (const arquivo of arquivos) {
    await porLinha(arquivo, (campos) => { if (campos[0]) mapa[campos[0]] = campos[1]; });
  }
  console.log(`   ${rotulo}: ${Object.keys(mapa).length} registros`);
  return mapa;
}

console.log('\n📖 Lendo tabelas de apoio…');
const nomesDeCidade = await carregarTabela('Municipios', 'municípios');
const nomesDeCnae = await carregarTabela('Cnaes', 'CNAEs');

// Cidade vem por nome na linha de comando, mas o arquivo guarda o código da
// Receita — que não é o do IBGE. A tradução é aqui, e sem acento, porque a
// grafia da Receita é maiúscula e nem sempre acentuada.
let municipios = [];
if (cidadesPedidas.length) {
  const procurados = cidadesPedidas.map(semAcento);
  municipios = Object.entries(nomesDeCidade)
    .filter(([, nome]) => procurados.includes(semAcento(nome)))
    .map(([codigo]) => codigo);

  if (municipios.length === 0) {
    console.error(`\n❌ Não achei nenhuma cidade com esses nomes: ${cidadesPedidas.join(', ')}`);
    console.error('   Confira a grafia. A Receita usa o nome oficial, sem abreviação.\n');
    process.exit(1);
  }
  console.log(`   Cidades: ${cidadesPedidas.join(', ')} → códigos ${municipios.join(', ')}`);
}

// Razão social só quando pedida: Empresas é um arquivo enorme e o mapa dele
// fica todo na memória. Sem ele, quem não tem nome fantasia é descartado.
let nomesPorCnpjBasico = {};
if (comRazaoSocial) {
  console.log('   Carregando razões sociais (pode demorar e usar bastante memória)…');
  for (const arquivo of acharArquivos('Empresas')) {
    await porLinha(arquivo, (campos) => { if (campos[0]) nomesPorCnpjBasico[campos[0]] = campos[1]; });
  }
  console.log(`   Razões sociais: ${Object.keys(nomesPorCnpjBasico).length}`);
}

// ── Varredura ───────────────────────────────────────────────────────────────

const arquivosEstab = acharArquivos('Estabelecimentos');
if (arquivosEstab.length === 0) {
  console.error(`\n❌ Não achei nenhum arquivo de Estabelecimentos em "${pasta}".\n`);
  process.exit(1);
}

console.log(`\n🔎 Varrendo ${arquivosEstab.length} arquivo(s) de estabelecimentos…`);
if (cnaes.length) console.log(`   CNAEs: ${cnaes.join(', ')}`);
if (uf) console.log(`   UF: ${uf}`);

const escrita = createWriteStream(saida, { encoding: 'utf8' });
escrita.write('﻿' + COLUNAS_SAIDA.join(';') + '\n'); // BOM: o Excel só lê acento com ele

const filtro = { cnaes, municipios, uf, somenteAtivas: true };
let lidas = 0;
let escritas = 0;
let semNome = 0;

for (const arquivo of arquivosEstab) {
  if (escritas >= limite) break;
  process.stdout.write(`   ${arquivo}… `);
  let doArquivo = 0;

  await porLinha(arquivo, (campos) => {
    lidas++;
    if (escritas >= limite) return;
    if (!linhaInteressa(campos, filtro)) return;

    const lead = linhaParaLead(campos, { nomesPorCnpjBasico, nomesDeCidade, nomesDeCnae });

    // Sem nome o lead ficaria anônimo na lista de revisão do CRM.
    if (!lead.nome) { semNome++; return; }

    escrita.write(leadParaCsv(lead) + '\n');
    escritas++; doArquivo++;
  });

  console.log(`${doArquivo} encontrados`);
}

escrita.end();

console.log(`\n✅ ${escritas} leads em ${saida}`);
console.log(`   ${lidas.toLocaleString('pt-BR')} linhas lidas`);
if (semNome > 0) {
  console.log(`   ${semNome} descartados por não ter nome fantasia`);
  if (!comRazaoSocial) console.log('   (rode com --com-razao-social para aproveitá-los)');
}
console.log('\n   Agora importe esse arquivo no CRM: Leads → 📥 Importar.');
console.log('   A etapa de revisão vai marcar quem já está na sua base.\n');
