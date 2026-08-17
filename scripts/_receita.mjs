// Leitura dos dados abertos da Receita Federal. Parte pura, sem disco e sem
// rede, para poder ser testada — é aqui que mora quase todo o erro possível.
//
// O arquivo da Receita tem três armadilhas que não dão erro, só resultado
// errado: vem em Latin-1 e não UTF-8, é separado por ponto e vírgula com todo
// campo entre aspas, e o município é um código próprio da Receita que não é o
// do IBGE. Errar qualquer uma devolve uma lista silenciosamente vazia.

/** Posições no arquivo de Estabelecimentos (layout oficial, 30 colunas). */
export const COL = {
  cnpjBasico: 0, cnpjOrdem: 1, cnpjDv: 2, matrizFilial: 3, nomeFantasia: 4,
  situacao: 5, dataSituacao: 6, motivoSituacao: 7,
  dataInicio: 10, cnaePrincipal: 11, cnaeSecundaria: 12,
  tipoLogradouro: 13, logradouro: 14, numero: 15, complemento: 16,
  bairro: 17, cep: 18, uf: 19, municipio: 20,
  ddd1: 21, telefone1: 22, ddd2: 23, telefone2: 24,
  email: 27,
};

/** 02 = Ativa. As outras são baixada, suspensa, inapta e nula. */
export const SITUACAO_ATIVA = '02';

/**
 * Divide uma linha do arquivo da Receita.
 *
 * Escrito à mão porque o formato é fixo e conhecido: ponto e vírgula fora de
 * aspas separa, aspas duplas envolvem, e "" escapa aspas. Uma biblioteca de
 * CSV genérica traria mais casos do que o arquivo tem.
 */
export function dividirLinha(linha = '') {
  const campos = [];
  let atual = '';
  let dentroDeAspas = false;

  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      if (dentroDeAspas && linha[i + 1] === '"') { atual += '"'; i++; }
      else dentroDeAspas = !dentroDeAspas;
    } else if (c === ';' && !dentroDeAspas) {
      campos.push(atual); atual = '';
    } else {
      atual += c;
    }
  }
  campos.push(atual);
  return campos.map(c => c.trim());
}

/** CNPJ completo a partir das três partes, já formatado. */
export function montarCnpj(basico = '', ordem = '', dv = '') {
  const b = String(basico).padStart(8, '0');
  const o = String(ordem).padStart(4, '0');
  const d = String(dv).padStart(2, '0');
  if (b.length !== 8 || o.length !== 4 || d.length !== 2) return '';
  return `${b.slice(0, 2)}.${b.slice(2, 5)}.${b.slice(5, 8)}/${o}-${d}`;
}

/** Telefone a partir de DDD e número separados, como a Receita guarda. */
export function montarTelefone(ddd = '', numero = '') {
  const d = String(ddd).replace(/\D/g, '');
  const n = String(numero).replace(/\D/g, '');
  if (!d || n.length < 8) return '';
  return `(${d}) ${n.length === 9 ? `${n.slice(0, 5)}-${n.slice(5)}` : `${n.slice(0, 4)}-${n.slice(4)}`}`;
}

/** Endereço legível a partir das cinco colunas separadas. */
export function montarEndereco(campos = []) {
  return [
    [campos[COL.tipoLogradouro], campos[COL.logradouro]].filter(Boolean).join(' '),
    campos[COL.numero],
    campos[COL.bairro],
  ].map(p => String(p || '').trim()).filter(Boolean).join(', ');
}

/**
 * Decide se a linha entra na lista.
 *
 * `cnaes` aceita prefixo: "5620" pega todo o grupo de fornecimento de comida,
 * "5611201" pega só restaurantes. Assim dá para começar largo e apertar depois
 * sem precisar listar dezenas de códigos.
 */
export function linhaInteressa(campos, filtro = {}) {
  const { cnaes = [], municipios = [], uf = null, somenteAtivas = true } = filtro;

  if (somenteAtivas && campos[COL.situacao] !== SITUACAO_ATIVA) return false;
  if (uf && String(campos[COL.uf] || '').toUpperCase() !== String(uf).toUpperCase()) return false;
  if (municipios.length && !municipios.includes(String(campos[COL.municipio]))) return false;

  if (cnaes.length) {
    const cnae = String(campos[COL.cnaePrincipal] || '').padStart(7, '0');
    if (!cnaes.some(prefixo => cnae.startsWith(String(prefixo)))) return false;
  }
  return true;
}

/**
 * Converte a linha no formato que o importador do CRM entende.
 *
 * Sem nome fantasia o lead ficaria anônimo na lista, então quem não tem cai
 * para a razão social — que vem do arquivo de Empresas, quando disponível.
 */
export function linhaParaLead(campos, { nomesPorCnpjBasico = {}, nomesDeCidade = {}, nomesDeCnae = {} } = {}) {
  const basico = campos[COL.cnpjBasico];
  const nome = campos[COL.nomeFantasia] || nomesPorCnpjBasico[basico] || '';

  return {
    nome,
    cnpj: montarCnpj(basico, campos[COL.cnpjOrdem], campos[COL.cnpjDv]),
    telefone: montarTelefone(campos[COL.ddd1], campos[COL.telefone1]),
    whatsapp: montarTelefone(campos[COL.ddd2], campos[COL.telefone2]),
    email: String(campos[COL.email] || '').toLowerCase(),
    cidade: nomesDeCidade[String(campos[COL.municipio])] || '',
    estado: campos[COL.uf] || '',
    nicho: nomesDeCnae[String(campos[COL.cnaePrincipal] || '').padStart(7, '0')] || '',
    endereco: montarEndereco(campos),
    abertaEm: formatarData(campos[COL.dataInicio]),
  };
}

/** A Receita grava data como AAAAMMDD, sem separador. */
export function formatarData(bruto = '') {
  const d = String(bruto || '').trim();
  if (!/^\d{8}$/.test(d) || d === '00000000') return '';
  return `${d.slice(6, 8)}/${d.slice(4, 6)}/${d.slice(0, 4)}`;
}

/** Cabeçalho e linhas do CSV que o importador do CRM vai ler. */
export const COLUNAS_SAIDA = [
  'Nome', 'CNPJ', 'Telefone', 'WhatsApp', 'E-mail',
  'Cidade', 'Estado', 'Nicho', 'Endereço', 'Aberta em',
];

export function leadParaCsv(lead) {
  const escapar = (v) => {
    const texto = String(v ?? '');
    return /[;"\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  };
  return [
    lead.nome, lead.cnpj, lead.telefone, lead.whatsapp, lead.email,
    lead.cidade, lead.estado, lead.nicho, lead.endereco, lead.abertaEm,
  ].map(escapar).join(';');
}

/**
 * Acha a pasta mais recente numa listagem de diretório.
 *
 * O padrão precisa casar com link de pasta, não com qualquer data na página.
 * A listagem traz também a data de modificação de cada arquivo, e pegá-la
 * fazia o script montar a URL de uma pasta que não existe — anunciava a versão
 * "2026-07-20", que era só quando o arquivo foi mexido, e o download morria
 * com 404.
 */
export function ultimaPasta(html = '', padrao) {
  const achados = [...String(html).matchAll(padrao)].map(m => m[1]);
  return [...new Set(achados)].sort().pop() || null;
}
