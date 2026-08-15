// Papéis de acesso. Pura, sem Firebase, para poder ser testada.
//
// Admin, Editor e Viewer apareciam na tela de Configurações, mas nenhuma linha
// do app consultava o papel — todo mundo podia tudo. Aqui as permissões viram
// perguntas que a interface pode fazer, e as regras do banco seguem a mesma
// lógica do lado do servidor.

export const PAPEIS = [
  {
    valor: 'Admin',
    rotulo: 'Administrador',
    cor: 'var(--purple)',
    descricao: 'Faz tudo, inclusive convidar pessoas e mudar as configurações.',
  },
  {
    valor: 'Editor',
    rotulo: 'Editor',
    cor: '#3b82f6',
    descricao: 'Trabalha os leads no dia a dia. Não mexe em configurações nem em usuários.',
  },
  {
    valor: 'Viewer',
    rotulo: 'Somente leitura',
    cor: 'var(--text3)',
    descricao: 'Vê tudo, não altera nada. Útil para sócio ou contador acompanhar.',
  },
];

export const rotuloPapel = (p) => PAPEIS.find(x => x.valor === p)?.rotulo || 'Sem papel';
export const corPapel = (p) => PAPEIS.find(x => x.valor === p)?.cor || 'var(--text3)';

/**
 * Descobre o papel de quem está usando o sistema.
 *
 * Enquanto nenhum usuário estiver cadastrado, quem entra é tratado como Admin:
 * é o único jeito de o primeiro cadastro acontecer, e as regras do banco fazem
 * exatamente a mesma concessão. A partir do primeiro registro o portão fecha —
 * quem não tem registro não é ninguém.
 */
export function papelDoUsuario(uid, usuarios = []) {
  const primeiraConfiguracao = usuarios.length === 0;
  if (primeiraConfiguracao) {
    return { papel: 'Admin', primeiraConfiguracao: true, registrado: false };
  }

  const registro = usuarios.find(u => u.uid === uid || u.id === uid);
  if (!registro) {
    return { papel: null, primeiraConfiguracao: false, registrado: false };
  }

  return { papel: registro.role || 'Viewer', primeiraConfiguracao: false, registrado: true };
}

/** Pode alterar dados: leads, clientes, tarefas, propostas, conversas. */
export const podeEditar = (papel) => papel === 'Admin' || papel === 'Editor';

/** Pode abrir Configurações e mexer em pipeline, metas, automações, usuários. */
export const podeAdministrar = (papel) => papel === 'Admin';

/** Pode ver o CRM. Sem papel nenhum, não entra. */
export const podeVer = (papel) => papel === 'Admin' || papel === 'Editor' || papel === 'Viewer';

/**
 * O que dizer a quem tentou fazer algo além do seu papel.
 * Mensagem específica evita o "não funcionou e não sei por quê".
 */
export function motivoBloqueio(papel, acao = 'editar') {
  if (!papel) return 'Seu acesso ainda não foi liberado. Peça a um administrador para incluir você.';
  if (papel === 'Viewer') return `Seu acesso é somente leitura, então não dá para ${acao}.`;
  if (papel === 'Editor') return 'Só um administrador pode mexer nas configurações.';
  return '';
}
