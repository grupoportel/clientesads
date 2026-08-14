import { useState, useEffect, useMemo } from 'react';
import { ref, onValue, set, update, remove, push } from 'firebase/database';
import { database } from '../firebase';
import PropostaModal from './PropostaModal';
import { registrarAtividade } from '../atividades';
import { formatarBRL } from '../pipeline';


const statusBadge = (status) => {
  const map = {
    rascunho: { bg: 'rgba(148,168,208,0.15)', color: 'var(--text3)', label: 'Rascunho' },
    enviada: { bg: 'rgba(250,204,21,0.15)', color: 'var(--yellow)', label: 'Enviada' },
    aceita: { bg: 'rgba(34,197,94,0.15)', color: 'var(--green)', label: 'Aceita' },
    rejeitada: { bg: 'rgba(239,68,68,0.15)', color: 'var(--red)', label: 'Rejeitada' },
  };
  return map[status] || map.rascunho;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
};

const KpiCard = ({ label, value, icon, color, sub, progress }) => (
  <div className="kpi-card-v2" style={{ position: 'relative', overflow: 'hidden' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
      <div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, color, fontFamily: "'DM Mono', monospace" }}>
          {value}
        </div>
      </div>
      <div style={{ fontSize: 28, opacity: 0.85 }}>{icon}</div>
    </div>
    <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10 }}>{sub}</div>
    <div style={{ height: 4, borderRadius: 4, background: 'var(--surface3)' }}>
      <div
        style={{
          height: 4,
          borderRadius: 4,
          background: color,
          width: `${Math.min(progress, 100)}%`,
          transition: 'width 0.6s ease',
        }}
      />
    </div>
  </div>
);

export default function FinanceiroPage({ leads = [], metas = {} }) {
  const [propostas, setPropostas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [propostaEmEdicao, setPropostaEmEdicao] = useState(null);
  const [activePeriod, setActivePeriod] = useState('Este Mês');

  const periods = ['Este Mês', 'Último Mês', 'Trimestre', 'Ano'];

  /* ── Firebase ── */
  useEffect(() => {
    const unsub = onValue(ref(database, 'crm_data/propostas'), (snap) => {
      const data = snap.val();
      setPropostas(
        data ? Object.entries(data).map(([id, p]) => ({ ...p, id })) : []
      );
      setCarregando(false);
    });
    return () => unsub();
  }, []);

  /* ── Period filter ── */
  const propostasFiltradas = useMemo(() => {
    const now = new Date();
    return propostas.filter((p) => {
      if (!p.data) return true;
      const d = new Date(p.data);
      if (activePeriod === 'Este Mês')
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      if (activePeriod === 'Último Mês') {
        const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear();
      }
      if (activePeriod === 'Trimestre')
        return d >= new Date(now.getTime() - 90 * 86400000);
      return true; // Ano
    });
  }, [propostas, activePeriod]);

  /* ── KPI ── */
  const kpiData = useMemo(() => {
    const aceitas = propostasFiltradas.filter((p) => p.status === 'aceita');
    const enviadas = propostasFiltradas.filter((p) => p.status === 'enviada');
    const rejeitadas = propostasFiltradas.filter((p) => p.status === 'rejeitada');
    const receita = aceitas.reduce((s, p) => s + (Number(p.valor) || 0), 0);
    const fechadas = aceitas.length + rejeitadas.length;
    const taxaFechamento = fechadas > 0 ? Math.round((aceitas.length / fechadas) * 100) : 0;
    const ticketMedio = aceitas.length > 0 ? Math.round(receita / aceitas.length) : 0;
    const metaMensal = Number(metas.receitaMensal) || 0;
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const now = new Date();
    const receitaMensalMap = {};
    
    // Iniciar os últimos 6 meses com valor 0
    for (let i = 5; i >= 0; i--) {
      let m = now.getMonth() - i;
      if (m < 0) m += 12;
      receitaMensalMap[meses[m]] = 0;
    }

    aceitas.forEach(p => {
      if (!p.data) return;
      const d = new Date(p.data);
      const m = meses[d.getMonth()];
      if (receitaMensalMap[m] !== undefined) {
        receitaMensalMap[m] += (Number(p.valor) || 0);
      }
    });

    const chartData = Object.entries(receitaMensalMap).map(([label, value]) => ({ label, value }));
    
    return {
      receita,
      enviadas: enviadas.length,
      taxaFechamento,
      ticketMedio,
      metaMensal,
      progressReceita: metaMensal > 0 ? Math.min(Math.round((receita / metaMensal) * 100), 100) : 0,
      progressTaxa: taxaFechamento,
      receitaAceita: receita,
      enviadasCount: enviadas.length,
      chartData
    };
  }, [propostasFiltradas, metas]);

  /* ── CRUD ── */
  const salvarProposta = (dados) => {
    const agora = new Date().toISOString();
    if (!propostaEmEdicao) {
      const novaRef = push(ref(database, 'crm_data/propostas'));
      set(novaRef, { ...dados, id: novaRef.key, createdAt: agora, updatedAt: agora });
      registrarAtividade({
        leadId: dados.leadId, leadNome: dados.leadNome, tipo: 'proposta',
        descricao: `Proposta de ${formatarBRL(dados.valor)} criada`,
      });
    } else {
      const { id, createdAt, ...camposEditaveis } = dados;
      update(ref(database, 'crm_data/propostas/' + (id || propostaEmEdicao.id)), {
        ...camposEditaveis,
        updatedAt: agora,
      });
    }
    setModalAberto(false);
    setPropostaEmEdicao(null);
  };

  const deletarProposta = (id) => {
    if (window.confirm('Excluir esta proposta?'))
      remove(ref(database, 'crm_data/propostas/' + id));
  };

  const atualizarStatus = (proposta, novoStatus) => {
    if (proposta.status === novoStatus) return;
    update(ref(database, 'crm_data/propostas/' + proposta.id), {
      status: novoStatus,
      updatedAt: new Date().toISOString(),
    });
    const rotulos = { rascunho: 'voltou para rascunho', enviada: 'enviada ao cliente', aceita: 'ACEITA', rejeitada: 'rejeitada' };
    registrarAtividade({
      leadId: proposta.leadId, leadNome: proposta.leadNome, tipo: 'proposta',
      descricao: `Proposta de ${formatarBRL(proposta.valor)} ${rotulos[novoStatus] || novoStatus}`,
    });
  };

  const abrirNova = () => {
    setPropostaEmEdicao(null);
    setModalAberto(true);
  };

  const abrirEdicao = (p) => {
    setPropostaEmEdicao(p);
    setModalAberto(true);
  };

  const propostasOrdenadas = [...propostasFiltradas].sort((a, b) =>
    (b.data || '').localeCompare(a.data || '')
  );

  const maxChart = Math.max(...kpiData.chartData.map((m) => m.value), 1000);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div className="page-title">💰 Financeiro</div>
          <div className="page-subtitle">Acompanhe propostas, receita e metas do seu CRM</div>
        </div>
        <div className="page-actions" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Period filter chips */}
          <div style={{ display: 'flex', gap: 6 }}>
            {periods.map((p) => (
              <button
                key={p}
                className={`filter-chip ${activePeriod === p ? 'active' : ''}`}
                onClick={() => setActivePeriod(p)}
              >
                {p}
              </button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={abrirNova}>
            + Nova Proposta
          </button>
        </div>
      </div>

      <div className="page-content" style={{ overflowY: 'auto' }}>
        {/* Row 1 — KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
          <KpiCard
            label="Receita"
            value={`R$ ${kpiData.receita.toLocaleString('pt-BR')}`}
            icon="💰"
            color="var(--green)"
            sub={kpiData.metaMensal > 0 ? `Meta: ${formatarBRL(kpiData.metaMensal)}` : "Defina a meta em Configurações"}
            progress={kpiData.progressReceita}
          />
          <KpiCard
            label="Propostas Enviadas"
            value={kpiData.enviadas}
            icon="📄"
            color="var(--accent)"
            sub={`${propostas.filter((p) => p.status === 'aceita').length} aceitas`}
            progress={Math.min((kpiData.enviadas / 20) * 100, 100)}
          />
          <KpiCard
            label="Taxa de Fechamento"
            value={`${kpiData.taxaFechamento}%`}
            icon="🎯"
            color="var(--yellow)"
            sub="aceitas / (aceitas+rejeitadas)"
            progress={kpiData.taxaFechamento}
          />
          <KpiCard
            label="Ticket Médio"
            value={`R$ ${kpiData.ticketMedio.toLocaleString('pt-BR')}`}
            icon="📊"
            color="var(--cyan)"
            sub="por proposta aceita"
            progress={Math.min((kpiData.ticketMedio / 3000) * 100, 100)}
          />
        </div>

        {/* Row 2 — Proposals table + Meta ring */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 20 }}>
          {/* LEFT: Proposals table */}
          <div className="crm-card">
            <div className="crm-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="crm-card-title">Propostas Recentes</div>
              <button className="btn btn-ghost" style={{ fontSize: 12, padding: '5px 12px' }} onClick={abrirNova}>
                + Nova
              </button>
            </div>

            {carregando ? (
              <div style={{ textAlign: 'center', color: 'var(--text3)', padding: 30 }}>
                Carregando...
              </div>
            ) : propostasOrdenadas.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text3)', padding: 40, fontSize: 14 }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
                Nenhuma proposta cadastrada
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="finance-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Valor</th>
                      <th>Status</th>
                      <th>Data</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {propostasOrdenadas.map((p) => {
                      const badge = statusBadge(p.status);
                      return (
                        <tr key={p.id}>
                          <td>
                            <span
                              style={{ fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}
                              onClick={() => abrirEdicao(p)}
                            >
                              {p.leadNome || '—'}
                            </span>
                          </td>
                          <td>
                            <span
                              style={{
                                color: 'var(--green)',
                                fontFamily: "'DM Mono', monospace",
                                fontWeight: 600,
                              }}
                            >
                              R$ {Number(p.valor || 0).toLocaleString('pt-BR')}
                            </span>
                          </td>
                          <td>
                            <span
                              className="finance-badge"
                              style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.color}33` }}
                            >
                              {badge.label}
                            </span>
                          </td>
                          <td style={{ color: 'var(--text3)', fontSize: 13 }}>
                            {formatDate(p.data)}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <select
                                className="form-control"
                                style={{ fontSize: 12, padding: '4px 8px', width: 'auto', minWidth: 110 }}
                                value={p.status}
                                onChange={(e) => atualizarStatus(p, e.target.value)}
                              >
                                <option value="rascunho">📝 Rascunho</option>
                                <option value="enviada">📤 Enviada</option>
                                <option value="aceita">✅ Aceita</option>
                                <option value="rejeitada">❌ Rejeitada</option>
                              </select>
                              <button
                                className="btn btn-danger btn-icon"
                                style={{ fontSize: 13, padding: '4px 8px' }}
                                onClick={() => deletarProposta(p.id)}
                                title="Excluir proposta"
                              >
                                🗑
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* RIGHT: Meta do Mês */}
          <div className="crm-card">
            <div className="crm-card-header">
              <div className="crm-card-title">🎯 Meta do Mês</div>
            </div>

            {/* Circular progress ring */}
            <div
              style={{
                width: 160,
                height: 160,
                borderRadius: '50%',
                background: `conic-gradient(var(--green) ${kpiData.progressReceita * 3.6}deg, var(--surface2) 0deg)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '20px auto',
                position: 'relative',
                boxShadow: `0 0 32px rgba(34,197,94,${(kpiData.progressReceita / 100) * 0.3})`,
              }}
            >
              <div
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: '50%',
                  background: 'var(--surface)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    fontSize: '24px',
                    fontWeight: 700,
                    fontFamily: "'DM Mono', monospace",
                    color: 'var(--text)',
                  }}
                >
                  {kpiData.progressReceita}%
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text3)' }}>da meta</div>
              </div>
            </div>

            {/* Breakdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 4px 8px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: 'var(--surface2)',
                }}
              >
                <span style={{ fontSize: 13, color: 'var(--text3)' }}>✅ Receita Aceita</span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--green)',
                    fontFamily: "'DM Mono', monospace",
                  }}
                >
                  R$ {kpiData.receitaAceita.toLocaleString('pt-BR')}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: 'var(--surface2)',
                }}
              >
                <span style={{ fontSize: 13, color: 'var(--text3)' }}>📤 Enviadas</span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--accent)',
                    fontFamily: "'DM Mono', monospace",
                  }}
                >
                  {kpiData.enviadasCount} propostas
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: 'var(--surface2)',
                }}
              >
                <span style={{ fontSize: 13, color: 'var(--text3)' }}>🏁 Meta</span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--text2)',
                    fontFamily: "'DM Mono', monospace",
                  }}
                >
                  {kpiData.metaMensal > 0 ? formatarBRL(kpiData.metaMensal) : '— não definida'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Row 3 — Bar chart */}
        <div className="crm-card">
          <div className="crm-card-header">
            <div className="crm-card-title">📈 Receita por Mês (Últimos 6 meses)</div>
          </div>
          <div className="bar-chart" style={{ paddingTop: 16 }}>
            {kpiData.chartData.map((m) => {
              const pct = Math.round((m.value / maxChart) * 100);
              return (
                <div key={m.label} className="bar-chart-col">
                  <div className="bar-chart-value">
                    R$ {(m.value / 1000).toFixed(0)}k
                  </div>
                  <div className="bar-chart-bar" style={{ height: 120 }}>
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        borderRadius: '4px 4px 0 0',
                        background: 'linear-gradient(to top, var(--accent), var(--accent2))',
                        height: `${pct}%`,
                        transition: 'height 0.6s ease',
                      }}
                    />
                  </div>
                  <div className="bar-chart-label">{m.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal */}
      <PropostaModal
        isOpen={modalAberto}
        onClose={() => {
          setModalAberto(false);
          setPropostaEmEdicao(null);
        }}
        onSave={salvarProposta}
        propostaAtual={propostaEmEdicao}
        leads={leads}
      />
    </div>
  );
}
