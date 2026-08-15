import { ref, push, set, update, query, orderByChild, equalTo, limitToLast, onValue } from 'firebase/database';
import { database, auth } from './firebase';

// Histórico automático. Antes disso o único registro era o campo "Histórico",
// uma caixa de texto que alguém precisava lembrar de preencher — ninguém sabia
// quem mudou o quê nem quando.

export const TIPOS = {
  criado:        { icone: '✨', cor: 'var(--accent)' },
  status:        { icone: '🔀', cor: 'var(--purple)' },
  editado:       { icone: '✏️', cor: 'var(--text3)' },
  tarefa:        { icone: '✅', cor: 'var(--green)' },
  tarefaCriada:  { icone: '📌', cor: 'var(--yellow)' },
  proposta:      { icone: '📋', cor: 'var(--pink)' },
  mensagem:      { icone: '💬', cor: 'var(--cyan)' },
  email:         { icone: '✉️', cor: 'var(--accent2)' },
  reuniao:       { icone: '🤝', cor: 'var(--green)' },
  nota:          { icone: '📝', cor: 'var(--text2)' },
  importado:     { icone: '📥', cor: 'var(--accent)' },
};

function autorAtual() {
  const u = auth.currentUser;
  if (!u) return { uid: null, nome: 'Sistema' };
  return {
    uid: u.uid,
    nome: u.displayName || (u.email ? u.email.split('@')[0] : 'Usuário'),
  };
}

/**
 * Registra um evento na linha do tempo de um lead.
 * Falha em silêncio de propósito: um erro ao gravar histórico nunca deve
 * impedir a ação principal que o usuário estava fazendo.
 */
export function registrarAtividade({ leadId, leadNome = '', tipo = 'nota', descricao, detalhe = null }) {
  if (!leadId || !descricao) return Promise.resolve();

  const autor = autorAtual();
  const novaRef = push(ref(database, 'crm_data/atividades'));

  return set(novaRef, {
    id: novaRef.key,
    leadId,
    leadNome,
    tipo,
    descricao,
    detalhe,
    autorUid: autor.uid,
    autorNome: autor.nome,
    criadoEm: new Date().toISOString(),
  }).catch(erro => {
    console.warn('[atividades] Não foi possível registrar o histórico:', erro?.message);
  });
}

/**
 * Registra várias atividades numa gravação só.
 * Numa edição em massa de 600 leads, 600 chamadas separadas travariam a tela e
 * castigariam a cota do Firebase; isto vai em uma única escrita multi-caminho.
 */
export function registrarAtividadesEmLote(itens) {
  if (!itens || itens.length === 0) return Promise.resolve();

  const autor = autorAtual();
  const criadoEm = new Date().toISOString();
  const gravacoes = {};

  itens.forEach(item => {
    if (!item?.leadId || !item?.descricao) return;
    const novaRef = push(ref(database, 'crm_data/atividades'));
    gravacoes[novaRef.key] = {
      id: novaRef.key,
      leadId: item.leadId,
      leadNome: item.leadNome || '',
      tipo: item.tipo || 'editado',
      descricao: item.descricao,
      detalhe: item.detalhe || null,
      autorUid: autor.uid,
      autorNome: autor.nome,
      criadoEm,
    };
  });

  if (Object.keys(gravacoes).length === 0) return Promise.resolve();

  return update(ref(database, 'crm_data/atividades'), gravacoes).catch(erro => {
    console.warn('[atividades] Não foi possível registrar o histórico em lote:', erro?.message);
  });
}

/** Compara dois estados de um lead e descreve o que mudou, campo a campo. */
export function descreverEdicao(antes, depois, rotulos = {}) {
  const ignorar = new Set(['id', 'createdAt', 'updatedAt', 'historico']);
  const mudancas = [];

  Object.keys(depois || {}).forEach(campo => {
    if (ignorar.has(campo)) return;
    const de = antes?.[campo] ?? '';
    const para = depois?.[campo] ?? '';
    if (String(de) === String(para)) return;
    mudancas.push({ campo, rotulo: rotulos[campo] || campo, de: String(de), para: String(para) });
  });

  return mudancas;
}

/** Escuta a linha do tempo de um lead específico. Devolve a função de cancelar. */
export function escutarAtividadesDoLead(leadId, aoReceber) {
  if (!leadId) { aoReceber([]); return () => {}; }

  const consulta = query(
    ref(database, 'crm_data/atividades'),
    orderByChild('leadId'),
    equalTo(leadId),
  );

  return onValue(consulta, (snap) => {
    const data = snap.val();
    const lista = data
      ? Object.entries(data)
          .map(([id, a]) => ({ ...a, id }))
          .sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm))
      : [];
    aoReceber(lista);
  }, (erro) => {
    console.warn('[atividades] Falha ao ler histórico:', erro?.message);
    aoReceber([]);
  });
}

/** Escuta as últimas atividades de todo o CRM (usado em Relatórios). */
export function escutarAtividadesRecentes(quantidade, aoReceber) {
  const consulta = query(
    ref(database, 'crm_data/atividades'),
    orderByChild('criadoEm'),
    limitToLast(quantidade),
  );

  return onValue(consulta, (snap) => {
    const data = snap.val();
    const lista = data
      ? Object.entries(data)
          .map(([id, a]) => ({ ...a, id }))
          .sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm))
      : [];
    aoReceber(lista);
  }, (erro) => {
    console.warn('[atividades] Falha ao ler atividades recentes:', erro?.message);
    aoReceber([]);
  });
}

export function tempoRelativo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  const h   = Math.floor(diff / 3600000);
  const d   = Math.floor(diff / 86400000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min} min atrás`;
  if (h < 24) return `${h}h atrás`;
  if (d === 1) return 'ontem';
  if (d < 30) return `${d} dias atrás`;
  return new Date(iso).toLocaleDateString('pt-BR');
}
