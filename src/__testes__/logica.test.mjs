import { lerCSV, gerarCSV, sugerirMapeamento, normalizarTitulo } from '../csv.js';
import { mesclarEtapas, ETAPAS_PADRAO, ehGanho, previsaoPonderada, valorEmAberto, valorGanho, acharEtapa } from '../pipeline.js';

let ok = 0, fail = 0;
const t = (nome, cond) => { if (cond) { ok++; } else { fail++; console.log('FALHOU:', nome); } };

// ── CSV: aspas, separador, quebra de linha dentro do campo ──
const csv = 'Nome;Valor;Obs\r\n"Clínica ""A"";B";2500;"linha 1\nlinha 2"\r\nBarbearia X;1.800,50;simples';
const r = lerCSV(csv);
t('colunas', JSON.stringify(r.colunas) === '["Nome","Valor","Obs"]');
t('2 linhas', r.linhas.length === 2);
t('aspas escapadas', r.linhas[0][0] === 'Clínica "A";B');
t('quebra interna', r.linhas[0][2] === 'linha 1\nlinha 2');
t('segunda linha', r.linhas[1][0] === 'Barbearia X');

// ── CSV com vírgula ──
const r2 = lerCSV('nome,email\nJoão,j@x.com');
t('detecta vírgula', r2.linhas[0][1] === 'j@x.com');

// ── Round-trip ──
const saida = gerarCSV([{ nome: 'A;B', valor: 10 }], [{ titulo: 'Nome', campo: 'nome' }, { titulo: 'Valor', campo: 'valor' }]);
t('round-trip', lerCSV(saida).linhas[0][0] === 'A;B');

// ── Mapeamento automático ──
const m = sugerirMapeamento(['Empresa', 'Celular', 'Ticket'], [
  { campo: 'nome', rotulo: 'Nome / Empresa', apelidos: ['empresa'] },
  { campo: 'whatsapp', rotulo: 'WhatsApp', apelidos: ['celular'] },
  { campo: 'valor', rotulo: 'Valor', apelidos: ['ticket'] },
]);
t('mapeia empresa->nome', m.nome === 0);
t('mapeia celular->whatsapp', m.whatsapp === 1);
t('mapeia ticket->valor', m.valor === 2);
t('normaliza acento', normalizarTitulo('Responsável') === 'responsavel');

// ── Pipeline ──
const e = mesclarEtapas(null);
t('etapas padrão', e.length === ETAPAS_PADRAO.length);
t('venda é ganho', ehGanho(e, 'venda'));
t('perda não é ganho', !ehGanho(e, 'perda'));
t('status desconhecido cai em nenhum', acharEtapa(e, 'xyz').id === 'nenhum');

const custom = mesclarEtapas([{ id: 'venda', label: 'Fechado', probabilidade: 100, ordem: 0 }]);
t('override de rótulo', custom.find(x => x.id === 'venda').label === 'Fechado');
t('mantém cls do padrão', custom.find(x => x.id === 'venda').cls === 's-venda');
t('config parcial não quebra', custom.length === ETAPAS_PADRAO.length);

const leads = [
  { status: 'reuniao-marcada', valor: 10000 },  // 60% -> 6000
  { status: 'contato-decisor', valor: 5000 },   // 40% -> 2000
  { status: 'venda', valor: 20000 },            // ganho
  { status: 'perda', valor: 9999 },             // ignorado
  { status: 'lead-qualificado' },               // sem valor
];
t('em aberto = 15000', valorEmAberto(e, leads) === 15000);
t('previsão = 8000', previsaoPonderada(e, leads) === 8000);
t('ganho = 20000', valorGanho(e, leads) === 20000);

console.log(`\n${ok} passaram, ${fail} falharam`);
process.exit(fail > 0 ? 1 : 0);
