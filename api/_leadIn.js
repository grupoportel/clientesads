// Extração de campos de payloads externos. Pura, sem Firebase, para poder ser
// testada com os formatos reais que Meta Ads, Google Ads e formulários mandam.

// Nomes que cada plataforma usa para a mesma coisa. A lista existe porque o
// Meta manda "full_name", o Google manda "FULL_NAME" e o site manda "nome".
export const APELIDOS = {
  nome:      ['nome', 'name', 'full_name', 'fullname', 'nome_completo', 'empresa', 'company', 'company_name', 'razao_social'],
  email:     ['email', 'e-mail', 'email_address', 'mail'],
  telefone:  ['telefone', 'phone', 'phone_number', 'tel', 'fone'],
  whatsapp:  ['whatsapp', 'celular', 'mobile', 'mobile_number', 'zap'],
  cidade:    ['cidade', 'city'],
  estado:    ['estado', 'state', 'uf'],
  nicho:     ['nicho', 'segmento', 'industry', 'categoria'],
  decisor:   ['decisor', 'contato', 'contact_name', 'responsavel_empresa'],
  site:      ['site', 'website', 'url'],
  instagram: ['instagram', 'ig'],
  obs:       ['mensagem', 'message', 'observacao', 'observacoes', 'comentario', 'comments', 'duvida'],
};

export const normalizarChave = (chave) =>
  String(chave || '').toLowerCase().replace(/[\s_-]/g, '');

/** Achata { a: { b: 1 } } em { a_b: 1 }, porque webhooks aninham bastante. */
export function achatar(obj, prefixo = '', saida = {}) {
  Object.entries(obj || {}).forEach(([chave, valor]) => {
    const nova = prefixo ? `${prefixo}_${chave}` : chave;
    if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
      achatar(valor, nova, saida);
    } else {
      saida[nova] = valor;
    }
  });
  return saida;
}

/**
 * O Meta manda os campos como [{ name, values: [...] }].
 * Sem este passo, o lead chegaria com o nome no lugar errado.
 */
export function normalizarMeta(corpo) {
  const dados = corpo?.field_data || corpo?.entry?.[0]?.changes?.[0]?.value?.field_data;
  if (!Array.isArray(dados)) return null;
  const plano = {};
  dados.forEach(campo => {
    if (campo?.name) plano[campo.name] = Array.isArray(campo.values) ? campo.values[0] : campo.values;
  });
  return plano;
}

const preenchido = (v) => v !== undefined && v !== null && String(v).trim() !== '';

/**
 * Encontra os campos do CRM dentro de um payload já achatado.
 *
 * Duas passadas de propósito. A primeira casa a chave inteira; só depois tenta
 * os sufixos, para um formulário que manda { contato: { nome } } — achatado em
 * "contato_nome" — não perder o nome. A ordem importa: se o payload tiver
 * "nome" E "decisor_nome", o exato ganha, senão o nome do decisor acabaria
 * virando o nome da empresa.
 */
export function extrairCampos(plano) {
  const porChave = {};
  const porSufixo = {};

  Object.entries(plano || {}).forEach(([chave, valor]) => {
    if (!preenchido(valor)) return;
    porChave[normalizarChave(chave)] = valor;

    // "form_email_address" gera "emailaddress" e "address"
    const partes = String(chave).split(/[._-]/).filter(Boolean);
    for (let i = 1; i < partes.length; i++) {
      const sufixo = normalizarChave(partes.slice(i).join(''));
      if (sufixo && porSufixo[sufixo] === undefined) porSufixo[sufixo] = valor;
    }
  });

  const achar = (apelidos) => {
    for (const apelido of apelidos) {
      const valor = porChave[normalizarChave(apelido)];
      if (preenchido(valor)) return String(valor).trim();
    }
    for (const apelido of apelidos) {
      const valor = porSufixo[normalizarChave(apelido)];
      if (preenchido(valor)) return String(valor).trim();
    }
    return '';
  };

  const extraido = {};
  Object.entries(APELIDOS).forEach(([campo, apelidos]) => {
    const valor = achar(apelidos);
    if (valor) extraido[campo] = valor;
  });
  return extraido;
}

/** Guarda os UTMs para o relatório de origem saber de onde o lead veio. */
export function extrairUtm(plano) {
  const utm = {};
  Object.entries(plano || {}).forEach(([chave, valor]) => {
    const c = normalizarChave(chave);
    if (c.startsWith('utm') && valor) utm[c] = String(valor);
  });
  return Object.keys(utm).length ? utm : null;
}

export const somenteDigitos = (t) => String(t || '').replace(/\D/g, '');

/**
 * Procura um lead já existente pelo e-mail ou pelo telefone.
 * A mesma pessoa preenchendo o formulário duas vezes não deve virar dois leads.
 */
export function acharDuplicado(existentes, campos) {
  const emailNovo = (campos.email || '').toLowerCase();
  const telNovo = somenteDigitos(campos.telefone || campos.whatsapp);

  return Object.entries(existentes || {}).find(([, l]) => {
    if (emailNovo && (l.email || '').toLowerCase() === emailNovo) return true;
    // Menos de 10 dígitos não identifica ninguém com segurança
    if (telNovo && telNovo.length >= 10) {
      if (somenteDigitos(l.telefone) === telNovo) return true;
      if (somenteDigitos(l.whatsapp) === telNovo) return true;
    }
    return false;
  }) || null;
}

/** Campos que faltam no lead existente e que o novo payload pode completar. */
export function camposParaCompletar(leadExistente, campos) {
  const completar = {};
  Object.entries(campos).forEach(([campo, valor]) => {
    if (!leadExistente[campo]) completar[campo] = valor;
  });
  return completar;
}
