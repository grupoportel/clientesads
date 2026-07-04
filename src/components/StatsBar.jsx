import React from 'react';

export default function StatsBar({ leads }) {
  // Pega a data de hoje no formato YYYY-MM-DD
  const hoje = new Date().toISOString().slice(0, 10);

  // Cálculos dinâmicos
  const totalLeads = leads.length;
  const semAcao = leads.filter(l => (l.status || 'nenhuma') === 'nenhuma').length;
  const reunioesMarcadas = leads.filter(l => l.status === 'reuniao-marc').length;
  const contratosFechados = leads.filter(l => l.status === 'contrato').length;
  const proxReuniao = leads.filter(l => l.reuniao && l.reuniao >= hoje).length;
  const contatosHoje = leads.filter(l => l.ultimo_contato === hoje).length;

  const taxaConv = totalLeads > 0 ? Math.round((contratosFechados / totalLeads) * 100) : 0;

  // Lista de cards para renderizar na tela
  const stats = [
    { label: 'Total de Leads', value: totalLeads, color: 'var(--accent2)', sub: `${semAcao} sem ação` },
    { label: 'Reuniões Marcadas', value: reunioesMarcadas, color: 'var(--green)', sub: `${proxReuniao} próximas` },
    { label: 'Contratos Fechados', value: contratosFechados, color: 'var(--pink)', sub: `Taxa: ${taxaConv}%` },
    { label: 'Próximas Reuniões', value: proxReuniao, color: 'var(--yellow)', sub: 'a partir de hoje' },
    { label: 'Contatos Hoje', value: contatosHoje, color: 'var(--cyan)', sub: hoje },
  ];

  return (
    <div className="stats-bar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', background: 'rgba(88,101,242,.08)', border: '1px solid rgba(88,101,242,.2)', borderRadius: '8px', flexShrink: 0 }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent2)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
          📊 Visão Geral
        </span>
      </div>
      
      {stats.map((s, index) => (
        <div className="stat-card" key={index}>
          <div className="stat-label">{s.label}</div>
          <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
          <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '2px' }}>{s.sub}</div>
        </div>
      ))}
    </div>
  );
}