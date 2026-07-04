import React, { useState } from 'react';

const STATUS_CONFIG = {
  'nenhuma':      { label: 'Nenhuma Ação',     cls: 's-nenhuma' },
  'investigacao': { label: '1. Investigação',  cls: 's-investigacao' },
  'diagnostico':  { label: '2. Diagnóstico',   cls: 's-diagnostico' },
  'resgate':      { label: '3. Resgate',       cls: 's-resgate' },
  'em-conversa':  { label: '💬 Em Conversa',   cls: 's-em-conversa' },
  'reuniao-marc': { label: 'Reunião Marcada',  cls: 's-reuniao-marc'},
  'contrato':     { label: 'Contrato Fechado', cls: 's-contrato' },
  'interesse':    { label: '❌ Perdido',       cls: 's-interesse' }
};

const formataData = (d) => d ? d.split('-').reverse().join('/') : '';

export default function KanbanBoard({ leads, onLeadDrop, onEdit }) {
  const [draggedId, setDraggedId] = useState(null);

  // 1. Inicia o arraste
  const handleDragStart = (e, leadId) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData("leadId", leadId);
    
    // O setTimeout é o segredo para o navegador não cancelar o drag!
    setTimeout(() => setDraggedId(leadId), 0);
  };

  // 2. Termina o arraste
  const handleDragEnd = () => {
    setDraggedId(null);
    document.querySelectorAll('.kanban-col').forEach(c => c.classList.remove('drag-over'));
  };

  // 3. Passa por cima da coluna (o currentTarget garante que é a coluna inteira)
  const handleDragOver = (e) => {
    e.preventDefault(); 
    e.currentTarget.classList.add('drag-over');
  };

  // 4. Sai da coluna
  const handleDragLeave = (e) => {
    // Só remove a cor se o mouse realmente saiu da coluna
    if (!e.currentTarget.contains(e.relatedTarget)) {
      e.currentTarget.classList.remove('drag-over');
    }
  };

  // 5. Solta na coluna
  const handleDrop = (e, statusDestino) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    
    const leadId = e.dataTransfer.getData("leadId");
    if (leadId) onLeadDrop(leadId, statusDestino);
    
    setDraggedId(null);
  };

  return (
    <div className="kanban-outer">
      <div className="kanban-view">
        {Object.entries(STATUS_CONFIG).map(([statusKey, config]) => {
          const leadsDaColuna = leads.filter(l => (l.status || 'nenhuma') === statusKey);

          return (
            <div 
              key={statusKey} 
              className="kanban-col"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, statusKey)}
            >
              <div className="kanban-col-header">
                <span className={`status-badge ${config.cls}`} style={{ pointerEvents: 'none' }}>
                  {config.label}
                </span>
                <span className="kanban-col-count">{leadsDaColuna.length}</span>
              </div>
              
              <div className="kanban-cards">
                {leadsDaColuna.length > 0 ? leadsDaColuna.map(lead => (
                  <div 
                    key={lead.id} 
                    className="kanban-card"
                    draggable={true} // Ativa o drag do HTML5 corretamente
                    onDragStart={(e) => handleDragStart(e, lead.id)}
                    onDragEnd={handleDragEnd}
                    onClick={() => onEdit(lead)}
                    style={{ opacity: draggedId === lead.id ? 0.4 : 1 }}
                  >
                    <div className="kanban-card-name">{lead.nome}</div>
                    <div className="kanban-card-sub">{lead.nicho || 'Sem nicho'}</div>
                    <div className="kanban-card-footer">
                      <span className="kanban-card-phone">{lead.telefone || '—'}</span>
                      <div className="kanban-card-links">
                        {lead.whatsapp && <span title="WhatsApp">💬</span>}
                        {lead.instagram && <span title="Instagram">📷</span>}
                      </div>
                    </div>
                    {lead.reuniao && (
                      <div style={{ marginTop: '6px', fontSize: '10px', color: 'var(--green)' }}>
                        📅 {formataData(lead.reuniao)}
                      </div>
                    )}
                  </div>
                )) : (
                  // pointerEvents none aqui impede o texto vazio de atrapalhar o drop
                  <div className="kanban-empty" style={{ pointerEvents: 'none' }}>Arraste um card aqui</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}