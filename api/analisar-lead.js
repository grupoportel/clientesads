// api/analisar-lead.js
// Analisa um lead e devolve sugestões para os campos de estratégia.
//
// Devolve, não grava. A IA erra e inventa; deixar que ela escreva direto no
// cadastro seria trocar campo vazio por campo errado, que é pior — vazio a
// pessoa vê, errado ela acredita. Quem aceita a sugestão é quem está na tela.

import { exigirUsuario } from './_auth.js';
import {
  configuracaoIa, montarPromptAnalise, interpretarAnalise,
  chamarIa, buscarSite, urlDoSite, explicarErroIa,
} from './_ia.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const usuario = await exigirUsuario(req, res);
  if (!usuario) return;

  const cfg = configuracaoIa();
  if (!cfg) {
    return res.status(500).json({
      error: 'A IA ainda não foi configurada no servidor. Defina GEMINI_API_KEY na Vercel.',
    });
  }

  const { lead } = req.body || {};
  if (!lead || !lead.nome) {
    return res.status(400).json({ error: 'Informe ao menos o nome do lead.' });
  }

  // O site é opcional: sem ele a análise sai mais rasa, mas sai.
  let textoSite = '';
  let avisoSite = null;
  const url = urlDoSite(lead.site);
  if (url) {
    const r = await buscarSite(url);
    textoSite = r.texto;
    avisoSite = r.erro;
  } else if (lead.site) {
    avisoSite = 'o endereço do site não é válido';
  }

  try {
    const resposta = await chamarIa(montarPromptAnalise(lead, textoSite), cfg);
    const analise = interpretarAnalise(resposta);

    if (!analise) {
      console.warn('[ia] Resposta não interpretável:', resposta.slice(0, 200));
      return res.status(502).json({ error: 'A IA respondeu num formato que não consegui ler. Tente de novo.' });
    }

    console.log(`[ia] ${usuario.email} analisou "${lead.nome}" via ${cfg.provedor}`);
    return res.status(200).json({
      campos: analise.campos,
      confianca: analise.confianca,
      leuOSite: Boolean(textoSite),
      avisoSite,
    });
  } catch (erro) {
    console.error('[ia] Falha:', erro?.message);
    return res.status(500).json({
      error: explicarErroIa(erro) || 'Não foi possível analisar o lead agora.',
    });
  }
}
