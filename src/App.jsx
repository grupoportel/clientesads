import { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import { auth, database } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTelaMedia } from './useTelaEstreita';
import { papelDoUsuario, podeEditar, podeAdministrar, motivoBloqueio } from './papeis';
import { ref, onValue, set, update, push } from 'firebase/database';
import Login from './Login';

// Componentes existentes (Leads)
import TableBoard from './components/TableBoard';
import KanbanBoard from './components/KanbanBoard';
import StatsBar from './components/StatsBar';
import LeadModal from './components/LeadModal';
import DetailPanel from './components/DetailPanel';
import FilterDrawers from './components/FilterDrawers';

// Nova Sidebar de Navegação
import Sidebar from './components/Sidebar';

// Páginas carregadas sob demanda: sem isso, abrir a tela de login baixava
// Métricas, Financeiro e Relatórios junto — telas que a maioria das sessões
// nunca chega a abrir. No 4G isso é espera real antes do primeiro campo.
const Dashboard      = lazy(() => import('./components/Dashboard'));
const ClientesPage   = lazy(() => import('./components/ClientesPage'));
const TarefasPage    = lazy(() => import('./components/TarefasPage'));
const AgendaPage     = lazy(() => import('./components/AgendaPage'));
const FinanceiroPage = lazy(() => import('./components/FinanceiroPage'));
const RelatoriosPage = lazy(() => import('./components/RelatoriosPage'));
const ConfigPage     = lazy(() => import('./components/ConfigPage'));
const ConversasPage  = lazy(() => import('./components/ConversasPage'));
const EmailPage      = lazy(() => import('./components/EmailPage'));
const MetricasPage   = lazy(() => import('./components/MetricasPage'));

import './index.css';

import { MAPA_STATUS_ANTIGOS, mesclarEtapas, acharEtapa, ehGanho, ehPerdido } from './pipeline';
import { registrarAtividade, registrarAtividadesEmLote, descreverEdicao } from './atividades';
import { paraLixeira, deLixeira, planoDeDesfazer } from './lixeira';
import BarraEmMassa from './components/BarraEmMassa';
import { gerarCSV, baixarCSV } from './csv';
const ImportarLeadsModal = lazy(() => import('./components/ImportarLeadsModal'));
const BuscaGlobal = lazy(() => import('./components/BuscaGlobal'));
const LixeiraModal = lazy(() => import('./components/LixeiraModal'));
const AgendarReuniaoModal = lazy(() => import('./components/AgendarReuniaoModal'));
import { rodarAutomacoes } from './automacoesRunner';

// No topo do módulo em vez de dentro do filtro: recriada a cada lead, ela
// impedia o compilador do React de preservar a memoização da lista.
const normaliza = (texto) => String(texto || '').trim().toLowerCase();

const CAMPOS_BUSCA = ['nome', 'nicho', 'telefone', 'whatsapp', 'email', 'responsavel', 'cidade', 'decisor'];

// Predicado puro, fora do componente: com ele o corpo do useMemo vira uma
// chamada simples e o compilador do React consegue preservar a memoização.
function leadPassaNosFiltros(lead, f) {
  if (f.status && normaliza(lead.status || 'nenhum') !== normaliza(f.status)) return false;
  if (f.nicho && normaliza(lead.nicho) !== normaliza(f.nicho)) return false;
  if (f.responsavel && normaliza(lead.responsavel) !== normaliza(f.responsavel)) return false;
  if (f.estado && normaliza(lead.estado) !== normaliza(f.estado)) return false;
  if (f.cidade && normaliza(lead.cidade) !== normaliza(f.cidade)) return false;

  // Data de entrada: aceita o campo preenchido à mão ou o carimbo de criação
  const entrada = (lead.data_entrada || lead.createdAt || '').slice(0, 10);
  if (f.dataInicio && (!entrada || entrada < f.dataInicio)) return false;
  if (f.dataFim && (!entrada || entrada > f.dataFim)) return false;

  if (f.busca) {
    const termo = normaliza(f.busca);
    return CAMPOS_BUSCA.some(campo => normaliza(lead[campo]).includes(termo));
  }
  return true;
}

function Carregando() {
  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--text3)', fontSize: 13,
    }}>
      Carregando…
    </div>
  );
}

const PAGINAS = [
  'dashboard', 'leads', 'clientes', 'tarefas', 'conversas',
  'emails', 'agenda', 'financeiro', 'metricas', 'relatorios', 'configuracoes',
];

const ROTULOS_CAMPOS = {
  nome: 'Nome', status: 'Status', valor: 'Valor', nicho: 'Nicho', estado: 'Estado',
  cidade: 'Cidade', origem: 'Origem', responsavel: 'Responsável', decisor: 'Decisor',
  cnpj: 'CNPJ', telefone: 'Telefone', whatsapp: 'WhatsApp', email: 'E-mail',
  instagram: 'Instagram', ig_dono: 'Instagram do dono', site: 'Site', nota: 'Nota',
  avaliacoes: 'Avaliações', data_entrada: 'Data de entrada', ultimo_contato: 'Último contato',
  reuniao: 'Reunião', melhores: 'Melhores conteúdos', oportunidades: 'Oportunidades',
  pontos: 'Pontos fortes', escalar: 'Potencial de escala', obs: 'Observação',
  motivoPerda: 'Motivo da perda',
};

function App() {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [leads, setLeads] = useState([]);
  const [tarefasGlobais, setTarefasGlobais] = useState([]);
  const [conversasGlobais, setConversasGlobais] = useState([]);
  const [emailsGlobais, setEmailsGlobais] = useState([]);
  const [clientesGlobais, setClientesGlobais] = useState([]);
  const [propostasGlobais, setPropostasGlobais] = useState([]);
  const [empresa, setEmpresa] = useState(null);
  const [configPipeline, setConfigPipeline] = useState(null);
  const [metas, setMetas] = useState({});
  const [modelos, setModelos] = useState([]);
  const [automacoes, setAutomacoes] = useState([]);
  const [usuariosCrm, setUsuariosCrm] = useState([]);
  const [lixeira, setLixeira] = useState([]);

  // Etapas do funil: padrão do código sobreposto pelo que estiver configurado
  const etapas = useMemo(() => mesclarEtapas(configPipeline), [configPipeline]);

  const [nichos, setNichos] = useState([]);
  const [responsaveis, setResponsaveis] = useState([]);
  const [estados, setEstados] = useState([]);
  const [cidades, setCidades] = useState([]);

  const [filtroStatus, setFiltroStatus] = useState(null);
  const [filtroNicho, setFiltroNicho] = useState(null);
  const [filtroResponsavel, setFiltroResponsavel] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState(null);
  const [filtroCidade, setFiltroCidade] = useState(null);
  
  const [busca, setBusca] = useState('');
  const [visaoAtual, setVisaoAtual] = useState('table'); 

  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');

  const [modalAberto, setModalAberto] = useState(false);
  const [modalImportar, setModalImportar] = useState(false);
  const [buscaGlobalAberta, setBuscaGlobalAberta] = useState(false);
  const [lixeiraAberta, setLixeiraAberta] = useState(false);
  const [leadParaAgendar, setLeadParaAgendar] = useState(null);
  const [menuAberto, setMenuAberto] = useState(false);
  const [leadEmEdicao, setLeadEmEdicao] = useState(null);
  const [selectedLeads, setSelectedLeads] = useState([]);

  // ---------------------------------------------------------
  // NAVEGAÇÃO — a URL é a fonte da verdade
  // ---------------------------------------------------------
  // Antes isso era um useState: F5 voltava ao Dashboard, o botão Voltar saía
  // do sistema e não dava para mandar a alguém o link de um lead.
  const local = useLocation();
  const navegar = useNavigate();

  const segmentos = local.pathname.split('/').filter(Boolean);
  const paginaAtiva = PAGINAS.includes(segmentos[0]) ? segmentos[0] : 'dashboard';
  const leadIdNaUrl = paginaAtiva === 'leads' ? (segmentos[1] || null) : null;

  const telaMedia = useTelaMedia();

  const setPaginaAtiva = (pagina) => {
    navegar(`/${pagina}`);
    setMenuAberto(false);
  };

  // ---------------------------------------------------------
  // SISTEMA DE NOTIFICAÇÕES (TOASTS E SINO)
  // ---------------------------------------------------------
  const [toasts, setToasts] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Espelha a cor configurada de cada etapa nas variáveis CSS, para que os
  // badges de status sigam o que foi escolhido em Configurações → Pipeline.
  useEffect(() => {
    const raiz = document.documentElement;
    etapas.forEach(e => raiz.style.setProperty(`--s-${e.id}`, e.cor));
  }, [etapas]);

  // Atalho global Ctrl+K / ⌘K — o placeholder da busca já prometia isso
  useEffect(() => {
    const aoTeclar = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setBuscaGlobalAberta(true);
      }
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, []);

  // ── Papel de quem está usando ──
  // Enquanto ninguém estiver cadastrado, quem entra é Admin: é o único jeito
  // de o primeiro cadastro acontecer, e as regras do banco concedem o mesmo.
  const { papel, primeiraConfiguracao } = useMemo(
    () => papelDoUsuario(usuario?.uid, usuariosCrm),
    [usuario, usuariosCrm]
  );
  const editavel = podeEditar(papel);
  const administravel = podeAdministrar(papel);

  // Barra qualquer ação de escrita para quem é somente leitura, com o motivo.
  // As regras do banco já recusariam, mas um erro cru do Firebase não explica
  // nada a quem está usando.
  const exigirEdicao = (acao = 'fazer isso') => {
    if (editavel) return true;
    showToast(motivoBloqueio(papel, acao), 'error');
    return false;
  };

  // Derivado, não guardado: a URL já diz qual lead está aberto
  const leadDetalhe = leadIdNaUrl ? (leads.find(l => l.id === leadIdNaUrl) || null) : null;
  const setLeadDetalhe = (lead) => navegar(lead ? `/leads/${lead.id}` : '/leads');

  // Contador em vez de Date.now(): dois toasts disparados no mesmo
  // milissegundo receberiam a mesma chave e o React trataria os dois como um.
  const proximoToast = useRef(0);

  /**
   * `acao` transforma o toast em um desfazer: { rotulo, aoClicar }.
   * Quando existe, o toast fica mais tempo na tela — 3 segundos não dão
   * para ler a mensagem e ainda decidir clicar.
   */
  const showToast = (msg, type = 'success', acao = null) => {
    const id = ++proximoToast.current;
    setToasts(prev => [...prev, { id, msg, type, acao }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, acao ? 9000 : 3000);
  };

  const fecharToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  useEffect(() => {
    // Guarda os cancelamentos de cada onValue para desligá-los no logout.
    // Sem isso, cada troca de sessão empilhava uma nova leva de listeners.
    let cancelarDados = [];

    const desligarDados = () => {
      cancelarDados.forEach(cancelar => cancelar());
      cancelarDados = [];
    };

    const escutar = (caminho, aoReceber) => {
      cancelarDados.push(onValue(ref(database, caminho), aoReceber));
    };

    const listaDe = (snap) => {
      const data = snap.val();
      return data ? Object.entries(data).map(([id, item]) => ({ ...item, id })) : [];
    };

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setUsuario(user);
      setCarregando(false);

      desligarDados();

      if (!user) {
        setLeads([]); setTarefasGlobais([]); setConversasGlobais([]); setEmailsGlobais([]);
        setClientesGlobais([]); setPropostasGlobais([]); setModelos([]); setAutomacoes([]); setUsuariosCrm([]);
        setLixeira([]);
        return;
      }

      escutar('crm_data/leads', (snap) => {
        setLeads(listaDe(snap).map(lead => ({
          ...lead,
          status: MAPA_STATUS_ANTIGOS[lead.status] || lead.status,
        })));
      });

      escutar('crm_data/nichos',       (snap) => setNichos(snap.val() ? Object.values(snap.val()) : []));
      escutar('crm_data/responsaveis', (snap) => setResponsaveis(snap.val() ? Object.values(snap.val()) : []));
      escutar('crm_data/estados',      (snap) => setEstados(snap.val() ? Object.values(snap.val()) : []));
      escutar('crm_data/cidades',      (snap) => setCidades(snap.val() ? Object.values(snap.val()) : []));

      escutar('crm_data/tarefas',   (snap) => setTarefasGlobais(listaDe(snap)));
      escutar('crm_data/clientes',  (snap) => setClientesGlobais(listaDe(snap)));
      escutar('crm_data/propostas', (snap) => setPropostasGlobais(listaDe(snap)));
      escutar('crm_data/conversas', (snap) => setConversasGlobais(listaDe(snap)));
      escutar('crm_data/emails',    (snap) => setEmailsGlobais(listaDe(snap)));
      escutar('crm_data/config/empresa',  (snap) => setEmpresa(snap.val() || null));
      escutar('crm_data/config/pipeline', (snap) => setConfigPipeline(snap.val() || null));
      escutar('crm_data/config/metas',    (snap) => setMetas(snap.val() || {}));
      escutar('crm_data/modelos',    (snap) => setModelos(listaDe(snap)));
      escutar('crm_data/automacoes', (snap) => setAutomacoes(listaDe(snap)));
      escutar('crm_data/usuarios',   (snap) => setUsuariosCrm(listaDe(snap)));
      escutar('crm_data/lixeira',    (snap) => setLixeira(listaDe(snap)));
    });

    return () => {
      desligarDados();
      unsubscribeAuth();
    };
  }, []);

  // Filtros agora se somam em vez de se anularem: "Clínicas E do João E em SP"
  // é justamente o recorte que faz alguém abrir o CRM.
  const filtrosAtivos = [
    filtroStatus && { rotulo: 'Status', valor: acharEtapa(etapas, filtroStatus).label, limpar: () => setFiltroStatus(null) },
    filtroNicho && { rotulo: 'Nicho', valor: filtroNicho, limpar: () => setFiltroNicho(null) },
    filtroResponsavel && { rotulo: 'Responsável', valor: filtroResponsavel, limpar: () => setFiltroResponsavel(null) },
    filtroEstado && { rotulo: 'Estado', valor: filtroEstado, limpar: () => setFiltroEstado(null) },
    filtroCidade && { rotulo: 'Cidade', valor: filtroCidade, limpar: () => setFiltroCidade(null) },
    filtroDataInicio && { rotulo: 'A partir de', valor: filtroDataInicio.split('-').reverse().join('/'), limpar: () => setFiltroDataInicio('') },
    filtroDataFim && { rotulo: 'Até', valor: filtroDataFim.split('-').reverse().join('/'), limpar: () => setFiltroDataFim('') },
  ].filter(Boolean);

  const limparFiltros = () => {
    setFiltroStatus(null); setFiltroNicho(null); setFiltroResponsavel(null);
    setFiltroEstado(null); setFiltroCidade(null);
    setFiltroDataInicio(''); setFiltroDataFim('');
  };

  // Exporta exatamente o que está visível na tela, com os filtros aplicados.
  //
  // A checagem de Array não é paranoia: ligada direto a um onClick, esta função
  // recebia o evento do clique como `lista`. O valor padrão não protege, porque
  // só vale para undefined — e um evento não é undefined. O resultado era um
  // erro dentro do gerarCSV e nenhum arquivo baixado.
  const exportarLeads = (entrada, nomeBase = 'leads') => {
    const lista = Array.isArray(entrada) ? entrada : leadsFiltrados;
    const colunas = [
      { titulo: 'Nome / Empresa', campo: 'nome' },
      { titulo: 'Status', valor: l => acharEtapa(etapas, l.status).label },
      { titulo: 'Valor', valor: l => (Number(l.valor) || 0).toFixed(2).replace('.', ',') },
      { titulo: 'Responsável', campo: 'responsavel' },
      { titulo: 'Nicho', campo: 'nicho' },
      { titulo: 'Origem', campo: 'origem' },
      { titulo: 'Estado', campo: 'estado' },
      { titulo: 'Cidade', campo: 'cidade' },
      { titulo: 'Telefone', campo: 'telefone' },
      { titulo: 'WhatsApp', campo: 'whatsapp' },
      { titulo: 'E-mail', campo: 'email' },
      { titulo: 'Decisor', campo: 'decisor' },
      { titulo: 'CNPJ', campo: 'cnpj' },
      { titulo: 'Instagram', campo: 'instagram' },
      { titulo: 'Site', campo: 'site' },
      { titulo: 'Nota', campo: 'nota' },
      { titulo: 'Avaliações', campo: 'avaliacoes' },
      { titulo: 'Data de entrada', valor: l => (l.data_entrada || (l.createdAt || '').slice(0, 10) || '').split('-').reverse().join('/') },
      { titulo: 'Último contato', valor: l => (l.ultimo_contato || '').split('-').reverse().join('/') },
      { titulo: 'Reunião', valor: l => (l.reuniao || '').split('-').reverse().join('/') },
      { titulo: 'Motivo da perda', campo: 'motivoPerda' },
      { titulo: 'Observação', campo: 'obs' },
    ];
    const data = new Date().toISOString().slice(0, 10);
    baixarCSV(`${nomeBase}-${data}`, gerarCSV(lista, colunas));
    showToast(`${lista.length} lead(s) exportado(s).`, 'success');
  };

  const filtros = useMemo(() => ({
    status: filtroStatus, nicho: filtroNicho, responsavel: filtroResponsavel,
    estado: filtroEstado, cidade: filtroCidade,
    dataInicio: filtroDataInicio, dataFim: filtroDataFim, busca,
  }), [filtroStatus, filtroNicho, filtroResponsavel, filtroEstado, filtroCidade, filtroDataInicio, filtroDataFim, busca]);

  // O compilador do React não consegue preservar esta memoização e por isso
  // desiste de otimizar o App inteiro. Como o compilador NÃO está ligado no
  // build (não há plugin dele no vite.config.js), o useMemo aqui faz trabalho
  // real: sem ele, filtrar 690 leads roda de novo a cada tecla digitada.
  // Quando o compilador for adotado, remover o useMemo e este comentário.
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const leadsFiltrados = useMemo(
    () => leads.filter(lead => leadPassaNosFiltros(lead, filtros)),
    [leads, filtros]
  );

  const fazerLogout = () => {
    if (!window.confirm('Deseja sair do CRM?')) return;
    signOut(auth).then(() => showToast('Você saiu com sucesso.', 'info'));
  };

  // Identidade real de quem está logado, em vez do nome fixo no código
  const nomeEmpresa = empresa?.nome || 'Grupo Portel';
  const emailUsuario = usuario?.email || '';
  const nomeUsuario = usuario?.displayName
    || (emailUsuario ? emailUsuario.split('@')[0] : 'Usuário');
  const iniciaisUsuario = nomeUsuario
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0])
    .join('')
    .toUpperCase() || '?';
  // ── Ações que o Dashboard dispara ──
  const abrirLeadNaLista = (lead) => {
    if (lead?.id) navegar(`/leads/${lead.id}`);
  };

  const filtrarPorEtapa = (statusId) => {
    setPaginaAtiva('leads');
    setFiltroStatus(statusId);
  };

  // Salvar tarefa vive aqui para que Tarefas e Agenda gravem do mesmo jeito,
  // com o mesmo registro na linha do tempo do lead.
  const salvarTarefa = (dados, tarefaExistente = null) => {
    if (!exigirEdicao('salvar tarefas')) return Promise.resolve();
    const agora = new Date().toISOString();

    if (!tarefaExistente) {
      const novaRef = push(ref(database, 'crm_data/tarefas'));
      return set(novaRef, { ...dados, id: novaRef.key, concluida: false, createdAt: agora, updatedAt: agora })
        .then(() => {
          registrarAtividade({
            leadId: dados.leadId, leadNome: dados.leadNome, tipo: 'tarefaCriada',
            descricao: `Tarefa criada: "${dados.titulo}"${dados.data ? ` para ${dados.data.split('-').reverse().join('/')}` : ''}`,
          });
          showToast('Tarefa criada!', 'success');
        })
        .catch(e => showToast('Erro ao criar a tarefa: ' + e.message, 'error'));
    }

    const { id, createdAt, ...campos } = dados;
    return update(ref(database, 'crm_data/tarefas/' + (id || tarefaExistente.id)), { ...campos, updatedAt: agora })
      .then(() => showToast('Tarefa atualizada!', 'success'))
      .catch(e => showToast('Erro ao salvar a tarefa: ' + e.message, 'error'));
  };

  const alternarTarefa = (tarefa) => {
    if (!exigirEdicao('concluir tarefas')) return;
    const concluindo = !tarefa.concluida;
    update(ref(database, 'crm_data/tarefas/' + tarefa.id), {
      concluida: concluindo,
      updatedAt: new Date().toISOString(),
    })
      .then(() => {
        if (concluindo) {
          registrarAtividade({
            leadId: tarefa.leadId, leadNome: tarefa.leadNome, tipo: 'tarefa',
            descricao: `Tarefa concluída: "${tarefa.titulo}"`,
          });
          showToast('Tarefa concluída!', 'success');
        }
      })
      .catch(e => showToast('Erro ao atualizar a tarefa: ' + e.message, 'error'));
  };

  // ── Edição em massa ──
  // Uma única gravação multi-caminho para todos os leads selecionados, em vez
  // de N chamadas — com 600 leads a diferença é entre instantâneo e travar.
  const [aplicandoEmMassa, setAplicandoEmMassa] = useState(false);

  const aplicarEmMassa = async (campo, novoValor) => {
    if (!exigirEdicao('editar em massa')) return;
    const alvos = leads.filter(l => selectedLeads.includes(l.id) && String(l[campo] ?? '') !== String(novoValor ?? ''));
    if (alvos.length === 0) {
      showToast('Os leads selecionados já estão com esse valor.', 'info');
      return;
    }

    setAplicandoEmMassa(true);
    const agora = new Date().toISOString();
    const rotulo = ROTULOS_CAMPOS[campo] || campo;
    const gravacoes = {};

    alvos.forEach(lead => {
      gravacoes[`${lead.id}/${campo}`] = novoValor === '' ? null : novoValor;
      gravacoes[`${lead.id}/updatedAt`] = agora;
      if (campo === 'status') {
        Object.entries(carimbosDeFecho(lead.status, novoValor, agora)).forEach(([chave, valor]) => {
          gravacoes[`${lead.id}/${chave}`] = valor;
        });
      }
    });

    try {
      await update(ref(database, 'crm_data/leads'), gravacoes);

      await registrarAtividadesEmLote(alvos.map(lead => ({
        leadId: lead.id,
        leadNome: lead.nome,
        tipo: campo === 'status' ? 'status' : 'editado',
        descricao: campo === 'status'
          ? descreverStatus(lead, lead.status, novoValor)
          : `${lead.nome}: ${rotulo} definido como "${novoValor || '—'}" (edição em massa)`,
      })));

      // Sobrescrever um campo em centenas de leads é tão destrutivo quanto
      // apagá-los — só que silencioso, porque os leads continuam na lista.
      // Os valores antigos já estão aqui na memória; guardá-los custa nada.
      const anteriores = {};
      alvos.forEach(lead => { anteriores[lead.id] = lead[campo]; });

      showToast(`${alvos.length} lead(s) atualizado(s).`, 'success', {
        rotulo: 'Desfazer',
        aoClicar: () => desfazerEmMassa(anteriores, campo, rotulo),
      });
    } catch (e) {
      showToast('Erro ao aplicar em massa: ' + e.message, 'error');
    } finally {
      setAplicandoEmMassa(false);
    }
  };

  const desfazerEmMassa = async (anteriores, campo, rotulo) => {
    if (!exigirEdicao('desfazer a edição')) return;
    const gravacoes = planoDeDesfazer(anteriores, campo);
    const agora = new Date().toISOString();
    Object.keys(anteriores).forEach(id => { gravacoes[`${id}/updatedAt`] = agora; });

    try {
      await update(ref(database, 'crm_data/leads'), gravacoes);
      showToast(`${rotulo} devolvido ao valor anterior em ${Object.keys(anteriores).length} lead(s).`, 'success');
    } catch (e) {
      showToast('Erro ao desfazer: ' + e.message, 'error');
    }
  };

  const exportarSelecionados = () => {
    const selecionados = leads.filter(l => selectedLeads.includes(l.id));
    exportarLeads(selecionados, 'leads-selecionados');
  };

  const abrirModalNovo = () => { setLeadEmEdicao(null); setModalAberto(true); };
  const abrirModalEdicao = (lead) => { setLeadEmEdicao(lead); setModalAberto(true); };

  // Excluir deixou de apagar: o lead sai de crm_data/leads e cai inteiro em
  // crm_data/lixeira. Uma gravação multi-caminho só, para que tirar de um lugar
  // e pôr no outro não possa acontecer pela metade.
  const moverParaLixeira = async (alvos, aviso) => {
    const quem = usuario?.displayName || usuario?.email || '';
    const agora = new Date().toISOString();
    const gravacoes = {};

    alvos.forEach(lead => {
      gravacoes[`lixeira/${lead.id}`] = paraLixeira(lead, quem, agora);
      gravacoes[`leads/${lead.id}`] = null;
    });

    await update(ref(database, 'crm_data'), gravacoes);

    await registrarAtividadesEmLote(alvos.map(lead => ({
      leadId: lead.id,
      leadNome: lead.nome,
      tipo: 'editado',
      descricao: `${lead.nome} foi movido para a lixeira`,
    })));

    showToast(aviso, 'success', {
      rotulo: 'Desfazer',
      aoClicar: () => restaurarDaLixeira(alvos.map(l => paraLixeira(l, quem, agora)), true),
    });
  };

  /**
   * Traz itens da lixeira de volta para leads.
   * `silencioso` evita encadear um toast de desfazer no próprio desfazer.
   */
  const restaurarDaLixeira = async (itens, silencioso = false) => {
    if (!exigirEdicao('restaurar leads')) return;

    const gravacoes = {};
    let ignorados = 0;

    itens.forEach(item => {
      const volta = deLixeira(item);
      if (!volta) { ignorados++; return; }
      gravacoes[`leads/${volta.id}`] = volta.dados;
      gravacoes[`lixeira/${volta.id}`] = null;
    });

    const restaurados = itens.length - ignorados;
    if (restaurados === 0) {
      showToast('Nenhum item pôde ser restaurado.', 'error');
      return;
    }

    try {
      await update(ref(database, 'crm_data'), gravacoes);
      showToast(
        silencioso
          ? 'Exclusão desfeita.'
          : `${restaurados} lead(s) restaurado(s).${ignorados ? ` ${ignorados} sem dados para restaurar.` : ''}`,
        'success'
      );
    } catch (e) {
      showToast('Erro ao restaurar: ' + e.message, 'error');
    }
  };

  /** Apaga de verdade, sem volta. Só Admin, e com aviso à altura. */
  const esvaziarLixeira = async (itens) => {
    if (!administravel) {
      showToast('Só um administrador pode apagar em definitivo.', 'error');
      return;
    }
    if (!window.confirm(
      `Apagar em definitivo ${itens.length} item(ns)?\n\n` +
      'Isto não vai para lugar nenhum: os dados somem do banco e não há como trazê-los de volta.'
    )) return;

    const gravacoes = {};
    itens.forEach(i => { gravacoes[`crm_data/lixeira/${i.id}`] = null; });
    try {
      await update(ref(database), gravacoes);
      showToast(`${itens.length} item(ns) apagado(s) em definitivo.`, 'success');
    } catch (e) {
      showToast('Erro ao esvaziar: ' + e.message, 'error');
    }
  };

  const deletarLead = async (id) => {
    if (!exigirEdicao('excluir leads')) return;
    const lead = leads.find(l => l.id === id);
    if (!lead) return;
    if (!window.confirm(`Mover "${lead.nome}" para a lixeira?`)) return;

    if (leadIdNaUrl === id) navegar('/leads');
    try {
      await moverParaLixeira([lead], 'Lead movido para a lixeira.');
    } catch (e) {
      showToast('Erro ao excluir: ' + e.message, 'error');
    }
  };

  const deletarLeadsSelecionados = async () => {
    if (!exigirEdicao('excluir leads')) return;
    const alvos = leads.filter(l => selectedLeads.includes(l.id));
    if (alvos.length === 0) return;

    if (!window.confirm(
      `Mover ${alvos.length} lead(s) para a lixeira?\n\n` +
      'Eles saem da lista mas continuam guardados, e dá para restaurar depois.'
    )) return;

    if (leadIdNaUrl && selectedLeads.includes(leadIdNaUrl)) navegar('/leads');
    try {
      // O toast só aparece depois da gravação: antes ele dizia "excluído" no
      // mesmo instante em que o banco podia estar recusando a escrita.
      await moverParaLixeira(alvos, `${alvos.length} lead(s) movido(s) para a lixeira.`);
      setSelectedLeads([]);
    } catch (e) {
      showToast('Erro ao excluir: ' + e.message, 'error');
    }
  };

  // Dispara as automações e avisa o usuário do que a regra fez sozinha.
  // Nunca deixa uma falha aqui derrubar a ação principal: se a automação
  // quebrar, a mudança de status que o usuário pediu já foi gravada.
  const dispararAutomacoes = (tipo, lead, statusAnterior) => {
    if (!automacoes.length) return;

    rodarAutomacoes({
      regras: automacoes,
      evento: { tipo, lead, statusAnterior },
      empresa: empresa?.nome || 'Grupo Portel',
      meuNome: nomeUsuario,
      etapas,
    })
      .then(resumo => {
        if (!resumo || resumo.regras.length === 0) return;

        (resumo.atividades || []).forEach(registrarAtividade);

        const partes = [];
        if (resumo.tarefasCriadas > 0) partes.push(`${resumo.tarefasCriadas} tarefa(s) criada(s)`);
        if (resumo.camposPreenchidos > 0) partes.push(`${resumo.camposPreenchidos} campo(s) preenchido(s)`);
        showToast(`⚡ ${resumo.regras.join(', ')}: ${partes.join(' e ') || 'executada'}`, 'info');
      })
      .catch(e => console.warn('[automacoes]', e?.message));
  };

  // Descreve uma troca de status em português, para a linha do tempo
  const descreverStatus = (lead, de, para) =>
    `${lead.nome}: ${acharEtapa(etapas, de).label} → ${acharEtapa(etapas, para).label}`;

  // Carimba a data em que o negócio foi ganho ou perdido. Sem isso, "receita
  // fechada neste mês" só podia ser estimada pelo updatedAt, que muda a cada
  // edição boba de telefone.
  const carimbosDeFecho = (statusAntigo, statusNovo, agora) => {
    if (statusAntigo === statusNovo) return {};
    const eraGanho = ehGanho(etapas, statusAntigo);
    const viraGanho = ehGanho(etapas, statusNovo);
    const viraPerda = ehPerdido(etapas, statusNovo);

    if (viraGanho && !eraGanho) return { fechadoEm: agora };
    if (viraPerda) return { perdidoEm: agora };
    // Voltou para uma etapa em aberto: limpa os carimbos anteriores
    if (!viraGanho && !viraPerda) return { fechadoEm: null, perdidoEm: null };
    return {};
  };

  const salvarLead = (dados) => {
    if (!exigirEdicao('salvar leads')) return;
    if (!dados.nome) return showToast("O nome é obrigatório!", 'error');
    const agora = new Date().toISOString();

    if (!leadEmEdicao) {
      const novaRef = push(ref(database, 'crm_data/leads'));
      set(novaRef, { ...dados, id: novaRef.key, createdAt: agora, updatedAt: agora })
        .then(() => {
          registrarAtividade({
            leadId: novaRef.key, leadNome: dados.nome, tipo: 'criado',
            descricao: `Lead "${dados.nome}" cadastrado`,
          });
          dispararAutomacoes('leadCriado', { ...dados, id: novaRef.key });
          setModalAberto(false);
          showToast('Novo lead adicionado!', 'success');
        })
        .catch(e => showToast('Erro ao salvar: ' + e.message, 'error'));
    } else {
      // update() grava só o que veio do formulário: não apaga campos que outro
      // usuário tenha alterado enquanto este modal estava aberto.
      const { id, createdAt, ...camposEditaveis } = dados;
      const leadId = id || leadEmEdicao.id;
      const mudancas = descreverEdicao(leadEmEdicao, camposEditaveis, ROTULOS_CAMPOS);

      update(ref(database, 'crm_data/leads/' + leadId), {
        ...camposEditaveis, updatedAt: agora,
        ...carimbosDeFecho(leadEmEdicao.status, camposEditaveis.status, agora),
      })
        .then(() => {
          const trocaStatus = mudancas.find(m => m.campo === 'status');
          if (trocaStatus) {
            registrarAtividade({
              leadId, leadNome: dados.nome, tipo: 'status',
              descricao: descreverStatus(dados, trocaStatus.de, trocaStatus.para),
            });
          }
          if (trocaStatus) {
            dispararAutomacoes('statusMudou', { ...leadEmEdicao, ...camposEditaveis, id: leadId }, trocaStatus.de);
          }
          const outras = mudancas.filter(m => m.campo !== 'status');
          if (outras.length > 0) {
            registrarAtividade({
              leadId, leadNome: dados.nome, tipo: 'editado',
              descricao: `${dados.nome}: ${outras.map(m => m.rotulo).join(', ')} ${outras.length > 1 ? 'atualizados' : 'atualizado'}`,
              detalhe: outras.slice(0, 8),
            });
          }
          setModalAberto(false);
          showToast('Lead atualizado!', 'success');
        })
        .catch(e => showToast('Erro ao salvar: ' + e.message, 'error'));
    }
  };

  const atualizarLeadInline = (leadId, campo, novoValor) => {
    if (!exigirEdicao('editar leads')) return;
    const agora = new Date().toISOString();
    const rotulo = ROTULOS_CAMPOS[campo] || campo;

    const gravarUm = (lead) => {
      if (!lead || String(lead[campo] ?? '') === String(novoValor ?? '')) return Promise.resolve();
      const extras = campo === 'status' ? carimbosDeFecho(lead.status, novoValor, agora) : {};
      return update(ref(database, 'crm_data/leads/' + lead.id), { [campo]: novoValor, updatedAt: agora, ...extras })
        .then(() => {
          registrarAtividade({
            leadId: lead.id, leadNome: lead.nome,
            tipo: campo === 'status' ? 'status' : 'editado',
            descricao: campo === 'status'
              ? descreverStatus(lead, lead.status, novoValor)
              : `${lead.nome}: ${rotulo} alterado para "${novoValor || '—'}"`,
          });

          const atualizado = { ...lead, [campo]: novoValor };
          if (campo === 'status') dispararAutomacoes('statusMudou', atualizado, lead.status);
          if (campo === 'valor' && Number(novoValor) > 0) dispararAutomacoes('valorDefinido', atualizado);
        });
    };

    if (selectedLeads.length > 1 && selectedLeads.includes(leadId)) {
      if (window.confirm(`Aplicar essa alteração a TODOS os ${selectedLeads.length} leads selecionados?`)) {
        Promise.all(selectedLeads.map(id => gravarUm(leads.find(x => String(x.id) === String(id)))))
          .then(() => showToast(`${selectedLeads.length} leads atualizados!`, 'success'))
          .catch(e => showToast('Erro ao atualizar: ' + e.message, 'error'));
      }
    } else {
      gravarUm(leads.find(l => String(l.id) === String(leadId)))
        .then(() => showToast('Atualizado com sucesso!', 'success'))
        .catch(e => showToast('Erro ao atualizar: ' + e.message, 'error'));
    }
  };

  const atualizarStatusDragAndDrop = (leadId, novoStatus) => {
    if (!exigirEdicao('mover leads')) return;
    const lead = leads.find(l => String(l.id) === String(leadId));
    if (lead && lead.status !== novoStatus) {
      const agora = new Date().toISOString();
      update(ref(database, 'crm_data/leads/' + lead.id), {
        status: novoStatus, updatedAt: agora,
        ...carimbosDeFecho(lead.status, novoStatus, agora),
      })
        .then(() => {
          registrarAtividade({
            leadId: lead.id, leadNome: lead.nome, tipo: 'status',
            descricao: descreverStatus(lead, lead.status, novoStatus),
          });
          dispararAutomacoes('statusMudou', { ...lead, status: novoStatus }, lead.status);
          showToast('Card movido com sucesso!', 'success');
        })
        .catch(e => showToast('Erro ao mover: ' + e.message, 'error'));
    }
  };

  // ---------------------------------------------------------
  // CÁLCULO DE NOTIFICAÇÕES
  // ---------------------------------------------------------
  const hojeApp = new Date().toISOString().slice(0, 10);
  const tarefasPendentesDia = tarefasGlobais.filter(t => t.data === hojeApp && !t.concluida);
  const conversasNaoLidas = conversasGlobais.filter(c => c.naoLidas > 0 && !c.arquivada).length;
  const emailsNaoLidos = emailsGlobais.filter(e => e.naoLidas > 0).length;

  // ---------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------
  const renderPagina = () => {
    switch (paginaAtiva) {
      case 'dashboard':
        return <Dashboard
          leads={leads}
          etapas={etapas}
          tarefas={tarefasGlobais}
          propostas={propostasGlobais}
          metas={metas}
          responsaveis={responsaveis}
          onNavegar={setPaginaAtiva}
          onAbrirLead={abrirLeadNaLista}
          onFiltrarEtapa={filtrarPorEtapa}
          onToggleTarefa={alternarTarefa}
        />;

      case 'leads':
        return (
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            <div className="content">
              {/* Sub-header do módulo de Leads */}
              <div style={{ 
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                    👥 Leads
                    <span style={{ 
                      fontSize: '12px', fontWeight: 600, background: 'var(--surface3)', 
                      color: 'var(--text2)', padding: '2px 10px', borderRadius: '20px',
                      fontFamily: "'DM Mono', monospace", marginLeft: '10px'
                    }}>
                      {leadsFiltrados.length}
                    </span>
                  </h2>
                  <div className="search-wrap">
                    <span className="search-icon">🔍</span>
                    <input type="text" placeholder="Buscar leads…" value={busca} onChange={(e) => setBusca(e.target.value)} />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div className="view-toggle">
                    <button className={`view-btn ${visaoAtual === 'table' ? 'active' : ''}`} onClick={() => setVisaoAtual('table')}>☰ Tabela</button>
                    <button className={`view-btn ${visaoAtual === 'kanban' ? 'active' : ''}`} onClick={() => setVisaoAtual('kanban')}>⊞ Kanban</button>
                  </div>
                  {editavel && <button className="btn btn-primary" onClick={abrirModalNovo}>+ Novo Lead</button>}
                </div>
              </div>

              {editavel && selectedLeads.length > 0 && (
                <BarraEmMassa
                  quantidade={selectedLeads.length}
                  etapas={etapas}
                  responsaveis={responsaveis}
                  nichos={nichos}
                  estados={estados}
                  cidades={cidades}
                  aplicando={aplicandoEmMassa}
                  onAplicar={aplicarEmMassa}
                  onExportar={exportarSelecionados}
                  onExcluir={deletarLeadsSelecionados}
                  onLimparSelecao={() => setSelectedLeads([])}
                />
              )}

              <StatsBar leads={leadsFiltrados} etapas={etapas} />
              
              <FilterDrawers 
                leads={leads}
                nichos={nichos} responsaveis={responsaveis} estados={estados} cidades={cidades}
                filtroNicho={filtroNicho} setFiltroNicho={setFiltroNicho}
                filtroResponsavel={filtroResponsavel} setFiltroResponsavel={setFiltroResponsavel}
                filtroEstado={filtroEstado} setFiltroEstado={setFiltroEstado}
                filtroCidade={filtroCidade} setFiltroCidade={setFiltroCidade}
              />

              {/* Barra de filtros ativos + período + exportação */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                padding: '10px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0,
              }}>
                <span style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                  Entrada
                </span>
                <input
                  type="date"
                  className="form-control"
                  style={{ width: 'auto', fontSize: 12, padding: '4px 8px' }}
                  value={filtroDataInicio}
                  onChange={e => setFiltroDataInicio(e.target.value)}
                  title="Leads que entraram a partir desta data"
                />
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>até</span>
                <input
                  type="date"
                  className="form-control"
                  style={{ width: 'auto', fontSize: 12, padding: '4px 8px' }}
                  value={filtroDataFim}
                  onChange={e => setFiltroDataFim(e.target.value)}
                  title="Leads que entraram até esta data"
                />

                {filtrosAtivos.map((f, i) => (
                  <span key={i} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: 'rgba(0,208,223,0.1)', border: '1px solid rgba(0,208,223,0.3)',
                    color: 'var(--accent)', borderRadius: 20, padding: '3px 10px', fontSize: 12,
                  }}>
                    <span style={{ opacity: 0.7 }}>{f.rotulo}:</span> {f.valor}
                    <span onClick={f.limpar} style={{ cursor: 'pointer', opacity: 0.7, fontSize: 11 }} title="Remover filtro">✕</span>
                  </span>
                ))}

                {filtrosAtivos.length > 0 && (
                  <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={limparFiltros}>
                    Limpar tudo
                  </button>
                )}

                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                  {/* Só aparece quando há algo lá dentro: um botão de lixeira
                      sempre visível e sempre vazio vira ruído no cabeçalho. */}
                  {editavel && lixeira.length > 0 && (
                    <button
                      className="btn btn-ghost" style={{ fontSize: 12, padding: '5px 12px' }}
                      onClick={() => setLixeiraAberta(true)}
                      title="Leads excluídos, com opção de restaurar"
                    >
                      🗑 Lixeira ({lixeira.length})
                    </button>
                  )}
                  {editavel && (
                    <button className="btn btn-ghost" style={{ fontSize: 12, padding: '5px 12px' }} onClick={() => setModalImportar(true)}>
                      📥 Importar
                    </button>
                  )}
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: 12, padding: '5px 12px' }}
                    onClick={() => exportarLeads()}
                    disabled={leadsFiltrados.length === 0}
                    title={`Exportar ${leadsFiltrados.length} lead(s) desta visão`}
                  >
                    📤 Exportar ({leadsFiltrados.length})
                  </button>
                </div>
              </div>

              {visaoAtual === 'table' ? (
                <TableBoard 
                  leads={leadsFiltrados} 
                  onEdit={abrirModalEdicao} 
                  onDelete={deletarLead} 
                  onInlineEdit={atualizarLeadInline}
                  selectedLeads={selectedLeads}
                  setSelectedLeads={setSelectedLeads}
                  onOpenDetail={setLeadDetalhe}
                  nichos={nichos}
                  responsaveis={responsaveis}
                  estados={estados}
                  cidades={cidades}
                  etapas={etapas}
                />
              ) : (
                <KanbanBoard leads={leadsFiltrados} onEdit={abrirModalEdicao} onLeadDrop={atualizarStatusDragAndDrop} etapas={etapas} />
              )}
            </div>

            <DetailPanel
              lead={leadDetalhe}
              onClose={() => setLeadDetalhe(null)}
              onEdit={abrirModalEdicao}
              onDelete={deletarLead}
              onAgendar={editavel ? setLeadParaAgendar : null}
              etapas={etapas}
            />
          </div>
        );

      case 'clientes':
        return (
          <ClientesPage
            clientes={clientesGlobais}
            leads={leads}
            etapas={etapas}
            nichos={nichos}
            responsaveis={responsaveis}
            onAvisar={showToast}
          />
        );
      case 'tarefas':
        return (
          <TarefasPage
            leads={leads}
            tarefas={tarefasGlobais}
            responsaveis={responsaveis}
            onSalvarTarefa={salvarTarefa}
            onAlternarTarefa={alternarTarefa}
            onAbrirLead={abrirLeadNaLista}
          />
        );
      case 'conversas':
        return <ConversasPage leads={leads} etapas={etapas} conversas={conversasGlobais} modelos={modelos} empresa={nomeEmpresa} meuNome={nomeUsuario} />;
      case 'emails':
        return <EmailPage leads={leads} modelos={modelos} empresa={nomeEmpresa} meuNome={nomeUsuario} />;
      case 'agenda':
        return (
          <AgendaPage
            leads={leads}
            tarefas={tarefasGlobais}
            responsaveis={responsaveis}
            onSalvarTarefa={salvarTarefa}
            onAlternarTarefa={alternarTarefa}
            onAbrirLead={abrirLeadNaLista}
          />
        );
      case 'financeiro':
        return <FinanceiroPage leads={leads} propostas={propostasGlobais} metas={metas} />;
      case 'metricas':
        return <MetricasPage leads={leads} etapas={etapas} propostas={propostasGlobais} />;
      case 'relatorios':
        return <RelatoriosPage leads={leads} etapas={etapas} />;
      case 'configuracoes':
        if (!administravel) {
          return (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 12, color: 'var(--text3)', padding: 40, textAlign: 'center',
            }}>
              <span style={{ fontSize: 40 }}>🔒</span>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text2)' }}>Configurações</div>
              <div style={{ fontSize: 13, maxWidth: 380, lineHeight: 1.6 }}>
                {motivoBloqueio(papel, 'abrir as configurações')}
              </div>
            </div>
          );
        }
        return (
          <ConfigPage
            etapas={etapas} metas={metas} leads={leads}
            modelos={modelos} automacoes={automacoes}
            usuarios={usuariosCrm} uidAtual={usuario?.uid}
            primeiraConfiguracao={primeiraConfiguracao}
          />
        );
      default:
        return <Dashboard
          leads={leads}
          etapas={etapas}
          tarefas={tarefasGlobais}
          propostas={propostasGlobais}
          metas={metas}
          responsaveis={responsaveis}
          onNavegar={setPaginaAtiva}
          onAbrirLead={abrirLeadNaLista}
          onFiltrarEtapa={filtrarPorEtapa}
          onToggleTarefa={alternarTarefa}
        />;
    }
  };

  if (carregando) return <div style={{ color: 'white', display: 'flex', justifyContent: 'center', height: '100vh', alignItems: 'center' }}>Carregando...</div>;
  if (!usuario) return <Login />;

  return (
    <>
      <div className="bg-grid"></div>
      <div className="ambient-light-saas"></div>

      {/* ══════ TOPBAR REDESENHADA ══════ */}
      <div className="topbar">
        <div className="topbar-left">
          <button
            className="abrir-menu"
            onClick={() => setMenuAberto(true)}
            aria-label="Abrir menu"
            title="Menu"
          >
            ☰
          </button>
          <button
            className="search-wrap"
            onClick={() => setBuscaGlobalAberta(true)}
            title="Buscar em todo o CRM (Ctrl+K)"
            style={{
              marginLeft: 0, width: '320px', display: 'flex', alignItems: 'center',
              gap: '8px', cursor: 'pointer', textAlign: 'left',
              font: 'inherit', color: 'var(--text3)',
            }}
          >
            <span className="search-icon" style={{ position: 'static' }}>🔍</span>
            <span style={{ flex: 1, fontSize: '13px' }}>Buscar no CRM…</span>
            <kbd style={{
              fontSize: '10px', border: '1px solid var(--border)', borderRadius: '4px',
              padding: '1px 5px', fontFamily: "'DM Mono', monospace", color: 'var(--text3)',
            }}>Ctrl K</kbd>
          </button>
        </div>
        <div className="topbar-right">
          {/* Sino de notificações */}
          <div style={{ position: 'relative' }}>
            <button className="notification-bell" onClick={() => setShowNotifications(!showNotifications)}>
              🔔
              {tarefasPendentesDia.length > 0 && (
                <span className="notification-badge">{tarefasPendentesDia.length}</span>
              )}
            </button>

            {showNotifications && (
              <div style={{
                position: 'absolute', top: 40, right: 0, width: 300, background: 'var(--surface)',
                border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                zIndex: 1000, overflow: 'hidden', animation: 'popIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)'
              }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 14 }}>
                  Notificações
                </div>
                <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                  {tarefasPendentesDia.length === 0 ? (
                    <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
                      Nenhuma tarefa pendente hoje.
                    </div>
                  ) : tarefasPendentesDia.map(t => (
                    <div key={t.id} style={{
                      padding: '12px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer',
                      transition: 'background 0.15s'
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      onClick={() => { setPaginaAtiva('tarefas'); setShowNotifications(false); }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>{t.titulo}</div>
                      <div style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{t.leadNome}</span>
                        <span style={{ fontFamily: "'DM Mono', monospace", color: 'var(--accent2)' }}>{t.hora}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {tarefasPendentesDia.length > 0 && (
                  <div style={{
                    padding: '10px', textAlign: 'center', fontSize: 12, color: 'var(--accent)',
                    cursor: 'pointer', background: 'var(--surface2)', borderTop: '1px solid var(--border)'
                  }}
                    onClick={() => { setPaginaAtiva('tarefas'); setShowNotifications(false); }}
                  >
                    Ver todas as tarefas
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Menu do usuário */}
          <div className="user-menu-trigger" onClick={fazerLogout} title={`${nomeUsuario} · clique para sair`}>
            <div className="user-menu-avatar">{iniciaisUsuario}</div>
            <span className="user-menu-name">{nomeUsuario}</span>
            <span style={{ fontSize: '10px', color: 'var(--text3)', marginLeft: '2px' }}>▾</span>
          </div>
        </div>
      </div>

      {/* ══════ LAYOUT PRINCIPAL ══════ */}
      <div className="main">
        {telaMedia && menuAberto && (
          <div className="fundo-menu" onClick={() => setMenuAberto(false)} />
        )}

        <Sidebar
          aberta={menuAberto}
          onFechar={() => setMenuAberto(false)}
          paginaAtiva={paginaAtiva}
          setPaginaAtiva={setPaginaAtiva}
          leads={leads}
          tarefasPendentes={tarefasPendentesDia.length}
          conversasNaoLidas={conversasNaoLidas}
          emailsNaoLidos={emailsNaoLidos}
          nomeEmpresa={nomeEmpresa}
          nomeUsuario={nomeUsuario}
          emailUsuario={emailUsuario}
          iniciaisUsuario={iniciaisUsuario}
          onLogout={fazerLogout}
          papel={papel}
          mostrarConfiguracoes={administravel}
        />
        
        {/* Área de conteúdo principal */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Suspense fallback={<Carregando />}>
            {renderPagina()}
          </Suspense>
        </div>
      </div>

      {/* ══════ MODAL DE LEADS (Global) ══════ */}
      {modalAberto && (
        <LeadModal
          key={leadEmEdicao?.id || 'novo'}
          isOpen={modalAberto} 
          onClose={() => setModalAberto(false)} 
          onSave={salvarLead} 
          leadAtual={leadEmEdicao}
          nichos={nichos}
          responsaveis={responsaveis}
          estados={estados}
          cidades={cidades}
          etapas={etapas}
        />
      )}

      {/* ══════ IMPORTAÇÃO DE LEADS ══════ */}
      <Suspense fallback={null}>
      <AgendarReuniaoModal
        aberto={Boolean(leadParaAgendar)}
        aoFechar={() => setLeadParaAgendar(null)}
        lead={leadParaAgendar}
      />

      <LixeiraModal
        aberto={lixeiraAberta}
        aoFechar={() => setLixeiraAberta(false)}
        itens={lixeira}
        aoRestaurar={restaurarDaLixeira}
        aoApagar={esvaziarLixeira}
        podeApagar={administravel}
      />

      <ImportarLeadsModal
        isOpen={modalImportar}
        onClose={() => setModalImportar(false)}
        onConcluido={(qtd) => showToast(`${qtd} lead(s) importado(s)!`, 'success')}
        etapas={etapas}
        responsaveis={responsaveis}
      />
      </Suspense>

      {/* ══════ BUSCA GLOBAL (Ctrl+K) ══════ */}
      {buscaGlobalAberta && (
        <Suspense fallback={null}>
        <BuscaGlobal
          aberta={buscaGlobalAberta}
          onFechar={() => setBuscaGlobalAberta(false)}
          onNavegar={setPaginaAtiva}
          onAbrirLead={setLeadDetalhe}
          leads={leads}
          clientes={clientesGlobais}
          tarefas={tarefasGlobais}
          propostas={propostasGlobais}
          conversas={conversasGlobais}
          emails={emailsGlobais}
          etapas={etapas}
        />
        </Suspense>
      )}

      {/* ══════ TOASTS ══════ */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`} style={{ opacity: 1, transform: 'none', transition: 'all 0.3s' }}>
            <span style={{ flex: 1 }}>
              {t.type === 'success' ? '✅' : t.type === 'error' ? '❌' : 'ℹ️'} {t.msg}
            </span>
            {t.acao && (
              <button
                className="toast-acao"
                onClick={() => { t.acao.aoClicar(); fecharToast(t.id); }}
              >
                {t.acao.rotulo}
              </button>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

export default App;