// Espelho dos nichos para a tela de busca.
//
// Duplica o mínimo de scripts/_nichos.mjs de propósito: aquele arquivo importa
// coisas de Node e roda no preparo, fora do navegador. Aqui fica só o que a
// tela precisa — id, nome e o aviso — e um teste guarda os dois lados para não
// divergirem em silêncio.

export const NICHOS_UI = [
  { id: 'seguranca-eletronica', nome: 'Segurança eletrônica e automação' },
  { id: 'climatizacao', nome: 'Climatização e refrigeração' },
  { id: 'tecnologia-b2b', nome: 'Serviços de tecnologia B2B' },
  { id: 'software-automacao', nome: 'Software houses e empresas de automação' },
  {
    id: 'energia-solar',
    nome: 'Energia solar',
    aviso: 'A Receita não tem CNAE de energia solar. Quem instala painel se '
      + 'registra como instalação elétrica, que traz todo eletricista junto. '
      + 'Espere descartar mais nomes aqui do que nos outros nichos.',
  },
  { id: 'moveis-planejados', nome: 'Móveis planejados e projetos personalizados' },
];

export const UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT',
  'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
];

/** Nome do arquivo gerado pelo preparo, para a tela abrir o certo. */
export const nomeDaFatia = (nichoId, uf) => `${nichoId}__${String(uf).toUpperCase()}.csv`;
