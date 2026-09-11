import React, { useEffect, useMemo, useState } from 'react';
import { apiPost } from '../api';
import { escutarAtividadesDoLead } from '../atividades';
import {
  ESTRUTURA_LIGACAO, ETAPAS_REUNIAO, OBJECOES_REUNIAO, PRINCIPIOS_CONVERSAO,
  criarPreparacaoInicial, montarResumoCrm, progressoPreparacao,
  sugestaoManual, validarRegistroReuniao,
} from '../reuniao';

const ABAS = [
  { id: 'preparar', numero: '01', titulo: 'Preparar' },
  { id: 'conduzir', numero: '02', titulo: 'Conduzir' },
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

function CartaoLead({ lead, ativo, aoEscolher }) {
  return (
    <button type="button" className={`copiloto-lead ${ativo ? 'ativo' : ''}`} onClick={aoEscolher}>
      <span className="copiloto-lead-avatar">{String(lead.nome || '?').slice(0, 2).toUpperCase()}</span>
      <span className="copiloto-lead-texto">
        <strong>{lead.nome}</strong>
        <small>{[lead.decisor, lead.nicho, lead.reuniao ? `Reunião ${lead.reuniao.split('-').reverse().join('/')}` : ''].filter(Boolean).join(' · ') || 'Contexto ainda incompleto'}</small>
      </span>
    </button>
  );
}

function CopilotoWorkspace({ lead, podeEditar, aoSalvar, aoAbrirLead, aoTrocar }) {
  const [aba, setAba] = useState('preparar');
  const [preparacao, setPreparacao] = useState(() => criarPreparacaoInicial(lead));
  const [atividades, setAtividades] = useState([]);
  const [sugestao, setSugestao] = useState(null);
  const [gerando, setGerando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [objecaoAberta, setObjecaoAberta] = useState(null);

  useEffect(() => {
    return escutarAtividadesDoLead(lead.id, setAtividades);
  }, [lead.id]);

  const atualizar = (campo, valor) => setPreparacao(atual => ({ ...atual, [campo]: valor }));
  const progresso = progressoPreparacao(preparacao);
  const resumo = montarResumoCrm(preparacao);

  const prepararSemIa = () => {
    setSugestao(sugestaoManual(lead, preparacao));
    setAviso({ tipo: 'ok', texto: 'Base montada com os dados do CRM e o Método Portel. Revise: ela não transforma hipótese em fato.' });
  };

  const prepararComIa = async () => {
    setGerando(true); setAviso(null);
    try {
      const resposta = await apiPost('/api/preparar-reuniao', { lead, atividades, preparacao });
      setSugestao(resposta.sugestao);
      setAviso({ tipo: 'ok', texto: 'Sugestão gerada. Nada foi salvo automaticamente; confira os fatos antes de usar.' });
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
      proximoPasso: atual.proximoPasso || sugestao.proximoPasso || '',
    }));
    setAviso({ tipo: 'ok', texto: 'Os campos vazios foram preenchidos. Os registros que você já escreveu foram preservados.' });
  };

  const salvar = async () => {
    const faltando = validarRegistroReuniao(preparacao);
    if (aba === 'registrar' && faltando.length > 0) {
      setAviso({ tipo: 'erro', texto: `Antes de registrar, preencha: ${faltando.join(', ')}.` });
      return;
    }
    setSalvando(true); setAviso(null);
    try {
      await aoSalvar(lead.id, preparacao, resumo, aba === 'registrar');
      setAviso({ tipo: 'ok', texto: aba === 'registrar' ? 'Reunião registrada na linha do tempo.' : 'Preparação salva no lead.' });
    } catch (erro) {
      setAviso({ tipo: 'erro', texto: `Não foi possível salvar: ${erro.message}` });
    } finally { setSalvando(false); }
  };

  return (
    <div className="copiloto-page">
      <header className="copiloto-header">
        <div><span className="copiloto-eyebrow">MÉTODO PORTEL · TRILHO, NÃO TEATRO</span><h1>Copiloto de reunião</h1><p>Descubra antes de prescrever. A saída pode ser avançar, preparar, acompanhar ou não vender.</p></div>
        <div className="copiloto-acoes"><button className="btn btn-ghost" onClick={aoTrocar}>Trocar empresa</button>{aoAbrirLead && <button className="btn btn-ghost" onClick={() => aoAbrirLead(lead)}>Abrir cadastro</button>}</div>
      </header>

      <div className="copiloto-contexto">
        <CartaoLead lead={lead} ativo aoEscolher={() => {}} />
        <div className="copiloto-progresso"><span><strong>{progresso}%</strong> da preparação essencial</span><div><i style={{ width: `${progresso}%` }} /></div></div>
      </div>

      <nav className="copiloto-abas" aria-label="Etapas da reunião">
        {ABAS.map(item => <button key={item.id} className={aba === item.id ? 'ativo' : ''} onClick={() => setAba(item.id)}><small>{item.numero}</small><span>{item.titulo}</span></button>)}
      </nav>

      {aviso && <div className={`copiloto-aviso ${aviso.tipo}`} role="status">{aviso.texto}</div>}

      <main className="copiloto-conteudo">
        {aba === 'preparar' && (
          <>
            <section className="copiloto-card copiloto-card-destaque">
              <div className="copiloto-card-titulo"><div><span>ANTES DA REUNIÃO</span><h2>Separe o que sabemos do que queremos validar</h2></div><div className="copiloto-botoes-ia"><button className="btn btn-ghost" onClick={prepararSemIa}>Montar base sem IA</button><button className="btn btn-primary" onClick={prepararComIa} disabled={gerando}>{gerando ? 'Preparando…' : 'Preparar com IA · opcional'}</button></div></div>
              <div className="copiloto-grid-2">
                <Campo rotulo="Objetivo desta conversa" valor={preparacao.objetivo} aoMudar={v => atualizar('objetivo', v)} placeholder="O que precisa ficar claro ao final?" />
                <Campo rotulo="Participantes e papéis" valor={preparacao.participantes} aoMudar={v => atualizar('participantes', v)} placeholder="Quem participa, influencia ou decide?" />
                <Campo rotulo="Fatos e evidências" ajuda="Algo observado, dito ou registrado. Não inclua suposições." valor={preparacao.evidencia} aoMudar={v => atualizar('evidencia', v)} placeholder="Ex.: o decisor informou que…" />
                <Campo rotulo="Hipótese a validar" ajuda="Escreva como possibilidade, não como diagnóstico." valor={preparacao.hipotese} aoMudar={v => atualizar('hipotese', v)} placeholder="Pode existir um gargalo em…" />
                <Campo rotulo="Decisão desejada" valor={preparacao.decisaoDesejada} aoMudar={v => atualizar('decisaoDesejada', v)} placeholder="Ex.: decidir se vale avançar para diagnóstico" />
              </div>
            </section>

            <section className="copiloto-card copiloto-fundamentos">
              <div className="copiloto-card-titulo"><div><span>ANTES DE PEGAR O TELEFONE</span><h2>Uma ligação curta, relevante e humana</h2><p>Síntese prática de Prospecção Fanática, Armas da Persuasão e do método de rapport de Jack Schafer, ajustada às ligações reais da Rugido.</p></div></div>
              <div className="copiloto-cinco-passos">{ESTRUTURA_LIGACAO.map((item, i) => <div key={item.titulo}><b>{String(i + 1).padStart(2, '0')}</b><span><strong>{item.titulo}</strong><small>{item.texto}</small></span></div>)}</div>
              <details className="copiloto-principios"><summary>Ver princípios de persuasão aplicados com segurança</summary><div className="copiloto-principios-grid">{PRINCIPIOS_CONVERSAO.map(item => <article key={`${item.fonte}-${item.titulo}`}><span>{item.fonte}</span><h3>{item.titulo}</h3><p><strong>Use:</strong> {item.usar}</p><p><strong>Evite:</strong> {item.evitar}</p></article>)}</div></details>
            </section>

            {sugestao && <section className="copiloto-card copiloto-sugestao"><div className="copiloto-card-titulo"><div><span>BRIEFING SUGERIDO · REVISE ANTES DE USAR</span><h2>{sugestao.briefing}</h2></div><button className="btn btn-ghost" onClick={aplicarSugestao}>Usar nos campos vazios</button></div><p className="copiloto-abertura">“{sugestao.abertura}”</p><div className="copiloto-grid-2"><div><h3>Perguntas prioritárias</h3><ul>{(sugestao.perguntas || []).map((q, i) => <li key={i}>{q}</li>)}</ul></div><div><h3>Riscos a evitar</h3><ul>{(sugestao.riscos || []).map((q, i) => <li key={i}>{q}</li>)}</ul></div></div></section>}
          </>
        )}

        {aba === 'conduzir' && (
          <div className="copiloto-conduzir">
            <section className="copiloto-roteiro">
              {ETAPAS_REUNIAO.map((etapa, indice) => {
                const concluida = Boolean(preparacao.etapasConcluidas?.[etapa.id]);
                return <article key={etapa.id} className={`copiloto-etapa ${concluida ? 'concluida' : ''}`}><button type="button" className="copiloto-check" aria-label={`Marcar ${etapa.titulo} como ${concluida ? 'não concluída' : 'concluída'}`} onClick={() => atualizar('etapasConcluidas', { ...(preparacao.etapasConcluidas || {}), [etapa.id]: !concluida })}>{concluida ? '✓' : indice + 1}</button><div><div className="copiloto-etapa-topo"><h2>{etapa.titulo}</h2><span>{etapa.tempo}</span></div><p>{etapa.objetivo}</p><blockquote>{etapa.frase}</blockquote><ul>{etapa.perguntas.map(q => <li key={q}>{q}</li>)}</ul></div></article>;
              })}
            </section>
            <aside className="copiloto-lateral"><div className="copiloto-card"><span className="copiloto-eyebrow">LEMBRETE AO BDR</span><h2>Escute para descobrir</h2><p>Escolha poucas perguntas e siga a resposta. Não leia tudo como questionário.</p><ul><li>Peça exemplos concretos.</li><li>Resuma e peça correção.</li><li>Não prometa resultado.</li><li>Não ataque fornecedor atual.</li><li>Sem autonomia local? Registre e busque a rota correta.</li></ul></div><div className="copiloto-card"><span className="copiloto-eyebrow">OBJEÇÕES · PARE + LDA</span><p className="copiloto-pare">Pausar · Acolher · Reenquadrar · Encaminhar</p><p>Na fala: uma frase de apoio, uma mudança de perspectiva e uma pergunta. Um reenquadramento por objeção; se o não continuar, encerre.</p>{OBJECOES_REUNIAO.map(o => <div key={o.id} className="copiloto-objecao"><button onClick={() => setObjecaoAberta(objecaoAberta === o.id ? null : o.id)} aria-expanded={objecaoAberta === o.id}>{o.titulo}<span>{objecaoAberta === o.id ? '−' : '+'}</span></button>{objecaoAberta === o.id && <div><p><strong>Acolher:</strong> {o.acolher}</p><p><strong>Reenquadrar:</strong> {o.reenquadrar}</p><p><strong>Encaminhar:</strong> {o.encaminhar}</p></div>}</div>)}</div></aside>
          </div>
        )}

        {aba === 'registrar' && (
          <section className="copiloto-card">
            <div className="copiloto-card-titulo"><div><span>PASSAGEM DE BASTÃO</span><h2>Registre o que a conversa demonstrou</h2><p>Se não houve problema ou prioridade, escreva isso. Uma perda bem registrada é melhor que um avanço inventado.</p></div></div>
            <div className="copiloto-grid-2">
              <Campo rotulo="Situação atual *" valor={preparacao.situacao} aoMudar={v => atualizar('situacao', v)} placeholder="Como o processo funciona hoje?" />
              <Campo rotulo="Problema ou ausência dele *" valor={preparacao.problema} aoMudar={v => atualizar('problema', v)} placeholder="Qual gargalo foi confirmado? Ou não foi identificado?" />
              <Campo rotulo="Impacto" valor={preparacao.impacto} aoMudar={v => atualizar('impacto', v)} placeholder="Consequência em receita, tempo, capacidade ou risco" />
              <Campo rotulo="Por que agora / evento crítico" valor={preparacao.eventoCritico} aoMudar={v => atualizar('eventoCritico', v)} placeholder="Por que isso é prioridade neste momento?" />
              <Campo rotulo="Como a decisão acontece" valor={preparacao.decisao} aoMudar={v => atualizar('decisao', v)} placeholder="Quem decide, critérios, restrições e prazo" />
              <Campo rotulo="Critérios de uma boa solução" valor={preparacao.criteriosSolucao} aoMudar={v => atualizar('criteriosSolucao', v)} placeholder="O que precisa ser entregue ou medido?" />
              <Campo rotulo="Próximo passo, responsável e data *" valor={preparacao.proximoPasso} aoMudar={v => atualizar('proximoPasso', v)} placeholder="Ex.: Guilherme envia diagnóstico até 15/09; Ana revisa até 17/09" />
              <Campo rotulo="Notas adicionais" valor={preparacao.notas} aoMudar={v => atualizar('notas', v)} placeholder="Objeções, correções e contexto que não cabem acima" />
            </div>
            <div className="copiloto-resumo"><span>PRÉVIA DO REGISTRO NO CRM</span><pre>{resumo || 'Preencha os campos acima para formar um resumo objetivo.'}</pre></div>
          </section>
        )}
      </main>

      <footer className="copiloto-footer"><span>{aba === 'registrar' ? 'Campos com * evitam uma passagem de bastão vazia.' : 'Salve para continuar de qualquer computador.'}</span><button className="btn btn-primary" onClick={salvar} disabled={!podeEditar || salvando}>{!podeEditar ? 'Acesso somente leitura' : salvando ? 'Salvando…' : aba === 'registrar' ? 'Salvar registro da reunião' : 'Salvar preparação'}</button></footer>
    </div>
  );
}

export default function CopilotoReuniaoPage({ leads = [], leadInicialId = null, podeEditar = false, aoSalvar, aoAbrirLead }) {
  const [leadEscolhidoId, setLeadEscolhidoId] = useState('');
  const [busca, setBusca] = useState('');
  const leadId = leadEscolhidoId || leadInicialId || '';
  const lead = leads.find(item => String(item.id) === String(leadId)) || null;

  const ordenados = useMemo(() => [...leads].sort((a, b) => {
    if (a.reuniao && b.reuniao) return a.reuniao.localeCompare(b.reuniao);
    if (a.reuniao) return -1;
    if (b.reuniao) return 1;
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
        <div><span className="copiloto-eyebrow">MÉTODO PORTEL · PROSPECÇÃO CONSULTIVA</span><h1>Copiloto de reunião</h1><p>Escolha uma empresa para preparar a conversa — sem decorar script e sem improvisar promessa.</p></div>
      </header>
      <main className="copiloto-seletor-vazio">
        <div className="copiloto-seletor-topo"><div><strong>Qual conversa você vai preparar?</strong><span>Reuniões marcadas aparecem primeiro.</span></div><input className="form-control" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar empresa, decisor ou nicho…" aria-label="Buscar lead para a reunião" /></div>
        <div className="copiloto-lista-leads">
          {visiveis.map(item => <CartaoLead key={item.id} lead={item} aoEscolher={() => setLeadEscolhidoId(item.id)} />)}
          {visiveis.length === 0 && <div className="copiloto-vazio">Nenhum lead encontrado. Cadastre ou ajuste a busca na tela de Leads.</div>}
        </div>
      </main>
    </div>
  );
}
