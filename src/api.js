import { auth } from './firebase';

// Toda chamada às funções em /api passa por aqui: anexa o token de sessão do
// Firebase para que o servidor saiba quem está pedindo o envio.
export async function apiPost(caminho, dados) {
  const usuario = auth.currentUser;
  if (!usuario) throw new Error('Faça login para continuar.');

  const token = await usuario.getIdToken();

  const resposta = await fetch(caminho, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(dados),
  });

  const corpo = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    throw new Error(corpo.error || `Falha na comunicação com o servidor (${resposta.status}).`);
  }
  return corpo;
}
