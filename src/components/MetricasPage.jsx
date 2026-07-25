import React, { useState, useEffect, useMemo } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from '../firebase';

// ─────────────────────────────────────────────────────────
// Sub-componentes reutilizáveis
// ─────────────────────────────────────────────────────────

function Card({ children, style = {}, accent = false }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${accent ? 'var(--accent)' : 'var(--border)'}`,
      borderRadius: '14px', padding: '20px',
      boxShadow: accent ? '0 0 24px rgba(0,210,223,0.10)' : 'none',
      ...style
    }}>
      {children}
    </div>
  );
}

function SectionTitle({ icon, title, badge }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
      <span style={{ fontSize: '16px' }}>{icon}</span>
      <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text)' }}>{title}</h2>
      {badge && (
        <span style={{
          background: 'rgba(0,210,223,0.1)', color: 'var(--accent)',
          border: '1px solid rgba(0,210,223,0.25)', padding: '1px 8px',
          borderRadius: '10px', fontSize: '10px', fontWeight: 700,
          fontFamily: "'DM Mono', monospace"
        }}>{badge}</span>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, color = 'var(--text)', icon, warn = false }) {
  return (
    <Card style={{ border: warn ? '1px solid rgba(239,68,68,0.4)' : '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
        <span style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: 1.3 }}>{label}</span>
        {icon && <span style={{ fontSize: '18px', opacity: 0.85 }}>{icon}</span>}
      </div>
      <div style={{ fontSize: '26px', fontWeight: 800, color, fontFamily: "'DM Mono', monospace", lineHeight: 1.2, margin: '4px 0' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: '11px', color: warn ? 'var(--red)' : 'var(--text3)', marginTop: '4px', lineHeight: 1.4 }}>{sub}</div>}
    </Card>
  );
}

function SliderField({ label, value, displayValue, min, max, step = 1, color = 'var(--accent)', onChange, leftNote, rightNote }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <span style={{ fontSize: '12px', color: 'var(--text2)' }}>{label}</span>
        <strong style={{ fontSize: '13px', fontFamily: "'DM Mono', monospace", color }}>{displayValue ?? value}</strong>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: color }} />
      {(leftNote || rightNote) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text3)', marginTop: '2px' }}>
          <span>{leftNote}</span><span>{rightNote}</span>
        </div>
      )}
    </div>
  );
}

function BarRow({ label, value, max, color, suffix = '', pct }) {
  const pctCalc = pct !== undefined ? pct : (max > 0 ? Math.round((value / max) * 100) : 0);
  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
        <span style={{ color: 'var(--text2)' }}>{label}</span>
        <strong style={{ color: 'var(--text)', fontFamily: "'DM Mono', monospace" }}>{value}{suffix}</strong>
      </div>
      <div style={{ height: '6px', background: 'var(--surface2)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(pctCalc, 100)}%`, height: '100%', background: color, borderRadius: '3px', transition: 'width 0.4s' }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────

export default function MetricasPage({ leads = [] }) {
  const [abaAtiva, setAbaAtiva] = useState('pipeline');

  // ── Firebase: propostas reais ──
  const [propostas, setPropostas] = useState([]);
  useEffect(() => {
    const unsub = onValue(ref(database, 'crm_data/propostas'), snap => {
      const data = snap.val();
      setPropostas(data ? Object.entries(data).map(([id, p]) => ({ ...p, id })) : []);
    });
    return () => unsub();
  }, []);

  // ── Simulador Pipeline Velocity ──
  const [simOpps, setSimOpps]     = useState(0);
  const [simTicket, setSimTicket] = useState(3500);
  const [simWin, setSimWin]       = useState(22);
  const [simCiclo, setSimCiclo]   = useState(18);
  const [optPct, setOptPct]       = useState(0);

  // ── IA Scoring ──
  const [leadId, setLeadId] = useState('');

  // ═══════════════════════════════════════════
  // CÁLCULOS REAIS DOS LEADS
  // ═══════════════════════════════════════════
  const crmLeads = useMemo(() => {
    const total    = leads.length || 1;
    const ganhos   = leads.filter(l => l.status === 'venda' || l.status === 'contrato-realizado');
    const perdidos = leads.filter(l => l.status === 'perda');
    const emNegs   = leads.filter(l => ['contato-decisor', 'reuniao-marcada', 'contrato-realizado'].includes(l.status));
    const semEmail = leads.filter(l => !l.email || !l.email.includes('@'));
    const semWpp   = leads.filter(l => !l.telefone && !l.whatsapp);
    const semResp  = leads.filter(l => !l.responsavel);

    // Leads estagnados (sem atualização há mais de 15 dias e não fechados/perdidos)
    const ativos = leads.filter(l => !['venda', 'contrato-realizado', 'perda', 'concluido'].includes(l.status));
    const estagnados = ativos.filter(l => {
      if (!l.updatedAt) return true;
      const dias = (Date.now() - new Date(l.updatedAt)) / 86400000;
      return dias > 15;
    });

    const winRate = Math.round((ganhos.length / total) * 100) || 0;

    // Ciclo médio (dias entre criação e fechamento)
    let somaDias = 0, cntDias = 0;
    ganhos.forEach(l => {
      if (l.createdAt && l.updatedAt) {
        const dias = Math.max(1, Math.round((new Date(l.updatedAt) - new Date(l.createdAt)) / 86400000));
        somaDias += dias; cntDias++;
      }
    });
    const ciclo = cntDias > 0 ? Math.round(somaDias / cntDias) : 18;

    // Origem dos leads
    const origemMap = {};
    leads.forEach(l => { const o = l.origem || 'Não informada'; origemMap[o] = (origemMap[o] || 0) + 1; });

    // Nicho dos leads
    const nichoMap = {};
    leads.forEach(l => { const n = l.nicho || 'Sem nicho'; nichoMap[n] = (nichoMap[n] || 0) + 1; });

    // Motivo de perda
    const perdaMap = {};
    perdidos.forEach(l => { const m = l.motivoPerda || 'Não informado'; perdaMap[m] = (perdaMap[m] || 0) + 1; });

    // Perda por nicho
    const perdaPorNicho = {};
    perdidos.forEach(l => { const n = l.nicho || 'Sem nicho'; perdaPorNicho[n] = (perdaPorNicho[n] || 0) + 1; });

    // Perda por responsável
    const perdaPorResp = {};
    perdidos.forEach(l => { const r = l.responsavel || 'Sem responsável'; perdaPorResp[r] = (perdaPorResp[r] || 0) + 1; });

    // Taxa de higiene (qualidade dos dados)
    const pctEmailOk  = Math.round(((total - semEmail.length) / total) * 100);
    const pctWppOk    = Math.round(((total - semWpp.length) / total) * 100);
    const pctRespOk   = Math.round(((total - semResp.length) / total) * 100);

    return {
      total, ganhos: ganhos.length, perdidos: perdidos.length,
      emNegs: emNegs.length, winRate, ciclo,
      semEmail: semEmail.length, semWpp: semWpp.length, semResp: semResp.length,
      estagnados: estagnados.length, ativos: ativos.length,
      pctEmailOk, pctWppOk, pctRespOk,
      origemMap, nichoMap, perdaMap, perdaPorNicho, perdaPorResp,
    };
  }, [leads]);

  // ═══════════════════════════════════════════
  // CÁLCULOS REAIS DAS PROPOSTAS
  // ═══════════════════════════════════════════
  const crmPropostas = useMemo(() => {
    const aceitas    = propostas.filter(p => p.status === 'aceita');
    const rejeitadas = propostas.filter(p => p.status === 'rejeitada');
    const enviadas   = propostas.filter(p => p.status === 'enviada');
    const rascunhos  = propostas.filter(p => p.status === 'rascunho');

    const receita      = aceitas.reduce((s, p) => s + (Number(p.valor) || 0), 0);
    const totalFechado = aceitas.length + rejeitadas.length;
    const taxaAceite   = totalFechado > 0 ? Math.round((aceitas.length / totalFechado) * 100) : 0;
    const ticketMedio  = aceitas.length > 0 ? Math.round(receita / aceitas.length) : 0;

    // Receita por mês (últimos 6 meses)
    const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const now = new Date();
    const recMensalMap = {};
    for (let i = 5; i >= 0; i--) {
      let m = now.getMonth() - i;
      if (m < 0) m += 12;
      recMensalMap[meses[m]] = 0;
    }
    aceitas.forEach(p => {
      if (!p.data) return;
      const m = meses[new Date(p.data).getMonth()];
      if (recMensalMap[m] !== undefined) recMensalMap[m] += Number(p.valor) || 0;
    });
    const chartMensal = Object.entries(recMensalMap).map(([mes, valor]) => ({ mes, valor }));
    const chartMax    = Math.max(...chartMensal.map(c => c.valor), 1);

    // Propostas por nicho (via leadId → lead)
    const leadsMap = Object.fromEntries(leads.map(l => [l.id, l]));
    const nichoPropMap = {};
    aceitas.forEach(p => {
      const lead = leadsMap[p.leadId];
      const n = lead?.nicho || 'Sem nicho';
      nichoPropMap[n] = (nichoPropMap[n] || 0) + (Number(p.valor) || 0);
    });

    return {
      total: propostas.length, aceitas: aceitas.length, rejeitadas: rejeitadas.length,
      enviadas: enviadas.length, rascunhos: rascunhos.length,
      receita, taxaAceite, ticketMedio, chartMensal, chartMax, nichoPropMap,
    };
  }, [propostas, leads]);

  // Sincroniza sliders com dados reais
  React.useEffect(() => {
    if (crmLeads.emNegs > 0 && simOpps === 0) {
      setSimOpps(crmLeads.emNegs);
      setSimTicket(crmPropostas.ticketMedio > 0 ? crmPropostas.ticketMedio : 3500);
      setSimWin(crmLeads.winRate > 0 ? crmLeads.winRate : 22);
      setSimCiclo(crmLeads.ciclo > 0 ? crmLeads.ciclo : 18);
    }
  }, [crmLeads, crmPropostas, simOpps]);

  // ── Pipeline Velocity ──
  const calcVel = (o, t, w, c, opt = 0) => {
    const fo = 1 + opt / 100;
    const fr = 1 - opt / 100;
    const diario = (o * fo * t * fo * Math.min(1, (w * fo) / 100)) / Math.max(1, c * fr);
    return { diario: Math.round(diario), mensal: Math.round(diario * 30), anual: Math.round(diario * 365) };
  };
  const velBase = calcVel(simOpps || 10, simTicket, simWin, simCiclo, 0);
  const velOpt  = calcVel(simOpps || 10, simTicket, simWin, simCiclo, optPct);

  // ── IA Lead Scoring ──
  const scored = useMemo(() => {
    const alvo = leads.find(l => l.id === leadId) || leads[0];
    if (!alvo) return null;
    let pts = 50;
    const sinais = [];

    // Origem
    if (['whatsapp', 'indicacao'].includes(alvo.origem))        { pts += 15; sinais.push({ t: '+', txt: `Origem de alta confiança: ${alvo.origem} [+15]` }); }
    else if (['instagram', 'site'].includes(alvo.origem))       { pts += 10; sinais.push({ t: '+', txt: `Canal digital rastreável: ${alvo.origem} [+10]` }); }
    else if (['gmn', 'telefone'].includes(alvo.origem))         { pts += 5;  sinais.push({ t: '+', txt: `Canal direto: ${alvo.origem} [+5]` }); }
    else                                                         {           sinais.push({ t: '=', txt: `Origem não informada [0]` }); }

    // Estágio no funil
    if (['reuniao-marcada', 'contrato-realizado'].includes(alvo.status))  { pts += 30; sinais.push({ t: '+', txt: `Estágio avançado: ${alvo.status} [+30]` }); }
    else if (['contato-decisor'].includes(alvo.status))                   { pts += 20; sinais.push({ t: '+', txt: `Contato com decisor confirmado [+20]` }); }
    else if (['ligacao-feita', 'lead-qualificado'].includes(alvo.status)) { pts += 10; sinais.push({ t: '+', txt: `Em qualificação ativa [+10]` }); }
    else if (alvo.status === 'perda')                                      { pts -= 40; sinais.push({ t: '-', txt: `Marcado como perda [-40]` }); }
    else if (alvo.status === 'nenhum')                                     { pts -= 10; sinais.push({ t: '-', txt: `Sem nenhuma ação registrada [-10]` }); }

    // Dados de contato
    if (alvo.email?.includes('@'))           { pts += 5;  sinais.push({ t: '+', txt: 'E-mail válido cadastrado [+5]' }); }
    else                                     { pts -= 8;  sinais.push({ t: '-', txt: 'E-mail ausente ou inválido [-8]' }); }

    if (alvo.whatsapp || alvo.telefone)      { pts += 5;  sinais.push({ t: '+', txt: 'Telefone/WhatsApp disponível [+5]' }); }
    else                                     { pts -= 5;  sinais.push({ t: '-', txt: 'Sem contato direto cadastrado [-5]' }); }

    // Decisor confirmado
    if (alvo.decisor)                        { pts += 8;  sinais.push({ t: '+', txt: 'Decisor identificado e registrado [+8]' }); }

    // Reunião marcada
    if (alvo.reuniao && alvo.reuniao >= new Date().toISOString().slice(0,10)) {
      pts += 10; sinais.push({ t: '+', txt: `Reunião agendada para ${alvo.reuniao} [+10]` });
    }

    // Recência de atualização
    if (alvo.updatedAt) {
      const dias = Math.floor((Date.now() - new Date(alvo.updatedAt)) / 86400000);
      if (dias <= 2)       { pts += 10; sinais.push({ t: '+', txt: `Atividade recente: ${dias === 0 ? 'hoje' : dias + ' dia(s) atrás'} [+10]` }); }
      else if (dias > 14)  { pts -= 12; sinais.push({ t: '-', txt: `Sem atividade há ${dias} dias [-12]` }); }
    } else {
      pts -= 10; sinais.push({ t: '-', txt: 'Data de atualização não registrada [-10]' });
    }

    const score = Math.max(0, Math.min(100, pts));
    let tier = '⚪ MQL Básico', cor = 'var(--text3)', acao = 'Manter em sequência de nutrição padrão.';
    if (score >= 80)      { tier = '🔥 SQL — Prioridade Máxima'; cor = 'var(--green)';  acao = 'Contato humano imediato. Não deixe esfriar — Speed-to-Lead ≤ 5 min.'; }
    else if (score >= 65) { tier = '⚡ MQL Quente';              cor = 'var(--accent)'; acao = 'Enviar proposta ou convidar para reunião de diagnóstico.'; }
    else if (score >= 45) { tier = '🔵 MQL Morno';              cor = 'var(--yellow)'; acao = 'Nutrir com cases e conteúdo. Ligação de acompanhamento em até 3 dias.'; }
    else                  { tier = '❄️ Baixo Potencial';         cor = 'var(--red)';    acao = 'Avaliar reengajamento ou arquivar após 90 dias sem resposta.'; }

    return { lead: alvo, score, tier, cor, acao, sinais };
  }, [leads, leadId]);

  // ── Abas ──
  const ABAS = [
    { id: 'pipeline',  icon: '⚡', label: 'Pipeline Velocity' },
    { id: 'propostas', icon: '📋', label: 'Propostas & Receita' },
    { id: 'qualidade', icon: '🔍', label: 'Qualidade da Base' },
    { id: 'scoring',   icon: '🤖', label: 'IA Lead Scoring' },
  ];

  const fmt = (n) => n.toLocaleString('pt-BR');

  // ═══════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', padding: '20px 28px 60px', color: 'var(--text)' }}>

      {/* ── HEADER ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: '22px' }}>🎯</span>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0, letterSpacing: '-0.3px' }}>Métricas</h1>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text3)', marginTop: '2px' }}>
            {crmLeads.total} leads · {crmPropostas.total} propostas · dados em tempo real
          </p>
        </div>
      </div>

      {/* ── ABAS ── */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '1px solid var(--border)' }}>
        {ABAS.map(aba => {
          const ativa = abaAtiva === aba.id;
          return (
            <button key={aba.id} onClick={() => setAbaAtiva(aba.id)} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '9px 16px', background: 'transparent', border: 'none',
              borderBottom: ativa ? '2px solid var(--accent)' : '2px solid transparent',
              color: ativa ? 'var(--accent)' : 'var(--text3)',
              fontSize: '13px', fontWeight: ativa ? 700 : 500,
              cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap', marginBottom: '-1px'
            }}>
              <span>{aba.icon}</span> {aba.label}
            </button>
          );
        })}
      </div>

      {/* ════════════════════════════════════════════
          ABA 1 — PIPELINE VELOCITY
         ════════════════════════════════════════════ */}
      {abaAtiva === 'pipeline' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* KPIs reais do funil */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
            <StatCard icon="👥" label="Total de Leads" value={crmLeads.total}
              sub={`${crmLeads.emNegs} em negociação ativa`} color="var(--text)" />
            <StatCard icon="✅" label="Fechamentos" value={crmLeads.ganhos}
              sub={`Win Rate real: ${crmLeads.winRate}%`} color="var(--green)" />
            <StatCard icon="❌" label="Perdas" value={crmLeads.perdidos}
              sub={`${Math.round((crmLeads.perdidos / (crmLeads.total || 1)) * 100)}% do total`} color="var(--red)" />
            <StatCard icon="⏱️" label="Ciclo Médio" value={`${crmLeads.ciclo}d`}
              sub="Dias da entrada ao fechamento" color="var(--yellow)" />
          </div>

          {/* Simulador + Resultado */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <SectionTitle icon="🎛️" title="Simulador de Crescimento" />
                <button onClick={() => { setSimOpps(crmLeads.emNegs || 10); setSimTicket(crmPropostas.ticketMedio || 3500); setSimWin(crmLeads.winRate || 22); setSimCiclo(crmLeads.ciclo || 18); setOptPct(0); }}
                  style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text3)', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', marginTop: '-10px', flexShrink: 0 }}>
                  🔄 Dados Reais
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <SliderField label="Oportunidades em negociação (SQLs)" value={simOpps} displayValue={`${simOpps} opps`}
                  min={1} max={150} onChange={setSimOpps} color="var(--accent)"
                  leftNote={`Seu CRM: ${crmLeads.emNegs} em negociação`} rightNote="Qualidade > volume" />
                <SliderField label="Ticket médio por contrato (R$)" value={simTicket} displayValue={`R$ ${fmt(simTicket)}`}
                  min={500} max={30000} step={500} onChange={setSimTicket} color="var(--accent)"
                  leftNote={`Seu CRM: ${crmPropostas.ticketMedio > 0 ? 'R$ ' + fmt(crmPropostas.ticketMedio) : 'sem dados'}`}
                  rightNote="Base: propostas aceitas" />
                <SliderField label="Win Rate (taxa de fechamento)" value={simWin} displayValue={`${simWin}%`}
                  min={1} max={70} onChange={setSimWin} color="var(--green)"
                  leftNote={`Seu CRM: ${crmLeads.winRate}% real`} rightNote="Benchmark PME: 22-28%" />
                <SliderField label="Ciclo de vendas (dias)" value={simCiclo} displayValue={`${simCiclo} dias`}
                  min={3} max={120} onChange={setSimCiclo} color="var(--yellow)"
                  leftNote={`Seu CRM: ~${crmLeads.ciclo} dias`} rightNote="Meta: reduzir ciclo" />
                <div style={{ height: '1px', background: 'var(--border)' }} />
                <div style={{ background: 'rgba(0,210,223,0.06)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(0,210,223,0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)' }}>🚀 Efeito composto (melhorar todos os pilares)</span>
                    <span style={{ background: 'var(--accent)', color: '#000', padding: '1px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>+{optPct}%</span>
                  </div>
                  <input type="range" min={0} max={25} value={optPct} onChange={e => setOptPct(Number(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--accent)' }} />
                  <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '4px' }}>
                    10% de melhoria simultânea em todos os pilares = +46% de receita
                  </div>
                </div>
              </div>
            </Card>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <Card accent style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                  Velocidade de Receita (V = SQLs × Ticket × Win Rate / Ciclo)
                </div>
                <div style={{ fontSize: '38px', fontWeight: 800, fontFamily: "'DM Mono', monospace", lineHeight: 1.1 }}>
                  R$ {fmt(velOpt.mensal)}
                  <span style={{ fontSize: '15px', color: 'var(--text3)', fontWeight: 400 }}> /mês</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', padding: '12px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', margin: '12px 0' }}>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text3)' }}>POR DIA</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--green)', fontFamily: "'DM Mono', monospace" }}>R$ {fmt(velOpt.diario)}</div>
                  </div>
                  <div style={{ width: '1px', background: 'var(--border)' }} />
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text3)' }}>PROJEÇÃO ANUAL</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', fontFamily: "'DM Mono', monospace" }}>R$ {fmt(velOpt.anual)}</div>
                  </div>
                </div>
                {optPct > 0 && (
                  <div style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid var(--green)', color: 'var(--green)', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600 }}>
                    📈 +R$ {fmt(velOpt.mensal - velBase.mensal)}/mês vs. baseline ({Math.round(((velOpt.mensal / Math.max(velBase.mensal, 1)) - 1) * 100)}% de ganho)
                  </div>
                )}
              </Card>

              {/* Funil real */}
              <Card>
                <SectionTitle icon="🔽" title="Funil Atual (Leads Reais)" />
                {[
                  { label: 'Lead Qualificado', status: 'lead-qualificado', cor: 'var(--accent)' },
                  { label: 'Ligação Feita',    status: 'ligacao-feita',    cor: 'var(--yellow)' },
                  { label: 'Contato Decisor',  status: 'contato-decisor',  cor: 'var(--purple)' },
                  { label: 'Reunião Marcada',  status: 'reuniao-marcada',  cor: 'var(--green)' },
                  { label: 'Contrato / Venda', status: ['contrato-realizado','venda'], cor: 'var(--green)' },
                ].map((et, i) => {
                  const count = Array.isArray(et.status)
                    ? leads.filter(l => et.status.includes(l.status)).length
                    : leads.filter(l => l.status === et.status).length;
                  return (
                    <BarRow key={i} label={et.label} value={count} max={crmLeads.total} color={et.cor}
                      suffix={` lead${count !== 1 ? 's' : ''}`}
                      pct={crmLeads.total > 0 ? Math.round((count / crmLeads.total) * 100) : 0} />
                  );
                })}
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          ABA 2 — PROPOSTAS & RECEITA (DADOS REAIS)
         ════════════════════════════════════════════ */}
      {abaAtiva === 'propostas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* KPIs de propostas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
            <StatCard icon="💰" label="Receita Confirmada" value={`R$ ${fmt(crmPropostas.receita)}`}
              sub={`${crmPropostas.aceitas} proposta${crmPropostas.aceitas !== 1 ? 's' : ''} aceita${crmPropostas.aceitas !== 1 ? 's' : ''}`}
              color="var(--green)" />
            <StatCard icon="🎯" label="Taxa de Aceite" value={`${crmPropostas.taxaAceite}%`}
              sub={`${crmPropostas.aceitas} aceitas / ${crmPropostas.rejeitadas} rejeitadas`}
              color={crmPropostas.taxaAceite >= 40 ? 'var(--green)' : crmPropostas.taxaAceite >= 25 ? 'var(--yellow)' : 'var(--red)'}
              warn={crmPropostas.taxaAceite < 25} />
            <StatCard icon="📊" label="Ticket Médio" value={crmPropostas.ticketMedio > 0 ? `R$ ${fmt(crmPropostas.ticketMedio)}` : '—'}
              sub="Média das propostas aceitas" color="var(--accent)" />
            <StatCard icon="📤" label="Aguardando Resposta" value={crmPropostas.enviadas}
              sub={`+ ${crmPropostas.rascunhos} em rascunho`} color="var(--yellow)" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

            {/* Gráfico de barras mensal */}
            <Card>
              <SectionTitle icon="📅" title="Receita por Mês (últimos 6 meses)" />
              {crmPropostas.chartMensal.every(c => c.valor === 0) ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text3)', fontSize: '13px' }}>
                  Nenhuma proposta aceita com data registrada ainda.<br />
                  <span style={{ fontSize: '11px' }}>Cadastre propostas em <strong>Financeiro</strong> para ver os dados aqui.</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {crmPropostas.chartMensal.map((c, i) => (
                    <BarRow key={i} label={c.mes} value={c.valor} max={crmPropostas.chartMax}
                      color="var(--accent)" suffix="" pct={crmPropostas.chartMax > 0 ? Math.round((c.valor / crmPropostas.chartMax) * 100) : 0} />
                  ))}
                  <div style={{ fontSize: '10px', color: 'var(--text3)', textAlign: 'right', marginTop: '2px' }}>
                    Barras proporcionais ao maior mês
                  </div>
                </div>
              )}
            </Card>

            {/* Status das propostas + receita por nicho */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <Card>
                <SectionTitle icon="📋" title="Status das Propostas" />
                {crmPropostas.total === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text3)', fontSize: '12px' }}>
                    Nenhuma proposta cadastrada ainda.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {[
                      { label: 'Aceitas',   value: crmPropostas.aceitas,    cor: 'var(--green)' },
                      { label: 'Enviadas',  value: crmPropostas.enviadas,   cor: 'var(--yellow)' },
                      { label: 'Rejeitadas',value: crmPropostas.rejeitadas, cor: 'var(--red)' },
                      { label: 'Rascunhos', value: crmPropostas.rascunhos,  cor: 'var(--text3)' },
                    ].map((row, i) => (
                      <BarRow key={i} label={row.label} value={row.value} max={crmPropostas.total}
                        color={row.cor} suffix={` (${crmPropostas.total > 0 ? Math.round((row.value / crmPropostas.total) * 100) : 0}%)`} />
                    ))}
                  </div>
                )}
              </Card>

              <Card>
                <SectionTitle icon="🏆" title="Receita por Nicho" />
                {Object.keys(crmPropostas.nichoPropMap).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '14px 0', color: 'var(--text3)', fontSize: '12px' }}>
                    Sem propostas aceitas com nicho identificado.
                  </div>
                ) : (() => {
                    const entries = Object.entries(crmPropostas.nichoPropMap).sort((a,b) => b[1] - a[1]);
                    const maxVal  = Math.max(...entries.map(e => e[1]), 1);
                    return entries.map(([nicho, valor], i) => (
                      <BarRow key={i} label={nicho} value={`R$ ${fmt(valor)}`} max={maxVal}
                        color="var(--accent)" pct={Math.round((valor / maxVal) * 100)} />
                    ));
                  })()
                }
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          ABA 3 — QUALIDADE DA BASE (DADOS REAIS)
         ════════════════════════════════════════════ */}
      {abaAtiva === 'qualidade' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Cards de higiene */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
            <StatCard icon="📧" label="Leads com E-mail Válido" value={`${crmLeads.pctEmailOk}%`}
              sub={`${crmLeads.semEmail} sem e-mail`}
              color={crmLeads.pctEmailOk >= 80 ? 'var(--green)' : 'var(--red)'}
              warn={crmLeads.pctEmailOk < 80} />
            <StatCard icon="📱" label="Leads com WhatsApp/Tel." value={`${crmLeads.pctWppOk}%`}
              sub={`${crmLeads.semWpp} sem contato direto`}
              color={crmLeads.pctWppOk >= 80 ? 'var(--green)' : 'var(--yellow)'}
              warn={crmLeads.pctWppOk < 60} />
            <StatCard icon="👤" label="Leads com Responsável" value={`${crmLeads.pctRespOk}%`}
              sub={`${crmLeads.semResp} sem dono definido`}
              color={crmLeads.pctRespOk >= 90 ? 'var(--green)' : 'var(--red)'}
              warn={crmLeads.pctRespOk < 90} />
            <StatCard icon="🕐" label="Leads Estagnados" value={crmLeads.estagnados}
              sub={`Sem atividade há mais de 15 dias`}
              color={crmLeads.estagnados > 0 ? 'var(--red)' : 'var(--green)'}
              warn={crmLeads.estagnados > 0} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

            {/* Análise de Perdas */}
            <Card>
              <SectionTitle icon="❌" title="Análise de Perdas" />
              {crmLeads.perdidos === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text3)', fontSize: '13px' }}>
                  🎉 Nenhum lead marcado como "Perda" ainda!
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '8px', textTransform: 'uppercase' }}>Por Motivo de Perda</div>
                    {Object.entries(crmLeads.perdaMap).sort((a,b) => b[1]-a[1]).slice(0,5).map(([motivo, qtd], i) => (
                      <BarRow key={i} label={motivo} value={qtd} max={crmLeads.perdidos}
                        color="var(--red)" suffix={` lead${qtd>1?'s':''}`} />
                    ))}
                    {Object.keys(crmLeads.perdaMap).length === 0 && (
                      <div style={{ fontSize: '12px', color: 'var(--text3)' }}>Motivo de perda não preenchido nos leads.</div>
                    )}
                  </div>
                  <div style={{ height: '1px', background: 'var(--border)', margin: '10px 0' }} />
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '8px', textTransform: 'uppercase' }}>Por Nicho</div>
                    {Object.entries(crmLeads.perdaPorNicho).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([nicho, qtd], i) => (
                      <BarRow key={i} label={nicho} value={qtd} max={crmLeads.perdidos}
                        color="var(--yellow)" suffix={` perda${qtd>1?'s':''}`} />
                    ))}
                  </div>
                </>
              )}
            </Card>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Origem dos leads */}
              <Card>
                <SectionTitle icon="📡" title="Leads por Origem" />
                {Object.keys(crmLeads.origemMap).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text3)', fontSize: '12px' }}>Nenhum lead com origem registrada.</div>
                ) : (
                  Object.entries(crmLeads.origemMap).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([origem, qtd], i) => {
                    const corMap = { whatsapp:'var(--green)', instagram:'var(--pink)', indicacao:'var(--purple)', gmn:'var(--yellow)', telefone:'var(--accent)', site:'var(--cyan)' };
                    return (
                      <BarRow key={i} label={origem.charAt(0).toUpperCase() + origem.slice(1)}
                        value={qtd} max={crmLeads.total}
                        color={corMap[origem] || 'var(--text3)'} suffix={` (${Math.round((qtd/crmLeads.total)*100)}%)`} />
                    );
                  })
                )}
              </Card>

              {/* Leads estagnados — alerta */}
              <Card style={{ border: crmLeads.estagnados > 0 ? '1px solid rgba(239,68,68,0.4)' : '1px solid var(--border)' }}>
                <SectionTitle icon="⚠️" title="Alerta de Estagnação" />
                {crmLeads.estagnados === 0 ? (
                  <div style={{ color: 'var(--green)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    ✅ Todos os leads ativos foram contatados recentemente.
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--red)', fontFamily: "'DM Mono', monospace" }}>
                      {crmLeads.estagnados}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text2)', margin: '4px 0 12px' }}>
                      leads ativos sem nenhuma atualização há mais de 15 dias.
                      Eles representam {Math.round((crmLeads.estagnados / Math.max(crmLeads.ativos, 1)) * 100)}% dos leads em aberto.
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text3)', background: 'rgba(239,68,68,0.08)', padding: '10px', borderRadius: '8px' }}>
                      💡 <strong>Ação:</strong> Acesse a aba <strong>Leads</strong>, filtre por "último contato" e faça o acompanhamento dessas contas antes que esfriem definitivamente.
                    </div>
                  </>
                )}
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          ABA 4 — IA LEAD SCORING (DADOS REAIS)
         ════════════════════════════════════════════ */}
      {abaAtiva === 'scoring' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

            {/* Seletor */}
            <Card>
              <SectionTitle icon="🔍" title="Selecione um Lead" />
              <p style={{ fontSize: '12px', color: 'var(--text3)', margin: '0 0 12px 0', lineHeight: 1.4 }}>
                O algoritmo analisa os dados reais do lead no seu CRM e calcula a probabilidade de fechamento baseado em origem, estágio, dados de contato e recência.
              </p>
              <select value={leadId} onChange={e => setLeadId(e.target.value)} style={{
                width: '100%', padding: '10px 12px', borderRadius: '8px',
                background: 'var(--surface2)', border: '1px solid var(--border)',
                color: 'var(--text)', fontSize: '13px', outline: 'none', cursor: 'pointer', marginBottom: '14px'
              }}>
                <option value="">— selecione entre {leads.length} lead{leads.length !== 1 ? 's' : ''} —</option>
                {[...leads].sort((a,b) => (a.nome||'').localeCompare(b.nome||'')).map(l => (
                  <option key={l.id} value={l.id}>
                    {l.nome || 'Sem nome'} | {l.status} | {l.origem || 'sem origem'}
                  </option>
                ))}
              </select>

              {scored?.lead && (
                <div style={{ background: 'var(--surface2)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', marginBottom: '10px' }}>
                    {scored.lead.nome || 'Lead sem nome'}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '11px', color: 'var(--text2)' }}>
                    {[
                      ['Status', scored.lead.status],
                      ['Origem', scored.lead.origem || '—'],
                      ['Nicho', scored.lead.nicho || '—'],
                      ['Responsável', scored.lead.responsavel || '—'],
                      ['E-mail', scored.lead.email || '—'],
                      ['WhatsApp', scored.lead.whatsapp || scored.lead.telefone || '—'],
                      ['Decisor', scored.lead.decisor || '—'],
                      ['Reunião', scored.lead.reuniao || '—'],
                    ].map(([k, v], i) => (
                      <div key={i}><span style={{ color: 'var(--text3)' }}>{k}: </span>{v}</div>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {/* Resultado */}
            <Card style={{ border: `1px solid ${scored?.cor || 'var(--border)'}`, transition: 'border-color 0.3s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: scored?.cor || 'var(--text3)', textTransform: 'uppercase' }}>
                  {scored?.tier || 'Aguardando seleção'}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text3)', background: 'var(--surface2)', padding: '2px 8px', borderRadius: '6px' }}>
                  Baseado em dados reais do CRM
                </span>
              </div>

              {scored ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '8px 0' }}>
                    <span style={{ fontSize: '54px', fontWeight: 800, color: scored.cor, fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>
                      {scored.score}
                    </span>
                    <span style={{ fontSize: '14px', color: 'var(--text3)' }}>/ 100</span>
                  </div>

                  <div style={{ width: '100%', height: '8px', background: 'var(--surface2)', borderRadius: '4px', overflow: 'hidden', marginBottom: '14px' }}>
                    <div style={{ width: `${scored.score}%`, height: '100%', background: scored.cor, transition: 'width 0.5s ease', borderRadius: '4px' }} />
                  </div>

                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px 12px', borderRadius: '8px', fontSize: '12px', marginBottom: '14px', border: '1px solid var(--border)' }}>
                    <strong style={{ color: 'var(--text)' }}>Ação recomendada: </strong>
                    <span style={{ color: 'var(--text2)' }}>{scored.acao}</span>
                  </div>

                  <div style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                    Sinais analisados
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '200px', overflowY: 'auto' }}>
                    {scored.sinais.map((s, i) => (
                      <div key={i} style={{
                        fontSize: '11px', padding: '5px 8px', borderRadius: '6px',
                        background: s.t === '+' ? 'rgba(16,185,129,0.1)' : s.t === '-' ? 'rgba(239,68,68,0.1)' : 'var(--surface2)',
                        color: s.t === '+' ? 'var(--green)' : s.t === '-' ? 'var(--red)' : 'var(--text2)',
                        borderLeft: `2px solid ${s.t === '+' ? 'var(--green)' : s.t === '-' ? 'var(--red)' : 'var(--text3)'}`
                      }}>
                        {s.t === '+' ? '▲' : s.t === '-' ? '▼' : '●'} {s.txt}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text3)', fontSize: '13px' }}>
                  👈 Selecione um lead para ver o score preditivo
                </div>
              )}
            </Card>
          </div>

          {/* Visão geral de scores de todos os leads */}
          {leads.length > 0 && (
            <Card>
              <SectionTitle icon="📊" title="Distribuição de Score — Todos os Leads" />
              {(() => {
                const tiers = [
                  { label: '🔥 SQL (≥ 80)', min: 80, max: 101, cor: 'var(--green)' },
                  { label: '⚡ MQL Quente (65-79)', min: 65, max: 80, cor: 'var(--accent)' },
                  { label: '🔵 MQL Morno (45-64)', min: 45, max: 65, cor: 'var(--yellow)' },
                  { label: '❄️ Baixo Potencial (< 45)', min: 0, max: 45, cor: 'var(--red)' },
                ];

                // Calcular score simples para todos os leads (versão rápida)
                const scoresRapidos = leads.map(l => {
                  let p = 50;
                  if (['whatsapp','indicacao'].includes(l.origem)) p += 15;
                  else if (['instagram','site'].includes(l.origem)) p += 10;
                  else if (['gmn','telefone'].includes(l.origem)) p += 5;
                  if (['reuniao-marcada','contrato-realizado'].includes(l.status)) p += 30;
                  else if (l.status === 'contato-decisor') p += 20;
                  else if (['ligacao-feita','lead-qualificado'].includes(l.status)) p += 10;
                  else if (l.status === 'perda') p -= 40;
                  else if (l.status === 'nenhum') p -= 10;
                  if (l.email?.includes('@')) p += 5; else p -= 8;
                  if (l.whatsapp || l.telefone) p += 5; else p -= 5;
                  if (l.decisor) p += 8;
                  if (l.reuniao && l.reuniao >= new Date().toISOString().slice(0,10)) p += 10;
                  if (l.updatedAt) {
                    const d = Math.floor((Date.now() - new Date(l.updatedAt)) / 86400000);
                    if (d <= 2) p += 10; else if (d > 14) p -= 12;
                  } else p -= 10;
                  return Math.max(0, Math.min(100, p));
                });

                const total = scoresRapidos.length || 1;
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                    {tiers.map((tier, i) => {
                      const count = scoresRapidos.filter(s => s >= tier.min && s < tier.max).length;
                      const pct = Math.round((count / total) * 100);
                      return (
                        <div key={i} style={{ textAlign: 'center', padding: '16px', background: 'var(--surface2)', borderRadius: '12px', border: `1px solid var(--border)` }}>
                          <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '6px' }}>{tier.label}</div>
                          <div style={{ fontSize: '28px', fontWeight: 800, color: tier.cor, fontFamily: "'DM Mono', monospace" }}>{count}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>{pct}% dos leads</div>
                          <div style={{ height: '4px', background: 'var(--surface)', borderRadius: '2px', marginTop: '10px', overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: tier.cor }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </Card>
          )}
        </div>
      )}

    </div>
  );
}
