import { useState } from 'react';

const INTENCOES = [
  { id: 'primeiro-contato', rotulo: 'Primeira abordagem', dica: 'A pessoa ainda não conhece a agência' },
  { id: 'follow-up',        rotulo: 'Retomar contato',    dica: 'Já falamos e não houve resposta' },
  { id: 'pos-reuniao',      rotulo: 'Depois da reunião',  dica: 'Retomar o que foi combinado' },
  { id: 'proposta',         rotulo: 'Falar da proposta',  dica: 'Sem pressionar, abrindo para dúvidas' },
  { id: 'reativar',         rotulo: 'Reativar lead parado', dica: 'O contato esfriou faz tempo' },
];

/**
 * Escreve a mensagem com IA a partir dos dados e do histórico do lead.
 *
 * O texto cai na caixa de escrita, não na conversa: nada sai em nome da
 * empresa sem alguém ler antes. Automação que envia sozinha rende cliente
 * perdido por uma frase que ninguém revisou.
 */
export default function EscreverComIA({
  lead, canal = 'whatsapp', atividades = [],
  empresa = '', meuNome = '', aoEscolher, compacto = false,
}) {
  const [aberto, setAberto] = useState(false);
  const [intencao, setIntencao] = useState('primeiro-contato');
  const [instrucao, setInstrucao] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [rascunho, setRascunho] = useState(null);

  if (!lead?.nome) return null;

  const fechar = () => { setAberto(false); setErro(''); setRascunho(null); };

  const escrever = async () => {
    setOcupado(true); setErro(''); setRascunho(null);
    try {
      const { auth } = await import('../firebase');
      if (!auth.currentUser) throw new Error('Faça login novamente.');
      const token = await auth.currentUser.getIdToken();

      const r = await fetch('/api/redigir-mensagem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          lead, canal, intencao, instrucao,
          // Só as mais recentes: o resto não muda o texto e ocupa o prompt
          atividades: atividades.slice(0, 8),
          empresa, meuNome,
        }),
      });
      const corpo = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(corpo.error || 'Não foi possível escrever a mensagem.');
      setRascunho(corpo);
    } catch (e) {
      setErro(e.message);
    } finally {
      setOcupado(false);
    }
  };

  const usar = () => { aoEscolher(rascunho); fechar(); };

  return (
    <div style={{ position: 'relative' }}>
      <button
        className="btn btn-ghost"
        style={{ fontSize: compacto ? 11 : 12, padding: compacto ? '5px 9px' : '6px 12px', whiteSpace: 'nowrap' }}
        onClick={() => setAberto(a => !a)}
        title="Escrever a mensagem com IA usando os dados do lead"
      >
        ✨ Escrever
      </button>

      {aberto && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={fechar} />
          <div style={{
            position: 'absolute', bottom: '100%', left: 0, marginBottom: 6, zIndex: 100,
            background: 'var(--surface)', border: '1px solid var(--border2)',
            borderRadius: 10, boxShadow: '0 12px 40px rgba(0,0,0,0.55)',
            width: 340, maxHeight: 460, overflowY: 'auto', padding: 12,
          }}>
            {rascunho ? (
              <div>
                <div style={{
                  fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.07em', color: 'var(--text3)', marginBottom: 8,
                }}>
                  Rascunho — revise antes de enviar
                </div>

                {rascunho.assunto && (
                  <div style={{
                    fontSize: 12.5, fontWeight: 600, color: 'var(--text)',
                    marginBottom: 7, paddingBottom: 7, borderBottom: '1px solid var(--border)',
                  }}>
                    {rascunho.assunto}
                  </div>
                )}

                <div style={{
                  fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.6,
                  whiteSpace: 'pre-wrap', marginBottom: 12,
                }}>
                  {rascunho.corpo}
                </div>

                <div style={{ display: 'flex', gap: 7 }}>
                  <button className="btn btn-primary" style={{ fontSize: 12, padding: '5px 12px' }} onClick={usar}>
                    Usar este texto
                  </button>
                  <button
                    className="btn btn-ghost" style={{ fontSize: 12, padding: '5px 12px' }}
                    onClick={escrever} disabled={ocupado}
                  >
                    {ocupado ? '⏳' : 'Escrever outro'}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{
                  fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.07em', color: 'var(--text3)', marginBottom: 8,
                }}>
                  Objetivo da mensagem
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 11 }}>
                  {INTENCOES.map(i => (
                    <label
                      key={i.id}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer',
                        padding: '7px 9px', borderRadius: 7,
                        background: intencao === i.id ? 'rgba(0,208,223,0.08)' : 'transparent',
                        border: `1px solid ${intencao === i.id ? 'rgba(0,208,223,0.3)' : 'var(--border)'}`,
                      }}
                    >
                      <input
                        type="radio" name="intencao" checked={intencao === i.id}
                        onChange={() => setIntencao(i.id)}
                        style={{ marginTop: 2, cursor: 'pointer', flexShrink: 0 }}
                      />
                      <span>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{i.rotulo}</span>
                        <span style={{ display: 'block', fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{i.dica}</span>
                      </span>
                    </label>
                  ))}
                </div>

                <textarea
                  className="form-control" rows={2}
                  value={instrucao}
                  onChange={e => setInstrucao(e.target.value)}
                  placeholder="Algo a mais? Ex: citar que o restaurante abriu filial"
                  style={{ fontSize: 12, marginBottom: 10 }}
                />

                {erro && (
                  <div style={{ fontSize: 11.5, color: 'var(--red)', marginBottom: 9, lineHeight: 1.5 }}>
                    ⚠️ {erro}
                  </div>
                )}

                <button
                  className="btn btn-primary" style={{ fontSize: 12, padding: '6px 13px' }}
                  onClick={escrever} disabled={ocupado}
                >
                  {ocupado ? '⏳ Escrevendo…' : '✨ Escrever mensagem'}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
