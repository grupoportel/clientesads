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

export default function ConfigPage({ etapas = [], metas = {} }) {
  const [activeTab, setActiveTab] = useState('Pipeline');
  const tabs = ['Pipeline', 'Metas', 'Equipe', 'Nichos', 'Regiões', 'Empresa', 'Usuários'];

  // Rascunho local das etapas — só vai para o banco quando o usuário salvar
  const [rascunhoEtapas, setRascunhoEtapas] = useState(etapas);
  const [etapasSalvas, setEtapasSalvas] = useState(false);
  useEffect(() => { setRascunhoEtapas(etapas); }, [etapas]);

  const [rascunhoMetas, setRascunhoMetas] = useState(metas);
  const [metasSalvas, setMetasSalvas] = useState(false);
  useEffect(() => { setRascunhoMetas(metas); }, [metas]);

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
     Tab: Pipeline — agora grava de verdade
  ───────────────────────────────────────────── */
  const alterarEtapa = (id, campo, valor) => {
    setRascunhoEtapas(lista => lista.map(e => (e.id === id ? { ...e, [campo]: valor } : e)));
  };

  const moverEtapa = (indice, direcao) => {
    const destino = indice + direcao;
    if (destino < 0 || destino >= rascunhoEtapas.length) return;
    setRascunhoEtapas(lista => {
      const copia = [...lista];
      [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
      return copia;
    });
  };

  const salvarPipeline = () => {
    const paraSalvar = rascunhoEtapas.map((e, i) => ({
      id: e.id,
      label: e.label,
      cor: e.cor,
      probabilidade: Math.max(0, Math.min(100, Number(e.probabilidade) || 0)),
      ganho: !!e.ganho,
      perdido: !!e.perdido,
      ativo: e.ativo !== false,
      ordem: i,
    }));
    set(ref(database, 'crm_data/config/pipeline'), paraSalvar);
    setEtapasSalvas(true);
    setTimeout(() => setEtapasSalvas(false), 2500);
  };

  const renderPipeline = () => (
    <div className="crm-card" style={{ maxWidth: 860 }}>
      <div className="crm-card-header">
        <div>
          <div className="crm-card-title">Etapas do Pipeline</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4, maxWidth: 560, lineHeight: 1.5 }}>
            A <strong>chance de fechar</strong> de cada etapa é o que gera a previsão ponderada
            no Dashboard: um lead de R$ 10.000 em uma etapa de 40% entra na previsão como R$ 4.000.
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Cabeçalho da grade */}
        <div style={{
          display: 'grid', gridTemplateColumns: '54px 1fr 92px 96px 72px',
          gap: 10, padding: '0 14px 4px', fontSize: 10, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)',
        }}>
          <span>Ordem</span><span>Nome da etapa</span><span>Chance</span><span>Resultado</span><span>Ativa</span>
        </div>

        {rascunhoEtapas.map((etapa, idx) => (
          <div
            key={etapa.id}
            style={{
              display: 'grid', gridTemplateColumns: '54px 1fr 92px 96px 72px',
              gap: 10, alignItems: 'center', padding: '10px 14px', borderRadius: 10,
              background: 'var(--surface2)', border: '1px solid var(--border)',
              opacity: etapa.ativo === false ? 0.5 : 1,
            }}
          >
            {/* Reordenar */}
            <div style={{ display: 'flex', gap: 2 }}>
              <button
                onClick={() => moverEtapa(idx, -1)}
                disabled={idx === 0}
                title="Mover para cima"
                style={{
                  background: 'transparent', border: '1px solid var(--border)', borderRadius: 6,
                  color: 'var(--text3)', cursor: idx === 0 ? 'not-allowed' : 'pointer',
                  padding: '2px 6px', fontSize: 11, opacity: idx === 0 ? 0.35 : 1,
                }}
              >▲</button>
              <button
                onClick={() => moverEtapa(idx, 1)}
                disabled={idx === rascunhoEtapas.length - 1}
                title="Mover para baixo"
                style={{
                  background: 'transparent', border: '1px solid var(--border)', borderRadius: 6,
                  color: 'var(--text3)', cursor: idx === rascunhoEtapas.length - 1 ? 'not-allowed' : 'pointer',
                  padding: '2px 6px', fontSize: 11, opacity: idx === rascunhoEtapas.length - 1 ? 0.35 : 1,
                }}
              >▼</button>
            </div>

            {/* Nome + cor */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <input
                type="color"
                value={etapa.cor}
                onChange={e => alterarEtapa(etapa.id, 'cor', e.target.value)}
                title="Cor da etapa"
                style={{
                  width: 26, height: 26, padding: 0, border: '1px solid var(--border)',
                  borderRadius: 6, background: 'transparent', cursor: 'pointer', flexShrink: 0,
                }}
              />
              <input
                className="form-control"
                value={etapa.label}
                onChange={e => alterarEtapa(etapa.id, 'label', e.target.value)}
                style={{ fontSize: 13, padding: '5px 10px' }}
              />
            </div>

            {/* Probabilidade */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                className="form-control"
                type="number"
                min="0"
                max="100"
                value={etapa.probabilidade}
                onChange={e => alterarEtapa(etapa.id, 'probabilidade', e.target.value)}
                style={{ fontSize: 13, padding: '5px 8px', width: 62, textAlign: 'right' }}
              />
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>%</span>
            </div>

            {/* Resultado */}
            <select
              className="form-control"
              style={{ fontSize: 12, padding: '5px 8px' }}
              value={etapa.ganho ? 'ganho' : etapa.perdido ? 'perda' : 'aberto'}
              onChange={e => {
                const v = e.target.value;
                setRascunhoEtapas(lista => lista.map(x => x.id === etapa.id
                  ? { ...x, ganho: v === 'ganho', perdido: v === 'perda' }
                  : x));
              }}
              title="Define o que o sistema conta como fechamento, perda ou negócio em aberto"
            >
              <option value="aberto">Em aberto</option>
              <option value="ganho">Ganho</option>
              <option value="perda">Perda</option>
            </select>

            {/* Ativa */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text3)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={etapa.ativo !== false}
                onChange={e => alterarEtapa(etapa.id, 'ativo', e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              {etapa.ativo !== false ? 'Sim' : 'Não'}
            </label>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 20 }}>
        <button className="btn btn-primary" onClick={salvarPipeline}>💾 Salvar Pipeline</button>
        <button className="btn btn-ghost" onClick={() => setRascunhoEtapas(etapas)}>Descartar alterações</button>
        {etapasSalvas && (
          <span style={{ fontSize: 13, color: 'var(--green)' }}>✅ Pipeline salvo!</span>
        )}
      </div>

      <div style={{
        marginTop: 16, padding: '10px 14px', borderRadius: 8,
        background: 'var(--surface2)', border: '1px solid var(--border)',
        fontSize: 12, color: 'var(--text3)', lineHeight: 1.55,
      }}>
        Desativar uma etapa a esconde do Kanban e dos formulários, mas <strong>não apaga</strong> os
        leads que já estão nela — eles continuam contando nos relatórios.
      </div>
    </div>
  );

  /* ─────────────────────────────────────────────
     Tab: Metas
  ───────────────────────────────────────────── */
  const salvarMetas = () => {
    set(ref(database, 'crm_data/config/metas'), {
      receitaMensal: Number(rascunhoMetas.receitaMensal) || 0,
      novosLeadsMes: Number(rascunhoMetas.novosLeadsMes) || 0,
      reunioesMes:   Number(rascunhoMetas.reunioesMes) || 0,
    });
    setMetasSalvas(true);
    setTimeout(() => setMetasSalvas(false), 2500);
  };

  const campoMeta = (chave, rotulo, dica, prefixo = '') => (
    <div className="form-group">
      <label className="form-label">{rotulo}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {prefixo && <span style={{ color: 'var(--text3)', fontSize: 14 }}>{prefixo}</span>}
        <input
          className="form-control"
          type="number"
          min="0"
          value={rascunhoMetas[chave] ?? ''}
          onChange={e => setRascunhoMetas(m => ({ ...m, [chave]: e.target.value }))}
          placeholder="0"
        />
      </div>
      <span style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, display: 'block' }}>{dica}</span>
    </div>
  );

  const renderMetas = () => (
    <div className="crm-card" style={{ maxWidth: 620 }}>
      <div className="crm-card-header">
        <div>
          <div className="crm-card-title">🎯 Metas do Mês</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
            Antes essas metas estavam fixas no código e mudá-las exigia um novo deploy.
          </div>
        </div>
      </div>

      <div className="form-grid">
        {campoMeta('receitaMensal', 'Meta de receita mensal', 'Usada no anel de progresso do Financeiro e no card do Dashboard.', 'R$')}
        {campoMeta('novosLeadsMes', 'Meta de novos leads no mês', 'Quantos leads novos a equipe deve trazer por mês.')}
        {campoMeta('reunioesMes', 'Meta de reuniões no mês', 'Quantas reuniões devem ser marcadas por mês.')}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 20 }}>
        <button className="btn btn-primary" onClick={salvarMetas}>💾 Salvar Metas</button>
        {metasSalvas && <span style={{ fontSize: 13, color: 'var(--green)' }}>✅ Metas salvas!</span>}
      </div>
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
        {activeTab === 'Metas' && renderMetas()}
        {activeTab === 'Equipe' && renderEquipe()}
        {activeTab === 'Nichos' && renderNichos()}
        {activeTab === 'Regiões' && renderRegioes()}
        {activeTab === 'Empresa' && renderEmpresa()}
        {activeTab === 'Usuários' && renderUsuarios()}
      </div>
    </div>
  );
}
