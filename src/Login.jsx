import { useState } from 'react';
import { auth } from './firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';

export default function Login() {
  // O React guarda o que é digitado aqui nestas "variáveis" (estados)
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');

  // A função que é chamada quando clicamos em "Entrar"
  const fazerLogin = (e) => {
    e.preventDefault(); // Evita que a página recarregue
    setErro(''); // Limpa erros anteriores

    signInWithEmailAndPassword(auth, email, senha)
      .then(() => {
        console.log("Logado com sucesso!");
        // O App.jsx vai perceber isso automaticamente e mudar a tela
      })
      .catch((error) => {
        console.error(error);
        setErro("E-mail ou senha incorretos.");
      });
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

          {/* Forgot Password Link */}
          <div style={{ textAlign: 'right', marginBottom: '24px' }}>
            <span style={{
              fontSize: '12px', color: 'var(--accent2)',
              cursor: 'pointer', transition: 'opacity 0.15s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              Esqueci minha senha
            </span>
          </div>

          {/* Error Message */}
          {erro && (
            <div style={{
              color: 'var(--red)', marginBottom: '16px',
              fontSize: '13px', textAlign: 'center',
              background: 'rgba(239,68,68,.08)',
              padding: '10px', borderRadius: '8px',
              border: '1px solid rgba(239,68,68,.2)',
            }}>
              {erro}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            style={{
              width: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: '8px',
              padding: '12px',
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
              background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 600,
              fontFamily: "'DM Sans', sans-serif",
              boxShadow: '0 4px 16px rgba(0,210,223,.25)',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,210,223,.35)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,210,223,.25)';
            }}
          >
            Entrar
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