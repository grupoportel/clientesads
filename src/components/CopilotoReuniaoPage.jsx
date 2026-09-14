import React, { useEffect, useMemo, useState } from 'react';
import { apiPost } from '../api';
import { escutarAtividadesDoLead } from '../atividades';
import { CENARIOS, OBJECOES, orientarLigacao } from '../conducaoBdr';
import {
  PASSOS_PREPARACAO, RESULTADOS_PROSPECCAO,
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

function CopilotoWorkspace({ lead, podeEditar, aoSalvar, aoAbrirLead, aoTrocar, aoAgendar }) {
  const [aba, setAba] = useState('preparar');
  const [preparacao, setPreparacao] = useState(() => criarPreparacaoProspeccao(lead));
  const [atividades, setAtividades] = useState([]);
  const [sugestao, setSugestao] = useState(null);
  const [gerando, setGerando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [rotaAberta, setRotaAberta] = useState(null);
  const [cenario, setCenario] = useState('recepcao');
  const [ultimoSalvo, setUltimoSalvo] = useState(() => JSON.stringify(criarPreparacaoProspeccao(lead)));
  const alterado = JSON.stringify(preparacao) !== ultimoSalvo;
  const orientacao = orientarLigacao(cenario, lead, preparacao);
  const bloqueado = lead.optOut === true || lead.optOut === 'true';

  useEffect(() => escutarAtividadesDoLead(lead.id, setAtividades), [lead.id]);
  useEffect(() => {
    if (!alterado) return;
    const avisar = e => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [alterado]);
  const sair = acao => {
    if (salvando) return;
    if (alterado && !window.confirm('Há anotações não salvas. Deseja sair e descartá-las?')) return;
    acao();
  };
  const agendar = async () => {
    const faltando = validarRegistroProspeccao(preparacao);
    if (faltando.length) { setAviso({ tipo: 'erro', texto: `Complete antes de agendar: ${faltando.join(', ')}.` }); return; }
    setSalvando(true);
    try {
      await aoSalvar(lead.id, preparacao, resumo, true);
      setUltimoSalvo(JSON.stringify(preparacao));
      aoAgendar?.({ ...lead, decisor: preparacao.decisorIdentificado, decisorPapel: preparacao.decisorPapel, preparacaoProspeccao: preparacao });
    } catch (erro) { setAviso({ tipo: 'erro', texto: erro.message }); }
    finally { setSalvando(false); }
  };

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
      perguntaPrincipal: atual.perguntaPrincipal || sugestao.perguntas?.[0] || '',
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
      setUltimoSalvo(JSON.stringify(preparacao));
      setAviso({ tipo: 'ok', texto: aba === 'registrar' ? 'Prospecção registrada na linha do tempo.' : 'Preparação salva no lead.' });
    } catch (erro) {
      setAviso({ tipo: 'erro', texto: `Não foi possível salvar: ${erro.message}` });
    } finally { setSalvando(false); }
  };

  return (
    <div className="copiloto-page">
      <header className="copiloto-header">
        <div><span className="copiloto-eyebrow">MÉTODO PORTEL · PADRÕES REAIS DA RUGIDO</span><h1>Ligação de prospecção</h1><p>Encontre a pessoa certa, valide apenas o necessário e conquiste um próximo passo legítimo.</p></div>
        <div className="copiloto-acoes"><button className="btn btn-ghost" onClick={() => sair(aoTrocar)}>Trocar empresa</button>{aoAbrirLead && <button className="btn btn-ghost" onClick={() => sair(() => aoAbrirLead(lead))}>Abrir cadastro</button>}</div>
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
                <CampoLinha rotulo="Fonte da evidência" valor={preparacao.fonteEvidencia} aoMudar={v => atualizar('fonteEvidencia', v)} placeholder="Página, observação ou conversa que originou o fato" />
                <Campo rotulo="Pergunta principal" valor={preparacao.perguntaPrincipal} aoMudar={v => atualizar('perguntaPrincipal', v)} placeholder="Uma pergunta para confirmar ou corrigir a hipótese" />
                <label className="copiloto-campo"><span>Rota comercial provável</span><select className="form-control" value={preparacao.rotaComercial} onChange={e => atualizar('rotaComercial', e.target.value)}><option value="">Ainda não definida</option><option value="estruturacao">Estruturação comercial</option><option value="pontual">Serviço pontual</option><option value="relacionamento">Relacionamento futuro</option><option value="encerramento">Encerramento</option></select><small>Uma hipótese de encaminhamento; confirme a necessidade antes de oferecer escopo.</small></label>
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
              <div className="copiloto-card">
                <label className="copiloto-campo"><span>Situação da ligação</span><select className="form-control" value={cenario} onChange={e => setCenario(e.target.value)}>{CENARIOS.map(([id, titulo]) => <option key={id} value={id}>{titulo}</option>)}</select></label>
                {bloqueado ? <p role="alert">Este contato pediu para não receber abordagens. Encerre a prospecção.</p> : <>
                  <h2>O que dizer agora</h2><p className="copiloto-abertura">{orientacao.fala}</p>
                  <p><strong>Contexto da empresa:</strong> {orientacao.contexto}</p>
                  {preparacao.hipotese && <p><strong>Hipótese a conferir:</strong> {preparacao.hipotese}</p>}
                  <p><strong>Pergunta:</strong> {orientacao.pergunta}</p>
                  <p className="copiloto-intencao"><strong>Como decidir:</strong> {orientacao.saida}</p>
                  <label className="copiloto-campo"><span>Quem pode decidir?</span><select className="form-control" value={preparacao.autonomia} onChange={e => atualizar('autonomia', e.target.value)}><option value="">Ainda preciso confirmar</option><option value="local">Decisão local</option><option value="compartilhada">Decisão compartilhada / incluir sócio</option><option value="matriz">Matriz ou franqueadora</option><option value="sem_autonomia">Contato sem autonomia</option></select></label>
                  <CampoLinha rotulo="Participante adequado / decisor" valor={preparacao.decisorIdentificado} aoMudar={v => atualizar('decisorIdentificado', v)} />
                  <CampoLinha rotulo="Papel do participante" valor={preparacao.decisorPapel} aoMudar={v => atualizar('decisorPapel', v)} placeholder="Proprietário, gerente, sócio…" />
                  <Campo rotulo="O que a pessoa respondeu?" valor={preparacao.sinalConfirmado} aoMudar={v => atualizar('sinalConfirmado', v)} linhas={2} placeholder="Registre a resposta, inclusive se corrigiu a hipótese" />
                  <details><summary>Quando convidar para a reunião</summary><p>Com relevância e participantes adequados: “Faz sentido uma reunião de 30 minutos, em outro horário, para olhar esse ponto com calma?” Confira a agenda antes de oferecer horários.</p><p>Serviço pontual: delimite a necessidade. Estruturação: avalie os processos envolvidos. Sem prioridade: combine apenas uma retomada autorizada.</p></details>
                </>}
              </div>
            </section>
            <aside className="copiloto-lateral">
              <div className="copiloto-card copiloto-regra-tempo"><span className="copiloto-eyebrow">TEMPO É REFERÊNCIA, NÃO CRONÔMETRO</span><h2>Curta por padrão</h2><ul><li>Peça dois minutos no início.</li><li>Busque concluir em 3–5 minutos.</li><li>Se a conversa estiver útil, peça permissão para aprofundar.</li><li>As ligações de 6–12 minutos são exceções com engajamento, não a meta.</li></ul></div>
              <div className="copiloto-card"><span className="copiloto-eyebrow">PARE: PAUSAR · ACOLHER · REENQUADRAR · ENCAMINHAR</span><p>Ouça até o fim. Faça no máximo um reenquadramento; respeite a recusa.</p>{OBJECOES.map(rota => <div key={rota.id} className="copiloto-objecao"><button onClick={() => setRotaAberta(rotaAberta === rota.id ? null : rota.id)} aria-expanded={rotaAberta === rota.id}>{rota.titulo}<span>{rotaAberta === rota.id ? '−' : '+'}</span></button>{rotaAberta === rota.id && <div><p><strong>Fala / pergunta:</strong> {rota.pergunta}</p><p><strong>Próximo passo:</strong> {rota.seguir}</p><p><strong>Quando encerrar:</strong> {rota.parar}</p></div>}</div>)}</div>
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
              <CampoLinha rotulo="Papel do participante" valor={preparacao.decisorPapel} aoMudar={v => atualizar('decisorPapel', v)} />
              <label className="copiloto-campo"><span>Autonomia para a decisão</span><select className="form-control" value={preparacao.autonomia} onChange={e => atualizar('autonomia', e.target.value)}><option value="">Ainda preciso confirmar</option><option value="local">Decisão local</option><option value="compartilhada">Decisão compartilhada / incluir sócio</option><option value="matriz">Matriz ou franqueadora</option><option value="sem_autonomia">Contato sem autonomia</option></select></label>
              <label className="copiloto-campo"><span>Resultado da ligação *</span><select className="form-control" value={preparacao.resultado} onChange={e => atualizar('resultado', e.target.value)}><option value="">Selecione o resultado</option>{RESULTADOS_PROSPECCAO.map(item => <option key={item.id} value={item.id}>{item.rotulo}</option>)}</select></label>
              <Campo rotulo="Contexto apresentado" valor={preparacao.contextoApresentado} aoMudar={v => atualizar('contextoApresentado', v)} placeholder="O que foi dito para explicar o contato?" />
              <Campo rotulo="Sinal ou problema confirmado" valor={preparacao.sinalConfirmado} aoMudar={v => atualizar('sinalConfirmado', v)} placeholder="O que a pessoa confirmou — ou que não acontece por ali" />
              <Campo rotulo="Objeção encontrada" valor={preparacao.objecao} aoMudar={v => atualizar('objecao', v)} placeholder="Ex.: sem tempo, já possui fornecedor, pediu material" />
              <Campo rotulo="Próximo passo" valor={preparacao.proximoPasso} aoMudar={v => atualizar('proximoPasso', v)} placeholder="Ex.: retornar para Ana e confirmar a reunião" />
              <CampoLinha rotulo="Responsável pelo próximo passo" valor={preparacao.responsavel} aoMudar={v => atualizar('responsavel', v)} placeholder="Pessoa responsável" />
              <CampoLinha rotulo="Data e hora do próximo passo" tipo="datetime-local" valor={preparacao.dataProximoPasso} aoMudar={v => atualizar('dataProximoPasso', v)} />
              <Campo rotulo="Notas adicionais" valor={preparacao.notas} aoMudar={v => atualizar('notas', v)} placeholder="Correções e contexto que ajudarão a próxima pessoa" />
              <Campo rotulo="Motivo do encerramento" valor={preparacao.motivoEncerramento} aoMudar={v => atualizar('motivoEncerramento', v)} placeholder="Obrigatório em sem aderência" />
            </div>
            {preparacao.resultado === 'reuniao_agendada' && <div className="copiloto-resumo"><h3>Concluir o agendamento</h3><p>O próximo passo salva a ligação e abre o convite de 30 minutos para revisão. Confira participantes, link, convite e lembretes. A confirmação depende de aceite explícito.</p><button type="button" className="btn btn-primary" disabled={!podeEditar || salvando || bloqueado} onClick={agendar}>Salvar ligação e abrir agendamento</button></div>}
            {lead.reuniaoDataHora && <p>Reunião: {lead.confirmacaoExplicita === true ? 'aceite registrado' : 'aguardando aceite'}. <button type="button" className="btn btn-ghost" onClick={() => sair(() => aoAbrirLead?.(lead))}>Conferir convite e confirmação no cadastro</button></p>}
            <div className="copiloto-resumo"><span>PRÉVIA DO REGISTRO NO CRM</span><pre>{resumo || 'Selecione o resultado e registre o que foi aprendido.'}</pre></div>
            <details className="copiloto-resumo"><summary>Histórico das tentativas</summary>{atividades.filter(a => a.tipo === 'prospeccao' && a.detalhe?.resultado).slice(0, 10).map(a => <article key={a.id}><h4>{a.descricao}</h4><small>{a.criadoEm ? new Date(a.criadoEm).toLocaleString('pt-BR') : ''} · {a.autorNome}</small><pre>{a.detalhe.resumo}</pre></article>)}</details>
          </section>
        )}
      </main>

      <footer className="copiloto-footer"><span>{aba === 'registrar' ? 'Retorno, reunião e nutrição exigem responsável e data.' : 'Salve para continuar de qualquer computador.'}</span><button className="btn btn-primary" onClick={salvar} disabled={!podeEditar || salvando}>{!podeEditar ? 'Acesso somente leitura' : salvando ? 'Salvando…' : aba === 'registrar' ? 'Salvar resultado da prospecção' : 'Salvar preparação'}</button></footer>
    </div>
  );
}

export default function CopilotoReuniaoPage({ leads = [], leadInicialId = null, podeEditar = false, aoSalvar, aoAbrirLead, aoAgendar }) {
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
    return <CopilotoWorkspace key={lead.id} lead={lead} podeEditar={podeEditar} aoSalvar={aoSalvar} aoAbrirLead={aoAbrirLead} aoAgendar={aoAgendar} aoTrocar={() => setLeadEscolhidoId('__trocar__')} />;
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
