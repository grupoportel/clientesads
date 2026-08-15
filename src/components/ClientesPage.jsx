import { useState, useMemo } from 'react';
import { ref, set, update, remove, push } from 'firebase/database';
import { database } from '../firebase';
import ClienteModal from './ClienteModal';
import { formatarBRL, formatarBRLCurto, ehGanho } from '../pipeline';
import { formataData } from '../periodo';
import { gerarCSV, baixarCSV } from '../csv';
import { registrarAtividade } from '../atividades';
import {
  saudeCliente, saudeMediaDaCarteira, receitaRecorrente, textoUltimoContato,
  clienteAPartirDoLead, ganhosSemCliente, rotuloStatusCliente, STATUS_CLIENTE,
} from '../clientes';

const corDoStatus = (s) => STATUS_CLIENTE.find(x => x.valor === s)?.cor || 'var(--green)';

const fundoDoStatus = (s) => ({
  ativo:     'rgba(34,197,94,.15)',
  pausado:   'rgba(250,204,21,.15)',
  cancelado: 'rgba(239,68,68,.15)',
}[s] || 'rgba(34,197,94,.15)');

const iniciais = (nome = '') =>
  nome.trim().split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');

function StatCard({ label, value, color = 'var(--green)', icon, sub }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border2)',
      borderRadius: 'var(--radius)', padding: '16px 20px',
      display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 10,
        background: `color-mix(in srgb, ${color} 15%, transparent)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

export default function ClientesPage({
  clientes = [], leads = [], etapas = [], nichos = [], responsaveis = [],
  onAvisar = () => {},
}) {
  const [modalAberto, setModalAberto] = useState(false);
  const [clienteEmEdicao, setClienteEmEdicao] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState('Todos');
  const [filtroResp, setFiltroResp] = useState('');
  const [busca, setBusca] = useState('');

  // Relógio fixado na montagem: a saúde não pode mudar entre dois renders
  const agoraMs = useMemo(() => new Date().getTime(), []);

  /* ── Filtros ── */
  const clientesFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return clientes.filter(c => {
      if (filtroStatus === 'Ativos' && c.statusCliente !== 'ativo') return false;
      if (filtroStatus === 'Pausados' && c.statusCliente !== 'pausado') return false;
      if (filtroStatus === 'Cancelados' && c.statusCliente !== 'cancelado') return false;
      if (filtroStatus === 'Em risco' && saudeCliente(c, agoraMs).pct >= 40) return false;
      if (filtroResp && c.responsavel !== filtroResp) return false;
      if (termo && ![c.nome, c.nicho, c.responsavel, c.plano, c.email]
        .some(v => (v || '').toLowerCase().includes(termo))) return false;
      return true;
    });
  }, [clientes, filtroStatus, filtroResp, busca, agoraMs]);

  /* ── Negócios ganhos que ainda não viraram cliente ── */
  const aConverter = useMemo(
    () => ganhosSemCliente(leads, clientes, (st) => ehGanho(etapas, st)),
    [leads, clientes, etapas]
  );

  /* ── CRUD ── */
  const salvarCliente = (dados) => {
    const agora = new Date().toISOString();
    if (!clienteEmEdicao) {
      const novaRef = push(ref(database, 'crm_data/clientes'));
      set(novaRef, { ...dados, id: novaRef.key, createdAt: agora, updatedAt: agora });
      if (dados.leadId) {
        registrarAtividade({
          leadId: dados.leadId, leadNome: dados.nome, tipo: 'nota',
          descricao: `Virou cliente${dados.valorMensal ? ` — ${formatarBRL(dados.valorMensal)}/mês` : ''}`,
        });
      }
      onAvisar('Cliente cadastrado!', 'success');
    } else {
      const { id, createdAt, ...campos } = dados;
      update(ref(database, 'crm_data/clientes/' + (id || clienteEmEdicao.id)), { ...campos, updatedAt: agora });
      onAvisar('Cliente atualizado!', 'success');
    }
    setModalAberto(false);
    setClienteEmEdicao(null);
  };

  const deletarCliente = (c) => {
    if (window.confirm(`Excluir o cliente "${c.nome}"?\n\nO lead de origem continua onde está.`)) {
      remove(ref(database, 'crm_data/clientes/' + c.id));
    }
  };

  // Abre o formulário já preenchido com o que o lead tinha
  const converter = (lead) => {
    setClienteEmEdicao(null);
    setDadosIniciais(clienteAPartirDoLead(lead));
    setModalAberto(true);
  };

  const [dadosIniciais, setDadosIniciais] = useState(null);

  const abrirNovo = () => { setClienteEmEdicao(null); setDadosIniciais(null); setModalAberto(true); };
  const abrirEdicao = (c) => { setClienteEmEdicao(c); setDadosIniciais(null); setModalAberto(true); };

  const exportar = () => {
    const colunas = [
      { titulo: 'Nome', campo: 'nome' },
      { titulo: 'Status', valor: c => rotuloStatusCliente(c.statusCliente) },
      { titulo: 'Plano', campo: 'plano' },
      { titulo: 'Valor mensal', valor: c => (Number(c.valorMensal) || 0).toFixed(2).replace('.', ',') },
      { titulo: 'Saúde', valor: c => `${saudeCliente(c, agoraMs).pct}%` },
      { titulo: 'Responsável', campo: 'responsavel' },
      { titulo: 'Nicho', campo: 'nicho' },
      { titulo: 'Telefone', campo: 'telefone' },
      { titulo: 'WhatsApp', campo: 'whatsapp' },
      { titulo: 'E-mail', campo: 'email' },
      { titulo: 'Desde', valor: c => formataData(c.dataInicio) },
      { titulo: 'Último contato', valor: c => formataData(c.ultimoContato) },
      { titulo: 'Observação', campo: 'obs' },
    ];
    baixarCSV(`clientes-${new Date().toISOString().slice(0, 10)}`, gerarCSV(clientesFiltrados, colunas));
    onAvisar(`${clientesFiltrados.length} cliente(s) exportado(s).`, 'success');
  };

  /* ── Números ── */
  const ativos = clientes.filter(c => c.statusCliente === 'ativo').length;
  const mrr = receitaRecorrente(clientes);
  const saude = saudeMediaDaCarteira(clientes, agoraMs);
  const emRisco = clientes.filter(c => c.statusCliente !== 'cancelado' && saudeCliente(c, agoraMs).pct < 40).length;

  const abas = ['Todos', 'Ativos', 'Pausados', 'Cancelados', 'Em risco'];

  return (
    <div className="page-content">

      {/* ── Cabeçalho ── */}
      <div className="page-header" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            🏢 Clientes
            <span className="badge-pill" style={{ background: 'rgba(0,208,223,.15)', color: 'var(--accent)', fontSize: 13, padding: '2px 10px' }}>
              {clientesFiltrados.length}
            </span>
          </h1>
          <p className="page-subtitle">Gerencie sua carteira de clientes</p>
        </div>

        <div className="page-actions" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="🔍 Buscar cliente..."
            className="form-control"
            style={{ width: 220, fontSize: 13 }}
          />
          {responsaveis.length > 0 && (
            <select
              className="form-control"
              style={{ width: 'auto', fontSize: 12.5 }}
              value={filtroResp}
              onChange={e => setFiltroResp(e.target.value)}
            >
              <option value="">Toda a equipe</option>
              {responsaveis.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          )}
          <button className="btn btn-ghost" style={{ fontSize: 12.5 }} onClick={exportar} disabled={clientesFiltrados.length === 0}>
            📤 Exportar
          </button>
          <button className="btn btn-primary" onClick={abrirNovo}>+ Novo Cliente</button>
        </div>
      </div>

      {/* ── Negócios ganhos esperando conversão ── */}
      {aConverter.length > 0 && (
        <div style={{
          background: 'rgba(0,208,223,0.08)', border: '1px solid rgba(0,208,223,0.3)',
          borderRadius: 12, padding: '14px 18px', marginBottom: 18,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 17 }}>🎉</span>
            <span style={{ fontSize: 13.5, fontWeight: 650, color: 'var(--accent)' }}>
              {aConverter.length} negócio{aConverter.length > 1 ? 's' : ''} ganho{aConverter.length > 1 ? 's' : ''} ainda sem cliente
            </span>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>
              O formulário abre com os dados do lead já preenchidos.
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {aConverter.slice(0, 8).map(lead => (
              <button
                key={lead.id}
                onClick={() => converter(lead)}
                className="btn btn-ghost"
                style={{ fontSize: 12, padding: '5px 12px' }}
                title={`Converter "${lead.nome}" em cliente`}
              >
                + {lead.nome}
                {Number(lead.valor) > 0 && (
                  <span style={{ color: 'var(--green)', marginLeft: 6, fontFamily: "'DM Mono', monospace" }}>
                    {formatarBRLCurto(lead.valor)}
                  </span>
                )}
              </button>
            ))}
            {aConverter.length > 8 && (
              <span style={{ fontSize: 12, color: 'var(--text3)', alignSelf: 'center' }}>
                + {aConverter.length - 8} outro(s)
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── KPIs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard icon="👥" label="Clientes Ativos" value={ativos} color="var(--green)"
          sub={`${clientes.length} no total`} />
        <StatCard icon="💰" label="Receita Recorrente" value={`${formatarBRL(mrr)}/mês`} color="var(--green)"
          sub="Só contratos ativos" />
        <StatCard icon="❤️" label="Saúde da Carteira"
          value={saude === null ? '—' : `${saude}%`}
          color={saude === null ? 'var(--text3)' : saude >= 70 ? 'var(--green)' : saude >= 40 ? 'var(--yellow)' : 'var(--red)'}
          sub="Cancelados ficam de fora" />
        <StatCard icon="⚠️" label="Contas em Risco" value={emRisco}
          color={emRisco > 0 ? 'var(--red)' : 'var(--green)'}
          sub={emRisco > 0 ? 'Saúde abaixo de 40%' : 'Nenhuma conta crítica'} />
      </div>

      {/* ── Abas ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 18, flexWrap: 'wrap' }}>
        {abas.map(f => (
          <button
            key={f}
            className={filtroStatus === f ? 'btn btn-primary' : 'btn btn-ghost'}
            style={{ fontSize: 12.5, padding: '5px 13px' }}
            onClick={() => setFiltroStatus(f)}
          >
            {f}
            {f === 'Em risco' && emRisco > 0 && (
              <span style={{
                marginLeft: 6, fontSize: 11, fontFamily: "'DM Mono', monospace",
                color: filtroStatus === f ? 'inherit' : 'var(--red)',
              }}>
                {emRisco}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Vazio ── */}
      {clientesFiltrados.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '56px 20px',
          background: 'var(--surface)', borderRadius: 'var(--radius)',
          border: '1px dashed var(--border2)',
        }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🏢</div>
          <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
            {clientes.length === 0 ? 'Nenhum cliente ainda' : 'Nada com esses filtros'}
          </div>
          <div style={{ color: 'var(--text2)', marginBottom: 20, fontSize: 13.5, lineHeight: 1.6 }}>
            {clientes.length === 0
              ? (aConverter.length > 0
                  ? 'Você tem negócios ganhos esperando conversão logo acima.'
                  : 'Ganhe um negócio no funil ou cadastre um cliente direto.')
              : 'Tente ajustar a busca ou as abas.'}
          </div>
          {clientes.length === 0 && aConverter.length === 0 && (
            <button className="btn btn-primary" onClick={abrirNovo}>+ Novo Cliente</button>
          )}
        </div>
      )}

      {/* ── Cartões ── */}
      {clientesFiltrados.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: 16 }}>
          {clientesFiltrados.map(c => {
            const saudeC = saudeCliente(c, agoraMs);
            const wpp = c.whatsapp ? c.whatsapp.replace(/\D/g, '') : null;
            const leadDeOrigem = c.leadId ? leads.find(l => l.id === c.leadId) : null;

            return (
              <div className="client-card" key={c.id}>
                <div className="client-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
                    <span className="client-name">{c.nome || '—'}</span>
                    {c.nicho && (
                      <span className="badge-pill" style={{ background: 'rgba(0,208,223,.12)', color: 'var(--accent)', fontSize: 11, padding: '2px 8px' }}>
                        {c.nicho}
                      </span>
                    )}
                  </div>
                  <span className="badge-pill" style={{
                    background: fundoDoStatus(c.statusCliente), color: corDoStatus(c.statusCliente),
                    fontSize: 11, padding: '3px 10px', whiteSpace: 'nowrap', flexShrink: 0,
                  }}>
                    {rotuloStatusCliente(c.statusCliente)}
                  </span>
                </div>

                <div className="client-card-row">
                  <span style={{ color: 'var(--text2)', fontSize: 13 }}>Responsável</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%', background: 'var(--accent)',
                      color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 700, flexShrink: 0,
                    }}>
                      {iniciais(c.responsavel || '?')}
                    </div>
                    <span style={{ fontSize: 13 }}>{c.responsavel || '—'}</span>
                  </div>
                </div>

                <div className="client-card-row">
                  <span style={{ color: 'var(--text2)', fontSize: 13 }}>Plano</span>
                  <span style={{ fontSize: 13 }}>{c.plano || '—'}</span>
                </div>

                <div className="client-card-row">
                  <span style={{ color: 'var(--text2)', fontSize: 13 }}>Valor</span>
                  <span style={{ fontSize: 13, color: 'var(--green)', fontWeight: 600, fontFamily: "'DM Mono', monospace" }}>
                    {formatarBRL(c.valorMensal || 0)}/mês
                  </span>
                </div>

                <div className="client-card-row">
                  <span style={{ color: 'var(--text2)', fontSize: 13 }}>Desde</span>
                  <span style={{ fontSize: 13 }}>{formataData(c.dataInicio) || '—'}</span>
                </div>

                {/* Saúde, agora com o porquê */}
                <div style={{ margin: '10px 0 6px' }} title={saudeC.motivos.join(' · ')}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: 'var(--text2)' }}>Saúde · {saudeC.rotulo}</span>
                    <span style={{ fontSize: 12, color: saudeC.cor, fontWeight: 600 }}>{saudeC.pct}%</span>
                  </div>
                  <div className="client-health-bar">
                    <div className="client-health-fill" style={{ width: `${saudeC.pct}%`, background: saudeC.cor }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 5, lineHeight: 1.45 }}>
                    {saudeC.motivos[0]}
                  </div>
                </div>

                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
                  Último contato: {textoUltimoContato(c.ultimoContato, agoraMs)}
                  {leadDeOrigem && (
                    <span style={{ color: 'var(--accent2)' }}> · veio do funil</span>
                  )}
                </div>

                <div className="client-actions">
                  {wpp && (
                    <a href={`https://wa.me/55${wpp}`} target="_blank" rel="noopener noreferrer"
                      className="btn btn-ghost" style={{ fontSize: 12, padding: '5px 10px', textDecoration: 'none' }}>
                      📱 WhatsApp
                    </a>
                  )}
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="btn btn-ghost"
                      style={{ fontSize: 12, padding: '5px 10px', textDecoration: 'none' }}>
                      ✉️ E-mail
                    </a>
                  )}
                  <button className="btn btn-ghost" style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => abrirEdicao(c)}>
                    ✏️ Editar
                  </button>
                  <button className="btn btn-danger" style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => deletarCliente(c)}>
                    🗑
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalAberto && (
        <ClienteModal
          key={clienteEmEdicao?.id || dadosIniciais?.leadId || 'novo'}
          isOpen
          onClose={() => { setModalAberto(false); setClienteEmEdicao(null); setDadosIniciais(null); }}
          onSave={salvarCliente}
          clienteAtual={clienteEmEdicao || dadosIniciais}
          nichos={nichos}
          responsaveis={responsaveis}
        />
      )}
    </div>
  );
}
