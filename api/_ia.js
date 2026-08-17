// api/_ia.js
// Camada de IA, agnóstica de provedor e com a parte pura separada da rede,
// para poder ser testada sem gastar cota nenhuma.
//
// O provedor sai das variáveis de ambiente, como no e-mail: hoje Gemini pela
// cota gratuita do Google AI Studio, amanhã outro, sem mexer no código.

/** Campos que a análise pode sugerir. Nada fora desta lista é aceito. */
export const CAMPOS_ANALISE = ['melhores', 'oportunidades', 'pontos', 'escalar'];

export function configuracaoIa(env = process.env) {
  const { GEMINI_API_KEY, GEMINI_MODELO, ANTHROPIC_API_KEY, ANTHROPIC_MODELO } = env;

  if (GEMINI_API_KEY) {
    return {
      provedor: 'gemini',
      chave: GEMINI_API_KEY,
      // Sem nome padrão de propósito. Fixar um aqui foi o que quebrou a
      // análise: o Google aposentou "gemini-2.5-flash" para chaves novas e
      // passou a responder 404. Nome de modelo é coisa que envelhece sozinha,
      // então o certo é perguntar à API o que a chave aceita.
      modelo: GEMINI_MODELO || null,
    };
  }
  if (ANTHROPIC_API_KEY) {
    return {
      provedor: 'anthropic',
      chave: ANTHROPIC_API_KEY,
      modelo: ANTHROPIC_MODELO || 'claude-sonnet-5',
    };
  }
  return null;
}

// ── Preparo do texto do site ────────────────────────────────────────────────

/**
 * Reduz uma página HTML a texto legível.
 *
 * Não é parser de HTML e não precisa ser: o objetivo é dar contexto à IA, não
 * reconstruir a página. Script e style saem primeiro porque senão viram um
 * paredão de código que ocupa todo o espaço útil do prompt.
 */
export function textoDoHtml(html = '', limite = 6000) {
  const limpo = String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();

  return limpo.length > limite ? limpo.slice(0, limite) + '…' : limpo;
}

/** Normaliza o que a pessoa digitou no campo site para uma URL buscável. */
export function urlDoSite(site = '') {
  const texto = String(site).trim();
  if (!texto) return null;

  // Esquema estranho é recusado, não consertado. Prefixar "https://" em
  // "file:///etc/passwd" produzia uma URL esquisita em vez de um não, e uma
  // guarda que não recusa o que diz recusar não serve de guarda.
  const temEsquema = /^[a-z][a-z0-9+.-]*:/i.test(texto);
  if (temEsquema && !/^https?:\/\//i.test(texto)) return null;

  const comEsquema = temEsquema ? texto : `https://${texto}`;
  try {
    const url = new URL(comEsquema);
    // Só http(s): sem isso um campo com "file://" ou "http://169.254.169.254"
    // viraria uma requisição do servidor para onde não deve ir.
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[::1\])/i.test(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

// ── Prompt ──────────────────────────────────────────────────────────────────

export function montarPromptAnalise(lead = {}, textoSite = '') {
  const dados = [
    ['Nome / empresa', lead.nome],
    ['Nicho', lead.nicho],
    ['Cidade', [lead.cidade, lead.estado].filter(Boolean).join(' / ')],
    ['Site', lead.site],
    ['Instagram', lead.instagram],
    ['Nota no Google', lead.nota],
    ['Avaliações', lead.avaliacoes],
    ['Decisor', lead.decisor],
  ].filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')
   .map(([k, v]) => `- ${k}: ${v}`)
   .join('\n');

  return `Você é consultor de marketing digital analisando um possível cliente
para uma agência que vende gestão de tráfego e presença digital para negócios
locais no Brasil.

DADOS DO LEAD
${dados || '- (quase nada preenchido)'}

${textoSite ? `CONTEÚDO DO SITE\n${textoSite}` : 'O site não pôde ser lido ou não foi informado.'}

Responda SOMENTE com um objeto JSON, sem texto antes ou depois, sem cercas de
código, com exatamente estas chaves:

{
  "melhores": "o que a empresa já faz bem em presença digital",
  "oportunidades": "o que está faltando e a agência poderia vender",
  "pontos": "diferenciais do negócio que servem de argumento na abordagem",
  "escalar": "potencial de crescimento e por quê",
  "confianca": "alta, media ou baixa"
}

Regras:
- Escreva em português do Brasil, direto, no máximo 2 frases por campo.
- Baseie-se apenas no que está acima. Não invente número, preço nem nome.
- Se os dados forem insuficientes para um campo, deixe-o como string vazia.
- Se você teve pouca informação, use "confianca": "baixa".`;
}

/**
 * Lê a resposta do modelo.
 *
 * Modelos costumam devolver JSON embrulhado em ```json apesar do pedido, então
 * a cerca é removida antes de tentar. E o resultado é filtrado contra
 * CAMPOS_ANALISE: assim uma resposta criativa não consegue injetar chave
 * nenhuma no cadastro do lead.
 */
export function interpretarAnalise(texto = '') {
  const semCerca = String(texto)
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  // Se ainda houver texto em volta, pega do primeiro { ao último }
  const inicio = semCerca.indexOf('{');
  const fim = semCerca.lastIndexOf('}');
  if (inicio === -1 || fim === -1 || fim < inicio) return null;

  let bruto;
  try {
    bruto = JSON.parse(semCerca.slice(inicio, fim + 1));
  } catch {
    return null;
  }
  if (!bruto || typeof bruto !== 'object') return null;

  const campos = {};
  CAMPOS_ANALISE.forEach(chave => {
    const valor = bruto[chave];
    if (typeof valor === 'string' && valor.trim()) campos[chave] = valor.trim();
  });

  const confianca = ['alta', 'media', 'baixa'].includes(bruto.confianca) ? bruto.confianca : 'baixa';

  // Sem nenhum campo preenchido não há o que sugerir — melhor dizer isso do
  // que devolver um objeto vazio que a tela mostraria como sucesso.
  if (Object.keys(campos).length === 0) return null;

  return { campos, confianca };
}

// ── Chamada ao provedor ─────────────────────────────────────────────────────
// Única parte que toca a rede. O resto do arquivo é puro de propósito.

/**
 * Escolhe um modelo entre os que a chave realmente tem.
 *
 * Pura para poder ser testada sem chamar o Google. A ordem de preferência
 * evita as duas armadilhas: modelo que não gera texto (embedding, imagem, voz)
 * e modelo experimental, que some sem aviso — foi assim que a análise quebrou
 * da primeira vez.
 */
export function escolherModelo(modelos = []) {
  const candidatos = modelos.filter(m =>
    (m?.supportedGenerationMethods || []).includes('generateContent') &&
    !/embedding|aqa|vision|image|imagen|tts|audio|video|live|veo/i.test(m.name || '')
  );
  if (candidatos.length === 0) return null;

  const nota = (m) => {
    const nome = String(m.name || '').replace(/^models\//, '');
    let pontos = 0;
    if (/flash/i.test(nome) && !/lite/i.test(nome)) pontos += 100; // rápido e barato
    else if (/flash/i.test(nome)) pontos += 80;
    else if (/pro/i.test(nome)) pontos += 60;
    if (/preview|exp|experimental/i.test(nome)) pontos -= 50;      // some sem aviso
    // Versão maior ganha: 3.0 acima de 2.5
    const versao = /(\d+)(?:\.(\d+))?/.exec(nome);
    if (versao) pontos += Number(versao[1]) * 10 + Number(versao[2] || 0);
    return pontos;
  };

  const melhor = candidatos.slice().sort((a, b) => nota(b) - nota(a))[0];
  return String(melhor.name || '').replace(/^models\//, '');
}

// Guardado no módulo: numa função serverless quente isso evita repetir a
// consulta a cada análise. Instância nova descobre de novo, o que é barato.
let modeloEmCache = null;

export async function descobrirModelo(cfg, ms = 10000) {
  if (modeloEmCache) return modeloEmCache;
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', {
    signal: AbortSignal.timeout(ms),
    headers: { 'x-goog-api-key': cfg.chave },
  });
  if (!r.ok) throw new Error(`Gemini respondeu ${r.status} ao listar modelos`);
  const corpo = await r.json();
  modeloEmCache = escolherModelo(corpo.models || []);
  return modeloEmCache;
}

/**
 * Diz se vale tentar de novo.
 *
 * A cota gratuita do Gemini responde 503 quando o modelo está congestionado, e
 * 429 quando o limite por minuto estoura. Os dois passam sozinhos em segundos.
 * Já 400, 401, 403 e 404 são configuração ou pedido errado: repetir só demora
 * mais para chegar ao mesmo não.
 */
export function ehTransitorio(mensagem = '') {
  return /\b(429|500|502|503|504)\b/.test(String(mensagem))
    || /UNAVAILABLE|high demand|overloaded|rate limit/i.test(String(mensagem));
}

/** Espera crescente com um empurrãozinho aleatório, para duas abas que
 *  falharam juntas não voltarem no mesmo instante. */
export function atrasoDaTentativa(tentativa, aleatorio = 0.5) {
  const base = 700 * Math.pow(2, tentativa - 1); // 700, 1400, 2800
  return Math.round(base + aleatorio * 400);
}

async function comTentativas(fn, tentativas = 3) {
  let ultimo;
  for (let n = 1; n <= tentativas; n++) {
    try {
      return await fn();
    } catch (erro) {
      ultimo = erro;
      if (n === tentativas || !ehTransitorio(erro.message)) throw erro;
      const espera = atrasoDaTentativa(n, Math.random());
      console.warn(`[ia] Tentativa ${n} falhou (${erro.message.slice(0, 60)}); repetindo em ${espera}ms`);
      await new Promise(r => setTimeout(r, espera));
    }
  }
  throw ultimo;
}

async function gerarComGemini(prompt, cfg, modelo, ms) {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
    {
      method: 'POST',
      signal: AbortSignal.timeout(ms),
      // A chave vai no cabeçalho, nunca na URL: query string aparece em log
      // de servidor e de proxy, e ali ela vazaria inteira.
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.chave },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1200 },
      }),
    }
  );
  if (!r.ok) throw new Error(`Gemini respondeu ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const corpo = await r.json();
  return corpo?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
}

export async function chamarIa(prompt, cfg, ms = 25000) {
  const parar = AbortSignal.timeout(ms);

  if (cfg.provedor === 'gemini') {
    const modelo = cfg.modelo || await descobrirModelo(cfg);
    if (!modelo) throw new Error('Nenhum modelo de geração de texto disponível para esta chave.');

    try {
      return await comTentativas(() => gerarComGemini(prompt, cfg, modelo, ms));
    } catch (erro) {
      // 404 aqui significa modelo aposentado, e ele não volta. Descobrir o que
      // a chave aceita agora é melhor do que deixar a análise quebrada até
      // alguém reparar e editar uma variável de ambiente.
      if (!/\b404\b/.test(erro.message)) throw erro;
      modeloEmCache = null;
      const substituto = await descobrirModelo(cfg);
      if (!substituto || substituto === modelo) throw erro;
      console.warn(`[ia] Modelo ${modelo} indisponível; usando ${substituto}`);
      return await comTentativas(() => gerarComGemini(prompt, cfg, substituto, ms));
    }
  }

  if (cfg.provedor === 'anthropic') {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: parar,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': cfg.chave,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: cfg.modelo,
        max_tokens: 1200,
        temperature: 0.3,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!r.ok) throw new Error(`Anthropic respondeu ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const corpo = await r.json();
    return corpo?.content?.map(b => b.text || '').join('') || '';
  }

  throw new Error(`Provedor de IA desconhecido: ${cfg.provedor}`);
}

/** Busca a página do lead. Falhar aqui não impede a análise, só a empobrece. */
export async function buscarSite(url, ms = 8000) {
  try {
    const r = await fetch(url, {
      signal: AbortSignal.timeout(ms),
      redirect: 'follow',
      headers: { 'User-Agent': 'CRM-GrupoPortel/1.0 (+analise de lead)' },
    });
    if (!r.ok) return { texto: '', erro: `site respondeu ${r.status}` };

    const tipo = r.headers.get('content-type') || '';
    if (!tipo.includes('html') && !tipo.includes('text')) {
      return { texto: '', erro: 'o endereço não devolveu uma página' };
    }
    return { texto: textoDoHtml(await r.text()), erro: null };
  } catch (e) {
    return { texto: '', erro: e.name === 'TimeoutError' ? 'o site demorou demais' : 'não consegui abrir o site' };
  }
}

/** Traduz falhas de IA para quem está na tela. */
export function explicarErroIa(erro) {
  const t = `${erro?.message || ''}`;
  if (/\b401\b|\b403\b|API_KEY|api key/i.test(t)) {
    return 'A chave da API de IA foi recusada. Confira GEMINI_API_KEY na Vercel.';
  }
  if (/\b429\b|quota|rate/i.test(t)) {
    return 'A cota gratuita da IA se esgotou por agora. Tente de novo em alguns minutos.';
  }
  if (/TimeoutError|aborted|timeout/i.test(t)) {
    return 'A IA demorou demais para responder. Tente de novo.';
  }
  return null;
}

// ── Redigir mensagem ────────────────────────────────────────────────────────

/**
 * Intenções que a IA sabe escrever.
 *
 * Lista fechada de propósito. Um campo livre de "o que você quer dizer"
 * devolveria texto de qualidade imprevisível a cada uso; com a intenção
 * escolhida, o pedido é sempre o mesmo e só o lead muda. A instrução livre
 * continua existindo, mas por cima de uma base conhecida.
 */
export const INTENCOES = [
  {
    id: 'primeiro-contato',
    rotulo: 'Primeira abordagem',
    instrucao: 'Primeiro contato. A pessoa não conhece a agência. Puxe por algo concreto '
      + 'do negócio dela, não por elogio genérico, e termine propondo uma conversa curta.',
  },
  {
    id: 'follow-up',
    rotulo: 'Retomar contato',
    instrucao: 'Já houve contato e a pessoa não respondeu. Retome sem cobrar e sem soar '
      + 'ressentido. Traga um motivo novo para a conversa em vez de só perguntar se viu a mensagem.',
  },
  {
    id: 'pos-reuniao',
    rotulo: 'Depois da reunião',
    instrucao: 'A reunião já aconteceu. Agradeça, retome o que foi combinado e deixe claro '
      + 'qual é o próximo passo e de quem é a vez de agir.',
  },
  {
    id: 'proposta',
    rotulo: 'Falar da proposta',
    instrucao: 'A proposta já foi enviada ou está para ser. Trate dela sem pressionar, e '
      + 'ofereça esclarecer dúvidas. Não invente valores nem prazos.',
  },
  {
    id: 'reativar',
    rotulo: 'Reativar lead parado',
    instrucao: 'O contato esfriou há bastante tempo. Reabra a conversa reconhecendo o tempo '
      + 'passado, sem constranger, e com um motivo concreto para falar agora.',
  },
];

export const acharIntencao = (id) => INTENCOES.find(i => i.id === id) || null;

/** Resume a linha do tempo para caber no prompt sem virar um paredão. */
export function resumirHistorico(atividades = [], limite = 8) {
  return atividades
    .slice(0, limite)
    .map(a => `- ${(a.criadoEm || '').slice(0, 10)}: ${a.descricao || ''}`.trim())
    .filter(l => l.length > 14)
    .join('\n');
}

export function montarPromptMensagem(lead = {}, opcoes = {}) {
  const {
    canal = 'whatsapp', intencao, instrucao = '', historico = '',
    empresa = 'Grupo Portel', meuNome = '',
  } = opcoes;

  const ehEmail = canal === 'email';
  const alvo = acharIntencao(intencao);

  const dados = [
    ['Empresa', lead.nome],
    ['Pessoa de contato', lead.decisor],
    ['Nicho', lead.nicho],
    ['Cidade', [lead.cidade, lead.estado].filter(Boolean).join(' / ')],
    ['Etapa no funil', lead.status],
    ['Site', lead.site],
    ['Nota no Google', lead.nota],
    ['O que já faz bem', lead.melhores],
    ['Oportunidades identificadas', lead.oportunidades],
    ['Pontos fortes', lead.pontos],
  ].filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')
   .map(([k, v]) => `- ${k}: ${v}`)
   .join('\n');

  return `Você escreve mensagens comerciais para a ${empresa}, uma agência que vende
gestão de tráfego e presença digital para negócios locais no Brasil.

CANAL: ${ehEmail ? 'e-mail' : 'WhatsApp'}
OBJETIVO: ${alvo ? alvo.instrucao : 'Escrever uma mensagem comercial adequada ao contexto.'}

DADOS DO LEAD
${dados || '- (quase nada preenchido)'}

${historico ? `O QUE JÁ ACONTECEU\n${historico}` : 'Não há histórico registrado.'}
${instrucao ? `\nPEDIDO DE QUEM VAI ENVIAR\n${instrucao}` : ''}

Responda SOMENTE com um objeto JSON, sem texto antes ou depois e sem cercas de
código:

${ehEmail
    ? '{ "assunto": "assunto curto e específico", "corpo": "texto do e-mail" }'
    : '{ "corpo": "texto da mensagem" }'}

Regras:
- Português do Brasil, tratamento por "você".
- ${ehEmail
    ? 'No máximo 3 parágrafos curtos. Assunto sem palavra de propaganda e sem CAIXA ALTA.'
    : 'No máximo 4 linhas. Sem saudação longa e sem emoji em excesso: no máximo um.'}
- Não invente preço, prazo, número, resultado nem nome que não esteja acima.
- Não prometa resultado. Nada de "vamos dobrar seu faturamento".
- Termine com uma pergunta ou um convite claro, não com "fico à disposição".
${meuNome ? `- Assine como ${meuNome}.` : '- Não assine com nome de pessoa.'}`;
}

/**
 * Lê a mensagem que o modelo devolveu.
 *
 * Devolve null quando não há corpo: uma caixa de texto preenchida com vazio
 * parece que funcionou, e a pessoa só descobre o problema depois de enviar.
 */
export function interpretarMensagem(texto = '', canal = 'whatsapp') {
  const semCerca = String(texto)
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  const inicio = semCerca.indexOf('{');
  const fim = semCerca.lastIndexOf('}');
  if (inicio === -1 || fim === -1 || fim < inicio) return null;

  let bruto;
  try {
    bruto = JSON.parse(semCerca.slice(inicio, fim + 1));
  } catch {
    return null;
  }

  const corpo = typeof bruto?.corpo === 'string' ? bruto.corpo.trim() : '';
  if (!corpo) return null;

  const assunto = canal === 'email' && typeof bruto.assunto === 'string'
    ? bruto.assunto.trim()
    : '';

  return { corpo, assunto };
}
