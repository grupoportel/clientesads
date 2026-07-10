import React from 'react';

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

const limpaTel = (t) => String(t || '').replace(/\D/g, '');
const formataData = (d) => d ? d.split('-').reverse().join('/') : '';
const urlIg = (ig) => {
  if (!ig) return '';
  if (ig.startsWith('http')) return ig;
  return 'https://instagram.com/' + ig.replace('@', '').trim();
};
const urlSite = (s) => s ? (s.startsWith('http') ? s : 'https://' + s) : '';

export default function DetailPanel({ lead, onClose, onEdit, onDelete }) {
  // Se não tem lead selecionado, o painel fica fechado (width: 0 no CSS)
  if (!lead) return <div className="detail-panel"></div>;

  const st = STATUS_CONFIG[lead.status] || STATUS_CONFIG['nenhum'];
  const igLink = urlIg(lead.instagram);
  const igDono = urlIg(lead.ig_dono);
  const sLink = urlSite(lead.site);
  const wppLink = lead.whatsapp ? `https://wa.me/55${limpaTel(lead.whatsapp)}` : '';

  // Função auxiliar para desenhar as linhas de informação (igual ao seu dRow original)
  const DetailRow = ({ label, children }) => {
    if (!children) return null;
    return (
      <div className="detail-row">
        <span className="detail-label">{label}</span>
        <span className="detail-val">{children}</span>
      </div>
    );
  };

  return (
    <div className={`detail-panel ${lead ? 'open' : ''}`}>
      <div className="detail-inner">
        <div className="detail-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div><span className={`status-badge ${st.cls}`}>{st.label}</span></div>
            <button className="btn-icon" onClick={onClose}>✕</button>
          </div>
          <div className="detail-name">{lead.nome}</div>
          <div className="detail-sub">
            {[lead.nicho, lead.responsavel ? 'Resp: ' + lead.responsavel : ''].filter(Boolean).join(' · ')}
          </div>
        </div>

        <div className="detail-section">
          <div className="detail-section-title">Contato</div>
          <DetailRow label="📞 Telefone">
            {lead.telefone && <a href={`tel:${limpaTel(lead.telefone)}`} style={{ color: 'var(--accent2)', textDecoration: 'none' }}>{lead.telefone}</a>}
          </DetailRow>
          <DetailRow label="💬 WhatsApp">
            {lead.whatsapp && <a href={wppLink} target="_blank" rel="noreferrer" style={{ color: 'var(--accent2)', textDecoration: 'none' }}>{lead.whatsapp}</a>}
          </DetailRow>
          <DetailRow label="✉️ E-mail">
            {lead.email && <a href={`mailto:${lead.email}`} style={{ color: 'var(--accent2)', textDecoration: 'none' }}>{lead.email}</a>}
          </DetailRow>
          <DetailRow label="📷 Instagram">
            {igLink && <a href={igLink} target="_blank" rel="noreferrer" style={{ color: 'var(--accent2)', textDecoration: 'none' }}>{lead.instagram}</a>}
          </DetailRow>
          <DetailRow label="👤 IG Dono">
            {igDono && <a href={igDono} target="_blank" rel="noreferrer" style={{ color: 'var(--accent2)', textDecoration: 'none' }}>{lead.ig_dono}</a>}
          </DetailRow>
          <DetailRow label="🌐 Site">
            {sLink && <a href={sLink} target="_blank" rel="noreferrer" style={{ color: 'var(--accent2)', textDecoration: 'none' }}>Abrir site ↗</a>}
          </DetailRow>
        </div>

        <div className="detail-section">
          <div className="detail-section-title">Informações</div>
          <DetailRow label="📌 Origem">
            {lead.origem && <span className="badge-pill" style={{ textTransform: 'capitalize' }}>{lead.origem}</span>}
          </DetailRow>
          <DetailRow label="👤 Decisor">{lead.decisor}</DetailRow>
          <DetailRow label="📥 Entrada">{formataData(lead.data_entrada || (lead.createdAt || '').slice(0, 10))}</DetailRow>
          <DetailRow label="🧑 Responsável">{lead.responsavel}</DetailRow>
          <DetailRow label="🏢 CNPJ">{lead.cnpj && <span className="td-mono">{lead.cnpj}</span>}</DetailRow>
          <DetailRow label="⭐ Nota Google">{lead.nota ? `${lead.nota}/5 (${lead.avaliacoes || 0} avaliações)` : null}</DetailRow>
          <DetailRow label="📅 Último Contato">{formataData(lead.ultimo_contato)}</DetailRow>
          <DetailRow label="🤝 Reunião">
            {lead.reuniao && <span style={{ color: 'var(--green)', fontWeight: 600 }}>{formataData(lead.reuniao)}</span>}
          </DetailRow>
          <DetailRow label="📝 Histórico">
            {lead.historico && <span style={{ whiteSpace: 'pre-wrap' }}>{lead.historico}</span>}
          </DetailRow>
        </div>

        <div className="detail-section">
          <div className="detail-section-title">Conteúdo & Estratégia</div>
          <DetailRow label="🎯 Melhores Cont.">{lead.melhores}</DetailRow>
          <DetailRow label="💡 Oportunidades">{lead.oportunidades}</DetailRow>
          <DetailRow label="💪 Pontos Fortes">{lead.pontos}</DetailRow>
          <DetailRow label="🚀 Escalar">{lead.escalar}</DetailRow>
        </div>

        <div className="detail-section">
          <div className="detail-section-title">Observação</div>
          <div className="notes-box">{lead.obs || '—'}</div>
        </div>

        <div className="detail-section" style={{ border: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button className="btn btn-primary" style={{ justifyContent: 'center' }} onClick={() => onEdit(lead)}>✏️ Editar Lead</button>
          <button className="btn btn-danger" style={{ justifyContent: 'center' }} onClick={() => onDelete(lead.id)}>🗑 Excluir Lead</button>
        </div>
      </div>
    </div>
  );
}