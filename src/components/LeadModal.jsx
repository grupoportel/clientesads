import React, { useEffect, useState } from 'react';
import AnaliseIA from './AnaliseIA';
import { hojeISO } from '../periodo';

import { etapasAtivas, acharEtapa, formatarBRL } from '../pipeline';
import {
  CADENCIAS, CAMPOS_PROSPECCAO_INICIAIS, pendenciasParaStatus,
} from '../processoProspeccao';

const CAMPOS_INICIAIS = {
  nome: '', status: 'nenhum', valor: '', nicho: '', estado: '', cidade: '', origem: '',
  responsavel: '', decisor: '', cnpj: '', telefone: '', whatsapp: '', email: '',
  instagram: '', ig_dono: '', site: '', nota: '', avaliacoes: '', data_entrada: '',
  ultimo_contato: '', reuniao: '', melhores: '', oportunidades: '', pontos: '',
  escalar: '', obs: '', motivoPerda: '', historico: '',
  ...CAMPOS_PROSPECCAO_INICIAIS,
};

const PREFIXO_RASCUNHO = 'clientesads:rascunho-lead:';
const marcado = (valor) => valor === true || valor === 'true';

function carregarRascunho(chave, dadosIniciais) {
  try {
    const salvo = window.localStorage.getItem(chave);
    return salvo ? { ...dadosIniciais, ...JSON.parse(salvo) } : dadosIniciais;
  } catch {
    return dadosIniciais;
  }
}

function guardarRascunho(chave, dados) {
  try {
    window.localStorage.setItem(chave, JSON.stringify(dados));
  } catch {
    // O formulário continua funcionando mesmo se o navegador bloquear storage.
  }
}

function removerRascunho(chave) {
  try {
    window.localStorage.removeItem(chave);
  } catch {
    // Sem ação: o salvamento no banco continua sendo a fonte de verdade.
  }
}

// Recebemos as listas do Firebase (nichos, responsaveis, etc.)
export default function LeadModal({ isOpen, onClose, onSave, leadAtual, nichos = [], responsaveis = [], estados = [], cidades = [], etapas = [] }) {
  // O App remonta este modal via key a cada abertura, então o estado inicial é
  // calculado uma vez na montagem — sem efeito que dispara um render extra.
  const [configRascunho] = useState(() => {
    const dadosIniciais = leadAtual
      ? { ...CAMPOS_INICIAIS, ...leadAtual }
      : { ...CAMPOS_INICIAIS, data_entrada: hojeISO() };
    const chave = `${PREFIXO_RASCUNHO}${leadAtual?.id || 'novo'}`;
    return { chave, dadosIniciais, dados: carregarRascunho(chave, dadosIniciais) };
  });
  const [formData, setFormData] = useState(configRascunho.dados);
  const [salvando, setSalvando] = useState(false);

  const alterado = JSON.stringify(formData) !== JSON.stringify(configRascunho.dadosIniciais);

  useEffect(() => {
    if (!alterado) return undefined;
    const timer = window.setTimeout(() => {
      guardarRascunho(configRascunho.chave, formData);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [alterado, configRascunho.chave, formData]);

  useEffect(() => {
    if (!alterado) return undefined;
    const avisarSaida = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', avisarSaida);
    return () => window.removeEventListener('beforeunload', avisarSaida);
  }, [alterado]);

  const handleChange = (e) => {
    const { name, type, checked, value } = e.target;
    setFormData(atual => {
      const proximo = { ...atual, [name]: type === 'checkbox' ? checked : value };
      if (name === 'reuniaoDataHora') proximo.reuniao = value.slice(0, 10);
      if (name === 'confirmacaoExplicita') {
        proximo.confirmadoEm = checked ? (atual.confirmadoEm || new Date().toISOString()) : '';
      }
      return proximo;
    });
  };

  const handleClose = () => {
    if (alterado && !window.confirm('As alterações ainda não foram salvas no cadastro. O rascunho ficará guardado para você continuar depois. Deseja fechar?')) {
      return;
    }
    guardarRascunho(configRascunho.chave, formData);
    onClose();
  };

  const handleSave = async () => {
    if (salvando) return;
    setSalvando(true);
    try {
      const salvo = await onSave(formData);
      if (salvo) removerRascunho(configRascunho.chave);
    } finally {
      setSalvando(false);
    }
  };

  if (!isOpen) return null;

  const etapaAtual = acharEtapa(etapas, formData.status);
  const pendenciasEtapa = pendenciasParaStatus(formData, formData.status);

  return (
    <div className="modal-overlay">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        
        <div className="modal-header">
          <div className="modal-title">{leadAtual ? 'Editar Lead' : 'Novo Lead'}</div>
          <button className="btn-icon" onClick={handleClose} aria-label="Fechar cadastro do lead">✕</button>
        </div>

        <div className="modal-body">
          <div className="form-grid">

            <div className="form-section-title">🏢 Dados Principais</div>

            <div className="form-group">
              <label>Nome / Empresa *</label>
              <input className="form-control" name="nome" value={formData.nome} onChange={handleChange} placeholder="CLIPS - Clínica..." />
            </div>
            
            <div className="form-group">
              <label>Status</label>
              <select className="form-control" name="status" value={formData.status} onChange={handleChange}>
                {etapasAtivas(etapas).map(e => (
                  <option key={e.id} value={e.id}>{e.label}</option>
                ))}
              </select>
              {pendenciasEtapa.length > 0 && formData.status !== 'nenhum' && (
                <span className="playbook-pendencias" role="status">
                  Falta para esta etapa: {pendenciasEtapa.join(', ')}.
                </span>
              )}
            </div>

            <div className="form-group">
              <label>Valor do Negócio (R$)</label>
              <input
                className="form-control"
                name="valor"
                type="number"
                min="0"
                step="100"
                value={formData.valor}
                onChange={handleChange}
                placeholder="Ex: 2500"
              />
              <span style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, display: 'block' }}>
                {Number(formData.valor) > 0
                  ? `Nesta etapa a chance é de ${etapaAtual.probabilidade}% — previsão de ${formatarBRL(Number(formData.valor) * etapaAtual.probabilidade / 100)}`
                  : 'Sem valor, este lead não entra na previsão de receita.'}
              </span>
            </div>

            {/* NICHO MUDOU PARA DROPDOWN */}
            <div className="form-group">
              <label>Nicho / Mercado</label>
              <select className="form-control" name="nicho" value={formData.nicho} onChange={handleChange}>
                <option value="">— selecione —</option>
                {nichos.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            
            <div className="form-group">
              <label>Origem / Canal</label>
              <select className="form-control" name="origem" value={formData.origem} onChange={handleChange}>
                <option value="">— selecione —</option>
                <option value="gmn">GMN</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="instagram">Instagram</option>
                <option value="telefone">Telefone / Ligação</option>
                <option value="email">E-mail</option>
                <option value="indicacao">Indicação</option>
                <option value="site">Site / Inbound</option>
                <option value="outro">Outro</option>
              </select>
            </div>

            {/* RESPONSAVEL MUDOU PARA DROPDOWN */}
            <div className="form-group">
              <label>Responsável</label>
              <select className="form-control" name="responsavel" value={formData.responsavel} onChange={handleChange}>
                <option value="">— selecione —</option>
                {responsaveis.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Decisor (Nome)</label>
              <input className="form-control" name="decisor" value={formData.decisor} onChange={handleChange} placeholder="Dra. Marina" />
            </div>

            <div className="form-group">
              <label>Papel do decisor</label>
              <input className="form-control" name="decisorPapel" value={formData.decisorPapel} onChange={handleChange} placeholder="Ex: sócia e responsável pela decisão" />
            </div>

            {/* ESTADO E CIDADE MUDARAM PARA DROPDOWN */}
            <div className="form-group">
              <label>Estado</label>
              <select className="form-control" name="estado" value={formData.estado} onChange={handleChange}>
                <option value="">— selecione —</option>
                {estados.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Cidade</label>
              <select className="form-control" name="cidade" value={formData.cidade} onChange={handleChange}>
                <option value="">— selecione —</option>
                {cidades.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            
            <div className="form-group">
              <label>CNPJ</label>
              <input className="form-control" name="cnpj" value={formData.cnpj} onChange={handleChange} placeholder="00.000.000/0001-00" />
            </div>

            <div className="form-section-title">🧭 Preparação da prospecção</div>

            <div className="form-group">
              <label>Cadência A, B ou C</label>
              <select className="form-control" name="prioridadeProspeccao" value={formData.prioridadeProspeccao} onChange={handleChange}>
                <option value="">— classifique a conta —</option>
                {Object.entries(CADENCIAS).map(([id, c]) => (
                  <option key={id} value={id}>{c.rotulo} · até {c.contatos} contatos/{c.diasUteis} dias úteis</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Objetivo deste contato</label>
              <input className="form-control" name="objetivoContato" value={formData.objetivoContato} onChange={handleChange} placeholder="Ex: validar como os pedidos são atendidos" />
            </div>

            <div className="form-group full">
              <label>Evidência observável</label>
              <textarea className="form-control" name="evidencia" value={formData.evidencia} onChange={handleChange} placeholder="Fato verificável, sem inventar dor: ex. site sem botão de contato e avaliações sem resposta." />
            </div>

            <div className="form-group full">
              <label>Hipótese a validar</label>
              <textarea className="form-control" name="hipotese" value={formData.hipotese} onChange={handleChange} placeholder="Ex: talvez oportunidades sejam perdidas por demora no primeiro retorno." />
            </div>

            <div className="form-group">
              <label>Processo atual</label>
              <input className="form-control" name="processoAtual" value={formData.processoAtual} onChange={handleChange} placeholder="Como fazem hoje?" />
            </div>

            <div className="form-group">
              <label>Problema confirmado?</label>
              <select className="form-control" name="problemaConfirmado" value={formData.problemaConfirmado} onChange={handleChange}>
                <option value="">— ainda não validado —</option>
                <option value="sim">Sim, confirmado pelo contato</option>
                <option value="nao">Não</option>
              </select>
            </div>

            <div className="form-group full">
              <label>Impacto percebido</label>
              <textarea className="form-control" name="impacto" value={formData.impacto} onChange={handleChange} placeholder="Tempo, receita, retrabalho ou risco citado pelo prospect." />
            </div>

            <div className="form-group full">
              <label>Momento e prioridade do prospect</label>
              <textarea className="form-control" name="momento" value={formData.momento} onChange={handleChange} placeholder="Por que resolver agora — ou por que ainda não?" />
            </div>

            <div className="form-section-title">📞 Contato</div>

            <div className="form-group">
              <label>Telefone</label>
              <input className="form-control" name="telefone" type="tel" value={formData.telefone} onChange={handleChange} placeholder="(66) 3015-0955" />
            </div>
            <div className="form-group">
              <label>WhatsApp</label>
              <input className="form-control" name="whatsapp" type="tel" value={formData.whatsapp} onChange={handleChange} placeholder="(66) 99886-2626" />
            </div>
            <label className="form-check full">
              <input type="checkbox" name="permissaoWhatsApp" checked={marcado(formData.permissaoWhatsApp)} onChange={handleChange} />
              <span><strong>WhatsApp autorizado</strong><small>Marque apenas quando o prospect permitiu, iniciou o contato ou já havia relacionamento.</small></span>
            </label>
            {marcado(formData.permissaoWhatsApp) && (
              <div className="form-group full">
                <label>Como a permissão foi obtida?</label>
                <input className="form-control" name="origemPermissaoWhatsApp" value={formData.origemPermissaoWhatsApp} onChange={handleChange} placeholder="Ex: autorizou na ligação de 10/09" />
              </div>
            )}
            <label className="form-check full form-check-danger">
              <input type="checkbox" name="optOut" checked={marcado(formData.optOut)} onChange={handleChange} />
              <span><strong>Não quer mais contato (opt-out)</strong><small>Bloqueia novas abordagens e o avanço na prospecção.</small></span>
            </label>
            <div className="form-group">
              <label>E-mail</label>
              <input className="form-control" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="contato@empresa.com" />
            </div>
            <div className="form-group">
              <label>Instagram Empresa (@)</label>
              <input className="form-control" name="instagram" value={formData.instagram} onChange={handleChange} placeholder="@clinica" />
            </div>
            <div className="form-group">
              <label>Instagram Dono (@)</label>
              <input className="form-control" name="ig_dono" value={formData.ig_dono} onChange={handleChange} placeholder="@dono" />
            </div>
            <div className="form-group">
              <label>Site</label>
              <input className="form-control" name="site" value={formData.site} onChange={handleChange} placeholder="https://..." />
            </div>

            <div className="form-section-title">⭐ Avaliações Google</div>
            <div className="form-group">
              <label>Nota (0-5)</label>
              <input className="form-control" name="nota" type="number" step="0.1" value={formData.nota} onChange={handleChange} placeholder="4.5" />
            </div>
            <div className="form-group">
              <label>Qtd. Avaliações</label>
              <input className="form-control" name="avaliacoes" type="number" value={formData.avaliacoes} onChange={handleChange} placeholder="67" />
            </div>

            <div className="form-section-title">✅ Próxima ação obrigatória</div>
            <div className="form-group">
              <label>Ação concreta</label>
              <input className="form-control" name="proximaAcao" value={formData.proximaAcao} onChange={handleChange} placeholder="Ex: ligar para Marina" />
            </div>
            <div className="form-group">
              <label>Data e hora</label>
              <input className="form-control" name="proximaAcaoDataHora" type="datetime-local" value={formData.proximaAcaoDataHora} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Canal</label>
              <select className="form-control" name="proximaAcaoCanal" value={formData.proximaAcaoCanal} onChange={handleChange}>
                <option value="">— selecione —</option>
                <option value="telefone">Ligação</option>
                <option value="email">E-mail</option>
                <option value="whatsapp">WhatsApp (somente com permissão)</option>
                <option value="instagram">Instagram</option>
                <option value="reuniao">Reunião</option>
              </select>
            </div>
            <div className="form-group">
              <label>Responsável pela ação</label>
              <select className="form-control" name="proximaAcaoResponsavel" value={formData.proximaAcaoResponsavel} onChange={handleChange}>
                <option value="">— usa o responsável do lead —</option>
                {responsaveis.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="form-group full">
              <label>Objetivo da próxima ação</label>
              <input className="form-control" name="proximaAcaoObjetivo" value={formData.proximaAcaoObjetivo} onChange={handleChange} placeholder="O que precisa acontecer neste contato?" />
            </div>

            <div className="form-section-title">📅 Datas e reunião</div>
            <div className="form-group">
              <label>Data de Entrada</label>
              <input className="form-control" name="data_entrada" type="date" value={formData.data_entrada} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Último Contato</label>
              <input className="form-control" name="ultimo_contato" type="date" value={formData.ultimo_contato} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Data e hora da reunião</label>
              <input className="form-control" name="reuniaoDataHora" type="datetime-local" value={formData.reuniaoDataHora} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Duração prevista</label>
              <select className="form-control" name="reuniaoDuracaoMin" value={formData.reuniaoDuracaoMin} onChange={handleChange}>
                {[30, 45, 60, 90].map(d => <option key={d} value={d}>{d} minutos</option>)}
              </select>
            </div>
            <div className="form-group full">
              <label>Objetivo da reunião</label>
              <input className="form-control" name="reuniaoObjetivo" value={formData.reuniaoObjetivo} onChange={handleChange} placeholder="Ex: mapear o fluxo atual e confirmar o gargalo" />
            </div>
            <div className="form-group">
              <label>Participantes</label>
              <input className="form-control" name="reuniaoParticipantes" value={formData.reuniaoParticipantes} onChange={handleChange} placeholder="Marina, Guilherme" />
            </div>
            <div className="form-group">
              <label>Link ou local</label>
              <input className="form-control" name="reuniaoLinkLocal" value={formData.reuniaoLinkLocal} onChange={handleChange} placeholder="Google Meet ou endereço" />
            </div>
            <label className="form-check">
              <input type="checkbox" name="conviteEnviado" checked={marcado(formData.conviteEnviado)} onChange={handleChange} />
              <span><strong>Convite/link enviado</strong><small>Necessário para considerar a reunião marcada.</small></span>
            </label>
            <label className="form-check">
              <input type="checkbox" name="confirmacaoExplicita" checked={marcado(formData.confirmacaoExplicita)} onChange={handleChange} />
              <span><strong>Participante confirmou</strong><small>Somente aceite explícito transforma “marcada” em “confirmada”.</small></span>
            </label>

            <div className="form-section-title">🎯 Análise & Estratégia</div>

            <AnaliseIA
              lead={formData}
              valoresAtuais={formData}
              aoAceitar={(campo, texto) => setFormData(f => ({ ...f, [campo]: texto }))}
            />

            <div className="form-group full">
              <label>Melhores Conteúdos</label>
              <textarea className="form-control" name="melhores" value={formData.melhores} onChange={handleChange} />
            </div>
            <div className="form-group full">
              <label>O que pode melhorar / Oportunidades</label>
              <textarea className="form-control" name="oportunidades" value={formData.oportunidades} onChange={handleChange} />
            </div>
            <div className="form-group full">
              <label>Pontos Fortes / Diferencial</label>
              <textarea className="form-control" name="pontos" value={formData.pontos} onChange={handleChange} />
            </div>
            <div className="form-group full">
              <label>Tem como Escalar?</label>
              <textarea className="form-control" name="escalar" value={formData.escalar} onChange={handleChange} />
            </div>
            <div className="form-group full">
              <label>Observação Geral</label>
              <textarea className="form-control" name="obs" value={formData.obs} onChange={handleChange} />
            </div>
            {/* Campo aposentado: a linha do tempo registra tudo sozinha desde a
                Fase 2. Só aparece quando já existe conteúdo antigo, e em modo
                leitura — manter os dois editáveis convidava a divergirem. */}
            {formData.historico && (
              <div className="form-group full">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  Histórico de Contatos
                  <span style={{
                    fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                    letterSpacing: '0.06em', color: 'var(--text3)',
                    background: 'var(--surface2)', border: '1px solid var(--border)',
                    borderRadius: 4, padding: '2px 7px',
                  }}>
                    Anotação antiga
                  </span>
                </label>
                <textarea
                  className="form-control"
                  name="historico"
                  value={formData.historico}
                  readOnly
                  style={{ opacity: 0.75, cursor: 'default' }}
                />
                <span style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, display: 'block', lineHeight: 1.5 }}>
                  Preservado do jeito que estava. As interações a partir de agora
                  entram sozinhas na Linha do Tempo, no painel de detalhe do lead.
                </span>
              </div>
            )}

            <div className="form-group full">
              <label>Motivo de Perda (se aplicável)</label>
              <select className="form-control" name="motivoPerda" value={formData.motivoPerda} onChange={handleChange}>
                <option value="">— não se aplica —</option>
                <option value="Perda: Não conectou (Dias 1-3)">❌ Não conectou (Dias 1-3)</option>
                <option value="Perda: Sumiu após Diagnóstico">❌ Sumiu após Diagnóstico</option>
                <option value="Perda: Ignorou o Break-up">❌ Ignorou o Break-up</option>
                <option value="Preço">💰 Preço / Sem Orçamento</option>
                <option value="Concorrência">🏆 Fechou com Concorrente</option>
                <option value="Não é o Momento">⏰ Não é o Momento</option>
                <option value="Outro">📝 Outro</option>
              </select>
            </div>

          </div>
        </div>

        <div className="modal-footer">
          <span className="draft-status" aria-live="polite">
            Rascunho salvo automaticamente
          </span>
          <button className="btn btn-ghost" onClick={handleClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={salvando}>
            {salvando ? 'Salvando…' : '💾 Salvar Lead'}
          </button>
        </div>
      </div>
    </div>
  );
}

