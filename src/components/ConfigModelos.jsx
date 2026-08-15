import { useState } from 'react';
import { ref, push, set, remove } from 'firebase/database';
import { database } from '../firebase';
import { VARIAVEIS, previaComExemplos, variaveisDesconhecidas } from '../modelos';

const VAZIO = { nome: '', canal: 'whatsapp', assunto: '', corpo: '' };

export default function ConfigModelos({ modelos = [] }) {
  const [emEdicao, setEmEdicao] = useState(null); // null = nenhum aberto
  const [rascunho, setRascunho] = useState(VAZIO);

  const abrirNovo = () => { setRascunho(VAZIO); setEmEdicao('novo'); };
  const abrirEdicao = (m) => { setRascunho(m); setEmEdicao(m.id); };
  const fechar = () => { setEmEdicao(null); setRascunho(VAZIO); };

  const salvar = () => {
    if (!rascunho.nome.trim() || !rascunho.corpo.trim()) return;
    const agora = new Date().toISOString();

    if (emEdicao === 'novo') {
      const novaRef = push(ref(database, 'crm_data/modelos'));
      set(novaRef, { ...rascunho, id: novaRef.key, criadoEm: agora });
    } else {
      set(ref(database, 'crm_data/modelos/' + emEdicao), { ...rascunho, id: emEdicao, atualizadoEm: agora });
    }
    fechar();
  };

  const excluir = (m) => {
    if (window.confirm(`Excluir o modelo "${m.nome}"?`)) {
      remove(ref(database, 'crm_data/modelos/' + m.id));
      if (emEdicao === m.id) fechar();
    }
  };

  const inserirVariavel = (chave) => {
    setRascunho(r => ({ ...r, corpo: `${r.corpo}{{${chave}}}` }));
  };

  const desconhecidas = variaveisDesconhecidas(rascunho.corpo);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: emEdicao ? 'minmax(0,1fr) minmax(340px,1fr)' : '1fr', gap: 20, maxWidth: 1000 }}>

      {/* ── Lista ── */}
      <div className="crm-card">
        <div className="crm-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div className="crm-card-title">✍️ Modelos de Mensagem</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4, maxWidth: 460, lineHeight: 1.5 }}>
              Texto pronto com variáveis, para WhatsApp e e-mail. As variáveis são
              trocadas pelos dados do lead na hora do envio.
            </div>
          </div>
          <button className="btn btn-primary" style={{ fontSize: 12.5, flexShrink: 0 }} onClick={abrirNovo}>
            + Novo modelo
          </button>
        </div>

        {modelos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text3)', fontSize: 13, lineHeight: 1.6 }}>
            <div style={{ fontSize: 30, marginBottom: 10 }}>✍️</div>
            Nenhum modelo ainda.<br />
            Comece por um de primeiro contato — é o que mais se repete.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {modelos.map(m => (
              <div
                key={m.id}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '12px 14px', borderRadius: 10,
                  background: emEdicao === m.id ? 'rgba(0,208,223,0.08)' : 'var(--surface2)',
                  border: `1px solid ${emEdicao === m.id ? 'rgba(0,208,223,0.3)' : 'var(--border)'}`,
                }}
              >
                <span style={{ fontSize: 15, flexShrink: 0 }}>{m.canal === 'email' ? '✉️' : '💬'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{m.nome}</div>
                  <div style={{
                    fontSize: 11.5, color: 'var(--text3)', marginTop: 3,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {m.corpo}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button className="btn btn-ghost" style={{ fontSize: 11.5, padding: '3px 9px' }} onClick={() => abrirEdicao(m)}>Editar</button>
                  <button className="btn btn-danger" style={{ fontSize: 11.5, padding: '3px 9px' }} onClick={() => excluir(m)}>🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Editor ── */}
      {emEdicao && (
        <div className="crm-card">
          <div className="crm-card-header">
            <div className="crm-card-title">
              {emEdicao === 'novo' ? 'Novo modelo' : 'Editar modelo'}
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group full">
              <label className="form-label">Nome do modelo</label>
              <input
                className="form-control"
                value={rascunho.nome}
                onChange={e => setRascunho(r => ({ ...r, nome: e.target.value }))}
                placeholder="Ex: Primeiro contato"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Canal</label>
              <select
                className="form-control"
                value={rascunho.canal}
                onChange={e => setRascunho(r => ({ ...r, canal: e.target.value }))}
              >
                <option value="whatsapp">💬 WhatsApp</option>
                <option value="email">✉️ E-mail</option>
              </select>
            </div>

            {rascunho.canal === 'email' && (
              <div className="form-group">
                <label className="form-label">Assunto</label>
                <input
                  className="form-control"
                  value={rascunho.assunto || ''}
                  onChange={e => setRascunho(r => ({ ...r, assunto: e.target.value }))}
                  placeholder="Proposta para {{nome}}"
                />
              </div>
            )}

            <div className="form-group full">
              <label className="form-label">Mensagem</label>
              <textarea
                className="form-control"
                rows={6}
                value={rascunho.corpo}
                onChange={e => setRascunho(r => ({ ...r, corpo: e.target.value }))}
                placeholder="Olá {{primeiroNome}}, tudo bem? Aqui é {{meuNome}}, da {{empresa}}…"
                style={{ resize: 'vertical', lineHeight: 1.6 }}
              />
            </div>
          </div>

          {/* Variáveis clicáveis */}
          <div style={{ marginTop: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', marginBottom: 8 }}>
              Clique para inserir
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {VARIAVEIS.map(v => (
                <button
                  key={v.chave}
                  onClick={() => inserirVariavel(v.chave)}
                  title={`Exemplo: ${v.exemplo}`}
                  style={{
                    fontSize: 11.5, padding: '3px 9px', borderRadius: 20, cursor: 'pointer',
                    background: 'var(--surface2)', border: '1px solid var(--border)',
                    color: 'var(--accent)', fontFamily: "'DM Mono', monospace",
                  }}
                >
                  {v.rotulo}
                </button>
              ))}
            </div>
          </div>

          {desconhecidas.length > 0 && (
            <div style={{
              marginTop: 12, padding: '9px 12px', borderRadius: 8, fontSize: 12,
              background: 'rgba(250,204,21,0.1)', border: '1px solid rgba(250,204,21,0.3)',
              color: 'var(--yellow)', lineHeight: 1.5,
            }}>
              ⚠️ Variável que o sistema não conhece: {desconhecidas.map(v => `{{${v}}}`).join(', ')}.
              Ela vai sair assim mesmo na mensagem.
            </div>
          )}

          {/* Prévia */}
          {rascunho.corpo && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', marginBottom: 7 }}>
                Prévia com dados de exemplo
              </div>
              <div style={{
                background: 'var(--surface2)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '12px 14px', fontSize: 13,
                color: 'var(--text2)', whiteSpace: 'pre-wrap', lineHeight: 1.6,
              }}>
                {previaComExemplos(rascunho.corpo)}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
            <button
              className="btn btn-primary"
              onClick={salvar}
              disabled={!rascunho.nome.trim() || !rascunho.corpo.trim()}
              style={{ opacity: rascunho.nome.trim() && rascunho.corpo.trim() ? 1 : 0.5 }}
            >
              💾 Salvar modelo
            </button>
            <button className="btn btn-ghost" onClick={fechar}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
