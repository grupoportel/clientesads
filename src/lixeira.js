// Lixeira e desfazer. Pura, sem Firebase, para poder ser testada.
//
// Excluir um lead apagava o registro do banco na hora, sem volta. Isso já era
// arriscado com uma pessoa só usando o CRM; agora que existe exclusão em massa
// e mais de um Editor com permissão de escrita, um clique errado leva junto
// centenas de leads que ninguém consegue trazer de volta.
//
// Aqui a exclusão vira mudança de lugar: o lead sai de crm_data/leads e cai em
// crm_data/lixeira, inteiro. Continua existindo, só não aparece. Quem apagou
// por engano restaura; quem quis apagar mesmo esvazia a lixeira depois.

/** Quantos dias um item fica na lixeira antes de ser considerado vencido. */
export const PRAZO_DIAS = 30;

/**
 * Empacota um lead para a lixeira.
 *
 * O lead vai para dentro de `dados` em vez de ser espalhado no próprio item:
 * assim nenhum campo do lead (um `nome`, um `tipo`) colide com os campos de
 * controle da lixeira, e restaurar é devolver `dados` sem ter que lembrar
 * quais chaves eram de controle.
 */
export function paraLixeira(lead, quem = '', agoraIso = new Date().toISOString()) {
  const { ...dados } = lead;
  return {
    tipo: 'lead',
    idOriginal: lead.id,
    // Guardado solto só para a lista da lixeira conseguir mostrar algo sem
    // abrir cada registro.
    rotulo: lead.nome || lead.empresa || '(sem nome)',
    excluidoEm: agoraIso,
    excluidoPor: quem || 'desconhecido',
    dados,
  };
}

/**
 * Desempacota um item da lixeira de volta para lead.
 *
 * Devolve null para item sem `dados` ou sem id: um registro corrompido não
 * deve virar um lead pela metade, e restaurar em silêncio um lead vazio é
 * pior do que avisar que aquele item não dá para trazer de volta.
 */
export function deLixeira(item) {
  if (!item?.dados || !item.idOriginal) return null;
  return { id: item.idOriginal, dados: item.dados };
}

/** Há quantos dias o item está na lixeira. */
export function diasNaLixeira(item, agoraMs = Date.now()) {
  if (!item?.excluidoEm) return 0;
  const ms = new Date(item.excluidoEm).getTime();
  if (Number.isNaN(ms)) return 0;
  return Math.max(0, Math.floor((agoraMs - ms) / 86400000));
}

/** Itens que já passaram do prazo. Serve para avisar, não para apagar sozinho. */
export function vencidos(itens = [], agoraMs = Date.now()) {
  return itens.filter(i => diasNaLixeira(i, agoraMs) >= PRAZO_DIAS);
}

/**
 * Monta a gravação multi-caminho que restaura o valor anterior de um campo.
 *
 * A edição em massa sobrescreve um campo em centenas de leads de uma vez, e é
 * tão destrutiva quanto uma exclusão — só que silenciosa, porque os leads
 * continuam lá. Guardar o valor antigo de cada um permite desfazer sem ter que
 * consultar o banco de novo.
 */
export function planoDeDesfazer(anteriores = {}, campo) {
  const gravacoes = {};
  Object.entries(anteriores).forEach(([id, valor]) => {
    // undefined e '' viram null: no Realtime Database, gravar null é o que
    // apaga a chave. Deixar undefined faria a chave ser ignorada e o valor
    // novo continuaria lá.
    gravacoes[`${id}/${campo}`] = (valor === undefined || valor === '') ? null : valor;
  });
  return gravacoes;
}

/** Texto curto de quanto tempo faz, para a lista da lixeira. */
export function textoTempoNaLixeira(item, agoraMs = Date.now()) {
  const dias = diasNaLixeira(item, agoraMs);
  if (dias === 0) return 'hoje';
  if (dias === 1) return 'ontem';
  if (dias < 30) return `há ${dias} dias`;
  const meses = Math.floor(dias / 30);
  return meses === 1 ? 'há 1 mês' : `há ${meses} meses`;
}
