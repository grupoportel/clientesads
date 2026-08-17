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
      modelo: GEMINI_MODELO || 'gemini-2.5-flash',
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

export async function chamarIa(prompt, cfg, ms = 25000) {
  const parar = AbortSignal.timeout(ms);

  if (cfg.provedor === 'gemini') {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${cfg.modelo}:generateContent`,
      {
        method: 'POST',
        signal: parar,
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
