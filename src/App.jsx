import { useState, useEffect, useMemo } from 'react';
import { auth, database } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { ref, onValue, set, remove, push } from 'firebase/database';
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

import './index.css';

const MAPA_STATUS_ANTIGOS = {
  'preparacao': 'lead-qualificado',
  'retornar': 'ligacao-feita',
  'segundo': 'contato-decisor',
  'reuniao-pos': 'reuniao-marcada',
  'quarto': 'contato-decisor',
  'nenhuma': 'nenhum',
  'investigacao': 'lead-qualificado',
  'diagnostico': 'ligacao-feita',
  'resgate': 'contato-decisor',
  'em-conversa': 'contato-decisor',
  'reuniao-marc': 'reuniao-marcada',
  'contrato': 'contrato-realizado',
  'interesse': 'perda'
};

function App() {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [leads, setLeads] = useState([]);
  const [tarefasGlobais, setTarefasGlobais] = useState([]);
  const [conversasGlobais, setConversasGlobais] = useState([]);
  
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

  const showToast = (msg, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    // Remove o toast automaticamente após 3 segundos
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setUsuario(user);
      setCarregando(false);
      
      if (user) {
        onValue(ref(database, 'crm_data/leads'), (snap) => {
          const data = snap.val();
          if (data) {
            const leadsCorrigidos = Object.entries(data).map(([chaveFirebase, lead]) => {
              return { 
                ...lead, 
                id: chaveFirebase, 
                status: MAPA_STATUS_ANTIGOS[lead.status] || lead.status 
              };
            });
            setLeads(leadsCorrigidos);
          } else {
            setLeads([]);
          }
        });
        
        onValue(ref(database, 'crm_data/nichos'), (snap) => setNichos(snap.val() ? Object.values(snap.val()) : []));
        onValue(ref(database, 'crm_data/responsaveis'), (snap) => setResponsaveis(snap.val() ? Object.values(snap.val()) : []));
        onValue(ref(database, 'crm_data/estados'), (snap) => setEstados(snap.val() ? Object.values(snap.val()) : []));
        onValue(ref(database, 'crm_data/cidades'), (snap) => setCidades(snap.val() ? Object.values(snap.val()) : []));
        
        onValue(ref(database, 'crm_data/tarefas'), (snap) => {
          const data = snap.val();
          if (data) {
            setTarefasGlobais(Object.entries(data).map(([id, t]) => ({ ...t, id })));
          } else {
            setTarefasGlobais([]);
          }
        });
        
        onValue(ref(database, 'crm_data/conversas'), (snap) => {
          const data = snap.val();
          if (data) {
            setConversasGlobais(Object.entries(data).map(([id, c]) => ({ ...c, id })));
          } else {
            setConversasGlobais([]);
          }
        });
      }
    });
    return () => unsubscribeAuth();
  }, []);

  const aplicarFiltroStatus = (val) => {
    setFiltroStatus(val);
    if (val) { setFiltroNicho(null); setFiltroResponsavel(null); setFiltroEstado(null); setFiltroCidade(null); }
  };
  const aplicarFiltroNicho = (val) => {
    setFiltroNicho(val);
    if (val) { setFiltroStatus(null); setFiltroResponsavel(null); setFiltroEstado(null); setFiltroCidade(null); }
  };
  const aplicarFiltroResponsavel = (val) => {
    setFiltroResponsavel(val);
    if (val) { setFiltroStatus(null); setFiltroNicho(null); setFiltroEstado(null); setFiltroCidade(null); }
  };
  const aplicarFiltroEstado = (val) => {
    setFiltroEstado(val);
    if (val) { setFiltroStatus(null); setFiltroNicho(null); setFiltroResponsavel(null); setFiltroCidade(null); }
  };
  const aplicarFiltroCidade = (val) => {
    setFiltroCidade(val);
    if (val) { setFiltroStatus(null); setFiltroNicho(null); setFiltroResponsavel(null); setFiltroEstado(null); }
  };

  const leadsFiltrados = useMemo(() => {
    return leads.filter(lead => {
      const normaliza = (texto) => String(texto || '').trim().toLowerCase();

      if (filtroStatus && normaliza(lead.status || 'nenhum') !== normaliza(filtroStatus)) return false;
      if (filtroNicho && normaliza(lead.nicho) !== normaliza(filtroNicho)) return false;
      if (filtroResponsavel && normaliza(lead.responsavel) !== normaliza(filtroResponsavel)) return false;
      if (filtroEstado && normaliza(lead.estado) !== normaliza(filtroEstado)) return false;
      if (filtroCidade && normaliza(lead.cidade) !== normaliza(filtroCidade)) return false;
      // ... dentro da função de filtro
      if (filtroDataInicio && lead.createdAt < filtroDataInicio) return false;
      if (filtroDataFim && lead.createdAt > filtroDataFim) return false;
      
      if (busca) {
        const termo = normaliza(busca);
        return [lead.nome, lead.nicho, lead.telefone, lead.responsavel].some(v => normaliza(v).includes(termo));
      }
      return true; 
    });
  }, [leads, filtroStatus, filtroNicho, filtroResponsavel, filtroEstado, filtroCidade, busca]);

  const fazerLogout = () => {
    signOut(auth).then(() => showToast('Você saiu com sucesso.', 'info'));
  };
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

  const salvarLead = (dados) => {
    if (!dados.nome) return showToast("O nome é obrigatório!", 'error');
    let leadSalvar = { ...dados, updatedAt: new Date().toISOString() };
    
    if (!leadEmEdicao) {
      leadSalvar.createdAt = new Date().toISOString();
      const novaRef = push(ref(database, 'crm_data/leads'));
      leadSalvar.id = novaRef.key;
      set(novaRef, leadSalvar).then(() => {
        setModalAberto(false);
        showToast('Novo lead adicionado!', 'success');
      });
    } else {
      set(ref(database, 'crm_data/leads/' + leadSalvar.id), leadSalvar).then(() => {
        setModalAberto(false);
        showToast('Lead atualizado!', 'success');
      });
    }
  };

  const atualizarLeadInline = (leadId, campo, novoValor) => {
    if (selectedLeads.length > 1 && selectedLeads.includes(leadId)) {
      if (window.confirm(`Aplicar essa alteração a TODOS os ${selectedLeads.length} leads selecionados?`)) {
        selectedLeads.forEach(id => {
          const l = leads.find(x => String(x.id) === String(id));
          if (l && l[campo] !== novoValor) set(ref(database, 'crm_data/leads/' + id), { ...l, [campo]: novoValor, updatedAt: new Date().toISOString() });
        });
        showToast(`${selectedLeads.length} leads atualizados!`, 'success');
      }
    } else {
      const lead = leads.find(l => String(l.id) === String(leadId));
      if (lead && lead[campo] !== novoValor) {
        set(ref(database, 'crm_data/leads/' + lead.id), { ...lead, [campo]: novoValor, updatedAt: new Date().toISOString() })
          .then(() => showToast('Atualizado com sucesso!', 'success'));
      }
    }
  };

  const atualizarStatusDragAndDrop = (leadId, novoStatus) => {
    const lead = leads.find(l => String(l.id) === String(leadId));
    if (lead && lead.status !== novoStatus) {
      set(ref(database, 'crm_data/leads/' + lead.id), { ...lead, status: novoStatus, updatedAt: new Date().toISOString() })
        .then(() => showToast('Card movido com sucesso!', 'success'));
    }
  };

  // ---------------------------------------------------------
  // CÁLCULO DE NOTIFICAÇÕES
  // ---------------------------------------------------------
  const hojeApp = new Date().toISOString().slice(0, 10);
  const tarefasPendentesDia = tarefasGlobais.filter(t => t.data === hojeApp && !t.concluida);
  const conversasNaoLidas = conversasGlobais.filter(c => c.naoLidas > 0 && !c.arquivada).length;

  // ---------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------
  const renderPagina = () => {
    switch (paginaAtiva) {
      case 'dashboard':
        return <Dashboard leads={leads} />;

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

              <StatsBar leads={leadsFiltrados} />
              
              <FilterDrawers 
                leads={leads}
                nichos={nichos} responsaveis={responsaveis} estados={estados} cidades={cidades}
                filtroNicho={filtroNicho} setFiltroNicho={aplicarFiltroNicho}
                filtroResponsavel={filtroResponsavel} setFiltroResponsavel={aplicarFiltroResponsavel}
                filtroEstado={filtroEstado} setFiltroEstado={aplicarFiltroEstado}
                filtroCidade={filtroCidade} setFiltroCidade={aplicarFiltroCidade}
              />

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
                />
              ) : (
                <KanbanBoard leads={leadsFiltrados} onEdit={abrirModalEdicao} onLeadDrop={atualizarStatusDragAndDrop} />
              )}
            </div>

            <DetailPanel lead={leadDetalhe} onClose={() => setLeadDetalhe(null)} onEdit={abrirModalEdicao} onDelete={deletarLead} />
          </div>
        );

      case 'clientes':
        return <ClientesPage nichos={nichos} responsaveis={responsaveis} />;
      case 'tarefas':
        return <TarefasPage leads={leads} responsaveis={responsaveis} />;
      case 'conversas':
        return <ConversasPage leads={leads} />;
      case 'agenda':
        return <AgendaPage leads={leads} />;
      case 'financeiro':
        return <FinanceiroPage leads={leads} />;
      case 'relatorios':
        return <RelatoriosPage leads={leads} />;
      case 'config':
        return <ConfigPage />;
      default:
        return <Dashboard />;
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
          <div className="search-wrap" style={{ marginLeft: '0px' }}>
            <span className="search-icon">🔍</span>
            <input 
              type="text" 
              placeholder="Buscar no CRM… (⌘K)" 
              value={busca} 
              onChange={(e) => setBusca(e.target.value)}
              style={{ width: '280px' }}
            />
          </div>
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
          <div className="user-menu-trigger" onClick={fazerLogout} title="Clique para sair">
            <div className="user-menu-avatar">GP</div>
            <span className="user-menu-name">Grupo Portel</span>
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