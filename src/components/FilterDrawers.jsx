import { useMemo, useState } from 'react';
import { ref, runTransaction } from 'firebase/database';
import { database } from '../firebase';
import { opcoesDeFiltro } from '../filtrosLeads';

function FilterField({ label, field, items, leads, value, onChange, dbPath, podeEditar }) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const opcoes = useMemo(() => {
    const usados = leads.map(lead => lead[field]).filter(Boolean);
    return opcoesDeFiltro(items, usados);
  }, [field, items, leads]);

  const adicionar = async () => {
    const nome = window.prompt(`Adicionar ${label.toLowerCase()}:`);
    if (!nome?.trim()) return;
    setSalvando(true);
    setErro('');
    try {
      await runTransaction(ref(database, dbPath), atual => opcoesDeFiltro(Object.values(atual || {}), [nome]), { applyLocally: false });
    } catch {
      setErro('Não foi possível salvar a opção. Verifique sua conexão e permissão e tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="filter-field">
      <label>{label}</label>
      <div className="filter-field-row">
        <select aria-label={label} className="form-control" value={value || ''} onChange={event => onChange(event.target.value || null)}>
          <option value="">Todos</option>
          {opcoes.map(item => <option key={item} value={item}>{item}</option>)}
        </select>
        {podeEditar && (
          <button type="button" className="btn-icon" disabled={salvando} onClick={adicionar} aria-label={`Adicionar ${label.toLowerCase()}`} title="Adicionar opção">
            +
          </button>
        )}
      </div>
      {erro && <p role="alert">{erro}</p>}
    </div>
  );
}

export default function FilterDrawers({
  leads = [], nichos = [], responsaveis = [], estados = [], cidades = [],
  tiposProspeccao = [], filtroTipoProspeccao, setFiltroTipoProspeccao,
  filtroNicho, setFiltroNicho, filtroResponsavel, setFiltroResponsavel,
  filtroEstado, setFiltroEstado, filtroCidade, setFiltroCidade,
  filtroDataInicio, setFiltroDataInicio, filtroDataFim, setFiltroDataFim,
  quantidadeAtivos = 0, onLimpar, podeEditar = false,
  onImportar, onExportar, quantidadeExportar = 0, onLixeira, quantidadeLixeira = 0,
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <section className={`filters-panel ${aberto ? 'open' : ''}`} aria-label="Filtros da lista de leads">
      <button
        type="button" className="filters-toggle" aria-expanded={aberto}
        onClick={() => setAberto(atual => !atual)}
      >
        <span className="filters-toggle-title">
          Filtros e dados
          {quantidadeAtivos > 0 && <span className="filters-count">{quantidadeAtivos}</span>}
        </span>
        <span className="filters-toggle-hint">{quantidadeAtivos ? `${quantidadeAtivos} filtro(s) ativo(s)` : 'Refinar lista'} <span aria-hidden="true">⌄</span></span>
      </button>

      {aberto && (
        <div className="filters-content">
          <div className="filters-grid">
            <FilterField label="Nicho" field="nicho" items={nichos} leads={leads} value={filtroNicho} onChange={setFiltroNicho} dbPath="crm_data/nichos" podeEditar={podeEditar} />
            <FilterField label="Tipo de Prospecção" field="tipoProspeccao" items={tiposProspeccao} leads={leads} value={filtroTipoProspeccao} onChange={setFiltroTipoProspeccao} dbPath="crm_data/tiposProspeccao" podeEditar={podeEditar} />
            <FilterField label="Responsável" field="responsavel" items={responsaveis} leads={leads} value={filtroResponsavel} onChange={setFiltroResponsavel} dbPath="crm_data/responsaveis" podeEditar={podeEditar} />
            <FilterField label="Estado" field="estado" items={estados} leads={leads} value={filtroEstado} onChange={setFiltroEstado} dbPath="crm_data/estados" podeEditar={podeEditar} />
            <FilterField label="Cidade" field="cidade" items={cidades} leads={leads} value={filtroCidade} onChange={setFiltroCidade} dbPath="crm_data/cidades" podeEditar={podeEditar} />
            <div className="filter-field">
              <label>Entrada a partir de</label>
              <input type="date" className="form-control" value={filtroDataInicio} onChange={event => setFiltroDataInicio(event.target.value)} />
            </div>
            <div className="filter-field">
              <label>Entrada até</label>
              <input type="date" className="form-control" value={filtroDataFim} onChange={event => setFiltroDataFim(event.target.value)} />
            </div>
          </div>

          <div className="filters-actions">
            {quantidadeAtivos > 0 && <button type="button" className="btn btn-ghost" onClick={onLimpar}>Limpar filtros</button>}
            <div className="filters-data-actions">
              {podeEditar && quantidadeLixeira > 0 && <button type="button" className="btn btn-ghost" onClick={onLixeira}>Lixeira ({quantidadeLixeira})</button>}
              {podeEditar && <button type="button" className="btn btn-ghost" onClick={onImportar}>Importar</button>}
              <button type="button" className="btn btn-ghost" onClick={onExportar} disabled={quantidadeExportar === 0}>Exportar ({quantidadeExportar})</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

