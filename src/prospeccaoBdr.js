export const RESULTADOS_PROSPECCAO = [
  { id: 'sem_contato', rotulo: 'Não consegui contato' },
  { id: 'contato_incorreto', rotulo: 'Contato incorreto / sem acesso ao decisor' },
  { id: 'decisor_identificado', rotulo: 'Decisor identificado' },
  { id: 'retorno_agendado', rotulo: 'Retorno agendado', exigeProximoPasso: true },
  { id: 'reuniao_agendada', rotulo: 'Reunião agendada', exigeProximoPasso: true },
  { id: 'nutricao', rotulo: 'Seguir em nutrição', exigeProximoPasso: true },
  { id: 'sem_aderencia', rotulo: 'Sem aderência' },
];

export const PASSOS_PREPARACAO = [
  { titulo: 'Saiba quem procura', texto: 'Entre para encontrar ou confirmar o decisor, não para apresentar tudo à recepção.' },
  { titulo: 'Leve um fato', texto: 'Use algo observável da empresa. Elogio genérico não cria relevância.' },
  { titulo: 'Trate dor como hipótese', texto: 'Pergunte se acontece por ali; não afirme que conhece o problema sem ouvir.' },
  { titulo: 'Venda o próximo passo', texto: 'O objetivo é obter orientação, retorno ou reunião — não fechar o serviço na ligação fria.' },
  { titulo: 'Tenha duas saídas', texto: 'Prepare duas opções concretas de horário e também uma forma respeitosa de encerrar.' },
];

export const ETAPAS_LIGACAO = [
  {
    id: 'abertura', titulo: 'Nome, ajuda e dois minutos', tempo: '0–20 s',
    objetivo: 'Reduzir a resistência inicial e deixar claro que a ligação será breve.',
    frase: 'Oi, [nome]. Aqui é [seu nome], do Grupo Portel. Eu precisava de uma orientação e não sei se é com você ou outra pessoa. Você tem dois minutos para me ajudar?',
    intencao: 'A Rugido abre pedindo orientação e um compromisso pequeno de tempo, sem fingir intimidade.',
    perguntas: ['Como você se chama?', 'É você quem acompanha a parte comercial ou outra pessoa?'],
  },
  {
    id: 'rota', titulo: 'Contexto e pessoa certa', tempo: '20–45 s',
    objetivo: 'Explicar o assunto o suficiente para receber orientação ou transferência.',
    frase: 'Vou te dar o contexto e, se não for com você, você me direciona. Estamos conversando com empresas do seu segmento para entender como elas estão gerando e convertendo oportunidades.',
    intencao: 'A recepção não precisa ouvir a oferta completa; precisa entender o assunto e indicar a rota.',
    perguntas: ['Quem responde por crescimento ou processo comercial?', 'Qual é o melhor horário ou canal para falar com essa pessoa?'],
  },
  {
    id: 'relevancia', titulo: 'Fato e hipótese', tempo: '45–90 s',
    objetivo: 'Conectar uma observação real a uma pergunta relevante para aquela empresa.',
    frase: 'Eu observei [fato verificável] e queria entender se [hipótese] também acontece por aí.',
    intencao: 'Nas ligações reais, a conversa avança quando o contexto é específico e a possível dor é apresentada como pergunta.',
    perguntas: ['Isso acontece por aí ou a realidade é diferente?', 'Como vocês lidam com isso hoje?'],
  },
  {
    id: 'qualificacao', titulo: 'Uma ou duas perguntas', tempo: '1min30–3 min',
    objetivo: 'Descobrir apenas o necessário para decidir se existe um próximo passo.',
    frase: 'Só para eu não te chamar para uma conversa que não ajude: hoje, onde esse processo mais trava?',
    intencao: 'O BDR segue a resposta em vez de aplicar um questionário completo de diagnóstico.',
    perguntas: ['Qual exemplo recente mostra isso?', 'Isso hoje é prioridade ou existe algo mais importante na frente?'],
  },
  {
    id: 'proximo_passo', titulo: 'Pedido direto', tempo: '3–5 min',
    objetivo: 'Combinar uma ação concreta quando houver aderência.',
    frase: 'Faz sentido reservarmos 20 minutos para olhar isso com calma? Para você é melhor [opção A] ou [opção B]?',
    intencao: 'A Rugido oferece alternativas concretas de horário e vende a conversa seguinte, não uma proposta prematura.',
    perguntas: ['Quem precisa participar?', 'Qual horário fica realmente viável para você?'],
  },
  {
    id: 'extensao', titulo: 'Aprofundamento com permissão', tempo: 'Acima de 5 min',
    objetivo: 'Aproveitar o engajamento sem transformar silenciosamente dois minutos em uma reunião longa.',
    frase: 'A conversa ficou útil. Você tem mais cinco minutos para eu fazer duas perguntas e confirmar se vale mesmo marcar a reunião?',
    intencao: 'As conversas da Rugido às vezes chegam a 6–12 minutos, mas isso acontece porque o prospect continua engajado.',
    perguntas: ['Há tempo para aprofundar agora?', 'Se não, qual é o próximo horário objetivo?'],
  },
];

export const ROTAS_LIGACAO = [
  {
    id: 'recepcao', titulo: 'Falei com a recepção',
    intencao: 'Conseguir direção, não vender para quem não decide.',
    fala: 'Perfeito. Eu precisava falar dois minutos com quem acompanha o comercial. Você consegue me dizer quem é e quando encontro essa pessoa?',
  },
  {
    id: 'ocupado', titulo: '“Agora estou ocupado”',
    intencao: 'Respeitar a agenda e sair com um compromisso específico.',
    fala: 'Sem problema. Para eu não te interromper de novo no momento errado, é melhor retornar hoje às 16h ou amanhã às 9h?',
  },
  {
    id: 'material', titulo: '“Manda um material”',
    intencao: 'Evitar o envio genérico que encerra a conversa sem retorno.',
    fala: 'Posso mandar. Para eu enviar algo útil: qual ponto você quer avaliar? Depois disso, retomamos em qual dia?',
  },
  {
    id: 'fornecedor', titulo: '“Já tenho fornecedor”',
    intencao: 'Reconhecer o trabalho atual e investigar apenas uma possível lacuna.',
    fala: 'Ótimo, então essa parte já tem responsável. O fornecedor acompanha também [ponto observado] e mede esse resultado com vocês?',
  },
  {
    id: 'sem_interesse', titulo: '“Não tenho interesse”',
    intencao: 'Distinguir falta de prioridade de falta de aderência, sem insistência automática.',
    fala: 'Entendi. É porque esse ponto não é prioridade agora ou porque não acontece por aí? Se não houver aderência, encerramos por aqui.',
  },
  {
    id: 'nao_eu', titulo: '“Não sou eu quem cuida”',
    intencao: 'Transformar o desvio em informação útil para a próxima tentativa.',
    fala: 'Obrigado por me orientar. Quem cuida disso e qual é o melhor horário ou número para falar com essa pessoa?',
  },
];

export function criarPreparacaoProspeccao(lead = {}) {
  const salvo = lead.preparacaoProspeccao || {};
  const base = {
    objetivo: lead.objetivoContato || 'Identificar o decisor e combinar o próximo passo adequado.',
    evidencia: lead.evidencia || lead.oportunidades || lead.obs || '',
    hipotese: lead.hipotese || '',
    contatoEsperado: lead.decisor || '',
    pedidoDesejado: 'Orientação, retorno ou reunião curta com a pessoa certa.',
    pessoaAtendente: '', papelAtendente: '', decisorIdentificado: lead.decisor || '',
    contextoApresentado: '', sinalConfirmado: '', objecao: '', resultado: '',
    proximoPasso: '', responsavel: lead.responsavel || '', dataProximoPasso: '', notas: '',
    etapasConcluidas: {},
  };
  return { ...base, ...salvo, etapasConcluidas: { ...(salvo.etapasConcluidas || {}) } };
}

export function progressoPreparacaoProspeccao(preparacao = {}) {
  const essenciais = ['objetivo', 'evidencia', 'hipotese', 'pedidoDesejado'];
  const preenchidos = essenciais.filter(campo => String(preparacao[campo] || '').trim()).length;
  return Math.round((preenchidos / essenciais.length) * 100);
}

export function validarRegistroProspeccao(preparacao = {}) {
  const faltando = [];
  const resultado = RESULTADOS_PROSPECCAO.find(item => item.id === preparacao.resultado);
  if (!resultado) faltando.push('resultado da ligação');
  if (preparacao.resultado === 'decisor_identificado' && !String(preparacao.decisorIdentificado || '').trim()) {
    faltando.push('decisor identificado');
  }
  if (resultado?.exigeProximoPasso) {
    if (!String(preparacao.proximoPasso || '').trim()) faltando.push('próximo passo');
    if (!String(preparacao.responsavel || '').trim()) faltando.push('responsável');
    if (!String(preparacao.dataProximoPasso || '').trim()) faltando.push('data e hora');
  }
  return faltando;
}

export function montarResumoProspeccao(preparacao = {}) {
  const rotuloResultado = RESULTADOS_PROSPECCAO.find(item => item.id === preparacao.resultado)?.rotulo;
  const linhas = [
    ['Pessoa atendente', preparacao.pessoaAtendente], ['Papel', preparacao.papelAtendente],
    ['Decisor', preparacao.decisorIdentificado], ['Contexto apresentado', preparacao.contextoApresentado],
    ['Sinal confirmado', preparacao.sinalConfirmado], ['Objeção', preparacao.objecao],
    ['Resultado', rotuloResultado], ['Próximo passo', preparacao.proximoPasso],
    ['Responsável', preparacao.responsavel], ['Data', preparacao.dataProximoPasso],
    ['Notas', preparacao.notas],
  ].filter(([, valor]) => String(valor || '').trim());
  return linhas.map(([rotulo, valor]) => `${rotulo}: ${String(valor).trim()}`).join('\n');
}

export function sugestaoManualProspeccao(lead = {}, preparacao = {}) {
  const nome = lead.nome || 'a empresa';
  const evidencia = preparacao.evidencia || lead.evidencia || lead.oportunidades || lead.obs || '';
  return {
    briefing: `${nome}. Entre para confirmar a pessoa certa e conquistar o próximo passo, não para apresentar toda a solução.`,
    evidencia,
    hipotese: preparacao.hipotese || 'Pode existir uma oportunidade comercial, mas ela ainda precisa ser validada na conversa.',
    abertura: `Oi, tudo bem? Aqui é [seu nome], do Grupo Portel. Eu precisava de uma orientação sobre a ${nome} e não sei se é com você ou outra pessoa. Você tem dois minutos para me ajudar?`,
    perguntas: ['É você quem acompanha a parte comercial?', 'Isso acontece por aí ou a realidade é diferente?', 'Hoje esse ponto é prioridade?'],
    desvios: ['Se for recepção, peça a rota do decisor', 'Se estiver ocupado, combine horário específico', 'Se não houver aderência, encerre sem pressionar'],
    proximoPasso: 'Oferecer duas opções concretas de horário ou registrar a rota correta para o decisor.',
    confianca: evidencia ? 'media' : 'baixa',
  };
}
