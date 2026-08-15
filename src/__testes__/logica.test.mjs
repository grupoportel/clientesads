import { lerCSV, gerarCSV, sugerirMapeamento, normalizarTitulo } from '../csv.js';
import { mesclarEtapas, ETAPAS_PADRAO, ehGanho, previsaoPonderada, valorEmAberto, valorGanho, acharEtapa } from '../pipeline.js';
import { calcularJanela, dentro, dataEntrada, dataFecho, ultimosMeses, chaveMes, iso, formataData } from '../periodo.js';
import { aplicarModelo, montarContexto, variaveisUsadas, variaveisVazias, variaveisDesconhecidas } from '../modelos.js';
import { regrasQueDisparam, regraValida, calcularPrazo, planejarAcoes } from '../automacoes.js';
import { saudeCliente, saudeMediaDaCarteira, receitaRecorrente, clienteAPartirDoLead, ganhosSemCliente } from '../clientes.js';
import { normalizarMeta, achatar, extrairCampos, extrairUtm, acharDuplicado, camposParaCompletar } from '../../api/_leadIn.js';
import { papelDoUsuario, podeEditar, podeAdministrar, podeVer, motivoBloqueio } from '../papeis.js';

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

// ── BOM ──
// O Excel só lê acentos se o arquivo começar com a marca de ordem de bytes,
// e ela precisa ser removida na releitura senão gruda no primeiro cabeçalho.
const comBom = '﻿' + gerarCSV([{ nome: 'Ação' }], [{ titulo: 'Nome', campo: 'nome' }]);
t('BOM é removido na leitura', lerCSV(comBom).colunas[0] === 'Nome');
t('acento sobrevive ao round-trip', lerCSV(comBom).linhas[0][0] === 'Ação');

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

// ── Períodos ──
// 15/03/2026, um dia qualquer no meio do mês
const marco = new Date(2026, 2, 15, 10, 0, 0);

const jMes = calcularJanela('mes', marco);
t('mês começa no dia 1', jMes.inicio === '2026-03-01');
t('mês termina hoje', jMes.fim === '2026-03-15');
t('mês anterior começa em 1/2', jMes.inicioAnt === '2026-02-01');
t('mês anterior termina no último dia', jMes.fimAnt === '2026-02-28');

// Janeiro: a janela anterior precisa voltar um ano
const jJan = calcularJanela('mes', new Date(2026, 0, 10));
t('janeiro volta para dezembro', jJan.inicioAnt === '2025-12-01');
t('dezembro termina em 31', jJan.fimAnt === '2025-12-31');

// Ano bissexto: fevereiro de 2028 tem 29 dias
t('fevereiro bissexto termina em 29', calcularJanela('mes', new Date(2028, 2, 5)).fimAnt === '2028-02-29');

const j30 = calcularJanela('30d', marco);
t('30d começa 30 dias antes', j30.inicio === '2026-02-13');
t('30d anterior encosta sem sobrepor', j30.fimAnt === '2026-02-12');
t('30d anterior tem 30 dias', j30.inicioAnt === '2026-01-13');

const jTudo = calcularJanela('tudo', marco);
t('tudo não tem limites', jTudo.inicio === null && jTudo.fimAnt === null);

// iso() usa fuso local: 23h30 de 31/01 não pode virar 01/02
t('iso respeita o fuso local', iso(new Date(2026, 0, 31, 23, 30)) === '2026-01-31');

// dentro()
t('dentro: no limite inicial', dentro('2026-03-01', '2026-03-01', '2026-03-15'));
t('dentro: no limite final', dentro('2026-03-15', '2026-03-01', '2026-03-15'));
t('dentro: antes do início', !dentro('2026-02-28', '2026-03-01', '2026-03-15'));
t('dentro: depois do fim', !dentro('2026-03-16', '2026-03-01', '2026-03-15'));
t('dentro: sem data é falso', !dentro('', '2026-03-01', '2026-03-15'));
t('dentro: sem limites aceita', dentro('2026-03-01', null, null));
t('dentro: corta timestamp ISO', dentro('2026-03-10T22:14:00.000Z', '2026-03-01', '2026-03-15'));

// Datas do lead
t('data_entrada tem prioridade', dataEntrada({ data_entrada: '2026-01-05', createdAt: '2026-02-09T00:00:00Z' }) === '2026-01-05');
t('cai para createdAt', dataEntrada({ createdAt: '2026-02-09T00:00:00Z' }) === '2026-02-09');
t('fechadoEm tem prioridade', dataFecho({ fechadoEm: '2026-03-01T00:00:00Z', updatedAt: '2026-03-09T00:00:00Z' }) === '2026-03-01');
t('fecho cai para updatedAt', dataFecho({ updatedAt: '2026-03-09T00:00:00Z' }) === '2026-03-09');
t('lead vazio não quebra', dataEntrada(null) === '' && dataFecho(undefined) === '');

// Últimos meses
const seis = ultimosMeses(6, marco);
t('6 meses', seis.length === 6);
t('último é o mês atual', seis[5].chave === '2026-03');
t('primeiro é 5 meses atrás', seis[0].chave === '2025-10');
t('chaveMes extrai ano-mês', chaveMes('2026-03-15T10:00:00Z') === '2026-03');
t('formataData inverte', formataData('2026-03-15') === '15/03/2026');

// ── Modelos de mensagem ──
const leadEx = { nome: 'Clínica São Lucas', decisor: 'Dra. Marina', valor: 2500, nicho: 'Odontologia', cidade: 'Sinop' };
const ctx = montarContexto(leadEx, { empresa: 'Grupo Portel', meuNome: 'Gui' });

t('substitui variável', aplicarModelo('Olá {{decisor}}!', ctx) === 'Olá Dra. Marina!');
t('aceita espaços na chave', aplicarModelo('Olá {{ decisor }}!', ctx) === 'Olá Dra. Marina!');
t('primeiro nome', ctx.primeiroNome === 'Clínica');
t('valor formatado', ctx.valor === 'R$ 2.500');
t('variável desconhecida fica crua', aplicarModelo('{{inexistente}}', ctx) === '{{inexistente}}');
t('múltiplas ocorrências', aplicarModelo('{{nome}} / {{nome}}', ctx) === 'Clínica São Lucas / Clínica São Lucas');
t('texto vazio não quebra', aplicarModelo('', ctx) === '' && aplicarModelo(null, ctx) === '');
t('lista variáveis usadas', JSON.stringify(variaveisUsadas('{{nome}} e {{cidade}} e {{nome}}')) === '["nome","cidade"]');
t('detecta vazias', JSON.stringify(variaveisVazias('{{estado}}', ctx)) === '["estado"]');
t('detecta desconhecidas', JSON.stringify(variaveisDesconhecidas('{{foo}} {{nome}}')) === '["foo"]');

// ── Automações ──
const regraFollowup = {
  id: 'r1', nome: 'Follow-up pós-reunião', ativa: true,
  gatilho: { tipo: 'statusMudou', para: 'reuniao-marcada' },
  acoes: [{ tipo: 'criarTarefa', titulo: 'Ligar para {{primeiroNome}}', prazoDias: 2, tipoTarefa: 'ligacao', responsavel: 'doLead' }],
};

const leadReuniao = { id: 'L1', nome: 'Clínica São Lucas', status: 'reuniao-marcada', responsavel: 'João' };

t('dispara na etapa certa',
  regrasQueDisparam([regraFollowup], { tipo: 'statusMudou', lead: leadReuniao, statusAnterior: 'ligacao-feita' }).length === 1);
t('não dispara em outra etapa',
  regrasQueDisparam([regraFollowup], { tipo: 'statusMudou', lead: { ...leadReuniao, status: 'venda' }, statusAnterior: 'ligacao-feita' }).length === 0);
t('não dispara sem mudança real',
  regrasQueDisparam([regraFollowup], { tipo: 'statusMudou', lead: leadReuniao, statusAnterior: 'reuniao-marcada' }).length === 0);
t('regra inativa não dispara',
  regrasQueDisparam([{ ...regraFollowup, ativa: false }], { tipo: 'statusMudou', lead: leadReuniao, statusAnterior: 'nenhum' }).length === 0);
t('gatilho de tipo diferente não dispara',
  regrasQueDisparam([regraFollowup], { tipo: 'leadCriado', lead: leadReuniao }).length === 0);

// "de" restringe a origem
const comDe = { ...regraFollowup, gatilho: { ...regraFollowup.gatilho, de: 'contato-decisor' } };
t('respeita o "de" quando bate',
  regrasQueDisparam([comDe], { tipo: 'statusMudou', lead: leadReuniao, statusAnterior: 'contato-decisor' }).length === 1);
t('respeita o "de" quando não bate',
  regrasQueDisparam([comDe], { tipo: 'statusMudou', lead: leadReuniao, statusAnterior: 'ligacao-feita' }).length === 0);

// Condições
const soOdonto = { ...regraFollowup, condicoes: { nicho: 'Odontologia' } };
t('condição de nicho barra',
  regrasQueDisparam([soOdonto], { tipo: 'statusMudou', lead: leadReuniao, statusAnterior: 'nenhum' }).length === 0);
t('condição de nicho passa',
  regrasQueDisparam([soOdonto], { tipo: 'statusMudou', lead: { ...leadReuniao, nicho: 'Odontologia' }, statusAnterior: 'nenhum' }).length === 1);
t('condição de valor mínimo',
  regrasQueDisparam([{ ...regraFollowup, condicoes: { valorMinimo: 5000 } }],
    { tipo: 'statusMudou', lead: { ...leadReuniao, valor: 1000 }, statusAnterior: 'nenhum' }).length === 0);

// Regra malformada nunca dispara
t('sem ações é inválida', !regraValida({ ...regraFollowup, acoes: [] }));
t('gatilho desconhecido é inválido', !regraValida({ ...regraFollowup, gatilho: { tipo: 'xyz' } }));
t('statusMudou sem "para" é inválida', !regraValida({ ...regraFollowup, gatilho: { tipo: 'statusMudou' } }));

// Prazo
const base = new Date(2026, 7, 14); // 14/08/2026
t('prazo de 2 dias', calcularPrazo(2, base) === '2026-08-16');
t('prazo 0 é hoje', calcularPrazo(0, base) === '2026-08-14');
t('prazo vira o mês', calcularPrazo(20, base) === '2026-09-03');

// Plano de ações
const plano = planejarAcoes(regraFollowup, leadReuniao, { vars: ctx, agora: base });
t('planeja uma tarefa', plano.tarefas.length === 1);
t('título com variável aplicada', plano.tarefas[0].titulo === 'Ligar para Clínica');
t('responsável do lead', plano.tarefas[0].responsavel === 'João');
t('data do prazo', plano.tarefas[0].data === '2026-08-16');

// definirCampo não sobrescreve o que a pessoa já preencheu
const regraCampo = {
  id: 'r2', nome: 'Marcar origem', ativa: true,
  gatilho: { tipo: 'leadCriado' },
  acoes: [{ tipo: 'definirCampo', campo: 'origem', valor: 'site' }],
};
t('preenche campo vazio',
  planejarAcoes(regraCampo, { id: 'L2', nome: 'X' }, {}).camposDoLead.origem === 'site');
t('não sobrescreve campo preenchido',
  planejarAcoes(regraCampo, { id: 'L2', nome: 'X', origem: 'indicacao' }, {}).camposDoLead.origem === undefined);
t('sobrescreve quando pedido',
  planejarAcoes({ ...regraCampo, acoes: [{ ...regraCampo.acoes[0], sobrescrever: true }] },
    { id: 'L2', nome: 'X', origem: 'indicacao' }, {}).camposDoLead.origem === 'site');

// ── Saúde do cliente ──
const AGORA = new Date(2026, 7, 14).getTime(); // 14/08/2026
const diasAtras = (n) => new Date(AGORA - n * 86400000).toISOString().slice(0, 10);

const saudavel = { statusCliente: 'ativo', ultimoContato: diasAtras(3), telefone: '111', dataInicio: diasAtras(30) };
t('cliente recente é saudável', saudeCliente(saudavel, AGORA).pct === 100);
t('rótulo saudável', saudeCliente(saudavel, AGORA).rotulo === 'Saudável');

t('cancelado é sempre zero',
  saudeCliente({ ...saudavel, statusCliente: 'cancelado' }, AGORA).pct === 0);

t('pausado desconta',
  saudeCliente({ ...saudavel, statusCliente: 'pausado' }, AGORA).pct === 70);

t('sem contato há 40 dias',
  saudeCliente({ ...saudavel, ultimoContato: diasAtras(40) }, AGORA).pct === 45);

t('nunca contactado',
  saudeCliente({ ...saudavel, ultimoContato: '' }, AGORA).pct === 30);

t('sem canal de contato desconta',
  saudeCliente({ statusCliente: 'ativo', ultimoContato: diasAtras(3), dataInicio: diasAtras(30) }, AGORA).pct === 90);

t('tempo de casa soma',
  saudeCliente({ ...saudavel, ultimoContato: diasAtras(20), dataInicio: diasAtras(400) }, AGORA).pct === 75);

t('nunca passa de 100',
  saudeCliente({ ...saudavel, dataInicio: diasAtras(400) }, AGORA).pct === 100);

t('devolve motivos', saudeCliente({ ...saudavel, ultimoContato: diasAtras(40) }, AGORA).motivos.length > 0);

// Média da carteira ignora cancelados
const carteira = [
  { statusCliente: 'ativo', ultimoContato: diasAtras(3), telefone: '1', dataInicio: diasAtras(30) },  // 100
  { statusCliente: 'cancelado', ultimoContato: diasAtras(3) },                                          // fora
];
t('média ignora cancelados', saudeMediaDaCarteira(carteira, AGORA) === 100);
t('carteira vazia devolve null', saudeMediaDaCarteira([{ statusCliente: 'cancelado' }], AGORA) === null);

// Receita recorrente
t('receita só de ativos', receitaRecorrente([
  { statusCliente: 'ativo', valorMensal: 1000 },
  { statusCliente: 'pausado', valorMensal: 500 },
  { statusCliente: 'cancelado', valorMensal: 999 },
]) === 1000);

// Conversão
const leadGanho = { id: 'L9', nome: 'Clínica X', valor: 3000, nicho: 'Odonto', responsavel: 'Ana', email: 'a@x.com', ultimo_contato: '2026-08-01' };
const novoCliente = clienteAPartirDoLead(leadGanho, '2026-08-14');
t('conversão leva o nome', novoCliente.nome === 'Clínica X');
t('valor vira mensalidade', novoCliente.valorMensal === 3000);
t('guarda o vínculo com o lead', novoCliente.leadId === 'L9');
t('começa ativo', novoCliente.statusCliente === 'ativo');
t('data de início é hoje', novoCliente.dataInicio === '2026-08-14');
t('aproveita o último contato', novoCliente.ultimoContato === '2026-08-01');

// Ganhos ainda não convertidos
const ehGanhoTeste = (st) => st === 'venda';
t('lista ganhos sem cliente',
  ganhosSemCliente(
    [{ id: 'A', status: 'venda' }, { id: 'B', status: 'venda' }, { id: 'C', status: 'perda' }],
    [{ leadId: 'A' }],
    ehGanhoTeste,
  ).map(l => l.id).join(',') === 'B');

// ── Entrada de leads (webhook) ──
// Meta Ads manda [{ name, values }] em vez de um objeto plano
const metaBruto = { field_data: [
  { name: 'full_name',    values: ['Clínica Sorriso'] },
  { name: 'phone_number', values: ['+55 (66) 99999-1234'] },
  { name: 'email',        values: ['Contato@Sorriso.com'] },
]};
const metaPlano = normalizarMeta(metaBruto);
t('achata o formato do Meta', metaPlano.full_name === 'Clínica Sorriso');
const metaCampos = extrairCampos(metaPlano);
t('Meta: nome', metaCampos.nome === 'Clínica Sorriso');
t('Meta: telefone', metaCampos.telefone === '+55 (66) 99999-1234');
t('Meta: email', metaCampos.email === 'Contato@Sorriso.com');

// Meta às vezes envelopa em entry[].changes[].value
t('Meta aninhado também funciona',
  normalizarMeta({ entry: [{ changes: [{ value: { field_data: [{ name: 'name', values: ['X'] }] } }] }] })?.name === 'X');
t('payload comum não é confundido com Meta', normalizarMeta({ nome: 'X' }) === null);

// Formulário de site com objeto aninhado
const site = achatar({ contato: { nome: 'Barbearia Z', email: 'z@b.com' }, utm_source: 'google', utm_campaign: 'verao' });
t('achata objeto aninhado', site.contato_nome === 'Barbearia Z');
const siteCampos = extrairCampos(site);
t('site: nome aninhado é encontrado pelo sufixo', siteCampos.nome === 'Barbearia Z');
t('site: email aninhado é encontrado', siteCampos.email === 'z@b.com');

// Chave exata sempre ganha do sufixo, senão o decisor viraria o nome da empresa
t('chave exata tem prioridade sobre sufixo',
  extrairCampos({ decisor_nome: 'Dra. Marina', nome: 'Clínica X' }).nome === 'Clínica X');
t('sufixo composto funciona',
  extrairCampos({ form_email_address: 'a@b.com' }).email === 'a@b.com');

// Variações de caixa e separador
t('FULL_NAME funciona', extrairCampos({ FULL_NAME: 'A' }).nome === 'A');
t('Nome-Completo funciona', extrairCampos({ 'Nome-Completo': 'B' }).nome === 'B');
t('celular vira whatsapp', extrairCampos({ celular: '66999' }).whatsapp === '66999');
t('campo vazio é ignorado', extrairCampos({ nome: '   ' }).nome === undefined);

// UTM
t('captura utm', JSON.stringify(extrairUtm(site)) === '{"utmsource":"google","utmcampaign":"verao"}');
t('sem utm devolve null', extrairUtm({ nome: 'X' }) === null);

// Deduplicação
const baseLeads = {
  L1: { nome: 'Antigo', email: 'joao@x.com', telefone: '(66) 99999-1234' },
  L2: { nome: 'Outro',  whatsapp: '66988887777' },
};
t('acha duplicado por e-mail (caixa diferente)',
  acharDuplicado(baseLeads, { email: 'JOAO@X.COM' })?.[0] === 'L1');
t('acha duplicado por telefone com máscara diferente',
  acharDuplicado(baseLeads, { telefone: '66999991234' })?.[0] === 'L1');
t('acha duplicado comparando whatsapp',
  acharDuplicado(baseLeads, { whatsapp: '(66) 98888-7777' })?.[0] === 'L2');
t('telefone curto não casa ninguém',
  acharDuplicado(baseLeads, { telefone: '1234' }) === null);
t('lead novo não é duplicado',
  acharDuplicado(baseLeads, { email: 'novo@x.com' }) === null);

// Completar só o que falta
t('completa buraco sem sobrescrever',
  JSON.stringify(camposParaCompletar({ nome: 'Antigo', email: 'a@x.com' }, { nome: 'Novo', cidade: 'Sinop' }))
    === '{"cidade":"Sinop"}');

// ── Papéis ──
// Sem usuário nenhum, quem entra é Admin: é o único jeito de o primeiro
// cadastro acontecer. As regras do banco fazem a mesma concessão.
const semNinguem = papelDoUsuario('U1', []);
t('primeira configuração dá Admin', semNinguem.papel === 'Admin');
t('marca que é primeira configuração', semNinguem.primeiraConfiguracao === true);

// A partir do primeiro registro, o portão fecha
const equipe = [
  { uid: 'U1', role: 'Admin' },
  { uid: 'U2', role: 'Editor' },
  { uid: 'U3', role: 'Viewer' },
];
t('acha o papel do admin', papelDoUsuario('U1', equipe).papel === 'Admin');
t('acha o papel do editor', papelDoUsuario('U2', equipe).papel === 'Editor');
t('quem não tem registro não é ninguém', papelDoUsuario('U9', equipe).papel === null);
t('e não é primeira configuração', papelDoUsuario('U9', equipe).primeiraConfiguracao === false);
t('registro sem role vira Viewer', papelDoUsuario('U4', [{ uid: 'U4' }]).papel === 'Viewer');
t('aceita id no lugar de uid', papelDoUsuario('U5', [{ id: 'U5', role: 'Admin' }]).papel === 'Admin');

// Permissões
t('admin edita', podeEditar('Admin'));
t('editor edita', podeEditar('Editor'));
t('viewer não edita', !podeEditar('Viewer'));
t('sem papel não edita', !podeEditar(null));

t('só admin administra', podeAdministrar('Admin'));
t('editor não administra', !podeAdministrar('Editor'));
t('viewer não administra', !podeAdministrar('Viewer'));

t('viewer vê', podeVer('Viewer'));
t('sem papel não vê', !podeVer(null));

// Mensagens de bloqueio precisam dizer o que houve
t('sem papel explica que falta liberar', motivoBloqueio(null).includes('não foi liberado'));
t('viewer explica somente leitura', motivoBloqueio('Viewer', 'excluir').includes('excluir'));
t('editor explica que é coisa de admin', motivoBloqueio('Editor').includes('administrador'));

console.log(`\n${ok} passaram, ${fail} falharam`);
process.exit(fail > 0 ? 1 : 0);
