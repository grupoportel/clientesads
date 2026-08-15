import { useState } from 'react';
import { hojeISO } from '../periodo';

const CAMPOS_INICIAIS = {
  leadId: '',
  leadNome: '',
  valor: '',
  descricao: '',
  status: 'rascunho',
  data: '',
};

export default function PropostaModal({ isOpen, onClose, onSave, propostaAtual, leads = [] }) {
  const [formData, setFormData] = useState(() => (
    propostaAtual
      ? { ...CAMPOS_INICIAIS, ...propostaAtual }
      : { ...CAMPOS_INICIAIS, data: hojeISO() }
  ));
  const [erro, setErro] = useState('');



  if (!isOpen) return null;

  const handleLeadChange = (e) => {
    const leadId = e.target.value;
    const lead = leads.find((l) => l.id === leadId);
    setFormData((prev) => ({ ...prev, leadId, leadNome: lead ? lead.nome : '' }));
  };

  const handleChange = (e) =>
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = () => {
    if (!formData.leadId) {
      setErro('Selecione o lead vinculado à proposta.');
      return;
    }
    if (!formData.valor || isNaN(Number(formData.valor))) {
      setErro('Informe o valor da proposta.');
      return;
    }
    setErro('');
    onSave({ ...formData, valor: Number(formData.valor) });
  };

  const leadsOrdenados = [...leads].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 520 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title">
            {propostaAtual ? '✏️ Editar Proposta' : '📋 Nova Proposta'}
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} title="Fechar">
            ✕
          </button>
        </div>

        <div className="modal-body">
          {/* Section: Lead Vinculado */}
          <div className="form-section-title">🔗 Lead Vinculado (Obrigatório)</div>
          <div className="form-grid">
            <div className="form-group full">
              <label className="form-label">Lead *</label>
              <select
                className="form-control"
                value={formData.leadId}
                onChange={handleLeadChange}
                required
              >
                <option value="">— Selecione o lead —</option>
                {leadsOrdenados.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Section: Dados da Proposta */}
          <div className="form-section-title" style={{ marginTop: 20 }}>
            💰 Dados da Proposta
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Valor (R$)</label>
              <input
                className="form-control"
                type="number"
                name="valor"
                placeholder="0,00"
                value={formData.valor}
                onChange={handleChange}
                min="0"
                step="0.01"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Status</label>
              <select
                className="form-control"
                name="status"
                value={formData.status}
                onChange={handleChange}
              >
                <option value="rascunho">📝 Rascunho</option>
                <option value="enviada">📤 Enviada</option>
                <option value="aceita">✅ Aceita</option>
                <option value="rejeitada">❌ Rejeitada</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Data</label>
              <input
                className="form-control"
                type="date"
                name="data"
                value={formData.data}
                onChange={handleChange}
              />
            </div>

            <div className="form-group full">
              <label className="form-label">Descrição</label>
              <textarea
                className="form-control"
                name="descricao"
                placeholder="Descreva os serviços incluídos..."
                value={formData.descricao}
                onChange={handleChange}
                rows={3}
                style={{ resize: 'vertical' }}
              />
            </div>
          </div>

          {/* Error message */}
          {erro && (
            <div
              style={{
                marginTop: 12,
                padding: '10px 14px',
                borderRadius: 8,
                background: 'rgba(239,68,68,0.12)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: 'var(--red)',
                fontSize: 13,
              }}
            >
              ⚠️ {erro}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={handleSubmit}>
            💾 Salvar Proposta
          </button>
        </div>
      </div>
    </div>
  );
}
