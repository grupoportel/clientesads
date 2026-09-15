const normaliza = texto => String(texto || '').trim().toLowerCase();
const CAMPOS_BUSCA = ['nome', 'nicho', 'tipoProspeccao', 'telefone', 'whatsapp', 'email', 'responsavel', 'cidade', 'decisor'];

export function opcoesDeFiltro(items = [], usados = []) {
  const unicos = new Map();
  for (const valor of [...items, ...usados]) {
    if (typeof valor !== 'string' || !valor.trim()) continue;
    const nome = valor.trim();
    if (!unicos.has(normaliza(nome))) unicos.set(normaliza(nome), nome);
  }
  return [...unicos.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export function leadPassaNosFiltros(lead, f = {}) {
  if (f.status && normaliza(lead.status || 'nenhum') !== normaliza(f.status)) return false;
  for (const campo of ['nicho', 'tipoProspeccao', 'responsavel', 'estado', 'cidade']) {
    if (f[campo] && normaliza(lead[campo]) !== normaliza(f[campo])) return false;
  }
  const entrada = (lead.data_entrada || lead.createdAt || '').slice(0, 10);
  if (f.dataInicio && (!entrada || entrada < f.dataInicio)) return false;
  if (f.dataFim && (!entrada || entrada > f.dataFim)) return false;
  if (f.busca) return CAMPOS_BUSCA.some(campo => normaliza(lead[campo]).includes(normaliza(f.busca)));
  return true;
}
