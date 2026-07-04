import React from 'react';

// Dicionário de status (igual ao da tabela)
const STATUS_CONFIG = {
  'nenhuma':      { label: 'Nenhuma Ação',     cls: 's-nenhuma',       dot: 'var(--s-nenhuma)' },
  'investigacao': { label: '1. Investigação',  cls: 's-investigacao',  dot: 'var(--s-investigacao)' },
  'diagnostico':  { label: '2. Diagnóstico',   cls: 's-diagnostico',   dot: 'var(--s-diagnostico)' },
  'resgate':      { label: '3. Resgate',       cls: 's-resgate',       dot: 'var(--s-resgate)' },
  'em-conversa':  { label: '💬 Em Conversa',   cls: 's-em-conversa',   dot: 'var(--s-em-conversa)' },
  'reuniao-marc': { label: 'Reunião Marcada',  cls: 's-reuniao-marc',  dot: 'var(--s-reuniao-marc)' },
  'contrato':     { label: 'Contrato Fechado', cls: 's-contrato',      dot: 'var(--s-contrato)' },
  'interesse':    { label: '❌ Perdido',       cls: 's-interesse',     dot: 'var(--s-interesse)' }
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
        const quantidade = leads.filter(l => (l.status || 'nenhuma') === chave).length;

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