import React from 'react';

// Dicionário de status (igual ao da tabela)
const STATUS_CONFIG = {
  'nenhum':                { label: 'Nenhum',               cls: 's-nenhum',                dot: 'var(--s-nenhum)' },
  'lead-qualificado':      { label: 'Lead Qualificado',     cls: 's-lead-qualificado',      dot: 'var(--s-lead-qualificado)' },
  'ligacao-feita':         { label: 'Ligação Feita',        cls: 's-ligacao-feita',         dot: 'var(--s-ligacao-feita)' },
  'contato-decisor':       { label: 'Contato com decisor',  cls: 's-contato-decisor',       dot: 'var(--s-contato-decisor)' },
  'reuniao-marcada':       { label: 'Reunião Marcada',      cls: 's-reuniao-marcada',       dot: 'var(--s-reuniao-marcada)' },
  'contrato-realizado':    { label: 'Contrato Realizado',   cls: 's-contrato-realizado',    dot: 'var(--s-contrato-realizado)' },
  'venda':                 { label: 'Venda',                cls: 's-venda',                 dot: 'var(--s-venda)' },
  'perda':                 { label: 'Perda',                cls: 's-perda',                 dot: 'var(--s-perda)' },
  'concluido':             { label: 'Concluído',            cls: 's-concluido',             dot: 'var(--s-concluido)' }
};

export default function Sidebar({ leads, filtroStatus, setFiltroStatus }) {
  return (
    <div className="sidebar">
      <div className="sidebar-label">Pipeline</div>
      
      {/* Botão TODOS OS LEADS */}
      <div 
        className={`sidebar-item ${filtroStatus === null ? 'active' : ''}`} 
        onClick={() => setFiltroStatus(null)}
      >
        <span>📋</span> Todos os Leads 
        <span className="sidebar-count">{leads.length}</span>
      </div>
      
      <div className="sidebar-divider"></div>
      <div className="sidebar-label">Por Status</div>

      {/* Gerando os botões de status automaticamente */}
      {Object.entries(STATUS_CONFIG).map(([chave, config]) => {
        // Calcula quantos leads têm esse status
        const quantidade = leads.filter(l => (l.status || 'nenhum') === chave).length;

        return (
          <div 
            key={chave}
            className={`sidebar-item ${filtroStatus === chave ? 'active' : ''}`} 
            onClick={() => setFiltroStatus(chave)}
          >
            <span className="sidebar-dot" style={{ background: config.dot }}></span> 
            {config.label} 
            <span className="sidebar-count">{quantidade}</span>
          </div>
        );
      })}
    </div>
  );
}