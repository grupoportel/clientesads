import { useState, useMemo } from 'react';
import { ref, remove } from 'firebase/database';
import { database } from '../firebase';
import TarefaModal from './TarefaModal';
import { iso } from '../periodo';

// Tarefas e gravação vêm do App: era o quarto listener no mesmo caminho do
// banco, e salvar aqui divergia de salvar pela Agenda.
export default function TarefasPage({
  leads = [], tarefas = [], responsaveis = [],
  onSalvarTarefa = () => {}, onAlternarTarefa = () => {}, onAbrirLead = () => {},
}) {
  const [modalAberto, setModalAberto] = useState(false);
  const [tarefaEmEdicao, setTarefaEmEdicao] = useState(null);
  const [filtroTipo, setFiltroTipo] = useState('Todas');
  const [filtroResp, setFiltroResp] = useState('');
  const [ocultarConcluidas, setOcultarConcluidas] = useState(false);

  // ─── Datas de corte ───────────────────────────────────────────────────────
  // Dentro de useMemo porque ler o relógio durante o render é impuro: o React
  // pode renderizar duas vezes e obter valores diferentes.
  const { hoje, fimSemana } = useMemo(() => {
    const agora = new Date();
    return {
      hoje: iso(agora),
      fimSemana: iso(new Date(agora.getTime() + 7 * 86400000)),
    };
  }, []);

  // ─── Filtering ────────────────────────────────────────────────────────────
  const tarefasFiltradas = useMemo(() => {
    const tipoMap = {
      'Ligações': 'ligacao',
      'E-mails': 'email',
      'Reuniões': 'reuniao',
      'Follow-ups': 'followup',
    };
    const tipoChave = tipoMap[filtroTipo];
    return tarefas.filter(t => {
      if (tipoChave && t.tipo !== tipoChave) return false;
      if (filtroResp && t.responsavel !== filtroResp) return false;
      if (ocultarConcluidas && t.concluida) return false;
      return true;
    });
  }, [tarefas, filtroTipo, filtroResp, ocultarConcluidas]);

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

    // Sem este grupo, uma tarefa sem data não caía em nenhuma faixa e
    // simplesmente desaparecia da tela.
    const semData = tarefasFiltradas.filter(t => !t.data && !t.concluida);

    const concluidas = tarefasFiltradas
      .filter(t => t.concluida && t.data !== hoje)
      .sort((a, b) => (b.data || '').localeCompare(a.data || ''))
      .slice(0, 20);

    return [
      { key: 'atrasadas', label: '🔴 Atrasadas',   accent: 'var(--red)',    tasks: atrasadas  },
      { key: 'hoje',      label: '🟡 Hoje',         accent: 'var(--yellow)', tasks: hoje_tasks },
      { key: 'semana',    label: '🟢 Esta Semana',  accent: 'var(--green)',  tasks: semana     },
      { key: 'futuras',   label: '📅 Futuras',      accent: 'var(--accent)', tasks: futuras    },
      { key: 'semData',   label: '❓ Sem data',     accent: 'var(--text3)',  tasks: semData    },
      { key: 'feitas',    label: '✅ Concluídas',   accent: 'var(--green)',  tasks: concluidas },
    ];
  }, [tarefasFiltradas, hoje, fimSemana]);

  // ─── CRUD ─────────────────────────────────────────────────────────────────
  const salvarTarefa = (dados) => {
    onSalvarTarefa(dados, tarefaEmEdicao);
    setModalAberto(false);
    setTarefaEmEdicao(null);
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

        {/* Filtros */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
          {['Todas', 'Ligações', 'E-mails', 'Reuniões', 'Follow-ups'].map(f => (
            <div
              key={f}
              className={`filter-chip ${filtroTipo === f ? 'active' : ''}`}
              onClick={() => setFiltroTipo(f)}
            >
              {f}
            </div>
          ))}

          <div style={{ width: 1, height: 22, background: 'var(--border2)', margin: '0 4px' }} />

          {responsaveis.length > 0 && (
            <select
              className="form-control"
              style={{ width: 'auto', fontSize: 12, padding: '5px 10px' }}
              value={filtroResp}
              onChange={e => setFiltroResp(e.target.value)}
              title="Filtrar por responsável"
            >
              <option value="">Toda a equipe</option>
              {responsaveis.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          )}

          <label style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12, color: 'var(--text3)', cursor: 'pointer',
          }}>
            <input
              type="checkbox"
              checked={ocultarConcluidas}
              onChange={e => setOcultarConcluidas(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            Ocultar concluídas
          </label>
        </div>

        {/* Empty state */}
        {tarefas.length === 0 && (
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
        {tarefas.length > 0 && tarefasFiltradas.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 40px', color: 'var(--text3)' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔍</div>
            <div style={{ fontSize: '14px' }}>Nenhuma tarefa encontrada para este filtro.</div>
          </div>
        )}

        {/* Task groups */}
        {grupos.map(grupo =>
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
                      onClick={() => onAlternarTarefa(t)}
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
                      <div style={{ fontSize: '11px', marginTop: '2px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {(() => {
                          const lead = leads.find(l => l.id === t.leadId);
                          if (!lead) {
                            return <span style={{ color: 'var(--text3)' }}>🔗 {t.leadNome || 'Lead não definido'}</span>;
                          }
                          return (
                            <button
                              onClick={() => onAbrirLead(lead)}
                              title={`Abrir ${lead.nome}`}
                              style={{
                                background: 'transparent', border: 'none', padding: 0,
                                color: 'var(--accent2)', fontSize: '11px', cursor: 'pointer',
                                fontFamily: 'inherit',
                              }}
                            >
                              🔗 {lead.nome}
                            </button>
                          );
                        })()}
                        {t.responsavel && (
                          <span style={{ color: 'var(--text3)' }}>👤 {t.responsavel}</span>
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
      {modalAberto && (
        <TarefaModal
          key={tarefaEmEdicao?.id || 'nova'}
          isOpen={modalAberto}
          onClose={() => { setModalAberto(false); setTarefaEmEdicao(null); }}
          onSave={salvarTarefa}
          tarefaAtual={tarefaEmEdicao}
          leads={leads}
          responsaveis={responsaveis}
        />
      )}
    </div>
  );
}
