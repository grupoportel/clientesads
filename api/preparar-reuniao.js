import { exigirUsuario } from './_auth.js';
import {
  chamarIa, configuracaoIa, explicarErroIa, interpretarPreparacaoReuniao,
  montarPromptReuniao, resumirHistorico,
} from './_ia.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  const usuario = await exigirUsuario(req, res);
  if (!usuario) return;

  const { lead, atividades = [], preparacao = {} } = req.body || {};
  if (!lead?.nome) return res.status(400).json({ error: 'Escolha uma empresa antes de preparar a reunião.' });

  const cfg = configuracaoIa();
  if (!cfg) {
    return res.status(503).json({
      error: 'A IA opcional ainda não foi configurada. O roteiro manual continua disponível sem custo.',
    });
  }

  try {
    const prompt = montarPromptReuniao(lead, {
      preparacao,
      historico: resumirHistorico(atividades, 12),
    });
    const resposta = await chamarIa(prompt, cfg);
    const sugestao = interpretarPreparacaoReuniao(resposta);
    if (!sugestao) return res.status(502).json({ error: 'A IA respondeu num formato que não consegui validar. Tente novamente.' });

    console.log(`[ia] ${usuario.email} preparou reunião com "${lead.nome}" via ${cfg.provedor}`);
    return res.status(200).json({ sugestao });
  } catch (erro) {
    console.error('[ia-reuniao] Falha:', erro?.message);
    return res.status(500).json({ error: explicarErroIa(erro) || 'Não foi possível preparar a reunião agora.' });
  }
}
