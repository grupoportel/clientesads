import { useState, useEffect, useMemo } from 'react';
import { auth, database } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { ref, onValue, set, update, remove, push } from 'firebase/database';
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

// Novos Módulos do CRM
import Dashboard from './components/Dashboard';
import ClientesPage from './components/ClientesPage';
import TarefasPage from './components/TarefasPage';
import AgendaPage from './components/AgendaPage';
import FinanceiroPage from './components/FinanceiroPage';
import RelatoriosPage from './components/RelatoriosPage';
import ConfigPage from './components/ConfigPage';
import ConversasPage from './components/ConversasPage';
import EmailPage from './components/EmailPage';
import MetricasPage from './components/MetricasPage';

import './index.css';

import { MAPA_STATUS_ANTIGOS, mesclarEtapas, acharEtapa } from './pipeline';
import { registrarAtividade, descreverEdicao } from './atividades';
import { gerarCSV, baixarCSV } from './csv';
import ImportarLeadsModal from './components/ImportarLeadsModal';
import BuscaGlobal from './components/BuscaGlobal';

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
  const [leadEmEdicao, setLeadEmEdicao] = useState(null);
  const [selectedLeads, setSelectedLeads] = useState([]);
  const [leadDetalhe, setLeadDetalhe] = useState(null);

  // ---------------------------------------------------------
  // SISTEMA DE NAVEGAÇÃO (PÁGINAS)
  // ---------------------------------------------------------
  const [paginaAtiva, setPaginaAtiva] = useState('dashboard');

  // ---------------------------------------------------------
  // SISTEMA DE NOTIFICAÇÕES (TOASTS E SINO)
  // ---------------------------------------------------------
  const [toasts, setToasts] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

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

  const showToast = (msg, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    // Remove o toast automaticamente após 3 segundos
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

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
        setClientesGlobais([]); setPropostasGlobais([]);
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

  // Exporta exatamente o que está visível na tela, com os filtros aplicados
  const exportarLeads = () => {
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
    baixarCSV(`leads-${data}`, gerarCSV(leadsFiltrados, colunas));
    showToast(`${leadsFiltrados.length} lead(s) exportado(s).`, 'success');
  };

  const leadsFiltrados = useMemo(() => {
    return leads.filter(lead => {
      const normaliza = (texto) => String(texto || '').trim().toLowerCase();

      if (filtroStatus && normaliza(lead.status || 'nenhum') !== normaliza(filtroStatus)) return false;
      if (filtroNicho && normaliza(lead.nicho) !== normaliza(filtroNicho)) return false;
      if (filtroResponsavel && normaliza(lead.responsavel) !== normaliza(filtroResponsavel)) return false;
      if (filtroEstado && normaliza(lead.estado) !== normaliza(filtroEstado)) return false;
      if (filtroCidade && normaliza(lead.cidade) !== normaliza(filtroCidade)) return false;

      // Data de entrada do lead: aceita tanto o campo preenchido à mão quanto
      // o carimbo automático de criação.
      const entrada = (lead.data_entrada || lead.createdAt || '').slice(0, 10);
      if (filtroDataInicio && (!entrada || entrada < filtroDataInicio)) return false;
      if (filtroDataFim && (!entrada || entrada > filtroDataFim)) return false;

      if (busca) {
        const termo = normaliza(busca);
        return [lead.nome, lead.nicho, lead.telefone, lead.whatsapp, lead.email, lead.responsavel, lead.cidade, lead.decisor]
          .some(v => normaliza(v).includes(termo));
      }
      return true;
    });
  }, [leads, filtroStatus, filtroNicho, filtroResponsavel, filtroEstado, filtroCidade, busca, filtroDataInicio, filtroDataFim]);

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
  const abrirModalNovo = () => { setLeadEmEdicao(null); setModalAberto(true); };
  const abrirModalEdicao = (lead) => { setLeadEmEdicao(lead); setModalAberto(true); };

  const deletarLead = (id) => {
    if (window.confirm("Tem certeza que deseja excluir este lead?")) {
      remove(ref(database, 'crm_data/leads/' + id))
        .then(() => showToast('Lead excluído.', 'success'))
        .catch(e => showToast("Erro: " + e.message, 'error'));
      if (leadDetalhe && leadDetalhe.id === id) setLeadDetalhe(null);
    }
  };

  const deletarLeadsSelecionados = () => {
    if (window.confirm(`Tem certeza que deseja excluir ${selectedLeads.length} lead(s)? Não há como desfazer.`)) {
      selectedLeads.forEach(id => remove(ref(database, 'crm_data/leads/' + id)));
      setSelectedLeads([]);
      setLeadDetalhe(null);
      showToast(`${selectedLeads.length} lead(s) excluído(s).`, 'success');
    }
  };

  // Descreve uma troca de status em português, para a linha do tempo
  const descreverStatus = (lead, de, para) =>
    `${lead.nome}: ${acharEtapa(etapas, de).label} → ${acharEtapa(etapas, para).label}`;

  const salvarLead = (dados) => {
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

      update(ref(database, 'crm_data/leads/' + leadId), { ...camposEditaveis, updatedAt: agora })
        .then(() => {
          const trocaStatus = mudancas.find(m => m.campo === 'status');
          if (trocaStatus) {
            registrarAtividade({
              leadId, leadNome: dados.nome, tipo: 'status',
              descricao: descreverStatus(dados, trocaStatus.de, trocaStatus.para),
            });
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
    const agora = new Date().toISOString();
    const rotulo = ROTULOS_CAMPOS[campo] || campo;

    const gravarUm = (lead) => {
      if (!lead || String(lead[campo] ?? '') === String(novoValor ?? '')) return Promise.resolve();
      return update(ref(database, 'crm_data/leads/' + lead.id), { [campo]: novoValor, updatedAt: agora })
        .then(() => {
          registrarAtividade({
            leadId: lead.id, leadNome: lead.nome,
            tipo: campo === 'status' ? 'status' : 'editado',
            descricao: campo === 'status'
              ? descreverStatus(lead, lead.status, novoValor)
              : `${lead.nome}: ${rotulo} alterado para "${novoValor || '—'}"`,
          });
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
    const lead = leads.find(l => String(l.id) === String(leadId));
    if (lead && lead.status !== novoStatus) {
      update(ref(database, 'crm_data/leads/' + lead.id), { status: novoStatus, updatedAt: new Date().toISOString() })
        .then(() => {
          registrarAtividade({
            leadId: lead.id, leadNome: lead.nome, tipo: 'status',
            descricao: descreverStatus(lead, lead.status, novoStatus),
          });
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
        return <Dashboard leads={leads} etapas={etapas} tarefas={tarefasGlobais} metas={metas} />;

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
                  {selectedLeads.length > 0 && (
                    <button className="btn btn-danger" onClick={deletarLeadsSelecionados}>
                      🗑 Excluir ({selectedLeads.length})
                    </button>
                  )}
                  <div className="view-toggle">
                    <button className={`view-btn ${visaoAtual === 'table' ? 'active' : ''}`} onClick={() => setVisaoAtual('table')}>☰ Tabela</button>
                    <button className={`view-btn ${visaoAtual === 'kanban' ? 'active' : ''}`} onClick={() => setVisaoAtual('kanban')}>⊞ Kanban</button>
                  </div>
                  <button className="btn btn-primary" onClick={abrirModalNovo}>+ Novo Lead</button>
                </div>
              </div>

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
                  <button className="btn btn-ghost" style={{ fontSize: 12, padding: '5px 12px' }} onClick={() => setModalImportar(true)}>
                    📥 Importar
                  </button>
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: 12, padding: '5px 12px' }}
                    onClick={exportarLeads}
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

            <DetailPanel lead={leadDetalhe} onClose={() => setLeadDetalhe(null)} onEdit={abrirModalEdicao} onDelete={deletarLead} etapas={etapas} />
          </div>
        );

      case 'clientes':
        return <ClientesPage nichos={nichos} responsaveis={responsaveis} />;
      case 'tarefas':
        return <TarefasPage leads={leads} responsaveis={responsaveis} />;
      case 'conversas':
        return <ConversasPage leads={leads} etapas={etapas} />;
      case 'emails':
        return <EmailPage />;
      case 'agenda':
        return <AgendaPage leads={leads} tarefas={tarefasGlobais} />;
      case 'financeiro':
        return <FinanceiroPage leads={leads} metas={metas} />;
      case 'metricas':
        return <MetricasPage leads={leads} etapas={etapas} />;
      case 'relatorios':
        return <RelatoriosPage leads={leads} etapas={etapas} />;
      case 'configuracoes':
        return <ConfigPage etapas={etapas} metas={metas} />;
      default:
        return <Dashboard leads={leads} etapas={etapas} tarefas={tarefasGlobais} metas={metas} />;
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
        <Sidebar
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
        />
        
        {/* Área de conteúdo principal */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {renderPagina()}
        </div>
      </div>

      {/* ══════ MODAL DE LEADS (Global) ══════ */}
      <LeadModal 
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

      {/* ══════ IMPORTAÇÃO DE LEADS ══════ */}
      <ImportarLeadsModal
        isOpen={modalImportar}
        onClose={() => setModalImportar(false)}
        onConcluido={(qtd) => showToast(`${qtd} lead(s) importado(s)!`, 'success')}
        etapas={etapas}
        responsaveis={responsaveis}
      />

      {/* ══════ BUSCA GLOBAL (Ctrl+K) ══════ */}
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

      {/* ══════ TOASTS ══════ */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`} style={{ opacity: 1, transform: 'none', transition: 'all 0.3s' }}>
            {t.type === 'success' ? '✅' : t.type === 'error' ? '❌' : 'ℹ️'} {t.msg}
          </div>
        ))}
      </div>
    </>
  );
}

export default App;