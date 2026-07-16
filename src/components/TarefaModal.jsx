import { useState, useEffect } from 'react';

const CAMPOS_INICIAIS = {
  titulo: '', tipo: 'ligacao', leadId: '', leadNome: '',
  responsavel: '', data: '', hora: '', prioridade: 'media'
};

export default function TarefaModal({ isOpen, onClose, onSave, tarefaAtual, leads = [], responsaveis = [] }) {
  const [formData, setFormData] = useState(CAMPOS_INICIAIS);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (tarefaAtual) {
      setFormData({ ...CAMPOS_INICIAIS, ...tarefaAtual });
    } else {
      const hoje = new Date().toISOString().slice(0, 10);
      setFormData({ ...CAMPOS_INICIAIS, data: hoje });
    }
    setErro('');
  }, [tarefaAtual, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleLeadChange = (e) => {
    const leadId = e.target.value;
    const lead = leads.find(l => l.id === leadId);
    setFormData(prev => ({ ...prev, leadId, leadNome: lead ? lead.nome : '' }));
  };

  const handleSubmit = () => {
    if (!formData.titulo.trim()) { setErro('O título é obrigatório.'); return; }
    if (!formData.leadId) { setErro('Selecione um lead vinculado.'); return; }
    if (!formData.data) { setErro('A data é obrigatória.'); return; }
    setErro('');
    onSave(formData);
  };

  const leadsOrdenados = [...leads].sort((a, b) => a.nome.localeCompare(b.nome));

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: '560px', width: '100%' }}>

        {/* Header */}
        <div className="modal-header">
          <div className="modal-title">
            {tarefaAtual ? '✏️ Editar Tarefa' : '✅ Nova Tarefa'}
          </div>
          <button
            className="btn-icon"
            onClick={onClose}
            style={{ fontSize: '18px', lineHeight: 1 }}
            aria-label="Fechar modal"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">

          {/* Section: Dados da Tarefa */}
          <div className="form-section-title">📌 Dados da Tarefa</div>
          <div className="form-grid">
            {/* Tipo */}
            <div className="form-group">
              <label className="form-label">Tipo</label>
              <select
                className="form-control"
                name="tipo"
                value={formData.tipo}
                onChange={handleChange}
              >
                <option value="ligacao">📞 Ligação</option>
                <option value="email">✉️ E-mail</option>
                <option value="reuniao">🤝 Reunião</option>
                <option value="followup">💬 Follow-up</option>
              </select>
            </div>

            {/* Prioridade */}
            <div className="form-group">
              <label className="form-label">Prioridade</label>
              <select
                className="form-control"
                name="prioridade"
                value={formData.prioridade}
                onChange={handleChange}
              >
                <option value="alta">🔴 Alta</option>
                <option value="media">🟡 Média</option>
                <option value="baixa">🟢 Baixa</option>
              </select>
            </div>

            {/* Título — full width */}
            <div className="form-group full">
              <label className="form-label">Título da Tarefa</label>
              <input
                className="form-control"
                type="text"
                name="titulo"
                value={formData.titulo}
                onChange={handleChange}
                placeholder="Descreva a tarefa..."
                autoFocus
              />
            </div>
          </div>

          {/* Section: Vinculação */}
          <div className="form-section-title" style={{ marginTop: '20px' }}>🔗 Vinculação <span style={{ color: 'var(--red)' }}>(Obrigatório)</span></div>
          <div className="form-grid">
            <div className="form-group full">
              <label className="form-label">
                Lead Vinculado <span style={{ color: 'var(--red)' }}>*</span>
              </label>

              {leads.length === 0 ? (
                <div style={{
                  padding: '10px 12px',
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  fontSize: '13px',
                  color: 'var(--text3)',
                }}>
                  ⚠️ Nenhum lead disponível. Adicione leads primeiro.
                </div>
              ) : (
                <select
                  className="form-control"
                  value={formData.leadId}
                  onChange={handleLeadChange}
                  required
                >
                  <option value="">— Selecione um lead —</option>
                  {leadsOrdenados.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.nome}{l.nicho ? ` · ${l.nicho}` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Section: Atribuição e Data */}
          <div className="form-section-title" style={{ marginTop: '20px' }}>👤 Atribuição e Data</div>
          <div className="form-grid">
            {/* Responsável */}
            <div className="form-group">
              <label className="form-label">Responsável</label>
              <select
                className="form-control"
                name="responsavel"
                value={formData.responsavel}
                onChange={handleChange}
              >
                <option value="">— selecione —</option>
                {responsaveis.map((r, i) => (
                  <option key={i} value={typeof r === 'string' ? r : r.nome}>
                    {typeof r === 'string' ? r : r.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Data */}
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

            {/* Hora */}
            <div className="form-group">
              <label className="form-label">Hora</label>
              <input
                className="form-control"
                type="time"
                name="hora"
                value={formData.hora}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Error message */}
          {erro && (
            <div style={{
              color: 'var(--red)',
              fontSize: '13px',
              marginTop: '12px',
              padding: '8px 12px',
              background: 'rgba(239,68,68,0.08)',
              borderRadius: '8px',
              border: '1px solid rgba(239,68,68,0.25)',
            }}>
              ⚠️ {erro}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={leads.length === 0}
          >
            ✅ Salvar Tarefa
          </button>
        </div>
      </div>
    </div>
  );
}
