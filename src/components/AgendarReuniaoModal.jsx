import { useState } from 'react';

/** Sugere amanhã às 10h — quase nunca é hoje, e quase nunca é de madrugada. */
function proximoHorario() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const dd = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}T10:00`;
}

const DURACOES = [30, 45, 60, 90];

// Fora do componente de propósito: criada dentro do render, ela seria uma
// função nova a cada renderização, e o React remontaria as etapas do zero.
function Etapa({ rotulo, estado, link }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 9, padding: '8px 11px',
      borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border)',
    }}>
      <span style={{ flexShrink: 0, fontSize: 13 }}>{estado.feito ? '✅' : '⚠️'}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, color: estado.feito ? 'var(--text)' : 'var(--text2)' }}>{rotulo}</div>
        {!estado.feito && estado.motivo && (
          <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2, lineHeight: 1.5 }}>{estado.motivo}</div>
        )}
        {link && (
          <a href={link} target="_blank" rel="noreferrer"
             style={{ fontSize: 11.5, color: 'var(--accent)', marginTop: 2, display: 'inline-block' }}>
            Abrir no Google Agenda ↗
          </a>
        )}
      </div>
    </div>
  );
}


/**
 * Marca a reunião em três lugares: evento no Google Agenda, e-mail de
 * confirmação e tarefa de confirmar por mensagem.
 *
 * As três etapas são independentes, então o resultado é mostrado etapa a etapa
 * em vez de "deu certo" ou "deu erro". Se o e-mail falhou mas o evento entrou,
 * quem está na tela precisa saber exatamente isso — senão remarca tudo achando
 * que nada aconteceu.
 */
export default function AgendarReuniaoModal({ aberto, aoFechar, lead }) {
  const [dataHora, setDataHora] = useState(proximoHorario);
  const [duracao, setDuracao] = useState(60);
  const [observacao, setObservacao] = useState('');
  const [enviarEmail, setEnviarEmail] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState(null);

  if (!aberto || !lead) return null;

  const fechar = () => {
    setResultado(null); setErro(''); setObservacao('');
    setDataHora(proximoHorario()); setDuracao(60); setEnviarEmail(true);
    aoFechar();
  };

  const marcar = async () => {
    setOcupado(true); setErro(''); setResultado(null);
    try {
      const { auth } = await import('../firebase');
      if (!auth.currentUser) throw new Error('Faça login novamente.');
      const token = await auth.currentUser.getIdToken();

      const r = await fetch('/api/agendar-reuniao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ lead, dataHora, duracaoMin: duracao, observacao, enviarEmail }),
      });
      const corpo = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(corpo.error || 'Não foi possível marcar a reunião.');
      setResultado(corpo);
    } catch (e) {
      setErro(e.message);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={fechar}>
      <div className="modal-content" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">📅 Marcar reunião</h2>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{lead.nome}</div>
          </div>
          <button className="modal-close" onClick={fechar}>✕</button>
        </div>

        {erro && (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 8, padding: '10px 13px', marginBottom: 14, fontSize: 12.5, color: 'var(--red)',
          }}>
            ⚠️ {erro}
          </div>
        )}

        {resultado ? (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 16 }}>
              <Etapa rotulo="Evento criado no Google Agenda" estado={resultado.agenda} link={resultado.agenda.link} />
              <Etapa
                rotulo={resultado.email.feito ? `E-mail de confirmação enviado para ${lead.email}` : 'E-mail de confirmação'}
                estado={resultado.email}
              />
              <Etapa rotulo="Tarefa criada: confirmar por mensagem" estado={resultado.tarefa} />
              <Etapa rotulo="Data da reunião salva no lead" estado={resultado.lead} />
            </div>
            <button className="btn btn-primary" onClick={fechar}>Fechar</button>
          </div>
        ) : (
          <>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Data e hora <span style={{ color: 'var(--red)' }}>*</span></label>
                <input
                  className="form-control" type="datetime-local"
                  value={dataHora} onChange={e => setDataHora(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Duração</label>
                <select className="form-control" value={duracao} onChange={e => setDuracao(Number(e.target.value))}>
                  {DURACOES.map(d => <option key={d} value={d}>{d} minutos</option>)}
                </select>
              </div>
              <div className="form-group full">
                <label className="form-label">Observação (entra no evento e no e-mail)</label>
                <textarea
                  className="form-control" rows={2}
                  value={observacao} onChange={e => setObservacao(e.target.value)}
                  placeholder="Ex: reunião online, link enviado depois"
                />
              </div>
            </div>

            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: 9, cursor: lead.email ? 'pointer' : 'not-allowed',
              marginTop: 4, marginBottom: 16, opacity: lead.email ? 1 : 0.55,
            }}>
              <input
                type="checkbox" checked={enviarEmail && Boolean(lead.email)}
                disabled={!lead.email}
                onChange={e => setEnviarEmail(e.target.checked)}
                style={{ marginTop: 2 }}
              />
              <span style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5 }}>
                Enviar e-mail de confirmação
                {lead.email
                  ? <span style={{ color: 'var(--text3)' }}> para {lead.email}</span>
                  : <span style={{ color: 'var(--yellow)' }}> — este lead não tem e-mail cadastrado</span>}
              </span>
            </label>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={marcar} disabled={ocupado || !dataHora}>
                {ocupado ? '⏳ Marcando…' : '📅 Marcar reunião'}
              </button>
              <button className="btn btn-ghost" onClick={fechar}>Cancelar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
