// De qual TIPO é esta campanha — o "balde" que decide qual meta da régua vale
// para ela (ver alvos.js).
//
// Vive num módulo próprio porque a TELA e o ROBÔ precisam da mesma resposta.
// Enquanto isto era uma constante dentro do .vue, o robô não tinha como saber a
// que balde a campanha pertencia, então julgava por critério próprio (CTR, CPC)
// enquanto a tela julgava pela meta do dono — dois juízes discordando sobre a
// mesma campanha. Duplicar o mapa no robô só teria adiado a divergência.
// PURO: sem rede, sem tela.

export const GT_OBJETIVO_BALDE = {
  OUTCOME_TRAFFIC: 'trafego', LINK_CLICKS: 'trafego',
  OUTCOME_SALES: 'vendas', CONVERSIONS: 'vendas', PRODUCT_CATALOG_SALES: 'vendas',
  OUTCOME_AWARENESS: 'reconhecimento', BRAND_AWARENESS: 'reconhecimento', REACH: 'reconhecimento', VIDEO_VIEWS: 'reconhecimento',
  // Engajamento inclui as campanhas de MENSAGEM modernas (OUTCOME_ENGAGEMENT com
  // destino WhatsApp), por isso o balde de engajamento também tem Conversas
  // iniciadas. MESSAGES (objetivo antigo de mensagem) tem balde próprio.
  OUTCOME_ENGAGEMENT: 'engajamento', POST_ENGAGEMENT: 'engajamento', PAGE_LIKES: 'engajamento',
  MESSAGES: 'mensagens',
  OUTCOME_LEADS: 'leads', LEAD_GENERATION: 'leads',
};

// Objetivo desconhecido cai em 'padrao', que NÃO tem meta em alvos.js — e sem
// meta o cálculo devolve 'sem-dados' em vez de julgar pela régua errada.
export function baldeDoObjetivo(objective) {
  return GT_OBJETIVO_BALDE[String(objective || '').toUpperCase()] || 'padrao';
}

// Campanha de WhatsApp de verdade é a que a META AFIRMA ser, olhando o CONJUNTO:
// `destination_type = WHATSAPP` ou `optimization_goal = CONVERSATIONS`.
//
// O teste antigo era "tem alguma ação de mensagem?", e UMA conversa espontânea
// bastava: a "[TRÁFEGO] VIAGENS | PERFIL" (R$ 5.706, 4.601 curtidas, 18
// conversas de tabela) era medida a R$ 317 por conversa contra meta de R$ 15.
// Corrigir isso mudou 6 campanhas e R$ 15.177 (PR #51).
export function ehDeWhatsapp(conjuntos) {
  return (conjuntos || []).some((s) => String((s && s.destination_type) || '').toUpperCase() === 'WHATSAPP'
    || String((s && s.optimization_goal) || '').toUpperCase() === 'CONVERSATIONS');
}

// O balde EFETIVO: campanha cujo CONJUNTO diz destino WhatsApp é medida por
// conversa, seja qual for o objetivo declarado na campanha.
//
// A regra já valeu só para engajamento, com o argumento de que uma campanha de
// LEAD já teria a meta certa do próprio balde. Os dados desmentiram (2026-07-29,
// decisão do dono): oito campanhas de 'leads'/'trafego'/'vendas' com destino
// WhatsApp somam R$ 33.314 em 90 dias e CINCO delas têm zero ou dois leads. A
// "[Leads] Para WhatsApp" da Motoeasy gastou R$ 9.738 com 2 leads e 1.020
// conversas — medida por lead dava R$ 4.869, um número sem significado; por
// conversa dá R$ 10.
//
// A diferença para o bug de 2026-07-28 (quando UMA conversa espontânea fazia uma
// campanha virar WhatsApp) é o SINAL: lá a inferência vinha do resultado, aqui
// vem do que a Meta AFIRMA no conjunto. Este sinal não deu falso positivo em
// nenhuma das cinco contas.
export function baldeEfetivo(objective, conjuntos) {
  const balde = baldeDoObjetivo(objective);
  if (ehDeWhatsapp(conjuntos)) return 'mensagens';
  return balde;
}

// O balde de um objetivo da FÁBRICA — recebe a linha inteira de
// `fabrica_objetivos` (chave, rotulo, meta_objective, destination_type,
// optimization_goal…).
//
// POR QUE MORA AQUI, e não na tela da Fábrica: a linha da Fábrica carrega os
// MESMOS dois sinais que o Gestor lê do conjunto — `destination_type` e
// `optimization_goal`. O objetivo padrão da Fábrica é
// ('engajamento','Engajamento (WhatsApp)', OUTCOME_ENGAGEMENT, CONVERSATIONS,
// WHATSAPP): olhar só o `meta_objective` joga fora exatamente o sinal que a
// correção de 2026-07-29 foi construída em cima, e a campanha de WhatsApp volta
// a ser tratada como engajamento comum. Esse erro de classificação já foi
// cometido duas vezes neste produto; a terceira só é evitada se a regra tiver UM
// lugar. O Gestor vai ganhar a mesma faixa de sugestões — e uma regra que mora
// no componente da Fábrica é uma regra que será rededuzida lá, diferente.
//
// Repare que ele não RECOPIA a regra: passa a própria linha como se fosse um
// conjunto para o `baldeEfetivo`, porque os nomes dos campos são os mesmos. Se a
// regra de WhatsApp mudar, muda uma vez só.
export function baldeDoObjetivoDaFabrica(objetivo) {
  if (!objetivo || typeof objetivo !== 'object') return 'padrao';
  return baldeEfetivo(objetivo.meta_objective, [objetivo]);
}
