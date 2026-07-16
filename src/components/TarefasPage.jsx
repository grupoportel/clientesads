import { useState, useEffect, useMemo } from 'react';
import { ref, onValue, set, remove, push } from 'firebase/database';
import { database } from '../firebase';
import TarefaModal from './TarefaModal';

export default function TarefasPage({ leads = [], responsaveis = [] }) {
  const [tarefas, setTarefas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [tarefaEmEdicao, setTarefaEmEdicao] = useState(null);
  const [filtroTipo, setFiltroTipo] = useState('Todas');

  // ─── Firebase listener ────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onValue(ref(database, 'crm_data/tarefas'), (snap) => {
      const data = snap.val();
      setTarefas(data ? Object.entries(data).map(([id, t]) => ({ ...t, id })) : []);
      setCarregando(false);
    });
    return () => unsub();
  }, []);

  // ─── Date helpers ─────────────────────────────────────────────────────────
  const hoje = new Date().toISOString().slice(0, 10);
  const fimSemana = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  // ─── Filtering ────────────────────────────────────────────────────────────
  const tarefasFiltradas = useMemo(() => {
    const tipoMap = {
      'Ligações': 'ligacao',
      'E-mails': 'email',
      'Reuniões': 'reuniao',
      'Follow-ups': 'followup',
    };
    if (filtroTipo === 'Todas') return tarefas;
    const tipoChave = tipoMap[filtroTipo];
    return tipoChave ? tarefas.filter(t => t.tipo === tipoChave) : tarefas;
  }, [tarefas, filtroTipo]);

  // ─── Grouping ─────────────────────────────────────────────────────────────
  const grupos = useMemo(() => {
    const atrasadas = tarefasFiltradas
      .filter(t => t.data < hoje && !t.concluida)
      .sort((a, b) => a.data.localeCompare(b.data));

    const hoje_tasks = tarefasFiltradas
      .filter(t => t.data === hoje)
      .sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));

    const semana = tarefasFiltradas
      .filter(t => t.data > hoje && t.data <= fimSemana && !t.concluida)
      .sort((a, b) => a.data.localeCompare(b.data));

    const futuras = tarefasFiltradas
      .filter(t => t.data > fimSemana && !t.concluida)
      .sort((a, b) => a.data.localeCompare(b.data));

    return [
      { key: 'atrasadas', label: '🔴 Atrasadas',   accent: 'var(--red)',    tasks: atrasadas  },
      { key: 'hoje',      label: '🟡 Hoje',         accent: 'var(--yellow)', tasks: hoje_tasks },
      { key: 'semana',    label: '🟢 Esta Semana',  accent: 'var(--green)',  tasks: semana     },
      { key: 'futuras',   label: '📅 Futuras',      accent: 'var(--accent)', tasks: futuras    },
    ];
  }, [tarefasFiltradas, hoje, fimSemana]);

  // ─── CRUD ─────────────────────────────────────────────────────────────────
  const salvarTarefa = (dados) => {
    const agora = new Date().toISOString();
    if (!tarefaEmEdicao) {
      const novaRef = push(ref(database, 'crm_data/tarefas'));
      set(novaRef, { ...dados, id: novaRef.key, concluida: false, createdAt: agora });
    } else {
      set(ref(database, 'crm_data/tarefas/' + dados.id), { ...dados, updatedAt: agora });
    }
    setModalAberto(false);
    setTarefaEmEdicao(null);
  };

  const toggleConcluida = (tarefa) => {
    set(ref(database, 'crm_data/tarefas/' + tarefa.id), {
      ...tarefa,
      concluida: !tarefa.concluida,
      updatedAt: new Date().toISOString(),
    });
  };

  const deletarTarefa = (id) => {
    if (window.confirm('Excluir esta tarefa?')) {
      remove(ref(database, 'crm_data/tarefas/' + id));
    }
  };

  const abrirNova    = () => { setTarefaEmEdicao(null); setModalAberto(true); };
  const abrirEdicao  = (t) => { setTarefaEmEdicao(t);  setModalAberto(true); };

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const typeIcons   = { ligacao: '📞', email: '✉️', reuniao: '🤝', followup: '💬' };
  const priorityColors = { alta: 'var(--red)', media: 'var(--yellow)', baixa: 'var(--green)' };

  const formataDataHora = (data, hora) => {
    if (!data) return '';
    const parts = data.split('-');
    const d = `${parts[2]}/${parts[1]}`;
    return hora ? `${d} ${hora}` : d;
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

      {/* Page Header */}
      <div className="page-header">
        <div>
          <div className="page-title">
            ✅ Tarefas &amp; Follow-ups
            <span className="title-badge">
              {tarefas.filter(t => !t.concluida).length} pendentes
            </span>
          </div>
          <div className="page-subtitle">
            Gerencie atividades e follow-ups vinculados aos leads
          </div>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={abrirNova}>
            + Nova Tarefa
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="page-content">

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {['Todas', 'Ligações', 'E-mails', 'Reuniões', 'Follow-ups'].map(f => (
            <div
              key={f}
              className={`filter-chip ${filtroTipo === f ? 'active' : ''}`}
              onClick={() => setFiltroTipo(f)}
            >
              {f}
            </div>
          ))}
        </div>

        {/* Loading */}
        {carregando && (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text3)' }}>
            Carregando tarefas...
          </div>
        )}

        {/* Empty state */}
        {!carregando && tarefas.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 40px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)', marginBottom: '8px' }}>
              Nenhuma tarefa ainda
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text3)', marginBottom: '24px' }}>
              Crie a primeira tarefa para acompanhar seus follow-ups
            </div>
            <button className="btn btn-primary" onClick={abrirNova}>
              + Criar primeira tarefa
            </button>
          </div>
        )}

        {/* Empty filtered state */}
        {!carregando && tarefas.length > 0 && tarefasFiltradas.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 40px', color: 'var(--text3)' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔍</div>
            <div style={{ fontSize: '14px' }}>Nenhuma tarefa encontrada para este filtro.</div>
          </div>
        )}

        {/* Task groups */}
        {!carregando && grupos.map(grupo =>
          grupo.tasks.length > 0 && (
            <div key={grupo.key} style={{ marginBottom: '28px' }}>

              {/* Group header */}
              <div
                className="task-group-header"
                style={{
                  borderLeft: `3px solid ${grupo.accent}`,
                  paddingLeft: '12px',
                  color: grupo.accent,
                }}
              >
                {grupo.label}
                <span style={{
                  background: 'var(--surface2)',
                  color: 'var(--text3)',
                  fontSize: '11px',
                  padding: '1px 8px',
                  borderRadius: '10px',
                  fontFamily: "'DM Mono', monospace",
                  marginLeft: '6px',
                }}>
                  {grupo.tasks.length}
                </span>
              </div>

              {/* Task list */}
              <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                overflow: 'hidden',
                marginTop: '8px',
              }}>
                {grupo.tasks.map((t, idx) => (
                  <div
                    key={t.id}
                    className={`task-item ${t.concluida ? 'completed' : ''}`}
                    style={{
                      borderBottom: idx < grupo.tasks.length - 1
                        ? '1px solid var(--border)'
                        : 'none',
                    }}
                  >
                    {/* Checkbox */}
                    <div
                      className={`task-checkbox ${t.concluida ? 'checked' : ''}`}
                      onClick={() => toggleConcluida(t)}
                      title={t.concluida ? 'Marcar como pendente' : 'Marcar como concluída'}
                    >
                      {t.concluida && '✓'}
                    </div>

                    {/* Priority dot */}
                    <div
                      className="priority-dot"
                      style={{
                        background: priorityColors[t.prioridade] || 'var(--text3)',
                        flexShrink: 0,
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                      }}
                      title={`Prioridade: ${t.prioridade}`}
                    />

                    {/* Type icon */}
                    <span style={{ fontSize: '14px', flexShrink: 0 }}>
                      {typeIcons[t.tipo] || '📋'}
                    </span>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="task-title">{t.titulo}</div>
                      <div style={{ fontSize: '11px', color: 'var(--accent2)', marginTop: '2px' }}>
                        🔗 {t.leadNome || 'Lead não definido'}
                        {t.responsavel && (
                          <span style={{ color: 'var(--text3)', marginLeft: '8px' }}>
                            👤 {t.responsavel}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Date + actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <span className="task-meta">
                        {formataDataHora(t.data, t.hora)}
                      </span>
                      <button
                        className="btn-icon"
                        style={{ padding: '3px 6px', fontSize: '11px' }}
                        onClick={() => abrirEdicao(t)}
                        title="Editar tarefa"
                      >
                        ✏️
                      </button>
                      <button
                        className="btn-icon"
                        style={{ padding: '3px 6px', fontSize: '11px' }}
                        onClick={() => deletarTarefa(t.id)}
                        title="Excluir tarefa"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        )}
      </div>

      {/* Modal */}
      <TarefaModal
        isOpen={modalAberto}
        onClose={() => { setModalAberto(false); setTarefaEmEdicao(null); }}
        onSave={salvarTarefa}
        tarefaAtual={tarefaEmEdicao}
        leads={leads}
        responsaveis={responsaveis}
      />
    </div>
  );
}
