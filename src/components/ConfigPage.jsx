import React, { useState, useEffect } from 'react';
import { ref, onValue, set, push } from 'firebase/database';
import { database } from '../firebase';

/* ─────────────────────────────────────────────
   Inline Reusable Components
───────────────────────────────────────────── */

const Chip = ({ label, onRemove, color }) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '5px 12px',
      borderRadius: 20,
      background: 'var(--surface2)',
      border: '1px solid var(--border)',
      fontSize: 13,
      color: color || 'var(--text2)',
    }}
  >
    {label}
    <span
      style={{ cursor: 'pointer', opacity: 0.6, fontSize: 11 }}
      onClick={onRemove}
      title={`Remover "${label}"`}
    >
      ✕
    </span>
  </div>
);

const AddInput = ({ value, onChange, onAdd, placeholder }) => (
  <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
    <input
      className="form-control"
      style={{ maxWidth: 260 }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      onKeyDown={(e) => e.key === 'Enter' && onAdd()}
    />
    <button className="btn btn-primary" style={{ padding: '8px 16px' }} onClick={onAdd}>
      + Adicionar
    </button>
  </div>
);

/* ─────────────────────────────────────────────
   Static Data
───────────────────────────────────────────── */

const pipelineStages = [
  { name: 'Nenhum', color: '#5865f2', enabled: true },
  { name: 'Lead Qualificado', color: '#3b82f6', enabled: true },
  { name: 'Ligação Feita', color: '#eab308', enabled: true },
  { name: 'Contato com Decisor', color: '#a855f7', enabled: true },
  { name: 'Reunião Marcada', color: '#22c55e', enabled: true },
  { name: 'Contrato Realizado', color: '#ec4899', enabled: true },
  { name: 'Venda', color: '#14b8a6', enabled: true },
  { name: 'Perda', color: '#ef4444', enabled: true },
  { name: 'Concluído', color: '#8b5cf6', enabled: true },
];


const roleBadge = (role) => {
  const map = {
    Admin: { bg: 'rgba(168,85,247,0.15)', color: 'var(--purple)', label: 'Admin' },
    Editor: { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6', label: 'Editor' },
    Viewer: { bg: 'rgba(148,168,208,0.15)', color: 'var(--text3)', label: 'Viewer' },
  };
  return map[role] || map.Viewer;
};

/* ─────────────────────────────────────────────
   ConfigPage
───────────────────────────────────────────── */

export default function ConfigPage() {
  const [activeTab, setActiveTab] = useState('Pipeline');
  const tabs = ['Pipeline', 'Equipe', 'Nichos', 'Regiões', 'Empresa', 'Usuários'];

  // Firebase state
  const [nichos, setNichos] = useState([]);
  const [responsaveis, setResponsaveis] = useState([]);
  const [estados, setEstados] = useState([]);
  const [cidades, setCidades] = useState([]);
  const [empresa, setEmpresa] = useState({
    nome: 'Grupo Portel',
    cnpj: '',
    telefone: '',
    email: '',
    endereco: '',
  });
  const [empresaSalva, setEmpresaSalva] = useState(false);
  const [usuarios, setUsuarios] = useState([]);

  // New item inputs
  const [novoNicho, setNovoNicho] = useState('');
  const [novoResponsavel, setNovoResponsavel] = useState('');
  const [novoEstado, setNovoEstado] = useState('');
  const [novaCidade, setNovaCidade] = useState('');

  /* ── Firebase reads ── */
  useEffect(() => {
    const unsubNichos = onValue(ref(database, 'crm_data/nichos'), (snap) => {
      setNichos(snap.val() ? Object.values(snap.val()) : []);
    });
    const unsubResp = onValue(ref(database, 'crm_data/responsaveis'), (snap) => {
      setResponsaveis(snap.val() ? Object.values(snap.val()) : []);
    });
    const unsubEstados = onValue(ref(database, 'crm_data/estados'), (snap) => {
      setEstados(snap.val() ? Object.values(snap.val()) : []);
    });
    const unsubCidades = onValue(ref(database, 'crm_data/cidades'), (snap) => {
      setCidades(snap.val() ? Object.values(snap.val()) : []);
    });
    const unsubEmpresa = onValue(ref(database, 'crm_data/config/empresa'), (snap) => {
      if (snap.val()) setEmpresa(snap.val());
    });
    const unsubUsuarios = onValue(ref(database, 'crm_data/usuarios'), (snap) => {
      const data = snap.val();
      setUsuarios(data ? Object.entries(data).map(([id, u]) => ({ ...u, id })) : []);
    });
    return () => {
      unsubNichos();
      unsubResp();
      unsubEstados();
      unsubCidades();
      unsubEmpresa();
      unsubUsuarios();
    };
  }, []);

  /* ── Generic list helpers ── */
  const addItem = (path, list, setList, newItem, setNewItem) => {
    const trimmed = newItem.trim();
    if (!trimmed) return;
    if (list.includes(trimmed)) return;
    const updated = [...list, trimmed];
    set(ref(database, path), updated);
    setNewItem('');
  };

  const removeItem = (path, list, item) => {
    if (window.confirm(`Remover "${item}"?`)) {
      set(ref(database, path), list.filter((i) => i !== item));
    }
  };

  const salvarEmpresa = () => {
    set(ref(database, 'crm_data/config/empresa'), empresa);
    setEmpresaSalva(true);
    setTimeout(() => setEmpresaSalva(false), 2000);
  };

  /* ─────────────────────────────────────────────
     Tab: Pipeline
  ───────────────────────────────────────────── */
  const renderPipeline = () => (
    <div className="crm-card" style={{ maxWidth: 720 }}>
      <div className="crm-card-header">
        <div>
          <div className="crm-card-title">Etapas do Pipeline</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
            Gerencie as etapas de negociação do seu funil de vendas
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {pipelineStages.map((stage, idx) => (
          <div
            key={idx}
            className="config-item"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 16px',
              borderRadius: 10,
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              userSelect: 'none',
            }}
          >
            <span style={{ color: 'var(--text3)', fontSize: 18, cursor: 'grab' }}>⠿</span>
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: stage.color,
                flexShrink: 0,
              }}
            />
            <span style={{ flex: 1, fontSize: 14, color: 'var(--text)' }}>{stage.name}</span>
            <div
              className={`toggle-switch ${stage.enabled ? 'active' : ''}`}
              style={{ cursor: 'pointer' }}
            />
          </div>
        ))}
      </div>
      <button
        style={{
          marginTop: 16,
          width: '100%',
          padding: '12px',
          borderRadius: 10,
          border: '2px dashed var(--border2)',
          background: 'transparent',
          color: 'var(--text3)',
          fontSize: 14,
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => (e.target.style.borderColor = 'var(--accent)')}
        onMouseLeave={(e) => (e.target.style.borderColor = 'var(--border2)')}
      >
        + Adicionar Etapa
      </button>
    </div>
  );

  /* ─────────────────────────────────────────────
     Tab: Equipe
  ───────────────────────────────────────────── */
  const renderEquipe = () => (
    <div className="crm-card" style={{ maxWidth: 720 }}>
      <div className="crm-card-header">
        <div className="crm-card-title">Equipe / Responsáveis</div>
      </div>
      {responsaveis.length === 0 ? (
        <div style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 12 }}>
          Nenhum responsável cadastrado
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
          {responsaveis.map((r, i) => (
            <Chip
              key={i}
              label={r}
              onRemove={() => removeItem('crm_data/responsaveis', responsaveis, r)}
            />
          ))}
        </div>
      )}
      <AddInput
        value={novoResponsavel}
        onChange={setNovoResponsavel}
        placeholder="Nome do responsável..."
        onAdd={() =>
          addItem('crm_data/responsaveis', responsaveis, setResponsaveis, novoResponsavel, setNovoResponsavel)
        }
      />
    </div>
  );

  /* ─────────────────────────────────────────────
     Tab: Nichos
  ───────────────────────────────────────────── */
  const renderNichos = () => (
    <div className="crm-card" style={{ maxWidth: 720 }}>
      <div className="crm-card-header">
        <div className="crm-card-title">Nichos / Mercados</div>
      </div>
      {nichos.length === 0 ? (
        <div style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 4 }}>
          Nenhum nicho cadastrado
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
          {nichos.map((n, i) => (
            <Chip
              key={i}
              label={n}
              color="var(--accent)"
              onRemove={() => removeItem('crm_data/nichos', nichos, n)}
            />
          ))}
        </div>
      )}
      <AddInput
        value={novoNicho}
        onChange={setNovoNicho}
        placeholder="Ex: Clínicas, E-commerce..."
        onAdd={() =>
          addItem('crm_data/nichos', nichos, setNichos, novoNicho, setNovoNicho)
        }
      />
    </div>
  );

  /* ─────────────────────────────────────────────
     Tab: Regiões
  ───────────────────────────────────────────── */
  const renderRegioes = () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: 900 }}>
      {/* Estados */}
      <div className="crm-card">
        <div className="crm-card-header">
          <div className="crm-card-title">Estados</div>
        </div>
        {estados.length === 0 ? (
          <div style={{ color: 'var(--text3)', fontSize: 13 }}>Nenhum estado cadastrado</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {estados.map((e, i) => (
              <Chip
                key={i}
                label={e}
                color="var(--yellow)"
                onRemove={() => removeItem('crm_data/estados', estados, e)}
              />
            ))}
          </div>
        )}
        <AddInput
          value={novoEstado}
          onChange={setNovoEstado}
          placeholder="Ex: SP, RJ, MG..."
          onAdd={() =>
            addItem('crm_data/estados', estados, setEstados, novoEstado, setNovoEstado)
          }
        />
      </div>

      {/* Cidades */}
      <div className="crm-card">
        <div className="crm-card-header">
          <div className="crm-card-title">Cidades</div>
        </div>
        {cidades.length === 0 ? (
          <div style={{ color: 'var(--text3)', fontSize: 13 }}>Nenhuma cidade cadastrada</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {cidades.map((c, i) => (
              <Chip
                key={i}
                label={c}
                color="var(--purple)"
                onRemove={() => removeItem('crm_data/cidades', cidades, c)}
              />
            ))}
          </div>
        )}
        <AddInput
          value={novaCidade}
          onChange={setNovaCidade}
          placeholder="Ex: São Paulo, Campinas..."
          onAdd={() =>
            addItem('crm_data/cidades', cidades, setCidades, novaCidade, setNovaCidade)
          }
        />
      </div>
    </div>
  );

  /* ─────────────────────────────────────────────
     Tab: Empresa
  ───────────────────────────────────────────── */
  const renderEmpresa = () => (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <div className="crm-card">
        <div className="crm-card-header">
          <div className="crm-card-title">🏢 Dados da Empresa</div>
        </div>

        {/* Logo upload area (visual only) */}
        <div
          style={{
            border: '2px dashed var(--border2)',
            borderRadius: 12,
            padding: '24px',
            textAlign: 'center',
            marginBottom: 24,
            color: 'var(--text3)',
            fontSize: 13,
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 8 }}>📷</div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Upload de logo em breve</div>
          <div style={{ fontSize: 11 }}>PNG, JPG ou SVG até 2MB</div>
        </div>

        <div className="form-grid">
          <div className="form-group full">
            <label className="form-label">Nome da Empresa</label>
            <input
              className="form-control"
              value={empresa.nome || ''}
              onChange={(e) => setEmpresa((prev) => ({ ...prev, nome: e.target.value }))}
              placeholder="Ex: Grupo Portel"
            />
          </div>

          <div className="form-group">
            <label className="form-label">CNPJ</label>
            <input
              className="form-control"
              value={empresa.cnpj || ''}
              onChange={(e) => setEmpresa((prev) => ({ ...prev, cnpj: e.target.value }))}
              placeholder="00.000.000/0000-00"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Telefone</label>
            <input
              className="form-control"
              value={empresa.telefone || ''}
              onChange={(e) => setEmpresa((prev) => ({ ...prev, telefone: e.target.value }))}
              placeholder="(00) 00000-0000"
            />
          </div>

          <div className="form-group full">
            <label className="form-label">E-mail</label>
            <input
              className="form-control"
              type="email"
              value={empresa.email || ''}
              onChange={(e) => setEmpresa((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="contato@empresa.com"
            />
          </div>

          <div className="form-group full">
            <label className="form-label">Endereço</label>
            <textarea
              className="form-control"
              rows={2}
              value={empresa.endereco || ''}
              onChange={(e) => setEmpresa((prev) => ({ ...prev, endereco: e.target.value }))}
              placeholder="Rua, número, bairro, cidade - UF"
              style={{ resize: 'vertical' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 20 }}>
          <button className="btn btn-primary" onClick={salvarEmpresa}>
            💾 Salvar Alterações
          </button>
          {empresaSalva && (
            <span
              style={{
                fontSize: 13,
                color: 'var(--green)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              ✅ Alterações salvas!
            </span>
          )}
        </div>
      </div>
    </div>
  );

  /* ─────────────────────────────────────────────
     Tab: Usuários
  ───────────────────────────────────────────── */
  const convidarUsuario = () => {
    const email = window.prompt('E-mail do novo usuário:');
    if (!email) return;
    const nome = window.prompt('Nome do novo usuário:') || 'Novo Usuário';
    const novoUsuarioRef = push(ref(database, 'crm_data/usuarios'));
    set(novoUsuarioRef, {
      id: novoUsuarioRef.key,
      nome,
      email,
      role: 'Viewer',
      avatar: '👤'
    });
  };

  const renderUsuarios = () => (
    <div className="crm-card" style={{ maxWidth: 860 }}>
      <div
        className="crm-card-header"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <div className="crm-card-title">👥 Usuários do Sistema</div>
        <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={convidarUsuario}>
          + Convidar Usuário
        </button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="finance-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Usuário</th>
              <th>E-mail</th>
              <th>Permissão</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.length === 0 ? (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center', padding: 20, color: 'var(--text3)' }}>
                  Nenhum usuário cadastrado.
                </td>
              </tr>
            ) : usuarios.map((u) => {
              const badge = roleBadge(u.role);
              return (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: '50%',
                          background: 'var(--surface2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 16,
                          border: '1px solid var(--border)',
                          flexShrink: 0,
                        }}
                      >
                        {u.avatar || '👤'}
                      </div>
                      <span style={{ fontWeight: 600, color: 'var(--text)' }}>{u.nome}</span>
                    </div>
                  </td>
                  <td style={{ color: 'var(--text3)', fontSize: 13 }}>{u.email}</td>
                  <td>
                    <span
                      className="finance-badge"
                      style={{
                        background: badge.bg,
                        color: badge.color,
                        border: `1px solid ${badge.color}33`,
                      }}
                    >
                      {badge.label}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }}>
                      Editar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  /* ─────────────────────────────────────────────
     Render
  ───────────────────────────────────────────── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div className="page-header">
        <div>
          <div className="page-title">⚙️ Configurações</div>
          <div className="page-subtitle">Gerencie as configurações do seu CRM</div>
        </div>
      </div>

      <div className="page-content" style={{ overflowY: 'auto' }}>
        {/* Tab navigation */}
        <div className="config-tabs" style={{ marginBottom: 20 }}>
          {tabs.map((tab) => (
            <button
              key={tab}
              className={`config-tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'Pipeline' && renderPipeline()}
        {activeTab === 'Equipe' && renderEquipe()}
        {activeTab === 'Nichos' && renderNichos()}
        {activeTab === 'Regiões' && renderRegioes()}
        {activeTab === 'Empresa' && renderEmpresa()}
        {activeTab === 'Usuários' && renderUsuarios()}
      </div>
    </div>
  );
}
