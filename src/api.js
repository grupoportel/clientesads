import { getToken as obterTokenAppCheck } from 'firebase/app-check';
import { appCheck, auth } from './firebase';

// Toda chamada autenticada às funções em /api passa por aqui: anexa tanto a
// identidade da pessoa quanto, quando configurado, a prova de que a chamada
// veio do CRM legítimo.
export async function apiRequest(caminho, { metodo = 'POST', dados } = {}) {
  const usuario = auth.currentUser;
  if (!usuario) throw new Error('Faça login para continuar.');

  const token = await usuario.getIdToken();
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  if (appCheck) {
    try {
      const respostaAppCheck = await obterTokenAppCheck(appCheck, false);
      headers['X-Firebase-AppCheck'] = respostaAppCheck.token;
    } catch (erro) {
      console.warn('[app-check] Não foi possível obter o token:', erro?.code || erro?.message);
      throw new Error(
        'Não foi possível validar este navegador. Recarregue a página e tente novamente.',
        { cause: erro },
      );
    }
  }

  const resposta = await fetch(caminho, {
    method: metodo,
    headers,
    body: dados === undefined ? undefined : JSON.stringify(dados),
  });

  const corpo = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    throw new Error(corpo.error || `Falha na comunicação com o servidor (${resposta.status}).`);
  }
  return corpo;
}

export function apiPost(caminho, dados) {
  return apiRequest(caminho, { metodo: 'POST', dados });
}
