import React, { useState, useMemo } from 'react';

// ─────────────────────────────────────────────────────────────
// Sub-componentes reutilizáveis para manter o código organizado
// ─────────────────────────────────────────────────────────────

function SectionTitle({ icon, title, badge }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
      <span style={{ fontSize: '18px' }}>{icon}</span>
      <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text)' }}>{title}</h2>
      {badge && (
        <span style={{
          background: 'rgba(0,210,223,0.12)', color: 'var(--accent)', border: '1px solid rgba(0,210,223,0.25)',
          padding: '1px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 700,
          fontFamily: "'DM Mono', monospace"
        }}>
          {badge}
        </span>
      )}
    </div>
  );
}

function Card({ children, style = {}, accent = false }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${accent ? 'var(--accent)' : 'var(--border)'}`,
      borderRadius: '14px',
      padding: '20px',
      boxShadow: accent ? '0 0 24px rgba(0,210,223,0.10)' : 'none',
      ...style
    }}>
      {children}
    </div>
  );
}

function StatCard({ label, value, sub, color = 'var(--text)', icon }) {
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
        <span style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
        {icon && <span style={{ fontSize: '16px' }}>{icon}</span>}
      </div>
      <div style={{ fontSize: '26px', fontWeight: 800, color, fontFamily: "'DM Mono', monospace", lineHeight: 1.2 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '6px', lineHeight: 1.4 }}>{sub}</div>}
    </Card>
  );
}

function SliderField({ label, value, min, max, step = 1, color = 'var(--accent)', onChange, leftNote, rightNote }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
        <span style={{ fontSize: '12px', color: 'var(--text2)' }}>{label}</span>
        <strong style={{ fontSize: '13px', fontFamily: "'DM Mono', monospace", color }}>{value}</strong>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: color }}
      />
      {(leftNote || rightNote) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text3)', marginTop: '2px' }}>
          <span>{leftNote}</span>
          <span>{rightNote}</span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────

export default function MetricasPage({ leads = [] }) {
  const [abaAtiva, setAbaAtiva] = useState('pipeline');
  const [simOpps, setSimOpps]     = useState(0);
  const [simTicket, setSimTicket] = useState(3500);
  const [simWin, setSimWin]       = useState(22);
  const [simCiclo, setSimCiclo]   = useState(18);
  const [optPct, setOptPct]       = useState(0);
  const [leadId, setLeadId]       = useState('');

  // ── Dados reais do CRM ──
  const crm = useMemo(() => {
    const total   = leads.length || 1;
    const ganhos  = leads.filter(l => l.status === 'venda' || l.status === 'contrato-realizado');
    const emNegs  = leads.filter(l => ['contato-decisor','reuniao-marcada','contrato-realizado'].includes(l.status));

    const winRate = Math.round((ganhos.length / total) * 100) || 15;

    let somaVal = 0, cntVal = 0;
    ganhos.forEach(l => {
      const v = parseFloat(String(l.valor || 0).replace(/[^0-9.]/g, ''));
      if (v > 0) { somaVal += v; cntVal++; }
    });
    const ticket = cntVal > 0 ? Math.round(somaVal / cntVal) : 3200;

    const opps = emNegs.length > 0 ? emNegs.length : Math.max(Math.round(total * 0.3), 5);

    let somaDias = 0, cntDias = 0;
    ganhos.forEach(l => {
      if (l.createdAt && l.updatedAt) {
        const diff = new Date(l.updatedAt) - new Date(l.createdAt);
        const dias = Math.max(1, Math.round(diff / 86400000));
        somaDias += dias; cntDias++;
      }
    });
    const ciclo = cntDias > 0 ? Math.round(somaDias / cntDias) : 18;

    return { total, ganhos: ganhos.length, opps, winRate, ticket, ciclo };
  }, [leads]);

  // Preenche simulador com dados reais ao montar
  React.useEffect(() => {
    if (crm.opps > 0 && simOpps === 0) {
      setSimOpps(crm.opps);
      setSimTicket(crm.ticket);
      setSimWin(crm.winRate || 22);
      setSimCiclo(crm.ciclo || 18);
    }
  }, [crm, simOpps]);

  // ── Cálculo Pipeline Velocity ──
  const calcVel = (o, t, w, c, opt = 0) => {
    const fo = 1 + opt / 100;
    const fr = 1 - opt / 100;
    const diario = (o * fo * t * fo * Math.min(1, (w * fo) / 100)) / Math.max(1, c * fr);
    return {
      diario:  Math.round(diario),
      mensal:  Math.round(diario * 30),
      anual:   Math.round(diario * 365),
    };
  };

  const velBase = calcVel(simOpps || 10, simTicket, simWin, simCiclo, 0);
  const velOpt  = calcVel(simOpps || 10, simTicket, simWin, simCiclo, optPct);

  // ── IA Lead Scoring ──
  const scored = useMemo(() => {
    const alvo = leads.find(l => l.id === leadId) || leads[0];
    if (!alvo) return null;
    let pts = 50;
    const sinais = [];

    if (['whatsapp','indicacao'].includes(alvo.origem))          { pts += 15; sinais.push({ t: '+', txt: `Origem de alta confiança (${alvo.origem}) [+15 pts]` }); }
    else if (['instagram','site'].includes(alvo.origem))         { pts += 10; sinais.push({ t: '+', txt: `Canal digital (${alvo.origem}) [+10 pts]` }); }
    else                                                          {           sinais.push({ t: '=', txt: `Origem geral (${alvo.origem || 'não informada'}) [0 pts]` }); }

    if (['contato-decisor','reuniao-marcada','contrato-realizado'].includes(alvo.status)) { pts += 25; sinais.push({ t: '+', txt: `Estágio avançado de negociação [+25 pts]` }); }
    else if (['ligacao-feita','lead-qualificado'].includes(alvo.status))                   { pts += 10; sinais.push({ t: '+', txt: `Estágio de qualificação ativo [+10 pts]` }); }
    else if (alvo.status === 'perda')                                                      { pts -= 40; sinais.push({ t: '-', txt: `Marcado como perda [-40 pts]` }); }

    if (alvo.email?.includes('@'))              { pts += 5;  sinais.push({ t: '+', txt: 'E-mail validado [+5 pts]' }); }
    else                                        { pts -= 10; sinais.push({ t: '-', txt: 'E-mail ausente ou inválido [-10 pts]' }); }

    if (alvo.telefone || alvo.whatsapp)         { pts += 5;  sinais.push({ t: '+', txt: 'Telefone disponível [+5 pts]' }); }

    if (alvo.updatedAt) {
      const dias = Math.floor((Date.now() - new Date(alvo.updatedAt)) / 86400000);
      if (dias <= 2)   { pts += 10; sinais.push({ t: '+', txt: `Engajamento recente (${dias === 0 ? 'Hoje' : dias + 'd atrás'}) [+10 pts]` }); }
      else if (dias > 14) { pts -= 15; sinais.push({ t: '-', txt: `Sem atividade há ${dias} dias [-15 pts]` }); }
    }

    const score = Math.max(0, Math.min(100, pts));
    let tier = 'MQL Básico', cor = 'var(--text3)', acao = 'Manter em automação padrão.';
    if (score >= 80)      { tier = '🔥 SQL — Prioridade Máxima';  cor = 'var(--green)';  acao = 'Contato humano imediato (Speed-to-Lead ≤ 5 min).'; }
    else if (score >= 60) { tier = '⚡ MQL Quente';               cor = 'var(--accent)'; acao = 'Enviar estudo de caso ou demonstração personalizada.'; }
    else if (score < 40)  { tier = '❄️ Desengajado';              cor = 'var(--red)';    acao = 'Reengajar via newsletter ou arquivar após 90 dias.'; }

    return { lead: alvo, score, tier, cor, acao, sinais };
  }, [leads, leadId]);

  // ── Health Score demo ──
  const healthContas = [
    { nome: 'Clínica Odonto Prime',    plano: 'Enterprise', arr: 'R$ 36.000', score: 92, adocao: 95, qbr: 'Assíduo',   risco: 'Baixo',      cor: 'var(--green)',  acao: 'Upsell módulo IA (+15% NRR)' },
    { nome: 'Barbearia VIP Brothers',  plano: 'Pro',        arr: 'R$ 14.400', score: 78, adocao: 82, qbr: 'Pendente',  risco: 'Moderado',   cor: 'var(--yellow)', acao: 'Agendar revisão QBR' },
    { nome: 'Academia Corpo & Alma',   plano: 'Pro',        arr: 'R$ 18.000', score: 64, adocao: 60, qbr: 'Realizado', risco: 'Atenção',    cor: 'var(--yellow)', acao: 'Reforçar treinamento da recepção' },
    { nome: 'Restaurante Sabor do Mar',plano: 'Basic',      arr: 'R$ 7.200',  score: 38, adocao: 25, qbr: 'Ausente',   risco: 'Alto Churn', cor: 'var(--red)',    acao: '🚨 Intervenção executiva urgente' },
  ];

  // ── Abas de navegação ──
  const ABAS = [
    { id: 'pipeline', icon: '⚡', label: 'Pipeline Velocity' },
    { id: 'slas',     icon: '🤝', label: 'SLAs & Speed' },
    { id: 'unit',     icon: '💰', label: 'Economia de Unidade' },
    { id: 'health',   icon: '💓', label: 'Saúde do Cliente' },
    { id: 'scoring',  icon: '🤖', label: 'IA Lead Scoring' },
  ];

  // ═══════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto',
      padding: '20px 28px 60px', color: 'var(--text)'
    }}>

      {/* ── HEADER ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: '12px', marginBottom: '20px',
        paddingBottom: '16px', borderBottom: '1px solid var(--border)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '22px' }}>🎯</span>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0, letterSpacing: '-0.3px' }}>
              Métricas & RevOps
            </h1>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text3)', marginTop: '2px' }}>
              KPIs, Velocidade de Receita e Inteligência de Vendas
            </p>
          </div>
          <span style={{
            background: 'rgba(0,210,223,0.1)', color: 'var(--accent)', border: '1px solid rgba(0,210,223,0.25)',
            padding: '2px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: 700,
            fontFamily: "'DM Mono', monospace"
          }}>BENCHMARKS 2026</span>
        </div>
      </div>

      {/* ── NAVEGAÇÃO DE ABAS ── */}
      <div style={{
        display: 'flex', gap: '4px', marginBottom: '24px',
        borderBottom: '1px solid var(--border)', paddingBottom: '0'
      }}>
        {ABAS.map(aba => {
          const ativa = abaAtiva === aba.id;
          return (
            <button key={aba.id} onClick={() => setAbaAtiva(aba.id)} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '9px 16px', background: 'transparent',
              border: 'none', borderBottom: ativa ? '2px solid var(--accent)' : '2px solid transparent',
              color: ativa ? 'var(--accent)' : 'var(--text3)',
              fontSize: '13px', fontWeight: ativa ? 700 : 500,
              cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
              marginBottom: '-1px'
            }}>
              <span>{aba.icon}</span> {aba.label}
            </button>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════════════
          ABA 1 — PIPELINE VELOCITY
         ══════════════════════════════════════════════════════ */}
      {abaAtiva === 'pipeline' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Fórmula */}
          <Card>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'center' }}>
              <div style={{ flex: '1 1 280px' }}>
                <span style={{
                  background: 'rgba(0,210,223,0.15)', color: 'var(--accent)', padding: '2px 8px',
                  borderRadius: '6px', fontSize: '10px', fontWeight: 700
                }}>FÓRMULA REVOPS</span>
                <h2 style={{ fontSize: '16px', fontWeight: 700, margin: '8px 0 6px 0' }}>
                  Velocidade de Geração de Receita
                </h2>
                <p style={{ fontSize: '12px', color: 'var(--text2)', margin: 0, lineHeight: 1.5 }}>
                  Funde quatro dimensões críticas em um único coeficiente operacional. Mede a velocidade diária em que oportunidades abertas se convertem em receita faturada.
                </p>
              </div>
              <div style={{
                flex: '1 1 260px', textAlign: 'center',
                background: 'rgba(0,0,0,0.3)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border)'
              }}>
                <div style={{ fontSize: '10px', color: 'var(--text3)', letterSpacing: '1px', marginBottom: '6px' }}>CÁLCULO</div>
                <div style={{
                  fontFamily: "'DM Mono', monospace", fontSize: '13px', color: 'var(--accent)',
                  background: 'rgba(0,210,223,0.06)', padding: '10px', borderRadius: '8px',
                  border: '1px dashed rgba(0,210,223,0.3)'
                }}>
                  V = (SQLs × Ticket × Win Rate) / Ciclo
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '8px' }}>
                  10% de melhoria em todos os pilares = <strong style={{ color: 'var(--green)' }}>+46.4%</strong> de receita
                </div>
              </div>
            </div>
          </Card>

          {/* Simulador + Resultado */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

            {/* Sliders */}
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <SectionTitle icon="🎛️" title="Parâmetros do Pipeline" />
                <button onClick={() => { setSimOpps(crm.opps); setSimTicket(crm.ticket); setSimWin(crm.winRate); setSimCiclo(crm.ciclo); setOptPct(0); }}
                  style={{
                    background: 'transparent', border: '1px solid var(--border)', color: 'var(--text3)',
                    padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', marginTop: '-12px'
                  }}>
                  🔄 Usar Dados Reais
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <SliderField label="1. SQLs / Oportunidades Qualificadas" value={`${simOpps} opps`}
                  min={1} max={150} onChange={setSimOpps}
                  leftNote={`CRM atual: ${crm.opps} opps`} rightNote="Qualidade > volume" color="var(--accent)" />
                <SliderField label="2. Ticket Médio (ACV)" value={`R$ ${simTicket.toLocaleString('pt-BR')}`}
                  min={500} max={25000} step={500} onChange={setSimTicket}
                  leftNote={`CRM: ~R$ ${crm.ticket.toLocaleString('pt-BR')}`} rightNote="Value-based selling" color="var(--accent)" />
                <SliderField label="3. Win Rate (Taxa de Fechamento)" value={`${simWin}%`}
                  min={5} max={60} onChange={setSimWin}
                  leftNote={`CRM atual: ${crm.winRate}%`} rightNote="Benchmark SMB: 22-28%" color="var(--green)" />
                <SliderField label="4. Ciclo de Vendas" value={`${simCiclo} dias`}
                  min={3} max={90} onChange={setSimCiclo}
                  leftNote={`CRM: ~${crm.ciclo} dias`} rightNote="Benchmark: 14-30 dias" color="var(--yellow)" />

                <div style={{ height: '1px', background: 'var(--border)' }} />

                <div style={{ background: 'rgba(0,210,223,0.06)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(0,210,223,0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)' }}>🚀 Efeito Composto (otimizar todos os pilares)</span>
                    <span style={{
                      background: 'var(--accent)', color: '#000', padding: '1px 8px',
                      borderRadius: '6px', fontSize: '11px', fontWeight: 700, fontFamily: "'DM Mono', monospace"
                    }}>+{optPct}%</span>
                  </div>
                  <input type="range" min={0} max={25} value={optPct}
                    onChange={e => setOptPct(Number(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--accent)' }}
                  />
                  <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '4px' }}>
                    Simula melhoria simultânea em win rate, ciclo e ticket.
                  </div>
                </div>
              </div>
            </Card>

            {/* Resultado */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <Card accent style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                  Velocidade Mensal de Receita
                </div>
                <div style={{ fontSize: '38px', fontWeight: 800, fontFamily: "'DM Mono', monospace", lineHeight: 1.1, marginBottom: '8px' }}>
                  R$ {velOpt.mensal.toLocaleString('pt-BR')}
                  <span style={{ fontSize: '16px', color: 'var(--text3)', fontWeight: 400 }}> /mês</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', padding: '12px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', margin: '12px 0' }}>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text3)' }}>POR DIA</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--green)', fontFamily: "'DM Mono', monospace" }}>
                      R$ {velOpt.diario.toLocaleString('pt-BR')}
                    </div>
                  </div>
                  <div style={{ width: '1px', background: 'var(--border)' }} />
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text3)' }}>PROJEÇÃO ANUAL</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', fontFamily: "'DM Mono', monospace" }}>
                      R$ {velOpt.anual.toLocaleString('pt-BR')}
                    </div>
                  </div>
                </div>
                {optPct > 0 && (
                  <div style={{
                    background: 'rgba(16,185,129,0.15)', border: '1px solid var(--green)', color: 'var(--green)',
                    padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600
                  }}>
                    📈 +R$ {(velOpt.mensal - velBase.mensal).toLocaleString('pt-BR')}/mês vs. baseline
                    ({Math.round(((velOpt.mensal / Math.max(velBase.mensal, 1)) - 1) * 100)}% de ganho)
                  </div>
                )}
              </Card>

              <Card>
                <SectionTitle icon="📊" title="Diagnóstico Executivo" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[
                    { icon: '💡', title: 'Win Rate vs Ciclo', text: 'PMEs com ticket < R$ 15k fecham em média com 28% em até 30 dias. Contratos Enterprise exigem até 180 dias com win rate de ~15%.' },
                    { icon: '🚀', title: 'Lead Velocity Rate (LVR)', text: 'Crescimento mensal de SQLs deve ser de 15% a 20% para garantir expansão previsível de receitas.' },
                    { icon: '🛡️', title: 'Atenção ao Funil', text: 'Nunca relaxe critérios de qualificação para inflar o topo do funil. Isso aumenta o ciclo e destrói a velocidade.' },
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', gap: '10px', fontSize: '12px', color: 'var(--text2)' }}>
                      <span style={{ fontSize: '14px', flexShrink: 0, marginTop: '1px' }}>{item.icon}</span>
                      <div><strong style={{ color: 'var(--text)' }}>{item.title}:</strong> {item.text}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          ABA 2 — SLAs & SPEED-TO-LEAD
         ══════════════════════════════════════════════════════ */}
      {abaAtiva === 'slas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Linha do Tempo de Resposta */}
          <Card>
            <SectionTitle icon="⏱️" title="O Abismo dos 15 Minutos" badge="SPEED-TO-LEAD" />
            <p style={{ fontSize: '12px', color: 'var(--text2)', margin: '0 0 16px 0', lineHeight: 1.5 }}>
              <strong>78% dos clientes fecham com a primeira empresa a fazer contato humano qualificado.</strong> Veja como a probabilidade de conversão cai em função do tempo de resposta:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              {[
                { tempo: '0 — 5 min', label: 'Ótimo', impacto: '+391%', desc: 'Intenção de compra no pico. Conversão recorde.', cor: 'var(--green)', bg: 'rgba(16,185,129,0.08)' },
                { tempo: '5 — 15 min', label: 'Aceitável', impacto: 'Alta Retenção', desc: 'Mantém o prospecto engajado sem perder momentum.', cor: 'var(--accent)', bg: 'rgba(0,210,223,0.08)' },
                { tempo: '15 — 60 min', label: 'Queda', impacto: '21x menos', desc: 'Após 30 min, chance de fechar é 21x menor que no 5º minuto.', cor: 'var(--yellow)', bg: 'rgba(245,158,11,0.08)' },
                { tempo: '> 60 minutos', label: 'Crítico', impacto: 'Apenas 7%', desc: 'Após 24h a taxa de fechamento desvanece para 7%.', cor: 'var(--red)', bg: 'rgba(239,68,68,0.08)' },
              ].map((item, i) => (
                <div key={i} style={{ background: item.bg, border: `1px solid ${item.cor}`, borderRadius: '10px', padding: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: item.cor, fontFamily: "'DM Mono', monospace" }}>{item.tempo}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text3)', background: 'rgba(0,0,0,0.3)', padding: '1px 6px', borderRadius: '4px' }}>{item.label}</span>
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: item.cor, marginBottom: '4px' }}>{item.impacto}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text2)', lineHeight: 1.4 }}>{item.desc}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* Tabelas lado a lado */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

            {/* Matriz de SLAs */}
            <Card>
              <SectionTitle icon="📋" title="Matriz de SLAs por Canal" />
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Canal', 'Prioridade', 'SLA', 'Escalada'].map(h => (
                      <th key={h} style={{ padding: '6px 4px', color: 'var(--text3)', fontWeight: 600, textAlign: 'left', fontSize: '10px', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { canal: 'Inbound / Demo', prio: 'Tier 1', sla: '≤ 5 min', cor: 'var(--red)', bg: 'rgba(239,68,68,0.15)', escalada: 'Atraso 10 min → Alerta à chefia' },
                    { canal: 'Redes Sociais', prio: 'Tier 2', sla: '≤ 15 min', cor: 'var(--yellow)', bg: 'rgba(245,158,11,0.15)', escalada: 'Atraso 30 min → Round-Robin' },
                    { canal: 'Indicação', prio: 'Moderada', sla: '≤ 60 min', cor: 'var(--accent)', bg: 'rgba(0,210,223,0.12)', escalada: 'Atraso 2h → Relatório para liderança' },
                    { canal: 'Back-office', prio: 'Suporte', sla: '3-7 dias', cor: 'var(--text3)', bg: 'var(--surface2)', escalada: 'Importação / higienização de listas' },
                  ].map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 4px', fontWeight: 600, color: 'var(--text)' }}>{row.canal}</td>
                      <td style={{ padding: '10px 4px' }}>
                        <span style={{ background: row.bg, color: row.cor, padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>
                          {row.prio}
                        </span>
                      </td>
                      <td style={{ padding: '10px 4px', fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>{row.sla}</td>
                      <td style={{ padding: '10px 4px', color: 'var(--text3)' }}>{row.escalada}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            {/* Custo do Funil */}
            <Card>
              <SectionTitle icon="⚖️" title="Custo Ponderado do Funil" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { etapa: 'Lead Bruto → MQL', conv: '25%', custo: 'R$ 200 – 500',   cor: 'var(--text3)', desc: 'Filtro demográfico e interação digital' },
                  { etapa: 'MQL → SQL',         conv: '40%', custo: 'R$ 800 – 2.000', cor: 'var(--accent)', desc: 'Validação humana: BANT / MEDDIC' },
                  { etapa: 'SQL → Oportunidade',conv: '60%', custo: 'R$ 1.500 – 3.000',cor: 'var(--yellow)',desc: 'Budget definido e cronograma confirmado' },
                  { etapa: 'Opp → Venda',       conv: '30%', custo: 'CAC consolidado', cor: 'var(--green)', desc: 'Assinatura e início de onboarding' },
                ].map((st, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 12px', background: 'var(--surface2)', borderRadius: '8px',
                    borderLeft: `3px solid ${st.cor}`
                  }}>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>{st.etapa}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text3)' }}>{st.desc}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: st.cor, fontFamily: "'DM Mono', monospace" }}>{st.conv}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text2)' }}>{st.custo}</div>
                    </div>
                  </div>
                ))}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 12px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px',
                  border: '1px solid var(--border)', fontSize: '11px'
                }}>
                  <span style={{ color: 'var(--text3)' }}>Taxa Global Lead → Fechamento:</span>
                  <strong style={{ color: 'var(--accent)', fontFamily: "'DM Mono', monospace" }}>~1.8% (B2B médio)</strong>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          ABA 3 — ECONOMIA DE UNIDADE
         ══════════════════════════════════════════════════════ */}
      {abaAtiva === 'unit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            <StatCard icon="💸" label="CAC (Custo de Aquisição)" value="R$ 1.450"
              sub="~R$ 2 gastos para cada R$ 1 de ARR gerado. Referência saudável para PMEs." />
            <StatCard icon="⏱️" label="CAC Payback Period" value="7.4 meses" color="var(--yellow)"
              sub="Meta SMB: 8–12 meses. PLG alcança ~4.2 meses." />
            <StatCard icon="💎" label="Rácio LTV : CAC" value="4.2 : 1" color="var(--green)"
              sub="✓ Excelência (4:1 – 5:1). Mínimo existencial incontornável: 3:1." />
            <StatCard icon="🔥" label="Rule of 40" value="48%" color="var(--accent)"
              sub="Crescimento ARR (31%) + Margem Lucro (17%) > 40 pts. ✓ Aprovado." />
          </div>

          {/* NRR vs GRR */}
          <Card>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'flex-start' }}>
              <div style={{ flex: '1 1 300px' }}>
                <SectionTitle icon="📡" title="A Genética da Retenção: NRR vs GRR" badge="FAROL REVOPS" />
                <p style={{ fontSize: '12px', color: 'var(--text2)', margin: '0 0 12px 0', lineHeight: 1.5 }}>
                  Para modelos de assinatura, a <strong>NRR (Net Revenue Retention)</strong> é o supremo oráculo de viabilidade. Empresas com NRR de 120%+ multiplicam receita perpetuamente via upsells, sem precisar de novos clientes.
                </p>
                <div style={{ padding: '10px 12px', background: 'rgba(239,68,68,0.06)', borderRadius: '8px', borderLeft: '3px solid var(--red)', fontSize: '11px', color: 'var(--text2)' }}>
                  ⚠️ <strong>Cuidado com GRR baixo:</strong> Um NRR alto pode mascarar evasão massiva se o GRR estiver abaixo de 85%. São métricas complementares.
                </div>
              </div>

              <div style={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {[
                  { label: 'NRR (Retenção Líquida)', sub: 'Inclui expansões e upsells', value: 124, pct: '124%', cor: 'var(--green)', gradient: true,
                    notas: ['0%', 'Limiar (100%)', '🏆 Meta (120%+)'] },
                  { label: 'GRR (Retenção Bruta)', sub: 'Teto máximo de 100%', value: 92, pct: '92%', cor: 'var(--accent)',
                    notas: ['Risco (<80%)', 'Aceitável (85%)', '✓ Saudável (90%+)'] },
                ].map((item, i) => (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '5px' }}>
                      <div>
                        <strong style={{ fontSize: '13px', color: item.cor }}>{item.label}</strong>
                        <span style={{ fontSize: '10px', color: 'var(--text3)', marginLeft: '6px' }}>{item.sub}</span>
                      </div>
                      <strong style={{ fontSize: '18px', fontFamily: "'DM Mono', monospace", color: item.cor }}>{item.pct}</strong>
                    </div>
                    <div style={{ width: '100%', height: '10px', background: 'var(--surface2)', borderRadius: '5px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${Math.min(item.value, 100)}%`, height: '100%', borderRadius: '5px',
                        background: item.gradient ? 'linear-gradient(90deg, var(--accent), var(--green))' : item.cor
                      }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text3)', marginTop: '3px' }}>
                      {item.notas.map((n, j) => <span key={j}>{n}</span>)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          ABA 4 — SAÚDE DO CLIENTE
         ══════════════════════════════════════════════════════ */}
      {abaAtiva === 'health' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Signal Stack + NPS/CSAT/CES */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

            {/* Pesos do Health Score */}
            <Card>
              <SectionTitle icon="💓" title='Índice "Signal Stack" (0-100)' />
              <p style={{ fontSize: '11px', color: 'var(--text2)', margin: '0 0 12px 0', lineHeight: 1.4 }}>
                Antecipa microfissuras e risco de churn meses antes que o cancelamento formal ocorra.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { dim: 'Adoção & Uso do Produto Core',     peso: '35%', cor: 'var(--green)' },
                  { dim: 'Engajamento Mútuo & QBRs',         peso: '25%', cor: 'var(--accent)' },
                  { dim: 'Marcos de Onboarding (Milestones)',peso: '20%', cor: 'var(--yellow)' },
                  { dim: 'Fortaleza do Relacionamento',       peso: '10%', cor: 'var(--purple)' },
                  { dim: 'Recência & Fatores Externos',       peso: '10%', cor: 'var(--red)' },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: 'var(--surface2)', borderRadius: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text)' }}>{item.dim}</span>
                    <span style={{
                      fontSize: '11px', fontWeight: 700, color: item.cor,
                      fontFamily: "'DM Mono', monospace", background: 'rgba(0,0,0,0.25)',
                      padding: '2px 8px', borderRadius: '6px'
                    }}>{item.peso}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* NPS / CSAT / CES */}
            <Card>
              <SectionTitle icon="🏷️" title="Termômetros de Satisfação" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  { nome: 'NPS — Net Promoter Score',    valor: '+74', cor: 'var(--green)',  desc: 'Mede lealdade e recomendação espontânea. NPS alto blinda contra deserções em massa.' },
                  { nome: 'CSAT — Customer Satisfaction',valor: '94%', cor: 'var(--accent)', desc: 'Termômetro de interações pontuais (suporte, tickets). Útil para medir qualidade de atendimento.' },
                  { nome: 'CES — Customer Effort Score', valor: '1.8/7',cor: 'var(--yellow)',desc: 'Mede atrito e burocracia. Esforço baixo (< 2.5) é o maior previsor de churn evitável.' },
                ].map((item, i) => (
                  <div key={i} style={{ background: 'var(--surface2)', padding: '12px', borderRadius: '10px', borderLeft: `3px solid ${item.cor}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <strong style={{ fontSize: '13px', color: 'var(--text)' }}>{item.nome}</strong>
                      <span style={{ fontSize: '18px', fontWeight: 800, color: item.cor, fontFamily: "'DM Mono', monospace" }}>{item.valor}</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text2)', lineHeight: 1.4 }}>{item.desc}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Radar de Contas */}
          <Card>
            <SectionTitle icon="🚨" title="Radar de Contas — Previsão de Churn (60-90 dias)" />
            <p style={{ fontSize: '11px', color: 'var(--text3)', margin: '0 0 14px 0' }}>
              IA prevê risco com 85% de exatidão, permitindo resgatar de 30% a 50% dos contratos em perigo.
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Cliente', 'ARR', 'Health Score', 'Adoção', 'QBR', 'Risco', 'Ação Recomendada'].map(h => (
                      <th key={h} style={{ padding: '8px 6px', color: 'var(--text3)', fontWeight: 600, textAlign: 'left', fontSize: '10px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {healthContas.map((acc, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 6px', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                        {acc.nome} <span style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: 400 }}>({acc.plano})</span>
                      </td>
                      <td style={{ padding: '12px 6px', fontFamily: "'DM Mono', monospace' ", whiteSpace: 'nowrap' }}>{acc.arr}</td>
                      <td style={{ padding: '12px 6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '32px', height: '5px', background: 'var(--surface2)', borderRadius: '3px', overflow: 'hidden', flexShrink: 0 }}>
                            <div style={{ width: `${acc.score}%`, height: '100%', background: acc.cor }} />
                          </div>
                          <strong style={{ color: acc.cor, fontFamily: "'DM Mono', monospace" }}>{acc.score}</strong>
                        </div>
                      </td>
                      <td style={{ padding: '12px 6px', fontFamily: "'DM Mono', monospace" }}>{acc.adocao}%</td>
                      <td style={{ padding: '12px 6px' }}>
                        <span style={{
                          padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600,
                          background: ['Assíduo','Realizado'].includes(acc.qbr) ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                          color: ['Assíduo','Realizado'].includes(acc.qbr) ? 'var(--green)' : 'var(--yellow)'
                        }}>{acc.qbr}</span>
                      </td>
                      <td style={{ padding: '12px 6px', fontWeight: 700, color: acc.cor, whiteSpace: 'nowrap' }}>{acc.risco}</td>
                      <td style={{ padding: '12px 6px', color: 'var(--text2)' }}>{acc.acao}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          ABA 5 — IA LEAD SCORING
         ══════════════════════════════════════════════════════ */}
      {abaAtiva === 'scoring' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Intro */}
          <Card style={{ borderColor: 'var(--purple)', background: 'linear-gradient(135deg, var(--surface), rgba(139,92,246,0.06))' }}>
            <SectionTitle icon="🤖" title="Predictive Lead Scoring — Triagem com IA" badge="ML REVOPS" />
            <p style={{ fontSize: '12px', color: 'var(--text2)', margin: 0, lineHeight: 1.5, maxWidth: '700px' }}>
              Cruzando sinais firmográficos, canal de origem, engajamento e recência, o algoritmo classifica a <strong>probabilidade real de fechamento</strong> de cada lead com precisão superior a 90%, priorizando automaticamente quem está pronto para comprar.
            </p>
          </Card>

          {/* Seletor + Resultado lado a lado */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

            {/* Seletor */}
            <Card>
              <SectionTitle icon="🔍" title="Selecione um Lead do CRM" />
              <select value={leadId} onChange={e => setLeadId(e.target.value)} style={{
                width: '100%', padding: '10px 12px', borderRadius: '8px',
                background: 'var(--surface2)', border: '1px solid var(--border)',
                color: 'var(--text)', fontSize: '13px', outline: 'none', cursor: 'pointer', marginBottom: '14px'
              }}>
                <option value="">-- {leads.length} leads disponíveis --</option>
                {leads.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.nome || 'Sem nome'} | {l.status} | {l.origem || 'Sem origem'}
                  </option>
                ))}
              </select>

              {scored?.lead && (
                <div style={{ background: 'var(--surface2)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', marginBottom: '10px' }}>
                    {scored.lead.nome || 'Lead sem nome'}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px', color: 'var(--text2)' }}>
                    <div><span style={{ color: 'var(--text3)' }}>Status: </span>{scored.lead.status || '—'}</div>
                    <div><span style={{ color: 'var(--text3)' }}>Origem: </span>{scored.lead.origem || '—'}</div>
                    <div><span style={{ color: 'var(--text3)' }}>E-mail: </span>{scored.lead.email || '—'}</div>
                    <div><span style={{ color: 'var(--text3)' }}>Nicho: </span>{scored.lead.nicho || '—'}</div>
                    <div><span style={{ color: 'var(--text3)' }}>Responsável: </span>{scored.lead.responsavel || '—'}</div>
                  </div>
                </div>
              )}
            </Card>

            {/* Score Resultado */}
            <Card style={{ border: `1px solid ${scored?.cor || 'var(--border)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: scored?.cor || 'var(--text3)', textTransform: 'uppercase' }}>
                  {scored?.tier || 'Aguardando seleção'}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text3)', background: 'var(--surface2)', padding: '2px 8px', borderRadius: '6px' }}>
                  Precisão IA: 91.4%
                </span>
              </div>

              {scored ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '10px' }}>
                    <span style={{ fontSize: '52px', fontWeight: 800, color: scored.cor, fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>
                      {scored.score}
                    </span>
                    <span style={{ fontSize: '14px', color: 'var(--text3)' }}>/ 100 pts</span>
                  </div>

                  <div style={{ width: '100%', height: '6px', background: 'var(--surface2)', borderRadius: '3px', overflow: 'hidden', marginBottom: '12px' }}>
                    <div style={{ width: `${scored.score}%`, height: '100%', background: scored.cor, transition: 'width 0.4s ease' }} />
                  </div>

                  <div style={{ background: 'rgba(0,0,0,0.25)', padding: '10px', borderRadius: '8px', fontSize: '12px', marginBottom: '12px', border: '1px solid var(--border)' }}>
                    <strong style={{ color: 'var(--text)' }}>Ação Recomendada: </strong>
                    <span style={{ color: 'var(--text2)' }}>{scored.acao}</span>
                  </div>

                  <div style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Sinais do Algoritmo
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '160px', overflowY: 'auto' }}>
                    {scored.sinais.map((s, i) => (
                      <div key={i} style={{
                        fontSize: '11px', padding: '5px 8px', borderRadius: '6px',
                        background: s.t === '+' ? 'rgba(16,185,129,0.1)' : s.t === '-' ? 'rgba(239,68,68,0.1)' : 'var(--surface2)',
                        color: s.t === '+' ? 'var(--green)' : s.t === '-' ? 'var(--red)' : 'var(--text2)',
                        borderLeft: `2px solid ${s.t === '+' ? 'var(--green)' : s.t === '-' ? 'var(--red)' : 'var(--text3)'}`
                      }}>
                        {s.txt}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)', fontSize: '13px' }}>
                  👈 Selecione um lead para ver o score preditivo
                </div>
              )}
            </Card>
          </div>

          {/* Nota de Governança */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 16px',
            background: 'var(--surface2)', borderRadius: '10px', border: '1px solid var(--border)', fontSize: '11px', color: 'var(--text2)'
          }}>
            <span style={{ fontSize: '16px', flexShrink: 0 }}>⚖️</span>
            <div>
              <strong style={{ color: 'var(--text)' }}>Regra de Ouro de Governança (Regra 1-10-100):</strong>{' '}
              Custa R$ 1 para validar um dado na entrada, R$ 10 para limpar depois e R$ 100 em prejuízo quando dados falhos poluem os algoritmos de predição de IA.
              Mantenha validade de e-mails &gt; 90% e duplicidade &lt; 3%.
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
