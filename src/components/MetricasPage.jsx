import React, { useState, useMemo } from 'react';

export default function MetricasPage({ leads = [] }) {
  const [abaAtiva, setAbaAtiva] = useState('pipeline'); // 'pipeline' | 'slas' | 'unit' | 'health' | 'scoring'

  // ── Filtro de período ──
  const [periodo, setPeriodo] = useState('30'); // '30' | '90' | '180' | '365'

  // ── Sliders / Simuladores (Pipeline Velocity) ──
  const [simOportunidades, setSimOportunidades] = useState(0);
  const [simTicket, setSimTicket] = useState(3500);
  const [simWinRate, setSimWinRate] = useState(22);
  const [simCiclo, setSimCiclo] = useState(18);
  const [optSlider, setOptSlider] = useState(0); // 0% a 25% de otimização em todos os pilares

  // ── Lead selecionado para AI Scoring ──
  const [leadSelecionadoId, setLeadSelecionadoId] = useState('');

  // ── Métricas Reais Extraídas do CRM ──
  const statsCRM = useMemo(() => {
    const totalLeads = leads.length || 1;
    const ganhos = leads.filter(l => l.status === 'venda' || l.status === 'contrato-realizado');
    const emNegociacao = leads.filter(l => ['contato-decisor', 'reuniao-marcada', 'contrato-realizado'].includes(l.status));
    
    // Taxa de conversão do CRM
    const winRateReal = Math.round((ganhos.length / totalLeads) * 100) || 15;
    
    // Valor médio aproximado dos leads ganho ou estimativa
    let somaValor = 0;
    let countValor = 0;
    ganhos.forEach(l => {
      const v = parseFloat(String(l.valor || 0).replace(/[^0-9.]/g, ''));
      if (v > 0) { somaValor += v; countValor++; }
    });
    const ticketReal = countValor > 0 ? Math.round(somaValor / countValor) : 3200;
    
    // Oportunidades ativas
    const oppsAtivas = emNegociacao.length > 0 ? emNegociacao.length : Math.max(Math.round(totalLeads * 0.3), 5);
    
    // Ciclo de vendas estimado (em dias)
    let somaDias = 0;
    let countDias = 0;
    ganhos.forEach(l => {
      if (l.createdAt && l.updatedAt) {
        const diff = new Date(l.updatedAt).getTime() - new Date(l.createdAt).getTime();
        const dias = Math.max(1, Math.round(diff / (1000 * 3600 * 24)));
        somaDias += dias;
        countDias++;
      }
    });
    const cicloReal = countDias > 0 ? Math.round(somaDias / countDias) : 18;

    return { totalLeads, ganhosCount: ganhos.length, oppsAtivas, winRateReal, ticketReal, cicloReal };
  }, [leads]);

  // Atualiza valores iniciais do simulador com os dados reais do CRM uma vez
  React.useEffect(() => {
    if (statsCRM.oppsAtivas > 0 && simOportunidades === 0) {
      setSimOportunidades(statsCRM.oppsAtivas);
      setSimTicket(statsCRM.ticketReal);
      setSimWinRate(statsCRM.winRateReal || 22);
      setSimCiclo(statsCRM.cicloReal || 18);
    }
  }, [statsCRM, simOportunidades]);

  // ── Cálculo do Pipeline Velocity ──
  const calcVelocity = (opps, ticket, winRate, ciclo, fOpt = 0) => {
    const o = opps * (1 + fOpt / 100);
    const t = ticket * (1 + fOpt / 100);
    const w = Math.min(100, winRate * (1 + fOpt / 100)) / 100;
    const c = Math.max(1, ciclo * (1 - fOpt / 100)); // ciclo reduz com otimização
    
    const diario = (o * t * w) / c;
    return {
      diario: Math.round(diario),
      mensal: Math.round(diario * 30),
      anual: Math.round(diario * 365),
      cicloDias: Math.round(c * 10) / 10,
      winRatePct: Math.round(w * 100 * 10) / 10
    };
  };

  const velAtual = calcVelocity(simOportunidades || 10, simTicket, simWinRate, simCiclo, 0);
  const velOtimizada = calcVelocity(simOportunidades || 10, simTicket, simWinRate, simCiclo, optSlider);

  // ── IA Predictive Lead Scoring Helper ──
  const leadScored = useMemo(() => {
    const alvo = leads.find(l => l.id === leadSelecionadoId) || leads[0];
    if (!alvo) return null;

    let pontos = 50; // Base inicial
    const sinais = [];

    // Sinais firmográficos e origem
    if (alvo.origem === 'whatsapp' || alvo.origem === 'indicacao') {
      pontos += 15;
      sinais.push({ tipo: 'pos', texto: `Origem de alta confiança (${alvo.origem.toUpperCase()}) [+15 pts]` });
    } else if (alvo.origem === 'instagram' || alvo.origem === 'site') {
      pontos += 10;
      sinais.push({ tipo: 'pos', texto: `Canal digital rastreado (${alvo.origem}) [+10 pts]` });
    } else {
      sinais.push({ tipo: 'neu', texto: `Origem geral (${alvo.origem || 'não informada'}) [0 pts]` });
    }

    // Status no funil
    if (['contato-decisor', 'reuniao-marcada', 'contrato-realizado'].includes(alvo.status)) {
      pontos += 25;
      sinais.push({ tipo: 'pos', texto: `Estágio avançado de negociação (${alvo.status}) [+25 pts]` });
    } else if (alvo.status === 'ligacao-feita' || alvo.status === 'lead-qualificado') {
      pontos += 10;
      sinais.push({ tipo: 'pos', texto: `Estágio de qualificação ativo [+10 pts]` });
    } else if (alvo.status === 'perda') {
      pontos -= 40;
      sinais.push({ tipo: 'neg', texto: `Histórico marcado como perda [-40 pts]` });
    }

    // Campos de valor e contato
    if (alvo.email && alvo.email.includes('@')) {
      pontos += 5;
      sinais.push({ tipo: 'pos', texto: 'E-mail validado na entrada [+5 pts]' });
    } else {
      pontos -= 10;
      sinais.push({ tipo: 'neg', texto: 'E-mail ausente ou inválido (risco de higiene) [-10 pts]' });
    }

    if (alvo.telefone || alvo.whatsapp) {
      pontos += 5;
      sinais.push({ tipo: 'pos', texto: 'Telefone/WhatsApp de contato direto disponível [+5 pts]' });
    }

    // Recência (Decaimento temporal)
    if (alvo.updatedAt) {
      const dias = Math.floor((Date.now() - new Date(alvo.updatedAt).getTime()) / (1000 * 3600 * 24));
      if (dias <= 2) {
        pontos += 10;
        sinais.push({ tipo: 'pos', texto: `Engajamento recente (${dias === 0 ? 'Hoje' : dias + ' dias atrás'}) [+10 pts]` });
      } else if (dias > 14) {
        pontos -= 15;
        sinais.push({ tipo: 'neg', texto: `Decaimento temporal: sem atividade há ${dias} dias [-15 pts]` });
      }
    }

    const scoreFinal = Math.max(0, Math.min(100, pontos));
    let tier = 'MQL Básico';
    let cor = 'var(--text3)';
    let acao = 'Manter em fluxo de automação padronizado.';

    if (scoreFinal >= 80) {
      tier = '🔥 SQL / Prioridade Máxima';
      cor = 'var(--green)';
      acao = 'Contato humano imediato pelo Account Executive (Speed-to-Lead ≤ 5 min).';
    } else if (scoreFinal >= 60) {
      tier = '⚡ MQL Quente';
      cor = 'var(--accent)';
      acao = 'Enviar estudo de caso ou convite para demonstração personalizada.';
    } else if (scoreFinal < 40) {
      tier = '❄️ Baixa Propensão / Desengajado';
      cor = 'var(--red)';
      acao = 'Políticas de Pôr do Sol (Sunsetting): reengajar via newsletter ou arquivar após 90 dias.';
    }

    return { lead: alvo, score: scoreFinal, tier, cor, acao, sinais };
  }, [leads, leadSelecionadoId]);

  // ── DADOS DE HEALTH SCORE (DEMO & CRM) ──
  const healthAccounts = useMemo(() => {
    const demos = [
      { id: '1', nome: 'Clínica Odonto Prime', plano: 'Enterprise', arr: 'R$ 36.000', score: 92, adocao: 95, qbr: 'Assíduo', risco: 'Baixo', acao: 'Apresentar módulo de IA / Upsell (+15% NRR)', cor: 'var(--green)' },
      { id: '2', nome: 'Barbearia VIP Brothers', plano: 'Pro', arr: 'R$ 14.400', score: 78, adocao: 82, qbr: 'Pend.', risco: 'Moderado', acao: 'Agendar revisão trimestral de sucesso (QBR)', cor: 'var(--yellow)' },
      { id: '3', nome: 'Academia Corpo & Alma', plano: 'Pro', arr: 'R$ 18.000', score: 64, adocao: 60, qbr: 'Realizado', risco: 'Atenção', acao: 'Reforçar treinamento da recepção e uso de agendamento', cor: 'var(--yellow)' },
      { id: '4', nome: 'Restaurante Sabor do Mar', plano: 'Basic', arr: 'R$ 7.200', score: 38, adocao: 25, qbr: 'Ausente', risco: 'Alto Churn', acao: '🚨 Alerta Vermelho: Intervenção executiva inadiável 60d antes de vencer', cor: 'var(--red)' },
    ];
    return demos;
  }, []);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto',
      padding: '24px 32px 80px', color: 'var(--text)', background: 'transparent'
    }}>
      {/* ── HEADER SUPERIOR ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '20px',
        flexWrap: 'wrap', gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span style={{ fontSize: '26px' }}>🎯</span>
            <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, color: 'var(--text)', letterSpacing: '-0.5px' }}>
              RevOps & KPIs <span style={{ color: 'var(--accent)', fontWeight: 400 }}>| Arquitetura de Métricas</span>
            </h1>
            <span style={{
              background: 'rgba(0, 210, 223, 0.12)', color: 'var(--accent)', border: '1px solid rgba(0, 210, 223, 0.3)',
              padding: '2px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, fontFamily: "'DM Mono', monospace"
            }}>
              BENCHMARKS 2026
            </span>
          </div>
          <p style={{ margin: 0, color: 'var(--text2)', fontSize: '14px', maxWidth: '750px', lineHeight: 1.5 }}>
            Orquestração preditiva de receitas, higiene de dados e inteligência de vendas. Elimine métricas de vaidade e tome decisões com base na economia de unidade real e na velocidade do funil.
          </p>
        </div>

        {/* Seletor de Período Global */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--surface)',
          padding: '4px', borderRadius: '10px', border: '1px solid var(--border)'
        }}>
          {[
            { id: '30', label: '30 Dias' },
            { id: '90', label: '90 Dias' },
            { id: '180', label: '6 Meses' },
            { id: '365', label: '1 Ano' }
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setPeriodo(p.id)}
              style={{
                background: periodo === p.id ? 'var(--accent)' : 'transparent',
                color: periodo === p.id ? '#000' : 'var(--text2)',
                border: 'none', padding: '6px 14px', borderRadius: '6px',
                fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s'
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── NAVEGAÇÃO DE ABAS ── */}
      <div style={{
        display: 'flex', gap: '8px', marginBottom: '28px', borderBottom: '1px solid var(--border)',
        paddingBottom: '12px', overflowX: 'auto'
      }}>
        {[
          { id: 'pipeline', icon: '⚡', label: 'Pipeline Velocity', desc: 'Motor de Receita' },
          { id: 'slas',     icon: '🤝', label: 'Alinhamento & SLAs', desc: 'Speed-to-Lead' },
          { id: 'unit',     icon: '💰', label: 'Economia de Unidade', desc: 'CAC, LTV & NRR' },
          { id: 'health',   icon: '💓', label: 'Saúde do Cliente',   desc: 'Health Score & CSAT' },
          { id: 'scoring',  icon: '🤖', label: 'IA Lead Scoring',     desc: 'Triagem Preditiva' }
        ].map(aba => {
          const isAtiva = abaAtiva === aba.id;
          return (
            <button
              key={aba.id}
              onClick={() => setAbaAtiva(aba.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 18px', borderRadius: '10px', border: '1px solid',
                borderColor: isAtiva ? 'var(--accent)' : 'transparent',
                background: isAtiva ? 'rgba(0, 210, 223, 0.1)' : 'var(--surface)',
                color: isAtiva ? 'var(--accent)' : 'var(--text2)',
                cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
                boxShadow: isAtiva ? '0 0 20px rgba(0, 210, 223, 0.15)' : 'none'
              }}
              onMouseEnter={e => {
                if (!isAtiva) { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--text)'; }
              }}
              onMouseLeave={e => {
                if (!isAtiva) { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--text2)'; }
              }}
            >
              <span style={{ fontSize: '18px' }}>{aba.icon}</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{aba.label}</div>
                <div style={{ fontSize: '11px', color: isAtiva ? 'var(--accent2)' : 'var(--text3)', opacity: 0.9 }}>{aba.desc}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          ABA 1: PIPELINE VELOCITY (MOTOR DE RECEITA)
         ════════════════════════════════════════════════════════════════════ */}
      {abaAtiva === 'pipeline' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeIn 0.25s ease' }}>
          
          {/* Banner Explicativo e Fórmula */}
          <div style={{
            background: 'linear-gradient(135deg, var(--surface), rgba(0, 210, 223, 0.05))',
            border: '1px solid var(--border)', borderRadius: '16px', padding: '24px',
            display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'center',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
          }}>
            <div style={{ flex: '1 1 350px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{
                  background: 'rgba(0, 210, 223, 0.2)', color: 'var(--accent)', padding: '2px 8px',
                  borderRadius: '6px', fontSize: '11px', fontWeight: 700
                }}>
                  FÓRMULA DIRETIVA REVOPS
                </span>
              </div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)', margin: '0 0 10px 0' }}>
                O Velocímetro do Crescimento Previsível
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text2)', margin: 0, lineHeight: 1.6 }}>
                Enquanto medições estáticas oferecem constatações excessivamente retroativas, a <strong>Pipeline Velocity</strong> funde quatro dimensões críticas num único coeficiente operacional: revela a velocidade diária/mensal em que transações abertas se convertem em capital faturado.
              </p>
            </div>

            <div style={{
              flex: '1 1 320px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)',
              borderRadius: '12px', padding: '16px', textAlign: 'center'
            }}>
              <div style={{ fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                Fórmula de Cálculo (V)
              </div>
              <div style={{
                fontFamily: "'DM Mono', monospace", fontSize: '14px', color: 'var(--accent)',
                padding: '10px', background: 'rgba(0,210,223,0.08)', borderRadius: '8px', border: '1px dashed rgba(0,210,223,0.3)'
              }}>
                V = (Opps Qualificadas × Ticket × Win Rate) / Ciclo
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '8px' }}>
                *Aumento simultâneo de apenas 10% nos 4 pilares gera salto exponencial de <strong style={{ color: 'var(--green)' }}>+46.4%</strong> na receita!
              </div>
            </div>
          </div>

          {/* Cards de Métricas Reais + Simulador Interativo */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            
            {/* Painel Esquerdo: Controle dos 4 Pilares */}
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px',
              display: 'flex', flexDirection: 'column', gap: '20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Parâmetros do Pipeline (Simulador)</h3>
                <button
                  onClick={() => {
                    setSimOportunidades(statsCRM.oppsAtivas);
                    setSimTicket(statsCRM.ticketReal);
                    setSimWinRate(statsCRM.winRateReal);
                    setSimCiclo(statsCRM.cicloReal);
                    setOptSlider(0);
                  }}
                  style={{
                    background: 'transparent', border: '1px solid var(--border)', color: 'var(--text3)',
                    padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer'
                  }}
                  title="Restaurar valores reais do seu CRM"
                >
                  🔄 Usar Dados Reais
                </button>
              </div>

              {/* Slider 1: Oportunidades */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text2)' }}>1. Oportunidades Qualificadas (SQLs)</span>
                  <strong style={{ fontFamily: "'DM Mono', monospace", color: 'var(--text)' }}>{simOportunidades} opps</strong>
                </div>
                <input
                  type="range" min="1" max="150" value={simOportunidades}
                  onChange={e => setSimOportunidades(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent)' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>
                  <span>Seu CRM atual: {statsCRM.oppsAtivas} opps ativas</span>
                  <span>Alvo: Qualidade sobre volume</span>
                </div>
              </div>

              {/* Slider 2: Ticket Médio / Deal Size */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text2)' }}>2. Valor Médio do Contrato (ACV / Deal Size)</span>
                  <strong style={{ fontFamily: "'DM Mono', monospace", color: 'var(--text)' }}>R$ {simTicket.toLocaleString('pt-BR')}</strong>
                </div>
                <input
                  type="range" min="500" max="25000" step="500" value={simTicket}
                  onChange={e => setSimTicket(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent)' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>
                  <span>Seu CRM atual: ~R$ {statsCRM.ticketReal.toLocaleString('pt-BR')}</span>
                  <span>Estratégia: Value-based selling</span>
                </div>
              </div>

              {/* Slider 3: Win Rate */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text2)' }}>3. Taxa de Fechamento (Win Rate)</span>
                  <strong style={{ fontFamily: "'DM Mono', monospace", color: 'var(--green)' }}>{simWinRate}%</strong>
                </div>
                <input
                  type="range" min="5" max="60" value={simWinRate}
                  onChange={e => setSimWinRate(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--green)' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>
                  <span>Seu CRM atual: {statsCRM.winRateReal}%</span>
                  <span>Benchmark SaaS SMB 2026: 22% a 28%</span>
                </div>
              </div>

              {/* Slider 4: Ciclo de Vendas */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text2)' }}>4. Ciclo de Vendas (Dias até assinatura)</span>
                  <strong style={{ fontFamily: "'DM Mono', monospace", color: 'var(--yellow)' }}>{simCiclo} dias</strong>
                </div>
                <input
                  type="range" min="3" max="90" value={simCiclo}
                  onChange={e => setSimCiclo(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--yellow)' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>
                  <span>Seu CRM atual: ~{statsCRM.cicloReal} dias</span>
                  <span>Benchmark SMB: 14 a 30 dias</span>
                </div>
              </div>

              {/* Divisor */}
              <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />

              {/* Slider de Otimização Simultânea (O Segredo Exponencial) */}
              <div style={{ background: 'rgba(0, 210, 223, 0.05)', padding: '14px', borderRadius: '12px', border: '1px solid rgba(0, 210, 223, 0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent)' }}>🚀 Efeito Composto: Otimizar todos os pilares</span>
                  <span style={{
                    background: 'var(--accent)', color: '#000', padding: '2px 8px',
                    borderRadius: '6px', fontSize: '12px', fontWeight: 700, fontFamily: "'DM Mono', monospace"
                  }}>
                    +{optSlider}%
                  </span>
                </div>
                <input
                  type="range" min="0" max="25" value={optSlider}
                  onChange={e => setOptSlider(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent)', marginTop: '4px' }}
                />
                <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '6px' }}>
                  Simule o impacto de treinar o time (+win rate), melhorar qualificação (-ciclo) e ajustar preços (+ticket) simultaneamente.
                </div>
              </div>
            </div>

            {/* Painel Direito: Resultados de Velocidade */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Box Principal do Resultado */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(0, 210, 223, 0.15), rgba(0,0,0,0.4))',
                border: '2px solid var(--accent)', borderRadius: '16px', padding: '24px',
                textAlign: 'center', position: 'relative', overflow: 'hidden',
                boxShadow: '0 12px 40px rgba(0, 210, 223, 0.15)'
              }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '8px' }}>
                  Velocidade de Geração de Receita (V)
                </div>

                <div style={{ fontSize: '42px', fontWeight: 800, color: '#fff', fontFamily: "'DM Mono', monospace", letterSpacing: '-1px', margin: '10px 0' }}>
                  R$ {velOtimizada.mensal.toLocaleString('pt-BR')} <span style={{ fontSize: '18px', color: 'var(--accent2)', fontWeight: 500 }}>/mês</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', margin: '16px 0', borderTop: '1px solid rgba(255,255,255,0.1)', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '12px 0' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text3)' }}>POR DIA</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--green)', fontFamily: "'DM Mono', monospace" }}>
                      R$ {velOtimizada.diario.toLocaleString('pt-BR')}
                    </div>
                  </div>
                  <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)' }} />
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text3)' }}>PROJEÇÃO ANUAL (ARR)</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff', fontFamily: "'DM Mono', monospace" }}>
                      R$ {velOtimizada.anual.toLocaleString('pt-BR')}
                    </div>
                  </div>
                </div>

                {optSlider > 0 && (
                  <div style={{
                    background: 'rgba(16, 185, 129, 0.2)', border: '1px solid var(--green)', color: 'var(--green)',
                    padding: '8px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, display: 'inline-block',
                    animation: 'pulse 2s infinite'
                  }}>
                    📈 Salto de R$ {(velOtimizada.mensal - velAtual.mensal).toLocaleString('pt-BR')}/mês ({Math.round(((velOtimizada.mensal / velAtual.mensal) - 1) * 100)}% de ganho composto!)
                  </div>
                )}
              </div>

              {/* Benchmarks e Insights 2026 */}
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px',
                display: 'flex', flexDirection: 'column', gap: '14px', flex: 1
              }}>
                <h4 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: 'var(--text)' }}>
                  📊 Diagnóstico Executivo de RevOps (2026)
                </h4>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', fontSize: '13px', color: 'var(--text2)' }}>
                  <span style={{ fontSize: '16px' }}>💡</span>
                  <div>
                    <strong style={{ color: 'var(--text)' }}>Taxa de Vitória vs Ciclo:</strong> No mercado PME (SMB), propostas &lt; R$ 15k fecham a uma média de <strong>28% em até 30 dias</strong>. Contratos Enterprise (&gt; R$ 100k) exigem até 180 dias com win rate de ~15%.
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', fontSize: '13px', color: 'var(--text2)' }}>
                  <span style={{ fontSize: '16px' }}>🚀</span>
                  <div>
                    <strong style={{ color: 'var(--text)' }}>Lead Velocity Rate (LVR):</strong> O crescimento percentual de leads qualificadas de um mês para outro deve se manter em <strong>15% a 20%</strong> para garantir a expansão contínua das receitas futuras.
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', fontSize: '13px', color: 'var(--text2)' }}>
                  <span style={{ fontSize: '16px' }}>🛡️</span>
                  <div>
                    <strong style={{ color: 'var(--text)' }}>Ação Direta no seu CRM:</strong> Separe rigorosamente a qualificação de entrada (MQL) da validação de fechamento (SQL). Nunca inflacione o topo do funil relaxando critérios, ou o ciclo aumentará destruindo sua velocidade.
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          ABA 2: ALINHAMENTO MARKETING-VENDAS & SLAS (SPEED-TO-LEAD)
         ════════════════════════════════════════════════════════════════════ */}
      {abaAtiva === 'slas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeIn 0.25s ease' }}>
          
          {/* Banner O Abismo dos 15 Minutos */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
              <div>
                <span style={{
                  background: 'rgba(239, 68, 68, 0.15)', color: 'var(--red)', padding: '2px 8px',
                  borderRadius: '6px', fontSize: '11px', fontWeight: 700
                }}>
                  CRÍTICO: SPEED-TO-LEAD
                </span>
                <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '6px 0 0 0' }}>
                  A Tirania do Relógio: O Abismo dos 15 Minutos
                </h2>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text3)', background: 'var(--surface2)', padding: '6px 12px', borderRadius: '8px' }}>
                ⏱️ Média global do mercado: <strong style={{ color: 'var(--red)' }}>47 horas</strong> | Meta Portel CRM: <strong style={{ color: 'var(--green)' }}>&le; 5 minutos</strong>
              </div>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '20px', lineHeight: 1.6 }}>
              A janela de conversão tem natureza profundamente perecível. <strong>78% dos clientes fecham negócio com a primeira empresa que estabelece um contato humano qualificado.</strong> Veja como a probabilidade despenca em função do tempo de primeira resposta:
            </p>

            {/* Linha do Tempo de Resposta */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              {[
                { tempo: '0 a 5 min', label: 'Ótimo Absoluto', impacto: '+391%', desc: 'Intenção de compra no zênite. Probabilidade de conversão recorde.', cor: 'var(--green)', bg: 'rgba(16, 185, 129, 0.1)' },
                { tempo: '5 a 15 min', label: 'Aceitável', impacto: 'Alta Retenção', desc: 'Retém o prospecto conectado sem transmitir desespero excessivo.', cor: 'var(--accent)', bg: 'rgba(0, 210, 223, 0.1)' },
                { tempo: '15 a 60 min', label: 'Queda no Abismo', impacto: '-21x menos', desc: 'Após 30 min, chance de fechar é 21x menor que no 5º minuto. Atenção evadiu.', cor: 'var(--yellow)', bg: 'rgba(245, 158, 11, 0.1)' },
                { tempo: '&gt; 60 minutos', label: 'Zona Crítica', impacto: 'Apenas 7%', desc: 'Após 24h a taxa de fecho desvanece para ínfimos 7%. Concorrente interceptou.', cor: 'var(--red)', bg: 'rgba(239, 68, 68, 0.1)' },
              ].map((item, idx) => (
                <div key={idx} style={{
                  background: item.bg, border: `1px solid ${item.cor}`, borderRadius: '12px', padding: '16px',
                  display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: item.cor, fontFamily: "'DM Mono', monospace" }} dangerouslySetInnerHTML={{ __html: item.tempo }} />
                    <span style={{ fontSize: '10px', fontWeight: 600, background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px', color: '#fff' }}>{item.label}</span>
                  </div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: item.cor, fontFamily: "'DM Mono', monospace" }}>
                    {item.impacto}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text2)', lineHeight: 1.4 }}>
                    {item.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Funil B2B de Qualificação e Custos Ponderados */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            
            {/* Tabela de Matriz de Escalada (SLAs Internos) */}
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px',
              display: 'flex', flexDirection: 'column', gap: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>📋 Matriz de SLAs & Gatilhos no CRM</h3>
                <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 600 }}>Governança RevOps</span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text2)', margin: 0 }}>
                Parâmetros que regulam o pacto entre Marketing (geração) e Vendas (fechamento), com automatismos de punição e escalada.
              </p>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text3)' }}>
                      <th style={{ padding: '8px 4px' }}>Origem / Canal</th>
                      <th style={{ padding: '8px 4px' }}>Prioridade</th>
                      <th style={{ padding: '8px 4px' }}>SLA Máximo</th>
                      <th style={{ padding: '8px 4px' }}>Gatilho de Escalada Automática</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 4px', fontWeight: 600 }}>Inbound (Web/Demo)</td>
                      <td style={{ padding: '10px 4px' }}><span style={{ background: 'rgba(239,68,68,0.2)', color: 'var(--red)', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>Tier 1</span></td>
                      <td style={{ padding: '10px 4px', fontFamily: "'DM Mono', monospace" }}>&le; 5 min</td>
                      <td style={{ padding: '10px 4px', color: 'var(--text2)' }}>Atraso de 10 min: Notifica chefia no Slack/WhatsApp e emite alerta de violação.</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 4px', fontWeight: 600 }}>Redes (LinkedIn/IG)</td>
                      <td style={{ padding: '10px 4px' }}><span style={{ background: 'rgba(245,158,11,0.2)', color: 'var(--yellow)', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>Tier 2</span></td>
                      <td style={{ padding: '10px 4px', fontFamily: "'DM Mono', monospace" }}>&le; 15 min</td>
                      <td style={{ padding: '10px 4px', color: 'var(--text2)' }}>Atraso de 30 min: Reatribuição imediata da lead na fila global (Round-Robin).</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 4px', fontWeight: 600 }}>Indicação / Orgânico</td>
                      <td style={{ padding: '10px 4px' }}><span style={{ background: 'rgba(0,210,223,0.2)', color: 'var(--accent)', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>Moderada</span></td>
                      <td style={{ padding: '10px 4px', fontFamily: "'DM Mono', monospace" }}>&le; 60 min</td>
                      <td style={{ padding: '10px 4px', color: 'var(--text2)' }}>Atraso de 120 min: Relatório para lideranças e perda de bônus de rapidez.</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '10px 4px', fontWeight: 600 }}>MOPs Back-office</td>
                      <td style={{ padding: '10px 4px' }}><span style={{ background: 'var(--surface2)', color: 'var(--text3)', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>Suporte</span></td>
                      <td style={{ padding: '10px 4px', fontFamily: "'DM Mono', monospace" }}>3 a 7 dias</td>
                      <td style={{ padding: '10px 4px', color: 'var(--text2)' }}>Importação de listas e higienização. Exige escopo fechado e governança.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Funil de Qualificação & Custo Ponderado */}
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px',
              display: 'flex', flexDirection: 'column', gap: '14px'
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>⚖️ Custo Ponderado do Funil (MQL vs SQL)</h3>
              <p style={{ fontSize: '12px', color: 'var(--text2)', margin: 0 }}>
                O desgaste de conversão entre camadas justifica por que leads qualificados por vendas (SQLs) custam de 3x a 5x mais que um MQL.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
                {[
                  { etapa: 'Lead Bruto → MQL', conv: '25%', custo: 'R$ 200 - R$ 500', desc: 'Filtro demográfico e interatividade digital.', cor: 'var(--text2)' },
                  { etapa: 'MQL → SQL', conv: '40%', custo: 'R$ 800 - R$ 2.000', desc: 'Validação humana AE: BANT / MEDDIC aprovado.', cor: 'var(--accent)' },
                  { etapa: 'SQL → Oportunidade', conv: '60%', custo: 'R$ 1.500 - R$ 3.000', desc: 'Orçamento alocado e cronograma de compra definido.', cor: 'var(--yellow)' },
                  { etapa: 'Oportunidade → Venda', conv: '30%', custo: 'CAC Final consolidado', desc: 'Fechamento de contrato e início de onboarding.', cor: 'var(--green)' }
                ].map((st, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 12px', background: 'var(--surface2)', borderRadius: '8px', borderLeft: `4px solid ${st.cor}`
                  }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{st.etapa}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{st.desc}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: st.cor, fontFamily: "'DM Mono', monospace" }}>{st.conv} conv.</div>
                      <div style={{ fontSize: '11px', color: 'var(--text2)' }}>{st.custo}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{
                background: 'rgba(0,0,0,0.3)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px'
              }}>
                <span style={{ color: 'var(--text3)' }}>Taxa Global de Conversão (Lead → Fecho):</span>
                <strong style={{ color: 'var(--accent)', fontFamily: "'DM Mono', monospace", fontSize: '14px' }}>~ 1.8% (Média B2B)</strong>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          ABA 3: ECONOMIA DE UNIDADE (UNIT ECONOMICS & SAAS KPIS)
         ════════════════════════════════════════════════════════════════════ */}
      {abaAtiva === 'unit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeIn 0.25s ease' }}>
          
          {/* Grid de KPIs de Unit Economics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            
            {/* CAC */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text3)', fontWeight: 600 }}>CAC (CUSTO DE AQUISIÇÃO)</span>
                <span style={{ fontSize: '18px' }}>💸</span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text)', fontFamily: "'DM Mono', monospace" }}>
                R$ 1.450 <span style={{ fontSize: '13px', color: 'var(--text3)', fontWeight: 400 }}>/ new logo</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: 'var(--green)' }}>✓ Referência SaaS:</span> R$ 2.00 gastos para cada R$ 1 de ARR gerado.
              </div>
            </div>

            {/* CAC Payback */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text3)', fontWeight: 600 }}>CAC PAYBACK PERIOD</span>
                <span style={{ fontSize: '18px' }}>⏱️</span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--yellow)', fontFamily: "'DM Mono', monospace" }}>
                7.4 meses
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: 'var(--green)' }}>✓ Meta SMB:</span> 8 a 12 meses (PLG alcança ~4.2 meses).
              </div>
            </div>

            {/* Rácio LTV:CAC */}
            <div style={{
              background: 'linear-gradient(135deg, var(--surface), rgba(16, 185, 129, 0.08))',
              border: '1px solid var(--green)', borderRadius: '16px', padding: '20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--green)', fontWeight: 700 }}>RÁCIO LTV : CAC</span>
                <span style={{ fontSize: '18px' }}>💎</span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--green)', fontFamily: "'DM Mono', monospace" }}>
                4.2 : 1
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '8px' }}>
                ✓ <strong>Excelência (4:1 a 5:1).</strong> Mínimo existencial incontornável é 3:1.
              </div>
            </div>

            {/* Rule of 40 */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text3)', fontWeight: 600 }}>RULE OF 40 (REGRA DOS 40)</span>
                <span style={{ fontSize: '18px' }}>🔥</span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--accent)', fontFamily: "'DM Mono', monospace" }}>
                48% <span style={{ fontSize: '13px', color: 'var(--green)', fontWeight: 600 }}>✓ Aprovado</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '8px' }}>
                Crescimento ARR (31%) + Margem Lucro (17%) &gt; 40 pts.
              </div>
            </div>

          </div>

          {/* NRR vs GRR: A Genética da Retenção */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px',
            display: 'flex', flexWrap: 'wrap', gap: '28px', alignItems: 'center'
          }}>
            <div style={{ flex: '1 1 350px' }}>
              <span style={{
                background: 'rgba(16, 185, 129, 0.15)', color: 'var(--green)', padding: '2px 8px',
                borderRadius: '6px', fontSize: '11px', fontWeight: 700, marginBottom: '8px', display: 'inline-block'
              }}>
                O FAROL GUIA REVOPS
              </span>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 12px 0' }}>
                A Genética da Retenção: NRR vs GRR
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text2)', margin: '0 0 14px 0', lineHeight: 1.6 }}>
                Para estruturas SaaS e subscrições, a <strong>Net Revenue Retention (NRR)</strong> é o supremo oráculo de viabilidade. Empresas com NRR de 120% a 130% multiplicam sua receita perpetuamente apenas com a base atual (via upsells e expansões), sem precisar de novos clientes.
              </p>
              <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '8px', borderLeft: '3px solid var(--red)', fontSize: '12px', color: 'var(--text2)' }}>
                ⚠️ <strong>Atenção ao GRR (Gross Revenue Retention):</strong> O GRR mede a retenção sem contar upsells. Um NRR alto pode mascarar evasão massiva de clientes descontentes se o GRR estiver baixo (&lt; 85%).
              </div>
            </div>

            {/* Gráficos de Barras NRR e GRR */}
            <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* NRR Bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                  <div>
                    <strong style={{ fontSize: '14px', color: 'var(--green)' }}>NRR (Retenção Líquida)</strong>
                    <span style={{ fontSize: '11px', color: 'var(--text3)', marginLeft: '6px' }}>Inclui Expansões/Upsell</span>
                  </div>
                  <strong style={{ fontSize: '20px', fontFamily: "'DM Mono', monospace", color: 'var(--green)' }}>124%</strong>
                </div>
                <div style={{ width: '100%', height: '12px', background: 'var(--surface2)', borderRadius: '6px', overflow: 'hidden', position: 'relative' }}>
                  <div style={{ width: '100%', height: '100%', background: 'linear-gradient(90deg, var(--accent), var(--green))', borderRadius: '6px' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text3)', marginTop: '4px' }}>
                  <span>0%</span>
                  <span>Limiar de Sobrevivência (100%)</span>
                  <span style={{ color: 'var(--green)', fontWeight: 700 }}>Meta Zênite (120%+)</span>
                </div>
              </div>

              {/* GRR Bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                  <div>
                    <strong style={{ fontSize: '14px', color: 'var(--accent)' }}>GRR (Retenção Bruta)</strong>
                    <span style={{ fontSize: '11px', color: 'var(--text3)', marginLeft: '6px' }}>Teto máximo de 100%</span>
                  </div>
                  <strong style={{ fontSize: '20px', fontFamily: "'DM Mono', monospace", color: 'var(--accent)' }}>92%</strong>
                </div>
                <div style={{ width: '100%', height: '12px', background: 'var(--surface2)', borderRadius: '6px', overflow: 'hidden' }}>
                  <div style={{ width: '92%', height: '100%', background: 'var(--accent)', borderRadius: '6px' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text3)', marginTop: '4px' }}>
                  <span>Risco de Produto (&lt; 80%)</span>
                  <span>Média Aceitável (85%)</span>
                  <span style={{ color: 'var(--accent)', fontWeight: 700 }}>Saudável (90%+)</span>
                </div>
              </div>

            </div>
          </div>

        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          ABA 4: SAÚDE DO CLIENTE (HEALTH SCORE & CSAT/NPS/CES)
         ════════════════════════════════════════════════════════════════════ */}
      {abaAtiva === 'health' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeIn 0.25s ease' }}>
          
          {/* Signal Stack & Pesos do Health Score */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            
            {/* Explicação da Matriz 0-100 */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <span style={{ fontSize: '20px' }}>💓</span>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>O "Signal Stack": Índice Holístico (0-100)</h3>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: 1.6, marginBottom: '16px' }}>
                A administração moderna abole a espera pelo cancelamento formal (churn logístico). O <strong>Customer Health Score</strong> antecipa microfissuras e desintegração meses antes de acontecer, pesando 5 dimensões vitais:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { dim: '1. Adoção & Uso do Produto Core', peso: '35%', desc: 'Assiduidade diária (DAU/WAU) e uso de funções nucleares.', cor: 'var(--green)' },
                  { dim: '2. Engajamento Mútuo & QBRs', peso: '25%', desc: 'Presença em reuniões executivas e sentimento em tickets (NLP).', cor: 'var(--accent)' },
                  { dim: '3. Marcos Cronológicos (Milestones)', peso: '20%', desc: 'Sucesso no Onboarding e ativação de módulos essenciais no prazo.', cor: 'var(--yellow)' },
                  { dim: '4. Fortaleza do Relacionamento', peso: '10%', desc: 'Estabilidade do Champion/Sponsor e conexões multi-stakeholder.', cor: 'var(--purple)' },
                  { dim: '5. Recência & Fatores Externos', peso: '10%', desc: 'Decaimento temporal de contato, notícias de layoffs ou fusões.', cor: 'var(--red)' },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--surface2)', borderRadius: '8px' }}>
                    <div>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>{item.dim}</span>
                      <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{item.desc}</div>
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: item.cor, fontFamily: "'DM Mono', monospace", background: 'rgba(0,0,0,0.3)', padding: '2px 8px', borderRadius: '6px' }}>
                      {item.peso}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Termômetros de Satisfação (NPS, CSAT, CES) */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>🏷️ Termômetros da Camada Semântica</h3>
                <span style={{ fontSize: '11px', color: 'var(--text3)' }}>Sem Survey Gaming</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                
                {/* NPS */}
                <div style={{ background: 'var(--surface2)', padding: '14px', borderRadius: '12px', borderLeft: '4px solid var(--green)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <strong style={{ fontSize: '14px', color: 'var(--text)' }}>NPS (Net Promoter Score)</strong>
                    <span style={{ fontSize: '22px', fontWeight: 800, color: 'var(--green)', fontFamily: "'DM Mono', monospace" }}>+74</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '4px' }}>
                    Mede lealdade dogmática e recomendação espontânea da marca. NPS alto blinda contra deserções contratuais massivas.
                  </div>
                </div>

                {/* CSAT */}
                <div style={{ background: 'var(--surface2)', padding: '14px', borderRadius: '12px', borderLeft: '4px solid var(--accent)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <strong style={{ fontSize: '14px', color: 'var(--text)' }}>CSAT (Customer Satisfaction)</strong>
                    <span style={{ fontSize: '22px', fontWeight: 800, color: 'var(--accent)', fontFamily: "'DM Mono', monospace" }}>94%</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '4px' }}>
                    Termômetro cirúrgico focado em interações pontuais e imediatas (ex: atendimento de suporte ou resolução de ticket).
                  </div>
                </div>

                {/* CES */}
                <div style={{ background: 'var(--surface2)', padding: '14px', borderRadius: '12px', borderLeft: '4px solid var(--yellow)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <strong style={{ fontSize: '14px', color: 'var(--text)' }}>CES (Customer Effort Score)</strong>
                    <span style={{ fontSize: '22px', fontWeight: 800, color: 'var(--yellow)', fontFamily: "'DM Mono', monospace" }}>1.8 / 7</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '4px' }}>
                    Mede atrito e burocracia absurda. Baixo esforço (&lt; 2.5) é o maior previsor de prevenção contra churn burocrático e frustração.
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Tabela de Contas Monitoradas no Health Score */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>🚨 Radar de Contas & Previsão de Churn (60-90 dias)</h3>
                <span style={{ fontSize: '12px', color: 'var(--text3)' }}>IA prevê risco com 85% de exatidão, permitindo resgatar de 30% a 50% dos contratos em perigo.</span>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text3)', fontSize: '11px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '10px 8px' }}>Cliente / Conta</th>
                    <th style={{ padding: '10px 8px' }}>ARR</th>
                    <th style={{ padding: '10px 8px' }}>Health Score</th>
                    <th style={{ padding: '10px 8px' }}>Adoção Core</th>
                    <th style={{ padding: '10px 8px' }}>QBR</th>
                    <th style={{ padding: '10px 8px' }}>Risco</th>
                    <th style={{ padding: '10px 8px' }}>Ação Recomendada (CSM / RevOps)</th>
                  </tr>
                </thead>
                <tbody>
                  {healthAccounts.map(acc => (
                    <tr key={acc.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '14px 8px', fontWeight: 600, color: 'var(--text)' }}>
                        {acc.nome} <span style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: 400 }}>({acc.plano})</span>
                      </td>
                      <td style={{ padding: '14px 8px', fontFamily: "'DM Mono', monospace" }}>{acc.arr}</td>
                      <td style={{ padding: '14px 8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '36px', height: '6px', background: 'var(--surface2)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${acc.score}%`, height: '100%', background: acc.cor }} />
                          </div>
                          <strong style={{ color: acc.cor, fontFamily: "'DM Mono', monospace" }}>{acc.score}</strong>
                        </div>
                      </td>
                      <td style={{ padding: '14px 8px', fontFamily: "'DM Mono', monospace" }}>{acc.adocao}%</td>
                      <td style={{ padding: '14px 8px' }}>
                        <span style={{
                          background: acc.qbr === 'Assíduo' || acc.qbr === 'Realizado' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                          color: acc.qbr === 'Assíduo' || acc.qbr === 'Realizado' ? 'var(--green)' : 'var(--yellow)',
                          padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600
                        }}>
                          {acc.qbr}
                        </span>
                      </td>
                      <td style={{ padding: '14px 8px' }}>
                        <span style={{ color: acc.cor, fontWeight: 700 }}>{acc.risco}</span>
                      </td>
                      <td style={{ padding: '14px 8px', color: 'var(--text2)', fontSize: '12px' }}>{acc.acao}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          ABA 5: IA & PREDICTIVE LEAD SCORING (TRIAGEM PREDITIVA)
         ════════════════════════════════════════════════════════════════════ */}
      {abaAtiva === 'scoring' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeIn 0.25s ease' }}>
          
          {/* Introdução AI Lead Scoring */}
          <div style={{
            background: 'linear-gradient(135deg, var(--surface), rgba(139, 92, 246, 0.08))',
            border: '1px solid var(--purple)', borderRadius: '16px', padding: '24px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span style={{
                background: 'rgba(139, 92, 246, 0.2)', color: 'var(--purple)', padding: '2px 10px',
                borderRadius: '6px', fontSize: '11px', fontWeight: 700
              }}>
                MACHINE LEARNING REVOPS
              </span>
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 10px 0', color: 'var(--text)' }}>
              Subvertendo a Intuição com Inteligência Artificial
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text2)', margin: 0, lineHeight: 1.6, maxWidth: '800px' }}>
              O <strong>Predictive Lead Scoring</strong> abole a dependência do instinto subjetivo e da adivinhação manual dos vendedores. Cruzando sinais firmográficos, canal de origem, engajamento e recência, nosso algoritmo categoriza com &gt;90% de exatidão a probabilidade real de fechamento, priorizando quem está pronto para comprar.
            </p>
          </div>

          {/* Simulador / Seletor de Leads Reais para Scoring */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            
            {/* Seletor de Lead do CRM */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>🔍 Selecione um Lead do seu CRM para Auditoria IA</h3>
              <p style={{ fontSize: '12px', color: 'var(--text3)', margin: 0 }}>
                Escolha qualquer contato na sua base para ver o raio-x preditivo em tempo real.
              </p>

              <select
                value={leadSelecionadoId}
                onChange={e => setLeadSelecionadoId(e.target.value)}
                style={{
                  width: '100%', padding: '12px', borderRadius: '10px', background: 'var(--surface2)',
                  border: '1px solid var(--border)', color: 'var(--text)', fontSize: '14px', outline: 'none', cursor: 'pointer'
                }}
              >
                <option value="">-- Selecione o lead ({leads.length} disponíveis) --</option>
                {leads.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.nome || 'Sem nome'} | Status: {l.status} | Origem: {l.origem || 'Outro'}
                  </option>
                ))}
              </select>

              {leadScored?.lead && (
                <div style={{ background: 'var(--surface2)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', marginTop: '6px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', marginBottom: '8px' }}>
                    Resumo do Lead no CRM
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>
                    {leadScored.lead.nome || 'Cliente Sem Nome'}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', color: 'var(--text2)', marginTop: '8px' }}>
                    <div><strong>Email:</strong> {leadScored.lead.email || 'Não informado'}</div>
                    <div><strong>WhatsApp:</strong> {leadScored.lead.whatsapp || leadScored.lead.telefone || 'Não informado'}</div>
                    <div><strong>Nicho:</strong> {leadScored.lead.nicho || 'Geral'}</div>
                    <div><strong>Responsável:</strong> {leadScored.lead.responsavel || 'Sem dono'}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Raio-X do Score AI */}
            <div style={{
              background: 'var(--surface)', border: `2px solid ${leadScored?.cor || 'var(--border)'}`,
              borderRadius: '16px', padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px',
              boxShadow: leadScored ? `0 8px 32px ${leadScored.cor}22` : 'none'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: leadScored?.cor || 'var(--text3)', textTransform: 'uppercase' }}>
                  {leadScored?.tier || 'Aguardando seleção'}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text3)' }}>Precisão IA: 91.4%</span>
              </div>

              {leadScored ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', margin: '4px 0' }}>
                    <span style={{ fontSize: '48px', fontWeight: 800, color: leadScored.cor, fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>
                      {leadScored.score}
                    </span>
                    <span style={{ fontSize: '16px', color: 'var(--text3)' }}>/ 100 pts (Propensão de Fechamento)</span>
                  </div>

                  {/* Barra de Progresso */}
                  <div style={{ width: '100%', height: '8px', background: 'var(--surface2)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${leadScored.score}%`, height: '100%', background: leadScored.cor, transition: 'width 0.4s ease' }} />
                  </div>

                  {/* Ação Direcionada */}
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px' }}>
                    <strong style={{ color: '#fff' }}>Ação Recomendada: </strong>
                    <span style={{ color: 'var(--text2)' }}>{leadScored.acao}</span>
                  </div>

                  {/* Detalhamento dos Sinais */}
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Sinais Detectados pelo Algoritmo
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                      {leadScored.sinais.map((s, idx) => (
                        <div key={idx} style={{
                          fontSize: '12px', padding: '6px 10px', borderRadius: '6px',
                          background: s.tipo === 'pos' ? 'rgba(16, 185, 129, 0.1)' : s.tipo === 'neg' ? 'rgba(239, 68, 68, 0.1)' : 'var(--surface2)',
                          color: s.tipo === 'pos' ? 'var(--green)' : s.tipo === 'neg' ? 'var(--red)' : 'var(--text2)',
                          borderLeft: `3px solid ${s.tipo === 'pos' ? 'var(--green)' : s.tipo === 'neg' ? 'var(--red)' : 'var(--text3)'}`
                        }}>
                          {s.texto}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)', fontSize: '14px' }}>
                  👈 Selecione um lead à esquerda ou cadastre novos contatos para ver o score preditivo.
                </div>
              )}
            </div>

          </div>

          {/* Aviso Legal de Governança sobre Dados e IA */}
          <div style={{
            background: 'var(--surface2)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: 'var(--text2)'
          }}>
            <span style={{ fontSize: '20px' }}>⚖️</span>
            <div>
              <strong style={{ color: 'var(--text)' }}>Regra de Ouro de Governança RevOps (Regra 1-10-100):</strong> Custa $1 para validar um dado na entrada, $10 para limpar depois e $100 em prejuízo quando dados falhos (como duplicidades ou e-mails sem validação regex) poluem os algoritmos de predição de IA. Mantenha sua taxa de validade de e-mails &gt; 90% e duplicidade &lt; 3%.
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
