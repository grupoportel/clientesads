import React, { useEffect, useState } from 'react';
import { acharEtapa, formatarBRL } from '../pipeline';
import { escutarAtividadesDoLead, tempoRelativo, TIPOS } from '../atividades';
import { CADENCIAS, podeUsarWhatsApp, qualidadeRegistroProspeccao } from '../processoProspeccao';

const limpaTel = (t) => String(t || '').replace(/\D/g, '');
const formataData = (d) => d ? d.split('-').reverse().join('/') : '';
const formataDataHora = (d) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(d || ''));
  return m ? `${m[3]}/${m[2]}/${m[1]} às ${m[4]}:${m[5]}` : formataData(d);
};
const urlIg = (ig) => {
  if (!ig) return '';
  if (ig.startsWith('http')) return ig;
  return 'https://instagram.com/' + ig.replace('@', '').trim();
};
const urlSite = (s) => s ? (s.startsWith('http') ? s : 'https://' + s) : '';

// Fora do componente de propósito: definido dentro, o React tratava cada render
// como um tipo novo e destruía/recriava as 19 linhas do painel toda vez.
function DetailRow({ label, children }) {
  if (!children) return null;
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className="detail-val">{children}</span>
    </div>
  );
}

// Linha do tempo do lead. Fica em um componente próprio para poder ter o seu
// próprio listener sem que o painel inteiro precise re-renderizar.
function LinhaDoTempo({ leadId }) {
  const [atividades, setAtividades] = useState([]);
  const [carregando, setCarregando] = useState(true);

  // Sem setCarregando(true) aqui: o painel passa key={lead.id}, então trocar
  // de lead remonta o componente e ele já nasce no estado de carregando.
  useEffect(() => {
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

export default function DetailPanel({ lead, onClose, onEdit, onDelete, onAgendar, onPrepararReuniao, etapas = [] }) {
  // Se não tem lead selecionado, o painel fica fechado (width: 0 no CSS)
  if (!lead) return <div className="detail-panel"></div>;

  const st = acharEtapa(etapas, lead.status);
  const igLink = urlIg(lead.instagram);
  const igDono = urlIg(lead.ig_dono);
  const sLink = urlSite(lead.site);
  const wppLink = lead.whatsapp ? `https://wa.me/55${limpaTel(lead.whatsapp)}` : '';
  const whatsappLiberado = podeUsarWhatsApp(lead);
  const optOutAtivo = lead.optOut === true || lead.optOut === 'true';
  const qualidade = qualidadeRegistroProspeccao(lead);
  const cadencia = CADENCIAS[lead.prioridadeProspeccao];

  return (
    <div className={`detail-panel ${lead ? 'open' : ''}`}>
      <div className="detail-inner">
        <div className="detail-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div><span className={`status-badge ${st.cls}`}>{st.label}</span></div>
            <button className="btn-icon" onClick={onClose} aria-label="Fechar detalhes do lead">✕</button>
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
            {lead.whatsapp && (whatsappLiberado
              ? <a href={wppLink} target="_blank" rel="noreferrer" style={{ color: 'var(--accent2)', textDecoration: 'none' }}>{lead.whatsapp}</a>
              : <span title={optOutAtivo ? 'O contato pediu para não receber novas abordagens.' : 'Registre a permissão antes de usar este canal.'} style={{ color: 'var(--yellow)' }}>
                  {lead.whatsapp} · {optOutAtivo ? 'opt-out' : 'sem permissão'}
                </span>)}
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
          <DetailRow label="🧭 Papel">{lead.decisorPapel}</DetailRow>
          <DetailRow label="📥 Entrada">{formataData(lead.data_entrada || (lead.createdAt || '').slice(0, 10))}</DetailRow>
          <DetailRow label="🧑 Responsável">{lead.responsavel}</DetailRow>
          <DetailRow label="🏢 CNPJ">{lead.cnpj && <span className="td-mono">{lead.cnpj}</span>}</DetailRow>
          <DetailRow label="⭐ Nota Google">{lead.nota ? `${lead.nota}/5 (${lead.avaliacoes || 0} avaliações)` : null}</DetailRow>
          <DetailRow label="📅 Último Contato">{formataData(lead.ultimo_contato)}</DetailRow>
          <DetailRow label="🤝 Reunião">
            {(lead.reuniaoDataHora || lead.reuniao) && (
              <span style={{ color: 'var(--green)', fontWeight: 600 }}>
                {formataDataHora(lead.reuniaoDataHora || lead.reuniao)}
                {lead.confirmacaoExplicita ? ' · confirmada' : ' · aguardando confirmação'}
              </span>
            )}
          </DetailRow>
          <DetailRow label="📝 Histórico">
            {lead.historico && <span style={{ whiteSpace: 'pre-wrap' }}>{lead.historico}</span>}
          </DetailRow>
        </div>

        <div className="detail-section">
          <div className="detail-section-title">Operação do playbook</div>
          <DetailRow label="🎯 Cadência">
            {cadencia ? `${cadencia.rotulo} · ${cadencia.contatos} contatos/${cadencia.diasUteis} dias úteis` : null}
          </DetailRow>
          <DetailRow label="📊 Qualidade CRM">{`${qualidade}% completo`}</DetailRow>
          <DetailRow label="🔎 Evidência">{lead.evidencia}</DetailRow>
          <DetailRow label="💭 Hipótese">{lead.hipotese}</DetailRow>
          <DetailRow label="☎️ Objetivo">{lead.objetivoContato}</DetailRow>
          <DetailRow label="✅ Próxima ação">
            {lead.proximaAcao && (
              <span>
                {lead.proximaAcao}
                {lead.proximaAcaoDataHora ? ` · ${formataDataHora(lead.proximaAcaoDataHora)}` : ''}
                {lead.proximaAcaoCanal ? ` · ${lead.proximaAcaoCanal}` : ''}
              </span>
            )}
          </DetailRow>
          {optOutAtivo && (
            <div style={{ marginTop: 8, color: 'var(--red)', fontSize: 12, fontWeight: 600 }}>
              ⛔ Opt-out registrado: não realizar novas abordagens.
            </div>
          )}
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
          <LinhaDoTempo key={lead.id} leadId={lead.id} />
        </div>

        <div className="detail-section" style={{ border: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {onPrepararReuniao && (
            <button className="btn btn-primary" style={{ justifyContent: 'center' }} onClick={() => onPrepararReuniao(lead)}>
              🧭 Preparar reunião
            </button>
          )}
          <button className="btn btn-primary" style={{ justifyContent: 'center' }} onClick={() => onEdit(lead)}>✏️ Editar Lead</button>
          {onAgendar && (
            <button className="btn btn-ghost" style={{ justifyContent: 'center' }} onClick={() => onAgendar(lead)}>
              📅 Marcar Reunião
            </button>
          )}
          <button className="btn btn-danger" style={{ justifyContent: 'center' }} onClick={() => onDelete(lead.id)}>🗑 Excluir Lead</button>
        </div>
      </div>
    </div>
  );
}
