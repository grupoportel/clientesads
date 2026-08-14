import { useState, useMemo, useEffect } from 'react';
import { acharEtapa, etapasDoFunil, ehGanho, formatarBRL, formatarBRLCurto } from '../pipeline';
import { escutarAtividadesRecentes, tempoRelativo, TIPOS } from '../atividades';

const getTaxaColor = (taxa) => {
  if (taxa > 60) return 'var(--green)';
  if (taxa >= 40) return 'var(--yellow)';
  return 'var(--red)';
};

export default function RelatoriosPage({ leads = [], etapas = [] }) {
  const [activePeriod, setActivePeriod] = useState('30 dias');
  const periods = ['7 dias', '30 dias', '90 dias', 'Todos'];

  /* ─── Period filter ─────────────────────────────────────────────────── */
  const leadsFiltrados = useMemo(() => {
    const days = activePeriod === '7 dias' ? 7 : activePeriod === '30 dias' ? 30 : activePeriod === '90 dias' ? 90 : null;
    if (!days) return leads;
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();
    return leads.filter(l => (l.createdAt || '') >= cutoff);
  }, [leads, activePeriod]);

  /* ─── Funnel ──────────────────────────────────────────────────────── */
  const funilData = useMemo(() => {
    const doFunil = etapasDoFunil(etapas);
    return doFunil.map((etapa, i) => {
      const daEtapa = leadsFiltrados.filter(l => l.status === etapa.id);
      const count   = daEtapa.length;
      const valor   = daEtapa.reduce((s, l) => s + (Number(l.valor) || 0), 0);
      const prev    = i > 0 ? leadsFiltrados.filter(l => l.status === doFunil[i - 1].id).length : count;
      const pct     = leadsFiltrados.length > 0 ? Math.round(count / leadsFiltrados.length * 100) : 0;
      const convRate = prev > 0 && i > 0 ? Math.round(count / prev * 100) : null;
      return {
        key: etapa.id, name: etapa.label, count, valor, pct,
        convRate: convRate !== null ? `${convRate}%` : null,
        color: etapa.cor,
      };
    });
  }, [leadsFiltrados, etapas]);

  /* ─── Performance por responsável ─────────────────────────────────── */
  const perfResponsavel = useMemo(() => {
    const map = {};
    leadsFiltrados.forEach(l => {
      const r = l.responsavel || 'Sem responsável';
      if (!map[r]) map[r] = { name: r, leads: 0, reunioes: 0, conversoes: 0, valor: 0 };
      map[r].leads++;
      if (l.reuniao) map[r].reunioes++;
      if (ehGanho(etapas, l.status)) {
        map[r].conversoes++;
        map[r].valor += Number(l.valor) || 0;
      }
    });
    return Object.values(map)
      .map(r => ({
        ...r,
        taxa: r.leads > 0 ? Math.round(r.conversoes / r.leads * 100) : 0,
        initials: r.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase().slice(0, 2),
      }))
      .sort((a, b) => b.valor - a.valor || b.leads - a.leads)
      .slice(0, 5);
  }, [leadsFiltrados, etapas]);

  /* ─── Leads por origem ────────────────────────────────────────────── */
  const porOrigem = useMemo(() => {
    const map = {};
    leadsFiltrados.forEach(l => { const o = l.origem || 'Outro'; map[o] = (map[o] || 0) + 1; });
    const total = leadsFiltrados.length || 1;
    const origColors = {
      instagram: 'var(--pink)', whatsapp: 'var(--green)', gmn: 'var(--yellow)',
      indicacao: 'var(--purple)', telefone: 'var(--orange)', email: 'var(--cyan)',
      site: 'var(--accent)', outro: 'var(--text3)',
    };
    return Object.entries(map)
      .map(([name, count]) => ({ name, count, pct: Math.round(count / total * 100), color: origColors[name.toLowerCase()] || 'var(--accent)' }))
      .sort((a, b) => b.count - a.count);
  }, [leadsFiltrados]);

  /* ─── Distribuição por nicho ──────────────────────────────────────── */
  const porNicho = useMemo(() => {
    const map = {};
    leadsFiltrados.forEach(l => { const n = l.nicho || 'Sem nicho'; map[n] = (map[n] || 0) + 1; });
    const nichoIcons = { 'Clínicas': '🏥', 'Barbearias': '💈', 'Restaurantes': '🍽️', 'Odontologia': '🦷', 'Pet Shops': '🐾', 'Academias': '🏋️' };
    return Object.entries(map)
      .map(([name, count]) => ({ name, count, icon: nichoIcons[name] || '📁' }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [leadsFiltrados]);
  const nichoMax = Math.max(...porNicho.map(n => n.count), 1);

  /* ─── Atividade recente ───────────────────────────────────────────── */
  // Agora vem da linha do tempo real: quem fez, o que mudou e quando.
  // Antes era uma reconstrução do updatedAt do lead, que não sabia o que mudou.
  const [atividadesBrutas, setAtividadesBrutas] = useState([]);

  useEffect(() => {
    const cancelar = escutarAtividadesRecentes(40, setAtividadesBrutas);
    return () => cancelar();
  }, []);

  const atividades = useMemo(() => atividadesBrutas.slice(0, 10).map(a => ({
    id:   a.id,
    time: tempoRelativo(a.criadoEm),
    icon: (TIPOS[a.tipo] || TIPOS.nota).icone,
    cor:  (TIPOS[a.tipo] || TIPOS.nota).cor,
    desc: a.descricao,
    autor: a.autorNome,
  })), [atividadesBrutas]);

  /* ─── Helpers ─────────────────────────────────────────────────────── */
  const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

  const emptyMsg = (text) => (
    <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text3)', fontSize: 13 }}>
      {text}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 80 }}>
        <div style={{ animation: 'fadeIn 0.4s ease', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '20px 24px', borderBottom: '1px solid var(--border)',
      }}>
        <h1 style={{ margin: 0, fontSize: '1.6rem', color: 'var(--text)', fontWeight: 700 }}>
          📈 Relatórios &amp; Analytics
        </h1>
        <div style={{ display: 'flex', gap: 6 }}>
          {periods.map(p => (
            <button
              key={p}
              onClick={() => setActivePeriod(p)}
              className={p === activePeriod ? 'btn btn-primary' : 'btn btn-ghost'}
              style={{
                fontSize: '0.8rem', padding: '6px 14px', borderRadius: 20,
                ...(p === activePeriod ? {} : { border: '1px solid var(--border)' }),
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '24px' }}>
        {/* Row 1 — Funil de Conversão */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '24px', marginBottom: 24,
        }}>
          <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '1rem', marginBottom: 24 }}>🔻 Funil de Conversão</div>
          {leadsFiltrados.length === 0 ? emptyMsg('Nenhum dado disponível para o período selecionado') : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {funilData.map((stage, i) => (
                <div key={i}>
                  <div style={{
                    display: 'grid', gridTemplateColumns: '180px 1fr 80px 90px',
                    alignItems: 'center', gap: 16, padding: '12px 0',
                  }}>
                    <div>
                      <span style={{ fontSize: '0.9rem', color: 'var(--text)', fontWeight: 500 }}>{stage.name}</span>
                    </div>
                    <div style={{ position: 'relative', height: 32, background: 'var(--surface2)', borderRadius: 6, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${stage.pct}%`, borderRadius: 6,
                        background: `linear-gradient(90deg, ${stage.color}, ${stage.color}88)`,
                        transition: 'width 0.8s ease',
                        display: 'flex', alignItems: 'center', paddingLeft: 12,
                        minWidth: stage.count > 0 ? 40 : 0,
                      }}>
                        {stage.count > 0 && (
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.78rem', fontWeight: 700, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,.5)' }}>
                            {stage.count}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.85rem', color: 'var(--text2)', textAlign: 'center' }}>
                      {stage.pct}%
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text3)', textAlign: 'center' }}>
                      {stage.convRate ? `→ ${stage.convRate}` : ''}
                    </div>
                  </div>
                  {i < funilData.length - 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 80, height: 16 }}>
                      <div style={{ width: 1, height: 16, background: 'var(--border2)' }} />
                      <span style={{ fontSize: '0.7rem', color: 'var(--text3)', marginLeft: 8 }}>
                        ▼ {funilData[i + 1].pct}% permanecem
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Row 2 — Performance + Origem */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 24 }}>
          {/* Performance por Responsável */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: '1rem' }}>👥 Performance por Responsável</span>
            </div>
            {perfResponsavel.length === 0 ? emptyMsg('Nenhum dado') : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Responsável', 'Leads', 'Reuniões', 'Conversões', 'Taxa % ▾'].map(h => (
                        <th key={h} style={{
                          textAlign: 'left', padding: '12px 14px', fontSize: '0.73rem',
                          color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {perfResponsavel.map((t, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                              width: 32, height: 32, borderRadius: '50%',
                              background: `linear-gradient(135deg, var(--accent), var(--accent2))`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.7rem', fontWeight: 700, color: '#fff',
                            }}>{t.initials}</div>
                            <span style={{ fontSize: '0.88rem', color: 'var(--text)', fontWeight: 500 }}>{t.name}</span>
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px', fontFamily: "'DM Mono', monospace", fontSize: '0.85rem', color: 'var(--text)' }}>{t.leads}</td>
                        <td style={{ padding: '12px 14px', fontFamily: "'DM Mono', monospace", fontSize: '0.85rem', color: 'var(--text)' }}>{t.reunioes}</td>
                        <td style={{ padding: '12px 14px', fontFamily: "'DM Mono', monospace", fontSize: '0.85rem', color: 'var(--text)' }}>{t.conversoes}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.85rem', fontWeight: 700, color: getTaxaColor(t.taxa) }}>
                            {t.taxa}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Leads por Origem */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '24px' }}>
            <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '1rem', marginBottom: 20 }}>📍 Leads por Origem</div>
            {porOrigem.length === 0 ? emptyMsg('Nenhum dado') : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {porOrigem.map((s, i) => (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text)', fontWeight: 500 }}>{capitalize(s.name)}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.82rem', color: 'var(--text2)' }}>{s.count}</span>
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.82rem', fontWeight: 600, color: s.color }}>{s.pct}%</span>
                      </span>
                    </div>
                    <div style={{ height: 8, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        width: `${s.pct}%`, height: '100%', background: s.color,
                        borderRadius: 4, transition: 'width 0.8s ease',
                        minWidth: s.pct > 0 ? 6 : 0,
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Row 3 — Nichos + Atividade */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          {/* Distribuição por Nicho */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '24px' }}>
            <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '1rem', marginBottom: 20 }}>🏢 Distribuição por Nicho</div>
            {porNicho.length === 0 ? emptyMsg('Nenhum dado') : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {porNicho.map((n, i) => (
                  <div key={i} style={{
                    background: 'var(--surface2)', border: '1px solid var(--border)',
                    borderRadius: 10, padding: '16px', transition: 'transform 0.2s, border-color 0.2s',
                    cursor: 'default',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'var(--border2)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                  >
                    <div style={{ fontSize: '1.4rem', marginBottom: 8 }}>{n.icon}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text)', fontWeight: 600, marginBottom: 2 }}>{n.name}</div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '1.1rem', color: 'var(--accent)', fontWeight: 700, marginBottom: 8 }}>{n.count}</div>
                    <div style={{ height: 4, background: 'var(--surface3)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${(n.count / nichoMax) * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: 4 }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Atividade Recente */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '24px' }}>
            <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '1rem', marginBottom: 20 }}>🕐 Atividade Recente</div>
            {atividades.length === 0 ? emptyMsg('Nada registrado ainda. As ações a partir de agora aparecem aqui.') : (
              <div style={{ position: 'relative' }}>
                {/* Timeline line */}
                <div style={{ position: 'absolute', left: 15, top: 8, bottom: 8, width: 2, background: 'var(--border)' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {atividades.map((a, i) => (
                    <div key={a.id || i} style={{ display: 'flex', gap: 16, padding: '10px 0', paddingLeft: 36, position: 'relative' }}>
                      {/* Dot */}
                      <div style={{
                        position: 'absolute', left: 10, top: 16,
                        width: 12, height: 12, borderRadius: '50%',
                        background: 'var(--surface)', border: `2px solid ${a.cor}`,
                        zIndex: 1,
                      }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text)' }}>
                          <span style={{ marginRight: 6, fontSize: '0.95rem' }}>{a.icon}</span>
                          {a.desc}
                        </div>
                        <div style={{ fontSize: '0.73rem', color: 'var(--text3)', marginTop: 3 }}>
                          {a.autor} · {a.time}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </div>
    </div>
  );
}
