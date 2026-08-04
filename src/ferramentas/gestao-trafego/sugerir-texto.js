// OS TEXTOS QUE JÁ FUNCIONARAM NESTA CONTA — para não começar do zero.
//
// PEDIDO DO DONO (2026-08-03): sugerir o texto do anúncio, como já se sugere o
// público. O passo 5 era o único do assistente onde ainda se escrevia numa
// caixa vazia.
//
// MEDIDO ANTES DE CONSTRUIR (conta Vessel, tudo o que a conta já rodou):
//   1.000 anúncios · 872 com resultado · 81 textos distintos · 19 com 10+
//   conversas. Do mais barato ao mais caro: R$ 0,55 a R$ 184,72 por conversa.
//   Trezentas e trinta e seis vezes de diferença — o dado é forte.
//
// A ARMADILHA QUE A MEDIÇÃO REVELOU, e que este módulo existe para evitar:
// os quatro textos MAIS BARATOS da conta são ANÚNCIOS DE VAGA DE EMPREGO
// ("Você é apaixonada por vendas, moda e bolsas?", R$ 0,55). Vaga rende conversa
// baratíssima no WhatsApp porque gente se candidata — e não tem nada a ver com
// vender bolsa. Uma lista crua dos "melhores textos" mandaria escrever anúncio
// de emprego para vender produto.
//
// Por isso cada texto carrega o NOME DA CAMPANHA de onde veio: é o que permite
// separar o que é comparável do que não é — na tela e no julgamento da IA.
//
// PURO: sem rede, sem tela.

const lista = (v) => (Array.isArray(v) ? v : []);
const texto = (v) => (typeof v === 'string' ? v.trim() : '');
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

// Abaixo disto o número não sustenta comparação: 3 conversas podem ser sorte.
export const MINIMO_DE_RESULTADOS = 10;

// O TEXTO DE UM ANÚNCIO, venha ele de onde vier. Imagem guarda em `link_data`,
// vídeo em `video_data`, e o `body` do criativo é o resto.
export function textoDoAnuncio(ad) {
  const oss = (ad && ad.creative && ad.creative.object_story_spec) || {};
  return texto((oss.link_data && oss.link_data.message)
    || (oss.video_data && oss.video_data.message)
    || (ad && ad.creative && ad.creative.body));
}

// AGRUPA POR TEXTO, porque o mesmo texto roda em vários anúncios — e é o texto
// que está sendo julgado, não o anúncio.
export function agruparPorTexto(anuncios, insightsPorAnuncio, contarResultado) {
  const conta = typeof contarResultado === 'function' ? contarResultado : () => 0;
  const porId = insightsPorAnuncio || {};
  const mapa = new Map();
  for (const ad of lista(anuncios)) {
    const t = textoDoAnuncio(ad);
    const ins = porId[String(ad && ad.id)];
    if (!t || !ins) continue;
    const atual = mapa.get(t) || { texto: t, anuncios: 0, gasto: 0, resultados: 0, campanhas: [] };
    atual.anuncios += 1;
    atual.gasto += num(ins.spend);
    atual.resultados += num(conta(ins));
    const camp = texto(ins.campaign_name) || texto(ad.campanha);
    if (camp && !atual.campanhas.includes(camp)) atual.campanhas.push(camp);
    mapa.set(t, atual);
  }
  return [...mapa.values()]
    .map((x) => ({ ...x, custo: x.resultados > 0 ? x.gasto / x.resultados : null }))
    .filter((x) => x.custo != null && x.resultados >= MINIMO_DE_RESULTADOS)
    .sort((a, b) => a.custo - b.custo);
}

// VAGA DE EMPREGO NÃO É ANÚNCIO DE PRODUTO, e nesta conta ela domina o topo.
//
// Não é filtro escondido: o texto continua na lista, MARCADO. Esconder faria a
// tela discordar do Gerenciador da Meta, onde ele está lá em primeiro. Marcar
// deixa a pessoa (e a IA) ver o número e entender por que ele não serve de
// modelo para vender bolsa.
const SINAIS_DE_VAGA = [
  /\bvagas?\b/i, /\bcontrata(mos|ndo)?\b/i, /\bcurr[íi]culo\b/i, /\bcandidat/i,
  /\btrabalhe conosco\b/i, /\bfa[çc]a parte da (nossa )?equipe\b/i, /\bvenha ser\b/i,
  /\bestamos com vaga/i, /\bprocessos? seletivos?\b/i,
];

export function pareceVaga(t) {
  const s = String(t || '');
  return SINAIS_DE_VAGA.some((r) => r.test(s));
}

export function marcarVagas(linhas) {
  return lista(linhas).map((x) => ({ ...x, vaga: pareceVaga(x.texto) || x.campanhas.some(pareceVaga) }));
}

// O QUE VAI PARA A TELA E PARA A IA.
//
// `comparaveis` são os que servem de modelo; `vagas` ficam à parte, com o
// número, para a pessoa ver que a conta tem esse resultado e por que ele não
// entra na conta.
export function montarSugestaoDeTexto(linhas, quantos = 5) {
  const marcadas = marcarVagas(linhas);
  const comparaveis = marcadas.filter((x) => !x.vaga);
  const vagas = marcadas.filter((x) => x.vaga);
  const melhores = comparaveis.slice(0, quantos);
  const piores = comparaveis.slice(-Math.min(3, Math.max(0, comparaveis.length - melhores.length)));
  return {
    temAlgo: melhores.length >= 2,
    melhores,
    piores,
    vagas,
    // A distância entre o melhor e o pior é o argumento inteiro: sem ela, "estes
    // são os melhores" é uma lista sem consequência.
    diferenca: melhores.length && piores.length && melhores[0].custo > 0
      ? piores[piores.length - 1].custo / melhores[0].custo
      : null,
    motivoVazio: melhores.length >= 2 ? ''
      : `Ainda não há textos suficientes com resultado nesta conta para comparar. `
        + `Um texto só entra na conta a partir de ${MINIMO_DE_RESULTADOS} resultados.`,
  };
}

const reais = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// A linha de cada texto na tela: número primeiro, porque é ele que ordena.
export function linhaDoTexto(x) {
  return `${reais(x.custo)} por resultado · ${x.resultados} ${x.resultados === 1 ? 'resultado' : 'resultados'}`
    + (x.anuncios > 1 ? ` · ${x.anuncios} anúncios` : '');
}

export const AVISO_DAS_VAGAS =
  'Os textos de VAGA DE EMPREGO estão separados de propósito. Eles rendem conversa muito barata '
  + '(gente se candidata), mas não servem de modelo para vender produto — copiar o tom deles faria '
  + 'o anúncio parecer recrutamento.';
