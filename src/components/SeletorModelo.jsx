import { useState } from 'react';
import { aplicarModelo, montarContexto, variaveisVazias, VARIAVEIS } from '../modelos';

// Escolhe um modelo e devolve o texto já com as variáveis trocadas pelos dados
// do lead. Avisa antes quando o modelo cita algo que este lead não tem — mandar
// "Olá , tudo bem?" para um cliente é pior do que não usar modelo nenhum.
export default function SeletorModelo({
  modelos = [], canal = 'whatsapp', lead = null,
  empresa = '', meuNome = '', onEscolher, compacto = false,
}) {
  const [aberto, setAberto] = useState(false);
  const doCanal = modelos.filter(m => m.canal === canal);

  if (doCanal.length === 0) return null;

  const contexto = montarContexto(lead || {}, { empresa, meuNome });

  const escolher = (modelo) => {
    const faltando = variaveisVazias(modelo.corpo, contexto);

    if (faltando.length > 0) {
      const nomes = faltando
        .map(chave => VARIAVEIS.find(v => v.chave === chave)?.rotulo || chave)
        .join(', ');
      const seguir = window.confirm(
        `Este modelo usa ${nomes}, e ${lead?.nome ? `"${lead.nome}"` : 'este contato'} não tem esse dado preenchido.\n\n` +
        'Se continuar, o texto vai sair com esse trecho em branco.\n\nUsar mesmo assim?'
      );
      if (!seguir) return;
    }

    onEscolher({
      corpo: aplicarModelo(modelo.corpo, contexto),
      assunto: modelo.assunto ? aplicarModelo(modelo.assunto, contexto) : '',
    });
    setAberto(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        className="btn btn-ghost"
        style={{ fontSize: compacto ? 11 : 12, padding: compacto ? '5px 9px' : '6px 12px', whiteSpace: 'nowrap' }}
        onClick={() => setAberto(a => !a)}
        title="Usar um modelo de mensagem"
      >
        ✍️ Modelos
      </button>

      {aberto && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setAberto(false)} />
          <div style={{
            position: 'absolute', bottom: '100%', left: 0, marginBottom: 6, zIndex: 100,
            background: 'var(--surface)', border: '1px solid var(--border2)',
            borderRadius: 10, boxShadow: '0 12px 40px rgba(0,0,0,0.55)',
            width: 290, maxHeight: 320, overflowY: 'auto', padding: 6,
          }}>
            <div style={{
              padding: '6px 9px', fontSize: 10.5, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text3)',
              borderBottom: '1px solid var(--border)', marginBottom: 4,
            }}>
              Modelos de {canal === 'email' ? 'e-mail' : 'WhatsApp'}
            </div>

            {doCanal.map(m => (
              <button
                key={m.id}
                onClick={() => escolher(m)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '8px 9px', borderRadius: 7, cursor: 'pointer',
                  background: 'transparent', border: 'none', fontFamily: 'inherit',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{m.nome}</div>
                <div style={{
                  fontSize: 11, color: 'var(--text3)', marginTop: 2,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {aplicarModelo(m.corpo, contexto)}
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
