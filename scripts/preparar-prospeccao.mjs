#!/usr/bin/env node
// Prepara os dados de prospecção: baixa, descompacta e fatia a base da Receita.
//
// Roda na máquina de quem usa, uma vez a cada alguns meses. É a única etapa
// pesada de todo o processo — depois dela, a busca dentro do CRM é instantânea.
//
// Cada etapa checa se já foi feita antes de refazer. Se a internet cair no meio
// dos 5 GB, é só rodar de novo: o download continua de onde parou e os arquivos
// já descompactados são pulados.
//
// USO
//   node scripts/preparar-prospeccao.mjs
//   node scripts/preparar-prospeccao.mjs --uf MT,PR --limpar
//
// Ou, sem terminal: duplo clique em "Preparar Prospecção.bat" na raiz.

import { createWriteStream, existsSync, mkdirSync, readdirSync, rmSync, statSync, readFileSync } from 'node:fs';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { dividirLinha, linhaInteressa, linhaParaLead, leadParaCsv, ultimaPasta, COLUNAS_SAIDA, COL } from './_receita.mjs';
import { NICHOS, codigosDoNicho, conferirCodigos } from './_nichos.mjs';

// ── Onde as coisas ficam ────────────────────────────────────────────────────

const RAIZ = process.cwd();
const BRUTO = join(RAIZ, '.dados-receita');      // os gigabytes, temporários
const FATIAS = join(RAIZ, 'dados-prospeccao');   // o resultado, pequeno

// O espelho da Casa dos Dados é preferido por um motivo prático: a fonte
// oficial não aceita retomada, e o maior arquivo tem 2 GB. Uma queda de
// conexão perto do fim obrigaria a baixar tudo de novo. O espelho fica um mês
// atrás, o que para prospecção não muda nada — empresa aberta em julho ainda
// existe em setembro.
const ESPELHO = 'https://dados-abertos-rf-cnpj.casadosdados.com.br/arquivos';
const OFICIAL = 'https://arquivos.receitafederal.gov.br/public.php/webdav';
const TOKEN_OFICIAL = 'YggdBLfdninEJX9';

const args = {};
process.argv.slice(2).forEach((a, i, todos) => {
  if (a.startsWith('--')) args[a.slice(2)] = todos[i + 1]?.startsWith('--') ? true : (todos[i + 1] ?? true);
});

const ufsPedidas = args.uf ? String(args.uf).toUpperCase().split(',').map(s => s.trim()) : null;
const usarOficial = Boolean(args.oficial);
const limparNoFim = Boolean(args.limpar);

// Modo de teste: percorre as mesmas etapas, mas sem baixar nada. Serve para
// conferir que a fonte está no ar e que os nichos batem com a tabela atual
// antes de comprometer 5 GB de internet.
const simular = Boolean(args.simular);

const log = (msg = '') => console.log(msg);
const passo = (n, txt) => log(`\n${'━'.repeat(58)}\n  ETAPA ${n} — ${txt}\n${'━'.repeat(58)}`);

// ── Ferramentas ─────────────────────────────────────────────────────────────

function curl(argumentos, { silencioso = false } = {}) {
  return execFileSync('curl', argumentos, {
    stdio: silencioso ? ['ignore', 'pipe', 'ignore'] : ['ignore', 'pipe', 'inherit'],
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

/** Descompacta. No Windows o PowerShell resolve sem instalar nada. */
function descompactar(zip, destino) {
  execFileSync('powershell', [
    '-NoProfile', '-Command',
    `Expand-Archive -LiteralPath '${zip}' -DestinationPath '${destino}' -Force`,
  ], { stdio: 'inherit' });
}

const mb = (bytes) => (bytes / 1048576).toFixed(0);


// ── Etapa 1: descobrir a versão mais recente ────────────────────────────────

passo(1, 'Procurando a versão mais recente');

let base, pasta;
if (usarOficial) {
  const lista = curl(['-s', '--max-time', '60', '-X', 'PROPFIND', '-H', 'Depth: 1',
    '-u', `${TOKEN_OFICIAL}:`, `${OFICIAL}/`], { silencioso: true });
  pasta = ultimaPasta(lista, /webdav\/(\d{4}-\d{2})\//g);
  base = `${OFICIAL}/${pasta}`;
  log(`   Fonte oficial da Receita — versão ${pasta}`);
  log('   ⚠️  Esta fonte não aceita retomada. Se a conexão cair, recomeça do zero.');
} else {
  const lista = curl(['-s', '--max-time', '60', '-L', `${ESPELHO}/`], { silencioso: true });
  pasta = ultimaPasta(lista, /href="(\d{4}-\d{2}-\d{2})\/"/g);
  base = `${ESPELHO}/${pasta}`;
  log(`   Espelho com CDN — versão ${pasta}`);
  log('   (aceita retomada; use --oficial para a fonte da Receita)');
}

if (!pasta) {
  console.error('\n❌ Não consegui descobrir a versão mais recente. Confira sua internet.\n');
  process.exit(1);
}

// ── Etapa 2: baixar ─────────────────────────────────────────────────────────

passo(2, simular ? 'Baixando (SIMULAÇÃO — nada será baixado)' : 'Baixando');
mkdirSync(BRUTO, { recursive: true });

let totalSimulado = 0;
const arquivos = [
  'Cnaes.zip', 'Municipios.zip',
  ...Array.from({ length: 10 }, (_, i) => `Estabelecimentos${i}.zip`),
];

for (const arquivo of arquivos) {
  const destino = join(BRUTO, arquivo);
  const url = usarOficial ? `${base}/${arquivo}` : `${base}/${arquivo}`;

  // Quanto o servidor diz que o arquivo tem, para saber se o nosso está inteiro
  const cabecalhos = curl([
    '-s', '-I', '--max-time', '60', '-L',
    ...(usarOficial ? ['-u', `${TOKEN_OFICIAL}:`] : []),
    url,
  ], { silencioso: true });
  const esperado = Number((cabecalhos.match(/content-length:\s*(\d+)/i) || [])[1] || 0);

  if (existsSync(destino) && esperado > 0 && statSync(destino).size === esperado) {
    log(`   ✓ ${arquivo} (${mb(esperado)} MB) já baixado`);
    continue;
  }

  // Na simulação os dois arquivos de apoio são baixados mesmo: juntos não
  // chegam a 100 KB e são o que permite conferir os nichos de verdade. Pular
  // os dois fazia a conferência comparar contra o vazio e acusar que os 30
  // códigos tinham sumido — susto sem motivo, logo antes de a pessoa decidir
  // se compromete 5 GB de internet.
  if (simular && arquivo.startsWith('Estabelecimentos')) {
    log(`   ○ ${arquivo} (${mb(esperado)} MB) — baixaria agora`);
    totalSimulado += esperado;
    continue;
  }
  log(simular
    ? `   ↓ ${arquivo} — pequeno, baixando para conferir os nichos de verdade`
    : `   ↓ ${arquivo} (${mb(esperado)} MB)`);
  curl([
    '-L', '--fail', '--retry', '3', '--retry-delay', '5',
    '-C', '-',                       // continua de onde parou
    '--progress-bar',
    ...(usarOficial ? ['-u', `${TOKEN_OFICIAL}:`] : []),
    '-o', destino, url,
  ]);
}

// ── Etapa 3: descompactar ───────────────────────────────────────────────────

passo(3, simular ? 'Descompactando (só as tabelas de apoio)' : 'Descompactando');

const jaTem = (marca) => readdirSync(BRUTO).some(n => n.toUpperCase().includes(marca) && !n.toLowerCase().endsWith('.zip'));

for (const arquivo of (simular ? arquivos.filter(a => !a.startsWith('Estabelecimentos')) : arquivos)) {
  const marca = arquivo.startsWith('Estabelecimentos')
    ? `ESTABELE${arquivo.match(/\d/)[0]}`
    : arquivo.replace('.zip', '').slice(0, 5).toUpperCase();

  if (jaTem(marca)) { log(`   ✓ ${arquivo} já descompactado`); continue; }
  log(`   ⧉ ${arquivo}`);
  descompactar(join(BRUTO, arquivo), BRUTO);
}

// ── Etapa 4: tabelas de apoio e conferência dos nichos ──────────────────────

passo(4, 'Conferindo os nichos contra a tabela oficial');

function carregarTabela(marca) {
  const arquivo = readdirSync(BRUTO).find(n => n.toUpperCase().includes(marca) && !n.toLowerCase().endsWith('.zip'));
  if (!arquivo) return {};
  const mapa = {};
  readFileSync(join(BRUTO, arquivo), 'latin1').split(/\r?\n/).forEach(linha => {
    if (!linha.trim()) return;
    const campos = dividirLinha(linha);
    if (campos[0]) mapa[campos[0]] = campos[1];
  });
  return mapa;
}

const nomesDeCnae = carregarTabela('CNAE');
const nomesDeCidade = carregarTabela('MUNIC');
log(`   ${Object.keys(nomesDeCnae).length} CNAEs, ${Object.keys(nomesDeCidade).length} municípios`);

const problemas = conferirCodigos(nomesDeCnae);
if (problemas.length > 0) {
  log('\n   ⚠️  Códigos que sumiram da tabela oficial:');
  problemas.forEach(p => log(`      ${p.codigo} — ${p.nicho} (${p.nossoNome})`));
  log('      A Receita mexeu na tabela. Esses nichos vão trazer menos empresas.');
} else {
  log('   ✓ Todos os códigos dos nichos existem na tabela atual');
}

if (simular) {
  log(`
${'━'.repeat(58)}
  SIMULAÇÃO CONCLUÍDA
${'━'.repeat(58)}`);
  log(`   Fonte no ar: sim (versão ${pasta})`);
  log(`   Baixaria ${(totalSimulado / 1073741824).toFixed(1)} GB em ${arquivos.length} arquivos`);
  log(`   Descompactado ocuparia mais ou menos ${(totalSimulado * 3.4 / 1073741824).toFixed(0)} GB temporários`);
  log(`   ${NICHOS.length} nichos, ${new Set(NICHOS.flatMap(n => codigosDoNicho(n.id, { incluirRelacionados: true }))).size} códigos CNAE`);
  log('');
  log('   Nada foi baixado. Para valer, rode sem --simular.');
  log('');
  process.exit(0);
}

// ── Etapa 5: fatiar ─────────────────────────────────────────────────────────

passo(5, 'Filtrando e gerando as fatias');
mkdirSync(FATIAS, { recursive: true });

// Um índice de código → nicho, para cada linha saber onde cai sem varrer tudo
const nichoPorCnae = new Map();
NICHOS.forEach(nicho => {
  codigosDoNicho(nicho.id, { incluirRelacionados: true }).forEach(codigo => {
    if (!nichoPorCnae.has(codigo)) nichoPorCnae.set(codigo, []);
    nichoPorCnae.get(codigo).push(nicho.id);
  });
});
log(`   ${nichoPorCnae.size} códigos em ${NICHOS.length} nichos`);
if (ufsPedidas) log(`   Só as UFs: ${ufsPedidas.join(', ')}`);

// Uma escrita por (nicho, UF). Abertas sob demanda: abrir 6×27 arquivos de
// antemão estouraria o limite de descritores do sistema.
const saidas = new Map();
function escreverEm(nichoId, uf, linhaCsv) {
  const chave = `${nichoId}__${uf}`;
  if (!saidas.has(chave)) {
    const fluxo = createWriteStream(join(FATIAS, `${chave}.csv`), { encoding: 'utf8' });
    fluxo.write('﻿' + COLUNAS_SAIDA.join(';') + '\n');
    saidas.set(chave, { fluxo, contagem: 0 });
  }
  const s = saidas.get(chave);
  s.fluxo.write(linhaCsv + '\n');
  s.contagem++;
}

const arquivosEstab = readdirSync(BRUTO)
  .filter(n => n.toUpperCase().includes('ESTABELE') && !n.toLowerCase().endsWith('.zip'))
  .map(n => join(BRUTO, n));

let lidas = 0, escritas = 0, semNome = 0;
const comeco = new Date().getTime();

for (const arquivo of arquivosEstab) {
  process.stdout.write(`   ${arquivo.split(/[\\/]/).pop()} … `);
  let doArquivo = 0;

  const leitor = createInterface({
    input: createReadStream(arquivo, { encoding: 'latin1' }),
    crlfDelay: Infinity,
  });

  for await (const linha of leitor) {
    if (!linha.trim()) continue;
    lidas++;
    const campos = dividirLinha(linha);

    const cnae = String(campos[COL.cnaePrincipal] || '').padStart(7, '0');
    const nichos = nichoPorCnae.get(cnae);
    if (!nichos) continue;

    const uf = String(campos[COL.uf] || '').toUpperCase();
    if (ufsPedidas && !ufsPedidas.includes(uf)) continue;
    if (!linhaInteressa(campos, { somenteAtivas: true })) continue;

    const lead = linhaParaLead(campos, { nomesDeCidade, nomesDeCnae });
    if (!lead.nome) { semNome++; continue; }

    const csv = leadParaCsv(lead);
    nichos.forEach(nichoId => escreverEm(nichoId, uf, csv));
    escritas++; doArquivo++;
  }

  log(`${doArquivo.toLocaleString('pt-BR')} encontrados`);
}

await Promise.all([...saidas.values()].map(s => new Promise(r => s.fluxo.end(r))));

// ── Relatório ───────────────────────────────────────────────────────────────

const minutos = ((new Date().getTime() - comeco) / 60000).toFixed(1);
log(`\n${'━'.repeat(58)}\n  PRONTO\n${'━'.repeat(58)}`);
log(`   ${lidas.toLocaleString('pt-BR')} empresas lidas em ${minutos} min`);
log(`   ${escritas.toLocaleString('pt-BR')} entraram nos seus nichos`);
if (semNome) log(`   ${semNome.toLocaleString('pt-BR')} descartadas por não ter nome`);

log('\n   Por nicho:');
NICHOS.forEach(nicho => {
  const total = [...saidas.entries()]
    .filter(([chave]) => chave.startsWith(nicho.id + '__'))
    .reduce((s, [, v]) => s + v.contagem, 0);
  const ufs = [...saidas.keys()].filter(c => c.startsWith(nicho.id + '__')).length;
  log(`     ${String(total).padStart(8)} em ${String(ufs).padStart(2)} UFs — ${nicho.nome}`);
  if (nicho.aviso) log(`              ⚠️  ${nicho.aviso.split('.')[0]}.`);
});

const tamanho = readdirSync(FATIAS).reduce((s, n) => s + statSync(join(FATIAS, n)).size, 0);
log(`\n   ${saidas.size} fatias em ${FATIAS} (${mb(tamanho)} MB)`);

if (limparNoFim) {
  log(`\n   🗑  Apagando os arquivos brutos…`);
  rmSync(BRUTO, { recursive: true, force: true });
  log('   Pronto. Os gigabytes foram embora, as fatias ficaram.');
} else {
  const bruto = readdirSync(BRUTO).reduce((s, n) => s + statSync(join(BRUTO, n)).size, 0);
  log(`\n   Os arquivos brutos ocupam ${mb(bruto)} MB em ${BRUTO}`);
  log('   Pode apagar essa pasta — ou rodar de novo com --limpar.');
}
log('');
