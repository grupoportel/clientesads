// Janelas de tempo compartilhadas pelas telas de análise.
// Fica fora dos componentes para poder ser testado sem montar React — e porque
// Dashboard, Relatórios e Financeiro precisam responder à mesma pergunta
// ("o que caiu neste período?") exatamente do mesmo jeito.

export const iso = (d) => {
  // Usa o fuso local, não UTC: toISOString() em 31/01 23:00 no Brasil devolve
  // 01/02, e o lead cadastrado hoje cairia no mês seguinte.
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
};

export const hojeISO = () => iso(new Date());

export const PERIODOS = [
  { id: 'mes',  label: 'Este mês' },
  { id: '30d',  label: '30 dias'  },
  { id: '90d',  label: '90 dias'  },
  { id: 'tudo', label: 'Tudo'     },
];

/**
 * Devolve a janela atual e a janela imediatamente anterior de mesmo tamanho.
 * É a janela anterior que permite dizer "cresceu 18% em relação ao período
 * anterior" em vez de mostrar um número solto sem referência.
 *
 * @param {string} periodoId  um dos ids de PERIODOS
 * @param {Date}   agora      injetável para permitir teste determinístico
 */
export function calcularJanela(periodoId, agora = new Date()) {
  if (periodoId === 'tudo') {
    return { inicio: null, fim: null, inicioAnt: null, fimAnt: null, rotuloAnt: '' };
  }

  if (periodoId === 'mes') {
    const inicio    = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const inicioAnt = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
    const fimAnt    = new Date(agora.getFullYear(), agora.getMonth(), 0); // dia 0 = último dia do mês anterior
    return {
      inicio: iso(inicio), fim: iso(agora),
      inicioAnt: iso(inicioAnt), fimAnt: iso(fimAnt),
      rotuloAnt: 'mês passado',
    };
  }

  const dias      = periodoId === '90d' ? 90 : 30;
  const inicio    = new Date(agora.getTime() - dias * 86400000);
  const fimAnt    = new Date(inicio.getTime() - 86400000);
  const inicioAnt = new Date(fimAnt.getTime() - dias * 86400000);
  return {
    inicio: iso(inicio), fim: iso(agora),
    inicioAnt: iso(inicioAnt), fimAnt: iso(fimAnt),
    rotuloAnt: `${dias} dias anteriores`,
  };
}

/** Um carimbo de data cai dentro da janela? Limites inclusivos. */
export function dentro(data, inicio, fim) {
  if (!data) return false;
  const d = String(data).slice(0, 10);
  if (inicio && d < inicio) return false;
  if (fim && d > fim) return false;
  return true;
}

// ── Datas relevantes de um lead ────────────────────────────────────────────

/** Quando o lead entrou: o campo preenchido à mão tem prioridade. */
export const dataEntrada = (l) => (l?.data_entrada || l?.createdAt || '').slice(0, 10);

/**
 * Quando o negócio foi fechado. fechadoEm passou a ser carimbado na troca de
 * status; para registros anteriores a isso, updatedAt é a melhor aproximação
 * disponível — imprecisa, porque muda a cada edição de telefone.
 */
export const dataFecho = (l) => (l?.fechadoEm || l?.updatedAt || '').slice(0, 10);

/** Dias inteiros decorridos desde a data. Sem data = Infinity. */
export function diasDesde(data) {
  if (!data) return Infinity;
  const t = new Date(data).getTime();
  if (Number.isNaN(t)) return Infinity;
  return Math.floor((Date.now() - t) / 86400000);
}

// ── Formatação ─────────────────────────────────────────────────────────────

export const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

export const formataData = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '');

export function tempoAtras(isoStr) {
  if (!isoStr) return '—';
  const ms = Date.now() - new Date(isoStr).getTime();
  if (Number.isNaN(ms)) return '—';
  const h = Math.floor(ms / 3600000);
  const d = Math.floor(ms / 86400000);
  if (h < 1) return 'agora';
  if (h < 24) return `${h}h atrás`;
  if (d === 1) return 'ontem';
  return `${d}d atrás`;
}

/** Os últimos N meses, do mais antigo ao atual, com a chave "YYYY-MM". */
export function ultimosMeses(quantidade, agora = new Date()) {
  const lista = [];
  for (let i = quantidade - 1; i >= 0; i--) {
    const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    lista.push({
      mes: MESES[d.getMonth()],
      chave: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    });
  }
  return lista;
}

export const chaveMes = (data) => (data || '').slice(0, 7);
