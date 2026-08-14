import { useMemo } from 'react';
import { acharEtapa, etapasDoFunil, ehGanho, ehAberto, valorEmAberto, previsaoPonderada, valorGanho, formatarBRL, formatarBRLCurto } from '../pipeline';

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

export default function Dashboard({ leads = [], etapas = [], tarefas = [], metas = {} }) {
  // As tarefas agora chegam por prop: o App já as carrega, não faz sentido um
  // segundo listener lendo o mesmo caminho.
  const tarefasDia = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    return tarefas
      .filter(t => t.data === hoje)
      .sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));
  }, [tarefas]);

  const {
    totalLeads,
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
    const reunioesHoje    = leads.filter(l => l.reuniao === hoje);

    // "Ganho" agora vem da configuração do funil, não de uma lista solta em
    // cada tela — era isso que fazia o Dashboard e a barra de estatísticas
    // mostrarem números diferentes para a mesma pergunta.
    const ganhos   = leads.filter(l => ehGanho(etapas, l.status));
    const taxaConv = totalLeads > 0 ? Math.round(ganhos.length / totalLeads * 100) : 0;

    const receitaGanha = valorGanho(etapas, leads);
    const emAberto     = valorEmAberto(etapas, leads);
    const previsao     = previsaoPonderada(etapas, leads);

    const metaMensal      = Number(metas.receitaMensal) || 0;
    const progressReceita = metaMensal > 0
      ? Math.min(Math.round(receitaGanha / metaMensal * 100), 100)
      : 0;

    const funilData = etapasDoFunil(etapas).map(etapa => {
      const daEtapa = leads.filter(l => l.status === etapa.id);
      return {
        key:   etapa.id,
        label: etapa.label,
        count: daEtapa.length,
        valor: daEtapa.reduce((s, l) => s + (Number(l.valor) || 0), 0),
        color: etapa.cor,
      };
    });
    const funilMax = Math.max(...funilData.map(f => f.count), 1);

    const leadsRecentes    = [...leads].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 5);
    const proximasReunioes = reunioesFuturas.slice().sort((a, b) => a.reuniao.localeCompare(b.reuniao)).slice(0, 4);

    const ranking = Object.values(leads.reduce((acc, l) => {
      const resp = l.responsavel || 'Sem responsável';
      if (!acc[resp]) acc[resp] = { name: resp, leads: 0, conversoes: 0, valor: 0, initials: resp.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase().slice(0,2) };
      acc[resp].leads++;
      if (ehGanho(etapas, l.status)) {
        acc[resp].conversoes++;
        acc[resp].valor += Number(l.valor) || 0;
      }
      return acc;
    }, {}))
    .map(r => ({ ...r, conversion: r.leads > 0 ? Math.round(r.conversoes / r.leads * 100) : 0 }))
    .sort((a, b) => b.valor - a.valor || b.leads - a.leads)
    .slice(0, 5);

    const semValor = leads.filter(l => ehAberto(etapas, l.status) && !(Number(l.valor) > 0)).length;

    const kpis = [
      {
        label:    'Pipeline em Aberto',
        value:    formatarBRLCurto(emAberto),
        sub:      semValor > 0
                    ? `${semValor} lead(s) em aberto sem valor definido`
                    : `${leads.filter(l => ehAberto(etapas, l.status)).length} negócios em andamento`,
        icon:     '📊',
        accent:   'var(--accent)',
        progress: emAberto > 0 ? 100 : 0,
        titulo:   formatarBRL(emAberto),
      },
      {
        label:    'Previsão Ponderada',
        value:    formatarBRLCurto(previsao),
        sub:      'Valor × chance de fechar por etapa',
        icon:     '🎯',
        accent:   'var(--accent2)',
        progress: emAberto > 0 ? Math.round(previsao / emAberto * 100) : 0,
        titulo:   formatarBRL(previsao),
      },
      {
        label:    'Receita Fechada',
        value:    formatarBRLCurto(receitaGanha),
        sub:      metaMensal > 0
                    ? `${progressReceita}% da meta de ${formatarBRLCurto(metaMensal)}`
                    : 'Defina a meta em Configurações → Metas',
        icon:     '💰',
        accent:   'var(--green)',
        progress: progressReceita,
        titulo:   formatarBRL(receitaGanha),
      },
      {
        label:    'Reuniões Agendadas',
        value:    reunioesFuturas.length,
        sub:      `${reunioesHoje.length} hoje · taxa de conversão ${taxaConv}%`,
        icon:     '📅',
        accent:   'var(--yellow)',
        progress: Math.min(reunioesFuturas.length / 30 * 100, 100),
      },
    ];

    return { totalLeads, funilData, funilMax, leadsRecentes, proximasReunioes, kpis, ranking };
  }, [leads, etapas, metas]);

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
            <p
              style={{ fontFamily: "'DM Mono', monospace", fontSize: 28, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}
              title={kpi.titulo || undefined}
            >
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
                  <span
                    style={{
                      fontFamily: "'DM Mono', monospace", fontSize: 12,
                      color: stage.valor > 0 ? 'var(--green)' : 'var(--text3)',
                      width: 62, textAlign: 'right', flexShrink: 0, fontWeight: 600,
                    }}
                    title={stage.valor > 0 ? formatarBRL(stage.valor) : 'Sem valor informado nesta etapa'}
                  >
                    {stage.valor > 0 ? formatarBRLCurto(stage.valor) : '—'}
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
                const cfg = acharEtapa(etapas, lead.status);
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
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text3)' }}>
                    {member.leads} leads
                    {member.valor > 0 && (
                      <span style={{ color: 'var(--green)', fontWeight: 600 }}> · {formatarBRLCurto(member.valor)} fechados</span>
                    )}
                  </p>
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
                const [, mes, dia] = m.reuniao.split('-');
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
