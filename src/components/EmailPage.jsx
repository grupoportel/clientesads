import { useState, useEffect, useRef, useMemo } from 'react';
import { database } from '../firebase';
import { ref, onValue, update, push, set } from 'firebase/database';
import { apiPost } from '../api';
import SeletorModelo from './SeletorModelo';
import EscreverComIA from './EscreverComIA';

// ── Helpers ──────────────────────────────────────────────────────────────────
const formatarData = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const hoje = new Date();
  if (d.toDateString() === hoje.toDateString()) {
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};

const getIniciais = (nome = '') => {
  const partes = nome.trim().split(' ');
  return (partes[0]?.[0] || '') + (partes[1]?.[0] || partes[0]?.[1] || '');
};

const getCor = (str = '') => {
  const cores = ['#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#10b981'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return cores[Math.abs(hash) % cores.length];
};

// ── Componente Principal ──────────────────────────────────────────────────────
export default function EmailPage({ leads = [], modelos = [], empresa = '', meuNome = '' }) {
  const [threads, setThreads] = useState([]);
  const [threadAtiva, setThreadAtiva] = useState(null);
  const [filtro, setFiltro] = useState('inbox'); // inbox | enviados | todos
  const [busca, setBusca] = useState('');
  const [redigindo, setRedigindo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  // Form de novo e-mail
  const [para, setPara] = useState('');
  const [assunto, setAssunto] = useState('');
  const [corpo, setCorpo] = useState('');

  // Form de resposta
  const [respostaTexto, setRespostaTexto] = useState('');
  const [respondendo, setRespondendo] = useState(false);

  const fimMensagensRef = useRef(null);
  const containerRef = useRef(null);

  // ── Carregar threads do Firebase ──────────────────────────────────────────
  useEffect(() => {
    const emailsRef = ref(database, 'crm_data/emails');
    const unsub = onValue(emailsRef, (snap) => {
      const data = snap.val();
      if (data) {
        const lista = Object.entries(data).map(([id, t]) => ({ ...t, id }));
        lista.sort((a, b) => new Date(b.ultimaAt) - new Date(a.ultimaAt));
        setThreads(lista);
      } else {
        setThreads([]);
      }
    });
    return () => unsub();
  }, []);

  // ── Carregar mensagens da thread ativa ────────────────────────────────────
  // A carga guarda de qual thread as mensagens são, para trocar de conversa
  // mostrar vazio no mesmo render em vez de depender de um setState de limpeza
  // dentro do efeito.
  const [carga, setCarga] = useState({ id: null, lista: [] });
  const idAtivo = threadAtiva?.id ?? null;
  const mensagens = useMemo(() => (carga.id === idAtivo ? carga.lista : []), [carga, idAtivo]);

  useEffect(() => {
    if (!idAtivo) return;

    const unsub = onValue(ref(database, `crm_data/emails/${idAtivo}/mensagens`), (snap) => {
      const data = snap.val();
      const lista = data
        ? Object.entries(data)
            .map(([id, m]) => ({ ...m, id }))
            .sort((a, b) => new Date(a.criadoEm) - new Date(b.criadoEm))
        : [];
      setCarga({ id: idAtivo, lista });
    });

    return () => unsub();
  }, [idAtivo]);

  // ── Marcar como lido ao abrir ─────────────────────────────────────────────
  const naoLidasAtivo = threadAtiva?.naoLidas || 0;
  useEffect(() => {
    if (!idAtivo || naoLidasAtivo <= 0) return;
    update(ref(database, `crm_data/emails/${idAtivo}`), { naoLidas: 0 });
  }, [idAtivo, naoLidasAtivo]);

  // ── Scroll para o fim ─────────────────────────────────────────────────────
  useEffect(() => {
    fimMensagensRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  // ── Adaptar tamanho ao container ──────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const resizeToFit = () => {
      const top = el.getBoundingClientRect().top;
      el.style.height = `${window.innerHeight - top - 0}px`;
    };
    resizeToFit();
    window.addEventListener('resize', resizeToFit);
    return () => window.removeEventListener('resize', resizeToFit);
  }, []);

  // ── Filtrar threads ───────────────────────────────────────────────────────
  const threadsFiltradas = threads.filter((t) => {
    const matchFiltro =
      filtro === 'todos' ||
      // Recebidos: threads criadas por clientes OU threads enviadas que receberam respostas
      (filtro === 'inbox' && (t.origem === 'entrada' || t.temResposta === true || t.naoLidas > 0)) ||
      // Enviados: apenas threads que saíram e ainda não tiveram resposta
      (filtro === 'enviados' && t.origem === 'saida' && !t.temResposta);
    const matchBusca =
      !busca ||
      (t.nome || '').toLowerCase().includes(busca.toLowerCase()) ||
      (t.assunto || '').toLowerCase().includes(busca.toLowerCase());
    return matchFiltro && matchBusca;
  });

  // ── Enviar novo e-mail ────────────────────────────────────────────────────
  const enviarEmail = async () => {
    if (!para || !assunto || !corpo) {
      setErro('Preencha destinatário, assunto e mensagem.');
      return;
    }
    setEnviando(true);
    setErro('');
    try {
      await apiPost('/api/send-email', { para, assunto, corpo });

      // Salvar no Firebase
      const novaThreadRef = push(ref(database, 'crm_data/emails'));
      const threadId = novaThreadRef.key;
      const agora = new Date().toISOString();
      await set(novaThreadRef, {
        id: threadId,
        nome: para,
        email: para,
        assunto,
        ultimaMensagem: corpo.substring(0, 80),
        ultimaAt: agora,
        naoLidas: 0,
        origem: 'saida',
      });
      const msgRef = push(ref(database, `crm_data/emails/${threadId}/mensagens`));
      await set(msgRef, {
        texto: corpo,
        assunto,
        criadoEm: agora,
        origem: 'saida',
        de: 'timeportel@gmail.com',
        para,
      });

      setPara(''); setAssunto(''); setCorpo('');
      setRedigindo(false);
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviando(false);
    }
  };

  // ── Responder e-mail ──────────────────────────────────────────────────────
  const responderEmail = async () => {
    if (!respostaTexto || !threadAtiva) return;
    setRespondendo(true);
    setErro('');
    try {
      await apiPost('/api/send-email', {
        para: threadAtiva.email,
        assunto: `Re: ${threadAtiva.assunto}`,
        corpo: respostaTexto,
      });

      const agora = new Date().toISOString();
      const msgRef = push(ref(database, `crm_data/emails/${threadAtiva.id}/mensagens`));
      await set(msgRef, {
        texto: respostaTexto,
        assunto: `Re: ${threadAtiva.assunto}`,
        criadoEm: agora,
        origem: 'saida',
        de: 'timeportel@gmail.com',
        para: threadAtiva.email,
      });
      await update(ref(database, `crm_data/emails/${threadAtiva.id}`), {
        ultimaMensagem: respostaTexto.substring(0, 80),
        ultimaAt: agora,
      });
      setRespostaTexto('');
    } catch (e) {
      setErro(e.message);
    } finally {
      setRespondendo(false);
    }
  };

  // ── Aviso de erro reaproveitado nas duas áreas de escrita ─────────────────
  const avisoErro = erro ? (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '8px',
      background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
      borderRadius: '8px', padding: '10px 12px',
      color: 'var(--red)', fontSize: '12.5px', lineHeight: 1.5,
    }}>
      <span style={{ flexShrink: 0 }}>⚠️</span>
      <span style={{ flex: 1 }}>{erro}</span>
      <button onClick={() => setErro('')} style={{
        background: 'transparent', border: 'none', color: 'var(--red)',
        cursor: 'pointer', fontSize: '15px', lineHeight: 1, padding: 0, flexShrink: 0,
      }} title="Dispensar">×</button>
    </div>
  ) : null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} style={{ display: 'flex', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* ── COLUNA 1: LISTA DE THREADS ── */}
      <div style={{
        width: '320px', flexShrink: 0,
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        background: 'var(--surface)',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>✉️</span>
            <span style={{ fontWeight: 700, fontSize: '15px' }}>E-mails</span>
            {threads.filter(t => t.naoLidas > 0).length > 0 && (
              <span style={{
                background: 'var(--red)', color: '#fff', fontSize: '11px',
                padding: '1px 7px', borderRadius: '10px', fontWeight: 700,
              }}>
                {threads.filter(t => t.naoLidas > 0).length}
              </span>
            )}
          </div>
          <button
            onClick={() => { setRedigindo(true); setThreadAtiva(null); }}
            style={{
              background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
              color: '#fff', border: 'none', borderRadius: '8px',
              padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '4px',
            }}
          >
            ✏️ Novo
          </button>
        </div>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: '4px', padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
          {['inbox', 'enviados', 'todos'].map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              style={{
                flex: 1, padding: '5px', fontSize: '11px', fontWeight: 600,
                borderRadius: '6px', border: 'none', cursor: 'pointer',
                background: filtro === f ? 'var(--accent)' : 'var(--surface2)',
                color: filtro === f ? '#fff' : 'var(--text3)',
                transition: 'all 0.15s',
                textTransform: 'capitalize',
              }}
            >
              {f === 'inbox' ? '📥 Recebidos' : f === 'enviados' ? '📤 Enviados' : '📋 Todos'}
            </button>
          ))}
        </div>

        {/* Busca */}
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'var(--surface2)', borderRadius: '8px',
            padding: '6px 10px',
          }}>
            <span style={{ fontSize: '13px', color: 'var(--text3)' }}>🔍</span>
            <input
              type="text"
              placeholder="Buscar e-mails..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              style={{
                background: 'transparent', border: 'none', outline: 'none',
                color: 'var(--text)', fontSize: '13px', flex: 1,
              }}
            />
          </div>
        </div>

        {/* Lista */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {threadsFiltradas.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text3)', fontSize: '13px' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>📭</div>
              Nenhum e-mail aqui ainda
            </div>
          ) : threadsFiltradas.map((t) => {
            const ativa = threadAtiva?.id === t.id;
            return (
              <div
                key={t.id}
                onClick={() => { setThreadAtiva(t); setRedigindo(false); }}
                style={{
                  display: 'flex', gap: '10px', padding: '12px 16px',
                  borderBottom: '1px solid var(--border)', cursor: 'pointer',
                  background: ativa ? 'rgba(0,210,223,0.08)' : 'transparent',
                  borderLeft: ativa ? '3px solid var(--accent)' : '3px solid transparent',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (!ativa) e.currentTarget.style.background = 'var(--surface2)'; }}
                onMouseLeave={e => { if (!ativa) e.currentTarget.style.background = 'transparent'; }}
              >
                {/* Avatar */}
                <div style={{
                  width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
                  background: getCor(t.nome || t.email || ''),
                  color: '#fff', fontWeight: 700, fontSize: '13px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {getIniciais(t.nome || t.email || '?').toUpperCase()}
                </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <span style={{
                      fontSize: '13px', fontWeight: t.naoLidas > 0 ? 700 : 500,
                      color: t.naoLidas > 0 ? 'var(--text)' : 'var(--text2)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      maxWidth: '140px',
                    }}>
                      {t.nome || t.email}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text3)', flexShrink: 0 }}>
                      {formatarData(t.ultimaAt)}
                    </span>
                  </div>
                  <div style={{
                    fontSize: '12px', fontWeight: t.naoLidas > 0 ? 600 : 400,
                    color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap', marginBottom: '3px',
                  }}>
                    {t.assunto}
                  </div>
                  <div style={{
                    fontSize: '11px', color: 'var(--text3)', overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {t.ultimaMensagem}
                  </div>
                </div>
                {t.naoLidas > 0 && (
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: 'var(--accent)', flexShrink: 0, alignSelf: 'center',
                  }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── COLUNA 2: ÁREA DE LEITURA / REDAÇÃO ── */}
      {redigindo ? (
        // ── REDIGIR NOVO E-MAIL ──
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <button
              onClick={() => setRedigindo(false)}
              style={{
                background: 'var(--surface2)', border: '1px solid var(--border)',
                color: 'var(--text2)', borderRadius: '8px', padding: '6px 12px',
                fontSize: '13px', cursor: 'pointer',
              }}
            >
              ← Voltar
            </button>
            <h2 style={{ fontWeight: 700, fontSize: '16px', margin: 0 }}>Novo E-mail</h2>
          </div>

          {[
            { label: 'Para:', value: para, setter: setPara, placeholder: 'email@cliente.com', type: 'email' },
            { label: 'Assunto:', value: assunto, setter: setAssunto, placeholder: 'Digite o assunto...', type: 'text' },
          ].map(f => (
            <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text3)', width: '60px', flexShrink: 0 }}>{f.label}</span>
              <input
                type={f.type}
                value={f.value}
                onChange={e => f.setter(e.target.value)}
                placeholder={f.placeholder}
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  color: 'var(--text)', fontSize: '14px',
                }}
              />
            </div>
          ))}

          <textarea
            value={corpo}
            onChange={e => setCorpo(e.target.value)}
            placeholder="Escreva sua mensagem aqui..."
            style={{
              flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)',
              borderRadius: '10px', padding: '16px', color: 'var(--text)',
              fontSize: '14px', resize: 'none', outline: 'none', lineHeight: 1.6,
            }}
          />

          {avisoErro}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', alignItems: 'center' }}>
            <SeletorModelo
              modelos={modelos}
              canal="email"
              lead={leads.find(l => l.email && l.email.toLowerCase() === para.trim().toLowerCase()) || null}
              empresa={empresa}
              meuNome={meuNome}
              onEscolher={({ corpo: c, assunto: a }) => { setCorpo(c); if (a) setAssunto(a); }}
            />
            <EscreverComIA
              lead={leads.find(l => l.email && l.email.toLowerCase() === para.trim().toLowerCase()) || null}
              canal="email"
              empresa={empresa}
              meuNome={meuNome}
              aoEscolher={({ corpo: c, assunto: a }) => { setCorpo(c); if (a) setAssunto(a); }}
            />
            <div style={{ flex: 1 }} />
            <button onClick={() => setRedigindo(false)} style={{
              background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px',
              padding: '8px 16px', fontSize: '13px', color: 'var(--text2)', cursor: 'pointer',
            }}>Cancelar</button>
            <button
              onClick={enviarEmail}
              disabled={enviando}
              style={{
                background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
                border: 'none', borderRadius: '8px', padding: '8px 20px',
                fontSize: '13px', color: '#fff', fontWeight: 600, cursor: 'pointer',
                opacity: enviando ? 0.7 : 1,
              }}
            >
              {enviando ? '⏳ Enviando...' : '📤 Enviar'}
            </button>
          </div>
        </div>
      ) : threadAtiva ? (
        // ── LER THREAD ──
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Header da thread */}
          <div style={{
            padding: '16px 24px', borderBottom: '1px solid var(--border)',
            background: 'var(--surface)',
          }}>
            <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>
              {threadAtiva.assunto}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text3)' }}>
              {threadAtiva.nome || threadAtiva.email} · {mensagens.length} mensagem{mensagens.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Mensagens */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {mensagens.map((msg) => {
              const saida = msg.origem === 'saida';
              return (
                <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: saida ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: '10px',
                    flexDirection: saida ? 'row-reverse' : 'row',
                    maxWidth: '75%',
                  }}>
                    {/* Avatar */}
                    <div style={{
                      width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
                      background: saida ? 'var(--accent)' : getCor(threadAtiva.nome || ''),
                      color: '#fff', fontSize: '12px', fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {saida ? 'GP' : getIniciais(threadAtiva.nome || 'CL').toUpperCase()}
                    </div>
                    {/* Balão */}
                    <div>
                      <div style={{
                        background: saida ? 'linear-gradient(135deg, rgba(0,210,223,0.15), rgba(99,102,241,0.15))' : 'var(--surface2)',
                        border: `1px solid ${saida ? 'rgba(0,210,223,0.3)' : 'var(--border)'}`,
                        borderRadius: saida ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                        padding: '12px 16px',
                        color: 'var(--text)', fontSize: '14px', lineHeight: 1.6,
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      }}>
                        {msg.texto}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px', textAlign: saida ? 'right' : 'left' }}>
                        {saida ? '✓ ' : ''}{formatarData(msg.criadoEm)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={fimMensagensRef} />
          </div>

          {/* Área de resposta */}
          <div style={{
            borderTop: '1px solid var(--border)', padding: '16px 24px',
            background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: '10px',
          }}>
            <div style={{ fontSize: '12px', color: 'var(--text3)' }}>
              Responder para: <strong style={{ color: 'var(--text2)' }}>{threadAtiva.email}</strong>
            </div>
            <textarea
              value={respostaTexto}
              onChange={e => setRespostaTexto(e.target.value)}
              placeholder="Escreva sua resposta..."
              rows={3}
              style={{
                background: 'var(--surface2)', border: '1px solid var(--border)',
                borderRadius: '10px', padding: '12px', color: 'var(--text)',
                fontSize: '13px', resize: 'none', outline: 'none',
              }}
            />
            {avisoErro}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center' }}>
              <SeletorModelo
                modelos={modelos}
                canal="email"
                lead={leads.find(l => l.email && l.email.toLowerCase() === (threadAtiva.email || '').toLowerCase()) || null}
                empresa={empresa}
                meuNome={meuNome}
                onEscolher={({ corpo: c }) => setRespostaTexto(c)}
              />
              <EscreverComIA
                lead={leads.find(l => l.email && l.email.toLowerCase() === (threadAtiva.email || '').toLowerCase()) || null}
                canal="email"
                empresa={empresa}
                meuNome={meuNome}
                aoEscolher={({ corpo: c }) => setRespostaTexto(c)}
              />
              <div style={{ flex: 1 }} />
              <button
                onClick={responderEmail}
                disabled={respondendo || !respostaTexto.trim()}
                style={{
                  background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
                  border: 'none', borderRadius: '8px', padding: '8px 20px',
                  fontSize: '13px', color: '#fff', fontWeight: 600, cursor: 'pointer',
                  opacity: respondendo || !respostaTexto.trim() ? 0.6 : 1,
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}
              >
                {respondendo ? '⏳ Enviando...' : '📤 Responder'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        // ── ESTADO VAZIO ──
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '16px',
        }}>
          <div style={{ fontSize: '64px' }}>📬</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)' }}>
            Sua caixa de e-mails
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text3)', textAlign: 'center', maxWidth: '300px' }}>
            Selecione um e-mail à esquerda para ler, ou clique em "Novo" para redigir uma mensagem.
          </div>
          <button
            onClick={() => setRedigindo(true)}
            style={{
              background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
              border: 'none', borderRadius: '10px', padding: '10px 24px',
              fontSize: '14px', color: '#fff', fontWeight: 600, cursor: 'pointer',
            }}
          >
            ✏️ Redigir e-mail
          </button>
        </div>
      )}
    </div>
  );
}
