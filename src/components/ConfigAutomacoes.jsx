import { useState } from 'react';
import { ref, push, set, remove, update } from 'firebase/database';
import { database } from '../firebase';
import { etapasAtivas } from '../pipeline';
import { GATILHOS, TIPOS_TAREFA, CAMPOS_DEFINIVEIS, descreverRegra, regraValida } from '../automacoes';
import { VARIAVEIS } from '../modelos';

const REGRA_VAZIA = {
  nome: '',
  ativa: true,
  gatilho: { tipo: 'statusMudou', para: '', de: '' },
  condicoes: {},
  acoes: [{ tipo: 'criarTarefa', titulo: '', tipoTarefa: 'followup', prazoDias: 2, responsavel: 'doLead' }],
};

// Modelos prontos: começar do zero diante de "gatilho" e "ação" trava qualquer um
const RECEITAS = [
  {
    nome: 'Follow-up depois da reunião',
    gatilho: { tipo: 'statusMudou', para: 'reuniao-marcada', de: '' },
    acoes: [{ tipo: 'criarTarefa', titulo: 'Follow-up com {{primeiroNome}}', tipoTarefa: 'ligacao', prazoDias: 2, prioridade: 'alta', responsavel: 'doLead' }],
  },
  {
    nome: 'Primeiro contato em lead novo',
    gatilho: { tipo: 'leadCriado' },
    acoes: [{ tipo: 'criarTarefa', titulo: 'Primeiro contato com {{nome}}', tipoTarefa: 'ligacao', prazoDias: 0, prioridade: 'alta', responsavel: 'doLead' }],
  },
  {
    nome: 'Cobrar retorno da proposta',
    gatilho: { tipo: 'statusMudou', para: 'contrato-realizado', de: '' },
    acoes: [{ tipo: 'criarTarefa', titulo: 'Confirmar assinatura — {{nome}}', tipoTarefa: 'followup', prazoDias: 3, prioridade: 'alta', responsavel: 'doLead' }],
  },
];

export default function ConfigAutomacoes({ automacoes = [], etapas = [], responsaveis = [], nichos = [] }) {
  const [emEdicao, setEmEdicao] = useState(null);
  const [rascunho, setRascunho] = useState(REGRA_VAZIA);

  const abrirNova = (base = REGRA_VAZIA) => {
    setRascunho(JSON.parse(JSON.stringify(base)));
    setEmEdicao('nova');
  };
  const abrirEdicao = (r) => { setRascunho(JSON.parse(JSON.stringify(r))); setEmEdicao(r.id); };
  const fechar = () => { setEmEdicao(null); setRascunho(REGRA_VAZIA); };

  const salvar = () => {
    if (!rascunho.nome.trim() || !regraValida(rascunho)) return;
    const agora = new Date().toISOString();
    if (emEdicao === 'nova') {
      const novaRef = push(ref(database, 'crm_data/automacoes'));
      set(novaRef, { ...rascunho, id: novaRef.key, criadoEm: agora });
    } else {
      set(ref(database, 'crm_data/automacoes/' + emEdicao), { ...rascunho, id: emEdicao, atualizadoEm: agora });
    }
    fechar();
  };

  const alternarAtiva = (r) => {
    update(ref(database, 'crm_data/automacoes/' + r.id), { ativa: r.ativa === false });
  };

  const excluir = (r) => {
    if (window.confirm(`Excluir a automação "${r.nome}"?\n\nAs tarefas que ela já criou continuam onde estão.`)) {
      remove(ref(database, 'crm_data/automacoes/' + r.id));
      if (emEdicao === r.id) fechar();
    }
  };

  const alterarAcao = (i, campo, valor) => {
    setRascunho(r => ({
      ...r,
      acoes: r.acoes.map((a, idx) => (idx === i ? { ...a, [campo]: valor } : a)),
    }));
  };

  const addAcao = () => setRascunho(r => ({
    ...r,
    acoes: [...r.acoes, { tipo: 'criarTarefa', titulo: '', tipoTarefa: 'followup', prazoDias: 1, responsavel: 'doLead' }],
  }));

  const removerAcao = (i) => setRascunho(r => ({ ...r, acoes: r.acoes.filter((_, idx) => idx !== i) }));

  const gatilhoPrecisaEtapa = GATILHOS[rascunho.gatilho?.tipo]?.precisaEtapa;
  const podeSalvar = rascunho.nome.trim() && regraValida(rascunho);

  return (
    <div style={{ maxWidth: 900 }}>

      {/* ── Lista ── */}
      <div className="crm-card" style={{ marginBottom: emEdicao ? 20 : 0 }}>
        <div className="crm-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div className="crm-card-title">⚡ Automações</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4, maxWidth: 520, lineHeight: 1.55 }}>
              Regras que rodam sozinhas quando algo acontece no CRM. Elas são
              avaliadas <strong>enquanto alguém está com o sistema aberto</strong> — não
              há servidor por trás, então uma regra não dispara de madrugada.
            </div>
          </div>
          <button className="btn btn-primary" style={{ fontSize: 12.5, flexShrink: 0 }} onClick={() => abrirNova()}>
            + Nova regra
          </button>
        </div>

        {automacoes.length === 0 ? (
          <div style={{ padding: '10px 0 4px' }}>
            <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13, marginBottom: 18, lineHeight: 1.6 }}>
              <div style={{ fontSize: 30, marginBottom: 10 }}>⚡</div>
              Nenhuma automação ainda. Comece por uma pronta:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 10 }}>
              {RECEITAS.map(receita => (
                <button
                  key={receita.nome}
                  onClick={() => abrirNova({ ...REGRA_VAZIA, ...receita })}
                  style={{
                    textAlign: 'left', padding: '13px 15px', borderRadius: 10, cursor: 'pointer',
                    background: 'var(--surface2)', border: '1px dashed var(--border2)',
                    fontFamily: 'inherit', transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border2)'}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 5 }}>
                    {receita.nome}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.45 }}>
                    {descreverRegra(receita, etapas)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {automacoes.map(r => {
              const ativa = r.ativa !== false;
              return (
                <div
                  key={r.id}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    padding: '13px 15px', borderRadius: 10,
                    background: emEdicao === r.id ? 'rgba(0,208,223,0.08)' : 'var(--surface2)',
                    border: `1px solid ${emEdicao === r.id ? 'rgba(0,208,223,0.3)' : 'var(--border)'}`,
                    opacity: ativa ? 1 : 0.55,
                  }}
                >
                  <button
                    onClick={() => alternarAtiva(r)}
                    title={ativa ? 'Desativar' : 'Ativar'}
                    style={{
                      width: 36, height: 20, borderRadius: 20, flexShrink: 0, marginTop: 2,
                      border: 'none', cursor: 'pointer', padding: 0, position: 'relative',
                      background: ativa ? 'var(--green)' : 'var(--surface3)',
                      transition: 'background 0.15s',
                    }}
                  >
                    <span style={{
                      position: 'absolute', top: 2, left: ativa ? 18 : 2,
                      width: 16, height: 16, borderRadius: '50%', background: '#fff',
                      transition: 'left 0.15s',
                    }} />
                  </button>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>
                      {r.nome}
                      {!ativa && <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}> · pausada</span>}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 3, lineHeight: 1.45 }}>
                      {descreverRegra(r, etapas)}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button className="btn btn-ghost" style={{ fontSize: 11.5, padding: '3px 9px' }} onClick={() => abrirEdicao(r)}>Editar</button>
                    <button className="btn btn-danger" style={{ fontSize: 11.5, padding: '3px 9px' }} onClick={() => excluir(r)}>🗑</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Editor ── */}
      {emEdicao && (
        <div className="crm-card">
          <div className="crm-card-header">
            <div className="crm-card-title">{emEdicao === 'nova' ? 'Nova automação' : 'Editar automação'}</div>
          </div>

          <div className="form-grid">
            <div className="form-group full">
              <label className="form-label">Nome da regra</label>
              <input
                className="form-control"
                value={rascunho.nome}
                onChange={e => setRascunho(r => ({ ...r, nome: e.target.value }))}
                placeholder="Ex: Follow-up depois da reunião"
                autoFocus
              />
            </div>
          </div>

          {/* Gatilho */}
          <div className="form-section-title" style={{ marginTop: 18 }}>⚡ Quando</div>
          <div className="form-grid">
            <div className="form-group full">
              <label className="form-label">Acontecer isto</label>
              <select
                className="form-control"
                value={rascunho.gatilho.tipo}
                onChange={e => setRascunho(r => ({ ...r, gatilho: { tipo: e.target.value, para: '', de: '' } }))}
              >
                {Object.entries(GATILHOS).map(([chave, g]) => (
                  <option key={chave} value={chave}>{g.rotulo}</option>
                ))}
              </select>
            </div>

            {gatilhoPrecisaEtapa && (
              <>
                <div className="form-group">
                  <label className="form-label">Nova etapa <span style={{ color: 'var(--red)' }}>*</span></label>
                  <select
                    className="form-control"
                    value={rascunho.gatilho.para || ''}
                    onChange={e => setRascunho(r => ({ ...r, gatilho: { ...r.gatilho, para: e.target.value } }))}
                  >
                    <option value="">— escolha —</option>
                    {etapasAtivas(etapas).map(et => <option key={et.id} value={et.id}>{et.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Vindo de</label>
                  <select
                    className="form-control"
                    value={rascunho.gatilho.de || ''}
                    onChange={e => setRascunho(r => ({ ...r, gatilho: { ...r.gatilho, de: e.target.value } }))}
                  >
                    <option value="">Qualquer etapa</option>
                    {etapasAtivas(etapas).map(et => <option key={et.id} value={et.id}>{et.label}</option>)}
                  </select>
                </div>
              </>
            )}
          </div>

          {/* Condições */}
          <div className="form-section-title" style={{ marginTop: 18 }}>
            🔍 Só para estes leads <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(opcional)</span>
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Nicho</label>
              <select
                className="form-control"
                value={rascunho.condicoes?.nicho || ''}
                onChange={e => setRascunho(r => ({ ...r, condicoes: { ...r.condicoes, nicho: e.target.value } }))}
              >
                <option value="">Qualquer nicho</option>
                {nichos.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Valor mínimo (R$)</label>
              <input
                className="form-control" type="number" min="0"
                value={rascunho.condicoes?.valorMinimo || ''}
                onChange={e => setRascunho(r => ({ ...r, condicoes: { ...r.condicoes, valorMinimo: e.target.value } }))}
                placeholder="Sem mínimo"
              />
            </div>
          </div>

          {/* Ações */}
          <div className="form-section-title" style={{ marginTop: 18 }}>✅ Faça isto</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {rascunho.acoes.map((acao, i) => (
              <div key={i} style={{
                padding: '13px 15px', borderRadius: 10,
                background: 'var(--surface2)', border: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                  <select
                    className="form-control"
                    style={{ fontSize: 12.5, padding: '5px 9px', width: 'auto' }}
                    value={acao.tipo}
                    onChange={e => alterarAcao(i, 'tipo', e.target.value)}
                  >
                    <option value="criarTarefa">Criar uma tarefa</option>
                    <option value="definirCampo">Preencher um campo do lead</option>
                    <option value="registrarNota">Anotar na linha do tempo</option>
                  </select>
                  {rascunho.acoes.length > 1 && (
                    <button
                      onClick={() => removerAcao(i)}
                      style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 12 }}
                    >
                      Remover
                    </button>
                  )}
                </div>

                {acao.tipo === 'criarTarefa' && (
                  <div className="form-grid">
                    <div className="form-group full">
                      <label className="form-label">Título da tarefa</label>
                      <input
                        className="form-control"
                        value={acao.titulo || ''}
                        onChange={e => alterarAcao(i, 'titulo', e.target.value)}
                        placeholder="Follow-up com {{primeiroNome}}"
                      />
                      <span style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, display: 'block' }}>
                        Aceita variáveis: {VARIAVEIS.slice(0, 4).map(v => `{{${v.chave}}}`).join(', ')}…
                      </span>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Tipo</label>
                      <select className="form-control" value={acao.tipoTarefa || 'followup'} onChange={e => alterarAcao(i, 'tipoTarefa', e.target.value)}>
                        {TIPOS_TAREFA.map(t => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Para daqui a</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <input
                          className="form-control" type="number" min="0" style={{ width: 80 }}
                          value={acao.prazoDias ?? 1}
                          onChange={e => alterarAcao(i, 'prazoDias', e.target.value)}
                        />
                        <span style={{ fontSize: 12.5, color: 'var(--text3)' }}>dias</span>
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Responsável</label>
                      <select className="form-control" value={acao.responsavel || 'doLead'} onChange={e => alterarAcao(i, 'responsavel', e.target.value)}>
                        <option value="doLead">Quem cuida do lead</option>
                        <option value="">Ninguém</option>
                        {responsaveis.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Prioridade</label>
                      <select className="form-control" value={acao.prioridade || 'media'} onChange={e => alterarAcao(i, 'prioridade', e.target.value)}>
                        <option value="alta">🔴 Alta</option>
                        <option value="media">🟡 Média</option>
                        <option value="baixa">🟢 Baixa</option>
                      </select>
                    </div>
                  </div>
                )}

                {acao.tipo === 'definirCampo' && (
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">Campo</label>
                      <select className="form-control" value={acao.campo || ''} onChange={e => alterarAcao(i, 'campo', e.target.value)}>
                        <option value="">— escolha —</option>
                        {CAMPOS_DEFINIVEIS.map(c => <option key={c.campo} value={c.campo}>{c.rotulo}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Valor</label>
                      <input className="form-control" value={acao.valor || ''} onChange={e => alterarAcao(i, 'valor', e.target.value)} />
                    </div>
                    <div className="form-group full">
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text3)', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={!!acao.sobrescrever}
                          onChange={e => alterarAcao(i, 'sobrescrever', e.target.checked)}
                          style={{ cursor: 'pointer' }}
                        />
                        Sobrescrever mesmo se o campo já estiver preenchido
                      </label>
                    </div>
                  </div>
                )}

                {acao.tipo === 'registrarNota' && (
                  <div className="form-grid">
                    <div className="form-group full">
                      <label className="form-label">Texto da anotação</label>
                      <input
                        className="form-control"
                        value={acao.texto || ''}
                        onChange={e => alterarAcao(i, 'texto', e.target.value)}
                        placeholder="Entrou na etapa de negociação"
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}

            <button
              onClick={addAcao}
              style={{
                padding: '9px', borderRadius: 9, border: '1px dashed var(--border2)',
                background: 'transparent', color: 'var(--text3)', fontSize: 12.5,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              + Adicionar outra ação
            </button>
          </div>

          {/* Resumo em português */}
          <div style={{
            marginTop: 18, padding: '12px 15px', borderRadius: 10,
            background: podeSalvar ? 'rgba(0,208,223,0.08)' : 'var(--surface2)',
            border: `1px solid ${podeSalvar ? 'rgba(0,208,223,0.3)' : 'var(--border)'}`,
            fontSize: 13, color: 'var(--text2)', lineHeight: 1.55,
          }}>
            <strong style={{ color: podeSalvar ? 'var(--accent)' : 'var(--text3)' }}>Resumo: </strong>
            {podeSalvar ? descreverRegra(rascunho, etapas) : 'Preencha o nome, o gatilho e ao menos uma ação.'}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button
              className="btn btn-primary"
              onClick={salvar}
              disabled={!podeSalvar}
              style={{ opacity: podeSalvar ? 1 : 0.5 }}
            >
              💾 Salvar automação
            </button>
            <button className="btn btn-ghost" onClick={fechar}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
