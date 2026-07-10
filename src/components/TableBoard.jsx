import React, { useState, useMemo } from 'react';

const STATUS_CONFIG = {
  'nenhum':                { label: 'Nenhum',               cls: 's-nenhum' },
  'lead-qualificado':      { label: 'Lead Qualificado',     cls: 's-lead-qualificado' },
  'ligacao-feita':         { label: 'Ligação Feita',        cls: 's-ligacao-feita' },
  'contato-decisor':       { label: 'Contato com decisor',  cls: 's-contato-decisor' },
  'reuniao-marcada':       { label: 'Reunião Marcada',      cls: 's-reuniao-marcada'},
  'contrato-realizado':    { label: 'Contrato Realizado',   cls: 's-contrato-realizado' },
  'venda':                 { label: 'Venda',                cls: 's-venda' },
  'perda':                 { label: 'Perda',                cls: 's-perda' },
  'concluido':             { label: 'Concluído',            cls: 's-concluido' }
};

const ORIGEM_OPTIONS = [
  { value: 'gmn', label: 'GMN' }, { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'instagram', label: 'Instagram' }, { value: 'telefone', label: 'Telefone' },
  { value: 'email', label: 'E-mail' }, { value: 'indicacao', label: 'Indicação' },
  { value: 'site', label: 'Site / Inbound' }, { value: 'outro', label: 'Outro' }
];

const STATUS_OPTIONS = Object.entries(STATUS_CONFIG).map(([k, v]) => ({ value: k, label: v.label }));

const limpaTel = (t) => String(t || '').replace(/\D/g, '');
const formataData = (d) => d ? d.split('-').reverse().join('/') : '';
const urlIg = (ig) => {
  if (!ig) return '';
  if (ig.startsWith('http')) return ig;
  return 'https://instagram.com/' + ig.replace('@', '').trim();
};
const urlSite = (s) => s ? (s.startsWith('http') ? s : 'https://' + s) : '';

// ---------------------------------------------------------
// COMPONENTE OTIMIZADO 1: A Célula Mágica
// ---------------------------------------------------------
const EditableCell = ({ lead, field, type = "text", options = [], editCell, setEditCell, onInlineEdit, children }) => {
  const isEditing = editCell.id === lead.id && editCell.field === field;
  
  const startEditing = () => setEditCell({ id: lead.id, field, value: lead[field] || '' });
  
  const saveEditing = (e) => {
    if (e) e.stopPropagation();
    if (editCell.id) onInlineEdit(editCell.id, editCell.field, editCell.value);
    setEditCell({ id: null, field: null, value: '' });
  };

  const cancelEditing = (e) => {
    if (e) e.stopPropagation();
    setEditCell({ id: null, field: null, value: '' });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') saveEditing(e);
    if (e.key === 'Escape') cancelEditing(e);
  };

  if (isEditing) {
    let inputEl;
    if (type === "select") {
      inputEl = (
        <select autoFocus className="form-control" style={{ padding: '4px', height: '26px', fontSize: '11px', minWidth: '120px' }}
          value={editCell.value} onChange={(e) => setEditCell({ ...editCell, value: e.target.value })}
          onKeyDown={handleKeyDown}>
          <option value="">— selecione —</option>
          {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      );
    } else {
      inputEl = (
        <input autoFocus type={type} className="form-control" style={{ padding: '4px', height: '26px', fontSize: '11px', minWidth: '100px' }}
          value={editCell.value} onChange={(e) => setEditCell({ ...editCell, value: e.target.value })}
          onKeyDown={handleKeyDown} />
      );
    }

    return (
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
        {inputEl}
        <button className="btn-icon" style={{ padding: '4px 6px', background: 'var(--green)', color: '#fff', border: 'none', minHeight: '26px' }} onClick={saveEditing} title="Salvar (Enter)">✓</button>
        <button className="btn-icon" style={{ padding: '4px 6px', background: 'var(--surface3)', color: 'var(--text)', border: 'none', minHeight: '26px' }} onClick={cancelEditing} title="Cancelar (Esc)">✕</button>
      </div>
    );
  }
  return <div onClick={startEditing} style={{ cursor: 'pointer', minHeight: '20px', display: 'flex', alignItems: 'center' }} title="Clique para editar rapidamente">{children}</div>;
};

// ---------------------------------------------------------
// COMPONENTE PRINCIPAL
// ---------------------------------------------------------
export default function TableBoard({ leads, onEdit, onDelete, onInlineEdit, selectedLeads, setSelectedLeads, onOpenDetail, nichos=[], responsaveis=[], estados=[], cidades=[] }) {
  const [editCell, setEditCell] = useState({ id: null, field: null, value: '' });
  
  // Variáveis para a ordenação (Sort)
  const [sortConfig, setSortConfig] = useState({ key: null, dir: 1 });

  const sortedLeads = useMemo(() => {
    let sortableLeads = [...leads];
    if (sortConfig.key) {
      sortableLeads.sort((a, b) => {
        let av = a[sortConfig.key] || '';
        let bv = b[sortConfig.key] || '';
        if (!isNaN(av) && !isNaN(bv) && av !== '' && bv !== '') {
          return (Number(av) - Number(bv)) * sortConfig.dir;
        }
        return String(av).localeCompare(String(bv)) * sortConfig.dir;
      });
    }
    return sortableLeads;
  }, [leads, sortConfig]);

  const handleSort = (key) => {
    let dir = 1;
    if (sortConfig.key === key && sortConfig.dir === 1) dir = -1;
    setSortConfig({ key, dir });
  };

  const getSortIcon = (key) => {
    if (sortConfig.key === key) return sortConfig.dir === 1 ? ' 🔼' : ' 🔽';
    return '';
  };

  if (!leads || leads.length === 0) {
    return <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text3)' }}>Nenhum lead encontrado.</div>;
  }

  // --- LÓGICA DE CHECKBOXES BLINDADA ---
  const handleSelectAll = (e) => {
    if (e.target.checked) setSelectedLeads(sortedLeads.map(l => l.id));
    else setSelectedLeads([]);
  };

  const handleSelectOne = (e, id) => {
    if (e.target.checked) setSelectedLeads([...selectedLeads, id]);
    else setSelectedLeads(selectedLeads.filter(leadId => leadId !== id));
  };

  const formatOptions = (arr) => arr.map(item => ({ value: item, label: item }));

  // Quantidade de visíveis
  const todosSelecionados = sortedLeads.length > 0 && sortedLeads.every(l => selectedLeads.includes(l.id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div className="table-wrapper">
        <table id="leadsTable">
          <thead>
            <tr>
              <th style={{ width: '90px', paddingLeft: '20px' }}>
                <input 
                  type="checkbox" 
                  checked={todosSelecionados} 
                  onChange={handleSelectAll} 
                  style={{ cursor: 'pointer' }}
                />
              </th>
              
              <th style={{ minWidth: '300px', cursor: 'pointer' }} onClick={() => handleSort('nome')}>Nome / Empresa{getSortIcon('nome')}</th>
              <th style={{ minWidth: '150px', cursor: 'pointer' }} onClick={() => handleSort('responsavel')}>Responsável{getSortIcon('responsavel')}</th>
              <th style={{ minWidth: '160px', cursor: 'pointer' }} onClick={() => handleSort('status')}>Status{getSortIcon('status')}</th>
              <th style={{ minWidth: '140px', cursor: 'pointer' }} onClick={() => handleSort('origem')}>Origem{getSortIcon('origem')}</th>
              <th style={{ minWidth: '150px', cursor: 'pointer' }} onClick={() => handleSort('nicho')}>Nicho{getSortIcon('nicho')}</th>
              <th style={{ minWidth: '120px', cursor: 'pointer' }} onClick={() => handleSort('estado')}>Estado{getSortIcon('estado')}</th>
              <th style={{ minWidth: '140px', cursor: 'pointer' }} onClick={() => handleSort('cidade')}>Cidade{getSortIcon('cidade')}</th>
              
              <th>Telefone</th>
              <th>WhatsApp</th>
              <th>Instagram</th>
              <th>IG do Dono</th>
              <th>Site</th>
              
              <th style={{ cursor: 'pointer' }} onClick={() => handleSort('nota')}>Nota ⭐{getSortIcon('nota')}</th>
              <th style={{ cursor: 'pointer' }} onClick={() => handleSort('avaliacoes')}>Avaliações{getSortIcon('avaliacoes')}</th>
              
              <th>Decisor</th>
              <th>E-mail</th>
              <th>CNPJ</th>
              
              <th style={{ cursor: 'pointer' }} onClick={() => handleSort('ultimo_contato')}>Último Contato{getSortIcon('ultimo_contato')}</th>
              <th style={{ cursor: 'pointer' }} onClick={() => handleSort('reuniao')}>Reunião{getSortIcon('reuniao')}</th>
              <th style={{ minWidth: '200px' }}>Observação</th>
            </tr>
          </thead>
          <tbody>
            {sortedLeads.map((lead) => {
              const isChecked = selectedLeads.includes(lead.id);
              const status = STATUS_CONFIG[lead.status] || STATUS_CONFIG['nenhum'];
              const linkWpp = lead.whatsapp ? `https://wa.me/55${limpaTel(lead.whatsapp)}` : '';
              const linkIgEmpresa = urlIg(lead.instagram);
              const linkIgDono = urlIg(lead.ig_dono);
              const linkSite = urlSite(lead.site);
              const cellProps = { lead, editCell, setEditCell, onInlineEdit };

              return (
                <tr key={lead.id} className={isChecked ? 'selected' : ''}>
                  <td style={{ paddingLeft: '20px' }}>
                    <div className="check-container">
                      <input 
                        type="checkbox" 
                        className="row-check" 
                        checked={isChecked} 
                        onChange={(e) => handleSelectOne(e, lead.id)} 
                        style={{ cursor: 'pointer' }}
                      />
                      <div className="row-actions-left">
                        <button className="btn-icon" title="Abrir Formulário Completo" onClick={() => onEdit(lead)} style={{ padding: '4px 6px', fontSize: '12px' }}>📄</button>
                        <button className="btn-icon" title="Excluir" onClick={() => onDelete(lead.id)} style={{ padding: '4px 6px', fontSize: '12px' }}>🗑️</button>
                      </div>
                    </div>
                  </td>

                  <td className="td-name" onClick={() => onOpenDetail(lead)}>
                    <div>
                      <div className="td-name-main">{lead.nome}</div>
                      {lead.nicho && <div className="td-name-sub">{lead.nicho}</div>}
                    </div>
                  </td>
                  
                  <td><EditableCell {...cellProps} field="responsavel" type="select" options={formatOptions(responsaveis)}>{lead.responsavel ? <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div className="avatar">{lead.responsavel.charAt(0)}</div>{lead.responsavel}</div> : <span className="td-empty">—</span>}</EditableCell></td>
                  <td><EditableCell {...cellProps} field="status" type="select" options={STATUS_OPTIONS}><button className={`status-badge ${status.cls}`}>{status.label} ▾</button></EditableCell></td>
                  <td><EditableCell {...cellProps} field="origem" type="select" options={ORIGEM_OPTIONS}>{lead.origem ? <span className="badge-pill" style={{textTransform: 'capitalize'}}>{lead.origem}</span> : <span className="td-empty">—</span>}</EditableCell></td>
                  <td><EditableCell {...cellProps} field="nicho" type="select" options={formatOptions(nichos)}>{lead.nicho ? <span className="badge-pill">{lead.nicho}</span> : <span className="td-empty">—</span>}</EditableCell></td>
                  <td><EditableCell {...cellProps} field="estado" type="select" options={formatOptions(estados)}>{lead.estado ? <span className="badge-pill">{lead.estado}</span> : <span className="td-empty">—</span>}</EditableCell></td>
                  <td><EditableCell {...cellProps} field="cidade" type="select" options={formatOptions(cidades)}>{lead.cidade ? <span className="badge-pill">{lead.cidade}</span> : <span className="td-empty">—</span>}</EditableCell></td>

                  <td><EditableCell {...cellProps} field="telefone">{lead.telefone ? <a href={`tel:${limpaTel(lead.telefone)}`} className="td-link" onClick={e=>e.preventDefault()}>📞 {lead.telefone}</a> : <span className="td-empty">—</span>}</EditableCell></td>
                  <td><EditableCell {...cellProps} field="whatsapp">{lead.whatsapp ? <a href={linkWpp} target="_blank" rel="noreferrer" className="td-link" onClick={e=>e.preventDefault()}>💬 {lead.whatsapp}</a> : <span className="td-empty">—</span>}</EditableCell></td>
                  <td><EditableCell {...cellProps} field="instagram">{linkIgEmpresa ? <a href={linkIgEmpresa} target="_blank" rel="noreferrer" className="td-link" onClick={e=>e.preventDefault()}>📷 {lead.instagram}</a> : <span className="td-empty">—</span>}</EditableCell></td>
                  <td><EditableCell {...cellProps} field="ig_dono">{linkIgDono ? <a href={linkIgDono} target="_blank" rel="noreferrer" className="td-link" onClick={e=>e.preventDefault()}>👤 {lead.ig_dono}</a> : <span className="td-empty">—</span>}</EditableCell></td>
                  <td><EditableCell {...cellProps} field="site">{linkSite ? <a href={linkSite} target="_blank" rel="noreferrer" className="td-link" onClick={e=>e.preventDefault()}>🌐 Site</a> : <span className="td-empty">—</span>}</EditableCell></td>
                  
                  <td><EditableCell {...cellProps} field="nota" type="number">{lead.nota ? <span style={{ fontSize:'14px', fontWeight:700, color:'var(--yellow)', fontFamily:"'DM Mono', monospace" }}>{lead.nota}</span> : <span className="td-empty">—</span>}</EditableCell></td>
                  <td><EditableCell {...cellProps} field="avaliacoes" type="number">{lead.avaliacoes ? <span className="td-mono">{lead.avaliacoes}</span> : <span className="td-empty">—</span>}</EditableCell></td>

                  <td className="td-truncate" title={lead.decisor}><EditableCell {...cellProps} field="decisor">{lead.decisor || <span className="td-empty">—</span>}</EditableCell></td>
                  <td><EditableCell {...cellProps} field="email">{lead.email ? <a href={`mailto:${lead.email}`} className="td-link" onClick={e=>e.preventDefault()}>✉️ {lead.email}</a> : <span className="td-empty">—</span>}</EditableCell></td>
                  <td className="td-mono" style={{ fontSize: '11px' }}><EditableCell {...cellProps} field="cnpj">{lead.cnpj || <span className="td-empty">—</span>}</EditableCell></td>

                  <td style={{ fontSize: '11px', color: 'var(--text2)' }}><EditableCell {...cellProps} field="ultimo_contato" type="date">{formataData(lead.ultimo_contato) || <span className="td-empty">—</span>}</EditableCell></td>
                  <td style={{ fontSize: '11px', color: 'var(--text2)' }}><EditableCell {...cellProps} field="reuniao" type="date">{formataData(lead.reuniao) || <span className="td-empty">—</span>}</EditableCell></td>
                  <td className="td-truncate" title={lead.obs}><EditableCell {...cellProps} field="obs">{lead.obs || <span className="td-empty">—</span>}</EditableCell></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}