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
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
      <div style={{ background: 'var(--surface)', padding: '40px', borderRadius: '16px', border: '1px solid var(--border)', width: '100%', maxWidth: '400px', boxShadow: '0 10px 40px rgba(0,0,0,0.8)' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          {/* Pode colocar sua imagem/logo aqui depois se quiser */}
          <h2 style={{ fontSize: '20px', color: 'var(--text)' }}>Acesso ao CRM</h2>
          <p style={{ fontSize: '13px', color: 'var(--text3)', marginTop: '4px' }}>Faça login para continuar</p>
        </div>
        
        <form onSubmit={fazerLogin}>
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label>E-mail</label>
            <input 
              type="email" 
              className="form-control" 
              required 
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)} // Atualiza a variável email ao digitar
            />
          </div>
          
          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label>Senha</label>
            <input 
              type="password" 
              className="form-control" 
              required 
              placeholder="••••••••"
              value={senha}
              onChange={(e) => setSenha(e.target.value)} // Atualiza a variável senha ao digitar
            />
          </div>

          {/* Se tiver erro, ele mostra esta mensagem vermelha */}
          {erro && (
            <div style={{ color: 'var(--red)', marginBottom: '16px', fontSize: '13px', textAlign: 'center' }}>
              {erro}
            </div>
          )}

          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '14px' }}>
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}