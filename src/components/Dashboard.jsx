import { useMemo, useState } from 'react';
import {
  acharEtapa, etapasDoFunil, ehGanho, ehAberto,
  valorEmAberto, previsaoPonderada, formatarBRL, formatarBRLCurto,
} from '../pipeline';
import {
  PERIODOS, calcularJanela, dentro, dataEntrada, dataFecho, diasDesde,
  hojeISO, formataData, tempoAtras, ultimosMeses, chaveMes,
} from '../periodo';

/* ═══════════════════════════════════════════════════════════
   Peças visuais
   ═══════════════════════════════════════════════════════════ */

const cartao = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 20,
};

function TituloCartao({ children, acao }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12 }}>
      <h3 style={{ color: 'var(--text)', fontSize: 15, fontWeight: 600, margin: 0 }}>{children}</h3>
      {acao}
    </div>
  );
}

function BotaoVerTudo({ onClick, children = 'Ver tudo' }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'transparent', border: 'none', color: 'var(--accent)',
        fontSize: 12, cursor: 'pointer', padding: 0, fontFamily: 'inherit',
      }}
    >
      {children} →
    </button>
  );
}

function Vazio({ children }) {
  return (
    <p style={{ color: 'var(--text3)', fontSize: 13, textAlign: 'center', padding: '28px 0', margin: 0 }}>
      {children}
    </p>
  );
}

/* ── Variação vs período anterior ── */
function Delta({ atual, anterior, invertido = false, rotulo }) {
  if (anterior === null || anterior === undefined) return null;
  if (anterior === 0 && atual === 0) return null;

  const pct = anterior === 0 ? 100 : Math.round(((atual - anterior) / Math.abs(anterior)) * 100);
  const subiu = pct > 0;
  const neutro = pct === 0;
  // "invertido" serve para métricas em que crescer é ruim
  const bom = neutro ? null : (invertido ? !subiu : subiu);
  const cor = bom === null ? 'var(--text3)' : bom ? 'var(--green)' : 'var(--red)';

  return (
    <span
      style={{ color: cor, fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap' }}
      title={`${rotulo}: ${anterior === 0 ? 'sem base de comparação' : ''}`}
    >
      {neutro ? '=' : subiu ? '▲' : '▼'} {Math.abs(pct)}%
      <span style={{ color: 'var(--text3)', fontWeight: 400 }}> vs {rotulo}</span>
    </span>
  );
}

/* ── Mini gráfico de barras: uma série, um eixo ── */
function MiniBarras({ dados, cor, formatar, titulo }) {
  const [ativo, setAtivo] = useState(null);
  const max = Math.max(...dados.map(d => d.valor), 1);
  const temDado = dados.some(d => d.valor > 0);

  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10, fontWeight: 500 }}>{titulo}</div>

      {!temDado ? (
        <div style={{ fontSize: 12, color: 'var(--text3)', padding: '22px 0', textAlign: 'center' }}>
          Sem registros nos últimos 6 meses.
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 92, position: 'relative' }}>
          {dados.map((d, i) => {
            const alturaPct = Math.max((d.valor / max) * 100, d.valor > 0 ? 4 : 1.5);
            const destacado = ativo === i;
            const ultimo = i === dados.length - 1;
            // Rotula o mês atual e o pico. Sem o pico, a barra mais alta do
            // gráfico ficava sem número — justamente a que o leitor quer ler.
            const ehPico = d.valor === max && d.valor > 0;
            return (
              <div
                key={d.mes}
                onMouseEnter={() => setAtivo(i)}
                onMouseLeave={() => setAtivo(null)}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column',
                  justifyContent: 'flex-end', alignItems: 'center',
                  height: '100%', cursor: 'default', position: 'relative',
                }}
              >
                {/* Rótulo: mês atual e pico sempre; os demais ao passar o mouse */}
                {(destacado || ultimo || ehPico) && d.valor > 0 && (
                  <span style={{
                    position: 'absolute', top: 0, fontSize: 10.5,
                    fontFamily: "'DM Mono', monospace", fontWeight: 700,
                    color: destacado ? 'var(--text)' : 'var(--text2)',
                    whiteSpace: 'nowrap', pointerEvents: 'none',
                  }}>
                    {formatar(d.valor)}
                  </span>
                )}
                <div
                  style={{
                    width: '100%', height: `${alturaPct}%`,
                    background: d.valor > 0 ? cor : 'var(--surface2)',
                    borderRadius: '4px 4px 0 0',
                    opacity: ativo === null || destacado ? 1 : 0.45,
                    transition: 'opacity 0.15s, height 0.5s ease',
                    minHeight: 2,
                  }}
                />
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        {dados.map((d, i) => (
          <span key={d.mes} style={{
            flex: 1, textAlign: 'center', fontSize: 10,
            color: ativo === i ? 'var(--text2)' : 'var(--text3)',
            fontFamily: "'DM Mono', monospace",
          }}>
            {d.mes}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Dashboard
   ═══════════════════════════════════════════════════════════ */

export default function Dashboard({
  leads = [], etapas = [], tarefas = [], propostas = [], metas = {}, responsaveis = [],
  onNavegar = () => {}, onAbrirLead = () => {}, onFiltrarEtapa = () => {}, onToggleTarefa = () => {},
}) {
  const [periodo, setPeriodo] = useState('mes');
  const [respFiltro, setRespFiltro] = useState('');

  const janela = useMemo(() => calcularJanela(periodo), [periodo]);

  // Recorte por responsável vale para a tela inteira
  const leadsVisiveis = useMemo(
    () => (respFiltro ? leads.filter(l => l.responsavel === respFiltro) : leads),
    [leads, respFiltro]
  );
  const tarefasVisiveis = useMemo(
    () => (respFiltro ? tarefas.filter(t => t.responsavel === respFiltro) : tarefas),
    [tarefas, respFiltro]
  );

  /* ── Números do período ── */
  const numeros = useMemo(() => {
    const { inicio, fim, inicioAnt, fimAnt, rotuloAnt } = janela;

    const noPeriodo = (l) => dentro(dataEntrada(l), inicio, fim);
    const noAnterior = (l) => dentro(dataEntrada(l), inicioAnt, fimAnt);

    const novos      = leadsVisiveis.filter(noPeriodo).length;
    const novosAnt   = inicioAnt ? leadsVisiveis.filter(noAnterior).length : null;

    const ganhos     = leadsVisiveis.filter(l => ehGanho(etapas, l.status));
    const ganhosPer  = ganhos.filter(l => dentro(dataFecho(l), inicio, fim));
    const ganhosAnt  = inicioAnt ? ganhos.filter(l => dentro(dataFecho(l), inicioAnt, fimAnt)) : null;

    const receita     = ganhosPer.reduce((s, l) => s + (Number(l.valor) || 0), 0);
    const receitaAnt  = ganhosAnt ? ganhosAnt.reduce((s, l) => s + (Number(l.valor) || 0), 0) : null;

    const reunioes    = leadsVisiveis.filter(l => dentro(l.reuniao, inicio, fim)).length;
    const reunioesAnt = inicioAnt ? leadsVisiveis.filter(l => dentro(l.reuniao, inicioAnt, fimAnt)).length : null;

    // Pipeline e previsão são fotos do agora, não do período
    const emAberto = valorEmAberto(etapas, leadsVisiveis);
    const previsao = previsaoPonderada(etapas, leadsVisiveis);
    const abertos  = leadsVisiveis.filter(l => ehAberto(etapas, l.status)).length;

    return {
      novos, novosAnt, receita, receitaAnt, ganhosPer: ganhosPer.length,
      reunioes, reunioesAnt, emAberto, previsao, abertos, rotuloAnt,
    };
  }, [leadsVisiveis, etapas, janela]);

  /* ── Pendências: o "o que eu faço agora" ── */
  const pendencias = useMemo(() => {
    const hoje = hojeISO();
    const itens = [];

    const atrasadas = tarefasVisiveis.filter(t => t.data && t.data < hoje && !t.concluida);
    if (atrasadas.length) itens.push({
      chave: 'atrasadas', icone: '⏰', severidade: 'critico',
      titulo: `${atrasadas.length} tarefa${atrasadas.length > 1 ? 's' : ''} atrasada${atrasadas.length > 1 ? 's' : ''}`,
      detalhe: `Mais antiga: ${formataData(atrasadas.sort((a, b) => a.data.localeCompare(b.data))[0].data)}`,
      acao: () => onNavegar('tarefas'),
    });

    const paradas = leadsVisiveis.filter(l =>
      ehAberto(etapas, l.status) && l.status !== 'nenhum' && diasDesde(l.updatedAt) > 15
    );
    if (paradas.length) {
      const valorParado = paradas.reduce((s, l) => s + (Number(l.valor) || 0), 0);
      itens.push({
        chave: 'paradas', icone: '🧊', severidade: 'critico',
        titulo: `${paradas.length} negócio${paradas.length > 1 ? 's' : ''} esfriando`,
        detalhe: valorParado > 0
          ? `${formatarBRL(valorParado)} sem contato há mais de 15 dias`
          : 'Sem atualização há mais de 15 dias',
        acao: () => onNavegar('leads'),
      });
    }

    const propostasParadas = propostas.filter(p =>
      p.status === 'enviada' && diasDesde(p.data || p.createdAt) > 7
    );
    if (propostasParadas.length) itens.push({
      chave: 'propostas', icone: '📤', severidade: 'alerta',
      titulo: `${propostasParadas.length} proposta${propostasParadas.length > 1 ? 's' : ''} sem resposta`,
      detalhe: `Enviada${propostasParadas.length > 1 ? 's' : ''} há mais de 7 dias`,
      acao: () => onNavegar('financeiro'),
    });

    const semDono = leadsVisiveis.filter(l => !l.responsavel && ehAberto(etapas, l.status));
    if (semDono.length) itens.push({
      chave: 'semDono', icone: '👤', severidade: 'alerta',
      titulo: `${semDono.length} lead${semDono.length > 1 ? 's' : ''} sem responsável`,
      detalhe: 'Ninguém foi designado para dar sequência',
      acao: () => onNavegar('leads'),
    });

    const semValor = leadsVisiveis.filter(l => ehAberto(etapas, l.status) && !(Number(l.valor) > 0));
    if (semValor.length) itens.push({
      chave: 'semValor', icone: '💸', severidade: 'info',
      titulo: `${semValor.length} negócio${semValor.length > 1 ? 's' : ''} sem valor`,
      detalhe: 'Ficam de fora da previsão de receita',
      acao: () => onNavegar('leads'),
    });

    return itens;
  }, [leadsVisiveis, tarefasVisiveis, propostas, etapas, onNavegar]);

  /* ── Funil ── */
  const funil = useMemo(() => {
    const doFunil = etapasDoFunil(etapas);
    const idsNoFunil = new Set(doFunil.map(e => e.id));

    const linhas = doFunil.map(etapa => {
      const daEtapa = leadsVisiveis.filter(l => l.status === etapa.id);
      return {
        id: etapa.id, label: etapa.label, cor: etapa.cor,
        quantidade: daEtapa.length,
        valor: daEtapa.reduce((s, l) => s + (Number(l.valor) || 0), 0),
      };
    });

    // Leads que não aparecem em nenhuma barra: os sem ação e os perdidos.
    // Com a base cheia deles, o funil parece vazio sem explicação nenhuma.
    const semAcao = leadsVisiveis.filter(l => (l.status || 'nenhum') === 'nenhum').length;
    const perdidos = leadsVisiveis.filter(l => !idsNoFunil.has(l.status) && l.status !== 'nenhum').length;

    return {
      linhas,
      max: Math.max(...linhas.map(l => l.quantidade), 1),
      noFunil: linhas.reduce((s, l) => s + l.quantidade, 0),
      semAcao,
      perdidos,
    };
  }, [leadsVisiveis, etapas]);

  /* ── Evolução dos últimos 6 meses ── */
  const evolucao = useMemo(() => {
    return ultimosMeses(6).map(m => ({
      mes: m.mes,
      novos: leadsVisiveis.filter(l => chaveMes(dataEntrada(l)) === m.chave).length,
      receita: leadsVisiveis
        .filter(l => ehGanho(etapas, l.status) && chaveMes(dataFecho(l)) === m.chave)
        .reduce((s, l) => s + (Number(l.valor) || 0), 0),
    }));
  }, [leadsVisiveis, etapas]);

  /* ── Agenda de hoje ── */
  const hoje = hojeISO();
  const agendaHoje = useMemo(() => {
    const doDia = tarefasVisiveis
      .filter(t => t.data === hoje)
      .map(t => ({ tipo: 'tarefa', id: t.id, hora: t.hora || '', titulo: t.titulo, lead: t.leadNome, concluida: t.concluida, dado: t }));

    const atrasadas = tarefasVisiveis
      .filter(t => t.data && t.data < hoje && !t.concluida)
      .map(t => ({ tipo: 'tarefa', id: t.id, hora: t.hora || '', titulo: t.titulo, lead: t.leadNome, concluida: false, atrasada: true, dado: t }));

    const reunioes = leadsVisiveis
      .filter(l => l.reuniao === hoje)
      .map(l => ({ tipo: 'reuniao', id: l.id, hora: '', titulo: `Reunião com ${l.nome}`, lead: l.nome, dado: l }));

    return [...atrasadas, ...reunioes, ...doDia].sort((a, b) => (a.hora || '99:99').localeCompare(b.hora || '99:99'));
  }, [tarefasVisiveis, leadsVisiveis, hoje]);

  /* ── Ranking ── */
  const ranking = useMemo(() => {
    const mapa = leadsVisiveis.reduce((acc, l) => {
      const nome = l.responsavel || 'Sem responsável';
      if (!acc[nome]) acc[nome] = {
        nome, leads: 0, ganhos: 0, valor: 0, aberto: 0,
        iniciais: nome.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase().slice(0, 2),
      };
      acc[nome].leads++;
      if (ehGanho(etapas, l.status)) { acc[nome].ganhos++; acc[nome].valor += Number(l.valor) || 0; }
      if (ehAberto(etapas, l.status)) acc[nome].aberto += Number(l.valor) || 0;
      return acc;
    }, {});
    return Object.values(mapa)
      .map(r => ({ ...r, taxa: r.leads > 0 ? Math.round(r.ganhos / r.leads * 100) : 0 }))
      .sort((a, b) => b.valor - a.valor || b.leads - a.leads)
      .slice(0, 5);
  }, [leadsVisiveis, etapas]);

  const leadsRecentes = useMemo(
    () => [...leadsVisiveis].sort((a, b) => (dataEntrada(b) || '').localeCompare(dataEntrada(a) || '')).slice(0, 6),
    [leadsVisiveis]
  );

  /* ── KPIs ── */
  const metaReceita  = Number(metas.receitaMensal) || 0;
  const metaLeads    = Number(metas.novosLeadsMes) || 0;
  const metaReunioes = Number(metas.reunioesMes) || 0;

  const kpis = [
    {
      rotulo: 'Receita Fechada',
      valor: formatarBRLCurto(numeros.receita),
      exato: formatarBRL(numeros.receita),
      sub: `${numeros.ganhosPer} negócio(s) ganho(s) no período`,
      icone: '💰', cor: 'var(--green)',
      meta: metaReceita, atingido: numeros.receita,
      delta: { atual: numeros.receita, anterior: numeros.receitaAnt },
    },
    {
      rotulo: 'Pipeline em Aberto',
      valor: formatarBRLCurto(numeros.emAberto),
      exato: formatarBRL(numeros.emAberto),
      sub: `${numeros.abertos} negócio(s) em andamento`,
      icone: '📊', cor: 'var(--accent)',
    },
    {
      rotulo: 'Previsão Ponderada',
      valor: formatarBRLCurto(numeros.previsao),
      exato: formatarBRL(numeros.previsao),
      sub: 'Valor × chance de fechar de cada etapa',
      icone: '🎯', cor: 'var(--accent2)',
    },
    {
      rotulo: 'Novos Leads',
      valor: numeros.novos,
      sub: metaLeads > 0 ? `Meta do mês: ${metaLeads}` : 'Defina a meta em Configurações',
      icone: '👥', cor: 'var(--purple)',
      meta: metaLeads, atingido: numeros.novos,
      delta: { atual: numeros.novos, anterior: numeros.novosAnt },
    },
    {
      rotulo: 'Reuniões',
      valor: numeros.reunioes,
      sub: metaReunioes > 0 ? `Meta do mês: ${metaReunioes}` : 'Marcadas no período',
      icone: '📅', cor: 'var(--yellow)',
      meta: metaReunioes, atingido: numeros.reunioes,
      delta: { atual: numeros.reunioes, anterior: numeros.reunioesAnt },
    },
  ];

  const coresSeveridade = {
    critico: { cor: 'var(--red)',    fundo: 'rgba(239,68,68,0.09)',  borda: 'rgba(239,68,68,0.28)'  },
    alerta:  { cor: 'var(--yellow)', fundo: 'rgba(250,204,21,0.09)', borda: 'rgba(250,204,21,0.28)' },
    info:    { cor: 'var(--accent)', fundo: 'rgba(0,208,223,0.08)',  borda: 'rgba(0,208,223,0.26)'  },
  };

  /* ═══ RENDER ═══ */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 28px 80px' }}>
        <div style={{ animation: 'fadeIn 0.35s ease', maxWidth: 1400, margin: '0 auto' }}>

          {/* ── Cabeçalho + filtros ── */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
            gap: 16, flexWrap: 'wrap', marginBottom: 24,
          }}>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.4px' }}>
                Dashboard
              </h1>
              <p style={{ color: 'var(--text3)', marginTop: 4, marginBottom: 0, fontSize: 13 }}>
                {respFiltro ? `Carteira de ${respFiltro}` : 'Visão geral do seu CRM'}
                {janela.inicio && ` · ${formataData(janela.inicio)} a ${formataData(janela.fim)}`}
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {responsaveis.length > 0 && (
                <select
                  value={respFiltro}
                  onChange={e => setRespFiltro(e.target.value)}
                  className="form-control"
                  style={{ width: 'auto', fontSize: 12, padding: '5px 10px' }}
                  title="Filtrar o dashboard por responsável"
                >
                  <option value="">Toda a equipe</option>
                  {responsaveis.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              )}
              <div style={{ display: 'flex', gap: 4, background: 'var(--surface2)', borderRadius: 8, padding: 3 }}>
                {PERIODOS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setPeriodo(p.id)}
                    style={{
                      fontSize: 12, padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
                      border: 'none', fontFamily: 'inherit', fontWeight: periodo === p.id ? 600 : 400,
                      background: periodo === p.id ? 'var(--accent)' : 'transparent',
                      color: periodo === p.id ? '#04222b' : 'var(--text3)',
                      transition: 'all 0.15s',
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Precisa de atenção ── */}
          <div style={{ marginBottom: 24 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
              color: 'var(--text3)', marginBottom: 10,
            }}>
              Precisa de atenção
            </div>

            {pendencias.length === 0 ? (
              <div style={{
                ...cartao, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12,
                borderColor: 'rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.06)',
              }}>
                <span style={{ fontSize: 20 }}>✅</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Tudo em dia</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                    Nenhuma tarefa atrasada, negócio parado ou proposta sem resposta.
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
                {pendencias.map(p => {
                  const c = coresSeveridade[p.severidade];
                  return (
                    <button
                      key={p.chave}
                      onClick={p.acao}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 12, textAlign: 'left',
                        padding: '14px 16px', borderRadius: 10, cursor: 'pointer',
                        background: c.fundo, border: `1px solid ${c.borda}`,
                        fontFamily: 'inherit', transition: 'transform 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                      <span style={{ fontSize: 18, lineHeight: 1.2, flexShrink: 0 }}>{p.icone}</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 650, color: c.cor, marginBottom: 3 }}>
                          {p.titulo}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.45 }}>
                          {p.detalhe}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── KPIs ── */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(215px, 1fr))',
            gap: 14, marginBottom: 24,
          }}>
            {kpis.map((kpi, i) => {
              const pctMeta = kpi.meta > 0 ? Math.min(Math.round((kpi.atingido / kpi.meta) * 100), 100) : null;
              return (
                <div key={i} style={{ ...cartao, borderTop: `3px solid ${kpi.cor}`, padding: '18px 18px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <span style={{
                      color: 'var(--text3)', fontSize: 11, fontWeight: 600,
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>
                      {kpi.rotulo}
                    </span>
                    <span style={{ fontSize: 16, opacity: 0.9 }}>{kpi.icone}</span>
                  </div>

                  <div
                    style={{ fontFamily: "'DM Mono', monospace", fontSize: 25, fontWeight: 700, color: 'var(--text)', lineHeight: 1.1 }}
                    title={kpi.exato}
                  >
                    {kpi.valor}
                  </div>

                  <div style={{ marginTop: 6, minHeight: 17 }}>
                    {kpi.delta && (
                      <Delta atual={kpi.delta.atual} anterior={kpi.delta.anterior} rotulo={numeros.rotuloAnt} />
                    )}
                  </div>

                  <div style={{ color: 'var(--text3)', fontSize: 11.5, margin: '4px 0 12px', lineHeight: 1.4 }}>
                    {kpi.sub}
                  </div>

                  {pctMeta !== null ? (
                    <>
                      <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{
                          width: `${pctMeta}%`, height: '100%', background: kpi.cor,
                          borderRadius: 4, transition: 'width 0.7s ease',
                        }} />
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 5, fontFamily: "'DM Mono', monospace" }}>
                        {pctMeta}% da meta
                      </div>
                    </>
                  ) : (
                    <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 4, opacity: 0.5 }} />
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Funil + Agenda ── */}
          <div className="grid-conteudo" style={{ marginBottom: 18 }}>

            <div style={cartao}>
              <TituloCartao acao={<BotaoVerTudo onClick={() => onNavegar('leads')}>Abrir leads</BotaoVerTudo>}>
                Funil de Vendas
              </TituloCartao>

              {leadsVisiveis.length === 0 ? (
                <Vazio>Nenhum lead cadastrado ainda.</Vazio>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {funil.linhas.map(etapa => (
                    <button
                      key={etapa.id}
                      onClick={() => onFiltrarEtapa(etapa.id)}
                      title={`Ver os ${etapa.quantidade} lead(s) em ${etapa.label}`}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                        background: 'transparent', border: 'none', padding: '3px 4px',
                        cursor: 'pointer', fontFamily: 'inherit', borderRadius: 6,
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{
                        color: 'var(--text2)', fontSize: 12.5, width: 132, textAlign: 'right',
                        flexShrink: 0, fontWeight: 500,
                      }}>
                        {etapa.label}
                      </span>

                      <div style={{ flex: 1, height: 24, background: 'var(--surface2)', borderRadius: 5, overflow: 'hidden', minWidth: 0 }}>
                        {/* Sem lead na etapa, nada é desenhado: uma div de largura
                            zero ainda pintava um risco da cor da etapa. */}
                        {etapa.quantidade > 0 && (
                          <div style={{
                            width: `${(etapa.quantidade / funil.max * 100).toFixed(1)}%`,
                            height: '100%', background: etapa.cor, borderRadius: 5,
                            transition: 'width 0.6s ease',
                            display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 8,
                            minWidth: 26,
                          }}>
                            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 700, color: '#fff' }}>
                              {etapa.quantidade}
                            </span>
                          </div>
                        )}
                      </div>

                      <span
                        style={{
                          fontFamily: "'DM Mono', monospace", fontSize: 11.5, width: 60,
                          textAlign: 'right', flexShrink: 0, fontWeight: 600,
                          color: etapa.valor > 0 ? 'var(--green)' : 'var(--text3)',
                        }}
                        title={etapa.valor > 0 ? formatarBRL(etapa.valor) : 'Sem valor informado'}
                      >
                        {etapa.valor > 0 ? formatarBRLCurto(etapa.valor) : '—'}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Quem ficou de fora das barras */}
              {leadsVisiveis.length > 0 && (funil.semAcao > 0 || funil.perdidos > 0) && (
                <div style={{
                  marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)',
                  fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.55,
                  display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap',
                }}>
                  <span>
                    <strong style={{ color: 'var(--text2)', fontFamily: "'DM Mono', monospace" }}>
                      {funil.noFunil}
                    </strong> no funil
                    {funil.semAcao > 0 && (
                      <> · <strong style={{ color: 'var(--yellow)', fontFamily: "'DM Mono', monospace" }}>
                        {funil.semAcao}
                      </strong> ainda sem ação</>
                    )}
                    {funil.perdidos > 0 && (
                      <> · <strong style={{ color: 'var(--text3)', fontFamily: "'DM Mono', monospace" }}>
                        {funil.perdidos}
                      </strong> perdidos</>
                    )}
                  </span>
                  {funil.semAcao > funil.noFunil && (
                    <button
                      onClick={() => onFiltrarEtapa('nenhum')}
                      style={{
                        background: 'transparent', border: 'none', color: 'var(--accent)',
                        fontSize: 11.5, cursor: 'pointer', padding: 0, fontFamily: 'inherit',
                      }}
                    >
                      Qualificar agora →
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Agenda de hoje — acionável */}
            <div style={cartao}>
              <TituloCartao acao={<BotaoVerTudo onClick={() => onNavegar('tarefas')} />}>
                Hoje
              </TituloCartao>

              {agendaHoje.length === 0 ? (
                <Vazio>Nada marcado para hoje.</Vazio>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 260, overflowY: 'auto' }}>
                  {agendaHoje.map(item => (
                    <div
                      key={`${item.tipo}-${item.id}`}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 6px',
                        borderRadius: 7, opacity: item.concluida ? 0.5 : 1,
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {item.tipo === 'tarefa' ? (
                        <button
                          onClick={() => onToggleTarefa(item.dado)}
                          title={item.concluida ? 'Marcar como pendente' : 'Marcar como concluída'}
                          style={{
                            width: 19, height: 19, borderRadius: '50%', flexShrink: 0, padding: 0,
                            border: item.concluida ? 'none' : '2px solid var(--border2)',
                            background: item.concluida ? 'var(--green)' : 'transparent',
                            color: '#fff', fontSize: 10, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          {item.concluida && '✓'}
                        </button>
                      ) : (
                        <span style={{ fontSize: 14, flexShrink: 0, width: 19, textAlign: 'center' }}>🤝</span>
                      )}

                      <button
                        onClick={() => item.tipo === 'reuniao' ? onAbrirLead(item.dado) : onNavegar('tarefas')}
                        style={{
                          flex: 1, minWidth: 0, background: 'transparent', border: 'none',
                          textAlign: 'left', cursor: 'pointer', padding: 0, fontFamily: 'inherit',
                        }}
                      >
                        <div style={{
                          fontSize: 12.5, fontWeight: 500, color: 'var(--text)',
                          textDecoration: item.concluida ? 'line-through' : 'none',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {item.titulo}
                        </div>
                        <div style={{ fontSize: 10.5, marginTop: 1, display: 'flex', gap: 6 }}>
                          {item.atrasada && <span style={{ color: 'var(--red)', fontWeight: 600 }}>atrasada</span>}
                          <span style={{ color: 'var(--accent2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.lead}
                          </span>
                        </div>
                      </button>

                      {item.hora && (
                        <span style={{ color: 'var(--text3)', fontSize: 11, fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>
                          {item.hora}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Evolução + Ranking ── */}
          <div className="grid-conteudo" style={{ marginBottom: 18 }}>

            <div style={cartao}>
              <TituloCartao>Últimos 6 meses</TituloCartao>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 26 }}>
                <MiniBarras
                  titulo="Novos leads por mês"
                  dados={evolucao.map(e => ({ mes: e.mes, valor: e.novos }))}
                  cor="var(--accent)"
                  formatar={v => String(v)}
                />
                <MiniBarras
                  titulo="Receita fechada por mês"
                  dados={evolucao.map(e => ({ mes: e.mes, valor: e.receita }))}
                  cor="var(--green)"
                  formatar={formatarBRLCurto}
                />
              </div>
            </div>

            <div style={cartao}>
              <TituloCartao acao={<BotaoVerTudo onClick={() => onNavegar('relatorios')} />}>
                Ranking da Equipe
              </TituloCartao>

              {ranking.length === 0 ? (
                <Vazio>Sem leads atribuídos ainda.</Vazio>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                  {ranking.map((membro, i) => (
                    <div key={membro.nome} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                      <span style={{
                        fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700,
                        color: i === 0 ? 'var(--yellow)' : 'var(--text3)', width: 16, textAlign: 'center', flexShrink: 0,
                      }}>
                        {i + 1}
                      </span>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                        background: 'var(--surface3)', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--accent)',
                      }}>
                        {membro.iniciais}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 12.5, fontWeight: 600, color: 'var(--text)',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {membro.nome}
                        </div>
                        <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 1 }}>
                          {membro.leads} leads · {membro.taxa}% convertidos
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700, color: 'var(--green)' }}>
                          {membro.valor > 0 ? formatarBRLCurto(membro.valor) : '—'}
                        </div>
                        {membro.aberto > 0 && (
                          <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: "'DM Mono', monospace" }}>
                            {formatarBRLCurto(membro.aberto)} aberto
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Leads recentes ── */}
          <div style={cartao}>
            <TituloCartao acao={<BotaoVerTudo onClick={() => onNavegar('leads')} />}>
              Leads Recentes
            </TituloCartao>

            {leadsRecentes.length === 0 ? (
              <Vazio>Nenhum lead cadastrado ainda.</Vazio>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 4 }}>
                {leadsRecentes.map(lead => {
                  const etapa = acharEtapa(etapas, lead.status);
                  return (
                    <button
                      key={lead.id}
                      onClick={() => onAbrirLead(lead)}
                      title={`Abrir ${lead.nome}`}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 11, padding: '9px 8px',
                        borderRadius: 8, background: 'transparent', border: 'none',
                        cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                        background: 'var(--surface3)', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: 13, fontWeight: 600, color: 'var(--accent)',
                      }}>
                        {(lead.nome || '?').charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 12.5, fontWeight: 600, color: 'var(--text)',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {lead.nome}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 3 }}>
                          <span className={`status-badge ${etapa.cls}`} style={{ fontSize: 9.5, padding: '1px 7px', borderRadius: 99 }}>
                            {etapa.label}
                          </span>
                          <span style={{ fontSize: 10.5, color: 'var(--text3)' }}>{lead.nicho || '—'}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        {Number(lead.valor) > 0 && (
                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11.5, fontWeight: 700, color: 'var(--green)' }}>
                            {formatarBRLCurto(lead.valor)}
                          </div>
                        )}
                        <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: "'DM Mono', monospace" }}>
                          {tempoAtras(lead.createdAt || lead.data_entrada)}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
