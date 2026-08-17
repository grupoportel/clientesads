import { useMemo, useState } from 'react';
import { ordenarPorPrioridade, resumoDaCarteira, FAIXAS } from '../prioridade';
import { formatarBRL } from '../pipeline';

const POR_PAGINA = 25;

function Barra({ pontos, cor }) {
  return (
    <div style={{ width: 54, height: 5, borderRadius: 3, background: 'var(--surface2)', overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ width: `${pontos}%`, height: '100%', background: cor, borderRadius: 3 }} />
    </div>
  );
}


// Fora do componente: criada dentro do render, seria uma função nova a cada
// renderização e o React remontaria as abas do zero a cada clique.
function Aba({ id, rotulo, quantidade, cor, ativa, aoClicar }) {
  return (
    <button
      className="btn btn-ghost"
      onClick={() => aoClicar(id)}
      style={{
        fontSize: 12, padding: '6px 13px',
        background: ativa ? 'var(--surface2)' : 'transparent',
        borderColor: ativa ? 'var(--border2)' : 'transparent',
        color: cor || 'var(--text2)',
      }}
    >
      {rotulo} <span style={{ opacity: 0.6 }}>({quantidade})</span>
    </button>
  );
}

/**
 * A carteira ordenada por chance de fechar.
 *
 * Cada linha mostra os motivos da nota, e não só a nota. Pontuação que não se
 * explica não é usada: ninguém liga para um lead porque um número disse 73.
 * Liga porque tem decisor identificado e está há 40 dias sem contato.
 */
export default function PainelPrioridade({ leads = [], etapas = [], aoAbrir }) {
  const [faixaAtiva, setFaixaAtiva] = useState('todas');
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);

  // Recalculado quando a carteira muda. São 691 leads e aritmética simples,
  // então não vale complicar com cache: o cálculo inteiro leva milissegundos.
  const agoraMs = useMemo(() => new Date().getTime(), []);
  const fila = useMemo(() => ordenarPorPrioridade(leads, etapas, agoraMs), [leads, etapas, agoraMs]);
  const resumo = useMemo(() => resumoDaCarteira(leads, etapas, agoraMs), [leads, etapas, agoraMs]);

  const daFaixa = faixaAtiva === 'todas'
    ? fila
    : faixaAtiva === 'urgentes'
      ? fila.filter(x => x.urgente)
      : fila.filter(x => x.faixa.id === faixaAtiva);

  // Procura no nome, na cidade e no responsável: com 690 leads na fila, achar
  // um pela rolagem não é opção.
  const filtrada = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return daFaixa;
    return daFaixa.filter(({ lead }) =>
      `${lead.nome || ''} ${lead.cidade || ''} ${lead.responsavel || ''}`
        .toLowerCase().includes(termo));
  }, [daFaixa, busca]);

  const totalPaginas = Math.max(1, Math.ceil(filtrada.length / POR_PAGINA));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const visiveis = filtrada.slice((paginaSegura - 1) * POR_PAGINA, paginaSegura * POR_PAGINA);

  const trocarFaixa = (id) => { setFaixaAtiva(id); setPagina(1); };

  if (fila.length === 0) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
        Nenhum lead em aberto para priorizar. Ganhos e perdas não entram nesta fila.
      </div>
    );
  }

  return (
    // O pai (.content) tem overflow hidden, então a rolagem tem que nascer
    // aqui. Sem isto, com 690 leads na fila só os primeiros apareciam e não
    // havia como chegar ao resto.
    <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px 60px' }}>
      <div style={{
        display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
        marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid var(--border)',
      }}>
        <Aba id="todas" rotulo="Toda a carteira" quantidade={resumo.total} ativa={faixaAtiva === 'todas'} aoClicar={trocarFaixa} />
        {resumo.urgentes > 0 && <Aba id="urgentes" rotulo="⏰ Precisa hoje" quantidade={resumo.urgentes} cor="var(--red)" ativa={faixaAtiva === 'urgentes'} aoClicar={trocarFaixa} />}
        {FAIXAS.map(f => <Aba key={f.id} id={f.id} rotulo={f.rotulo} quantidade={resumo[f.id]} cor={f.cor} ativa={faixaAtiva === f.id} aoClicar={trocarFaixa} />)}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center' }}>
          {resumo.semContato > 0 && (
            <span style={{ fontSize: 11.5, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
              {resumo.semContato} sem telefone nem e-mail
            </span>
          )}
          <input
            className="form-control"
            style={{ width: 210, fontSize: 12.5, padding: '6px 11px' }}
            placeholder="Procurar na carteira…"
            value={busca}
            onChange={e => { setBusca(e.target.value); setPagina(1); }}
          />
        </div>
      </div>

      {busca.trim() && (
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
          {filtrada.length === 0
            ? `Nenhum lead com "${busca.trim()}" nesta faixa.`
            : `${filtrada.length} lead(s) com "${busca.trim()}"`}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {visiveis.map(({ lead, pontos, faixa, motivos, alerta, urgente }) => (
          <div
            key={lead.id}
            onClick={() => aoAbrir?.(lead)}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 16, cursor: 'pointer',
              padding: '14px 18px', borderRadius: 10,
              background: 'var(--surface2)',
              border: `1px solid ${urgente ? 'rgba(239,68,68,0.35)' : 'var(--border)'}`,
            }}
          >
            <div style={{ width: 54, flexShrink: 0, textAlign: 'center' }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: faixa.cor, lineHeight: 1.1 }}>{pontos}</div>
              <div style={{ marginTop: 4, display: 'flex', justifyContent: 'center' }}>
                <Barra pontos={pontos} cor={faixa.cor} />
              </div>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{lead.nome}</span>
                {lead.responsavel && (
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>· {lead.responsavel}</span>
                )}
                {Number(lead.valor) > 0 && (
                  <span style={{ fontSize: 11.5, color: 'var(--green)' }}>{formatarBRL(Number(lead.valor))}</span>
                )}
              </div>

              {alerta && (
                <div style={{
                  fontSize: 11.5, marginTop: 3, fontWeight: 600,
                  color: urgente ? 'var(--red)' : 'var(--yellow)',
                }}>
                  {urgente ? '⏰' : '⚠️'} {alerta}
                </div>
              )}

              <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 3, lineHeight: 1.5 }}>
                {motivos.join(' · ') || 'Sem dados suficientes para avaliar'}
              </div>
            </div>
          </div>
        ))}
      </div>

      {totalPaginas > 1 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 16 }}>
          <button
            className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 11px' }}
            onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={paginaSegura === 1}
          >
            Anterior
          </button>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>
            {paginaSegura} de {totalPaginas}
          </span>
          <button
            className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 11px' }}
            onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={paginaSegura === totalPaginas}
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}
