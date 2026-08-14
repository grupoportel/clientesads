import { useState } from 'react';
import { ref, push, update } from 'firebase/database';
import { database } from '../firebase';
import { lerCSV, sugerirMapeamento } from '../csv';
import { registrarAtividade } from '../atividades';
import { etapasAtivas } from '../pipeline';

// Campos do CRM que a importação sabe preencher. "apelidos" são outros títulos
// de coluna que aparecem em planilhas reais e que devem casar automaticamente.
export const CAMPOS_IMPORTAVEIS = [
  { campo: 'nome',           rotulo: 'Nome / Empresa', obrigatorio: true, apelidos: ['empresa', 'razaosocial', 'cliente', 'nomefantasia'] },
  { campo: 'valor',          rotulo: 'Valor',          apelidos: ['valornegocio', 'ticket', 'valorcontrato', 'preco'] },
  { campo: 'telefone',       rotulo: 'Telefone',       apelidos: ['fone', 'tel', 'telefone1'] },
  { campo: 'whatsapp',       rotulo: 'WhatsApp',       apelidos: ['celular', 'zap', 'wpp'] },
  { campo: 'email',          rotulo: 'E-mail',         apelidos: ['mail', 'emailcontato'] },
  { campo: 'nicho',          rotulo: 'Nicho',          apelidos: ['segmento', 'mercado', 'categoria'] },
  { campo: 'responsavel',    rotulo: 'Responsável',    apelidos: ['dono', 'vendedor', 'consultor'] },
  { campo: 'estado',         rotulo: 'Estado',         apelidos: ['uf'] },
  { campo: 'cidade',         rotulo: 'Cidade',         apelidos: ['municipio'] },
  { campo: 'origem',         rotulo: 'Origem',         apelidos: ['canal', 'fonte'] },
  { campo: 'decisor',        rotulo: 'Decisor',        apelidos: ['contato', 'responsavelempresa'] },
  { campo: 'cnpj',           rotulo: 'CNPJ',           apelidos: ['documento'] },
  { campo: 'instagram',      rotulo: 'Instagram',      apelidos: ['ig', 'insta'] },
  { campo: 'site',           rotulo: 'Site',           apelidos: ['website', 'url'] },
  { campo: 'nota',           rotulo: 'Nota',           apelidos: ['notagoogle', 'avaliacao'] },
  { campo: 'avaliacoes',     rotulo: 'Avaliações',     apelidos: ['qtdavaliacoes', 'numeroavaliacoes'] },
  { campo: 'obs',            rotulo: 'Observação',     apelidos: ['observacoes', 'anotacoes', 'notas'] },
];

const IGNORAR = -1;

// Aceita "R$ 2.500,00", "2500.00" e "2.500" e devolve número
function lerNumero(texto) {
  if (texto === null || texto === undefined || texto === '') return '';
  const limpo = String(texto).replace(/[^\d,.-]/g, '');
  if (!limpo) return '';
  // Se tem vírgula depois do último ponto, a vírgula é o decimal (padrão BR)
  const brasileiro = limpo.lastIndexOf(',') > limpo.lastIndexOf('.');
  const normalizado = brasileiro
    ? limpo.replace(/\./g, '').replace(',', '.')
    : limpo.replace(/,/g, '');
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : '';
}

export default function ImportarLeadsModal({ isOpen, onClose, onConcluido, etapas = [], responsaveis = [] }) {
  const [etapaAtual, setEtapaAtual] = useState('arquivo'); // arquivo | mapear | importando | fim
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [colunas, setColunas] = useState([]);
  const [linhas, setLinhas] = useState([]);
  const [mapa, setMapa] = useState({});
  const [statusPadrao, setStatusPadrao] = useState('lead-qualificado');
  const [responsavelPadrao, setResponsavelPadrao] = useState('');
  const [erro, setErro] = useState('');
  const [progresso, setProgresso] = useState({ feitos: 0, total: 0, ignorados: 0 });

  const reiniciar = () => {
    setEtapaAtual('arquivo'); setNomeArquivo(''); setColunas([]); setLinhas([]);
    setMapa({}); setErro(''); setProgresso({ feitos: 0, total: 0, ignorados: 0 });
  };

  const fechar = () => { reiniciar(); onClose(); };

  const aoEscolherArquivo = (evento) => {
    const arquivo = evento.target.files?.[0];
    if (!arquivo) return;
    setErro('');

    const leitor = new FileReader();
    leitor.onload = () => {
      try {
        const { colunas: cols, linhas: lins } = lerCSV(String(leitor.result));
        if (cols.length === 0 || lins.length === 0) {
          setErro('O arquivo não tem linhas de dados. Confira se a primeira linha é o cabeçalho.');
          return;
        }
        setNomeArquivo(arquivo.name);
        setColunas(cols);
        setLinhas(lins);
        setMapa(sugerirMapeamento(cols, CAMPOS_IMPORTAVEIS));
        setEtapaAtual('mapear');
      } catch {
        setErro('Não foi possível ler este arquivo. Salve como CSV e tente de novo.');
      }
    };
    leitor.onerror = () => setErro('Falha ao abrir o arquivo.');
    leitor.readAsText(arquivo, 'UTF-8');
  };

  const valorDaLinha = (linha, campo) => {
    const indice = mapa[campo];
    if (indice === undefined || indice === IGNORAR) return '';
    return (linha[indice] ?? '').trim();
  };

  const importar = async () => {
    const indiceNome = mapa.nome;
    if (indiceNome === undefined || indiceNome === IGNORAR) {
      setErro('Escolha qual coluna do arquivo contém o nome. Sem isso não dá para criar o lead.');
      return;
    }

    setEtapaAtual('importando');
    setErro('');

    const agora = new Date().toISOString();
    let feitos = 0;
    let ignorados = 0;
    const gravacoes = {};
    const paraHistorico = [];

    linhas.forEach(linha => {
      const nome = valorDaLinha(linha, 'nome');
      if (!nome) { ignorados++; return; }

      const novo = { nome, status: statusPadrao, createdAt: agora, updatedAt: agora, origemImportacao: nomeArquivo };

      CAMPOS_IMPORTAVEIS.forEach(({ campo }) => {
        if (campo === 'nome') return;
        const bruto = valorDaLinha(linha, campo);
        if (!bruto) return;
        novo[campo] = (campo === 'valor' || campo === 'nota' || campo === 'avaliacoes')
          ? lerNumero(bruto)
          : bruto;
      });

      if (!novo.responsavel && responsavelPadrao) novo.responsavel = responsavelPadrao;

      const novaRef = push(ref(database, 'crm_data/leads'));
      novo.id = novaRef.key;
      gravacoes[novaRef.key] = novo;
      paraHistorico.push({ id: novaRef.key, nome });
      feitos++;
    });

    setProgresso({ feitos, total: linhas.length, ignorados });

    try {
      // Uma única gravação em lote em vez de N chamadas separadas
      await update(ref(database, 'crm_data/leads'), gravacoes);

      paraHistorico.slice(0, 200).forEach(({ id, nome }) => {
        registrarAtividade({
          leadId: id, leadNome: nome, tipo: 'importado',
          descricao: `Lead importado da planilha "${nomeArquivo}"`,
        });
      });

      setEtapaAtual('fim');
      onConcluido?.(feitos);
    } catch (e) {
      setErro('Falha ao gravar no banco: ' + e.message);
      setEtapaAtual('mapear');
    }
  };

  if (!isOpen) return null;

  const previa = linhas.slice(0, 5);
  const camposMapeados = CAMPOS_IMPORTAVEIS.filter(c => mapa[c.campo] !== undefined && mapa[c.campo] !== IGNORAR);

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div className="modal" style={{ maxWidth: 860, width: '100%', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>

        <div className="modal-header">
          <div className="modal-title">📥 Importar Leads de Planilha</div>
          <button className="btn-icon" onClick={fechar} aria-label="Fechar">✕</button>
        </div>

        <div className="modal-body" style={{ overflowY: 'auto' }}>

          {/* ── Passo 1: escolher arquivo ── */}
          {etapaAtual === 'arquivo' && (
            <>
              <label
                htmlFor="arquivo-csv"
                style={{
                  display: 'block', border: '2px dashed var(--border2)', borderRadius: 12,
                  padding: '40px 24px', textAlign: 'center', cursor: 'pointer',
                  transition: 'border-color 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border2)'}
              >
                <div style={{ fontSize: 40, marginBottom: 10 }}>📄</div>
                <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
                  Escolher arquivo CSV
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>
                  A primeira linha precisa ser o cabeçalho com os nomes das colunas.<br />
                  No Excel ou Google Planilhas: Arquivo → Baixar → CSV.
                </div>
                <input
                  id="arquivo-csv"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={aoEscolherArquivo}
                  style={{ display: 'none' }}
                />
              </label>

              <div style={{
                marginTop: 16, padding: '12px 14px', borderRadius: 8,
                background: 'var(--surface2)', border: '1px solid var(--border)',
                fontSize: 12, color: 'var(--text3)', lineHeight: 1.6,
              }}>
                <strong style={{ color: 'var(--text2)' }}>Dica:</strong> exporte primeiro os leads
                que já existem (botão “Exportar”) para ver o formato que o sistema espera.
                As colunas são reconhecidas automaticamente pelo nome.
              </div>
            </>
          )}

          {/* ── Passo 2: mapear colunas ── */}
          {etapaAtual === 'mapear' && (
            <>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 12, flexWrap: 'wrap', marginBottom: 18,
                padding: '10px 14px', borderRadius: 8,
                background: 'rgba(0,208,223,0.08)', border: '1px solid rgba(0,208,223,0.25)',
              }}>
                <span style={{ fontSize: 13, color: 'var(--text)' }}>
                  📄 <strong>{nomeArquivo}</strong> — {linhas.length} linha{linhas.length !== 1 ? 's' : ''},
                  {' '}{camposMapeados.length} coluna{camposMapeados.length !== 1 ? 's' : ''} reconhecida{camposMapeados.length !== 1 ? 's' : ''}
                </span>
                <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={reiniciar}>
                  Trocar arquivo
                </button>
              </div>

              <div className="form-section-title">🔗 De onde vem cada informação</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10, marginBottom: 22 }}>
                {CAMPOS_IMPORTAVEIS.map(campo => (
                  <div key={campo.campo} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontSize: 12, color: campo.obrigatorio ? 'var(--text)' : 'var(--text3)',
                      width: 120, flexShrink: 0, fontWeight: campo.obrigatorio ? 600 : 400,
                    }}>
                      {campo.rotulo}{campo.obrigatorio && <span style={{ color: 'var(--red)' }}> *</span>}
                    </span>
                    <select
                      className="form-control"
                      style={{ fontSize: 12, padding: '5px 8px', flex: 1, minWidth: 0 }}
                      value={mapa[campo.campo] ?? IGNORAR}
                      onChange={e => setMapa(m => ({ ...m, [campo.campo]: Number(e.target.value) }))}
                    >
                      <option value={IGNORAR}>— não importar —</option>
                      {colunas.map((c, i) => (
                        <option key={i} value={i}>{c || `Coluna ${i + 1}`}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="form-section-title">⚙️ Valores para todos os leads importados</div>
              <div className="form-grid" style={{ marginBottom: 22 }}>
                <div className="form-group">
                  <label className="form-label">Status inicial</label>
                  <select className="form-control" value={statusPadrao} onChange={e => setStatusPadrao(e.target.value)}>
                    {etapasAtivas(etapas).map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Responsável (quando a planilha não trouxer)</label>
                  <select className="form-control" value={responsavelPadrao} onChange={e => setResponsavelPadrao(e.target.value)}>
                    <option value="">— deixar em branco —</option>
                    {responsaveis.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-section-title">👁 Prévia das primeiras linhas</div>
              <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                <table className="finance-table" style={{ width: '100%', fontSize: 12 }}>
                  <thead>
                    <tr>
                      {camposMapeados.map(c => <th key={c.campo} style={{ whiteSpace: 'nowrap' }}>{c.rotulo}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {previa.map((linha, i) => (
                      <tr key={i}>
                        {camposMapeados.map(c => (
                          <td key={c.campo} style={{ whiteSpace: 'nowrap', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {valorDaLinha(linha, c.campo) || <span style={{ color: 'var(--text3)' }}>—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {linhas.length > 5 && (
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
                  + {linhas.length - 5} linha(s) além destas.
                </div>
              )}
            </>
          )}

          {/* ── Passo 3: importando ── */}
          {etapaAtual === 'importando' && (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: 40, marginBottom: 14 }}>⏳</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Gravando os leads…</div>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 6 }}>
                Não feche esta janela.
              </div>
            </div>
          )}

          {/* ── Passo 4: resultado ── */}
          {etapaAtual === 'fim' && (
            <div style={{ textAlign: 'center', padding: '48px 20px' }}>
              <div style={{ fontSize: 44, marginBottom: 14 }}>✅</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                {progresso.feitos} lead{progresso.feitos !== 1 ? 's' : ''} importado{progresso.feitos !== 1 ? 's' : ''}
              </div>
              {progresso.ignorados > 0 && (
                <div style={{ fontSize: 13, color: 'var(--yellow)', marginBottom: 8 }}>
                  {progresso.ignorados} linha(s) ignorada(s) por estarem sem nome.
                </div>
              )}
              <div style={{ fontSize: 13, color: 'var(--text3)' }}>
                Cada lead importado já entrou com o registro na linha do tempo.
              </div>
            </div>
          )}

          {erro && (
            <div style={{
              marginTop: 16, padding: '10px 14px', borderRadius: 8,
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              color: 'var(--red)', fontSize: 13,
            }}>
              ⚠️ {erro}
            </div>
          )}
        </div>

        <div className="modal-footer">
          {etapaAtual === 'fim' ? (
            <button className="btn btn-primary" onClick={fechar}>Concluir</button>
          ) : (
            <>
              <button className="btn btn-ghost" onClick={fechar}>Cancelar</button>
              {etapaAtual === 'mapear' && (
                <button className="btn btn-primary" onClick={importar}>
                  📥 Importar {linhas.length} lead{linhas.length !== 1 ? 's' : ''}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
