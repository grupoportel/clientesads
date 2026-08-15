import { useSyncExternalStore } from 'react';

// Saber a largura da tela em JS é necessário onde CSS não resolve: trocar uma
// tabela de 23 colunas por cartões, ou mostrar uma coluna de cada vez no chat.
// O resto do layout é resolvido por media query, que não custa re-render.
//
// useSyncExternalStore em vez de useState + useEffect: sem setState dentro de
// efeito, e sem o piscar de renderizar a versão errada antes de corrigir.

const LARGURA_CELULAR = 768;
const LARGURA_TABLET = 1024;

function criarConsulta(largura) {
  const consulta = `(max-width: ${largura - 1}px)`;

  const assinar = (aoMudar) => {
    if (typeof window === 'undefined' || !window.matchMedia) return () => {};
    const mq = window.matchMedia(consulta);
    mq.addEventListener('change', aoMudar);
    return () => mq.removeEventListener('change', aoMudar);
  };

  const ler = () => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(consulta).matches;
  };

  return { assinar, ler };
}

const CELULAR = criarConsulta(LARGURA_CELULAR);
const TABLET = criarConsulta(LARGURA_TABLET);

/** true abaixo de 768px — onde tabela e colunas lado a lado deixam de caber. */
export function useTelaEstreita() {
  return useSyncExternalStore(CELULAR.assinar, CELULAR.ler, () => false);
}

/** true abaixo de 1024px — onde o menu lateral vira gaveta. */
export function useTelaMedia() {
  return useSyncExternalStore(TABLET.assinar, TABLET.ler, () => false);
}
