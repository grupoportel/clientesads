import { useState, useEffect, useRef, useMemo } from 'react';
import { ref, onValue, push, set, update } from 'firebase/database';
import { database } from '../firebase';
import { apiPost } from '../api';
import { acharEtapa } from '../pipeline';
import SeletorModelo from './SeletorModelo';
import EscreverComIA from './EscreverComIA';
import { useTelaEstreita } from '../useTelaEstreita';

/* ── Helpers ── */
const fmtHora = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};
const fmtData = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const hoje = new Date();
  if (d.toDateString() === hoje.toDateString()) return 'Hoje';
  const ontem = new Date(); ontem.setDate(hoje.getDate() - 1);
  if (d.toDateString() === ontem.toDateString()) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};
const getInitials = (nome = '') =>
  nome.split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';

const AVATAR_COLORS = [
  'linear-gradient(135deg,#5865f2,#3b82f6)',
  'linear-gradient(135deg,#22c55e,#06b6d4)',
  'linear-gradient(135deg,#a855f7,#ec4899)',
  'linear-gradient(135deg,#f97316,#facc15)',
  'linear-gradient(135deg,#14b8a6,#3b82f6)',
  'linear-gradient(135deg,#ec4899,#f97316)',
];
const avatarColor = (nome = '') => AVATAR_COLORS[nome.charCodeAt(0) % AVATAR_COLORS.length] || AVATAR_COLORS[0];

/* ─────────────────────────────────────────────
   ConversasPage
───────────────────────────────────────────── */
export default function ConversasPage({ leads = [], etapas = [], conversas = [], modelos = [], empresa = '', meuNome = '' }) {
  const estreita = useTelaEstreita();
  const [conversaSelecionada, setConversaSelecionada] = useState(null);
  const [novaMensagem, setNovaMensagem] = useState('');
  const [buscaConversa, setBuscaConversa] = useState('');
  const [abaInfo, setAbaInfo] = useState('Informações'); // 'Informações' | 'Histórico'
  const [filtroAba, setFiltroAba] = useState('Todos');
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState('');
  const [modalNovaConversa, setModalNovaConversa] = useState(false);
  const [leadSelecionadoNovo, setLeadSelecionadoNovo] = useState('');

  const mensagensRef = useRef(null);

  /* ── Firebase: carregar mensagens da conversa ativa ── */
  // A carga guarda de qual conversa as mensagens são. Assim trocar de conversa
  // já mostra vazio no mesmo render, sem precisar de um setState de limpeza
  // dentro do efeito — que forçava um render extra e mostrava por um instante
  // as mensagens da conversa anterior.
  const [carga, setCarga] = useState({ id: null, lista: [] });
  const idAtivo = conversaSelecionada?.id ?? null;
  const mensagens = useMemo(() => (carga.id === idAtivo ? carga.lista : []), [carga, idAtivo]);

  useEffect(() => {
    if (!idAtivo) return;

    const unsub = onValue(ref(database, `crm_data/conversas/${idAtivo}/mensagens`), (snap) => {
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

  /* ── Marcar como lida ao abrir ── */
  const naoLidasAtivo = conversaSelecionada?.naoLidas || 0;
  useEffect(() => {
    if (!idAtivo || naoLidasAtivo <= 0) return;
    update(ref(database, `crm_data/conversas/${idAtivo}`), { naoLidas: 0 });
  }, [idAtivo, naoLidasAtivo]);

  /* ── Auto-scroll ao final das mensagens ── */
  useEffect(() => {
    if (mensagensRef.current) {
      mensagensRef.current.scrollTop = mensagensRef.current.scrollHeight;
    }
  }, [mensagens]);

  /* ── Lead associado à conversa ── */
  const leadAssociado = useMemo(() => {
    if (!conversaSelecionada?.leadId) return null;
    return leads.find(l => l.id === conversaSelecionada.leadId) || null;
  }, [conversaSelecionada, leads]);

  /* ── Conversas filtradas ── */
  const conversasFiltradas = useMemo(() => {
    let lista = [...conversas];
    if (filtroAba === 'Não lidas') lista = lista.filter(c => c.naoLidas > 0);
    if (filtroAba === 'Grupos') lista = lista.filter(c => c.tipo === 'grupo');
    if (filtroAba === 'Arquivadas') lista = lista.filter(c => c.arquivada);
    else lista = lista.filter(c => !c.arquivada);
    if (buscaConversa.trim()) {
      const t = buscaConversa.toLowerCase();
      lista = lista.filter(c => (c.nome || '').toLowerCase().includes(t));
    }
    return lista;
  }, [conversas, filtroAba, buscaConversa]);

  /* ── Enviar mensagem ── */
  const enviarMensagem = async () => {
    const texto = novaMensagem.trim();
    if (!texto || !conversaSelecionada || enviando) return;
    setEnviando(true);
    setErroEnvio('');
    setNovaMensagem(''); // limpa o campo imediatamente para boa UX

    const telefone = conversaSelecionada.telefone;
    const temWhatsapp = telefone && telefone.replace(/\D/g, '').length >= 10;

    try {
      if (temWhatsapp) {
        // O backend entrega na Meta E salva no Firebase; o onValue atualiza a tela
        await apiPost('/api/send-message', {
          conversaId:      conversaSelecionada.id,
          texto,
          telefoneDestino: telefone,
        });
      } else {
        // Conversa interna sem telefone — salva só no Firebase
        const criadoEm = new Date().toISOString();
        const novaMsgRef = push(ref(database, `crm_data/conversas/${conversaSelecionada.id}/mensagens`));
        await set(novaMsgRef, { texto, criadoEm, origem: 'saida', lida: true });
        await update(ref(database, `crm_data/conversas/${conversaSelecionada.id}`), { ultimaMensagem: texto, ultimaAt: criadoEm });
      }
    } catch (error) {
      console.error('[ConversasPage] Falha ao enviar:', error);
      // Não perde o que foi digitado: registra como não entregue e avisa
      try {
        const criadoEm = new Date().toISOString();
        const novaMsgRef = push(ref(database, `crm_data/conversas/${conversaSelecionada.id}/mensagens`));
        await set(novaMsgRef, { texto, criadoEm, origem: 'saida', lida: true, erroEnvio: true });
        await update(ref(database, `crm_data/conversas/${conversaSelecionada.id}`), { ultimaMensagem: texto, ultimaAt: criadoEm });
      } catch { /* se nem o Firebase respondeu, devolve o texto ao campo */
        setNovaMensagem(texto);
      }
      setErroEnvio(error.message || 'Não foi possível enviar a mensagem.');
    } finally {
      setEnviando(false);
    }
  };

  /* ── Criar nova conversa ── */
  const criarConversa = () => {
    if (!leadSelecionadoNovo) return;
    const lead = leads.find(l => l.id === leadSelecionadoNovo);
    if (!lead) return;
    // Verificar se já existe
    const existente = conversas.find(c => c.leadId === lead.id);
    if (existente) { setConversaSelecionada(existente); setModalNovaConversa(false); return; }
    const novaRef = push(ref(database, 'crm_data/conversas'));
    const criadoEm = new Date().toISOString();
    set(novaRef, {
      id: novaRef.key, leadId: lead.id, nome: lead.nome,
      nicho: lead.nicho || '', telefone: lead.telefone || '',
      ultimaMensagem: '', ultimaAt: criadoEm, naoLidas: 0, arquivada: false,
    });
    setLeadSelecionadoNovo('');
    setModalNovaConversa(false);
  };

  /* ── Agrupar mensagens por data ── */
  const mensagensAgrupadas = useMemo(() => {
    const grupos = {};
    mensagens.forEach(m => {
      const data = fmtData(m.criadoEm);
      if (!grupos[data]) grupos[data] = [];
      grupos[data].push(m);
    });
    return grupos;
  }, [mensagens]);

  /* ─── RENDER ─── */
  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', height: '100%' }}>

      {/* ══ COLUNA 1: Lista de Conversas ══ */}
      <div style={{
        width: estreita ? '100%' : 300,
        flexShrink: 0,
        display: estreita && conversaSelecionada ? 'none' : 'flex',
        flexDirection: 'column',
        borderRight: '1px solid var(--border)', background: 'var(--surface)',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 16px 10px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>💬</span>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Conversas</h2>
              {conversas.filter(c => c.naoLidas > 0 && !c.arquivada).length > 0 && (
                <span style={{
                  background: 'var(--accent)', color: '#fff', fontSize: 11,
                  padding: '1px 7px', borderRadius: 10, fontWeight: 700,
                  fontFamily: "'DM Mono', monospace",
                }}>
                  {conversas.filter(c => c.naoLidas > 0 && !c.arquivada).length}
                </span>
              )}
            </div>
            <button
              className="btn btn-primary"
              style={{ fontSize: 11, padding: '5px 10px' }}
              onClick={() => setModalNovaConversa(true)}
            >+ Nova</button>
          </div>

          {/* Busca */}
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', fontSize: 13 }}>🔍</span>
            <input
              value={buscaConversa}
              onChange={e => setBuscaConversa(e.target.value)}
              placeholder="Buscar conversas..."
              style={{
                width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '7px 10px 7px 32px', color: 'var(--text)',
                fontSize: 13, outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Abas filtro */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 8px', flexShrink: 0 }}>
          {['Todos', 'Não lidas', 'Grupos', 'Arquivadas'].map(aba => (
            <button key={aba} onClick={() => setFiltroAba(aba)} style={{
              flex: 1, padding: '8px 2px', fontSize: 11, fontWeight: filtroAba === aba ? 700 : 500,
              color: filtroAba === aba ? 'var(--accent)' : 'var(--text3)',
              background: 'transparent', border: 'none', borderBottom: filtroAba === aba ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
            }}>{aba}</button>
          ))}
        </div>

        {/* Lista */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {conversasFiltradas.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>💬</div>
              {buscaConversa ? 'Nenhuma conversa encontrada.' : 'Nenhuma conversa ainda.\nClique em "+ Nova" para começar.'}
            </div>
          ) : conversasFiltradas.map(c => (
            <div key={c.id}
              onClick={() => setConversaSelecionada(c)}
              style={{
                display: 'flex', gap: 10, padding: '12px 16px', cursor: 'pointer',
                background: conversaSelecionada?.id === c.id ? 'rgba(0,208,223,0.08)' : 'transparent',
                borderLeft: conversaSelecionada?.id === c.id ? '3px solid var(--accent)' : '3px solid transparent',
                borderBottom: '1px solid var(--border)',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (conversaSelecionada?.id !== c.id) e.currentTarget.style.background = 'var(--surface2)'; }}
              onMouseLeave={e => { if (conversaSelecionada?.id !== c.id) e.currentTarget.style.background = 'transparent'; }}
            >
              {/* Avatar */}
              <div style={{
                width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                background: avatarColor(c.nome), display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff',
              }}>
                {getInitials(c.nome)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>
                    {c.nome}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>
                    {fmtData(c.ultimaAt)} {fmtHora(c.ultimaAt)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 170 }}>
                    {c.ultimaMensagem || 'Sem mensagens'}
                  </span>
                  {c.naoLidas > 0 && (
                    <span style={{
                      background: 'var(--green)', color: '#fff', fontSize: 10,
                      padding: '1px 6px', borderRadius: 10, fontWeight: 700, flexShrink: 0,
                    }}>{c.naoLidas}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ══ COLUNA 2: Chat ══ */}
      {!conversaSelecionada ? (
        <div style={{
          flex: 1, display: estreita ? 'none' : 'flex',
          alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 16, color: 'var(--text3)',
        }}>
          <div style={{ fontSize: 56 }}>💬</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text2)' }}>Selecione uma conversa</div>
          <div style={{ fontSize: 13 }}>Escolha uma conversa na lista ou crie uma nova.</div>
          <button className="btn btn-primary" onClick={() => setModalNovaConversa(true)}>+ Nova Conversa</button>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>

          {/* Chat Header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px',
            borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0,
          }}>
            {estreita && (
              <button
                onClick={() => setConversaSelecionada(null)}
                aria-label="Voltar para a lista"
                style={{
                  background: 'transparent', border: 'none', color: 'var(--text2)',
                  fontSize: 20, cursor: 'pointer', padding: '0 4px 0 0', flexShrink: 0,
                }}
              >
                ‹
              </button>
            )}
            <div style={{
              width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
              background: avatarColor(conversaSelecionada.nome),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 700, color: '#fff',
            }}>
              {getInitials(conversaSelecionada.nome)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{conversaSelecionada.nome}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                {conversaSelecionada.nicho && `${conversaSelecionada.nicho} · `}
                {conversaSelecionada.telefone || 'Sem telefone'}
              </div>
            </div>
            {/* Ações */}
            <div style={{ display: 'flex', gap: 6 }}>
              {leadAssociado && (
                <span style={{
                  background: `${acharEtapa(etapas, leadAssociado.status).cor}22`,
                  color: acharEtapa(etapas, leadAssociado.status).cor,
                  border: `1px solid ${acharEtapa(etapas, leadAssociado.status).cor}44`,
                  fontSize: 11, padding: '3px 10px', borderRadius: 6, fontWeight: 600,
                }}>
                  {acharEtapa(etapas, leadAssociado.status).label}
                </span>
              )}
              {conversaSelecionada.arquivada ? (
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 11, padding: '5px 10px' }}
                  onClick={() => {
                    update(ref(database, `crm_data/conversas/${conversaSelecionada.id}`), { arquivada: false });
                    setConversaSelecionada(prev => ({ ...prev, arquivada: false }));
                    setFiltroAba('Todos');
                  }}
                >📤 Desarquivar</button>
              ) : (
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 11, padding: '5px 10px' }}
                  onClick={() => {
                    if (window.confirm('Arquivar esta conversa? Ela continua acessível na aba "Arquivadas".')) {
                      update(ref(database, `crm_data/conversas/${conversaSelecionada.id}`), { arquivada: true });
                      setConversaSelecionada(null);
                    }
                  }}
                >📁 Arquivar</button>
              )}
            </div>
          </div>

          {/* Mensagens */}
          <div ref={mensagensRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {Object.keys(mensagensAgrupadas).length === 0 ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10, color: 'var(--text3)' }}>
                <div style={{ fontSize: 36 }}>✉️</div>
                <div style={{ fontSize: 14 }}>Nenhuma mensagem ainda. Comece a conversa!</div>
              </div>
            ) : Object.entries(mensagensAgrupadas).map(([data, msgs]) => (
              <div key={data}>
                {/* Separador de data */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0 12px' }}>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  <span style={{ fontSize: 11, color: 'var(--text3)', background: 'var(--surface2)', padding: '3px 12px', borderRadius: 10, border: '1px solid var(--border)' }}>{data}</span>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                </div>

                {msgs.map((m, i) => {
                  const isSaida = m.origem === 'saida';
                  const showAvatar = !isSaida && (i === 0 || msgs[i - 1]?.origem !== 'entrada');
                  return (
                    <div key={m.id} style={{
                      display: 'flex', justifyContent: isSaida ? 'flex-end' : 'flex-start',
                      marginBottom: 4, gap: 8,
                    }}>
                      {!isSaida && (
                        <div style={{
                          width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                          background: showAvatar ? avatarColor(conversaSelecionada.nome) : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 700, color: '#fff', alignSelf: 'flex-end',
                        }}>
                          {showAvatar ? getInitials(conversaSelecionada.nome) : ''}
                        </div>
                      )}
                      <div style={{
                        maxWidth: '65%', padding: '9px 14px', borderRadius: isSaida ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        background: m.erroEnvio ? 'var(--surface2)' : isSaida ? 'var(--accent)' : 'var(--surface2)',
                        color: m.erroEnvio ? 'var(--text2)' : isSaida ? '#fff' : 'var(--text)',
                        fontSize: 13, lineHeight: 1.5,
                        border: m.erroEnvio ? '1px dashed var(--red)' : isSaida ? 'none' : '1px solid var(--border)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                      }}>
                        <div>{m.texto}</div>
                        <div style={{ fontSize: 10, marginTop: 4, opacity: 0.75, textAlign: isSaida ? 'right' : 'left' }}>
                          {fmtHora(m.criadoEm)}
                          {isSaida && (m.erroEnvio ? ' ⚠ não entregue' : ' ✓✓')}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Aviso de falha no envio */}
          {erroEnvio && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 10, flexShrink: 0,
              padding: '10px 20px', borderTop: '1px solid rgba(239,68,68,0.3)',
              background: 'rgba(239,68,68,0.08)', color: 'var(--red)', fontSize: 12, lineHeight: 1.5,
            }}>
              <span style={{ flexShrink: 0 }}>⚠️</span>
              <span style={{ flex: 1 }}>{erroEnvio}</span>
              <button onClick={() => setErroEnvio('')} style={{
                background: 'transparent', border: 'none', color: 'var(--red)',
                cursor: 'pointer', fontSize: 15, lineHeight: 1, flexShrink: 0, padding: 0,
              }} title="Dispensar">×</button>
            </div>
          )}

          {/* Barra de Input */}
          <div style={{
            padding: '12px 20px', borderTop: '1px solid var(--border)',
            background: 'var(--surface)', display: 'flex', gap: 10, alignItems: 'flex-end', flexShrink: 0,
          }}>
            <SeletorModelo
              modelos={modelos}
              canal="whatsapp"
              lead={leadAssociado}
              empresa={empresa}
              meuNome={meuNome}
              onEscolher={({ corpo }) => setNovaMensagem(corpo)}
              compacto
            />

            <EscreverComIA
              lead={leadAssociado}
              canal="whatsapp"
              empresa={empresa}
              meuNome={meuNome}
              aoEscolher={({ corpo }) => setNovaMensagem(corpo)}
              compacto
            />

            <textarea
              value={novaMensagem}
              onChange={e => setNovaMensagem(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensagem(); } }}
              placeholder="Digite sua mensagem... (Enter para enviar)"
              rows={1}
              style={{
                flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '10px 14px', color: 'var(--text)', fontSize: 13,
                resize: 'none', outline: 'none', fontFamily: "'DM Sans', sans-serif",
                lineHeight: 1.5, maxHeight: 120, overflowY: 'auto',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
            <button
              className="btn btn-primary"
              onClick={enviarMensagem}
              disabled={!novaMensagem.trim() || enviando}
              style={{ padding: '10px 18px', opacity: (!novaMensagem.trim() || enviando) ? 0.5 : 1, flexShrink: 0 }}
            >
              ➤ Enviar
            </button>
          </div>

        </div>
      )}

      {/* ══ COLUNA 3: Info do Lead ══ */}
      {conversaSelecionada && (
        <div style={{
          width: 280, flexShrink: 0, borderLeft: '1px solid var(--border)',
          background: 'var(--surface)', display: estreita ? 'none' : 'flex',
          flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Abas */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            {['Informações', 'Histórico'].map(aba => (
              <button key={aba} onClick={() => setAbaInfo(aba)} style={{
                flex: 1, padding: '12px 8px', fontSize: 12, fontWeight: abaInfo === aba ? 700 : 500,
                color: abaInfo === aba ? 'var(--accent)' : 'var(--text3)',
                background: 'transparent', border: 'none',
                borderBottom: abaInfo === aba ? '2px solid var(--accent)' : '2px solid transparent',
                cursor: 'pointer', transition: 'all 0.15s',
              }}>{aba}</button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            {abaInfo === 'Informações' ? (
              <>
                {/* Avatar e nome */}
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: '50%', margin: '0 auto 10px',
                    background: avatarColor(conversaSelecionada.nome),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 24, fontWeight: 700, color: '#fff',
                  }}>
                    {getInitials(conversaSelecionada.nome)}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{conversaSelecionada.nome}</div>
                  {conversaSelecionada.nicho && (
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>{conversaSelecionada.nicho}</div>
                  )}
                  {leadAssociado && (
                    <span style={{
                      display: 'inline-block', marginTop: 8,
                      background: `${acharEtapa(etapas, leadAssociado.status).cor}22`,
                      color: acharEtapa(etapas, leadAssociado.status).cor,
                      border: `1px solid ${acharEtapa(etapas, leadAssociado.status).cor}44`,
                      fontSize: 11, padding: '3px 12px', borderRadius: 6, fontWeight: 600,
                    }}>
                      {acharEtapa(etapas, leadAssociado.status).label}
                    </span>
                  )}
                </div>

                {/* Informações do lead */}
                {leadAssociado ? (
                  <>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text3)', marginBottom: 10 }}>
                      Dados do Lead
                    </div>
                    {[
                      { label: 'Telefone', value: leadAssociado.telefone, icon: '📞' },
                      { label: 'E-mail', value: leadAssociado.email, icon: '📧' },
                      { label: 'Cidade', value: [leadAssociado.cidade, leadAssociado.estado].filter(Boolean).join(' · '), icon: '📍' },
                      { label: 'Responsável', value: leadAssociado.responsavel, icon: '👤' },
                      { label: 'Nicho', value: leadAssociado.nicho, icon: '🏢' },
                      { label: 'Origem', value: leadAssociado.origem, icon: '🔗' },
                    ].map(({ label, value, icon }) => value ? (
                      <div key={label} style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>{icon} {label}</div>
                        <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>{value}</div>
                      </div>
                    ) : null)}

                    {leadAssociado.observacoes && (
                      <>
                        <div style={{ height: 1, background: 'var(--border)', margin: '12px 0' }} />
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text3)', marginBottom: 8 }}>Observações</div>
                        <div style={{
                          background: 'var(--surface2)', borderRadius: 8, padding: '10px 12px',
                          fontSize: 12, color: 'var(--text2)', lineHeight: 1.5,
                          border: '1px solid var(--border)', whiteSpace: 'pre-wrap',
                        }}>
                          {leadAssociado.observacoes}
                        </div>
                      </>
                    )}

                    <div style={{ height: 1, background: 'var(--border)', margin: '12px 0' }} />
                    <div style={{ fontSize: 10, color: 'var(--text3)', textAlign: 'center' }}>
                      Criado em {leadAssociado.createdAt ? new Date(leadAssociado.createdAt).toLocaleDateString('pt-BR') : '—'}
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 12, padding: '20px 0' }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>🔗</div>
                    Nenhum lead vinculado a esta conversa.
                  </div>
                )}
              </>
            ) : (
              /* Histórico de mensagens resumido */
              <>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text3)', marginBottom: 12 }}>
                  Histórico
                </div>
                {mensagens.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 12, padding: '20px 0' }}>Nenhuma mensagem ainda.</div>
                ) : [...mensagens].reverse().slice(0, 20).map(m => (
                  <div key={m.id} style={{
                    marginBottom: 10, padding: '8px 10px', borderRadius: 8,
                    background: m.origem === 'saida' ? 'rgba(0,208,223,0.08)' : 'var(--surface2)',
                    border: '1px solid var(--border)',
                  }}>
                    <div style={{ fontSize: 11, color: m.origem === 'saida' ? 'var(--accent)' : 'var(--text3)', marginBottom: 3 }}>
                      {m.origem === 'saida' ? '➤ Enviada' : '← Recebida'} · {fmtHora(m.criadoEm)}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.4 }}>{m.texto}</div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* ══ MODAL: Nova Conversa ══ */}
      {modalNovaConversa && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(6px)', animation: 'fadeIn 0.2s ease',
        }} onClick={e => { if (e.target === e.currentTarget) setModalNovaConversa(false); }}>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border2)',
            borderRadius: 16, width: 440, boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
            animation: 'popIn 0.25s cubic-bezier(0.34,1.56,0.64,1)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>💬 Nova Conversa</span>
              <button onClick={() => setModalNovaConversa(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text3)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: 22 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>
                Selecione um Lead
              </label>
              <select
                value={leadSelecionadoNovo}
                onChange={e => setLeadSelecionadoNovo(e.target.value)}
                className="form-control"
                style={{ width: '100%', marginBottom: 16 }}
              >
                <option value="">— Selecione um lead —</option>
                {leads.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.nome}{l.nicho ? ` · ${l.nicho}` : ''}
                  </option>
                ))}
              </select>
              {leadSelecionadoNovo && (() => {
                const l = leads.find(x => x.id === leadSelecionadoNovo);
                return l ? (
                  <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: 'var(--text2)', border: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{l.nome}</div>
                    {l.telefone && <div>📞 {l.telefone}</div>}
                    {l.nicho && <div>🏢 {l.nicho}</div>}
                    <div style={{ marginTop: 6 }}>
                      <span style={{
                        background: `${acharEtapa(etapas, l.status).cor}22`,
                        color: acharEtapa(etapas, l.status).cor,
                        border: `1px solid ${acharEtapa(etapas, l.status).cor}44`,
                        fontSize: 11, padding: '2px 10px', borderRadius: 6, fontWeight: 600,
                      }}>
                        {acharEtapa(etapas, l.status).label}
                      </span>
                    </div>
                  </div>
                ) : null;
              })()}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost" onClick={() => setModalNovaConversa(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={criarConversa} disabled={!leadSelecionadoNovo}>
                  Iniciar Conversa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
