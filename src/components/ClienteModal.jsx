import { useState, useEffect } from 'react';

const CAMPOS_INICIAIS = {
  nome: '', nicho: '', responsavel: '', plano: '', valorMensal: '',
  dataInicio: '', telefone: '', whatsapp: '', email: '', instagram: '',
  site: '', obs: '', statusCliente: 'ativo', ultimoContato: ''
};

export default function ClienteModal({ isOpen, onClose, onSave, clienteAtual, nichos = [], responsaveis = [] }) {
  const [dados, setDados] = useState(CAMPOS_INICIAIS);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (clienteAtual) {
      setDados({ ...CAMPOS_INICIAIS, ...clienteAtual });
    } else {
      setDados(CAMPOS_INICIAIS);
    }
    setErro('');
  }, [clienteAtual, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setDados(prev => ({ ...prev, [name]: value }));
  };

  const handleSalvar = () => {
    if (!dados.nome.trim()) {
      setErro('O nome / empresa é obrigatório.');
      return;
    }
    setErro('');
    onSave(dados);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 680, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title">
            {clienteAtual ? '✏️ Editar Cliente' : '➕ Novo Cliente'}
          </h2>
          <button className="btn btn-icon" onClick={onClose} title="Fechar">✕</button>
        </div>

        {/* Body */}
        <div className="modal-body">

          {/* ── Dados do Cliente ── */}
          <p className="form-section-title">🏢 Dados do Cliente</p>
          <div className="form-grid">

            <div className="form-group full">
              <label className="label">Nome / Empresa *</label>
              <input
                className="form-control"
                name="nome"
                value={dados.nome}
                onChange={handleChange}
                placeholder="Ex: Clínica São Lucas"
              />
              {erro && (
                <span style={{ color: 'var(--red)', fontSize: 12, marginTop: 4, display: 'block' }}>
                  {erro}
                </span>
              )}
            </div>

            <div className="form-group">
              <label className="label">Nicho</label>
              <select className="form-control" name="nicho" value={dados.nicho} onChange={handleChange}>
                <option value="">— Selecione —</option>
                {nichos.map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="label">Responsável</label>
              <select className="form-control" name="responsavel" value={dados.responsavel} onChange={handleChange}>
                <option value="">— Selecione —</option>
                {responsaveis.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="label">Status do Cliente</label>
              <select className="form-control" name="statusCliente" value={dados.statusCliente} onChange={handleChange}>
                <option value="ativo">Ativo</option>
                <option value="pausado">Pausado</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>

          </div>

          {/* ── Contrato ── */}
          <p className="form-section-title" style={{ marginTop: 20 }}>💰 Contrato</p>
          <div className="form-grid">

            <div className="form-group">
              <label className="label">Plano Contratado</label>
              <input
                className="form-control"
                name="plano"
                value={dados.plano}
                onChange={handleChange}
                placeholder="Ex: Gestão Completa"
              />
            </div>

            <div className="form-group">
              <label className="label">Valor Mensal (R$)</label>
              <input
                className="form-control"
                type="number"
                name="valorMensal"
                value={dados.valorMensal}
                onChange={handleChange}
                placeholder="Ex: 2500"
                min="0"
              />
            </div>

            <div className="form-group">
              <label className="label">Data de Início</label>
              <input
                className="form-control"
                type="date"
                name="dataInicio"
                value={dados.dataInicio}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label className="label">Último Contato</label>
              <input
                className="form-control"
                type="date"
                name="ultimoContato"
                value={dados.ultimoContato}
                onChange={handleChange}
              />
            </div>

          </div>

          {/* ── Contato ── */}
          <p className="form-section-title" style={{ marginTop: 20 }}>📞 Contato</p>
          <div className="form-grid">

            <div className="form-group">
              <label className="label">Telefone</label>
              <input
                className="form-control"
                name="telefone"
                value={dados.telefone}
                onChange={handleChange}
                placeholder="(66) 99999-0001"
              />
            </div>

            <div className="form-group">
              <label className="label">WhatsApp</label>
              <input
                className="form-control"
                name="whatsapp"
                value={dados.whatsapp}
                onChange={handleChange}
                placeholder="(66) 99999-0001"
              />
            </div>

            <div className="form-group">
              <label className="label">E-mail</label>
              <input
                className="form-control"
                type="email"
                name="email"
                value={dados.email}
                onChange={handleChange}
                placeholder="contato@empresa.com"
              />
            </div>

            <div className="form-group">
              <label className="label">Instagram (@)</label>
              <input
                className="form-control"
                name="instagram"
                value={dados.instagram}
                onChange={handleChange}
                placeholder="@empresa"
              />
            </div>

            <div className="form-group full">
              <label className="label">Site</label>
              <input
                className="form-control"
                name="site"
                value={dados.site}
                onChange={handleChange}
                placeholder="empresa.com.br"
              />
            </div>

          </div>

          {/* ── Observações ── */}
          <p className="form-section-title" style={{ marginTop: 20 }}>📝 Observações</p>
          <div className="form-grid">
            <div className="form-group full">
              <label className="label">Observação</label>
              <textarea
                className="form-control"
                name="obs"
                value={dados.obs}
                onChange={handleChange}
                rows={3}
                placeholder="Anotações sobre o cliente..."
                style={{ resize: 'vertical' }}
              />
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSalvar}>💾 Salvar Cliente</button>
        </div>
      </div>
    </div>
  );
}
