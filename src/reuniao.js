export const CAMPOS_PREPARACAO = [
  'objetivo', 'evidencia', 'hipotese', 'participantes', 'decisaoDesejada',
  'situacao', 'problema', 'impacto', 'eventoCritico', 'decisao',
  'criteriosSolucao', 'proximoPasso', 'notas',
];

export const ESTRUTURA_LIGACAO = [
  { titulo: 'Chame pelo nome', texto: 'Ganhe atenção sem saudação longa ou intimidade inventada.' },
  { titulo: 'Identifique-se', texto: 'Diga seu nome e Grupo Portel com transparência.' },
  { titulo: 'Diga o motivo', texto: 'Explique em uma frase por que ligou e qual avanço está buscando.' },
  { titulo: 'Faça a ponte', texto: 'Conecte um fato observável a uma hipótese relevante para aquela empresa.' },
  { titulo: 'Peça e escute', texto: 'Faça um pedido claro — orientação, decisor, retorno ou reunião — e dê espaço para a resposta.' },
];

export const PRINCIPIOS_CONVERSAO = [
  { fonte: 'Cialdini', titulo: 'Reciprocidade', usar: 'Ofereça primeiro uma observação ou pergunta realmente útil.', evitar: 'Brinde ou “favor” usado para criar dívida psicológica.' },
  { fonte: 'Cialdini', titulo: 'Autoridade', usar: 'Demonstre preparo, método e domínio do contexto com fatos verificáveis.', evitar: 'Inventar números, clientes, cases ou certeza sobre o negócio.' },
  { fonte: 'Cialdini', titulo: 'Prova social', usar: 'Só cite padrão de empresas semelhantes quando houver evidência real e relevante.', evitar: '“Todo mundo faz” ou caso sem relação com o prospect.' },
  { fonte: 'Cialdini', titulo: 'Coerência', usar: 'Conecte o próximo passo ao que a própria pessoa declarou como prioridade.', evitar: 'Prender a pessoa a uma fala antiga depois que o contexto mudou.' },
  { fonte: 'Schafer / FBI', titulo: 'Sinais de confiança', usar: 'Tom calmo, curiosidade genuína, escuta, validação e espaço reduzem ameaça.', evitar: 'Espelhamento teatral, falsa amizade ou pergunta íntima sem contexto.' },
  { fonte: 'Jeb Blount', titulo: 'Clareza e assertividade', usar: 'Seja direto, dê um porquê relevante, faça o pedido e pare de falar.', evitar: 'Acelerar, atropelar o não ou transformar confiança em agressividade.' },
  { fonte: 'Jeb Blount', titulo: 'Microcompromisso', usar: 'Combine uma ação pequena, específica e colocada na agenda dos dois lados.', evitar: 'Próximo passo vago ou enviar proposta sem descoberta suficiente.' },
  { fonte: 'Cialdini', titulo: 'Escassez verdadeira', usar: 'Informe limite de agenda ou prazo somente quando ele realmente existir.', evitar: 'Urgência falsa, contagem regressiva inventada ou medo.' },
];

export const ETAPAS_REUNIAO = [
  {
    id: 'abertura', titulo: 'Abertura e acordo', tempo: '0–3 min',
    objetivo: 'Dar segurança sobre o motivo, o tempo e a saída da conversa.',
    frase: 'Obrigado pelo tempo. Em 30 minutos, quero entender como isso funciona hoje, validar se há um problema prioritário e, se fizer sentido, combinar o próximo passo. Tudo bem para você?',
    perguntas: ['Além de você, alguém deveria participar desta conversa?', 'Existe algo que precisa obrigatoriamente sair decidido hoje?'],
  },
  {
    id: 'situacao', titulo: 'Situação atual', tempo: '3–10 min',
    objetivo: 'Montar um raio-x neutro do processo, sem empurrar um problema.',
    frase: 'Antes de falar de solução, quero entender como vocês fazem isso hoje.',
    perguntas: ['Como uma oportunidade chega e quem assume o primeiro contato?', 'O que acontece do contato inicial até a venda?', 'Onde vocês registram o próximo passo?'],
  },
  {
    id: 'problema', titulo: 'Problema e evidência', tempo: '10–16 min',
    objetivo: 'Separar sintomas da causa e pedir um exemplo real.',
    frase: 'Em qual parte desse processo vocês sentem mais atrito hoje?',
    perguntas: ['Qual exemplo recente mostra isso?', 'O que já tentaram fazer?', 'Que número, registro ou comportamento confirma essa percepção?'],
  },
  {
    id: 'impacto', titulo: 'Impacto', tempo: '16–20 min',
    objetivo: 'Entender a consequência em receita, tempo, capacidade ou risco.',
    frase: 'Quando isso acontece, o que muda na operação ou no resultado?',
    perguntas: ['Quanto tempo da equipe isso consome?', 'Que oportunidade fica para trás?', 'Quem mais é afetado?'],
  },
  {
    id: 'eventoCritico', titulo: 'Prioridade e por que agora', tempo: '20–23 min',
    objetivo: 'Deixar o cliente verbalizar urgência real, sem criar pressão artificial.',
    frase: 'O que aconteceu para isso virar assunto agora?',
    perguntas: ['O que ocorre se continuar igual pelos próximos 90 dias?', 'Que outra prioridade compete com esta?', 'Existe alguma data ou evento que muda a decisão?'],
  },
  {
    id: 'decisao', titulo: 'Decisão e capacidade', tempo: '23–26 min',
    objetivo: 'Descobrir critérios, participantes, restrições e capacidade de execução.',
    frase: 'Como vocês costumam decidir projetos assim?',
    perguntas: ['Quem além de você influencia ou aprova?', 'O que uma solução precisa entregar para ser aceita?', 'Que equipe, dados e ferramentas estão disponíveis?'],
  },
  {
    id: 'fechamento', titulo: 'Resumo e próximo passo', tempo: '26–30 min',
    objetivo: 'Confirmar o entendimento e assumir um compromisso específico — inclusive encerrar.',
    frase: 'Deixe-me resumir o que entendi para você corrigir o que estiver errado.',
    perguntas: ['Esse resumo representa bem a situação?', 'Qual é o próximo passo, de quem é a responsabilidade e para quando?', 'Se não houver aderência: faz sentido encerrarmos por aqui?'],
  },
];

export const OBJECOES_REUNIAO = [
  { id: 'preco', titulo: '“Está caro”', acolher: 'Entendo; investimento precisa caber na prioridade real.', reenquadrar: 'Antes de falar em desconto, vamos conferir problema, impacto, escopo e condição.', encaminhar: 'O que precisaria estar claro para você avaliar esse investimento com segurança?' },
  { id: 'tempo', titulo: '“Não tenho tempo”', acolher: 'Faz sentido proteger a agenda e a capacidade da equipe.', reenquadrar: 'Isso pode indicar baixa prioridade ou que a execução precisa ser redesenhada.', encaminhar: 'O impeditivo é começar agora ou é o formato de execução?' },
  { id: 'socio', titulo: '“Preciso falar com meu sócio”', acolher: 'Claro; a decisão não precisa ser tomada sem quem participa dela.', reenquadrar: 'Para evitar uma passagem de recado incompleta, vale entender os critérios dele.', encaminhar: 'Podemos marcar uma conversa curta com todos e levar este resumo?' },
  { id: 'fornecedor', titulo: '“Já tenho fornecedor”', acolher: 'Ótimo, então já existe alguém cuidando de parte do processo.', reenquadrar: 'A questão é saber se o gargalo levantado já está coberto, sem atacar o trabalho atual.', encaminhar: 'O fornecedor responde também por este ponto e por este indicador?' },
  { id: 'material', titulo: '“Manda um material”', acolher: 'Posso enviar algo que ajude de verdade.', reenquadrar: 'Material genérico raramente resolve; preciso ligar o conteúdo à dúvida certa.', encaminhar: 'Qual ponto você quer avaliar e em que data retomamos depois da leitura?' },
  { id: 'garantia', titulo: '“Você garante resultado?”', acolher: 'É correto querer clareza sobre risco e retorno.', reenquadrar: 'Podemos garantir escopo, processo, medição e critérios de aceite — não um resultado financeiro que depende de fatores fora do nosso controle.', encaminhar: 'Quer que eu detalhe o que fica sob nossa responsabilidade e como será medido?' },
];

export function criarPreparacaoInicial(lead = {}) {
  const salvo = lead.preparacaoReuniao || {};
  const base = {
    objetivo: 'Entender o processo atual, validar a prioridade e definir o próximo passo adequado.',
    evidencia: lead.oportunidades || lead.obs || '',
    hipotese: '', participantes: lead.decisor || '', decisaoDesejada: '',
    situacao: '', problema: '', impacto: '', eventoCritico: '', decisao: '',
    criteriosSolucao: '', proximoPasso: '', notas: '', etapasConcluidas: {},
  };
  return { ...base, ...salvo, etapasConcluidas: { ...(salvo.etapasConcluidas || {}) } };
}

export function progressoPreparacao(preparacao = {}) {
  const essenciais = ['objetivo', 'evidencia', 'hipotese', 'participantes'];
  const preenchidos = essenciais.filter(c => String(preparacao[c] || '').trim()).length;
  return Math.round((preenchidos / essenciais.length) * 100);
}

export function validarRegistroReuniao(preparacao = {}) {
  const faltando = [];
  if (!String(preparacao.situacao || '').trim()) faltando.push('situação atual');
  if (!String(preparacao.problema || '').trim()) faltando.push('problema ou ausência dele');
  if (!String(preparacao.proximoPasso || '').trim()) faltando.push('próximo passo');
  return faltando;
}

export function montarResumoCrm(preparacao = {}) {
  const linhas = [
    ['Situação', preparacao.situacao], ['Problema', preparacao.problema],
    ['Impacto', preparacao.impacto], ['Por que agora', preparacao.eventoCritico],
    ['Decisão', preparacao.decisao], ['Critérios', preparacao.criteriosSolucao],
    ['Próximo passo', preparacao.proximoPasso],
  ].filter(([, valor]) => String(valor || '').trim());
  return linhas.map(([rotulo, valor]) => `${rotulo}: ${String(valor).trim()}`).join('\n');
}

export function sugestaoManual(lead = {}, preparacao = {}) {
  const nome = lead.nome || 'a empresa';
  const nicho = lead.nicho ? ` no segmento de ${lead.nicho}` : '';
  const evidencia = preparacao.evidencia || lead.oportunidades || lead.obs || 'ainda precisa ser confirmada';
  return {
    briefing: `${nome}${nicho}. A conversa deve validar o contexto antes de recomendar qualquer solução.`,
    abertura: `Obrigado pelo tempo. Quero entender como esse processo funciona hoje na ${nome}, validar se existe uma prioridade real e combinar o próximo passo adequado.`,
    evidencia,
    hipotese: preparacao.hipotese || `Pode existir um gargalo comercial ou de presença digital, mas isso ainda é uma hipótese.`,
    perguntas: [
      'Como esse processo funciona hoje, do início ao fim?',
      'Onde ele costuma parar e qual exemplo recente mostra isso?',
      'O que acontece se nada mudar nos próximos 90 dias?',
      'Quem participa da decisão e o que uma solução precisa entregar?',
    ],
    riscos: ['Tratar hipótese como fato', 'Apresentar solução antes de entender impacto e decisão', 'Sair sem responsável e data'],
    proximoPasso: 'Resumir o entendimento, pedir correções e combinar responsável, ação e data.',
    confianca: 'base',
  };
}
