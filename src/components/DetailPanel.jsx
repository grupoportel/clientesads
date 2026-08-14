import React, { useEffect, useState } from 'react';
import { acharEtapa, formatarBRL } from '../pipeline';
import { escutarAtividadesDoLead, tempoRelativo, TIPOS } from '../atividades';

const limpaTel = (t) => String(t || '').replace(/\D/g, '');
const formataData = (d) => d ? d.split('-').reverse().join('/') : '';
const urlIg = (ig) => {
  if (!ig) return '';
  if (ig.startsWith('http')) return ig;
  return 'https://instagram.com/' + ig.replace('@', '').trim();
};
const urlSite = (s) => s ? (s.startsWith('http') ? s : 'https://' + s) : '';

// Linha do tempo do lead. Fica em um componente próprio para poder ter o seu
// próprio listener sem que o painel inteiro precise re-renderizar.
function LinhaDoTempo({ leadId }) {
  const [atividades, setAtividades] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    setCarregando(true);
    const cancelar = escutarAtividadesDoLead(leadId, (lista) => {
      setAtividades(lista);
      setCarregando(false);
    });
    return () => cancelar();
  }, [leadId]);

  if (carregando) {
    return <div style={{ fontSize: 12, color: 'var(--text3)', padding: '8px 0' }}>Carregando histórico…</div>;
  }

  if (atividades.length === 0) {
    return (
      <div style={{ fontSize: 12, color: 'var(--text3)', padding: '8px 0', lineHeight: 1.5 }}>
        Nada registrado ainda. As mudanças a partir de agora aparecem aqui automaticamente.
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', paddingLeft: 4 }}>
      <div style={{ position: 'absolute', left: 11, top: 10, bottom: 10, width: 2, background: 'var(--border)' }} />
      {atividades.slice(0, 30).map(a => {
        const tipo = TIPOS[a.tipo] || TIPOS.nota;
        return (
          <div key={a.id} style={{ display: 'flex', gap: 10, position: 'relative', paddingBottom: 14 }}>
            <div style={{
              width: 20, height: 20, borderRadius: '50%', flexShrink: 0, zIndex: 1,
              background: 'var(--surface)', border: `1.5px solid ${tipo.cor}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9,
            }}>
              {tipo.icone}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.45 }}>{a.descricao}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 2 }}>
                {a.autorNome} · {tempoRelativo(a.criadoEm)}
              </div>
            </div>
          </div>
        );
      })}
      {atividades.length > 30 && (
        <div style={{ fontSize: 11, color: 'var(--text3)', paddingLeft: 30 }}>
          + {atividades.length - 30} evento(s) mais antigos
        </div>
      )}
    </div>
  );
}

export default function DetailPanel({ lead, onClose, onEdit, onDelete, etapas = [] }) {
  // Se não tem lead selecionado, o painel fica fechado (width: 0 no CSS)
  if (!lead) return <div className="detail-panel"></div>;

  const st = acharEtapa(etapas, lead.status);
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
          {Number(lead.valor) > 0 && (
            <div style={{
              marginTop: 10, fontFamily: "'DM Mono', monospace",
              fontSize: 20, fontWeight: 700, color: 'var(--green)',
            }}>
              {formatarBRL(lead.valor)}
              <span style={{
                fontFamily: "'DM Sans', sans-serif", fontSize: 11,
                fontWeight: 400, color: 'var(--text3)', marginLeft: 8,
              }}>
                {st.probabilidade}% de chance · previsão {formatarBRL(Number(lead.valor) * st.probabilidade / 100)}
              </span>
            </div>
          )}
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

        <div className="detail-section">
          <div className="detail-section-title">Linha do Tempo</div>
          <LinhaDoTempo leadId={lead.id} />
        </div>

        <div className="detail-section" style={{ border: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button className="btn btn-primary" style={{ justifyContent: 'center' }} onClick={() => onEdit(lead)}>✏️ Editar Lead</button>
          <button className="btn btn-danger" style={{ justifyContent: 'center' }} onClick={() => onDelete(lead.id)}>🗑 Excluir Lead</button>
        </div>
      </div>
    </div>
  );
}