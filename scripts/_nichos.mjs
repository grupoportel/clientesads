// Nichos de prospecção, traduzidos para códigos CNAE.
//
// Os códigos foram conferidos contra a tabela oficial da Receita, não escritos
// de memória. Cada um traz o nome oficial ao lado justamente para isso poder
// ser auditado sem abrir o arquivo de 88 KB da Receita.
//
// `certeiro: false` marca o código que traz gente demais junto — instalação
// elétrica pega todo eletricista, não só instalador de solar. Ele fica separado
// para a tela poder avisar, em vez de a pessoa achar que a lista veio limpa.

export const NICHOS = [
  {
    id: 'seguranca-eletronica',
    nome: 'Segurança eletrônica e automação',
    cnaes: [
      { codigo: '8020000', nome: 'Atividades de monitoramento de sistemas de segurança', certeiro: true },
      { codigo: '8020001', nome: 'Monitoramento de sistemas de segurança eletrônico', certeiro: true },
      { codigo: '8020002', nome: 'Outras atividades de serviços de segurança', certeiro: true },
      { codigo: '2790202', nome: 'Fabricação de equipamentos para sinalização e alarme', certeiro: true },
      { codigo: '4322303', nome: 'Instalações de sistema de prevenção contra incêndio', certeiro: true },
    ],
    // Vigilância privada (8011101) fica de fora: é segurança com gente, não
    // eletrônica. Entra em "relacionados" para quem quiser incluir.
    relacionados: [
      { codigo: '8011101', nome: 'Vigilância e segurança privada (segurança com pessoas)' },
    ],
  },
  {
    id: 'climatizacao',
    nome: 'Climatização e refrigeração',
    cnaes: [
      { codigo: '4322302', nome: 'Instalação e manutenção de ar condicionado, ventilação e refrigeração', certeiro: true },
      { codigo: '3314707', nome: 'Manutenção de máquinas de refrigeração e ventilação industrial', certeiro: true },
      { codigo: '2823200', nome: 'Fabricação de máquinas de refrigeração e ventilação industrial', certeiro: true },
      { codigo: '2824101', nome: 'Fabricação de ar condicionado industrial', certeiro: true },
      { codigo: '2824102', nome: 'Fabricação de ar condicionado não-industrial', certeiro: true },
    ],
    relacionados: [
      { codigo: '4753900', nome: 'Varejo de eletrodomésticos (vende ar condicionado entre outras coisas)' },
    ],
  },
  {
    id: 'tecnologia-b2b',
    nome: 'Serviços de tecnologia B2B',
    cnaes: [
      { codigo: '6204000', nome: 'Consultoria em tecnologia da informação', certeiro: true },
      { codigo: '6209100', nome: 'Suporte técnico e manutenção em TI', certeiro: true },
      { codigo: '6311900', nome: 'Tratamento de dados, hospedagem e serviços de aplicação', certeiro: true },
      { codigo: '6319400', nome: 'Portais, provedores de conteúdo e serviços de informação', certeiro: true },
    ],
    relacionados: [],
  },
  {
    id: 'software-automacao',
    nome: 'Software houses e empresas de automação',
    cnaes: [
      { codigo: '6201500', nome: 'Desenvolvimento de programas sob encomenda', certeiro: true },
      { codigo: '6201501', nome: 'Desenvolvimento de programas sob encomenda', certeiro: true },
      { codigo: '6202300', nome: 'Desenvolvimento e licenciamento de programas customizáveis', certeiro: true },
      { codigo: '6203100', nome: 'Desenvolvimento e licenciamento de programas não-customizáveis', certeiro: true },
      { codigo: '3321000', nome: 'Instalação de máquinas e equipamentos industriais (automação)', certeiro: true },
    ],
    relacionados: [],
  },
  {
    id: 'energia-solar',
    nome: 'Energia solar',
    // A Receita não tem CNAE de energia solar. Quem instala painel se registra
    // em "instalação elétrica", junto de todo eletricista do país — então este
    // é o único nicho da lista que vem sujo por natureza, não por descuido.
    cnaes: [
      { codigo: '3511501', nome: 'Geração de energia elétrica', certeiro: true },
      { codigo: '3511500', nome: 'Geração de energia elétrica', certeiro: true },
      { codigo: '4321500', nome: 'Instalação e manutenção elétrica', certeiro: false },
    ],
    relacionados: [],
    aviso: 'Não existe CNAE de energia solar. Quem instala painel costuma se '
      + 'registrar como instalação elétrica, que traz todo eletricista junto. '
      + 'Espere revisar mais nomes aqui do que nos outros nichos.',
  },
  {
    id: 'moveis-planejados',
    nome: 'Móveis planejados e projetos personalizados',
    cnaes: [
      { codigo: '4330402', nome: 'Instalação de portas, janelas, divisórias e armários embutidos', certeiro: true },
      { codigo: '3101200', nome: 'Fabricação de móveis com predominância de madeira', certeiro: true },
      { codigo: '3102100', nome: 'Fabricação de móveis com predominância de metal', certeiro: true },
      { codigo: '3103900', nome: 'Fabricação de móveis de outros materiais', certeiro: true },
      { codigo: '3329501', nome: 'Serviços de montagem de móveis', certeiro: true },
    ],
    relacionados: [
      { codigo: '4754701', nome: 'Varejo de móveis (loja pronta, nem sempre planejado)' },
    ],
  },
];

export const acharNicho = (id) => NICHOS.find(n => n.id === id) || null;

/** Códigos que vão para o filtro. `incluirRelacionados` alarga a rede. */
export function codigosDoNicho(id, { incluirRelacionados = false, incluirAmplos = true } = {}) {
  const nicho = acharNicho(id);
  if (!nicho) return [];

  const principais = nicho.cnaes
    .filter(c => incluirAmplos || c.certeiro)
    .map(c => c.codigo);

  return incluirRelacionados
    ? [...principais, ...nicho.relacionados.map(c => c.codigo)]
    : principais;
}

/** Junta os códigos de vários nichos sem repetir. */
export function codigosDeVarios(ids = [], opcoes = {}) {
  return [...new Set(ids.flatMap(id => codigosDoNicho(id, opcoes)))];
}

/**
 * Confere os códigos contra a tabela oficial baixada.
 *
 * A Receita mexe na tabela de CNAE de tempos em tempos. Um código aposentado
 * não dá erro — devolve zero empresas, e a pessoa conclui que o nicho não
 * existe na cidade dela. Melhor gritar na hora da conferência.
 */
export function conferirCodigos(tabelaOficial = {}) {
  const problemas = [];
  NICHOS.forEach(nicho => {
    [...nicho.cnaes, ...nicho.relacionados].forEach(({ codigo, nome }) => {
      const oficial = tabelaOficial[codigo];
      if (!oficial) {
        problemas.push({ nicho: nicho.nome, codigo, tipo: 'sumiu', nossoNome: nome });
      }
    });
  });
  return problemas;
}
