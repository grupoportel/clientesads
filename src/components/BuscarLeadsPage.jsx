import { useState, useMemo } from 'react';
import { NICHOS_UI, UFS, nomeDaFatia } from '../prospeccaoNichos';
import { lerCSV } from '../csv';
import { prepararRevisao, resumoDaRevisao, ordenarRevisao } from '../prospeccao';

const POR_PAGINA = 50;

// Fora do componente: criada dentro do render, seria uma função nova a cada
// renderização e o React remontaria os cartões a cada tecla digitada.
function Cartao({ item, aoAlternar }) {
  const { candidato, pontos, motivos, existente, importar } = item;
  return (
    <label
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
        padding: '10px 13px', borderRadius: 8,
        background: importar ? 'rgba(0,208,223,0.06)' : 'var(--surface2)',
        border: `1px solid ${importar ? 'rgba(0,208,223,0.28)' : 'var(--border)'}`,
      }}
    >
      <input
        type="checkbox" checked={importar}
        onChange={() => aoAlternar(item.indice)}
        style={{ marginTop: 3, flexShrink: 0, cursor: 'pointer' }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{candidato.nome}</span>
          {candidato.cidade && <span style={{ fontSize: 11, color: 'var(--text3)' }}>· {candidato.cidade}</span>}
          {!existente && <span style={{ fontSize: 11, color: 'var(--accent)' }}>{pontos} pts</span>}
        </div>

        {existente && (
          <div style={{ fontSize: 11.5, color: 'var(--yellow)', marginTop: 2 }}>
            ⚠️ Já está na sua base como "{existente.nome}" — mesmo {existente.por}
          </div>
        )}

        <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2, lineHeight: 1.45 }}>
          {[candidato.telefone, candidato.email].filter(Boolean).join(' · ') || 'Sem contato'}
          {motivos.length > 0 && ` — ${motivos.join(' · ')}`}
        </div>
      </div>
    </label>
  );
}

/**
 * Busca empresas por nicho e estado nas fatias geradas pelo preparo.
 *
 * O arquivo é lido direto do disco pelo navegador, não subido para lugar
 * nenhum. Isso evita depender de Storage, de credencial no computador e de
 * esperar upload de centenas de MB — e os dados da Receita nem saem da
 * máquina de quem busca.
 */
export default function BuscarLeadsPage({ leads = [], aoImportar, podeEditar = true }) {
  const [pasta, setPasta] = useState(null);
  const [nicho, setNicho] = useState(NICHOS_UI[0].id);
  const [uf, setUf] = useState('MT');
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [revisao, setRevisao] = useState(null);
  const [pagina, setPagina] = useState(1);
  const [importando, setImportando] = useState(false);

  const suportaPasta = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

  const escolherPasta = async () => {
    setErro('');
    try {
      const escolhida = await window.showDirectoryPicker({ id: 'prospeccao', mode: 'read' });
      setPasta(escolhida);
    } catch (e) {
      if (e.name !== 'AbortError') setErro('Não consegui abrir a pasta: ' + e.message);
    }
  };

  const lerTexto = async (arquivo) => {
    const texto = await arquivo.text();
    // O preparo grava com marca de ordem de bytes para o Excel ler acento;
    // aqui ela precisa sair, senão gruda no primeiro cabeçalho.
    return texto.charCodeAt(0) === 0xFEFF ? texto.slice(1) : texto;
  };

  const montarRevisao = (texto) => {
    const { colunas, linhas } = lerCSV(texto);
    const indice = (nome) => colunas.findIndex(c => c.toLowerCase().startsWith(nome));
    const col = {
      nome: indice('nome'), cnpj: indice('cnpj'), telefone: indice('telefone'),
      whatsapp: indice('whatsapp'), email: indice('e-mail'), cidade: indice('cidade'),
      estado: indice('estado'), nicho: indice('nicho'),
    };

    const candidatos = linhas.map(l => {
      const c = {};
      Object.entries(col).forEach(([campo, i]) => { if (i >= 0 && l[i]) c[campo] = l[i]; });
      return c;
    });

    setRevisao(ordenarRevisao(prepararRevisao(candidatos, leads)));
    setPagina(1);
  };

  const buscar = async () => {
    if (!pasta) return;
    setCarregando(true); setErro(''); setRevisao(null);
    try {
      const arquivo = await pasta.getFileHandle(nomeDaFatia(nicho, uf));
      montarRevisao(await lerTexto(await arquivo.getFile()));
    } catch (e) {
      setErro(e.name === 'NotFoundError'
        ? `Não há empresas desse nicho em ${uf}, ou o preparo ainda não gerou essa fatia.`
        : 'Falha ao ler a fatia: ' + e.message);
    } finally {
      setCarregando(false);
    }
  };

  const buscarPorArquivo = async (evento) => {
    const arquivo = evento.target.files?.[0];
    if (!arquivo) return;
    setCarregando(true); setErro(''); setRevisao(null);
    try {
      montarRevisao(await lerTexto(arquivo));
    } catch (e) {
      setErro('Falha ao ler o arquivo: ' + e.message);
    } finally {
      setCarregando(false);
    }
  };

  const alternar = (indice) =>
    setRevisao(r => r.map(i => (i.indice === indice ? { ...i, importar: !i.importar } : i)));

  const marcarVisiveis = (valor) => {
    const nosVisiveis = new Set(visiveis.map(v => v.indice));
    setRevisao(r => r.map(i => (nosVisiveis.has(i.indice) ? { ...i, importar: valor && !i.existente } : i)));
  };

  const filtrada = useMemo(() => {
    if (!revisao) return [];
    const termo = busca.trim().toLowerCase();
    if (!termo) return revisao;
    return revisao.filter(i =>
      `${i.candidato.nome} ${i.candidato.cidade || ''}`.toLowerCase().includes(termo));
  }, [revisao, busca]);

  const totalPaginas = Math.max(1, Math.ceil(filtrada.length / POR_PAGINA));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const visiveis = filtrada.slice((paginaSegura - 1) * POR_PAGINA, paginaSegura * POR_PAGINA);

  const resumo = revisao ? resumoDaRevisao(revisao) : null;
  const marcados = revisao ? revisao.filter(i => i.importar) : [];

  const importar = async () => {
    setImportando(true);
    try {
      await aoImportar(marcados.map(i => i.candidato), NICHOS_UI.find(n => n.id === nicho)?.nome || '');
      setRevisao(null);
    } catch (e) {
      setErro('Falha ao importar: ' + e.message);
    } finally {
      setImportando(false);
    }
  };

  const nichoAtual = NICHOS_UI.find(n => n.id === nicho);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">🔎 Buscar Leads</h1>
        <p className="page-subtitle">
          Empresas da base pública da Receita Federal, por nicho e estado.
        </p>
      </div>

      {/* ── Onde estão os dados ── */}
      {!pasta && (
        <div className="crm-card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.65, marginBottom: 13 }}>
            Escolha a pasta <code style={{ color: 'var(--accent)' }}>dados-prospeccao</code>, gerada
            pelo atalho <strong>Preparar Prospecção</strong>. O arquivo é lido aqui no seu
            computador — nada é enviado para a internet.
          </div>

          {suportaPasta ? (
            <button className="btn btn-primary" onClick={escolherPasta}>
              📁 Escolher a pasta
            </button>
          ) : (
            <div>
              <div style={{ fontSize: 12.5, color: 'var(--yellow)', marginBottom: 10, lineHeight: 1.55 }}>
                Este navegador não deixa escolher uma pasta inteira. Dá para abrir um arquivo por vez,
                ou usar o Chrome para escolher a pasta uma vez só.
              </div>
              <label className="btn btn-ghost" style={{ display: 'inline-block', cursor: 'pointer' }}>
                📄 Abrir um arquivo
                <input type="file" accept=".csv" onChange={buscarPorArquivo} style={{ display: 'none' }} />
              </label>
            </div>
          )}
        </div>
      )}

      {/* ── Busca ── */}
      {pasta && (
        <div className="crm-card" style={{ marginBottom: 16 }}>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Nicho</label>
              <select className="form-control" value={nicho} onChange={e => setNicho(e.target.value)}>
                {NICHOS_UI.map(n => <option key={n.id} value={n.id}>{n.nome}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Estado</label>
              <select className="form-control" value={uf} onChange={e => setUf(e.target.value)}>
                {UFS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          {nichoAtual?.aviso && (
            <div style={{
              background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.3)',
              borderRadius: 8, padding: '9px 12px', margin: '4px 0 13px',
              fontSize: 12, color: 'var(--text2)', lineHeight: 1.55,
            }}>
              ⚠️ {nichoAtual.aviso}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={buscar} disabled={carregando}>
              {carregando ? '⏳ Lendo…' : '🔎 Buscar'}
            </button>
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setPasta(null)}>
              Trocar de pasta
            </button>
          </div>
        </div>
      )}

      {erro && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 8, padding: '11px 14px', marginBottom: 14,
          fontSize: 12.5, color: 'var(--red)', lineHeight: 1.55,
        }}>
          ⚠️ {erro}
        </div>
      )}

      {/* ── Resultado ── */}
      {revisao && (
        <div className="crm-card">
          <div style={{
            display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center',
            paddingBottom: 12, marginBottom: 13, borderBottom: '1px solid var(--border)', fontSize: 12.5,
          }}>
            <span style={{ color: 'var(--green)' }}><strong>{resumo.novos}</strong> novos</span>
            {resumo.duplicados > 0 && (
              <span style={{ color: 'var(--yellow)' }}><strong>{resumo.duplicados}</strong> já na base</span>
            )}
            <span style={{ color: 'var(--text3)' }}>{resumo.total} encontrados</span>
            <input
              className="form-control"
              style={{ width: 180, fontSize: 12, padding: '5px 10px', marginLeft: 'auto' }}
              placeholder="Filtrar por nome…"
              value={busca}
              onChange={e => { setBusca(e.target.value); setPagina(1); }}
            />
          </div>

          <div style={{ display: 'flex', gap: 7, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn btn-ghost" style={{ fontSize: 11.5, padding: '4px 11px' }} onClick={() => marcarVisiveis(true)}>
              Marcar os {visiveis.length} desta página
            </button>
            <button className="btn btn-ghost" style={{ fontSize: 11.5, padding: '4px 11px' }} onClick={() => marcarVisiveis(false)}>
              Desmarcar
            </button>
            {podeEditar && (
              <button
                className="btn btn-primary"
                style={{ fontSize: 12, padding: '5px 13px', marginLeft: 'auto' }}
                onClick={importar}
                disabled={marcados.length === 0 || importando}
              >
                {importando ? '⏳ Importando…' : `📥 Importar ${marcados.length} lead(s)`}
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {visiveis.map(item => <Cartao key={item.indice} item={item} aoAlternar={alternar} />)}
          </div>

          {totalPaginas > 1 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 15 }}>
              <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 11px' }}
                onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={paginaSegura === 1}>
                Anterior
              </button>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>{paginaSegura} de {totalPaginas}</span>
              <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 11px' }}
                onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={paginaSegura === totalPaginas}>
                Próxima
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
