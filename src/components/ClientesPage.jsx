import { useState, useEffect, useMemo } from 'react';
import { ref, onValue, set, update, remove, push } from 'firebase/database';
import { database } from '../firebase';
import ClienteModal from './ClienteModal';

// ─── Helpers ────────────────────────────────────────────────────────────────

const getSaude = (ultimoContato) => {
  if (!ultimoContato) return { pct: 20, color: 'var(--red)' };
  const days = Math.floor((Date.now() - new Date(ultimoContato).getTime()) / 86400000);
  if (days <= 7)  return { pct: 95, color: 'var(--green)' };
  if (days <= 14) return { pct: 65, color: 'var(--yellow)' };
  if (days <= 30) return { pct: 35, color: 'var(--orange)' };
  return { pct: 15, color: 'var(--red)' };
};

const diasSemContato = (ultimoContato) => {
  if (!ultimoContato) return 'Nunca contactado';
  const days = Math.floor((Date.now() - new Date(ultimoContato).getTime()) / 86400000);
  if (days === 0) return 'Hoje';
  if (days === 1) return 'Ontem';
  return `há ${days} dias`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  if (!y || !m || !d) return dateStr;
  return `${d}/${m}/${y}`;
};

const statusBadgeStyle = (status) => {
  const map = {
    ativo:     { background: 'rgba(34,197,94,.15)',  color: 'var(--green)'  },
    pausado:   { background: 'rgba(250,204,21,.15)', color: 'var(--yellow)' },
    cancelado: { background: 'rgba(239,68,68,.15)',  color: 'var(--red)'    },
  };
  return map[status] || map.ativo;
};

const statusLabel = (status) => {
  const map = { ativo: 'Ativo', pausado: 'Pausado', cancelado: 'Cancelado' };
  return map[status] || status;
};

const avatarInitials = (name = '') =>
  name.trim().split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');

// ─── KPI Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, color = 'var(--green)', icon }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border2)',
      borderRadius: 'var(--radius)',
      padding: '16px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 10,
        background: `color-mix(in srgb, ${color} 15%, transparent)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ClientesPage({ nichos = [], responsaveis = [] }) {
  const [clientes, setClientes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [clienteEmEdicao, setClienteEmEdicao] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState('Todos');
  const [busca, setBusca] = useState('');

  // ── Firebase read ──────────────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = onValue(ref(database, 'crm_data/clientes'), (snap) => {
      const data = snap.val();
      if (data) {
        setClientes(Object.entries(data).map(([id, c]) => ({ ...c, id })));
      } else {
        setClientes([]);
      }
      setCarregando(false);
    });
    return () => unsubscribe();
  }, []);

  // ── Filtering ──────────────────────────────────────────────────────────────
  const clientesFiltrados = useMemo(() => {
    return clientes.filter(c => {
      const matchStatus =
        filtroStatus === 'Todos' ||
        (filtroStatus === 'Ativos'     && c.statusCliente === 'ativo')     ||
        (filtroStatus === 'Pausados'   && c.statusCliente === 'pausado')   ||
        (filtroStatus === 'Cancelados' && c.statusCliente === 'cancelado');
      const matchBusca = !busca ||
        [c.nome, c.nicho, c.responsavel].some(v =>
          (v || '').toLowerCase().includes(busca.toLowerCase())
        );
      return matchStatus && matchBusca;
    });
  }, [clientes, filtroStatus, busca]);

  // ── CRUD ───────────────────────────────────────────────────────────────────
  const salvarCliente = (dados) => {
    const agora = new Date().toISOString();
    if (!clienteEmEdicao) {
      const novaRef = push(ref(database, 'crm_data/clientes'));
      set(novaRef, { ...dados, id: novaRef.key, createdAt: agora, updatedAt: agora });
    } else {
      // Grava só os campos do formulário, preservando o que outro usuário mudou
      const { id, createdAt, ...camposEditaveis } = dados;
      update(ref(database, 'crm_data/clientes/' + (id || clienteEmEdicao.id)), { ...camposEditaveis, updatedAt: agora });
    }
    setModalAberto(false);
    setClienteEmEdicao(null);
  };

  const deletarCliente = (id) => {
    if (window.confirm('Excluir este cliente?')) {
      remove(ref(database, 'crm_data/clientes/' + id));
    }
  };

  const abrirNovoCliente = () => {
    setClienteEmEdicao(null);
    setModalAberto(true);
  };

  const abrirEdicao = (cliente) => {
    setClienteEmEdicao(cliente);
    setModalAberto(true);
  };

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const totalAtivos   = clientes.filter(c => c.statusCliente === 'ativo').length;
  const receitaTotal  = clientes.filter(c => c.statusCliente === 'ativo')
    .reduce((acc, c) => acc + (Number(c.valorMensal) || 0), 0);
  const saudMedia = clientes.length > 0
    ? Math.round(clientes.reduce((acc, c) => acc + getSaude(c.ultimoContato).pct, 0) / clientes.length)
    : 0;

  const saudColor = saudMedia > 70 ? 'var(--green)' : saudMedia > 40 ? 'var(--yellow)' : 'var(--red)';

  // ── Filter tab buttons ─────────────────────────────────────────────────────
  const filtros = ['Todos', 'Ativos', 'Pausados', 'Cancelados'];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="page-content">

      {/* ── Page Header ───────────────────────────────────────────────────── */}
      <div className="page-header" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            🏢 Clientes Ativos
            <span className="badge-pill" style={{
              background: 'rgba(0,208,223,.15)', color: 'var(--accent)',
              fontSize: 13, padding: '2px 10px',
            }}>
              {clientesFiltrados.length}
            </span>
          </h1>
          <p className="page-subtitle">Gerencie sua carteira de clientes</p>
        </div>

        <div className="page-actions" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Search */}
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="🔍 Buscar cliente..."
            style={{
              background: 'var(--surface2)',
              border: '1px solid var(--border2)',
              borderRadius: 8,
              padding: '8px 14px',
              color: 'var(--text)',
              fontSize: 14,
              width: 240,
              outline: 'none',
            }}
          />

          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: 4, background: 'var(--surface2)', borderRadius: 8, padding: 4 }}>
            {filtros.map(f => (
              <button
                key={f}
                className={filtroStatus === f ? 'btn btn-primary' : 'btn btn-ghost'}
                style={{ fontSize: 13, padding: '5px 12px' }}
                onClick={() => setFiltroStatus(f)}
              >
                {f}
              </button>
            ))}
          </div>

          {/* New client */}
          <button className="btn btn-primary" onClick={abrirNovoCliente}>
            + Novo Cliente
          </button>
        </div>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <StatCard
          icon="👥"
          label="Total de Clientes Ativos"
          value={totalAtivos}
          color="var(--green)"
        />
        <StatCard
          icon="💰"
          label="Receita Recorrente"
          value={`R$ ${receitaTotal.toLocaleString('pt-BR')}/mês`}
          color="var(--green)"
        />
        <StatCard
          icon="❤️"
          label="Saúde Média da Carteira"
          value={`${saudMedia}%`}
          color={saudColor}
        />
      </div>

      {/* ── Loading ────────────────────────────────────────────────────────── */}
      {carregando && (
        <div style={{ textAlign: 'center', color: 'var(--text2)', padding: 60, fontSize: 15 }}>
          Carregando clientes...
        </div>
      )}

      {/* ── Empty State ───────────────────────────────────────────────────── */}
      {!carregando && clientesFiltrados.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          background: 'var(--surface)', borderRadius: 'var(--radius)',
          border: '1px dashed var(--border2)',
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏢</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
            Nenhum cliente encontrado
          </div>
          <div style={{ color: 'var(--text2)', marginBottom: 20 }}>
            {clientes.length === 0
              ? 'Adicione seu primeiro cliente usando o botão acima'
              : 'Tente ajustar os filtros'}
          </div>
          {clientes.length === 0 && (
            <button className="btn btn-primary" onClick={abrirNovoCliente}>
              + Novo Cliente
            </button>
          )}
        </div>
      )}

      {/* ── Client Cards Grid ─────────────────────────────────────────────── */}
      {!carregando && clientesFiltrados.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: 16,
        }}>
          {clientesFiltrados.map(c => {
            const saude = getSaude(c.ultimoContato);
            const badgeStyle = statusBadgeStyle(c.statusCliente);
            const whatsappNum = c.whatsapp ? c.whatsapp.replace(/\D/g, '') : null;

            return (
              <div className="client-card" key={c.id}>

                {/* ── Header ── */}
                <div className="client-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
                    <span className="client-name">{c.nome || '—'}</span>
                    {c.nicho && (
                      <span className="badge-pill" style={{
                        background: 'rgba(0,208,223,.12)', color: 'var(--accent)',
                        fontSize: 11, padding: '2px 8px', whiteSpace: 'nowrap',
                      }}>
                        {c.nicho}
                      </span>
                    )}
                  </div>
                  <span className="badge-pill" style={{
                    ...badgeStyle,
                    fontSize: 11, padding: '3px 10px', whiteSpace: 'nowrap', flexShrink: 0,
                  }}>
                    {statusLabel(c.statusCliente)}
                  </span>
                </div>

                {/* ── Responsável ── */}
                <div className="client-card-row">
                  <span style={{ color: 'var(--text2)', fontSize: 13 }}>Responsável</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%',
                      background: 'var(--accent)', color: '#000',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 700, flexShrink: 0,
                    }}>
                      {avatarInitials(c.responsavel || '?')}
                    </div>
                    <span style={{ fontSize: 13 }}>{c.responsavel || '—'}</span>
                  </div>
                </div>

                {/* ── Plano ── */}
                <div className="client-card-row">
                  <span style={{ color: 'var(--text2)', fontSize: 13 }}>Plano</span>
                  <span style={{ fontSize: 13 }}>{c.plano || '—'}</span>
                </div>

                {/* ── Valor ── */}
                <div className="client-card-row">
                  <span style={{ color: 'var(--text2)', fontSize: 13 }}>Valor</span>
                  <span style={{ fontSize: 13, color: 'var(--green)', fontWeight: 600 }}>
                    R$ {Number(c.valorMensal || 0).toLocaleString('pt-BR')}/mês
                  </span>
                </div>

                {/* ── Desde ── */}
                <div className="client-card-row">
                  <span style={{ color: 'var(--text2)', fontSize: 13 }}>Desde</span>
                  <span style={{ fontSize: 13 }}>{formatDate(c.dataInicio)}</span>
                </div>

                {/* ── Health Bar ── */}
                <div style={{ margin: '10px 0 6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: 'var(--text2)' }}>Saúde</span>
                    <span style={{ fontSize: 12, color: saude.color, fontWeight: 600 }}>{saude.pct}%</span>
                  </div>
                  <div className="client-health-bar">
                    <div
                      className="client-health-fill"
                      style={{ width: `${saude.pct}%`, background: saude.color }}
                    />
                  </div>
                </div>

                {/* ── Last Contact ── */}
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
                  Último contato: {diasSemContato(c.ultimoContato)}
                </div>

                {/* ── Actions ── */}
                <div className="client-actions">
                  {whatsappNum && (
                    <a
                      href={`https://wa.me/55${whatsappNum}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-ghost"
                      style={{ fontSize: 12, padding: '5px 10px', textDecoration: 'none' }}
                    >
                      📱 WhatsApp
                    </a>
                  )}
                  {c.email && (
                    <a
                      href={`mailto:${c.email}`}
                      className="btn btn-ghost"
                      style={{ fontSize: 12, padding: '5px 10px', textDecoration: 'none' }}
                    >
                      ✉️ E-mail
                    </a>
                  )}
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: 12, padding: '5px 10px' }}
                    onClick={() => abrirEdicao(c)}
                  >
                    ✏️ Editar
                  </button>
                  <button
                    className="btn btn-danger"
                    style={{ fontSize: 12, padding: '5px 10px' }}
                    onClick={() => deletarCliente(c.id)}
                  >
                    🗑 Excluir
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal ─────────────────────────────────────────────────────────── */}
      <ClienteModal
        isOpen={modalAberto}
        onClose={() => { setModalAberto(false); setClienteEmEdicao(null); }}
        onSave={salvarCliente}
        clienteAtual={clienteEmEdicao}
        nichos={nichos}
        responsaveis={responsaveis}
      />

    </div>
  );
}
