// api/_agenda.js
// Integração com o Google Agenda, com a parte pura separada da rede.
//
// Mão única de propósito: o CRM cria o evento no Google, e não o contrário.
// Sincronizar os dois lados exigiria webhook, token de atualização e uma regra
// de conflito para quando a mesma reunião mudar nos dois lugares — trabalho
// grande para resolver um problema que ainda não existe.
//
// A autenticação reaproveita a conta de serviço que já existe para o Firebase.
// Isso evita montar fluxo de OAuth, tela de consentimento e guarda de refresh
// token: basta compartilhar a agenda com o e-mail da conta de serviço.

import { JWT } from 'google-auth-library';

const ESCOPO = ['https://www.googleapis.com/auth/calendar.events'];

export function configuracaoAgenda(env = process.env) {
  const calendario = env.GOOGLE_CALENDAR_ID;
  if (!calendario) return null;

  // Conta dedicada se existir; senão a mesma do Firebase, que já está
  // configurada. Uma variável a menos para a pessoa errar.
  const email = env.GOOGLE_CALENDAR_CLIENT_EMAIL || env.FIREBASE_CLIENT_EMAIL;
  const chave = env.GOOGLE_CALENDAR_PRIVATE_KEY || env.FIREBASE_PRIVATE_KEY;
  if (!email || !chave) return null;

  return {
    calendario,
    email,
    chave: chave.replace(/\\n/g, '\n'),
    // São Paulo e não Cuiabá: o que importa é o fuso em que a agenda de quem
    // usa está configurada, não o dos leads. Com o fuso errado a reunião das
    // 10h aparece às 11h no Google, e ninguém desconfia do CRM por causa disso
    // — desconfia da própria memória.
    fuso: env.AGENDA_FUSO || 'America/Sao_Paulo',
  };
}

// ── Datas ───────────────────────────────────────────────────────────────────

/**
 * Soma minutos a um "AAAA-MM-DDTHH:mm" e devolve no mesmo formato.
 *
 * Feito na aritmética em vez de com Date local: assim o resultado não muda
 * conforme o fuso da máquina que roda, e o teste vale em qualquer lugar. O
 * Date.UTC no meio existe só para acertar virada de dia, mês e ano bissexto.
 */
export function somarMinutos(dataHora, minutos) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(dataHora || ''));
  if (!m) return null;

  const [, ano, mes, dia, hora, min] = m.map(Number);
  const base = Date.UTC(ano, mes - 1, dia, hora, min);
  const d = new Date(base + minutos * 60000);

  const dd = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${dd(d.getUTCMonth() + 1)}-${dd(d.getUTCDate())}`
    + `T${dd(d.getUTCHours())}:${dd(d.getUTCMinutes())}:00`;
}

/** Normaliza a entrada do formulário para o formato que o Google espera. */
export function inicioDoEvento(dataHora) {
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/.exec(String(dataHora || ''));
  return m ? `${m[1]}T${m[2]}:00` : null;
}

/** Data e hora em português, para o e-mail e para a linha do tempo. */
export function textoDataHora(dataHora) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(dataHora || ''));
  if (!m) return '';
  const [, ano, mes, dia, hora, min] = m;
  return `${dia}/${mes}/${ano} às ${hora}:${min}`;
}

// ── Evento ──────────────────────────────────────────────────────────────────

/**
 * Monta o corpo do evento.
 *
 * Sem `attendees` de propósito: uma conta de serviço não consegue convidar
 * ninguém sem delegação em todo o domínio, que só existe no Workspace. O
 * Google recusaria o evento inteiro. Quem avisa o lead é o e-mail de
 * confirmação que o próprio CRM manda.
 */
export function montarEvento(lead = {}, opcoes = {}) {
  const { dataHora, duracaoMin = 60, observacao = '', fuso = 'America/Sao_Paulo' } = opcoes;

  const inicio = inicioDoEvento(dataHora);
  if (!inicio) return null;

  const fim = somarMinutos(dataHora, Number(duracaoMin) || 60);
  const quem = lead.nome || 'Lead';

  const descricao = [
    `Reunião agendada pelo CRM Grupo Portel.`,
    lead.decisor ? `Contato: ${lead.decisor}` : null,
    lead.telefone ? `Telefone: ${lead.telefone}` : null,
    lead.email ? `E-mail: ${lead.email}` : null,
    lead.nicho ? `Nicho: ${lead.nicho}` : null,
    observacao ? `\n${observacao}` : null,
  ].filter(Boolean).join('\n');

  return {
    summary: `Reunião — ${quem}`,
    description: descricao,
    location: [lead.cidade, lead.estado].filter(Boolean).join(' / ') || undefined,
    start: { dateTime: inicio, timeZone: fuso },
    end: { dateTime: fim, timeZone: fuso },
    // Lembrete no Google Agenda é por pessoa, não por evento: o que a conta de
    // serviço define vale para a cópia dela, e quem abre a agenda continua
    // vendo o próprio padrão. Havia um override de 60 e 10 minutos aqui que
    // simplesmente não chegava a ninguém. Melhor usar o padrão de quem usa do
    // que manter código que promete um lembrete e não entrega.
    reminders: { useDefault: true },
  };
}

/** Texto do e-mail de confirmação para o lead. */
export function textoConfirmacao(lead = {}, opcoes = {}) {
  const { dataHora, duracaoMin = 60, observacao = '', empresa = 'Grupo Portel' } = opcoes;
  const quando = textoDataHora(dataHora);
  const tratamento = lead.decisor || lead.nome || '';

  const corpo = [
    tratamento ? `Olá, ${tratamento}!` : 'Olá!',
    '',
    `Confirmando nossa reunião para ${quando}, com duração prevista de ${duracaoMin} minutos.`,
    observacao ? `\n${observacao}` : null,
    '',
    'Se precisar remarcar, é só responder este e-mail.',
    '',
    `Até lá,`,
    empresa,
  ].filter(l => l !== null).join('\n');

  return { assunto: `Confirmação de reunião — ${quando}`, corpo };
}

// ── Rede ────────────────────────────────────────────────────────────────────

/** Cria o evento e devolve o link. Única parte que sai da máquina. */
export async function criarEvento(cfg, evento) {
  const cliente = new JWT({ email: cfg.email, key: cfg.chave, scopes: ESCOPO });
  const { token } = await cliente.getAccessToken();

  const r = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cfg.calendario)}/events`,
    {
      method: 'POST',
      signal: AbortSignal.timeout(12000),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(evento),
    }
  );

  if (!r.ok) throw new Error(`Google Agenda respondeu ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const corpo = await r.json();
  return { id: corpo.id, link: corpo.htmlLink };
}

/** Traduz falhas do Google Agenda para quem está na tela. */
export function explicarErroAgenda(erro) {
  const t = `${erro?.message || ''}`;
  if (/\b404\b/.test(t)) {
    return 'A agenda não foi encontrada. Confira GOOGLE_CALENDAR_ID e se ela foi '
      + 'compartilhada com o e-mail da conta de serviço.';
  }
  if (/\b403\b/.test(t)) {
    if (/calendar.*not.*enabled|accessNotConfigured/i.test(t)) {
      return 'A API do Google Agenda não está ativada no projeto do Google Cloud.';
    }
    return 'A conta de serviço não tem permissão de escrita nessa agenda. '
      + 'Compartilhe com "Fazer alterações nos eventos".';
  }
  if (/invalid_grant|account not found/i.test(t)) {
    return 'A chave da conta de serviço está inválida ou foi revogada.';
  }
  if (/TimeoutError|aborted/i.test(t)) {
    return 'O Google Agenda demorou demais para responder. Tente de novo.';
  }
  return null;
}
