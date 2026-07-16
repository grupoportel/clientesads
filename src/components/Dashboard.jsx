import { useState, useEffect, useMemo } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from '../firebase';

const STATUS_CONFIG = {
  'nenhum':            { label: 'Nenhum',            cls: 's-nenhum' },
  'lead-qualificado':  { label: 'Lead Qualificado',  cls: 's-lead-qualificado' },
  'ligacao-feita':     { label: 'Ligação Feita',      cls: 's-ligacao-feita' },
  'contato-decisor':   { label: 'Contato Decisor',    cls: 's-contato-decisor' },
  'reuniao-marcada':   { label: 'Reunião Marcada',    cls: 's-reuniao-marcada' },
  'contrato-realizado':{ label: 'Contrato Realizado', cls: 's-contrato-realizado' },
  'venda':             { label: 'Venda',              cls: 's-venda' },
  'perda':             { label: 'Perda',              cls: 's-perda' },
  'concluido':         { label: 'Concluído',          cls: 's-concluido' },
};


const cardBase = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '12px',
  padding: '24px',
  transition: 'all 0.25s ease',
};

const tempoAtras = (isoStr) => {
  if (!isoStr) return 'Desconhecido';
  const diff = Date.now() - new Date(isoStr).getTime();
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (h < 1) return 'Agora';
  if (h < 24) return `${h}h atrás`;
  if (d < 2) return 'Ontem';
  return `${d}d atrás`;
};

const formataData = (d) => d ? d.split('-').reverse().join('/') : '';

const statusMeetingType = {
  'reuniao-marcada':    'Reunião',
  'contato-decisor':    'Follow-up',
  'contrato-realizado': 'Fechamento',
  'venda':              'Apresentação',
};

export default function Dashboard({ leads = [] }) {
  const [tarefasDia, setTarefasDia] = useState([]);

  useEffect(() => {
    const unsub = onValue(ref(database, 'crm_data/tarefas'), (snap) => {
      const data = snap.val();
      const hoje = new Date().toISOString().slice(0, 10);
      if (data) {
        const todasAsTarefas = Object.entries(data).map(([id, t]) => ({ ...t, id }));
        setTarefasDia(todasAsTarefas.filter(t => t.data === hoje).sort((a,b) => (a.hora||'').localeCompare(b.hora||'')));
      } else {
        setTarefasDia([]);
      }
    });
    return () => unsub();
  }, []);

  const {
    hoje,
    totalLeads,
    reunioesFuturas,
    reunioesHoje,
    contratos,
    taxaConv,
    receitaEstimada,
    progressReceita,
    funilData,
    funilMax,
    leadsRecentes,
    proximasReunioes,
    kpis,
    ranking,
  } = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);

    const totalLeads = leads.length;

    const reunioesFuturas = leads.filter(l => l.reuniao && l.reuniao >= hoje);
    const reunioesHoje   = leads.filter(l => l.reuniao === hoje);

    const contratos = leads.filter(l => l.status === 'venda' || l.status === 'contrato-realizado');
    const taxaConv  = totalLeads > 0 ? Math.round(contratos.length / totalLeads * 100) : 0;

    const receitaEstimada = contratos.length * 1500;
    const metaMensal      = 60000;
    const progressReceita = Math.min(Math.round(receitaEstimada / metaMensal * 100), 100);

    const statusFunil  = ['lead-qualificado', 'ligacao-feita', 'contato-decisor', 'reuniao-marcada', 'contrato-realizado', 'venda'];
    const statusLabels = { 'lead-qualificado': 'Lead Qualificado', 'ligacao-feita': 'Ligação Feita', 'contato-decisor': 'Contato Decisor', 'reuniao-marcada': 'Reunião Marcada', 'contrato-realizado': 'Contrato Realizado', 'venda': 'Venda' };
    const statusColors = { 'lead-qualificado': 'var(--s-lead-qualificado)', 'ligacao-feita': 'var(--s-ligacao-feita)', 'contato-decisor': 'var(--s-contato-decisor)', 'reuniao-marcada': 'var(--s-reuniao-marcada)', 'contrato-realizado': 'var(--s-contrato-realizado)', 'venda': 'var(--s-venda)' };

    const funilData = statusFunil.map(s => ({
      key:   s,
      label: statusLabels[s],
      count: leads.filter(l => l.status === s).length,
      color: statusColors[s],
    }));
    const funilMax = Math.max(...funilData.map(f => f.count), 1);

    const leadsRecentes    = [...leads].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 5);
    const proximasReunioes = [...leads].filter(l => l.reuniao && l.reuniao >= hoje).sort((a, b) => a.reuniao.localeCompare(b.reuniao)).slice(0, 4);

    const ranking = Object.values(leads.reduce((acc, l) => {
      const resp = l.responsavel || 'Sem responsável';
      if (!acc[resp]) acc[resp] = { name: resp, leads: 0, conversoes: 0, initials: resp.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase().slice(0,2) };
      acc[resp].leads++;
      if (l.status === 'venda' || l.status === 'contrato-realizado') acc[resp].conversoes++;
      return acc;
    }, {}))
    .map(r => ({ ...r, conversion: r.leads > 0 ? Math.round(r.conversoes / r.leads * 100) : 0 }))
    .sort((a, b) => b.leads - a.leads)
    .slice(0, 5);

    const kpis = [
      {
        label:    'Total de Leads',
        value:    totalLeads,
        sub:      `${leads.filter(l => l.status === 'nenhum').length} sem ação`,
        icon:     '👥',
        accent:   'var(--accent)',
        progress: Math.min(totalLeads / 300 * 100, 100),
      },
      {
        label:    'Reuniões Agendadas',
        value:    reunioesFuturas.length,
        sub:      `${reunioesHoje.length} hoje`,
        icon:     '📅',
        accent:   'var(--green)',
        progress: Math.min(reunioesFuturas.length / 30 * 100, 100),
      },
      {
        label:    'Contratos Fechados',
        value:    contratos.length,
        sub:      `Taxa: ${taxaConv}%`,
        icon:     '📋',
        accent:   'var(--pink)',
        progress: taxaConv,
      },
      {
        label:    'Receita Estimada',
        value:    `R$ ${receitaEstimada.toLocaleString('pt-BR')}`,
        sub:      'Meta: R$ 60.000',
        icon:     '💰',
        accent:   'var(--yellow)',
        progress: progressReceita,
      },
    ];

    return { hoje, totalLeads, reunioesFuturas, reunioesHoje, contratos, taxaConv, receitaEstimada, progressReceita, funilData, funilMax, leadsRecentes, proximasReunioes, kpis, ranking };
  }, [leads]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px 32px 80px 32px' }}>
        <div style={{ animation: 'fadeIn 0.4s ease', maxWidth: 1400, margin: '0 auto' }}>
          {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 28, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            Dashboard
          </h1>
          <p style={{ color: 'var(--text3)', marginTop: 4, fontSize: 14 }}>Visão geral do seu CRM</p>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text3)' }}>
          Atualizado em tempo real
        </div>
      </div>

      {/* Row 1: KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, marginBottom: 28 }}>
        {kpis.map((kpi, i) => (
          <div
            key={i}
            style={{
              ...cardBase,
              borderTop: `3px solid ${kpi.accent}`,
              position: 'relative',
              overflow: 'hidden',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <div style={{
              position: 'absolute', top: 16, right: 16,
              width: 44, height: 44, borderRadius: '50%',
              background: `color-mix(in srgb, ${kpi.accent} 15%, transparent)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
            }}>
              {kpi.icon}
            </div>
            <p style={{ color: 'var(--text3)', fontSize: 13, margin: '0 0 8px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {kpi.label}
            </p>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 28, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>
              {kpi.value}
            </p>
            <p style={{ color: 'var(--text3)', fontSize: 12, margin: '0 0 16px' }}>
              {kpi.sub}
            </p>
            {/* Mini progress bar */}
            <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                width: `${kpi.progress}%`, height: '100%',
                background: `linear-gradient(90deg, ${kpi.accent}, color-mix(in srgb, ${kpi.accent} 60%, transparent))`,
                borderRadius: 4, transition: 'width 0.8s ease',
              }} />
            </div>
          </div>
        ))}
      </div>

      {/* Row 2: Funnel + Tasks */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 28 }}>
        {/* Funil de Vendas */}
        <div style={{ ...cardBase }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ color: 'var(--text)', fontSize: 16, fontWeight: 600, margin: 0, fontFamily: "'DM Sans', sans-serif" }}>
              Funil de Vendas
            </h3>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>{totalLeads} leads no total</span>
          </div>
          {totalLeads === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text3)', fontSize: 14 }}>
              Nenhum lead cadastrado
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {funilData.map((stage, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ color: 'var(--text2)', fontSize: 13, width: 140, textAlign: 'right', flexShrink: 0, fontWeight: 500 }}>
                    {stage.label}
                  </span>
                  <div style={{ flex: 1, height: 28, background: 'var(--surface2)', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
                    <div style={{
                      width: `${(stage.count / funilMax * 100).toFixed(0)}%`,
                      height: '100%',
                      background: `linear-gradient(90deg, ${stage.color}, color-mix(in srgb, ${stage.color} 70%, transparent))`,
                      borderRadius: 6,
                      transition: 'width 0.6s ease',
                      display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 10,
                    }}>
                      {stage.count > 0 && (
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700, color: '#fff' }}>
                          {stage.count}
                        </span>
                      )}
                    </div>
                  </div>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: 'var(--text2)', width: 28, textAlign: 'right', flexShrink: 0 }}>
                    {stage.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tarefas do Dia (mock) */}
        <div style={{ ...cardBase }}>
          <h3 style={{ color: 'var(--text)', fontSize: 16, fontWeight: 600, margin: '0 0 16px', fontFamily: "'DM Sans', sans-serif" }}>
            Tarefas do Dia
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {tarefasDia.length === 0 ? (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Nenhuma tarefa para hoje</div>
            ) : tarefasDia.map((task, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px',
                borderRadius: 8, transition: 'background 0.2s',
                opacity: task.concluida ? 0.55 : 1,
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  border: task.concluida ? 'none' : '2px solid var(--border2)',
                  background: task.concluida ? 'var(--green)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, color: '#fff',
                }}>
                  {task.concluida && '✓'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    margin: 0, fontSize: 13, fontWeight: 500,
                    color: 'var(--text)',
                    textDecoration: task.concluida ? 'line-through' : 'none',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {task.titulo}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--accent2)' }}>{task.leadNome}</p>
                </div>
                <span style={{ color: 'var(--text3)', fontSize: 12, fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>
                  {task.hora}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Recent Leads + Ranking + Meetings */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
        {/* Leads Recentes */}
        <div style={{ ...cardBase }}>
          <h3 style={{ color: 'var(--text)', fontSize: 16, fontWeight: 600, margin: '0 0 16px', fontFamily: "'DM Sans', sans-serif" }}>
            Leads Recentes
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {leadsRecentes.length === 0 ? (
              <p style={{ color: 'var(--text3)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
                Nenhum lead cadastrado ainda
              </p>
            ) : (
              leadsRecentes.map((lead, i) => {
                const cfg = STATUS_CONFIG[lead.status] || STATUS_CONFIG['nenhum'];
                return (
                  <div key={lead.id || i} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px', borderRadius: 8,
                    transition: 'background 0.2s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div className="avatar" style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: 'var(--surface3)', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 14, fontWeight: 600, color: 'var(--accent)',
                      flexShrink: 0,
                    }}>
                      {(lead.nome || '?').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {lead.nome}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                        <span style={{ fontSize: 11, color: 'var(--text3)' }}>{lead.nicho || '–'}</span>
                        <span className={`status-badge ${cfg.cls}`} style={{ fontSize: 10, padding: '1px 8px', borderRadius: 99 }}>
                          {cfg.label}
                        </span>
                      </div>
                    </div>
                    <span style={{ color: 'var(--text3)', fontSize: 11, flexShrink: 0, fontFamily: "'DM Mono', monospace" }}>
                      {tempoAtras(lead.createdAt)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Ranking Equipe (mock) */}
        <div style={{ ...cardBase }}>
          <h3 style={{ color: 'var(--text)', fontSize: 16, fontWeight: 600, margin: '0 0 16px', fontFamily: "'DM Sans', sans-serif" }}>
            Ranking Equipe
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {ranking.map((member, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{
                  fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 700,
                  color: i === 0 ? 'var(--yellow)' : i === 1 ? 'var(--text2)' : 'var(--orange)',
                  width: 20, textAlign: 'center',
                }}>
                  {i + 1}°
                </span>
                <div className="avatar" style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: `linear-gradient(135deg, var(--surface3), var(--border))`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700, color: 'var(--accent)', flexShrink: 0,
                }}>
                  {member.initials}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{member.name}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text3)' }}>{member.leads} leads</p>
                  <div style={{ marginTop: 6, height: 5, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{
                      width: `${member.conversion}%`, height: '100%',
                      background: 'linear-gradient(90deg, var(--accent), var(--accent2))',
                      borderRadius: 4,
                    }} />
                  </div>
                </div>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>
                  {member.conversion}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Próximas Reuniões */}
        <div style={{ ...cardBase }}>
          <h3 style={{ color: 'var(--text)', fontSize: 16, fontWeight: 600, margin: '0 0 16px', fontFamily: "'DM Sans', sans-serif" }}>
            Próximas Reuniões
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {proximasReunioes.length === 0 ? (
              <p style={{ color: 'var(--text3)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
                Nenhuma reunião agendada
              </p>
            ) : (
              proximasReunioes.map((m, i) => {
                const [ano, mes, dia] = m.reuniao.split('-');
                const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
                const mesStr = meses[parseInt(mes, 10) - 1] || mes;
                const tipo = statusMeetingType[m.status] || 'Reunião';
                return (
                  <div key={m.id || i} style={{
                    display: 'flex', alignItems: 'center', gap: 14, padding: '10px 8px',
                    borderRadius: 8, transition: 'background 0.2s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{
                      background: 'var(--surface3)', borderRadius: 8, padding: '6px 10px',
                      textAlign: 'center', flexShrink: 0, minWidth: 52,
                    }}>
                      <p style={{ margin: 0, fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>{mesStr}</p>
                      <p style={{ margin: 0, fontFamily: "'DM Mono', monospace", fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                        {dia}
                      </p>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {m.nome}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                        <span className="badge-pill" style={{
                          fontSize: 10, padding: '2px 8px', borderRadius: 99,
                          background: 'var(--surface2)', color: 'var(--accent2)',
                        }}>
                          {tipo}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: "'DM Mono', monospace" }}>
                          {formataData(m.reuniao)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
        </div>
      </div>
    </div>
  );
}
