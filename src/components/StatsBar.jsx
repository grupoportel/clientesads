import React, { useMemo } from 'react';
import {
  ehGanho, ehAberto, valorEmAberto, previsaoPonderada, valorGanho,
  formatarBRL, formatarBRLCurto,
} from '../pipeline';

export default function StatsBar({ leads = [], etapas = [] }) {
  const stats = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);

    const totalLeads   = leads.length;
    const semAcao      = leads.filter(l => (l.status || 'nenhum') === 'nenhum').length;
    // Usa a mesma definição de "ganho" do resto do sistema, vinda da configuração
    // do funil — antes esta barra contava só 'contrato-realizado' enquanto o
    // Dashboard contava 'venda' também, e os dois discordavam na tela.
    const fechados     = leads.filter(l => ehGanho(etapas, l.status)).length;
    const emAberto     = leads.filter(l => ehAberto(etapas, l.status)).length;
    const proxReuniao  = leads.filter(l => l.reuniao && l.reuniao >= hoje).length;
    const taxaConv     = totalLeads > 0 ? Math.round((fechados / totalLeads) * 100) : 0;

    const pipeline  = valorEmAberto(etapas, leads);
    const previsao  = previsaoPonderada(etapas, leads);
    const receita   = valorGanho(etapas, leads);

    return [
      { label: 'Total de Leads',   value: totalLeads,                   color: 'var(--accent2)', sub: `${semAcao} sem ação` },
      { label: 'Pipeline Aberto',  value: formatarBRLCurto(pipeline),   color: 'var(--accent)',  sub: `${emAberto} em andamento`, titulo: formatarBRL(pipeline) },
      { label: 'Previsão',         value: formatarBRLCurto(previsao),   color: 'var(--yellow)',  sub: 'ponderada por etapa',      titulo: formatarBRL(previsao) },
      { label: 'Receita Fechada',  value: formatarBRLCurto(receita),    color: 'var(--green)',   sub: `${fechados} fechados · ${taxaConv}%`, titulo: formatarBRL(receita) },
      { label: 'Próximas Reuniões',value: proxReuniao,                  color: 'var(--pink)',    sub: 'a partir de hoje' },
    ];
  }, [leads, etapas]);

  return (
    <div className="stats-bar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', background: 'rgba(88,101,242,.08)', border: '1px solid rgba(88,101,242,.2)', borderRadius: '8px', flexShrink: 0 }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent2)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
          📊 Visão Geral
        </span>
      </div>

      {stats.map((s, index) => (
        <div className="stat-card" key={index} title={s.titulo || undefined}>
          <div className="stat-label">{s.label}</div>
          <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
          <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '2px' }}>{s.sub}</div>
        </div>
      ))}
    </div>
  );
}
