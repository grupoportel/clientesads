import { useState, useEffect, useMemo } from 'react';
import { auth, database } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { ref, onValue, set, remove, push } from 'firebase/database';
import Login from './Login';
import TableBoard from './components/TableBoard';
import KanbanBoard from './components/KanbanBoard';
import Sidebar from './components/Sidebar';
import StatsBar from './components/StatsBar';
import LeadModal from './components/LeadModal';
import DetailPanel from './components/DetailPanel';
import FilterDrawers from './components/FilterDrawers';
import './index.css';

const MAPA_STATUS_ANTIGOS = {
  'preparacao': 'investigacao',
  'retornar': 'diagnostico',
  'segundo': 'resgate',
  'reuniao-pos': 'em-conversa',
  'quarto': 'em-conversa'
};

function App() {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [leads, setLeads] = useState([]);
  
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
  // SISTEMA DE NOTIFICAÇÕES (TOASTS)
  // ---------------------------------------------------------
  const [toasts, setToasts] = useState([]);

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

      if (filtroStatus && normaliza(lead.status || 'nenhuma') !== normaliza(filtroStatus)) return false;
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

  if (carregando) return <div style={{ color: 'white', display: 'flex', justifyContent: 'center', height: '100vh', alignItems: 'center' }}>Carregando...</div>;
  if (!usuario) return <Login />;

  return (
    <>
      <div className="bg-grid"></div>
      <div className="ambient-light-saas"></div>

      <div className="topbar">
        <div className="topbar-left">
          <button className="btn-icon">☰</button>
          <div className="logo"><span style={{color: "var(--accent)"}}>●</span><span>Grupo Portel</span></div>
          <div className="search-wrap" style={{ marginLeft: '10px' }}>
            <span className="search-icon">🔍</span>
            <input type="text" placeholder="Buscar leads…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
        </div>
        <div className="topbar-right">
          {selectedLeads.length > 0 && (
            <button className="btn btn-danger" onClick={deletarLeadsSelecionados} style={{ marginRight: 'auto' }}>
              🗑 Excluir ({selectedLeads.length})
            </button>
          )}
          <div className="view-toggle" style={{ marginRight: '8px' }}>
            <button className={`view-btn ${visaoAtual === 'table' ? 'active' : ''}`} onClick={() => setVisaoAtual('table')}>☰ Tabela</button>
            <button className={`view-btn ${visaoAtual === 'kanban' ? 'active' : ''}`} onClick={() => setVisaoAtual('kanban')}>⊞ Kanban</button>
          </div>
          <button className="btn btn-primary" onClick={abrirModalNovo}>+ Novo Lead</button>
          <button className="btn btn-danger" onClick={fazerLogout} style={{ marginLeft: '8px' }}>Sair</button>
        </div>
      </div>

      <div className="main">
        <Sidebar leads={leads} filtroStatus={filtroStatus} setFiltroStatus={aplicarFiltroStatus} />
        
        <div className="content">
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

      {/* RENDERIZAÇÃO DOS TOASTS */}
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