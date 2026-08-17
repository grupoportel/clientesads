// Revisão antes de importar. Pura, sem Firebase, para poder ser testada.
//
// A importação de CSV entrava direto: escolher o arquivo, mapear as colunas e
// gravar. Com prospecção isso vira problema sério — buscar "pizzarias em Sinop"
// duas vezes duplicaria metade da base, e ninguém percebe até a lista estar
// cheia de repetidos com histórico dividido entre eles.
//
// Aqui cada candidato chega marcado: já está na base? vale a pena? por quê? E
// quem decide é quem está na tela.

const digitos = (v) => String(v || '').replace(/\D/g, '');

/**
 * Telefone que serve para identificar alguém.
 *
 * Só dígitos não basta: a Receita preenche o campo com zeros quando não tem o
 * número, e o CRM casa duplicados por telefone. Sem esta checagem, duas
 * empresas sem relação nenhuma que tivessem "0000000000" eram tratadas como a
 * mesma, e a revisão escondia lead bom dizendo que já existia.
 */
export function telefoneUtil(v) {
  const d = digitos(v);
  if (d.length < 10) return '';
  if (/^0+$/.test(d)) return '';
  return d;
}
const minusculo = (v) => String(v || '').trim().toLowerCase();

const numero = (v) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Procura o candidato entre os leads que já existem.
 *
 * Três chaves, em ordem de confiança. CNPJ identifica com certeza. E-mail
 * também, na prática. Telefone só com 10 dígitos ou mais — abaixo disso é
 * fragmento de cadastro velho e casaria com qualquer um. Nome fica de fora de
 * propósito: "Pizzaria do João" existe em toda cidade, e bloquear por nome
 * esconderia leads legítimos.
 */
export function acharExistente(candidato, leads = []) {
  const cnpj = digitos(candidato.cnpj);
  const email = minusculo(candidato.email);
  const tel = telefoneUtil(candidato.whatsapp || candidato.telefone);

  for (const lead of leads) {
    if (cnpj && cnpj.length === 14 && digitos(lead.cnpj) === cnpj) {
      return { lead, por: 'CNPJ' };
    }
    if (email && minusculo(lead.email) === email) {
      return { lead, por: 'e-mail' };
    }
    if (tel) {
      const doLead = [telefoneUtil(lead.telefone), telefoneUtil(lead.whatsapp)];
      if (doLead.some(d => d && d.endsWith(tel.slice(-10)))) {
        return { lead, por: 'telefone' };
      }
    }
  }
  return null;
}

/**
 * Nota rápida do candidato, sem IA e sem histórico.
 *
 * Diferente da pontuação da carteira: aqui não há etapa nem último contato,
 * só o que veio na lista. Serve para ordenar a revisão, não para prever venda.
 */
export function pontuarCandidato(candidato = {}) {
  let pontos = 0;
  const motivos = [];

  const nota = numero(candidato.nota);
  const avaliacoes = numero(candidato.avaliacoes);

  if (nota >= 4.5 && avaliacoes >= 20) { pontos += 30; motivos.push(`Nota ${nota} com ${avaliacoes} avaliações`); }
  else if (nota >= 4.0) { pontos += 18; motivos.push(`Nota ${nota}`); }
  else if (nota > 0 && nota < 3.5) { motivos.push(`Nota baixa (${nota})`); }

  // Muitas avaliações = negócio com movimento, mesmo sem nota alta
  if (avaliacoes >= 100) { pontos += 15; }
  else if (avaliacoes >= 30) { pontos += 8; }

  if (candidato.whatsapp || candidato.telefone) pontos += 20; else motivos.push('Sem telefone');
  if (candidato.email) pontos += 10;
  if (candidato.site) { pontos += 10; motivos.push('Tem site'); }
  if (candidato.instagram) { pontos += 8; motivos.push('Tem Instagram'); }

  // Nem site nem Instagram é o cliente ideal desta agência: o problema que ela
  // resolve está escancarado.
  if (!candidato.site && !candidato.instagram) {
    pontos += 12;
    motivos.push('Sem presença digital — oportunidade clara');
  }

  return { pontos: Math.max(0, Math.min(100, pontos)), motivos };
}

/**
 * Prepara a lista de revisão.
 *
 * Duplicado nunca vem marcado para importar. O padrão é o seguro: quem quiser
 * importar mesmo assim marca à mão, e vê ao lado qual lead já existe.
 */
export function prepararRevisao(candidatos = [], leads = []) {
  return candidatos.map((bruto, indice) => {
    // Limpa telefone inútil antes de qualquer coisa: as fatias já geradas
    // carregam "(0000) 0000-0000", e importar isso encheria o CRM de contatos
    // falsos que ainda por cima quebram o dedup mais adiante.
    const candidato = { ...bruto };
    if (!telefoneUtil(candidato.telefone)) delete candidato.telefone;
    if (!telefoneUtil(candidato.whatsapp)) delete candidato.whatsapp;

    const existente = acharExistente(candidato, leads);
    const { pontos, motivos } = pontuarCandidato(candidato);

    // Sem nome não vira lead: a lista ficaria com linhas em branco que ninguém
    // consegue identificar depois.
    const semNome = !String(candidato.nome || '').trim();

    return {
      indice,
      candidato,
      pontos,
      motivos,
      existente: existente ? { nome: existente.lead.nome, por: existente.por } : null,
      semNome,
      importar: !existente && !semNome,
    };
  });
}

/** Contagem para o cabeçalho da revisão. */
export function resumoDaRevisao(itens = []) {
  return {
    total: itens.length,
    novos: itens.filter(i => !i.existente && !i.semNome).length,
    duplicados: itens.filter(i => i.existente).length,
    semNome: itens.filter(i => i.semNome).length,
    marcados: itens.filter(i => i.importar).length,
  };
}

/** Ordena a revisão: o que vale mais olhar primeiro. */
export function ordenarRevisao(itens = []) {
  return itens.slice().sort((a, b) => {
    // Problemas descem: duplicado e sem nome não são decisão, são descarte.
    const problemaA = Boolean(a.existente || a.semNome);
    const problemaB = Boolean(b.existente || b.semNome);
    if (problemaA !== problemaB) return problemaA ? 1 : -1;
    return b.pontos - a.pontos;
  });
}
