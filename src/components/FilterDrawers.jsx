import React, { useState } from 'react';
import { ref, set } from 'firebase/database';
import { database } from '../firebase';

// Este é o "Molde" de uma gaveta expansível
const Drawer = ({ title, icon, items, leads, field, activeFilter, setFilter, dbPath }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Pega os itens salvos no banco + os itens que já existem nos leads e remove duplicados
  const leadItems = leads.map(l => l[field]).filter(Boolean);
  const allItems = [...new Set([...leadItems, ...items])].sort();

  // Função para adicionar uma nova opção no Firebase
  const handleAdd = () => {
    const nome = window.prompt(`Adicionar novo(a) ${title}:`);
    if (nome && nome.trim()) {
      const novoArray = [...new Set([...items, nome.trim()])];
      set(ref(database, dbPath), novoArray);
    }
  };

  // Remove uma opção do Firebase, avisando se ela está em uso.
  // Sem o aviso, os leads que usavam o valor ficavam com um campo órfão que
  // nenhum filtro alcança mais.
  const handleRemove = (itemParaRemover) => {
    const emUso = leads.filter(l => l[field] === itemParaRemover).length;

    const aviso = emUso > 0
      ? `"${itemParaRemover}" está em uso por ${emUso} lead(s).\n\n` +
        `Removendo da lista, esses leads continuam com o valor gravado, mas ele ` +
        `deixa de aparecer nos filtros e nos formulários.\n\nRemover mesmo assim?`
      : `Excluir "${itemParaRemover}" da lista rápida?`;

    if (window.confirm(aviso)) {
      const novoArray = items.filter(i => i !== itemParaRemover);
      set(ref(database, dbPath), novoArray);
      if (activeFilter === itemParaRemover) setFilter(null);
    }
  };

  return (
    <div className={`nicho-drawer ${isOpen ? 'open' : ''}`}>
      <div className="nicho-drawer-header" onClick={() => setIsOpen(!isOpen)}>
        <span className="arrow" style={{ display: 'inline-block', transition: 'transform 0.2s', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span> 
        {icon} {title}
      </div>
      
      <div className="nicho-drawer-content">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', width: '100%' }}>
          
          {allItems.map(item => (
            <div 
              key={item} 
              className={`filter-chip ${activeFilter === item ? 'active' : ''}`}
              onClick={() => setFilter(activeFilter === item ? null : item)}
            >
              {field === 'responsavel' && '👤 '}
              {item}
              <span 
                style={{ marginLeft: '6px', opacity: 0.6, cursor: 'pointer' }}
                title="Excluir"
                onClick={(e) => { e.stopPropagation(); handleRemove(item); }}
              >✕</span>
            </div>
          ))}
          
          <button className="filter-chip" onClick={handleAdd} style={{ borderStyle: 'dashed', color: 'var(--accent2)', background: 'transparent' }}>
            ＋ Adicionar
          </button>

        </div>
      </div>
    </div>
  );
};

// Aqui nós exportamos o painel completo juntando as 4 gavetas
export default function FilterDrawers(props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      <Drawer title="Nichos / Mercados" icon="📁" field="nicho" items={props.nichos} leads={props.leads} activeFilter={props.filtroNicho} setFilter={props.setFiltroNicho} dbPath="crm_data/nichos" />
      <Drawer title="Equipe / Responsáveis" icon="👥" field="responsavel" items={props.responsaveis} leads={props.leads} activeFilter={props.filtroResponsavel} setFilter={props.setFiltroResponsavel} dbPath="crm_data/responsaveis" />
      <Drawer title="Estado" icon="🗺️" field="estado" items={props.estados} leads={props.leads} activeFilter={props.filtroEstado} setFilter={props.setFiltroEstado} dbPath="crm_data/estados" />
      <Drawer title="Cidade" icon="🏙️" field="cidade" items={props.cidades} leads={props.leads} activeFilter={props.filtroCidade} setFilter={props.setFiltroCidade} dbPath="crm_data/cidades" />
    </div>
  );
}