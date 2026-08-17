import { useState } from 'react';

const ROTULOS = {
  melhores: 'Melhores conteúdos',
  oportunidades: 'Oportunidades',
  pontos: 'Pontos fortes',
  escalar: 'Potencial de escala',
};

const CORES_CONFIANCA = { alta: 'var(--green)', media: 'var(--yellow)', baixa: 'var(--text3)' };

const TEXTO_CONFIANCA = {
  alta: 'A IA teve material suficiente para analisar.',
  media: 'A IA trabalhou com dados parciais. Confira antes de usar.',
  baixa: 'A IA teve pouca informação. Trate como chute, não como análise.',
};

/**
 * Sugestões de IA para os campos de estratégia.
 *
 * Nada é gravado sozinho. A IA erra e inventa, e trocar campo vazio por campo
 * errado é pior do que deixar vazio — vazio a pessoa vê, errado ela acredita.
 * Por isso cada sugestão tem que ser aceita uma a uma, e o que já estava
 * preenchido avisa antes de ser substituído.
 */
export default function AnaliseIA({ lead, aoAceitar, valoresAtuais = {} }) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState(null);
  const [aceitos, setAceitos] = useState([]);

  const analisar = async () => {
    setCarregando(true); setErro(''); setResultado(null); setAceitos([]);
    try {
      const { auth } = await import('../firebase');
      if (!auth.currentUser) throw new Error('Faça login novamente.');
      const token = await auth.currentUser.getIdToken();

      const r = await fetch('/api/analisar-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ lead }),
      });
      const corpo = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(corpo.error || 'Não foi possível analisar.');
      setResultado(corpo);
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  };

  const aceitar = (campo, texto) => {
    const atual = (valoresAtuais[campo] || '').trim();
    if (atual && !window.confirm(
      `"${ROTULOS[campo]}" já tem conteúdo:\n\n${atual.slice(0, 180)}${atual.length > 180 ? '…' : ''}\n\nSubstituir pela sugestão?`
    )) return;
    aoAceitar(campo, texto);
    setAceitos(a => [...a, campo]);
  };

  const sugestoes = Object.entries(resultado?.campos || {});
  const pendentes = sugestoes.filter(([campo]) => !aceitos.includes(campo));

  return (
    <div style={{
      gridColumn: '1 / -1', background: 'var(--surface2)', border: '1px solid var(--border)',
      borderRadius: 10, padding: 14, marginBottom: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button
          type="button" className="btn btn-ghost"
          style={{ fontSize: 12.5, padding: '5px 12px' }}
          onClick={analisar}
          disabled={carregando || !lead?.nome}
          title={!lead?.nome ? 'Preencha o nome do lead primeiro' : 'Analisa o site e os dados já preenchidos'}
        >
          {carregando ? '⏳ Analisando…' : '✨ Analisar com IA'}
        </button>
        <span style={{ fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.5 }}>
          Lê o site e os dados do lead e sugere o preenchimento. Nada é salvo sem você aceitar.
        </span>
      </div>

      {erro && (
        <div style={{
          marginTop: 11, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 8, padding: '9px 12px', fontSize: 12.5, color: 'var(--red)', lineHeight: 1.5,
        }}>
          ⚠️ {erro}
        </div>
      )}

      {resultado && (
        <div style={{ marginTop: 12 }}>
          <div style={{
            fontSize: 11.5, marginBottom: 10, lineHeight: 1.5,
            color: CORES_CONFIANCA[resultado.confianca] || 'var(--text3)',
          }}>
            {TEXTO_CONFIANCA[resultado.confianca]}
            {resultado.leuOSite
              ? ' Leu o site.'
              : resultado.avisoSite
                ? ` Não leu o site: ${resultado.avisoSite}.`
                : ' Sem site informado, analisou só os dados do CRM.'}
          </div>

          {pendentes.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--green)' }}>
              ✅ Todas as sugestões foram aplicadas. Confira e salve o lead.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {pendentes.map(([campo, texto]) => (
                <div
                  key={campo}
                  style={{
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 8, padding: '10px 12px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--accent)' }}>
                      {ROTULOS[campo] || campo}
                      {(valoresAtuais[campo] || '').trim() && (
                        <span style={{ color: 'var(--yellow)', fontWeight: 400 }}> · já preenchido</span>
                      )}
                    </span>
                    <button
                      type="button" className="btn btn-ghost"
                      style={{ fontSize: 11.5, padding: '3px 10px', flexShrink: 0 }}
                      onClick={() => aceitar(campo, texto)}
                    >
                      Usar
                    </button>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.55 }}>{texto}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
