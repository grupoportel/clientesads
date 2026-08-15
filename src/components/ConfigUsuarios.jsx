import { useState } from 'react';
import { PAPEIS, rotuloPapel, corPapel } from '../papeis';

// Chamadas ao endpoint de usuários com o token de sessão junto
async function chamarApi(metodo, dados) {
  const { auth } = await import('../firebase');
  const usuario = auth.currentUser;
  if (!usuario) throw new Error('Faça login novamente.');
  const token = await usuario.getIdToken();

  const resposta = await fetch('/api/usuarios', {
    method: metodo,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(dados),
  });
  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(corpo.error || 'Falha na operação.');
  return corpo;
}

export default function ConfigUsuarios({ usuarios = [], uidAtual, primeiraConfiguracao }) {
  const [convidando, setConvidando] = useState(false);
  const [form, setForm] = useState({ nome: '', email: '', role: 'Editor' });
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [linkGerado, setLinkGerado] = useState(null);

  const convidar = async () => {
    if (!form.email.trim()) { setErro('Informe o e-mail.'); return; }
    setOcupado(true); setErro(''); setLinkGerado(null);
    try {
      const r = await chamarApi('POST', form);
      setLinkGerado({ email: r.email, link: r.linkSenha });
      setForm({ nome: '', email: '', role: 'Editor' });
      setConvidando(false);
    } catch (e) {
      setErro(e.message);
    } finally {
      setOcupado(false);
    }
  };

  const trocarPapel = async (u, role) => {
    setErro('');
    try {
      await chamarApi('PATCH', { uid: u.uid || u.id, role });
    } catch (e) {
      setErro(e.message);
    }
  };

  const remover = async (u) => {
    if (!window.confirm(
      `Remover o acesso de ${u.nome || u.email}?\n\n` +
      'A conta é apagada e a pessoa deixa de conseguir entrar. ' +
      'Os leads e tarefas dela continuam onde estão.'
    )) return;
    setErro('');
    try {
      await chamarApi('DELETE', { uid: u.uid || u.id });
    } catch (e) {
      setErro(e.message);
    }
  };

  const admins = usuarios.filter(u => u.role === 'Admin').length;

  return (
    <div className="crm-card" style={{ maxWidth: 860 }}>
      <div className="crm-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <div className="crm-card-title">👥 Usuários do Sistema</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4, maxWidth: 520, lineHeight: 1.55 }}>
            Cada pessoa com login próprio. Sem isso, a linha do tempo registra
            todas as ações com o mesmo nome, e não dá para saber quem fez o quê.
          </div>
        </div>
        {!convidando && (
          <button className="btn btn-primary" style={{ fontSize: 12.5, flexShrink: 0 }} onClick={() => setConvidando(true)}>
            + Convidar
          </button>
        )}
      </div>

      {/* Primeira configuração: enquanto ninguém está cadastrado, todo mundo é Admin */}
      {primeiraConfiguracao && (
        <div style={{
          background: 'rgba(250,204,21,0.1)', border: '1px solid rgba(250,204,21,0.35)',
          borderRadius: 10, padding: '13px 16px', marginBottom: 16,
          fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.6,
        }}>
          <strong style={{ color: 'var(--yellow)' }}>⚠️ Nenhum usuário cadastrado ainda.</strong><br />
          Enquanto esta lista estiver vazia, <strong>qualquer pessoa que conseguir entrar tem
          acesso total</strong> — é o que permite você fazer o primeiro cadastro. Convide-se
          como Administrador para fechar essa porta.
        </div>
      )}

      {erro && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 8, padding: '10px 13px', marginBottom: 14,
          fontSize: 12.5, color: 'var(--red)',
        }}>
          ⚠️ {erro}
        </div>
      )}

      {/* Link de definição de senha */}
      {linkGerado && (
        <div style={{
          background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)',
          borderRadius: 10, padding: '13px 16px', marginBottom: 16,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--green)', marginBottom: 6 }}>
            ✅ Conta criada para {linkGerado.email}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 9, lineHeight: 1.55 }}>
            Mande este link para a pessoa definir a própria senha. Ele é pessoal e
            expira — nenhuma senha trafega por e-mail.
          </div>
          <div style={{
            display: 'flex', gap: 8, alignItems: 'center', background: 'var(--surface2)',
            border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px',
          }}>
            <input
              readOnly
              value={linkGerado.link}
              onFocus={e => e.target.select()}
              style={{
                flex: 1, minWidth: 0, background: 'transparent', border: 'none',
                color: 'var(--text2)', fontSize: 11.5, fontFamily: "'DM Mono', monospace", outline: 'none',
              }}
            />
            <button
              className="btn btn-ghost"
              style={{ fontSize: 11.5, padding: '4px 10px', flexShrink: 0 }}
              onClick={() => navigator.clipboard?.writeText(linkGerado.link)}
            >
              Copiar
            </button>
          </div>
          <button
            onClick={() => setLinkGerado(null)}
            style={{ background: 'transparent', border: 'none', color: 'var(--text3)', fontSize: 11.5, cursor: 'pointer', marginTop: 9, padding: 0 }}
          >
            Fechar
          </button>
        </div>
      )}

      {/* Formulário de convite */}
      {convidando && (
        <div style={{
          background: 'var(--surface2)', border: '1px solid var(--border)',
          borderRadius: 10, padding: 16, marginBottom: 16,
        }}>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Nome</label>
              <input
                className="form-control" autoFocus
                value={form.nome}
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                placeholder="Vitor Portel"
              />
            </div>
            <div className="form-group">
              <label className="form-label">E-mail <span style={{ color: 'var(--red)' }}>*</span></label>
              <input
                className="form-control" type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="vitor@grupoportel.com"
                onKeyDown={e => e.key === 'Enter' && convidar()}
              />
            </div>
            <div className="form-group full">
              <label className="form-label">Papel</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {PAPEIS.map(p => (
                  <label
                    key={p.valor}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 9, cursor: 'pointer',
                      padding: '9px 11px', borderRadius: 8,
                      background: form.role === p.valor ? 'rgba(0,208,223,0.08)' : 'transparent',
                      border: `1px solid ${form.role === p.valor ? 'rgba(0,208,223,0.3)' : 'var(--border)'}`,
                    }}
                  >
                    <input
                      type="radio" name="papel" value={p.valor}
                      checked={form.role === p.valor}
                      onChange={() => setForm(f => ({ ...f, role: p.valor }))}
                      style={{ marginTop: 2, cursor: 'pointer' }}
                    />
                    <span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: p.cor }}>{p.rotulo}</span>
                      <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text3)', marginTop: 2, lineHeight: 1.45 }}>
                        {p.descricao}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button className="btn btn-primary" onClick={convidar} disabled={ocupado}>
              {ocupado ? '⏳ Criando…' : '✉️ Criar acesso'}
            </button>
            <button className="btn btn-ghost" onClick={() => { setConvidando(false); setErro(''); }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      {usuarios.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--text3)', fontSize: 13 }}>
          Nenhum usuário cadastrado.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {usuarios.map(u => {
            const ehVoce = (u.uid || u.id) === uidAtual;
            const unicoAdmin = u.role === 'Admin' && admins <= 1;
            return (
              <div
                key={u.uid || u.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                  padding: '12px 15px', borderRadius: 10,
                  background: 'var(--surface2)', border: '1px solid var(--border)',
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
                  color: '#fff', fontSize: 13, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {(u.nome || u.email || '?').charAt(0).toUpperCase()}
                </div>

                <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>
                    {u.nome || u.email}
                    {ehVoce && <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 400 }}> · você</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {u.email}
                  </div>
                </div>

                <select
                  className="form-control"
                  style={{ width: 'auto', fontSize: 12, padding: '5px 9px', color: corPapel(u.role) }}
                  value={u.role || 'Viewer'}
                  onChange={e => trocarPapel(u, e.target.value)}
                  disabled={unicoAdmin}
                  title={unicoAdmin ? 'Promova outra pessoa antes de mudar o único administrador' : rotuloPapel(u.role)}
                >
                  {PAPEIS.map(p => <option key={p.valor} value={p.valor}>{p.rotulo}</option>)}
                </select>

                <button
                  className="btn btn-danger"
                  style={{ fontSize: 11.5, padding: '4px 10px', opacity: ehVoce ? 0.4 : 1 }}
                  onClick={() => remover(u)}
                  disabled={ehVoce}
                  title={ehVoce ? 'Você não pode remover o seu próprio acesso' : 'Remover acesso'}
                >
                  🗑
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
