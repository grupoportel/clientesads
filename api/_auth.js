// api/_auth.js
// Utilitários compartilhados pelas funções serverless.
// Arquivos com "_" no início não viram rota pública no Vercel.

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAppCheck } from 'firebase-admin/app-check';
import { getAuth }      from 'firebase-admin/auth';
import { getDatabase }  from 'firebase-admin/database';

// ── Inicialização preguiçosa ────────────────────────────────────────────────
// Feita dentro do handler, nunca no topo do módulo: se faltar uma variável de
// ambiente, o erro vira uma resposta legível em vez de derrubar a importação.
export function iniciarAdmin() {
  if (!getApps().length) {
    const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, FIREBASE_DATABASE_URL } = process.env;

    if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY || !FIREBASE_DATABASE_URL) {
      throw new Error('Credenciais do Firebase ausentes nas variáveis de ambiente do servidor.');
    }

    initializeApp({
      credential: cert({
        projectId:   FIREBASE_PROJECT_ID,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        // A chave privada chega com \n escapado pelo painel do Vercel
        privateKey:  FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
      databaseURL: FIREBASE_DATABASE_URL,
    });
  }
  return getApps()[0];
}

export function obterBanco() {
  iniciarAdmin();
  return getDatabase();
}

/**
 * Impõe um prazo a uma promessa do Firebase.
 *
 * O cliente do Realtime Database não rejeita quando a credencial é inválida:
 * ele fica retentando a conexão para sempre. Na prática a função serverless
 * ficava pendurada até morrer aos 300s, e quem estava na tela via só um botão
 * travado em "Criando…" — sem erro no console, sem resposta, sem pista.
 *
 * Com prazo, a mesma falha vira uma mensagem que diz o que fazer.
 */
export function comPrazo(promessa, ms = 8000, oQue = 'o banco de dados') {
  return Promise.race([
    promessa,
    new Promise((_, rejeitar) =>
      setTimeout(
        () => rejeitar(new Error(`Sem resposta ${oQue === 'o banco de dados' ? 'do banco de dados' : `de ${oQue}`} em ${ms / 1000}s.`)),
        ms
      )
    ),
  ]);
}

/**
 * Traduz falhas de credencial do servidor para quem está na tela.
 *
 * "invalid_grant: account not found" não diz nada a quem usa o CRM, e o
 * problema não está no que a pessoa fez — está na chave do servidor.
 */
export function explicarErroDeCredencial(erro) {
  const texto = `${erro?.code || ''} ${erro?.message || ''}`;
  if (texto.includes('invalid-credential') || texto.includes('invalid_grant') || texto.includes('Sem resposta')) {
    return 'A chave de acesso do servidor ao Firebase está inválida ou foi revogada. '
      + 'Gere uma nova chave privada em Configurações do projeto → Contas de serviço '
      + 'e atualize FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY na Vercel.';
  }
  return null;
}

export function appCheckObrigatorio(ambiente = process.env) {
  return String(ambiente.FIREBASE_APPCHECK_ENFORCE || '').toLowerCase() === 'true';
}

/**
 * Valida a origem da chamada sem criar um corte brusco na ativação.
 *
 * Durante a fase de observação, tokens presentes são verificados e falhas são
 * registradas, mas chamadas sem token continuam. Só quando
 * FIREBASE_APPCHECK_ENFORCE=true é que ausência ou token inválido bloqueiam.
 */
export async function verificarAppCheck(req, res) {
  const obrigatorio = appCheckObrigatorio();
  const token = req.headers?.['x-firebase-appcheck'] || req.headers?.['X-Firebase-AppCheck'];

  if (!token) {
    if (obrigatorio) {
      res.status(401).json({ error: 'Não foi possível validar a origem desta solicitação.' });
      return false;
    }
    return true;
  }

  try {
    const app = iniciarAdmin();
    await getAppCheck(app).verifyToken(token);
    return true;
  } catch (erro) {
    console.warn('[app-check] Token recusado:', erro?.code || erro?.message);
    if (obrigatorio) {
      res.status(401).json({ error: 'Não foi possível validar a origem desta solicitação.' });
      return false;
    }
    return true;
  }
}

// ── Porteiro ────────────────────────────────────────────────────────────────
// Valida o token de sessão do Firebase enviado pelo front no cabeçalho
// Authorization. Devolve o usuário autenticado, ou null se já respondeu o erro.
export async function exigirUsuario(req, res, opcoes = {}) {
  const { papeis = null } = opcoes;
  if (!await verificarAppCheck(req, res)) return null;
  const cabecalho = req.headers?.authorization || req.headers?.Authorization || '';
  const token = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7).trim() : null;

  if (!token) {
    // Genérica de propósito: os três endpoints que passam por aqui fazem
    // coisas diferentes, e "faça login para enviar mensagens" na tela de
    // usuários manda a pessoa procurar problema no lugar errado.
    res.status(401).json({ error: 'Faça login para continuar.' });
    return null;
  }

  try {
    iniciarAdmin();
    const usuario = await getAuth().verifyIdToken(token);

    // Um token válido prova a identidade, não que a conta ainda tenha acesso
    // ao CRM. Sem esta segunda checagem, uma conta removida da lista de
    // usuários continuava podendo chamar as funções serverless e consumir
    // SMTP/IA diretamente.
    const snap = await comPrazo(
      getDatabase().ref(`crm_data/usuarios/${usuario.uid}`).once('value'),
      8000,
      'as permissões do CRM'
    );
    const cadastro = snap.val();
    if (!cadastro) {
      res.status(403).json({ error: 'Esta conta não tem acesso ao CRM.' });
      return null;
    }
    if (Array.isArray(papeis) && !papeis.includes(cadastro.role)) {
      res.status(403).json({ error: 'Seu perfil não permite executar esta ação.' });
      return null;
    }
    return { ...usuario, role: cadastro.role, cadastro };
  } catch (erro) {
    console.warn('[auth] Token recusado:', erro?.code || erro?.message);
    res.status(401).json({ error: 'Sua sessão expirou. Entre novamente para continuar.' });
    return null;
  }
}
