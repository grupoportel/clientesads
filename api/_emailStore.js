import { createHash } from 'node:crypto';
import { normalizarEndereco } from './_email.js';

export const LIMITE_CORPO_EMAIL = 50000;

export function chaveMensagem(conta = '', uid = '', messageId = '') {
  return createHash('sha256')
    .update(`${normalizarEndereco(conta)}|${uid}|${String(messageId || '')}`)
    .digest('hex');
}

export function textoDoEmail(parsed = {}) {
  const texto = String(parsed.text || '').trim();
  if (texto) return texto.slice(0, LIMITE_CORPO_EMAIL);

  // O CRM nunca renderiza HTML recebido. Além de reduzir ruído, isso evita
  // scripts, pixels de rastreamento e conteúdo remoto dentro da aplicação.
  return String(parsed.html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p\s*>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
    .slice(0, LIMITE_CORPO_EMAIL);
}

export function enderecoPrincipal(campo) {
  const item = campo?.value?.[0];
  return {
    nome: String(item?.name || '').trim(),
    email: normalizarEndereco(item?.address || ''),
  };
}

export function acharLeadPorEmail(leads = {}, email = '') {
  const procurado = normalizarEndereco(email);
  if (!procurado) return null;
  for (const [id, lead] of Object.entries(leads || {})) {
    if (normalizarEndereco(lead?.email) === procurado) return { id, ...lead };
  }
  return null;
}

export function assuntoDeResposta(assunto = '') {
  const limpo = String(assunto || '').trim();
  return /^re:/i.test(limpo) ? limpo : `Re: ${limpo || 'Sua mensagem'}`;
}

