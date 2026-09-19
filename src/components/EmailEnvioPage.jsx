import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiPost } from '../api';
import EscreverComIA from './EscreverComIA';

const BANNER_PADRAO_URL = 'https://clientesads.vercel.app/email/banner-grupo-portel-v2.jpg';
const VAZIO = { assunto: '', corpo: '', imagemUrl: BANNER_PADRAO_URL, imagemDataUrl: '', imagemNome: '', anexos: [], ctaTexto: '', ctaUrl: '' };
const TIPOS_IMAGEM = ['image/jpeg', 'image/png', 'image/gif'];
const MAX_IMAGEM_BYTES = 1500000;
const TIPOS_POR_EXTENSAO = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  csv: 'text/csv',
};
const MAX_ANEXO_BYTES = 2000000;
const MAX_TOTAL_ARQUIVOS_BYTES = 3000000;
const formatarData = (valor) => {
  if (!valor) return '';
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? '' : data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};
const iniciais = (nome, email) => String(nome || email || '?').split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();

export default function EmailEnvioPage({ leads = [], empresa = 'Grupo Portel', meuNome = '' }) {
  const disponiveis = useMemo(
    () => leads
      .filter(lead => String(lead.email || '').includes('@') && lead.optOut !== true && lead.optOut !== 'true')
      .sort((a, b) => String(a.nome).localeCompare(String(b.nome))),
    [leads],
  );
  const [tela, setTela] = useState('entrada');
  const [caixa, setCaixa] = useState({ configurado: false, caixa: '', ultimaSincronizacao: null, mensagens: [] });
  const [carregando, setCarregando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [erroCaixa, setErroCaixa] = useState('');
  const [busca, setBusca] = useState('');
  const [mensagemId, setMensagemId] = useState('');
  const [leadId, setLeadId] = useState('');
  const [respostaA, setRespostaA] = useState(null);
  const [form, setForm] = useState(VAZIO);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState(null);

  const carregar = useCallback(async (sincronizar = false) => {
    sincronizar ? setSincronizando(true) : setCarregando(true);
    setErroCaixa('');
    try {
      const resultado = await apiPost('/api/email-inbox', { acao: sincronizar ? 'sincronizar' : 'listar' });
      setCaixa(resultado);
      setMensagemId(atual => atual || resultado.mensagens?.[0]?.id || '');
      if (sincronizar) {
        setAviso({ tipo: 'sucesso', texto: `${resultado.novos || 0} nova(s) mensagem(ns) encontrada(s).` });
      }
    } catch (erro) {
      setErroCaixa(erro.message);
    } finally {
      setCarregando(false);
      setSincronizando(false);
    }
  }, []);

  useEffect(() => {
    const inicio = setTimeout(() => carregar(false), 0);
    return () => clearTimeout(inicio);
  }, [carregar]);

  const mensagens = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return caixa.mensagens || [];
    return (caixa.mensagens || []).filter(item =>
      `${item.remetenteNome} ${item.remetenteEmail} ${item.assunto} ${item.leadNome}`.toLowerCase().includes(termo),
    );
  }, [busca, caixa.mensagens]);
  const mensagem = (caixa.mensagens || []).find(item => item.id === mensagemId) || mensagens[0] || null;
  const lead = disponiveis.find(item => item.id === leadId) || null;

  const escolherMensagem = async (item) => {
    setMensagemId(item.id);
    if (!item.lidoNoCrm) {
      setCaixa(atual => ({ ...atual, mensagens: atual.mensagens.map(m => m.id === item.id ? { ...m, lidoNoCrm: true } : m) }));
      apiPost('/api/email-inbox', { acao: 'marcar_lido', id: item.id }).catch(() => {});
    }
  };

  const novaMensagem = () => {
    setRespostaA(null);
    setLeadId('');
    setForm(VAZIO);
    setAviso(null);
    setTela('escrever');
  };

  const responder = (item) => {
    if (!item?.leadId) return;
    setRespostaA(item);
    setLeadId(item.leadId);
    setForm({ ...VAZIO, assunto: /^re:/i.test(item.assunto || '') ? item.assunto : `Re: ${item.assunto || 'Sua mensagem'}` });
    setAviso(null);
    setTela('escrever');
  };

  const enviar = async () => {
    if (!lead) return;
    setEnviando(true);
    setAviso(null);
    try {
      const resultado = await apiPost('/api/send-email', {
        leadId: lead.id,
        para: lead.email,
        assunto: form.assunto,
        corpo: form.corpo,
        imagemUrl: form.imagemUrl,
        imagemDataUrl: form.imagemDataUrl,
        anexos: form.anexos.map(({ nome, tipo, dataUrl }) => ({ nome, tipo, dataUrl })),
        ctaTexto: form.ctaTexto,
        ctaUrl: form.ctaUrl,
        respostaAId: respostaA?.id || '',
      });
      setAviso({ tipo: resultado.warning ? 'aviso' : 'sucesso', texto: resultado.message });
      setForm(VAZIO);
      setLeadId('');
      setRespostaA(null);
    } catch (erro) {
      setAviso({ tipo: 'erro', texto: erro.message });
    } finally {
      setEnviando(false);
    }
  };

  const mudar = (campo, valor) => setForm(atual => ({ ...atual, [campo]: valor }));
  const escolherImagem = (arquivo) => {
    if (!arquivo) {
      setForm(atual => ({ ...atual, imagemDataUrl: '', imagemNome: '' }));
      return;
    }
    if (!TIPOS_IMAGEM.includes(arquivo.type) || arquivo.size > MAX_IMAGEM_BYTES) {
      setAviso({ tipo: 'erro', texto: 'Use uma imagem JPG, PNG ou GIF de até 1,5 MB.' });
      return;
    }
    const leitor = new FileReader();
    leitor.onload = () => {
      setForm(atual => ({
        ...atual,
        imagemDataUrl: String(leitor.result || ''),
        imagemNome: arquivo.name,
        imagemUrl: '',
      }));
      setAviso(null);
    };
    leitor.onerror = () => setAviso({ tipo: 'erro', texto: 'Não foi possível ler a imagem escolhida.' });
    leitor.readAsDataURL(arquivo);
  };
  const escolherAnexos = async (lista) => {
    const arquivos = Array.from(lista || []);
    if (!arquivos.length) return;
    if (form.anexos.length + arquivos.length > 3) {
      setAviso({ tipo: 'erro', texto: 'Envie no máximo 3 anexos.' });
      return;
    }
    const bytesImagem = form.imagemDataUrl ? Math.ceil(form.imagemDataUrl.length * 0.75) : 0;
    const total = bytesImagem + form.anexos.reduce((soma, item) => soma + item.tamanho, 0)
      + arquivos.reduce((soma, item) => soma + item.size, 0);
    const arquivosTipados = arquivos.map(arquivo => ({
      arquivo,
      tipo: TIPOS_POR_EXTENSAO[arquivo.name.split('.').pop()?.toLowerCase()],
    }));
    if (arquivosTipados.some(({ arquivo, tipo }) => !tipo || arquivo.size > MAX_ANEXO_BYTES)
      || total > MAX_TOTAL_ARQUIVOS_BYTES) {
      setAviso({ tipo: 'erro', texto: 'Use PDF, DOCX, XLSX, PPTX, TXT ou CSV de até 2 MB cada; imagem e anexos juntos podem somar até 3 MB.' });
      return;
    }
    try {
      const novos = await Promise.all(arquivosTipados.map(({ arquivo, tipo }) => new Promise((resolve, reject) => {
        const leitor = new FileReader();
        leitor.onload = () => {
          const base64 = String(leitor.result || '').split(',')[1] || '';
          resolve({ nome: arquivo.name, tipo, tamanho: arquivo.size, dataUrl: `data:${tipo};base64,${base64}` });
        };
        leitor.onerror = () => reject(new Error('Falha ao ler o arquivo.'));
        leitor.readAsDataURL(arquivo);
      })));
      setForm(atual => ({ ...atual, anexos: [...atual.anexos, ...novos] }));
      setAviso(null);
    } catch {
      setAviso({ tipo: 'erro', texto: 'Não foi possível ler um dos anexos.' });
    }
  };
  const pronto = lead && form.assunto.trim() && form.corpo.trim()
    && Boolean(form.ctaTexto.trim()) === Boolean(form.ctaUrl.trim());

  return (
    <div className="page-content" style={{ overflowY: 'auto' }}>
      <div style={{ maxWidth: 1220, margin: '0 auto', padding: '28px 24px 44px' }}>
        <div className="email-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, marginBottom: 20 }}>
          <div>
            <div style={{ color: 'var(--accent)', fontSize: 11, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase' }}>Comunicação profissional</div>
            <h1 style={{ margin: '5px 0 7px', fontSize: 28 }}>E-mail</h1>
            <p style={{ margin: 0, color: 'var(--text3)', fontSize: 13 }}>Leia e responda pela caixa da Hostinger sem perder o vínculo com cada lead.</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={`btn ${tela === 'entrada' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTela('entrada')}>Caixa de entrada</button>
            <button className={`btn ${tela === 'escrever' ? 'btn-primary' : 'btn-ghost'}`} onClick={novaMensagem}>Escrever</button>
          </div>
        </div>

        {!caixa.configurado && !carregando && (
          <div className="card" style={{ padding: 16, marginBottom: 16, borderColor: 'rgba(245,158,11,.42)', background: 'rgba(245,158,11,.07)' }}>
            <strong style={{ display: 'block', marginBottom: 4 }}>A caixa ainda precisa ser conectada.</strong>
            <span style={{ color: 'var(--text2)', fontSize: 12.5 }}>Configure SMTP_USER e SMTP_PASS na Vercel. Para receber, o CRM usa IMAP seguro da Hostinger na porta 993.</span>
          </div>
        )}
        {aviso && (
          <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 8, fontSize: 12.5, color: aviso.tipo === 'erro' ? 'var(--red)' : aviso.tipo === 'aviso' ? 'var(--yellow)' : 'var(--green)', background: aviso.tipo === 'erro' ? 'rgba(239,68,68,.1)' : aviso.tipo === 'aviso' ? 'rgba(245,158,11,.1)' : 'rgba(34,197,94,.1)' }}>{aviso.texto}</div>
        )}

        {tela === 'entrada' ? (
          <>
            <div className="card" style={{ padding: 12, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <input className="form-control" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar remetente, assunto ou lead" style={{ flex: '1 1 260px' }} />
              <button className="btn btn-primary" onClick={() => carregar(true)} disabled={sincronizando || !caixa.configurado}>{sincronizando ? 'Sincronizando…' : 'Sincronizar agora'}</button>
              <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>
                {caixa.caixa ? `Caixa ${caixa.caixa}` : 'Hostinger'}{caixa.ultimaSincronizacao ? ` · ${formatarData(caixa.ultimaSincronizacao)}` : ''}
              </span>
            </div>
            {erroCaixa && <div style={{ padding: 12, color: 'var(--red)', background: 'rgba(239,68,68,.1)', borderRadius: 8, marginBottom: 12 }}>{erroCaixa}</div>}

            <div className="email-inbox-grid">
              <section className="card email-message-list" style={{ padding: 0, overflow: 'hidden' }}>
                {carregando ? (
                  <div style={{ padding: 28, color: 'var(--text3)' }}>Carregando mensagens…</div>
                ) : mensagens.length === 0 ? (
                  <div style={{ padding: 28 }}><strong>Nenhuma mensagem sincronizada.</strong><p style={{ color: 'var(--text3)', fontSize: 12.5, lineHeight: 1.6 }}>Use “Sincronizar agora”. Na primeira vez, o CRM traz até 30 mensagens recentes; depois busca somente as novas.</p></div>
                ) : mensagens.map(item => (
                  <button key={item.id} type="button" onClick={() => escolherMensagem(item)} className="email-message-row" data-active={mensagem?.id === item.id}>
                    <span className="email-avatar">{iniciais(item.remetenteNome, item.remetenteEmail)}</span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.remetenteNome || item.remetenteEmail}</strong>
                        <small style={{ color: 'var(--text3)', flexShrink: 0 }}>{formatarData(item.recebidoEm).split(' ')[0]}</small>
                      </span>
                      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text2)', marginTop: 3 }}>{item.assunto}</span>
                      <span style={{ display: 'block', color: item.leadId ? 'var(--accent2)' : 'var(--text3)', fontSize: 10.5, marginTop: 5 }}>{item.leadId ? `Lead: ${item.leadNome}` : 'Sem lead correspondente'}</span>
                    </span>
                    {!item.lidoNoCrm && <span className="email-unread-dot" title="Não lido no CRM" />}
                  </button>
                ))}
              </section>

              <section className="card email-message-detail" style={{ padding: 22, minWidth: 0 }}>
                {!mensagem ? <div style={{ color: 'var(--text3)' }}>Selecione uma mensagem.</div> : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start', marginBottom: 18 }}>
                      <div style={{ minWidth: 0 }}>
                        <h2 style={{ margin: '0 0 8px', fontSize: 20, overflowWrap: 'anywhere' }}>{mensagem.assunto}</h2>
                        <div style={{ fontSize: 12.5, color: 'var(--text2)', overflowWrap: 'anywhere' }}>{mensagem.remetenteNome || mensagem.remetenteEmail} &lt;{mensagem.remetenteEmail}&gt;</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 3 }}>{formatarData(mensagem.recebidoEm)}</div>
                      </div>
                      <button className="btn btn-primary" onClick={() => responder(mensagem)} disabled={!mensagem.leadId}>Responder</button>
                    </div>
                    {!mensagem.leadId && <div style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 8, background: 'rgba(245,158,11,.08)', color: 'var(--text2)', fontSize: 12 }}>Cadastre este endereço em um lead para responder pelo CRM. O e-mail original permanece na Hostinger.</div>}
                    {mensagem.truncado && <div style={{ marginBottom: 12, color: 'var(--text3)', fontSize: 11.5 }}>Mensagem grande: o CRM exibiu somente os primeiros 2 MB. Use o webmail para ver o conteúdo completo.</div>}
                    <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.68, color: 'var(--text2)', fontSize: 14 }}>{mensagem.texto || '(mensagem sem texto legível)'}</div>
                    {mensagem.anexos?.length > 0 && <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text3)' }}>Anexos disponíveis no webmail: {mensagem.anexos.map(a => a.nome).join(', ')}</div>}
                  </>
                )}
              </section>
            </div>
          </>
        ) : (
          <div className="email-editor-grid">
            <section className="card" style={{ padding: 20 }}>
              {respostaA && (
                <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(0,184,200,.08)', border: '1px solid rgba(0,184,200,.22)', marginBottom: 14, fontSize: 12 }}>
                  Respondendo a <strong>{respostaA.remetenteNome || respostaA.remetenteEmail}</strong> sobre “{respostaA.assunto}”.
                  <button type="button" onClick={novaMensagem} style={{ marginLeft: 8, border: 0, background: 'transparent', color: 'var(--accent2)', cursor: 'pointer' }}>Cancelar resposta</button>
                </div>
              )}
              <div className="form-group full">
                <label className="form-label">Destinatário do CRM</label>
                <select className="form-control" value={leadId} onChange={e => { setLeadId(e.target.value); setRespostaA(null); setAviso(null); }} disabled={enviando || Boolean(respostaA)}>
                  <option value="">Selecione um lead com e-mail</option>
                  {disponiveis.map(item => <option key={item.id} value={item.id}>{item.nome} — {item.email}</option>)}
                </select>
              </div>
              <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(0,184,200,.08)', border: '1px solid rgba(0,184,200,.22)', color: 'var(--text2)', fontSize: 11.5, lineHeight: 1.55, marginBottom: 14 }}>
                Esta caixa é para mensagens individuais e respostas. O CRM registra o envio no histórico do lead e impede uma nova abordagem dentro de 72 horas; respostas a conversas em andamento continuam liberadas.
              </div>
              <div className="form-group full">
                <label className="form-label">Assunto</label>
                <input className="form-control" maxLength={150} value={form.assunto} onChange={e => mudar('assunto', e.target.value)} disabled={enviando} placeholder="Assunto curto e específico" />
              </div>
              <div className="form-group full">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <label className="form-label">Mensagem</label>
                  {lead && !respostaA && <EscreverComIA lead={lead} canal="email" empresa={empresa} meuNome={meuNome} compacto aoEscolher={r => setForm(f => ({ ...f, assunto: r.assunto || f.assunto, corpo: r.corpo || f.corpo }))} />}
                </div>
                <textarea className="form-control" rows={11} maxLength={10000} value={form.corpo} onChange={e => mudar('corpo', e.target.value)} disabled={enviando} placeholder="Escreva como uma pessoa. Use parágrafos curtos e uma ação clara." />
              </div>
              <details style={{ marginTop: 12 }}>
                <summary style={{ cursor: 'pointer', color: 'var(--text2)', fontSize: 13, fontWeight: 600 }}>Imagem e botão (opcional)</summary>
                <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
                  {!form.imagemDataUrl && form.imagemUrl === BANNER_PADRAO_URL && (
                    <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(0,184,200,.08)', border: '1px solid rgba(0,184,200,.22)', color: 'var(--text2)', fontSize: 12 }}>
                      Banner padrão do Grupo Portel ativo.
                      <button type="button" onClick={() => mudar('imagemUrl', '')} style={{ marginLeft: 8, border: 0, background: 'transparent', color: 'var(--red)', cursor: 'pointer' }}>Não usar</button>
                    </div>
                  )}
                  <div className="form-group full">
                    <label className="form-label">Imagem do cabeçalho</label>
                    <input key={form.imagemDataUrl ? 'imagem-selecionada' : 'imagem-vazia'} className="form-control" type="file" accept="image/jpeg,image/png,image/gif" onChange={e => escolherImagem(e.target.files?.[0])} disabled={enviando} />
                    <small style={{ display: 'block', marginTop: 6, color: 'var(--text3)', lineHeight: 1.5 }}>JPG, PNG ou GIF de até 1,5 MB. A imagem será incorporada ao e-mail e exibida no topo.</small>
                    {form.imagemNome && <div style={{ marginTop: 7, color: 'var(--accent2)', fontSize: 12 }}>{form.imagemNome} <button type="button" onClick={() => setForm(atual => ({ ...atual, imagemDataUrl: '', imagemNome: '' }))} style={{ border: 0, background: 'transparent', color: 'var(--red)', cursor: 'pointer' }}>Remover</button></div>}
                  </div>
                  <div className="form-group full">
                    <label className="form-label">Ou use uma URL pública HTTPS</label>
                    <input className="form-control" type="url" value={form.imagemUrl} onChange={e => setForm(atual => ({ ...atual, imagemUrl: e.target.value, imagemDataUrl: '', imagemNome: '' }))} placeholder="https://.../capa.jpg" disabled={enviando} />
                    {!form.imagemDataUrl && form.imagemUrl !== BANNER_PADRAO_URL && <button type="button" className="btn btn-ghost" onClick={() => mudar('imagemUrl', BANNER_PADRAO_URL)} style={{ marginTop: 8 }} disabled={enviando}>Restaurar banner padrão</button>}
                  </div>
                  <div className="email-cta-grid">
                    <div className="form-group"><label className="form-label">Texto do botão</label><input className="form-control" maxLength={60} value={form.ctaTexto} onChange={e => mudar('ctaTexto', e.target.value)} placeholder="Acessar material" disabled={enviando} /></div>
                    <div className="form-group"><label className="form-label">Link HTTPS do botão</label><input className="form-control" type="url" value={form.ctaUrl} onChange={e => mudar('ctaUrl', e.target.value)} placeholder="https://..." disabled={enviando} /></div>
                  </div>
                </div>
              </details>
              <div className="form-group full" style={{ marginTop: 14 }}>
                <label className="form-label">Anexar arquivo (opcional)</label>
                <input key={`anexos-${form.anexos.length}`} className="form-control" type="file" multiple accept=".pdf,.docx,.xlsx,.pptx,.txt,.csv" onChange={e => escolherAnexos(e.target.files)} disabled={enviando || form.anexos.length >= 3} />
                <small style={{ display: 'block', marginTop: 6, color: 'var(--text3)', lineHeight: 1.5 }}>Até 3 arquivos seguros, com 2 MB cada e 3 MB no total junto da imagem. Em primeira abordagem, anexe somente material relevante e esperado pelo contato.</small>
                {form.anexos.map((arquivo, indice) => (
                  <div key={`${arquivo.nome}-${indice}`} style={{ marginTop: 7, color: 'var(--accent2)', fontSize: 12 }}>
                    {arquivo.nome} <button type="button" onClick={() => setForm(atual => ({ ...atual, anexos: atual.anexos.filter((_, i) => i !== indice) }))} style={{ border: 0, background: 'transparent', color: 'var(--red)', cursor: 'pointer' }}>Remover</button>
                  </div>
                ))}
              </div>
              <button className="btn btn-primary" style={{ marginTop: 16 }} disabled={enviando || !pronto} onClick={enviar}>{enviando ? 'Enviando…' : respostaA ? 'Enviar resposta' : 'Enviar e-mail'}</button>
            </section>

            <section className="card" style={{ padding: 18, background: '#eaf0f4', alignSelf: 'start' }}>
              <div style={{ color: '#526574', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Prévia aproximada</div>
              <div style={{ maxWidth: 640, margin: '0 auto', background: '#fff', border: '1px solid #dce5ec', borderRadius: 10, overflow: 'hidden', color: '#222' }}>
                {(form.imagemDataUrl || form.imagemUrl) && (
                  <>
                    <div style={{ padding: '13px 22px', background: '#001f33', borderBottom: '3px solid #00d7df', color: '#fff', font: '700 14px/1.2 Arial, sans-serif', letterSpacing: '1.8px' }}>{empresa.toUpperCase()}</div>
                    <div style={{ aspectRatio: '640 / 277', background: '#06324f' }}>
                      <img src={form.imagemDataUrl || form.imagemUrl} alt="Prévia do cabeçalho" width="640" height="277" fetchPriority="high" style={{ display: 'block', width: '100%', height: 'auto' }} />
                    </div>
                  </>
                )}
                <div style={{ padding: '28px 30px 24px', fontFamily: 'Arial, sans-serif', fontSize: 15, lineHeight: 1.6 }}>
                  <div style={{ fontWeight: 700, marginBottom: 18 }}>{form.assunto || 'Assunto do e-mail'}</div>
                  <div style={{ whiteSpace: 'pre-wrap', color: form.corpo ? '#222' : '#8b98a1' }}>{form.corpo || 'A mensagem aparecerá aqui conforme você escreve.'}</div>
                  {form.ctaTexto && form.ctaUrl && <div style={{ textAlign: 'center', marginTop: 24 }}><span style={{ display: 'inline-block', background: '#00b8c8', color: '#001b2d', fontWeight: 700, padding: '12px 20px', borderRadius: 7 }}>{form.ctaTexto}</span></div>}
                  {form.anexos.length > 0 && <div style={{ marginTop: 22, paddingTop: 14, borderTop: '1px solid #dce5ec', color: '#526574', fontSize: 12 }}>Anexos: {form.anexos.map(item => item.nome).join(', ')}</div>}
                </div>
                <div style={{ padding: '15px 30px', background: '#001f33', color: '#b9c9d4', font: '12px/1.5 Arial, sans-serif', textAlign: 'center' }}>{empresa}</div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
