import { useState, useMemo } from 'react';
import { etapasAtivas, formatarBRL } from '../pipeline';

// Barra que aparece quando há leads selecionados.
// Antes, a única ação em massa era excluir — e mudar o status de 600 leads
// significava clicar célula por célula, 600 vezes.

const ORIGENS = [
  { valor: 'gmn', rotulo: 'GMN' },
  { valor: 'whatsapp', rotulo: 'WhatsApp' },
  { valor: 'instagram', rotulo: 'Instagram' },
  { valor: 'telefone', rotulo: 'Telefone' },
  { valor: 'email', rotulo: 'E-mail' },
  { valor: 'indicacao', rotulo: 'Indicação' },
  { valor: 'site', rotulo: 'Site / Inbound' },
  { valor: 'outro', rotulo: 'Outro' },
];

export default function BarraEmMassa({
  quantidade, etapas = [], responsaveis = [], nichos = [], estados = [], cidades = [],
  onAplicar, onExportar, onExcluir, onLimparSelecao, aplicando = false,
}) {
  const [campo, setCampo] = useState('status');
  const [valor, setValor] = useState('');

  // Cada campo diz que tipo de controle usar e de onde vêm as opções
  const CAMPOS = useMemo(() => ({
    status:      { rotulo: 'Status',      tipo: 'select', opcoes: etapasAtivas(etapas).map(e => ({ valor: e.id, rotulo: e.label })) },
    valor:       { rotulo: 'Valor',       tipo: 'numero' },
    responsavel: { rotulo: 'Responsável', tipo: 'select', opcoes: responsaveis.map(r => ({ valor: r, rotulo: r })), permiteVazio: true },
    nicho:       { rotulo: 'Nicho',       tipo: 'select', opcoes: nichos.map(n => ({ valor: n, rotulo: n })), permiteVazio: true },
    origem:      { rotulo: 'Origem',      tipo: 'select', opcoes: ORIGENS, permiteVazio: true },
    estado:      { rotulo: 'Estado',      tipo: 'select', opcoes: estados.map(e => ({ valor: e, rotulo: e })), permiteVazio: true },
    cidade:      { rotulo: 'Cidade',      tipo: 'select', opcoes: cidades.map(c => ({ valor: c, rotulo: c })), permiteVazio: true },
    ultimo_contato: { rotulo: 'Último contato', tipo: 'data' },
    reuniao:     { rotulo: 'Reunião',     tipo: 'data' },
  }), [etapas, responsaveis, nichos, estados, cidades]);

  const cfg = CAMPOS[campo];
  // Campos de texto livre aceitam limpar; select exige escolha, salvo quando
  // "permiteVazio" (aí o vazio significa "apagar o valor").
  const podeAplicar = cfg.tipo !== 'select' ? valor !== '' : (valor !== '' || cfg.permiteVazio);

  const trocarCampo = (novo) => { setCampo(novo); setValor(''); };

  const aplicar = () => {
    if (!podeAplicar || aplicando) return;
    const rotuloValor = cfg.tipo === 'numero'
      ? formatarBRL(valor)
      : cfg.tipo === 'select'
        ? (cfg.opcoes.find(o => o.valor === valor)?.rotulo || '(vazio)')
        : (valor || '(vazio)');

    const confirmado = window.confirm(
      `Alterar "${cfg.rotulo}" para "${rotuloValor}" em ${quantidade} lead(s)?\n\n` +
      `A alteração fica registrada na linha do tempo de cada lead.`
    );
    if (!confirmado) return;

    onAplicar(campo, cfg.tipo === 'numero' ? Number(valor) : valor);
    setValor('');
  };

  const controle = () => {
    const estiloBase = { fontSize: 12, padding: '5px 9px', width: 'auto', minWidth: 150 };

    if (cfg.tipo === 'select') {
      return (
        <select className="form-control" style={estiloBase} value={valor} onChange={e => setValor(e.target.value)}>
          <option value="">{cfg.permiteVazio ? '— deixar em branco —' : '— escolha —'}</option>
          {cfg.opcoes.map(o => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
        </select>
      );
    }
    if (cfg.tipo === 'numero') {
      return (
        <input
          className="form-control" type="number" min="0" step="100"
          style={{ ...estiloBase, minWidth: 130 }}
          value={valor} onChange={e => setValor(e.target.value)}
          placeholder="Ex: 2500"
          onKeyDown={e => e.key === 'Enter' && aplicar()}
        />
      );
    }
    return (
      <input
        className="form-control" type="date" style={{ ...estiloBase, minWidth: 140 }}
        value={valor} onChange={e => setValor(e.target.value)}
      />
    );
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      padding: '10px 20px', flexShrink: 0,
      background: 'rgba(0,208,223,0.08)',
      borderBottom: '1px solid rgba(0,208,223,0.28)',
    }}>
      <span style={{
        fontSize: 12.5, fontWeight: 700, color: 'var(--accent)',
        fontFamily: "'DM Mono', monospace", whiteSpace: 'nowrap',
      }}>
        {quantidade} selecionado{quantidade > 1 ? 's' : ''}
      </span>

      <button
        className="btn btn-ghost"
        style={{ fontSize: 11.5, padding: '4px 10px' }}
        onClick={onLimparSelecao}
      >
        Limpar
      </button>

      <div style={{ width: 1, height: 22, background: 'var(--border2)' }} />

      <span style={{ fontSize: 12, color: 'var(--text3)' }}>Definir</span>

      <select
        className="form-control"
        style={{ fontSize: 12, padding: '5px 9px', width: 'auto' }}
        value={campo}
        onChange={e => trocarCampo(e.target.value)}
      >
        {Object.entries(CAMPOS).map(([chave, c]) => (
          <option key={chave} value={chave}>{c.rotulo}</option>
        ))}
      </select>

      <span style={{ fontSize: 12, color: 'var(--text3)' }}>como</span>

      {controle()}

      <button
        className="btn btn-primary"
        style={{ fontSize: 12, padding: '5px 14px', opacity: podeAplicar && !aplicando ? 1 : 0.5 }}
        onClick={aplicar}
        disabled={!podeAplicar || aplicando}
        title={podeAplicar ? `Aplicar em ${quantidade} lead(s)` : 'Escolha um valor primeiro'}
      >
        {aplicando ? '⏳ Aplicando…' : `Aplicar em ${quantidade}`}
      </button>

      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
        <button className="btn btn-ghost" style={{ fontSize: 11.5, padding: '4px 10px' }} onClick={onExportar}>
          📤 Exportar seleção
        </button>
        <button className="btn btn-danger" style={{ fontSize: 11.5, padding: '4px 10px' }} onClick={onExcluir}>
          🗑 Excluir
        </button>
      </div>
    </div>
  );
}
