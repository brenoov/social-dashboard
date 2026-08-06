// QUANDO O INSTAGRAM PAROU DE PUBLICAR "SEGUIRAM / DEIXARAM DE SEGUIR".
//
// O PROBLEMA QUE ISTO EXISTE PARA RESOLVER (medido em 2026-08-06):
// os 7 perfis ficaram com "novos seguidores" zerado a partir de 03/08. A coleta
// NÃO tinha parado: a contagem total continuava chegando (Breno 24.345 → 24.349
// → 24.352 → 24.351) e o engajamento também. O que parou foi um número só.
//
// Perguntando à Meta na mão, com o token de produção, a resposta é esta:
//
//     02/08  HTTP 200  results=[{FOLLOWER:14}, {NON_FOLLOWER:33}]   ← cheio
//     03/08  HTTP 200  results=[]                                    ← vazio
//     04/08  HTTP 200  results=[]
//     05/08  HTTP 200  results=[]
//     06/08  HTTP 200  results=[]
//
// Ela responde "deu certo" e não manda número nenhum. Confirmado em duas métricas
// independentes (`follows_and_unfollows` e `follower_count`), em duas versões da
// API (v21 e v23) e nos 7 perfis. O token estava bom — todo o resto veio por ele.
//
// POR QUE NINGUÉM FICOU SABENDO: a leitura do dia devolvia `null` tanto para
// "a Meta deu erro" quanto para "a Meta não publicou", e nos DOIS casos ninguém
// era avisado. O `degraded` — que existe nesta mesma Edge Function, dispara
// webhook e avisa o super-admin — era usado para a foto do perfil e para o
// engajamento, mas não para seguidores. Quatro dias de número oco passaram em
// silêncio e quem descobriu foi o dono, no olho.
//
// POR QUE ESTE ARQUIVO É SEPARADO E PURO: mesmo motivo do
// leitura-de-engajamento.js ao lado. Dentro da Edge Function não dá para testar
// sem subir Deno e sem falar com a Meta. Aqui tudo entra por parâmetro.

// Quantos dias JÁ FECHADOS podem estar sem publicação antes de virar reclamação.
//
// NÃO É CHUTE, e errar para o lado de reclamar de menos é de propósito.
// A Meta consolida esse número com atraso normal de cerca de 1 dia — o próprio
// painel já dizia isso ao usuário ("costuma sair em cerca de 1 dia"). Reclamar
// de ontem faria o alerta tocar quase todo dia por um atraso que é esperado, e
// alarme que toca todo dia deixa de ser alarme: é exatamente a doença do
// `meta_spotcheck`, que falhava 6 de 7 perfis diariamente e por isso não avisava
// mais nada. Dois dias dá à Meta um dia inteiro além do atraso conhecido.
export const CARENCIA_DE_DIAS = 2;

// O dia de hoje nunca conta: ele ainda está acontecendo. Às 01h da manhã
// "zero pessoa seguiu" é verdade e não é notícia.
//
// Foi assim, aliás, que os zeros entraram no banco: a linha de 03/08 nasceu à
// 01h06 com 0/0 — correto naquela hora — e, como a Meta nunca mais publicou o
// dia, o zero da madrugada ficou valendo como se fosse o número final.
const UM_DIA = 86400000;

/**
 * Lê a resposta da Meta para UM dia e diz se ela publicou o número.
 *
 * A distinção é o ponto inteiro deste arquivo: "publicou zero" e "não publicou"
 * chegavam aqui como a mesma coisa e saíam do outro lado como um zero no gráfico.
 */
export function lerBrutoDoDia(resposta) {
  const linhas = resposta?.data ?? [];
  if (!linhas.length) return { publicado: false, motivo: 'a Meta não devolveu o dia' };
  const detalhes = linhas[0]?.total_value?.breakdowns ?? [];
  const resultados = detalhes[0]?.results ?? [];
  // ESTE É O CASO DE 03/08 EM DIANTE: HTTP 200, o dia vem, o detalhamento vem,
  // e a lista de resultados dentro dele está vazia.
  if (!resultados.length) return { publicado: false, motivo: 'a Meta respondeu sem número' };
  let gained = 0, lost = 0;
  for (const r of resultados) {
    const chave = (r.dimension_values ?? [null])[0];
    const valor = Number(r.value) || 0;
    if (chave === 'FOLLOWER') gained = valor;
    else if (chave === 'NON_FOLLOWER') lost = valor;
  }
  return { publicado: true, gained, lost };
}

/**
 * Dado o que a Meta publicou (ou não) nos últimos dias, diz se há atraso digno
 * de alerta.
 *
 * `dias`: [{ dia: 'YYYY-MM-DD', publicado: boolean }] — em qualquer ordem.
 * `hoje`: 'YYYY-MM-DD' no fuso de São Paulo (quem chama já tem via todayBR()).
 *
 * Devolve { atrasado, desde, quantos }:
 *   desde   = o dia fechado mais ANTIGO que continua sem publicação;
 *   quantos = quantos dias fechados estão sem publicação.
 */
export function atrasoDoBruto(dias, hoje, carencia = CARENCIA_DE_DIAS) {
  const limite = new Date(hoje + 'T00:00:00Z').getTime() - carencia * UM_DIA;
  const semBruto = (dias || [])
    .filter((d) => d && d.dia && !d.publicado)
    // Só dias já fechados há tempo suficiente. O de hoje e o de ontem ficam de
    // fora: neles a ausência do número ainda é o comportamento normal da Meta.
    .filter((d) => new Date(d.dia + 'T00:00:00Z').getTime() <= limite)
    .map((d) => d.dia)
    .sort();
  return { atrasado: semBruto.length > 0, desde: semBruto[0] ?? null, quantos: semBruto.length };
}

/** Vira o atraso em uma linha de `degraded`. Devolve null quando não há o que dizer. */
export function recadoDeAtraso(nome, atraso) {
  if (!atraso?.atrasado) return null;
  const dia = String(atraso.desde).slice(8, 10) + '/' + String(atraso.desde).slice(5, 7);
  const plural = atraso.quantos === 1 ? 'dia' : 'dias';
  return `${nome}: o Instagram não publica seguiram/deixaram desde ${dia} (${atraso.quantos} ${plural} sem número)`;
}
