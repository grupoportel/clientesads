import React, { useEffect, useMemo, useState } from 'react';
import { apiPost } from '../api';
import { escutarAtividadesDoLead } from '../atividades';
import {
  ETAPAS_LIGACAO, PASSOS_PREPARACAO, RESULTADOS_PROSPECCAO, ROTAS_LIGACAO,
  criarPreparacaoProspeccao, montarResumoProspeccao, progressoPreparacaoProspeccao,
  sugestaoManualProspeccao, validarRegistroProspeccao,
} from '../prospeccaoBdr';

const ABAS = [
  { id: 'preparar', numero: '01', titulo: 'Preparar' },
  { id: 'ligar', numero: '02', titulo: 'Ligar' },
  { id: 'registrar', numero: '03', titulo: 'Registrar' },
];

function Campo({ rotulo, valor, aoMudar, placeholder, linhas = 3, ajuda }) {
  return (
    <label className="copiloto-campo">
      <span>{rotulo}</span>
      {ajuda && <small>{ajuda}</small>}
      <textarea className="form-control" rows={linhas} value={valor || ''} onChange={e => aoMudar(e.target.value)} placeholder={placeholder} />
    </label>
  );
}

function CampoLinha({ rotulo, valor, aoMudar, placeholder, tipo = 'text', ajuda }) {
  return (
    <label className="copiloto-campo">
      <span>{rotulo}</span>
      {ajuda && <small>{ajuda}</small>}
      <input className="form-control" type={tipo} value={valor || ''} onChange={e => aoMudar(e.target.value)} placeholder={placeholder} />
    </label>
  );
}

function CartaoLead({ lead, ativo, aoEscolher }) {
  const proxima = lead.proximaAcaoDataHora ? `Próxima ação ${new Date(lead.proximaAcaoDataHora).toLocaleDateString('pt-BR')}` : '';
  return (
    <button type="button" className={`copiloto-lead ${ativo ? 'ativo' : ''}`} onClick={aoEscolher}>
      <span className="copiloto-lead-avatar">{String(lead.nome || '?').slice(0, 2).toUpperCase()}</span>
      <span className="copiloto-lead-texto">
        <strong>{lead.nome}</strong>
        <small>{[lead.decisor, lead.nicho, proxima].filter(Boolean).join(' · ') || 'Contexto ainda incompleto'}</small>
      </span>
    </button>
  );
}

function CopilotoWorkspace({ lead, podeEditar, aoSalvar, aoAbrirLead, aoTrocar }) {
  const [aba, setAba] = useState('preparar');
  const [preparacao, setPreparacao] = useState(() => criarPreparacaoProspeccao(lead));
  const [atividades, setAtividades] = useState([]);
  const [sugestao, setSugestao] = useState(null);
  const [gerando, setGerando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [rotaAberta, setRotaAberta] = useState(null);

  useEffect(() => escutarAtividadesDoLead(lead.id, setAtividades), [lead.id]);

  const atualizar = (campo, valor) => setPreparacao(atual => ({ ...atual, [campo]: valor }));
  const progresso = progressoPreparacaoProspeccao(preparacao);
  const resumo = montarResumoProspeccao(preparacao);

  const prepararSemIa = () => {
    setSugestao(sugestaoManualProspeccao(lead, preparacao));
    setAviso({ tipo: 'ok', texto: 'Base montada com os dados do CRM e os padrões das ligações reais da Rugido. Revise antes de usar.' });
  };

  const prepararComIa = async () => {
    setGerando(true); setAviso(null);
    try {
      const resposta = await apiPost('/api/preparar-prospeccao', { lead, atividades, preparacao });
      setSugestao(resposta.sugestao);
      setAviso({ tipo: 'ok', texto: 'Sugestão gerada. Nada foi salvo automaticamente; confirme os fatos antes da ligação.' });
    } catch (erro) {
      setAviso({ tipo: 'erro', texto: `${erro.message} Você pode usar a preparação sem IA normalmente.` });
    } finally { setGerando(false); }
  };

  const aplicarSugestao = () => {
    if (!sugestao) return;
    setPreparacao(atual => ({
      ...atual,
      evidencia: atual.evidencia || sugestao.evidencia || '',
      hipotese: atual.hipotese || sugestao.hipotese || '',
      pedidoDesejado: atual.pedidoDesejado || sugestao.proximoPasso || '',
    }));
    setAviso({ tipo: 'ok', texto: 'Os campos vazios foram preenchidos sem substituir o que você já escreveu.' });
  };

  const salvar = async () => {
    const faltando = validarRegistroProspeccao(preparacao);
    if (aba === 'registrar' && faltando.length > 0) {
      setAviso({ tipo: 'erro', texto: `Antes de registrar, preencha: ${faltando.join(', ')}.` });
      return;
    }
    setSalvando(true); setAviso(null);
    try {
      await aoSalvar(lead.id, preparacao, resumo, aba === 'registrar');
      setAviso({ tipo: 'ok', texto: aba === 'registrar' ? 'Prospecção registrada na linha do tempo.' : 'Preparação salva no lead.' });
    } catch (erro) {
      setAviso({ tipo: 'erro', texto: `Não foi possível salvar: ${erro.message}` });
    } finally { setSalvando(false); }
  };

  return (
    <div className="copiloto-page">
      <header className="copiloto-header">
        <div><span className="copiloto-eyebrow">MÉTODO PORTEL · PADRÕES REAIS DA RUGIDO</span><h1>Ligação de prospecção</h1><p>Encontre a pessoa certa, valide apenas o necessário e conquiste um próximo passo legítimo.</p></div>
        <div className="copiloto-acoes"><button className="btn btn-ghost" onClick={aoTrocar}>Trocar empresa</button>{aoAbrirLead && <button className="btn btn-ghost" onClick={() => aoAbrirLead(lead)}>Abrir cadastro</button>}</div>
      </header>

      <div className="copiloto-contexto">
        <CartaoLead lead={lead} ativo aoEscolher={() => {}} />
        <div className="copiloto-progresso"><span><strong>{progresso}%</strong> da preparação essencial</span><div><i style={{ width: `${progresso}%` }} /></div></div>
      </div>

      <nav className="copiloto-abas" aria-label="Etapas da prospecção">
        {ABAS.map(item => <button key={item.id} className={aba === item.id ? 'ativo' : ''} onClick={() => setAba(item.id)}><small>{item.numero}</small><span>{item.titulo}</span></button>)}
      </nav>

      {aviso && <div className={`copiloto-aviso ${aviso.tipo}`} role="status">{aviso.texto}</div>}

      <main className="copiloto-conteudo">
        {aba === 'preparar' && (
          <>
            <section className="copiloto-card copiloto-card-destaque">
              <div className="copiloto-card-titulo"><div><span>ANTES DE LIGAR</span><h2>Entre com um objetivo pequeno e claro</h2><p>A ligação fria abre a próxima porta. Ela não substitui a reunião comercial.</p></div><div className="copiloto-botoes-ia"><button className="btn btn-ghost" onClick={prepararSemIa}>Montar base sem IA</button><button className="btn btn-primary" onClick={prepararComIa} disabled={gerando}>{gerando ? 'Preparando…' : 'Preparar com IA · opcional'}</button></div></div>
              <div className="copiloto-grid-2">
                <Campo rotulo="Objetivo da ligação" valor={preparacao.objetivo} aoMudar={v => atualizar('objetivo', v)} placeholder="O que precisa acontecer nesta tentativa?" />
                <Campo rotulo="Contato esperado" valor={preparacao.contatoEsperado} aoMudar={v => atualizar('contatoEsperado', v)} placeholder="Nome, cargo ou área da pessoa procurada" />
                <Campo rotulo="Fato ou evidência" ajuda="Algo observado ou registrado. Não inclua suposições." valor={preparacao.evidencia} aoMudar={v => atualizar('evidencia', v)} placeholder="Ex.: o site direciona todos os pedidos ao mesmo canal" />
                <Campo rotulo="Hipótese a validar" ajuda="Apresente como possibilidade: “isso acontece por aí?”" valor={preparacao.hipotese} aoMudar={v => atualizar('hipotese', v)} placeholder="Pode existir um gargalo em…" />
                <Campo rotulo="Pedido desejado" valor={preparacao.pedidoDesejado} aoMudar={v => atualizar('pedidoDesejado', v)} placeholder="Orientação, retorno ou reunião com a pessoa certa" />
              </div>
            </section>

            <section className="copiloto-card copiloto-fundamentos">
              <div className="copiloto-card-titulo"><div><span>PADRÃO OBSERVADO NAS LIGAÇÕES</span><h2>Dois minutos para conquistar a próxima conversa</h2><p>As falas abaixo foram adaptadas das prospecções reais da Rugido. Use a intenção; não recite como teatro.</p></div></div>
              <div className="copiloto-cinco-passos">{PASSOS_PREPARACAO.map((item, i) => <div key={item.titulo}><b>{String(i + 1).padStart(2, '0')}</b><span><strong>{item.titulo}</strong><small>{item.texto}</small></span></div>)}</div>
            </section>

            {sugestao && <section className="copiloto-card copiloto-sugestao"><div className="copiloto-card-titulo"><div><span>ABORDAGEM SUGERIDA · REVISE ANTES DE USAR</span><h2>{sugestao.briefing}</h2></div><button className="btn btn-ghost" onClick={aplicarSugestao}>Usar nos campos vazios</button></div><p className="copiloto-abertura">“{sugestao.abertura}”</p><div className="copiloto-grid-2"><div><h3>Perguntas prioritárias</h3><ul>{(sugestao.perguntas || []).map((q, i) => <li key={i}>{q}</li>)}</ul></div><div><h3>Possíveis desvios</h3><ul>{(sugestao.desvios || []).map((q, i) => <li key={i}>{q}</li>)}</ul></div></div></section>}
          </>
        )}

        {aba === 'ligar' && (
          <div className="copiloto-conduzir">
            <section className="copiloto-roteiro">
              {ETAPAS_LIGACAO.map((etapa, indice) => {
                const concluida = Boolean(preparacao.etapasConcluidas?.[etapa.id]);
                return <article key={etapa.id} className={`copiloto-etapa ${concluida ? 'concluida' : ''}`}><button type="button" className="copiloto-check" aria-label={`Marcar ${etapa.titulo} como ${concluida ? 'não concluída' : 'concluída'}`} onClick={() => atualizar('etapasConcluidas', { ...(preparacao.etapasConcluidas || {}), [etapa.id]: !concluida })}>{concluida ? '✓' : indice + 1}</button><div><div className="copiloto-etapa-topo"><h2>{etapa.titulo}</h2><span>{etapa.tempo}</span></div><p>{etapa.objetivo}</p><blockquote>{etapa.frase}</blockquote><p className="copiloto-intencao"><strong>Por que funciona:</strong> {etapa.intencao}</p><ul>{etapa.perguntas.map(q => <li key={q}>{q}</li>)}</ul></div></article>;
              })}
            </section>
            <aside className="copiloto-lateral">
              <div className="copiloto-card copiloto-regra-tempo"><span className="copiloto-eyebrow">TEMPO É REFERÊNCIA, NÃO CRONÔMETRO</span><h2>Curta por padrão</h2><ul><li>Peça dois minutos no início.</li><li>Busque concluir em 3–5 minutos.</li><li>Se a conversa estiver útil, peça permissão para aprofundar.</li><li>As ligações de 6–12 minutos são exceções com engajamento, não a meta.</li></ul></div>
              <div className="copiloto-card"><span className="copiloto-eyebrow">ROTAS REAIS DE LIGAÇÃO</span><p>Escolha a situação e adapte a fala ao contexto.</p>{ROTAS_LIGACAO.map(rota => <div key={rota.id} className="copiloto-objecao"><button onClick={() => setRotaAberta(rotaAberta === rota.id ? null : rota.id)} aria-expanded={rotaAberta === rota.id}>{rota.titulo}<span>{rotaAberta === rota.id ? '−' : '+'}</span></button>{rotaAberta === rota.id && <div><p><strong>Intenção:</strong> {rota.intencao}</p><p><strong>Exemplo:</strong> “{rota.fala}”</p></div>}</div>)}</div>
            </aside>
          </div>
        )}

        {aba === 'registrar' && (
          <section className="copiloto-card">
            <div className="copiloto-card-titulo"><div><span>RESULTADO DA TENTATIVA</span><h2>Registre a rota conquistada</h2><p>Nem toda boa ligação vira reunião. Nome do decisor, horário de retorno e uma perda clara também são resultados úteis.</p></div></div>
            <div className="copiloto-grid-2">
              <CampoLinha rotulo="Pessoa que atendeu" valor={preparacao.pessoaAtendente} aoMudar={v => atualizar('pessoaAtendente', v)} placeholder="Nome, se informado" />
              <CampoLinha rotulo="Papel da pessoa" valor={preparacao.papelAtendente} aoMudar={v => atualizar('papelAtendente', v)} placeholder="Recepção, vendedor, sócio…" />
              <CampoLinha rotulo="Decisor identificado" valor={preparacao.decisorIdentificado} aoMudar={v => atualizar('decisorIdentificado', v)} placeholder="Nome e função" />
              <label className="copiloto-campo"><span>Resultado da ligação *</span><select className="form-control" value={preparacao.resultado} onChange={e => atualizar('resultado', e.target.value)}><option value="">Selecione o resultado</option>{RESULTADOS_PROSPECCAO.map(item => <option key={item.id} value={item.id}>{item.rotulo}</option>)}</select></label>
              <Campo rotulo="Contexto apresentado" valor={preparacao.contextoApresentado} aoMudar={v => atualizar('contextoApresentado', v)} placeholder="O que foi dito para explicar o contato?" />
              <Campo rotulo="Sinal ou problema confirmado" valor={preparacao.sinalConfirmado} aoMudar={v => atualizar('sinalConfirmado', v)} placeholder="O que a pessoa confirmou — ou que não acontece por ali" />
              <Campo rotulo="Objeção encontrada" valor={preparacao.objecao} aoMudar={v => atualizar('objecao', v)} placeholder="Ex.: sem tempo, já possui fornecedor, pediu material" />
              <Campo rotulo="Próximo passo" valor={preparacao.proximoPasso} aoMudar={v => atualizar('proximoPasso', v)} placeholder="Ex.: retornar para Ana e confirmar a reunião" />
              <CampoLinha rotulo="Responsável pelo próximo passo" valor={preparacao.responsavel} aoMudar={v => atualizar('responsavel', v)} placeholder="Pessoa responsável" />
              <CampoLinha rotulo="Data e hora do próximo passo" tipo="datetime-local" valor={preparacao.dataProximoPasso} aoMudar={v => atualizar('dataProximoPasso', v)} />
              <Campo rotulo="Notas adicionais" valor={preparacao.notas} aoMudar={v => atualizar('notas', v)} placeholder="Correções e contexto que ajudarão a próxima pessoa" />
            </div>
            <div className="copiloto-resumo"><span>PRÉVIA DO REGISTRO NO CRM</span><pre>{resumo || 'Selecione o resultado e registre o que foi aprendido.'}</pre></div>
          </section>
        )}
      </main>

      <footer className="copiloto-footer"><span>{aba === 'registrar' ? 'Retorno, reunião e nutrição exigem responsável e data.' : 'Salve para continuar de qualquer computador.'}</span><button className="btn btn-primary" onClick={salvar} disabled={!podeEditar || salvando}>{!podeEditar ? 'Acesso somente leitura' : salvando ? 'Salvando…' : aba === 'registrar' ? 'Salvar resultado da prospecção' : 'Salvar preparação'}</button></footer>
    </div>
  );
}

export default function CopilotoReuniaoPage({ leads = [], leadInicialId = null, podeEditar = false, aoSalvar, aoAbrirLead }) {
  const [leadEscolhidoId, setLeadEscolhidoId] = useState('');
  const [busca, setBusca] = useState('');
  const leadId = leadEscolhidoId || leadInicialId || '';
  const lead = leads.find(item => String(item.id) === String(leadId)) || null;

  const ordenados = useMemo(() => [...leads].sort((a, b) => {
    if (a.proximaAcaoDataHora && b.proximaAcaoDataHora) return a.proximaAcaoDataHora.localeCompare(b.proximaAcaoDataHora);
    if (a.proximaAcaoDataHora) return -1;
    if (b.proximaAcaoDataHora) return 1;
    return String(a.nome || '').localeCompare(String(b.nome || ''));
  }), [leads]);
  const visiveis = ordenados.filter(item => {
    const texto = `${item.nome || ''} ${item.decisor || ''} ${item.nicho || ''}`.toLowerCase();
    return texto.includes(busca.trim().toLowerCase());
  }).slice(0, 30);

  if (lead) {
    return <CopilotoWorkspace key={lead.id} lead={lead} podeEditar={podeEditar} aoSalvar={aoSalvar} aoAbrirLead={aoAbrirLead} aoTrocar={() => setLeadEscolhidoId('__trocar__')} />;
  }

  return (
    <div className="copiloto-page">
      <header className="copiloto-header">
        <div><span className="copiloto-eyebrow">MÉTODO PORTEL · PROSPECÇÃO CONSULTIVA</span><h1>Ligação de prospecção</h1><p>Escolha a empresa que receberá o próximo contato.</p></div>
      </header>
      <main className="copiloto-seletor-vazio">
        <div className="copiloto-seletor-topo"><div><strong>Para quem você vai ligar?</strong><span>Leads com próxima ação marcada aparecem primeiro.</span></div><input className="form-control" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar empresa, decisor ou nicho…" aria-label="Buscar lead para prospecção" /></div>
        <div className="copiloto-lista-leads">
          {visiveis.map(item => <CartaoLead key={item.id} lead={item} aoEscolher={() => setLeadEscolhidoId(item.id)} />)}
          {visiveis.length === 0 && <div className="copiloto-vazio">Nenhum lead encontrado. Cadastre ou ajuste a busca na tela de Leads.</div>}
        </div>
      </main>
    </div>
  );
}
