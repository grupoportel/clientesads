// api/_email.js
// Configuração de envio de e-mail, separada do handler para poder ser testada.
//
// Antes o host smtp.gmail.com estava escrito dentro do send-email.js. Trocar de
// provedor exigia mexer no código e publicar de novo. Aqui o provedor é
// configuração: Hostinger, Gmail ou qualquer outro SMTP entram pelas mesmas
// variáveis.

/**
 * Monta a configuração do transporte a partir das variáveis de ambiente.
 * Devolve null quando não há credencial nenhuma — quem chama decide o que
 * responder, porque a mensagem muda conforme o endpoint.
 */
export function configuracaoSmtp(env = process.env) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_REMETENTE, SMTP_NOME } = env;

  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    const porta = Number(SMTP_PORT) || 465;
    return {
      host: SMTP_HOST,
      // 465 fala TLS desde o primeiro byte; 587 começa em texto puro e sobe
      // para TLS com STARTTLS. Marcar secure:true numa 587 trava a conexão
      // sem erro claro, e é o engano mais comum ao configurar a Hostinger.
      port: porta,
      secure: porta === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      remetente: SMTP_REMETENTE || SMTP_USER,
      nome: SMTP_NOME || 'Grupo Portel',
      origem: 'smtp',
    };
  }

  // Formato antigo. Mantido de propósito: enquanto as variáveis novas não
  // estiverem na Vercel, o envio continua funcionando pelo Gmail em vez de
  // parar no meio da troca.
  const { GMAIL_USER, GMAIL_APP_PASSWORD } = env;
  if (GMAIL_USER && GMAIL_APP_PASSWORD) {
    return {
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
      remetente: GMAIL_USER,
      nome: 'Grupo Portel',
      origem: 'gmail',
    };
  }

  return null;
}

/** Endereço que recebe as respostas e aparece como caixa de entrada do CRM. */
export function caixaDeEntrada(env = process.env) {
  return env.SMTP_REMETENTE || env.SMTP_USER || env.GMAIL_USER || '';
}

/**
 * Configura a leitura da mesma caixa usada no envio.
 *
 * Na Hostinger, SMTP e IMAP usam o endereço completo e a mesma senha. As
 * variáveis IMAP_* continuam separadas para permitir trocar a caixa de
 * entrada no futuro sem afetar o remetente.
 */
export function configuracaoImap(env = process.env) {
  const user = env.IMAP_USER || env.SMTP_USER || '';
  const pass = env.IMAP_PASS || env.SMTP_PASS || '';
  const host = env.IMAP_HOST
    || (String(env.SMTP_HOST || '').includes('hostinger') ? 'imap.hostinger.com' : '');
  const port = Number(env.IMAP_PORT) || 993;

  if (!host || !user || !pass) return null;
  return {
    host,
    port,
    secure: port === 993,
    auth: { user, pass },
    caixa: user,
  };
}

export function normalizarEndereco(valor = '') {
  return String(valor).trim().toLowerCase();
}

export function mascararEndereco(valor = '') {
  const [nome = '', dominio = ''] = normalizarEndereco(valor).split('@');
  if (!nome || !dominio) return '';
  const inicio = nome.slice(0, Math.min(2, nome.length));
  return `${inicio}${nome.length > 2 ? '•'.repeat(Math.min(5, nome.length - 2)) : ''}@${dominio}`;
}

export function explicarErroImap(erro) {
  const texto = `${erro?.code || ''} ${erro?.responseText || ''} ${erro?.message || ''}`;
  if (/AUTHENTICATIONFAILED|authentication failed|invalid credentials|LOGIN failed/i.test(texto)) {
    return 'A Hostinger recusou o usuário ou a senha da caixa de entrada. Confira IMAP_USER e IMAP_PASS.';
  }
  if (/ETIMEDOUT|ECONNREFUSED|ESOCKET|certificate|TLS/i.test(texto)) {
    return 'Não foi possível conectar à caixa de entrada. Confira IMAP_HOST e IMAP_PORT (993 com SSL).';
  }
  return null;
}

/**
 * Traduz falhas de SMTP para quem está na tela.
 * "EAUTH" e "ETIMEDOUT" não dizem nada a quem só quer mandar um e-mail.
 */
export function explicarErroSmtp(erro) {
  const codigo = erro?.code || '';
  const texto = erro?.message || '';

  if (codigo === 'EAUTH' || /535|authentication failed/i.test(texto)) {
    return 'O servidor de e-mail recusou o usuário ou a senha. Confira SMTP_USER e SMTP_PASS.';
  }
  if (codigo === 'ETIMEDOUT' || codigo === 'ESOCKET' || codigo === 'ECONNECTION') {
    return 'Não foi possível conectar ao servidor de e-mail. Confira SMTP_HOST e SMTP_PORT '
      + '(465 para SSL, 587 para STARTTLS).';
  }
  if (/no recipients|invalid.*recipient|550/i.test(texto)) {
    return 'O servidor recusou o destinatário. Confira o endereço.';
  }
  return null;
}

// ── Corpo do e-mail ─────────────────────────────────────────────────────────

const escapar = (texto = '') =>
  String(texto)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/**
 * Monta o HTML da mensagem.
 *
 * De propósito simples. A versão anterior tinha faixa colorida com gradiente no
 * topo e um rodapé dizendo "enviada pelo CRM" — visual de disparo em massa num
 * e-mail que é um-para-um. O Gmail lê isso como marketing e manda para o spam,
 * e quem recebe também percebe que não foi uma pessoa que escreveu.
 *
 * Aqui o HTML só preserva os parágrafos. É o que um cliente de e-mail comum
 * produziria se a pessoa tivesse digitado a mensagem à mão — que é o que
 * aconteceu, já que ninguém envia sem revisar.
 */
export function montarHtml(corpo = '') {
  const paragrafos = String(corpo)
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p style="margin:0 0 14px;">${escapar(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n');

  return `<div style="font-family:-apple-system,'Segoe UI',Arial,sans-serif;`
    + `font-size:15px;line-height:1.6;color:#222;">\n${paragrafos}\n</div>`;
}

/**
 * Monta um e-mail visual sem aceitar HTML livre do navegador.
 * Texto, URL da imagem e CTA são escapados/validados separadamente para que o
 * editor não vire uma porta de injeção de marcação.
 */
export function montarEmailVisual(corpo = '', opcoes = {}) {
  const urlHttps = (valor) => {
    try {
      const url = new URL(String(valor || ''));
      return url.protocol === 'https:' ? url.toString() : '';
    } catch {
      return '';
    }
  };

  const imagemUrl = urlHttps(opcoes.imagemUrl);
  const ctaUrl = urlHttps(opcoes.ctaUrl);
  const ctaTexto = String(opcoes.ctaTexto || '').trim();
  const nomeEmpresa = String(opcoes.nomeEmpresa || 'Grupo Portel').trim();
  const conteudo = montarHtml(corpo);

  const imagem = imagemUrl
    ? `<img src="${escapar(imagemUrl)}" alt="" width="640" style="display:block;width:100%;max-width:640px;height:auto;border:0;">`
    : '';
  const botao = ctaUrl && ctaTexto
    ? `<div style="margin:24px 0 8px;text-align:center;"><a href="${escapar(ctaUrl)}" style="display:inline-block;background:#00b8c8;color:#001b2d;text-decoration:none;font-weight:700;padding:13px 22px;border-radius:7px;">${escapar(ctaTexto)}</a></div>`
    : '';

  return `<!doctype html><html><body style="margin:0;padding:0;background:#eef3f7;">`
    + `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef3f7;padding:24px 10px;"><tr><td align="center">`
    + `<table role="presentation" width="640" cellspacing="0" cellpadding="0" style="width:100%;max-width:640px;background:#ffffff;border:1px solid #dce5ec;border-radius:10px;overflow:hidden;">`
    + `<tr><td>${imagem}</td></tr><tr><td style="padding:30px 34px 24px;">${conteudo}${botao}</td></tr>`
    + `<tr><td style="padding:16px 34px;background:#001f33;color:#b9c9d4;font:12px/1.5 Arial,sans-serif;text-align:center;">${escapar(nomeEmpresa)}</td></tr>`
    + `</table></td></tr></table></body></html>`;
}

/**
 * Escolhe o "responder a" da mensagem.
 *
 * Só usa o e-mail de quem enviou quando ele é do mesmo domínio do remetente.
 * Assinar como "Grupo Portel <guilherme@grupoportel.com>" e mandar a resposta
 * para um Gmail gratuito é o padrão que golpista usa — empresa no remetente,
 * caixa pessoal na resposta — e os filtros do Gmail pesam isso.
 *
 * O login do CRM é uma conta Google, então esse desencontro era o caso normal,
 * não a exceção.
 */
export function responderPara(emailDeQuemEnviou = '', remetente = '') {
  const dominio = (endereco) => String(endereco).split('@')[1]?.toLowerCase() || '';
  const doRemetente = dominio(remetente);
  if (!doRemetente) return String(emailDeQuemEnviou || '');
  return dominio(emailDeQuemEnviou) === doRemetente ? String(emailDeQuemEnviou) : String(remetente);
}
