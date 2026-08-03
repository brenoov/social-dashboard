// O PAYLOAD DE CAMPANHA + CONJUNTO — puro, e compartilhado entre o robô e a TELA.
//
// POR QUE SAIU DE subir-estudio.mjs: a tela de criar campanha do Gestor precisa
// montar exatamente o mesmo payload que a Fábrica sobe há meses. Copiar seria
// repetir o erro mais caro desta série de sessões — eu reescrevi payload que já
// existia provado e a Meta recusou quatro vezes seguidas
// (4834011, 1870227, 1885154, 1487891), cada uma por um campo que o builder
// original já mandava.
//
// UMA IMPLEMENTAÇÃO SÓ, e ela já tem prova ao vivo: `validar-criar-no-gestor.mjs`
// cria campanha → conjunto → criativo → anúncio nos quatro objetivos com este
// payload, lê de volta e apaga.
//
// PURO DE VERDADE: sem `import` de Node, sem `process`, sem rede. É o que permite
// o Vite empacotar isto para o navegador junto com objetivos.mjs, publico.mjs e
// orcamento.mjs, que também são puros.
import { montaPromotedObject } from './objetivos.mjs';
import { montarTargeting } from './publico.mjs';
import { orcamentoMeta } from './orcamento.mjs';

// --- payload puro (sem Graph) de campaign+adset a partir da linha de fabrica_objetivos --------
// row = linha de fabrica_objetivos (mapaObjetivo); cfg = { DAILY_BUDGET, DATA }. destination_type só
// entra se a linha tiver (branding não tem => omitido); promoted_object só entra se
// montaPromotedObject(...) devolver objeto (branding='none' => undefined => omitido).
// Nomes legíveis no Gerenciador da Meta (o "[Estudio]"/chave técnica confundia):
//   campanha = "Bolsas · <loja> · <objetivo> · <dd/mm/aaaa>", conjunto = "<loja> · <objetivo>".
// Objetivo pelo rótulo humano (fabrica_objetivos.rotulo), data com barras.
export function rotuloObjetivo(row) { return row?.rotulo || row?.chave || 'Anúncios'; }
export function nomeCampanha(loja, row, cfg) { return `Bolsas · ${loja.nome} · ${rotuloObjetivo(row)} · ${String(cfg.DATA || '').replace(/-/g, '/')}`.slice(0, 200); }
export function nomeConjunto(loja, row) { return `${loja.nome} · ${rotuloObjetivo(row)}`.slice(0, 200); }

export function payloadCampanhaAdset(row, marca, loja, cfg, publico = null, orcamento = null) {
  const campaign = {
    name: nomeCampanha(loja, row, cfg),
    objective: row.meta_objective,
    status: 'PAUSED',
    special_ad_categories: [],
    is_adset_budget_sharing_enabled: false,
  };
  const adset = {
    name: nomeConjunto(loja, row),
    billing_event: row.billing_event || 'IMPRESSIONS',
    optimization_goal: row.optimization_goal,
    status: 'PAUSED',
    targeting: montarTargeting(publico, loja),
  };
  const orc = orcamentoMeta(orcamento, cfg.DAILY_BUDGET);
  Object.assign(campaign, orc.campaign);
  Object.assign(adset, orc.adset);
  if (row.destination_type) adset.destination_type = row.destination_type;
  const po = montaPromotedObject(row.promoted_object_tipo, marca, loja);
  if (po) adset.promoted_object = po;
  return { campaign, adset };
}
