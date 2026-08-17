import { lerCSV, gerarCSV, sugerirMapeamento, normalizarTitulo } from '../csv.js';
import { mesclarEtapas, ETAPAS_PADRAO, ehGanho, previsaoPonderada, valorEmAberto, valorGanho, acharEtapa } from '../pipeline.js';
import { calcularJanela, dentro, dataEntrada, dataFecho, ultimosMeses, chaveMes, iso, formataData } from '../periodo.js';
import { aplicarModelo, montarContexto, variaveisUsadas, variaveisVazias, variaveisDesconhecidas } from '../modelos.js';
import { regrasQueDisparam, regraValida, calcularPrazo, planejarAcoes } from '../automacoes.js';
import { saudeCliente, saudeMediaDaCarteira, receitaRecorrente, clienteAPartirDoLead, ganhosSemCliente } from '../clientes.js';
import { normalizarMeta, achatar, extrairCampos, extrairUtm, acharDuplicado, camposParaCompletar } from '../../api/_leadIn.js';
import { papelDoUsuario, podeEditar, podeAdministrar, podeVer, motivoBloqueio } from '../papeis.js';
import { configuracaoAgenda, somarMinutos, inicioDoEvento, textoDataHora, montarEvento, textoConfirmacao, explicarErroAgenda } from '../../api/_agenda.js';
import { INTENCOES, acharIntencao, resumirHistorico, montarPromptMensagem, interpretarMensagem, ehTransitorio, atrasoDaTentativa, escolherModelo, configuracaoIa, textoDoHtml, urlDoSite, montarPromptAnalise, interpretarAnalise, CAMPOS_ANALISE } from '../../api/_ia.js';
import { responderPara, montarHtml, configuracaoSmtp, caixaDeEntrada, explicarErroSmtp } from '../../api/_email.js';
import { paraLixeira, deLixeira, diasNaLixeira, vencidos, planoDeDesfazer, textoTempoNaLixeira, PRAZO_DIAS } from '../lixeira.js';

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


// ── Lixeira ──
const AGORA_LX = new Date('2026-08-15T12:00:00').getTime();
const diasAtrasIso = (d) => new Date(AGORA_LX - d * 86400000).toISOString();
const leadPraApagar = { id: 'L1', nome: 'Clínica Sorriso', status: 'venda', valor: 4500, tipo: 'quente' };

const itemLx = paraLixeira(leadPraApagar, 'gui@portel.com', '2026-08-15T12:00:00.000Z');
t('lixeira guarda o lead inteiro', itemLx.dados.valor === 4500 && itemLx.dados.status === 'venda');
t('lixeira guarda quem apagou', itemLx.excluidoPor === 'gui@portel.com');
t('lixeira guarda o id original', itemLx.idOriginal === 'L1');

// O lead tem um campo `tipo` próprio; o `tipo` da lixeira não pode engoli-lo
t('campo do lead nao colide com o da lixeira', itemLx.tipo === 'lead' && itemLx.dados.tipo === 'quente');

t('lead sem nome ainda tem rotulo', paraLixeira({ id: 'L2' }).rotulo === '(sem nome)');
t('sem quem apagou nao fica vazio', paraLixeira({ id: 'L2' }).excluidoPor === 'desconhecido');

// Ida e volta tem que devolver o mesmo lead
const restaurado = deLixeira(itemLx);
t('restaura no id certo', restaurado.id === 'L1');
t('restaura o lead igual', JSON.stringify(restaurado.dados) === JSON.stringify(leadPraApagar));

t('item sem dados nao restaura', deLixeira({ idOriginal: 'L1' }) === null);
t('item sem id nao restaura', deLixeira({ dados: { nome: 'X' } }) === null);
t('item nulo nao quebra', deLixeira(null) === null);

// Idade
t('apagado hoje tem 0 dias', diasNaLixeira({ excluidoEm: diasAtrasIso(0) }, AGORA_LX) === 0);
t('apagado ha 5 dias', diasNaLixeira({ excluidoEm: diasAtrasIso(5) }, AGORA_LX) === 5);
t('sem data nao vira negativo', diasNaLixeira({}, AGORA_LX) === 0);
t('data invalida nao vira NaN', diasNaLixeira({ excluidoEm: 'ontem' }, AGORA_LX) === 0);

const naLixeira = [
  { excluidoEm: diasAtrasIso(2) },
  { excluidoEm: diasAtrasIso(45) },
  { excluidoEm: diasAtrasIso(PRAZO_DIAS) },
];
t('vencidos conta a partir do prazo', vencidos(naLixeira, AGORA_LX).length === 2);
t('lixeira vazia nao tem vencidos', vencidos([], AGORA_LX).length === 0);

t('texto hoje', textoTempoNaLixeira({ excluidoEm: diasAtrasIso(0) }, AGORA_LX) === 'hoje');
t('texto ontem', textoTempoNaLixeira({ excluidoEm: diasAtrasIso(1) }, AGORA_LX) === 'ontem');
t('texto dias', textoTempoNaLixeira({ excluidoEm: diasAtrasIso(9) }, AGORA_LX) === 'há 9 dias');
t('texto mes no singular', textoTempoNaLixeira({ excluidoEm: diasAtrasIso(31) }, AGORA_LX) === 'há 1 mês');
t('texto meses no plural', textoTempoNaLixeira({ excluidoEm: diasAtrasIso(70) }, AGORA_LX) === 'há 2 meses');

// ── Desfazer edição em massa ──
const planoUndo = planoDeDesfazer({ L1: 'Ana', L2: 'Bruno' }, 'responsavel');
t('desfazer devolve cada valor', planoUndo['L1/responsavel'] === 'Ana' && planoUndo['L2/responsavel'] === 'Bruno');

// Quem não tinha o campo precisa voltar a não ter: gravar undefined faria o
// Firebase ignorar a chave e o valor novo continuaria lá.
const planoVazio = planoDeDesfazer({ L1: undefined, L2: '', L3: 0 }, 'valor');
t('campo que nao existia volta a null', planoVazio['L1/valor'] === null);
t('string vazia vira null', planoVazio['L2/valor'] === null);
t('zero nao e confundido com vazio', planoVazio['L3/valor'] === 0);
t('nada selecionado gera plano vazio', Object.keys(planoDeDesfazer({}, 'status')).length === 0);


// ── Configuração de e-mail ──
const hostinger = { SMTP_HOST: 'smtp.hostinger.com', SMTP_USER: 'contato@grupoportel.com', SMTP_PASS: 'x' };

t('sem credencial nenhuma devolve null', configuracaoSmtp({}) === null);
t('host sem senha nao vale', configuracaoSmtp({ SMTP_HOST: 'a', SMTP_USER: 'b' }) === null);

const cfg465 = configuracaoSmtp({ ...hostinger, SMTP_PORT: '465' });
t('465 usa TLS direto', cfg465.secure === true && cfg465.port === 465);

// 587 e STARTTLS: marcar secure aqui trava a conexao sem erro claro
const cfg587 = configuracaoSmtp({ ...hostinger, SMTP_PORT: '587' });
t('587 nao usa TLS direto', cfg587.secure === false && cfg587.port === 587);

t('porta ausente cai em 465', configuracaoSmtp(hostinger).port === 465);
t('porta invalida cai em 465', configuracaoSmtp({ ...hostinger, SMTP_PORT: 'abc' }).port === 465);
t('remetente padrao e o usuario', configuracaoSmtp(hostinger).remetente === 'contato@grupoportel.com');
t('remetente pode ser outro', configuracaoSmtp({ ...hostinger, SMTP_REMETENTE: 'nao-responda@grupoportel.com' }).remetente === 'nao-responda@grupoportel.com');
t('nome padrao', configuracaoSmtp(hostinger).nome === 'Grupo Portel');

// O formato antigo continua valendo enquanto a Vercel nao tiver as variaveis novas
const antigo = configuracaoSmtp({ GMAIL_USER: 'a@gmail.com', GMAIL_APP_PASSWORD: 'senha' });
t('gmail antigo ainda funciona', antigo.host === 'smtp.gmail.com' && antigo.origem === 'gmail');
t('smtp novo tem prioridade', configuracaoSmtp({ ...hostinger, GMAIL_USER: 'a@gmail.com', GMAIL_APP_PASSWORD: 's' }).origem === 'smtp');

t('caixa de entrada usa o remetente', caixaDeEntrada({ ...hostinger, SMTP_REMETENTE: 'oi@x.com' }) === 'oi@x.com');
t('caixa de entrada cai no usuario', caixaDeEntrada(hostinger) === 'contato@grupoportel.com');
t('caixa de entrada sem nada e vazia', caixaDeEntrada({}) === '');

t('EAUTH vira aviso de senha', explicarErroSmtp({ code: 'EAUTH' }).includes('SMTP_USER'));
t('timeout vira aviso de host', explicarErroSmtp({ code: 'ETIMEDOUT' }).includes('SMTP_HOST'));
t('erro desconhecido nao e sequestrado', explicarErroSmtp({ code: 'XPTO', message: 'deu ruim' }) === null);


// ── IA ──
t('sem chave nenhuma devolve null', configuracaoIa({}) === null);
t('gemini pela chave', configuracaoIa({ GEMINI_API_KEY: 'k' }).provedor === 'gemini');
t('gemini tem prioridade sobre anthropic', configuracaoIa({ GEMINI_API_KEY: 'k', ANTHROPIC_API_KEY: 'a' }).provedor === 'gemini');
t('anthropic sozinho vale', configuracaoIa({ ANTHROPIC_API_KEY: 'a' }).provedor === 'anthropic');
t('modelo pode ser trocado', configuracaoIa({ GEMINI_API_KEY: 'k', GEMINI_MODELO: 'outro' }).modelo === 'outro');

// Limpeza de HTML: script e style viram paredao de codigo dentro do prompt
const html = '<html><head><style>a{color:red}</style><script>var x=1;</script></head><body><h1>Pizzaria Bella</h1><p>Massa &amp; molho</p><!-- oculto --></body></html>';
const texto = textoDoHtml(html);
t('tira script', !texto.includes('var x'));
t('tira style', !texto.includes('color:red'));
t('tira comentario', !texto.includes('oculto'));
t('mantem o conteudo', texto.includes('Pizzaria Bella'));
t('resolve entidade', texto.includes('Massa & molho'));
t('corta no limite', textoDoHtml('<p>' + 'a'.repeat(500) + '</p>', 100).length <= 101);

// URL: o campo site e digitado a mao, entao chega de tudo
t('completa esquema', urlDoSite('grupoportel.com').startsWith('https://'));
t('mantem http', urlDoSite('http://x.com').startsWith('http://'));
t('vazio nao vira url', urlDoSite('') === null);
t('texto solto nao vira url', urlDoSite('nao tem') === null);

// Nao deixar o servidor buscar a propria rede interna a partir de um campo do lead
t('bloqueia localhost', urlDoSite('http://localhost:8080') === null);
t('bloqueia rede interna', urlDoSite('http://192.168.0.1') === null);
t('bloqueia metadados da nuvem', urlDoSite('http://169.254.169.254/latest/meta-data') === null);
t('bloqueia file://', urlDoSite('file:///etc/passwd') === null);

// Prompt
const promptCheio = montarPromptAnalise({ nome: 'Pizzaria Bella', nicho: 'Pizzaria', cidade: 'Cuiaba', estado: 'MT' }, 'texto do site');
t('prompt leva o nome', promptCheio.includes('Pizzaria Bella'));
t('prompt junta cidade e estado', promptCheio.includes('Cuiaba / MT'));
t('prompt marca que leu o site', promptCheio.includes('CONTEUDO DO SITE'.replace('CONTEUDO','CONTEÚDO')));
t('prompt avisa quando nao leu', montarPromptAnalise({ nome: 'X' }, '').includes('não pôde ser lido'));
t('campo vazio nao entra no prompt', !montarPromptAnalise({ nome: 'X', nicho: '' }, '').includes('Nicho'));

// Interpretacao da resposta
const bom = interpretarAnalise('{"melhores":"tem instagram ativo","oportunidades":"sem trafego pago","pontos":"","escalar":"alto","confianca":"alta"}');
t('le json limpo', bom.campos.melhores === 'tem instagram ativo');
t('descarta campo vazio', bom.campos.pontos === undefined);
t('le a confianca', bom.confianca === 'alta');

t('le json em cerca de codigo', interpretarAnalise(['```json', '{"melhores":"ok"}', '```'].join('\n')).campos.melhores === 'ok');
t('le json com texto em volta', interpretarAnalise('Claro! {"melhores":"ok"} espero ter ajudado').campos.melhores === 'ok');

// A resposta do modelo nao pode injetar chave nenhuma no cadastro do lead
const invasor = interpretarAnalise('{"melhores":"ok","status":"venda","valor":999999,"nome":"HACK"}');
t('so aceita os campos previstos', Object.keys(invasor.campos).every(k => CAMPOS_ANALISE.includes(k)));
t('ignora status vindo da ia', invasor.campos.status === undefined);
t('ignora valor vindo da ia', invasor.campos.valor === undefined);

t('confianca invalida vira baixa', interpretarAnalise('{"melhores":"ok","confianca":"altissima"}').confianca === 'baixa');
t('json quebrado devolve null', interpretarAnalise('{isso nao e json') === null);
t('texto sem json devolve null', interpretarAnalise('desculpe, nao consegui') === null);
t('json sem campo util devolve null', interpretarAnalise('{"confianca":"alta"}') === null);
t('campos so com espaco devolve null', interpretarAnalise('{"melhores":"   "}') === null);


// ── Google Agenda ──
const credFb = { FIREBASE_CLIENT_EMAIL: 'sa@x.iam.gserviceaccount.com', FIREBASE_PRIVATE_KEY: 'chave' };

t('sem calendario nao configura', configuracaoAgenda(credFb) === null);
t('sem credencial nao configura', configuracaoAgenda({ GOOGLE_CALENDAR_ID: 'a@b.com' }) === null);
t('reaproveita a conta do firebase', configuracaoAgenda({ ...credFb, GOOGLE_CALENDAR_ID: 'a@b.com' }).email === 'sa@x.iam.gserviceaccount.com');
t('conta dedicada tem prioridade', configuracaoAgenda({ ...credFb, GOOGLE_CALENDAR_ID: 'a@b.com', GOOGLE_CALENDAR_CLIENT_EMAIL: 'outra@x.com', GOOGLE_CALENDAR_PRIVATE_KEY: 'k' }).email === 'outra@x.com');
t('fuso padrao acompanha a agenda de quem usa', configuracaoAgenda({ ...credFb, GOOGLE_CALENDAR_ID: 'a@b.com' }).fuso === 'America/Sao_Paulo');
t('fuso pode ser trocado', configuracaoAgenda({ ...credFb, GOOGLE_CALENDAR_ID: 'a@b.com', AGENDA_FUSO: 'America/Cuiaba' }).fuso === 'America/Cuiaba');
// A chave chega do painel da Vercel com a quebra de linha escapada, e precisa
// virar quebra de verdade antes de ir para o Google
const BARRA_N = String.fromCharCode(92) + 'n';
const QUEBRA = String.fromCharCode(10);
t('desescapa a quebra de linha da chave',
  configuracaoAgenda({ ...credFb, FIREBASE_PRIVATE_KEY: 'a' + BARRA_N + 'b', GOOGLE_CALENDAR_ID: 'x' }).chave === 'a' + QUEBRA + 'b');

// Aritmetica de horario: precisa valer em qualquer fuso da maquina que roda
t('soma dentro da hora', somarMinutos('2026-08-20T14:30', 30) === '2026-08-20T15:00:00');
t('soma virando a hora', somarMinutos('2026-08-20T14:45', 30) === '2026-08-20T15:15:00');
t('soma virando o dia', somarMinutos('2026-08-20T23:30', 60) === '2026-08-21T00:30:00');
t('soma virando o mes', somarMinutos('2026-08-31T23:30', 60) === '2026-09-01T00:30:00');
t('soma virando o ano', somarMinutos('2026-12-31T23:30', 60) === '2027-01-01T00:30:00');
t('respeita ano bissexto', somarMinutos('2028-02-28T23:30', 60) === '2028-02-29T00:30:00');
t('ano comum pula para marco', somarMinutos('2026-02-28T23:30', 60) === '2026-03-01T00:30:00');
t('data invalida devolve null', somarMinutos('ontem', 30) === null);
t('data vazia devolve null', somarMinutos('', 30) === null);

t('inicio normaliza com segundos', inicioDoEvento('2026-08-20T14:30') === '2026-08-20T14:30:00');
t('inicio aceita espaco no lugar do T', inicioDoEvento('2026-08-20 14:30') === '2026-08-20T14:30:00');
t('inicio invalido devolve null', inicioDoEvento('20/08/2026') === null);

t('texto em portugues', textoDataHora('2026-08-20T14:30') === '20/08/2026 às 14:30');
t('texto de data invalida e vazio', textoDataHora('xx') === '');

// Evento
const leadAgenda = { nome: 'Pizzaria Bella', decisor: 'Marina', telefone: '65999', email: 'm@bella.com', nicho: 'Pizzaria', cidade: 'Cuiaba', estado: 'MT' };
const ev = montarEvento(leadAgenda, { dataHora: '2026-08-20T14:30', duracaoMin: 45, observacao: 'levar proposta' });
t('titulo tem o lead', ev.summary === 'Reunião — Pizzaria Bella');
t('inicio no formato do google', ev.start.dateTime === '2026-08-20T14:30:00');
t('fim respeita a duracao', ev.end.dateTime === '2026-08-20T15:15:00');
t('leva o fuso', ev.start.timeZone === 'America/Sao_Paulo');
t('descricao tem o contato', ev.description.includes('Marina') && ev.description.includes('65999'));
t('descricao tem a observacao', ev.description.includes('levar proposta'));
t('local junta cidade e estado', ev.location === 'Cuiaba / MT');

// Conta de servico nao consegue convidar sem delegacao no dominio: o Google
// recusaria o evento inteiro. Quem avisa o lead e o e-mail do CRM.
t('evento nao leva convidados', ev.attendees === undefined);

// Lembrete no Google e por pessoa: override feito pela conta de servico nao
// chega a quem abre a agenda. Usar o padrao de quem usa e o unico que funciona.
t('lembrete usa o padrao de quem usa', ev.reminders.useDefault === true);
t('nao finge definir lembrete', ev.reminders.overrides === undefined);

t('duracao padrao de 60', montarEvento(leadAgenda, { dataHora: '2026-08-20T09:00' }).end.dateTime === '2026-08-20T10:00:00');
t('sem data nao monta evento', montarEvento(leadAgenda, { dataHora: '' }) === null);
t('lead sem nome ainda monta', montarEvento({}, { dataHora: '2026-08-20T09:00' }).summary === 'Reunião — Lead');
t('sem cidade nao inventa local', montarEvento({ nome: 'X' }, { dataHora: '2026-08-20T09:00' }).location === undefined);

// E-mail de confirmacao
const conf = textoConfirmacao(leadAgenda, { dataHora: '2026-08-20T14:30', duracaoMin: 45 });
t('assunto tem a data', conf.assunto.includes('20/08/2026'));
t('trata pelo decisor', conf.corpo.startsWith('Olá, Marina!'));
t('corpo tem a duracao', conf.corpo.includes('45 minutos'));
t('sem decisor trata pelo nome', textoConfirmacao({ nome: 'Bella' }, { dataHora: '2026-08-20T14:30' }).corpo.startsWith('Olá, Bella!'));
t('sem nome nenhum nao fica quebrado', textoConfirmacao({}, { dataHora: '2026-08-20T14:30' }).corpo.startsWith('Olá!'));

t('404 fala da agenda', explicarErroAgenda({ message: 'respondeu 404: not found' }).includes('GOOGLE_CALENDAR_ID'));
t('403 fala de permissao', explicarErroAgenda({ message: 'respondeu 403: forbidden' }).includes('alterações nos eventos'));
t('403 de api desligada e especifico', explicarErroAgenda({ message: '403 accessNotConfigured' }).includes('não está ativada'));
t('erro estranho nao vira palpite', explicarErroAgenda({ message: 'algo diferente' }) === null);


// ── Escolha de modelo do Gemini ──
// Fixar um nome no codigo foi o que quebrou a analise: o Google aposentou o
// modelo e passou a responder 404 para chaves novas.
const M = (nome, metodos = ['generateContent']) => ({ name: 'models/' + nome, supportedGenerationMethods: metodos });

t('lista vazia nao escolhe nada', escolherModelo([]) === null);
t('tira o prefixo models/', escolherModelo([M('gemini-3-flash')]) === 'gemini-3-flash');

// So serve o que gera texto
t('ignora embedding', escolherModelo([M('text-embedding-004', ['embedContent']), M('gemini-3-flash')]) === 'gemini-3-flash');
t('ignora quem nao gera conteudo', escolherModelo([M('gemini-x', ['countTokens'])]) === null);
t('ignora modelo de imagem', escolherModelo([M('imagen-4-generate'), M('gemini-3-flash')]) === 'gemini-3-flash');
t('ignora modelo de voz', escolherModelo([M('gemini-3-flash-tts'), M('gemini-3-flash')]) === 'gemini-3-flash');

// Preferencias
t('flash ganha de pro', escolherModelo([M('gemini-3-pro'), M('gemini-3-flash')]) === 'gemini-3-flash');
t('flash cheio ganha do lite', escolherModelo([M('gemini-3-flash-lite'), M('gemini-3-flash')]) === 'gemini-3-flash');
t('versao maior ganha', escolherModelo([M('gemini-2.5-flash'), M('gemini-3-flash')]) === 'gemini-3-flash');
t('menor decimal perde', escolherModelo([M('gemini-2.0-flash'), M('gemini-2.5-flash')]) === 'gemini-2.5-flash');

// Experimental some sem aviso: so serve se nao houver outro
t('estavel ganha do preview', escolherModelo([M('gemini-4-flash-preview'), M('gemini-3-flash')]) === 'gemini-3-flash');
t('preview serve se for o unico', escolherModelo([M('gemini-4-flash-preview')]) === 'gemini-4-flash-preview');
t('pro serve se nao houver flash', escolherModelo([M('gemini-3-pro')]) === 'gemini-3-pro');


// ── Repetir quando o Gemini congestiona ──
// A cota gratuita responde 503 quando o modelo esta cheio, e passa em segundos.
t('503 vale repetir', ehTransitorio('Gemini respondeu 503: high demand'));
t('429 vale repetir', ehTransitorio('Gemini respondeu 429: rate limit'));
t('500 vale repetir', ehTransitorio('Gemini respondeu 500'));
t('UNAVAILABLE vale repetir', ehTransitorio('status UNAVAILABLE'));

// Configuracao errada nao melhora repetindo: so demora mais para dar o mesmo nao
t('401 nao repete', !ehTransitorio('Gemini respondeu 401: chave invalida'));
t('403 nao repete', !ehTransitorio('Gemini respondeu 403: forbidden'));
t('404 nao repete', !ehTransitorio('Gemini respondeu 404: modelo aposentado'));
t('400 nao repete', !ehTransitorio('Gemini respondeu 400: pedido invalido'));
t('erro sem codigo nao repete', !ehTransitorio('deu ruim'));

// Espera crescente, sem o aleatorio para o teste ser deterministico
t('primeira espera ~700ms', atrasoDaTentativa(1, 0) === 700);
t('segunda dobra', atrasoDaTentativa(2, 0) === 1400);
t('terceira dobra de novo', atrasoDaTentativa(3, 0) === 2800);
t('o aleatorio soma ate 400ms', atrasoDaTentativa(1, 1) === 1100);
t('tres tentativas somam menos de 5s', atrasoDaTentativa(1,1) + atrasoDaTentativa(2,1) < 5000);


// ── Redigir mensagem ──
t('tem intencoes cadastradas', INTENCOES.length >= 5);
t('toda intencao tem rotulo e instrucao', INTENCOES.every(i => i.id && i.rotulo && i.instrucao));
t('acha a intencao', acharIntencao('follow-up').rotulo === 'Retomar contato');
t('intencao desconhecida devolve null', acharIntencao('inventada') === null);

// Historico: entra resumido, senao vira um paredao no prompt
const atv = [
  { criadoEm: '2026-08-01T10:00:00Z', descricao: 'Status mudou para Reunião Marcada' },
  { criadoEm: '2026-08-05T10:00:00Z', descricao: 'Proposta enviada' },
];
const resumo = resumirHistorico(atv);
t('resumo traz data e descricao', resumo.includes('2026-08-01') && resumo.includes('Proposta enviada'));
t('resumo respeita o limite', resumirHistorico(new Array(30).fill(atv[0]), 5).split(String.fromCharCode(10)).length === 5);
t('sem atividade o resumo e vazio', resumirHistorico([]) === '');
t('linha sem descricao e descartada', resumirHistorico([{ criadoEm: '2026-08-01T10:00:00Z', descricao: '' }]) === '');

// Prompt
const leadMsg = { nome: 'Pizzaria Bella', decisor: 'Marina', nicho: 'Pizzaria', cidade: 'Sinop', estado: 'MT', oportunidades: 'sem trafego pago' };

const pWpp = montarPromptMensagem(leadMsg, { canal: 'whatsapp', intencao: 'primeiro-contato', meuNome: 'Gui' });
t('whatsapp nao pede assunto', !pWpp.includes('"assunto"'));
t('whatsapp limita a 4 linhas', pWpp.includes('4 linhas'));
t('prompt leva a analise ja feita', pWpp.includes('sem trafego pago'));
t('prompt manda assinar', pWpp.includes('Assine como Gui'));

const pMail = montarPromptMensagem(leadMsg, { canal: 'email', intencao: 'follow-up' });
t('email pede assunto', pMail.includes('"assunto"'));
t('email usa a instrucao da intencao', pMail.includes('não respondeu'));
t('sem nome nao inventa assinatura', pMail.includes('Não assine com nome de pessoa'));

// A trava que mais importa: nao inventar numero nem prometer resultado
t('proibe inventar preco', pWpp.includes('Não invente preço'));
t('proibe prometer resultado', pWpp.includes('Não prometa resultado'));

t('instrucao livre entra no prompt', montarPromptMensagem(leadMsg, { intencao: 'follow-up', instrucao: 'citar o feriado' }).includes('citar o feriado'));
t('sem historico o prompt avisa', pWpp.includes('Não há histórico registrado'));

// Interpretacao
const msgWpp = interpretarMensagem('{"corpo":"Oi Marina, tudo bem?"}', 'whatsapp');
t('le o corpo', msgWpp.corpo === 'Oi Marina, tudo bem?');
t('whatsapp ignora assunto', interpretarMensagem('{"corpo":"oi","assunto":"X"}', 'whatsapp').assunto === '');
t('email guarda o assunto', interpretarMensagem('{"corpo":"oi","assunto":"Sobre a Bella"}', 'email').assunto === 'Sobre a Bella');
t('le com cerca de codigo', interpretarMensagem(['```json','{"corpo":"oi"}','```'].join(String.fromCharCode(10))).corpo === 'oi');

// Caixa preenchida com vazio parece que funcionou, e o erro so aparece no envio
t('corpo vazio devolve null', interpretarMensagem('{"corpo":"   "}') === null);
t('sem corpo devolve null', interpretarMensagem('{"assunto":"X"}', 'email') === null);
t('json quebrado devolve null', interpretarMensagem('nao consegui') === null);


// ── Corpo do e-mail ──
// A versao anterior tinha faixa com gradiente e rodape "enviada pelo CRM":
// visual de disparo em massa num e-mail que e um-para-um.
const QL = String.fromCharCode(10);
const htmlEmail = montarHtml('Primeiro paragrafo.' + QL + QL + 'Segundo paragrafo.');
t('separa paragrafos', (htmlEmail.match(/<p /g) || []).length === 2);
t('quebra simples vira br', montarHtml('linha 1' + QL + 'linha 2').includes('<br>'));
t('nao tem faixa colorida', !/gradient|background:/i.test(htmlEmail));
t('nao se anuncia como CRM', !/CRM/i.test(htmlEmail));
t('corpo vazio nao gera paragrafo', (montarHtml('').match(/<p /g) || []) . length === 0);
t('linha em branco extra nao vira paragrafo vazio', (montarHtml('a' + QL + QL + QL + QL + 'b').match(/<p /g) || []).length === 2);

// O texto vem de campo livre: nao pode injetar marcacao na mensagem enviada
const perigoso = montarHtml('<script>alert(1)</script> e "aspas" & E-comercial');
t('escapa marcacao', !perigoso.includes('<script>'));
t('escapa aspas', perigoso.includes('&quot;'));
t('escapa e-comercial', perigoso.includes('&amp;'));


// ── Responder a ──
// Remetente no dominio proprio e resposta num Gmail gratuito e padrao de golpe,
// e o login do CRM e uma conta Google, entao o desencontro era o caso normal.
t('mesmo dominio mantem quem enviou', responderPara('vitor@grupoportel.com', 'contato@grupoportel.com') === 'vitor@grupoportel.com');
t('gmail nao vira responder-a', responderPara('timeportel@gmail.com', 'guilherme@grupoportel.com') === 'guilherme@grupoportel.com');
t('dominio diferente cai no remetente', responderPara('gui@outraempresa.com', 'contato@grupoportel.com') === 'contato@grupoportel.com');
t('ignora maiuscula no dominio', responderPara('Vitor@GrupoPortel.com', 'contato@grupoportel.com') === 'Vitor@GrupoPortel.com');
t('sem quem enviou usa o remetente', responderPara('', 'contato@grupoportel.com') === 'contato@grupoportel.com');
t('sem remetente nao inventa', responderPara('a@b.com', '') === 'a@b.com');

console.log(`\n${ok} passaram, ${fail} falharam`);
process.exit(fail > 0 ? 1 : 0);
