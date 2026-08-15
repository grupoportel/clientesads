import { useState } from 'react';
import { auth } from './firebase';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';

// Antes, qualquer falha virava "E-mail ou senha incorretos" — inclusive queda
// de rede, o que mandava a pessoa conferir a senha em vez da internet.
const MENSAGENS_DE_ERRO = {
  'auth/invalid-email':           'Esse e-mail não parece válido. Confira o endereço.',
  'auth/user-disabled':           'Esta conta foi desativada. Fale com o administrador.',
  'auth/user-not-found':          'E-mail ou senha incorretos.',
  'auth/wrong-password':          'E-mail ou senha incorretos.',
  'auth/invalid-credential':      'E-mail ou senha incorretos.',
  'auth/too-many-requests':       'Muitas tentativas seguidas. Aguarde alguns minutos ou redefina a senha.',
  'auth/network-request-failed':  'Sem conexão com o servidor. Verifique sua internet e tente de novo.',
  'auth/internal-error':          'O servidor de login falhou. Tente novamente em instantes.',
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [enviandoReset, setEnviandoReset] = useState(false);

  const fazerLogin = (e) => {
    e.preventDefault();
    if (entrando) return; // impede o clique repetido enquanto a requisição corre
    setErro('');
    setAviso('');
    setEntrando(true);

    signInWithEmailAndPassword(auth, email, senha)
      .catch((error) => {
        console.error('[Login]', error?.code);
        setErro(MENSAGENS_DE_ERRO[error?.code] || 'Não foi possível entrar. Tente novamente.');
      })
      .finally(() => setEntrando(false));
    // Em caso de sucesso o App troca de tela sozinho pelo onAuthStateChanged
  };

  const recuperarSenha = () => {
    if (enviandoReset) return;
    setErro('');
    setAviso('');

    const destino = email.trim();
    if (!destino) {
      setErro('Digite o seu e-mail no campo acima para receber o link de redefinição.');
      return;
    }

    setEnviandoReset(true);
    sendPasswordResetEmail(auth, destino)
      .then(() => {
        // Mensagem igual mesmo quando o e-mail não existe: dizer "essa conta
        // não existe" entregaria a estranhos quais endereços têm cadastro.
        setAviso(`Se houver uma conta para ${destino}, o link de redefinição chegou na caixa de entrada. Verifique também o spam.`);
      })
      .catch((error) => {
        console.error('[Login] reset:', error?.code);
        if (error?.code === 'auth/user-not-found') {
          setAviso(`Se houver uma conta para ${destino}, o link de redefinição chegou na caixa de entrada. Verifique também o spam.`);
        } else {
          setErro(MENSAGENS_DE_ERRO[error?.code] || 'Não foi possível enviar o link agora. Tente novamente.');
        }
      })
      .finally(() => setEnviandoReset(false));
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--bg)',
      zIndex: 99999, display: 'flex', alignItems: 'center',
      justifyContent: 'center', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* ── Background Effects ── */}
      <div className="bg-grid" />
      <div className="ambient-light-saas" />

      {/* ── Glowing Orb behind card ── */}
      <div style={{
        position: 'absolute',
        width: '340px', height: '340px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,210,223,.12) 0%, transparent 70%)',
        filter: 'blur(60px)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {/* ── Login Card ── */}
      <div style={{
        background: 'var(--surface)',
        padding: '40px',
        borderRadius: '20px',
        border: '1px solid var(--border)',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 0 60px rgba(0,210,223,.08), 0 10px 40px rgba(0,0,0,.8)',
        animation: 'popIn 0.4s cubic-bezier(.34,1.56,.64,1)',
        position: 'relative',
        zIndex: 1,
      }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          {/* Logo */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '8px', marginBottom: '20px',
          }}>
            <span style={{
              width: '9px', height: '9px', borderRadius: '50%',
              background: 'var(--accent)', boxShadow: '0 0 10px var(--accent)',
              display: 'inline-block',
            }} />
            <span style={{
              fontSize: '22px', fontWeight: 700, color: 'var(--accent2)',
              letterSpacing: '-0.5px',
            }}>
              Grupo <span style={{ color: 'var(--text)', fontWeight: 400 }}>Portel</span>
            </span>
          </div>

          {/* Title & Subtitle */}
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            Bem-vindo de volta
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text3)', marginTop: '6px' }}>
            Faça login para acessar o CRM
          </p>
        </div>

        <form onSubmit={fazerLogin}>
          {/* Email Field */}
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label>E-mail</label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
                fontSize: '14px', pointerEvents: 'none', lineHeight: 1,
              }}>📧</span>
              <input
                type="email"
                className="form-control"
                required
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ paddingLeft: '36px' }}
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="form-group" style={{ marginBottom: '8px' }}>
            <label>Senha</label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
                fontSize: '14px', pointerEvents: 'none', lineHeight: 1,
              }}>🔒</span>
              <input
                type="password"
                className="form-control"
                required
                placeholder="••••••••"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                style={{ paddingLeft: '36px' }}
              />
            </div>
          </div>

          {/* Esqueci minha senha */}
          <div style={{ textAlign: 'right', marginBottom: '24px' }}>
            <button
              type="button"
              onClick={recuperarSenha}
              disabled={enviandoReset}
              style={{
                fontSize: '12px', color: 'var(--accent2)',
                background: 'transparent', border: 'none', padding: 0,
                cursor: enviandoReset ? 'default' : 'pointer',
                fontFamily: 'inherit', transition: 'opacity 0.15s',
                opacity: enviandoReset ? 0.6 : 1,
              }}
              onMouseEnter={(e) => { if (!enviandoReset) e.currentTarget.style.opacity = '0.7'; }}
              onMouseLeave={(e) => { if (!enviandoReset) e.currentTarget.style.opacity = '1'; }}
            >
              {enviandoReset ? 'Enviando…' : 'Esqueci minha senha'}
            </button>
          </div>

          {/* Erro */}
          {erro && (
            <div style={{
              color: 'var(--red)', marginBottom: '16px',
              fontSize: '13px', textAlign: 'center', lineHeight: 1.5,
              background: 'rgba(239,68,68,.08)',
              padding: '10px 12px', borderRadius: '8px',
              border: '1px solid rgba(239,68,68,.2)',
            }}>
              {erro}
            </div>
          )}

          {/* Confirmação do link de redefinição */}
          {aviso && (
            <div style={{
              color: 'var(--green)', marginBottom: '16px',
              fontSize: '13px', textAlign: 'center', lineHeight: 1.5,
              background: 'rgba(34,197,94,.08)',
              padding: '10px 12px', borderRadius: '8px',
              border: '1px solid rgba(34,197,94,.25)',
            }}>
              ✉️ {aviso}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={entrando}
            style={{
              width: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: '8px',
              padding: '12px',
              borderRadius: '10px',
              border: 'none',
              cursor: entrando ? 'default' : 'pointer',
              background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 600,
              fontFamily: "'DM Sans', sans-serif",
              boxShadow: '0 4px 16px rgba(0,210,223,.25)',
              transition: 'transform 0.15s, box-shadow 0.15s, opacity 0.15s',
              opacity: entrando ? 0.7 : 1,
            }}
            onMouseEnter={(e) => {
              if (entrando) return;
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,210,223,.35)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,210,223,.25)';
            }}
          >
            {entrando ? '⏳ Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>

      {/* ── Footer ── */}
      <div style={{
        fontSize: '11px', color: 'var(--text3)',
        marginTop: '24px', position: 'relative', zIndex: 1,
      }}>
        © 2026 Grupo Portel · CRM v2.0
      </div>
    </div>
  );
}