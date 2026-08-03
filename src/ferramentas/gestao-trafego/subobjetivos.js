// O CATÁLOGO DE SUB-OBJETIVOS — o que a Meta sabe fazer, em português.
//
// POR QUE EXISTE (pedido do dono, 2026-08-03): o assistente oferecia QUATRO
// opções, que eram as quatro receitas da Fábrica. Medindo os conjuntos que as
// cinco contas realmente rodam, apareceram VINTE E OITO combinações — e a mais
// usada de todo o negócio (visita ao perfil do Instagram: 57 conjuntos, nas
// cinco contas) não estava entre as quatro.
//
// A META TEM DOIS NÍVEIS, e o assistente tratava como um só:
//   `objective`         (campanha) — o que se quer no fim: conversa, venda, visita
//   `optimization_goal` (conjunto) — o que a Meta OTIMIZA para conseguir aquilo
//   + `destination_type`           — ONDE o resultado acontece
// "Engajamento" é objetivo; "conversa no WhatsApp", "visualização de vídeo" e
// "engajamento na publicação" são coisas diferentes DENTRO dele, e a Meta
// entrega cada uma de um jeito.
//
// CATÁLOGO FIXO, e não a lista do que a conta já usou: a lista do que já se usou
// nunca ensina nada novo, e conta nova começaria vazia. O que a conta já rodou
// entra como MARCA (`usos`), que é a informação de verdade útil — ver
// `marcarUsados`.
//
// TUDO AQUI FOI MEDIDO em conta real (03/08/2026), não tirado da documentação:
// cada linha com `usos > 0` na tela é um conjunto que a Meta aceitou de verdade.
// PURO: sem rede, sem tela.

// ── DE ONDE SAI O CRIATIVO ──────────────────────────────────────────────────
//
// A descoberta que mudou o desenho: nem todo anúncio tem imagem própria.
//
//   'novo'       — você escolhe a imagem e escreve o texto. É o que o assistente
//                  já sabe fazer.
//   'publicacao' — o anúncio É uma publicação que já está no perfil. Medido:
//                  os anúncios de ON_POST e INSTAGRAM_PROFILE não têm
//                  `link_data` nem `video_data`; carregam
//                  `effective_object_story_id` e `source_instagram_media_id`
//                  apontando para um post real do Instagram.
//                  Ainda NÃO sabemos criar esses — é outra tela (escolher a
//                  publicação), e por isso eles aparecem bloqueados, com o
//                  motivo escrito.
export const CRIATIVO_NOVO = 'novo';
export const CRIATIVO_PUBLICACAO = 'publicacao';

// O que cada opção exige além do básico. Quem não tiver, não avança — mas VÊ,
// com a explicação do que falta.
export const PRECISA_WHATSAPP = 'whatsapp';
export const PRECISA_SITE = 'site';
export const PRECISA_PIXEL = 'pixel';
export const PRECISA_PUBLICACAO = 'publicacao';
export const PRECISA_FORMULARIO = 'formulario';

export const CATALOGO = [
  // ── CONVERSAS ─────────────────────────────────────────────────────────────
  {
    id: 'conversa-whatsapp', grupo: 'Conversas', rotulo: 'Conversa no WhatsApp',
    explicacao: 'A Meta procura quem costuma abrir conversa, e o botão do anúncio leva direto para o seu WhatsApp.',
    meta_objective: 'OUTCOME_ENGAGEMENT', optimization_goal: 'CONVERSATIONS',
    billing_event: 'IMPRESSIONS', destination_type: 'WHATSAPP', promoted_object_tipo: 'whatsapp',
    criativo: CRIATIVO_NOVO, precisa: [PRECISA_WHATSAPP],
  },
  {
    id: 'conversa-whatsapp-cadastros', grupo: 'Conversas', rotulo: 'Conversa no WhatsApp (buscando cadastro)',
    // A MESMA conversa, com o objetivo de campanha de CADASTROS. A diferença não
    // é cosmética: a Meta entrega para perfis diferentes. Estava sendo chamado
    // de "Engajamento" em 30 conjuntos que na verdade rodam como OUTCOME_LEADS.
    explicacao: 'Mesma conversa no WhatsApp, mas a Meta procura quem tende a virar cadastro, e não só quem responde.',
    meta_objective: 'OUTCOME_LEADS', optimization_goal: 'CONVERSATIONS',
    billing_event: 'IMPRESSIONS', destination_type: 'WHATSAPP', promoted_object_tipo: 'whatsapp',
    criativo: CRIATIVO_NOVO, precisa: [PRECISA_WHATSAPP],
  },
  {
    id: 'conversa-whatsapp-vendas', grupo: 'Conversas', rotulo: 'Conversa no WhatsApp (buscando venda)',
    explicacao: 'Mesma conversa, com a Meta procurando quem costuma comprar. Costuma custar mais caro por conversa.',
    meta_objective: 'OUTCOME_SALES', optimization_goal: 'CONVERSATIONS',
    billing_event: 'IMPRESSIONS', destination_type: 'WHATSAPP', promoted_object_tipo: 'whatsapp',
    criativo: CRIATIVO_NOVO, precisa: [PRECISA_WHATSAPP],
  },
  {
    id: 'conversa-direct', grupo: 'Conversas', rotulo: 'Conversa no Direct do Instagram',
    explicacao: 'A conversa acontece no Direct, sem sair do Instagram. Bom quando o número de WhatsApp não é o canal principal.',
    meta_objective: 'OUTCOME_ENGAGEMENT', optimization_goal: 'CONVERSATIONS',
    billing_event: 'IMPRESSIONS', destination_type: 'INSTAGRAM_DIRECT', promoted_object_tipo: 'ig',
    criativo: CRIATIVO_NOVO, precisa: [],
  },
  {
    id: 'conversa-todos', grupo: 'Conversas', rotulo: 'Conversa onde a pessoa preferir',
    explicacao: 'WhatsApp, Direct ou Messenger — a Meta escolhe o canal em que cada pessoa responde melhor.',
    meta_objective: 'OUTCOME_SALES', optimization_goal: 'CONVERSATIONS',
    billing_event: 'IMPRESSIONS', destination_type: 'MESSAGING_INSTAGRAM_DIRECT_MESSENGER_WHATSAPP',
    promoted_object_tipo: 'whatsapp',
    criativo: CRIATIVO_NOVO, precisa: [PRECISA_WHATSAPP],
  },

  // ── PERFIL E PUBLICAÇÃO ───────────────────────────────────────────────────
  {
    id: 'visita-perfil', grupo: 'Perfil e publicação', rotulo: 'Visita ao perfil do Instagram',
    explicacao: 'Leva gente para o seu perfil, para conhecer a marca e seguir. É o mais rodado nestas contas.',
    meta_objective: 'OUTCOME_TRAFFIC', optimization_goal: 'PROFILE_VISIT',
    billing_event: 'IMPRESSIONS', destination_type: 'INSTAGRAM_PROFILE', promoted_object_tipo: 'ig',
    criativo: CRIATIVO_PUBLICACAO, precisa: [PRECISA_PUBLICACAO],
  },
  {
    id: 'engajamento-post', grupo: 'Perfil e publicação', rotulo: 'Engajamento na publicação',
    explicacao: 'Curtidas, comentários, salvamentos e compartilhamentos numa publicação que já está no ar.',
    meta_objective: 'OUTCOME_ENGAGEMENT', optimization_goal: 'POST_ENGAGEMENT',
    billing_event: 'IMPRESSIONS', destination_type: 'ON_POST', promoted_object_tipo: 'none',
    criativo: CRIATIVO_PUBLICACAO, precisa: [PRECISA_PUBLICACAO],
  },
  {
    id: 'video-thruplay', grupo: 'Perfil e publicação', rotulo: 'Visualização de vídeo',
    explicacao: 'A Meta procura quem assiste até o fim (ou pelo menos 15 segundos) — é o que ela chama de ThruPlay.',
    meta_objective: 'OUTCOME_ENGAGEMENT', optimization_goal: 'THRUPLAY',
    billing_event: 'IMPRESSIONS', destination_type: 'ON_VIDEO', promoted_object_tipo: 'none',
    criativo: CRIATIVO_PUBLICACAO, precisa: [PRECISA_PUBLICACAO],
  },

  // ── SITE ──────────────────────────────────────────────────────────────────
  {
    id: 'site-cliques', grupo: 'Site', rotulo: 'Cliques para o site',
    explicacao: 'A Meta procura quem clica. Barato, mas clique não é visita: parte das pessoas sai antes de a página abrir.',
    meta_objective: 'OUTCOME_TRAFFIC', optimization_goal: 'LINK_CLICKS',
    billing_event: 'IMPRESSIONS', destination_type: null, promoted_object_tipo: 'none',
    criativo: CRIATIVO_NOVO, precisa: [PRECISA_SITE],
  },
  {
    id: 'site-visitas', grupo: 'Site', rotulo: 'Visitas que carregam a página',
    explicacao: 'A Meta procura quem espera a página abrir de verdade. Custa mais que clique, e vale mais.',
    meta_objective: 'OUTCOME_TRAFFIC', optimization_goal: 'LANDING_PAGE_VIEWS',
    billing_event: 'IMPRESSIONS', destination_type: null, promoted_object_tipo: 'none',
    criativo: CRIATIVO_NOVO, precisa: [PRECISA_SITE],
  },
  {
    id: 'site-conversao', grupo: 'Site', rotulo: 'Conversão no site',
    explicacao: 'A Meta procura quem completa uma ação no site (compra, cadastro). Só funciona com o pixel medindo.',
    meta_objective: 'OUTCOME_SALES', optimization_goal: 'OFFSITE_CONVERSIONS',
    billing_event: 'IMPRESSIONS', destination_type: null, promoted_object_tipo: 'none',
    criativo: CRIATIVO_NOVO, precisa: [PRECISA_SITE, PRECISA_PIXEL],
  },

  // ── CADASTROS ─────────────────────────────────────────────────────────────
  {
    id: 'formulario', grupo: 'Cadastros', rotulo: 'Formulário dentro do Facebook',
    explicacao: 'A pessoa preenche sem sair do aplicativo. Costuma render mais cadastros e de qualidade menor.',
    meta_objective: 'OUTCOME_LEADS', optimization_goal: 'LEAD_GENERATION',
    billing_event: 'IMPRESSIONS', destination_type: 'ON_AD', promoted_object_tipo: 'page',
    criativo: CRIATIVO_NOVO, precisa: [PRECISA_FORMULARIO],
  },

  // ── RECONHECIMENTO ────────────────────────────────────────────────────────
  {
    id: 'alcance', grupo: 'Reconhecimento', rotulo: 'Alcance (mostrar para o máximo de gente)',
    explicacao: 'A Meta espalha para o maior número de pessoas diferentes. Não busca clique nem conversa.',
    meta_objective: 'OUTCOME_AWARENESS', optimization_goal: 'REACH',
    billing_event: 'IMPRESSIONS', destination_type: null, promoted_object_tipo: 'none',
    criativo: CRIATIVO_NOVO, precisa: [],
  },
  {
    id: 'lembranca', grupo: 'Reconhecimento', rotulo: 'Lembrança da marca',
    explicacao: 'A Meta procura quem tem mais chance de LEMBRAR do anúncio depois. Serve para marca, não para venda.',
    meta_objective: 'OUTCOME_AWARENESS', optimization_goal: 'AD_RECALL_LIFT',
    billing_event: 'IMPRESSIONS', destination_type: null, promoted_object_tipo: 'none',
    criativo: CRIATIVO_NOVO, precisa: [],
  },
];

// A ORDEM DOS GRUPOS na tela. Fixa, e não alfabética: começa pelo que dá
// resultado direto (conversa) e termina no que é de marca.
export const GRUPOS = ['Conversas', 'Perfil e publicação', 'Site', 'Cadastros', 'Reconhecimento'];

export const acharSubobjetivo = (id) => CATALOGO.find((s) => s.id === id) || null;

// ─────────────────────────────────────────────────────────────────────────────
// O QUE ESTA CONTA JÁ RODOU.
//
// Não decide nada — só MARCA. É a informação que faz diferença na hora de
// escolher: "esta conta já rodou isso 57 vezes" vale mais que qualquer
// explicação que eu escreva.
//
// Casa pela TRINCA que identifica a combinação na Meta: objetivo da campanha,
// meta de otimização e destino. Billing event fica de fora de propósito — é
// sempre IMPRESSIONS nestas contas e não distingue nada.
export function marcarUsados(catalogo, conjuntos) {
  const contagem = new Map();
  for (const cj of (Array.isArray(conjuntos) ? conjuntos : [])) {
    if (!cj) continue;
    const chave = chaveDaCombinacao(
      cj.campaign && cj.campaign.objective, cj.optimization_goal, cj.destination_type,
    );
    contagem.set(chave, (contagem.get(chave) || 0) + 1);
  }
  return (catalogo || CATALOGO).map((s) => ({
    ...s,
    usos: contagem.get(chaveDaCombinacao(s.meta_objective, s.optimization_goal, s.destination_type)) || 0,
  }));
}

// `UNDEFINED` e ausência são a MESMA coisa: a Meta devolve "UNDEFINED" onde o
// nosso catálogo guarda `null`. Sem normalizar, "Cliques para o site" nunca
// casaria com os conjuntos que existem.
function chaveDaCombinacao(objetivo, meta, destino) {
  const d = String(destino || '').toUpperCase();
  const limpo = (!d || d === 'UNDEFINED' || d === 'NULL') ? '' : d;
  return `${objetivo || ''}|${meta || ''}|${limpo}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// DÁ PARA CRIAR ESTA OPÇÃO AGORA?
//
// Devolve o MOTIVO em português quando não dá, e `null` quando dá. Motivo e não
// booleano: um item apagado sem explicação é o jeito mais rápido de deixar
// alguém achando que a ferramenta está quebrada.
//
// As opções que ainda não dá para criar continuam APARECENDO na lista, de
// propósito (decisão do dono, 03/08/2026): ver que existem — e por que ainda
// não dá — vale mais do que uma lista curta que finge que o resto não existe.
export function bloqueio(sub) {
  const s = sub || {};
  const precisa = s.precisa || [];
  if (s.criativo === CRIATIVO_PUBLICACAO || precisa.includes(PRECISA_PUBLICACAO)) {
    return 'Este tipo impulsiona uma publicação que já está no perfil, em vez de criar um anúncio novo. '
      + 'Escolher a publicação é uma tela que ainda não existe aqui.';
  }
  if (precisa.includes(PRECISA_PIXEL)) {
    return 'Precisa de um pixel medindo o site, e de qual evento contar como conversão. '
      + 'Escolher isso ainda não existe aqui.';
  }
  if (precisa.includes(PRECISA_FORMULARIO)) {
    return 'Precisa de um formulário criado no Facebook. Criar ou escolher o formulário ainda não existe aqui.';
  }
  return null;
}

export const podeSerCriado = (sub) => bloqueio(sub) === null;

// O que perguntar a mais neste sub-objetivo. A tela usa para decidir se mostra o
// campo de WhatsApp, o de endereço do site, os dois ou nenhum.
export const pedeNumeroDeWhatsapp = (sub) => (sub?.precisa || []).includes(PRECISA_WHATSAPP);
export const pedeEnderecoDoSite = (sub) => (sub?.precisa || []).includes(PRECISA_SITE);
