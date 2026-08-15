import { useState } from 'react';
import { textoTempoNaLixeira, diasNaLixeira, vencidos, PRAZO_DIAS } from '../lixeira';

/**
 * Painel da lixeira.
 *
 * Nada aqui apaga sozinho: itens vencidos são apenas destacados. Um CRM que
 * some com dados na virada de um prazo, sem ninguém ver, é exatamente o
 * problema que a lixeira veio resolver — só que com um atraso de 30 dias.
 */
export default function LixeiraModal({
  aberto, aoFechar, itens = [], aoRestaurar, aoApagar, podeApagar = false,
}) {
  const [selecionados, setSelecionados] = useState([]);
  if (!aberto) return null;

  const agoraMs = new Date().getTime();
  const ordenados = [...itens].sort((a, b) => String(b.excluidoEm || '').localeCompare(String(a.excluidoEm || '')));
  const antigos = vencidos(itens, agoraMs);

  const alterna = (id) =>
    setSelecionados(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const marcados = ordenados.filter(i => selecionados.includes(i.id));
  const alvos = marcados.length > 0 ? marcados : [];

  const fechar = () => { setSelecionados([]); aoFechar(); };

  return (
    <div className="modal-overlay" onClick={fechar}>
      <div className="modal-content" style={{ maxWidth: 720 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">🗑 Lixeira</h2>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
              {itens.length === 0
                ? 'Nada aqui.'
                : `${itens.length} item(ns). Leads excluídos ficam guardados até alguém apagá-los de vez.`}
            </div>
          </div>
          <button className="modal-close" onClick={fechar}>✕</button>
        </div>

        {antigos.length > 0 && (
          <div style={{
            background: 'rgba(250,204,21,0.1)', border: '1px solid rgba(250,204,21,0.3)',
            borderRadius: 8, padding: '10px 13px', margin: '0 0 14px',
            fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.55,
          }}>
            {antigos.length} item(ns) estão aqui há mais de {PRAZO_DIAS} dias. Nada é
            apagado automaticamente — se já não precisa deles, vale limpar.
          </div>
        )}

        {itens.length > 0 && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
            <button
              className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 11px' }}
              onClick={() => setSelecionados(
                selecionados.length === ordenados.length ? [] : ordenados.map(i => i.id)
              )}
            >
              {selecionados.length === ordenados.length ? 'Desmarcar todos' : 'Marcar todos'}
            </button>

            <button
              className="btn btn-primary" style={{ fontSize: 12, padding: '4px 11px' }}
              disabled={alvos.length === 0}
              onClick={() => { aoRestaurar(alvos); setSelecionados([]); }}
            >
              ↩ Restaurar{alvos.length ? ` (${alvos.length})` : ''}
            </button>

            {podeApagar && (
              <button
                className="btn btn-danger" style={{ fontSize: 12, padding: '4px 11px' }}
                disabled={alvos.length === 0}
                onClick={() => { aoApagar(alvos); setSelecionados([]); }}
                title="Apaga do banco, sem volta"
              >
                Apagar em definitivo{alvos.length ? ` (${alvos.length})` : ''}
              </button>
            )}
          </div>
        )}

        <div style={{ maxHeight: '52vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {ordenados.map(item => {
            const marcado = selecionados.includes(item.id);
            const velho = diasNaLixeira(item, agoraMs) >= PRAZO_DIAS;
            return (
              <label
                key={item.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer',
                  padding: '10px 13px', borderRadius: 9,
                  background: marcado ? 'rgba(0,208,223,0.07)' : 'var(--surface2)',
                  border: `1px solid ${marcado ? 'rgba(0,208,223,0.3)' : 'var(--border)'}`,
                }}
              >
                <input
                  type="checkbox" checked={marcado}
                  onChange={() => alterna(item.id)}
                  style={{ cursor: 'pointer', flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.rotulo || '(sem nome)'}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>
                    Excluído {textoTempoNaLixeira(item, agoraMs)}
                    {item.excluidoPor ? ` por ${item.excluidoPor}` : ''}
                    {item.dados?.nicho ? ` · ${item.dados.nicho}` : ''}
                  </div>
                </div>
                {velho && (
                  <span style={{ fontSize: 10.5, color: 'var(--yellow)', flexShrink: 0, fontWeight: 600 }}>
                    +{PRAZO_DIAS}d
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
