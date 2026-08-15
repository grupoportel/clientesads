import { useState, useMemo, useEffect } from 'react';
import { acharEtapa, etapasAtivas, formatarBRL } from '../pipeline';
import { formataData } from '../periodo';
import { useTelaEstreita } from '../useTelaEstreita';

const ORIGEM_OPTIONS = [
  { value: 'gmn', label: 'GMN' }, { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'instagram', label: 'Instagram' }, { value: 'telefone', label: 'Telefone' },
  { value: 'email', label: 'E-mail' }, { value: 'indicacao', label: 'Indicação' },
  { value: 'site', label: 'Site / Inbound' }, { value: 'outro', label: 'Outro' },
];

const limpaTel = (t) => String(t || '').replace(/\D/g, '');
const urlIg = (ig) => {
  if (!ig) return '';
  if (ig.startsWith('http')) return ig;
  return 'https://instagram.com/' + ig.replace('@', '').trim();
};
const urlSite = (s) => (s ? (s.startsWith('http') ? s : 'https://' + s) : '');

const Vazio = () => <span className="td-empty">—</span>;

const CHAVE_COLUNAS = 'crm.leads.colunasOcultas';
const CHAVE_POR_PAGINA = 'crm.leads.porPagina';

// Campos numéricos de verdade — usados para ordenar por número em vez de texto,
// onde "10" vinha antes de "9".
const CAMPOS_NUMERICOS = new Set(['valor', 'nota', 'avaliacoes']);
// Campos de data no formato AAAA-MM-DD, que já ordenam corretamente como texto
const CAMPOS_DATA = new Set(['ultimo_contato', 'reuniao', 'data_entrada', 'createdAt']);

/* ─────────────────────────────────────────────
   Célula editável
   ───────────────────────────────────────────── */
function CelulaEditavel({ lead, campo, tipo = 'text', opcoes = [], editCell, setEditCell, onInlineEdit, children }) {
  const editando = editCell.id === lead.id && editCell.field === campo;

  const iniciar = () => setEditCell({ id: lead.id, field: campo, value: lead[campo] ?? '' });
  const salvar = (e) => {
    if (e) e.stopPropagation();
    if (editCell.id) onInlineEdit(editCell.id, editCell.field, editCell.value);
    setEditCell({ id: null, field: null, value: '' });
  };
  const cancelar = (e) => {
    if (e) e.stopPropagation();
    setEditCell({ id: null, field: null, value: '' });
  };
  const aoTeclar = (e) => {
    if (e.key === 'Enter') salvar(e);
    if (e.key === 'Escape') cancelar(e);
  };

  if (!editando) {
    return (
      <div
        onClick={iniciar}
        style={{ cursor: 'pointer', minHeight: 20, display: 'flex', alignItems: 'center' }}
        title="Clique para editar"
      >
        {children}
      </div>
    );
  }

  const estilo = { padding: 4, height: 26, fontSize: 11, minWidth: tipo === 'select' ? 120 : 100 };

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
      {tipo === 'select' ? (
        <select
          autoFocus className="form-control" style={estilo}
          value={editCell.value}
          onChange={e => setEditCell({ ...editCell, value: e.target.value })}
          onKeyDown={aoTeclar}
        >
          <option value="">— selecione —</option>
          {opcoes.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input
          autoFocus type={tipo} className="form-control" style={estilo}
          value={editCell.value}
          onChange={e => setEditCell({ ...editCell, value: e.target.value })}
          onKeyDown={aoTeclar}
        />
      )}
      <button className="btn-icon" style={{ padding: '4px 6px', background: 'var(--green)', color: '#fff', border: 'none', minHeight: 26 }} onClick={salvar} title="Salvar (Enter)">✓</button>
      <button className="btn-icon" style={{ padding: '4px 6px', background: 'var(--surface3)', color: 'var(--text)', border: 'none', minHeight: 26 }} onClick={cancelar} title="Cancelar (Esc)">✕</button>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Escolher colunas visíveis
   ───────────────────────────────────────────── */
function EscolherColunas({ colunas, ocultas, alternar, mostrarTodas }) {
  const [aberto, setAberto] = useState(false);
  const escondidas = ocultas.size;

  return (
    <div style={{ position: 'relative' }}>
      <button
        className="btn btn-ghost"
        style={{ fontSize: 11.5, padding: '4px 10px' }}
        onClick={() => setAberto(a => !a)}
        title="Escolher quais colunas aparecem"
      >
        ▦ Colunas{escondidas > 0 ? ` (${colunas.length - escondidas}/${colunas.length})` : ''}
      </button>

      {aberto && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setAberto(false)} />
          <div style={{
            position: 'absolute', top: 30, right: 0, zIndex: 100,
            background: 'var(--surface)', border: '1px solid var(--border2)',
            borderRadius: 10, boxShadow: '0 12px 40px rgba(0,0,0,0.55)',
            width: 230, maxHeight: 340, overflowY: 'auto', padding: 6,
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '6px 8px', borderBottom: '1px solid var(--border)', marginBottom: 4,
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)' }}>
                Colunas
              </span>
              <button
                onClick={mostrarTodas}
                style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: 11, cursor: 'pointer', padding: 0 }}
              >
                Mostrar todas
              </button>
            </div>

            {colunas.map(col => (
              <label
                key={col.campo}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px',
                  borderRadius: 6, fontSize: 12.5,
                  color: col.fixa ? 'var(--text3)' : 'var(--text)',
                  cursor: col.fixa ? 'not-allowed' : 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={!ocultas.has(col.campo)}
                  disabled={col.fixa}
                  onChange={() => alternar(col.campo)}
                  style={{ cursor: col.fixa ? 'not-allowed' : 'pointer' }}
                />
                {col.titulo}
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Tabela
   ───────────────────────────────────────────── */
export default function TableBoard({
  leads, onEdit, onDelete, onInlineEdit, selectedLeads, setSelectedLeads, onOpenDetail,
  nichos = [], responsaveis = [], estados = [], cidades = [], etapas = [],
}) {
  const estreita = useTelaEstreita();
  const [editCell, setEditCell] = useState({ id: null, field: null, value: '' });
  const [ordem, setOrdem] = useState({ campo: null, dir: 1 });
  const [pagina, setPagina] = useState(1);

  const [porPagina, setPorPagina] = useState(() => {
    const salvo = Number(localStorage.getItem(CHAVE_POR_PAGINA));
    return [25, 50, 100, 250].includes(salvo) ? salvo : 50;
  });

  const [ocultas, setOcultas] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(CHAVE_COLUNAS) || '[]'));
    } catch { return new Set(); }
  });

  useEffect(() => {
    localStorage.setItem(CHAVE_COLUNAS, JSON.stringify([...ocultas]));
  }, [ocultas]);

  useEffect(() => {
    localStorage.setItem(CHAVE_POR_PAGINA, String(porPagina));
  }, [porPagina]);

  const opcoesDe = (arr) => arr.map(i => ({ value: i, label: i }));
  const opcoesStatus = useMemo(
    () => etapasAtivas(etapas).map(e => ({ value: e.id, label: e.label })),
    [etapas]
  );

  /* ── Definição das colunas ── */
  const COLUNAS = useMemo(() => [
    {
      campo: 'nome', titulo: 'Nome / Empresa', largura: 300, ordenavel: true, fixa: true,
      render: (l) => (
        <div onClick={() => onOpenDetail(l)} style={{ cursor: 'pointer' }}>
          <div className="td-name-main">{l.nome}</div>
          {l.nicho && <div className="td-name-sub">{l.nicho}</div>}
        </div>
      ),
    },
    {
      campo: 'status', titulo: 'Status', largura: 165, ordenavel: true,
      edicao: { tipo: 'select', opcoes: () => opcoesStatus },
      render: (l) => {
        const e = acharEtapa(etapas, l.status);
        return <button className={`status-badge ${e.cls}`}>{e.label} ▾</button>;
      },
    },
    {
      campo: 'valor', titulo: 'Valor', largura: 125, ordenavel: true,
      edicao: { tipo: 'number' },
      render: (l) => (Number(l.valor) > 0
        ? <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 600, color: 'var(--green)' }}>{formatarBRL(l.valor)}</span>
        : <Vazio />),
    },
    {
      campo: 'responsavel', titulo: 'Responsável', largura: 150, ordenavel: true,
      edicao: { tipo: 'select', opcoes: () => opcoesDe(responsaveis) },
      render: (l) => (l.responsavel
        ? <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div className="avatar">{l.responsavel.charAt(0)}</div>{l.responsavel}</div>
        : <Vazio />),
    },
    {
      campo: 'origem', titulo: 'Origem', largura: 140, ordenavel: true,
      edicao: { tipo: 'select', opcoes: () => ORIGEM_OPTIONS },
      render: (l) => (l.origem ? <span className="badge-pill" style={{ textTransform: 'capitalize' }}>{l.origem}</span> : <Vazio />),
    },
    {
      campo: 'nicho', titulo: 'Nicho', largura: 150, ordenavel: true,
      edicao: { tipo: 'select', opcoes: () => opcoesDe(nichos) },
      render: (l) => (l.nicho ? <span className="badge-pill">{l.nicho}</span> : <Vazio />),
    },
    {
      campo: 'estado', titulo: 'Estado', largura: 110, ordenavel: true,
      edicao: { tipo: 'select', opcoes: () => opcoesDe(estados) },
      render: (l) => (l.estado ? <span className="badge-pill">{l.estado}</span> : <Vazio />),
    },
    {
      campo: 'cidade', titulo: 'Cidade', largura: 140, ordenavel: true,
      edicao: { tipo: 'select', opcoes: () => opcoesDe(cidades) },
      render: (l) => (l.cidade ? <span className="badge-pill">{l.cidade}</span> : <Vazio />),
    },
    {
      campo: 'telefone', titulo: 'Telefone', largura: 150, edicao: { tipo: 'text' },
      render: (l) => (l.telefone
        ? <a href={`tel:${limpaTel(l.telefone)}`} className="td-link" onClick={e => e.preventDefault()}>📞 {l.telefone}</a>
        : <Vazio />),
    },
    {
      campo: 'whatsapp', titulo: 'WhatsApp', largura: 150, edicao: { tipo: 'text' },
      render: (l) => (l.whatsapp
        ? <a href={`https://wa.me/55${limpaTel(l.whatsapp)}`} target="_blank" rel="noreferrer" className="td-link" onClick={e => e.stopPropagation()}>💬 {l.whatsapp}</a>
        : <Vazio />),
    },
    {
      campo: 'email', titulo: 'E-mail', largura: 190, edicao: { tipo: 'text' },
      render: (l) => (l.email
        ? <a href={`mailto:${l.email}`} className="td-link" onClick={e => e.stopPropagation()}>✉️ {l.email}</a>
        : <Vazio />),
    },
    {
      campo: 'decisor', titulo: 'Decisor', largura: 150, edicao: { tipo: 'text' },
      render: (l) => l.decisor || <Vazio />,
    },
    {
      campo: 'instagram', titulo: 'Instagram', largura: 150, edicao: { tipo: 'text' },
      render: (l) => (urlIg(l.instagram)
        ? <a href={urlIg(l.instagram)} target="_blank" rel="noreferrer" className="td-link" onClick={e => e.stopPropagation()}>📷 {l.instagram}</a>
        : <Vazio />),
    },
    {
      campo: 'ig_dono', titulo: 'IG do Dono', largura: 150, edicao: { tipo: 'text' },
      render: (l) => (urlIg(l.ig_dono)
        ? <a href={urlIg(l.ig_dono)} target="_blank" rel="noreferrer" className="td-link" onClick={e => e.stopPropagation()}>👤 {l.ig_dono}</a>
        : <Vazio />),
    },
    {
      campo: 'site', titulo: 'Site', largura: 110, edicao: { tipo: 'text' },
      render: (l) => (urlSite(l.site)
        ? <a href={urlSite(l.site)} target="_blank" rel="noreferrer" className="td-link" onClick={e => e.stopPropagation()}>🌐 Site</a>
        : <Vazio />),
    },
    {
      campo: 'nota', titulo: 'Nota ⭐', largura: 95, ordenavel: true, edicao: { tipo: 'number' },
      render: (l) => (l.nota
        ? <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--yellow)', fontFamily: "'DM Mono', monospace" }}>{l.nota}</span>
        : <Vazio />),
    },
    {
      campo: 'avaliacoes', titulo: 'Avaliações', largura: 110, ordenavel: true, edicao: { tipo: 'number' },
      render: (l) => (l.avaliacoes ? <span className="td-mono">{l.avaliacoes}</span> : <Vazio />),
    },
    {
      campo: 'cnpj', titulo: 'CNPJ', largura: 150, edicao: { tipo: 'text' },
      render: (l) => (l.cnpj ? <span className="td-mono" style={{ fontSize: 11 }}>{l.cnpj}</span> : <Vazio />),
    },
    {
      campo: 'ultimo_contato', titulo: 'Último Contato', largura: 130, ordenavel: true, edicao: { tipo: 'date' },
      render: (l) => (l.ultimo_contato ? <span style={{ fontSize: 11, color: 'var(--text2)' }}>{formataData(l.ultimo_contato)}</span> : <Vazio />),
    },
    {
      campo: 'reuniao', titulo: 'Reunião', largura: 120, ordenavel: true, edicao: { tipo: 'date' },
      render: (l) => (l.reuniao ? <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>{formataData(l.reuniao)}</span> : <Vazio />),
    },
    {
      campo: 'obs', titulo: 'Observação', largura: 220, edicao: { tipo: 'text' },
      render: (l) => (l.obs ? <span title={l.obs}>{l.obs}</span> : <Vazio />),
    },
  ], [etapas, opcoesStatus, responsaveis, nichos, estados, cidades, onOpenDetail]);

  const colunasVisiveis = useMemo(
    () => COLUNAS.filter(c => c.fixa || !ocultas.has(c.campo)),
    [COLUNAS, ocultas]
  );

  /* ── Ordenação ── */
  const leadsOrdenados = useMemo(() => {
    if (!ordem.campo) return leads;
    const campo = ordem.campo;
    return [...leads].sort((a, b) => {
      const av = a[campo], bv = b[campo];
      const aVazio = av === undefined || av === null || av === '';
      const bVazio = bv === undefined || bv === null || bv === '';
      // Vazios sempre no fim, independente da direção — senão ordenar por valor
      // enche a primeira página de leads sem valor nenhum.
      if (aVazio && bVazio) return 0;
      if (aVazio) return 1;
      if (bVazio) return -1;

      if (CAMPOS_NUMERICOS.has(campo)) return (Number(av) - Number(bv)) * ordem.dir;
      if (CAMPOS_DATA.has(campo)) return String(av).localeCompare(String(bv)) * ordem.dir;
      return String(av).localeCompare(String(bv), 'pt-BR') * ordem.dir;
    });
  }, [leads, ordem]);

  // Três cliques: crescente → decrescente → sem ordenação
  const ordenarPor = (campo) => {
    setPagina(1);
    setOrdem(o => {
      if (o.campo !== campo) return { campo, dir: 1 };
      if (o.dir === 1) return { campo, dir: -1 };
      return { campo: null, dir: 1 };
    });
  };

  const iconeOrdem = (campo) => {
    if (ordem.campo !== campo) return <span style={{ opacity: 0.25 }}> ↕</span>;
    return <span style={{ color: 'var(--accent)' }}>{ordem.dir === 1 ? ' ↑' : ' ↓'}</span>;
  };

  /* ── Paginação ── */
  const totalPaginas = Math.max(1, Math.ceil(leadsOrdenados.length / porPagina));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const inicio = (paginaSegura - 1) * porPagina;
  const daPagina = useMemo(
    () => leadsOrdenados.slice(inicio, inicio + porPagina),
    [leadsOrdenados, inicio, porPagina]
  );

  /* ── Seleção ── */
  const idsDaPagina = daPagina.map(l => l.id);
  const todosDaPaginaSelecionados = idsDaPagina.length > 0 && idsDaPagina.every(id => selectedLeads.includes(id));
  const todosOsFiltradosSelecionados = leadsOrdenados.length > 0 && leadsOrdenados.every(l => selectedLeads.includes(l.id));

  const alternarPagina = (marcar) => {
    if (marcar) setSelectedLeads([...new Set([...selectedLeads, ...idsDaPagina])]);
    else setSelectedLeads(selectedLeads.filter(id => !idsDaPagina.includes(id)));
  };

  const selecionarTodosFiltrados = () => setSelectedLeads(leadsOrdenados.map(l => l.id));

  const alternarUm = (e, id) => {
    if (e.target.checked) setSelectedLeads([...selectedLeads, id]);
    else setSelectedLeads(selectedLeads.filter(x => x !== id));
  };

  const alternarColuna = (campo) => {
    setOcultas(prev => {
      const nova = new Set(prev);
      if (nova.has(campo)) nova.delete(campo); else nova.add(campo);
      return nova;
    });
  };

  if (!leads || leads.length === 0) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: 'var(--text3)' }}>
        Nenhum lead encontrado com os filtros atuais.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

      {/* Barra da tabela */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        padding: '7px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <span style={{ fontSize: 11.5, color: 'var(--text3)', fontFamily: "'DM Mono', monospace" }}>
          {inicio + 1}–{Math.min(inicio + porPagina, leadsOrdenados.length)} de {leadsOrdenados.length}
        </span>

        {todosDaPaginaSelecionados && !todosOsFiltradosSelecionados && (
          <button
            onClick={selecionarTodosFiltrados}
            style={{
              background: 'transparent', border: 'none', color: 'var(--accent)',
              fontSize: 11.5, cursor: 'pointer', padding: 0, fontFamily: 'inherit',
            }}
          >
            Selecionar todos os {leadsOrdenados.length} filtrados
          </button>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <select
            className="form-control"
            style={{ fontSize: 11.5, padding: '3px 8px', width: 'auto' }}
            value={porPagina}
            onChange={e => { setPorPagina(Number(e.target.value)); setPagina(1); }}
            title="Linhas por página"
          >
            {[25, 50, 100, 250].map(n => <option key={n} value={n}>{n} por página</option>)}
          </select>

          {!estreita && <EscolherColunas
            colunas={COLUNAS}
            ocultas={ocultas}
            alternar={alternarColuna}
            mostrarTodas={() => setOcultas(new Set())}
          />}
        </div>
      </div>

      {/* No celular a tabela vira lista de cartões: 23 colunas não cabem em
          375px, e rolagem horizontal com edição inline é impraticável. */}
      {estreita ? (
        <div className="lista-cartoes">
          {daPagina.map(lead => {
            const marcado = selectedLeads.includes(lead.id);
            const etapa = acharEtapa(etapas, lead.status);
            const wpp = lead.whatsapp ? lead.whatsapp.replace(/\D/g, '') : '';
            return (
              <div key={lead.id} className={`cartao-lead ${marcado ? 'selecionado' : ''}`}>
                <div className="cartao-lead-topo">
                  <input
                    type="checkbox"
                    checked={marcado}
                    onChange={e => alternarUm(e, lead.id)}
                    style={{ cursor: 'pointer', marginTop: 3, width: 18, height: 18, flexShrink: 0 }}
                  />
                  <button
                    onClick={() => onOpenDetail(lead)}
                    style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', textAlign: 'left', padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    <div className="cartao-lead-nome">{lead.nome}</div>
                    <div className="cartao-lead-sub">
                      {[lead.nicho, lead.cidade, lead.responsavel].filter(Boolean).join(' · ') || 'Sem dados'}
                    </div>
                  </button>
                  {Number(lead.valor) > 0 && (
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: 'var(--green)', flexShrink: 0 }}>
                      {formatarBRL(lead.valor)}
                    </span>
                  )}
                </div>

                <div className="cartao-lead-linha">
                  <span className={`status-badge ${etapa.cls}`} style={{ fontSize: 11 }}>{etapa.label}</span>
                  {lead.reuniao && (
                    <span style={{ fontSize: 11, color: 'var(--green)', fontFamily: "'DM Mono', monospace" }}>
                      📅 {formataData(lead.reuniao)}
                    </span>
                  )}
                </div>

                <div className="cartao-lead-acoes">
                  {wpp && (
                    <a href={`https://wa.me/55${wpp}`} target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ textDecoration: 'none' }}>
                      💬 WhatsApp
                    </a>
                  )}
                  {lead.telefone && (
                    <a href={`tel:${limpaTel(lead.telefone)}`} className="btn btn-ghost" style={{ textDecoration: 'none' }}>
                      📞 Ligar
                    </a>
                  )}
                  <button className="btn btn-ghost" onClick={() => onEdit(lead)}>✏️ Editar</button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
      <div className="table-wrapper">
        <table id="leadsTable">
          <thead>
            <tr>
              <th style={{ width: 90, paddingLeft: 20 }}>
                <input
                  type="checkbox"
                  checked={todosDaPaginaSelecionados}
                  onChange={e => alternarPagina(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                  title="Selecionar os leads desta página"
                />
              </th>
              {colunasVisiveis.map(col => (
                <th
                  key={col.campo}
                  style={{ minWidth: col.largura, cursor: col.ordenavel ? 'pointer' : 'default' }}
                  onClick={() => col.ordenavel && ordenarPor(col.campo)}
                  title={col.ordenavel ? 'Clique para ordenar' : undefined}
                >
                  {col.titulo}{col.ordenavel && iconeOrdem(col.campo)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {daPagina.map(lead => {
              const marcado = selectedLeads.includes(lead.id);
              return (
                <tr key={lead.id} className={marcado ? 'selected' : ''}>
                  <td style={{ paddingLeft: 20 }}>
                    <div className="check-container">
                      <input
                        type="checkbox" className="row-check"
                        checked={marcado}
                        onChange={e => alternarUm(e, lead.id)}
                        style={{ cursor: 'pointer' }}
                      />
                      <div className="row-actions-left">
                        <button className="btn-icon" title="Abrir formulário completo" onClick={() => onEdit(lead)} style={{ padding: '4px 6px', fontSize: 12 }}>📄</button>
                        <button className="btn-icon" title="Excluir" onClick={() => onDelete(lead.id)} style={{ padding: '4px 6px', fontSize: 12 }}>🗑️</button>
                      </div>
                    </div>
                  </td>

                  {colunasVisiveis.map(col => (
                    <td
                      key={col.campo}
                      className={col.campo === 'nome' ? 'td-name' : col.campo === 'obs' || col.campo === 'decisor' ? 'td-truncate' : undefined}
                    >
                      {col.edicao ? (
                        <CelulaEditavel
                          lead={lead}
                          campo={col.campo}
                          tipo={col.edicao.tipo}
                          opcoes={col.edicao.opcoes ? col.edicao.opcoes() : []}
                          editCell={editCell}
                          setEditCell={setEditCell}
                          onInlineEdit={onInlineEdit}
                        >
                          {col.render(lead)}
                        </CelulaEditavel>
                      ) : (
                        col.render(lead)
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}

      {/* Navegação de páginas */}
      {totalPaginas > 1 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '9px 20px', borderTop: '1px solid var(--border)', flexShrink: 0,
        }}>
          <button
            className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }}
            onClick={() => setPagina(1)} disabled={paginaSegura === 1}
          >« Primeira</button>
          <button
            className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }}
            onClick={() => setPagina(Math.max(1, paginaSegura - 1))} disabled={paginaSegura === 1}
          >‹ Anterior</button>

          <span style={{ fontSize: 12, color: 'var(--text2)', fontFamily: "'DM Mono', monospace", padding: '0 8px' }}>
            {paginaSegura} / {totalPaginas}
          </span>

          <button
            className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }}
            onClick={() => setPagina(Math.min(totalPaginas, paginaSegura + 1))} disabled={paginaSegura === totalPaginas}
          >Próxima ›</button>
          <button
            className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }}
            onClick={() => setPagina(totalPaginas)} disabled={paginaSegura === totalPaginas}
          >Última »</button>
        </div>
      )}
    </div>
  );
}
