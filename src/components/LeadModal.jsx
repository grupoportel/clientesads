import React, { useState, useEffect } from 'react';

import { etapasAtivas, acharEtapa, formatarBRL } from '../pipeline';

const CAMPOS_INICIAIS = {
  nome: '', status: 'nenhum', valor: '', nicho: '', estado: '', cidade: '', origem: '',
  responsavel: '', decisor: '', cnpj: '', telefone: '', whatsapp: '', email: '',
  instagram: '', ig_dono: '', site: '', nota: '', avaliacoes: '', data_entrada: '',
  ultimo_contato: '', reuniao: '', melhores: '', oportunidades: '', pontos: '',
  escalar: '', obs: '', motivoPerda: '', historico: ''
};

// Recebemos as listas do Firebase (nichos, responsaveis, etc.)
export default function LeadModal({ isOpen, onClose, onSave, leadAtual, nichos = [], responsaveis = [], estados = [], cidades = [], etapas = [] }) {
  const [formData, setFormData] = useState(CAMPOS_INICIAIS);

  useEffect(() => {
    if (leadAtual) {
      setFormData({ ...CAMPOS_INICIAIS, ...leadAtual });
    } else {
      const hoje = new Date().toISOString().slice(0, 10);
      setFormData({ ...CAMPOS_INICIAIS, data_entrada: hoje });
    }
  }, [leadAtual, isOpen]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  if (!isOpen) return null;

  const etapaAtual = acharEtapa(etapas, formData.status);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        
        <div className="modal-header">
          <div className="modal-title">{leadAtual ? 'Editar Lead' : 'Novo Lead'}</div>
          <button className="btn-icon" onClick={onClose}>✕</button>
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

            <div className="form-section-title">📞 Contato</div>

            <div className="form-group">
              <label>Telefone</label>
              <input className="form-control" name="telefone" type="tel" value={formData.telefone} onChange={handleChange} placeholder="(66) 3015-0955" />
            </div>
            <div className="form-group">
              <label>WhatsApp</label>
              <input className="form-control" name="whatsapp" type="tel" value={formData.whatsapp} onChange={handleChange} placeholder="(66) 99886-2626" />
            </div>
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

            <div className="form-section-title">📅 Datas</div>
            <div className="form-group">
              <label>Data de Entrada</label>
              <input className="form-control" name="data_entrada" type="date" value={formData.data_entrada} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Último Contato</label>
              <input className="form-control" name="ultimo_contato" type="date" value={formData.ultimo_contato} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Data da Reunião</label>
              <input className="form-control" name="reuniao" type="date" value={formData.reuniao} onChange={handleChange} />
            </div>

            <div className="form-section-title">🎯 Análise & Estratégia</div>
            
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
            <div className="form-group full">
              <label>Histórico de Contatos</label>
              <textarea className="form-control" name="historico" value={formData.historico} onChange={handleChange} placeholder="27/05 - Enviou DM..." />
            </div>

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
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => onSave(formData)}>💾 Salvar Lead</button>
        </div>
      </div>
    </div>
  );
}