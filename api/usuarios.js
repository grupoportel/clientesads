// api/usuarios.js
// Gestão de usuários do CRM. Só um Admin pode chamar.
//
// Antes disso, "Convidar Usuário" abria dois window.prompt e gravava um
// registro no banco — nenhuma conta era criada no Firebase Auth e nenhum
// convite era enviado, então a pessoa convidada simplesmente não conseguia
// entrar. Aqui a conta é criada de verdade.

import { getAuth } from 'firebase-admin/auth';
import { exigirUsuario, obterBanco, iniciarAdmin, comPrazo, explicarErroDeCredencial } from './_auth.js';

const PAPEIS = ['Admin', 'Editor', 'Viewer'];

/**
 * Confere se quem chamou pode administrar usuários.
 *
 * Enquanto não existir nenhum usuário cadastrado, qualquer pessoa autenticada
 * é tratada como Admin — é o único jeito de o primeiro cadastro acontecer.
 * A partir do primeiro registro, o portão fecha: quem não tem registro não
 * administra nada. As regras do banco seguem exatamente a mesma lógica.
 */
async function exigirAdmin(db, uid, res) {
  const snap = await comPrazo(db.ref('crm_data/usuarios').once('value'));
  const usuarios = snap.val();

  if (!usuarios || Object.keys(usuarios).length === 0) {
    return { ok: true, primeiroAcesso: true };
  }

  const papel = usuarios[uid]?.role;
  if (papel !== 'Admin') {
    res.status(403).json({ error: 'Só um administrador pode gerenciar usuários.' });
    return { ok: false };
  }
  return { ok: true, primeiroAcesso: false };
}

export default async function handler(req, res) {
  const usuario = await exigirUsuario(req, res);
  if (!usuario) return;

  let db;
  try {
    iniciarAdmin();
    db = obterBanco();
  } catch (erro) {
    console.error('[usuarios] Firebase Admin indisponível:', erro.message);
    return res.status(500).json({ error: 'Servidor não configurado para gerenciar usuários.' });
  }

  // A checagem de papel é a primeira coisa a tocar o banco, então é aqui que
  // uma credencial revogada aparece. Sem este try, o erro escapava do handler
  // e virava um 500 sem texto — ou pior, ficava pendurado até o timeout.
  let permissao;
  try {
    permissao = await exigirAdmin(db, usuario.uid, res);
  } catch (erro) {
    console.error('[usuarios] Não consegui ler os usuários:', erro.message);
    return res.status(500).json({
      error: explicarErroDeCredencial(erro) || 'Não foi possível consultar as permissões.',
    });
  }
  if (!permissao.ok) return;

  // ── Criar (convidar) ──
  if (req.method === 'POST') {
    const { email, nome, role } = req.body || {};

    if (!email || !String(email).includes('@')) {
      return res.status(400).json({ error: 'Informe um e-mail válido.' });
    }
    if (role && !PAPEIS.includes(role)) {
      return res.status(400).json({ error: 'Papel inválido.' });
    }

    const emailLimpo = String(email).trim().toLowerCase();
    const papel = role || 'Viewer';

    try {
      const auth = getAuth();
      let conta;

      // Reaproveita a conta se ela já existir: o mesmo e-mail convidado duas
      // vezes deve virar um registro só, não um erro sem explicação.
      try {
        conta = await auth.getUserByEmail(emailLimpo);
      } catch {
        conta = await auth.createUser({
          email: emailLimpo,
          emailVerified: false,
          displayName: nome || emailLimpo.split('@')[0],
          // Senha aleatória que ninguém conhece: a pessoa define a dela pelo
          // link de redefinição. Assim nenhuma senha trafega por e-mail.
          password: `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}A1!`,
        });
      }

      const agora = new Date().toISOString();
      await comPrazo(db.ref(`crm_data/usuarios/${conta.uid}`).update({
        id: conta.uid,
        uid: conta.uid,
        nome: nome || conta.displayName || emailLimpo.split('@')[0],
        email: emailLimpo,
        role: papel,
        convidadoEm: agora,
        convidadoPor: usuario.email || usuario.uid,
      }));

      // O link de redefinição é o convite: quem clica define a própria senha.
      const linkSenha = await auth.generatePasswordResetLink(emailLimpo);

      console.log(`[usuarios] ${usuario.email} convidou ${emailLimpo} como ${papel}`);
      return res.status(201).json({
        success: true,
        uid: conta.uid,
        email: emailLimpo,
        role: papel,
        linkSenha,
        primeiroAcesso: permissao.primeiroAcesso,
      });

    } catch (erro) {
      console.error('[usuarios] Falha ao convidar:', erro);
      const credencial = explicarErroDeCredencial(erro);
      return res.status(500).json({ error: credencial || erro.message || 'Não foi possível criar o usuário.' });
    }
  }

  // ── Alterar papel ──
  if (req.method === 'PATCH') {
    const { uid, role } = req.body || {};
    if (!uid || !PAPEIS.includes(role)) {
      return res.status(400).json({ error: 'Informe o usuário e um papel válido.' });
    }

    // Rebaixar o único Admin deixaria o CRM sem ninguém para administrá-lo
    if (role !== 'Admin') {
      const snap = await comPrazo(db.ref('crm_data/usuarios').once('value'));
      const todos = snap.val() || {};
      const admins = Object.values(todos).filter(u => u.role === 'Admin');
      if (admins.length <= 1 && todos[uid]?.role === 'Admin') {
        return res.status(400).json({
          error: 'Este é o único administrador. Promova outra pessoa antes de rebaixá-lo.',
        });
      }
    }

    await comPrazo(db.ref(`crm_data/usuarios/${uid}`).update({ role }));
    return res.status(200).json({ success: true, uid, role });
  }

  // ── Remover acesso ──
  if (req.method === 'DELETE') {
    const uid = req.body?.uid || req.query?.uid;
    if (!uid) return res.status(400).json({ error: 'Informe o usuário.' });

    if (uid === usuario.uid) {
      return res.status(400).json({ error: 'Você não pode remover o seu próprio acesso.' });
    }

    try {
      await getAuth().deleteUser(uid);
    } catch (erro) {
      // A conta pode já não existir no Auth; o registro no banco sai de todo jeito
      console.warn('[usuarios] Conta já ausente no Auth:', erro?.code);
    }
    await comPrazo(db.ref(`crm_data/usuarios/${uid}`).remove());

    console.log(`[usuarios] ${usuario.email} removeu o acesso de ${uid}`);
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Método não permitido' });
}
