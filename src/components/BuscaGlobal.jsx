import { useState, useEffect, useMemo, useRef } from 'react';
import { acharEtapa, formatarBRL } from '../pipeline';

// Busca que varre o CRM inteiro, não só os leads. O campo do topo prometia
// "Buscar no CRM… (⌘K)" mas filtrava apenas a tabela de leads e o atalho não
// existia em lugar nenhum do código.

const normalizar = (t) =>
  String(t || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const GRUPOS = {
  lead:     { rotulo: 'Leads',     icone: '👥', pagina: 'leads' },
  cliente:  { rotulo: 'Clientes',  icone: '🏢', pagina: 'clientes' },
  tarefa:   { rotulo: 'Tarefas',   icone: '✅', pagina: 'tarefas' },
  proposta: { rotulo: 'Propostas', icone: '📋', pagina: 'financeiro' },
  conversa: { rotulo: 'Conversas', icone: '💬', pagina: 'conversas' },
  email:    { rotulo: 'E-mails',   icone: '✉️', pagina: 'emails' },
};

export default function BuscaGlobal({
  aberta, onFechar, onNavegar, onAbrirLead,
  leads = [], clientes = [], tarefas = [], propostas = [],
  conversas = [], emails = [], etapas = [],
}) {
  const [termo, setTermo] = useState('');
  const [selecionado, setSelecionado] = useState(0);
  const campoRef = useRef(null);
  const listaRef = useRef(null);

  // Foca o campo e zera o estado sempre que abrir
  useEffect(() => {
    if (aberta) {
      setTermo('');
      setSelecionado(0);
      // timeout de 0 para o foco acontecer depois do elemento existir na tela
      const t = setTimeout(() => campoRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [aberta]);

  const resultados = useMemo(() => {
    const t = normalizar(termo).trim();
    if (t.length < 2) return [];

    const casa = (...campos) => campos.some(c => normalizar(c).includes(t));
    const achados = [];

    leads.forEach(l => {
      if (casa(l.nome, l.nicho, l.telefone, l.whatsapp, l.email, l.responsavel, l.cidade, l.decisor, l.cnpj)) {
        const etapa = acharEtapa(etapas, l.status);
        achados.push({
          tipo: 'lead', id: l.id, titulo: l.nome || 'Sem nome',
          subtitulo: [etapa.label, l.nicho, l.responsavel].filter(Boolean).join(' · '),
          extra: Number(l.valor) > 0 ? formatarBRL(l.valor) : '',
          cor: etapa.cor, dado: l,
        });
      }
    });

    clientes.forEach(c => {
      if (casa(c.nome, c.nicho, c.responsavel, c.email, c.telefone, c.whatsapp)) {
        achados.push({
          tipo: 'cliente', id: c.id, titulo: c.nome || 'Sem nome',
          subtitulo: [c.plano, c.nicho, c.responsavel].filter(Boolean).join(' · '),
          extra: Number(c.valorMensal) > 0 ? `${formatarBRL(c.valorMensal)}/mês` : '',
        });
      }
    });

    tarefas.forEach(tf => {
      if (casa(tf.titulo, tf.leadNome, tf.responsavel)) {
        achados.push({
          tipo: 'tarefa', id: tf.id, titulo: tf.titulo || 'Sem título',
          subtitulo: [tf.leadNome, tf.data ? tf.data.split('-').reverse().join('/') : ''].filter(Boolean).join(' · '),
          extra: tf.concluida ? 'concluída' : '',
        });
      }
    });

    propostas.forEach(p => {
      if (casa(p.leadNome, p.descricao, p.status)) {
        achados.push({
          tipo: 'proposta', id: p.id, titulo: p.leadNome || 'Proposta',
          subtitulo: [p.status, p.data ? p.data.split('-').reverse().join('/') : ''].filter(Boolean).join(' · '),
          extra: formatarBRL(p.valor),
        });
      }
    });

    conversas.forEach(c => {
      if (casa(c.nome, c.telefone, c.ultimaMensagem)) {
        achados.push({
          tipo: 'conversa', id: c.id, titulo: c.nome || c.telefone || 'Conversa',
          subtitulo: c.ultimaMensagem || 'Sem mensagens',
          extra: c.naoLidas > 0 ? `${c.naoLidas} não lida(s)` : '',
        });
      }
    });

    emails.forEach(e => {
      if (casa(e.nome, e.email, e.assunto, e.ultimaMensagem)) {
        achados.push({
          tipo: 'email', id: e.id, titulo: e.assunto || '(sem assunto)',
          subtitulo: e.nome || e.email || '',
          extra: e.naoLidas > 0 ? `${e.naoLidas} não lido(s)` : '',
        });
      }
    });

    return achados.slice(0, 40);
  }, [termo, leads, clientes, tarefas, propostas, conversas, emails, etapas]);

  const escolher = (item) => {
    if (!item) return;
    if (item.tipo === 'lead') {
      onNavegar('leads');
      onAbrirLead?.(item.dado);
    } else {
      onNavegar(GRUPOS[item.tipo].pagina);
    }
    onFechar();
  };

  const aoTeclar = (e) => {
    if (e.key === 'Escape') { onFechar(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelecionado(i => Math.min(i + 1, resultados.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelecionado(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      escolher(resultados[selecionado]);
    }
  };

  // Mantém o item destacado visível ao navegar pelo teclado
  useEffect(() => {
    const alvo = listaRef.current?.querySelector(`[data-indice="${selecionado}"]`);
    alvo?.scrollIntoView({ block: 'nearest' });
  }, [selecionado]);

  if (!aberta) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '12vh', backdropFilter: 'blur(4px)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onFechar(); }}
    >
      <div
        style={{
          width: 'min(640px, 92vw)', background: 'var(--surface)',
          border: '1px solid var(--border2)', borderRadius: 14,
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)', overflow: 'hidden',
          display: 'flex', flexDirection: 'column', maxHeight: '70vh',
          animation: 'popIn 0.18s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        {/* Campo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 17, color: 'var(--text3)' }}>🔍</span>
          <input
            ref={campoRef}
            value={termo}
            onChange={e => { setTermo(e.target.value); setSelecionado(0); }}
            onKeyDown={aoTeclar}
            placeholder="Buscar leads, clientes, tarefas, propostas, conversas…"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--text)', fontSize: 15, fontFamily: 'inherit',
            }}
          />
          <kbd style={{
            fontSize: 10, color: 'var(--text3)', border: '1px solid var(--border)',
            borderRadius: 4, padding: '2px 6px', fontFamily: "'DM Mono', monospace",
          }}>ESC</kbd>
        </div>

        {/* Resultados */}
        <div ref={listaRef} style={{ flex: 1, overflowY: 'auto' }}>
          {termo.trim().length < 2 ? (
            <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text3)', fontSize: 13, lineHeight: 1.7 }}>
              Digite ao menos 2 letras.<br />
              <span style={{ fontSize: 12 }}>Busca por nome, telefone, e-mail, CNPJ, assunto e conteúdo de mensagem.</span>
            </div>
          ) : resultados.length === 0 ? (
            <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
              <div style={{ fontSize: 30, marginBottom: 10 }}>🔍</div>
              Nada encontrado para “{termo}”.
            </div>
          ) : (
            Object.entries(
              resultados.reduce((acc, r) => {
                (acc[r.tipo] = acc[r.tipo] || []).push(r);
                return acc;
              }, {})
            ).map(([tipo, itens]) => (
              <div key={tipo}>
                <div style={{
                  padding: '10px 20px 6px', fontSize: 10, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)',
                  background: 'var(--surface2)', borderBottom: '1px solid var(--border)',
                }}>
                  {GRUPOS[tipo].icone} {GRUPOS[tipo].rotulo} · {itens.length}
                </div>
                {itens.map(item => {
                  const indice = resultados.indexOf(item);
                  const ativo = indice === selecionado;
                  return (
                    <div
                      key={`${item.tipo}-${item.id}`}
                      data-indice={indice}
                      onClick={() => escolher(item)}
                      onMouseEnter={() => setSelecionado(indice)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '11px 20px', cursor: 'pointer',
                        background: ativo ? 'rgba(0,208,223,0.1)' : 'transparent',
                        borderLeft: `3px solid ${ativo ? 'var(--accent)' : 'transparent'}`,
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      {item.cor && (
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.cor, flexShrink: 0 }} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 13.5, fontWeight: 600, color: 'var(--text)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {item.titulo}
                        </div>
                        {item.subtitulo && (
                          <div style={{
                            fontSize: 11.5, color: 'var(--text3)', marginTop: 2,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {item.subtitulo}
                          </div>
                        )}
                      </div>
                      {item.extra && (
                        <span style={{
                          fontSize: 11.5, color: 'var(--green)', fontFamily: "'DM Mono', monospace",
                          fontWeight: 600, flexShrink: 0,
                        }}>
                          {item.extra}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Rodapé com as teclas */}
        {resultados.length > 0 && (
          <div style={{
            display: 'flex', gap: 16, padding: '8px 20px', borderTop: '1px solid var(--border)',
            background: 'var(--surface2)', fontSize: 11, color: 'var(--text3)', flexShrink: 0,
          }}>
            <span>↑ ↓ navegar</span>
            <span>↵ abrir</span>
            <span style={{ marginLeft: 'auto' }}>{resultados.length} resultado(s)</span>
          </div>
        )}
      </div>
    </div>
  );
}
