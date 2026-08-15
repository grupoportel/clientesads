// api/_auth.js
// Utilitários compartilhados pelas funções serverless.
// Arquivos com "_" no início não viram rota pública no Vercel.

import { initializeApp, getApps, cert } from 'firebase-admin/app';
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

// ── Porteiro ────────────────────────────────────────────────────────────────
// Valida o token de sessão do Firebase enviado pelo front no cabeçalho
// Authorization. Devolve o usuário autenticado, ou null se já respondeu o erro.
export async function exigirUsuario(req, res) {
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
    return await getAuth().verifyIdToken(token);
  } catch (erro) {
    console.warn('[auth] Token recusado:', erro?.code || erro?.message);
    res.status(401).json({ error: 'Sua sessão expirou. Entre novamente para continuar.' });
    return null;
  }
}
