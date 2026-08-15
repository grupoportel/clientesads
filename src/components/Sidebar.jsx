import React from 'react';
import { rotuloPapel, corPapel } from '../papeis';

const NAV_ITEMS = [
  { id: 'dashboard',     icon: '📊', label: 'Dashboard' },
  { id: 'leads',         icon: '👥', label: 'Leads',        badgeKey: 'leads' },
  { id: 'clientes',      icon: '🏢', label: 'Clientes' },
  { id: 'tarefas',       icon: '✅', label: 'Tarefas' },
  { id: 'conversas',     icon: '💬', label: 'Conversas' },
  { id: 'emails',        icon: '✉️', label: 'E-mails' },
  { id: 'agenda',        icon: '📅', label: 'Agenda' },
  { id: 'financeiro',    icon: '💰', label: 'Financeiro' },
  { id: 'metricas',      icon: '🎯', label: 'Métricas' },
  { id: 'relatorios',    icon: '📈', label: 'Relatórios' },
];

export default function Sidebar({
  paginaAtiva, setPaginaAtiva, leads = [],
  tarefasPendentes = 0, conversasNaoLidas = 0, emailsNaoLidos = 0,
  nomeEmpresa = 'Grupo Portel', nomeUsuario = 'Usuário', emailUsuario = '',
  iniciaisUsuario = '?', onLogout, aberta = false, onFechar = () => {},
  papel = null, mostrarConfiguracoes = true,
}) {
  const isActive = (id) => paginaAtiva === id;

  const navItemStyle = (id) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 16px',
    borderRadius: '8px',
    cursor: 'pointer',
    color: isActive(id) ? 'var(--accent2)' : 'var(--text2)',
    fontSize: '13px',
    fontWeight: isActive(id) ? 600 : 500,
    transition: 'all 0.15s',
    borderLeft: isActive(id) ? '3px solid var(--accent)' : '3px solid transparent',
    background: isActive(id) ? 'rgba(0,210,223,.12)' : 'transparent',
    marginBottom: '2px',
  });

  const badgeStyle = (alert) => ({
    marginLeft: 'auto',
    background: alert ? 'rgba(239,68,68,.15)' : 'var(--surface3)',
    color: alert ? 'var(--red)' : 'var(--text3)',
    fontSize: '11px',
    padding: '1px 8px',
    borderRadius: '10px',
    fontFamily: "'DM Mono', monospace",
  });

  return (
    <div className={`sidebar-v2 ${aberta ? 'aberta' : ''}`}>
      {/* ── LOGO ── */}
      <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid var(--border)', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            width: '9px', height: '9px', borderRadius: '50%',
            background: 'var(--accent)', boxShadow: '0 0 10px var(--accent)',
            flexShrink: 0,
          }} />
          <span style={{
            fontSize: '18px', fontWeight: 700, color: 'var(--accent2)',
            letterSpacing: '-0.5px', overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }} title={nomeEmpresa}>
            {nomeEmpresa}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '4px', paddingLeft: '17px' }}>
            CRM v2.0
          </div>
          {aberta && (
            <button
              onClick={onFechar}
              aria-label="Fechar menu"
              style={{
                background: 'transparent', border: 'none', color: 'var(--text3)',
                fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: '0 4px',
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* ── MENU PRINCIPAL ── */}
      <div style={{ padding: '8px' }}>
        <div className="nav-label" style={{
          fontSize: '10px', fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '1px', color: 'var(--text3)', padding: '12px 12px 6px',
        }}>
          Menu Principal
        </div>

        {NAV_ITEMS.map((item) => {
          let badgeContent = null;
          let isAlert = false;
          
          if (item.id === 'leads' && leads.length > 0) {
            badgeContent = leads.length;
          } else if (item.id === 'tarefas' && tarefasPendentes > 0) {
            badgeContent = tarefasPendentes;
            isAlert = true;
          } else if (item.id === 'conversas' && conversasNaoLidas > 0) {
            badgeContent = conversasNaoLidas;
            isAlert = true;
          } else if (item.id === 'emails' && emailsNaoLidos > 0) {
            badgeContent = emailsNaoLidos;
            isAlert = true;
          }

          return (
            <div
              key={item.id}
              style={navItemStyle(item.id)}
              onClick={() => setPaginaAtiva(item.id)}
              onMouseEnter={(e) => {
                if (!isActive(item.id)) {
                  e.currentTarget.style.background = 'var(--surface2)';
                  e.currentTarget.style.paddingLeft = '20px';
                  e.currentTarget.style.color = 'var(--text)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive(item.id)) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.paddingLeft = '16px';
                  e.currentTarget.style.color = 'var(--text2)';
                }
              }}
            >
              <span style={{ fontSize: '15px', lineHeight: 1 }}>{item.icon}</span>
              <span>{item.label}</span>
              {badgeContent !== null && (
                <span style={badgeStyle(isAlert)}>{badgeContent}</span>
              )}
            </div>
          );
        })}

        {/* Divider */}
        {mostrarConfiguracoes && (
        <div style={{ height: '1px', background: 'var(--border)', margin: '8px 12px' }} />
        )}

        {/* Configurações — só para quem administra */}
        {mostrarConfiguracoes && (
        <div
          style={navItemStyle('configuracoes')}
          onClick={() => setPaginaAtiva('configuracoes')}
          onMouseEnter={(e) => {
            if (!isActive('configuracoes')) {
              e.currentTarget.style.background = 'var(--surface2)';
              e.currentTarget.style.paddingLeft = '20px';
              e.currentTarget.style.color = 'var(--text)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isActive('configuracoes')) {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.paddingLeft = '16px';
              e.currentTarget.style.color = 'var(--text2)';
            }
          }}
        >
          <span style={{ fontSize: '15px', lineHeight: 1 }}>⚙️</span>
          <span>Configurações</span>
        </div>
        )}
      </div>

      {/* ── USER SECTION (pushed to bottom) ── */}
      <div style={{
        marginTop: 'auto',
        borderTop: '1px solid var(--border)',
        padding: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
            color: '#fff', fontSize: '14px', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            {iniciaisUsuario}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: '13px', fontWeight: 600, color: 'var(--text)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {nomeUsuario}
            </div>
            <div style={{
              fontSize: '11px', color: 'var(--text3)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }} title={emailUsuario}>
              {emailUsuario}
            </div>
            {papel && (
              <div style={{ fontSize: '10px', color: corPapel(papel), marginTop: 2, fontWeight: 600 }}>
                {rotuloPapel(papel)}
              </div>
            )}
          </div>
        </div>

        <div style={{ height: '1px', background: 'var(--border)', margin: '12px 0' }} />

        <button
          type="button"
          onClick={onLogout}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
            padding: '8px 12px', borderRadius: '8px', cursor: 'pointer',
            color: 'var(--text3)', fontSize: '13px', textAlign: 'left',
            background: 'transparent', border: 'none',
            fontFamily: 'inherit', transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--surface2)';
            e.currentTarget.style.color = 'var(--text)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--text3)';
          }}
        >
          <span style={{ fontSize: '15px' }}>🚪</span>
          <span>Sair</span>
        </button>
      </div>
    </div>
  );
}