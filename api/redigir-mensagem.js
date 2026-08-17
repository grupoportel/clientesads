// api/redigir-mensagem.js
// Escreve uma mensagem de WhatsApp ou e-mail a partir dos dados do lead.
//
// Como na análise, devolve sem gravar e sem enviar: o texto cai na caixa de
// escrita para a pessoa ler, ajustar e decidir. Mensagem comercial saindo
// sozinha em nome da empresa é o tipo de automação que rende cliente perdido.

import { exigirUsuario } from './_auth.js';
import {
  configuracaoIa, chamarIa, explicarErroIa,
  montarPromptMensagem, interpretarMensagem, resumirHistorico, acharIntencao,
} from './_ia.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const usuario = await exigirUsuario(req, res);
  if (!usuario) return;

  const cfg = configuracaoIa();
  if (!cfg) {
    return res.status(500).json({
      error: 'A IA ainda não foi configurada no servidor. Defina GEMINI_API_KEY na Vercel.',
    });
  }

  const {
    lead, canal = 'whatsapp', intencao, instrucao = '',
    atividades = [], empresa, meuNome,
  } = req.body || {};

  if (!lead?.nome) return res.status(400).json({ error: 'Informe o lead.' });
  if (!acharIntencao(intencao)) return res.status(400).json({ error: 'Escolha o objetivo da mensagem.' });

  try {
    const prompt = montarPromptMensagem(lead, {
      canal,
      intencao,
      instrucao,
      historico: resumirHistorico(atividades),
      empresa: empresa || 'Grupo Portel',
      meuNome: meuNome || '',
    });

    const resposta = await chamarIa(prompt, cfg);
    const mensagem = interpretarMensagem(resposta, canal);

    if (!mensagem) {
      console.warn('[ia] Mensagem não interpretável:', resposta.slice(0, 200));
      return res.status(502).json({ error: 'A IA respondeu num formato que não consegui ler. Tente de novo.' });
    }

    console.log(`[ia] ${usuario.email} redigiu ${canal}/${intencao} para "${lead.nome}"`);
    return res.status(200).json(mensagem);
  } catch (erro) {
    console.error('[ia] Falha ao redigir:', erro?.message);
    return res.status(500).json({
      error: explicarErroIa(erro) || 'Não foi possível escrever a mensagem agora.',
    });
  }
}
