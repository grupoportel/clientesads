// Referências: playbook V02, tabelas 19–29; Rugido Prospecção 3, 14:41–21:29.
export const CENARIOS = [
  ['recepcao', 'Recepção'], ['decisor', 'Decisor disponível'], ['ocupado', 'Decisor ocupado'],
  ['matriz', 'Matriz / sem autonomia'], ['hipotese_negada', 'Hipótese não confirmada'],
];

export const OBJECOES = [
  { id: 'interesse', titulo: 'Não tenho interesse', pergunta: 'É o tema que não faz sentido ou o momento?', seguir: 'Se houver uma janela real, combine um retorno específico.', parar: 'Se mantiver a recusa, agradeça e encerre.' },
  { id: 'fornecedor', titulo: 'Já tenho fornecedor', pergunta: 'O ponto que conversamos já está coberto pelo processo atual?', seguir: 'Investigue somente uma lacuna reconhecida pela pessoa.', parar: 'Se estiver coberto ou não quiser avaliar, encerre.' },
  { id: 'material', titulo: 'Mande material', pergunta: 'Qual tema ajudaria você a avaliar? Posso retomar em uma data combinada?', seguir: 'Envie apenas o material pertinente pelo canal combinado.', parar: 'Sem autorização de retorno, não transforme o pedido em oportunidade ativa.' },
  { id: 'preco', titulo: 'Qual é o preço?', pergunta: 'Você busca resolver um ponto específico ou organizar o processo comercial?', seguir: 'Explique a rota adequada e use apenas preços vigentes aprovados para aquele escopo.', parar: 'Se não houver escopo suficiente, não invente orçamento nem prometa diagnóstico completo gratuito.' },
  { id: 'socio', titulo: 'Preciso falar com meu sócio', pergunta: 'O que ele precisa entender? Faz sentido participarem juntos?', seguir: 'Identifique as pessoas necessárias antes do convite.', parar: 'Sem acesso ou interesse, registre a pendência e não marque como confirmada.' },
  { id: 'orcamento', titulo: 'Sem orçamento / prioridade', pergunta: 'Existe uma janela futura para avaliar ou o tema não é relevante agora?', seguir: 'Registre somente uma retomada autorizada e plausível.', parar: 'Sem horizonte, encerre a oportunidade atual.' },
  { id: 'origem', titulo: 'Como conseguiu meu contato?', pergunta: 'Informe a fonte real registrada no cadastro. Deseja que encerremos os contatos?', seguir: 'Explique de forma transparente o motivo específico da ligação.', parar: 'Se pedir interrupção, registre “Pediu para não receber contatos”.' },
  { id: 'optout', titulo: 'Não me contate novamente', pergunta: 'Entendido. Vou registrar para encerrarmos os contatos. Obrigado pela clareza.', seguir: 'Vá a Registrar e selecione o pedido de não contato.', parar: 'Encerre imediatamente, sem pergunta adicional ou reenquadramento.' },
];

export function orientarLigacao(cenario, lead = {}, preparo = {}) {
  const fato = String(preparo.evidencia || '').trim().replace(/[.!?]+$/, '');
  const contexto = fato ? `Observei: ${fato}. Queria confirmar como vocês lidam com esse ponto.` : 'Ainda não há evidência registrada. Peça orientação sobre o processo, sem afirmar um problema.';
  const pergunta = preparo.perguntaPrincipal || 'Como vocês acompanham isso hoje? O processo atende bem ou existe alguma dificuldade?';
  const comum = { contexto, pergunta, saida: 'Faça a pergunta e aguarde. A resposta pode corrigir sua hipótese.' };
  const porCenario = {
    recepcao: { fala: `Olá, aqui é [seu nome], do Grupo Portel. Quem acompanha esse processo na ${lead.nome || 'empresa'}?`, pergunta: 'Esse tema é decidido na unidade ou na matriz? Qual nome, função e melhor horário da pessoa responsável?', saida: 'Se houver transferência, apresente-se novamente. Se conseguir nome e horário, registre o retorno.' },
    decisor: { fala: `Olá, ${preparo.contatoEsperado || '[nome]'}. Aqui é [seu nome], do Grupo Portel. Você tem dois minutos?`, saida: 'Só avance se houver relevância reconhecida e participantes adequados. Para aprofundar além de cinco minutos, peça permissão.' },
    ocupado: { fala: 'Entendo. Qual dia e horário seriam melhores para eu retornar brevemente?', pergunta: 'Posso confirmar o canal e o motivo desse retorno?', saida: 'Ofereça duas opções somente após conferir sua agenda. Se não aceitar retorno, encerre.' },
    matriz: { fala: 'Obrigado por explicar. Quem na matriz acompanha esse assunto e qual é o canal institucional adequado?', pergunta: 'Existe alguma decisão que a unidade possa tomar ou tudo depende da matriz?', saida: 'Obtenha a rota corporativa. Evite aprofundar um diagnóstico com quem não possui autonomia.' },
    hipotese_negada: { fala: 'Obrigado por corrigir minha leitura. Vou registrar que esse ponto já funciona bem.', pergunta: 'Se a pessoa espontaneamente mencionar outro tema, confirme se vale conversar sobre ele.', saida: 'Sem necessidade reconhecida, encerre educadamente. Não procure uma dor a qualquer custo.' },
  };
  return { ...comum, ...(porCenario[cenario] || porCenario.recepcao) };
}
