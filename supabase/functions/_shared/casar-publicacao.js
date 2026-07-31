// Casar a peça agendada aqui com o post que realmente saiu no Instagram.
//
// POR QUE ISSO É UM PROBLEMA: quando a publicação é manual, ninguém digita o id
// do post de volta no sistema. Sem casar, a peça fica "publicada" e as métricas
// nunca chegam — a ferramenta vira uma agenda cega, que era o que se queria
// evitar.
//
// A REGRA QUE GOVERNA O DESENHO: um falso positivo é MUITO pior que um "não
// sei". Vincular a peça errada mostra o desempenho de um post no card de outro,
// e ninguém percebe — o número parece plausível. Por isso o automático só
// dispara quando não há dúvida nenhuma, e todo o resto vira uma pergunta na
// tela ("É este post?").
//
// PURO: sem rede. A Edge busca as peças e a lista de /{ig}/media e passa pra cá.

// A normalização é uma CÓPIA de src/ferramentas/conteudo/legenda.js, e isso é
// deliberado: o pacote da Edge Function leva só o que está em supabase/functions,
// então importar da pasta do front quebraria o deploy — e todo o resto do
// projeto importa no sentido contrário (o front puxa de _shared, nunca o oposto).
//
// A cópia não fica livre para divergir: o teste "a normalização daqui bate com a
// do front" lê os dois e falha se alguém mexer só num lado. Mesmo mecanismo que
// agrupar-permissoes.test.mjs usa para a cópia do catálogo de recursos.
function normalizarParaComparar(texto) {
  if (typeof texto !== 'string') return '';
  return texto
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[#@][\p{L}\p{N}_]+/gu, ' ')
    .replace(/[\p{Extended_Pictographic}️‍]/gu, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

// Casa sozinho só com nota alta E sem concorrente perto.
export const LIMIAR_AUTOMATICO = 0.85;
export const LIMIAR_CONCORRENTE = 0.60;

// Janela de tempo. Assimétrica de propósito: publicar adiantado é raro (no
// máximo uns minutos), esquecer e publicar no dia seguinte é comum.
const HORAS_ANTES = 2;
const HORAS_DEPOIS = 24;

const PESO_LEGENDA = 0.70;
const PESO_TEMPO = 0.30;

// Coeficiente de Dice: quanto dois conjuntos se sobrepõem, de 0 a 1.
function _dice(a, b) {
  if (!a.size || !b.size) return 0;
  let comuns = 0;
  for (const x of a) if (b.has(x)) comuns++;
  return (2 * comuns) / (a.size + b.size);
}

// PALAVRAS são o sinal principal. Bigramas sozinhos NÃO servem em português:
// medido, "bolsa de couro preta" × "receita de bolo" dava 0,485 — dois textos
// sem nenhuma relação, quase na metade da escala, porque em qualquer frase
// curta se repetem " de ", "ra", "es"… Isso enchia a tela de sugestões falsas.
//
// Palavras curtas (até 2 letras) ficam de fora: "de", "na", "e" são cola, não
// conteúdo, e inflam a nota de qualquer par.
function _palavras(txt) {
  return new Set(txt.split(' ').filter(p => p.length > 2));
}

function _bigramas(txt) {
  const s = new Set();
  for (let i = 0; i < txt.length - 1; i++) s.add(txt.slice(i, i + 2));
  return s;
}

// Os bigramas continuam pesando 40%: são eles que perdoam um erro de digitação
// ou um plural a mais, coisas que a comparação por palavra inteira reprovaria.
const PESO_PALAVRAS = 0.6;
const PESO_BIGRAMAS = 0.4;

export function semelhancaDeTexto(a, b) {
  const na = normalizarParaComparar(a);
  const nb = normalizarParaComparar(b);
  if (!na || !nb) return 0;

  // Um começa com o outro = a legenda foi colada e alguém acrescentou algo no
  // fim. É o caso mais comum de todos, e a comparação puniria à toa.
  if (na.startsWith(nb) || nb.startsWith(na)) return 1;

  return PESO_PALAVRAS * _dice(_palavras(na), _palavras(nb))
       + PESO_BIGRAMAS * _dice(_bigramas(na), _bigramas(nb));
}

// O que cada formato daqui é lá na Meta.
// `stories` está de fora de propósito: /{ig}/media não devolve story de forma
// confiável (some em 24h e nem sempre aparece), então casar story sozinho seria
// chutar. Story só é marcado como publicado pelo botão "Já publiquei".
const EQUIVALENTES = {
  feed: (m) => ['IMAGE', 'VIDEO'].includes(m.media_type) && m.media_product_type !== 'REELS',
  carrossel: (m) => m.media_type === 'CAROUSEL_ALBUM',
  reels: (m) => m.media_product_type === 'REELS',
};

export function formatoCombina(formato, midia) {
  const regra = EQUIVALENTES[formato];
  if (!regra || !midia) return false;
  if (midia.media_product_type === 'STORY') return false;
  return regra(midia);
}

export function pontuar(peca, midia) {
  if (!peca?.publicar_em || !midia?.timestamp) return null;
  if (!formatoCombina(peca.formato, midia)) return null;

  const tPeca = new Date(peca.publicar_em).getTime();
  const tMidia = new Date(midia.timestamp).getTime();
  if (Number.isNaN(tPeca) || Number.isNaN(tMidia)) return null;

  const minutos = (tMidia - tPeca) / 60000;
  if (minutos < -HORAS_ANTES * 60 || minutos > HORAS_DEPOIS * 60) return null;

  // A legenda de referência inclui as hashtags: é o texto que a pessoa copiou.
  const textoDaPeca = [peca.legenda, peca.hashtags].filter(Boolean).join(' ');
  const legenda = semelhancaDeTexto(textoDaPeca, midia.caption);
  const tempo = 1 - Math.min(Math.abs(minutos) / 1440, 1);

  const total = PESO_LEGENDA * legenda + PESO_TEMPO * tempo;
  const dif = Math.round(Math.abs(minutos));

  return {
    total, legenda, tempo,
    motivo: `Legenda ${Math.round(legenda * 100)}% parecida, publicado ${
      dif === 0 ? 'no horário exato' : `${dif} min ${minutos >= 0 ? 'depois' : 'antes'} do combinado`
    }.`,
  };
}

// Atribuição gulosa: pontua todos os pares possíveis, ordena do melhor para o
// pior e vai fixando — cada peça e cada post entram uma vez só.
//
// Guloso e não "ótimo global" de propósito: com 5 peças e 20 posts a diferença
// é nenhuma, e o guloso é previsível. Uma atribuição ótima poderia trocar um par
// certeiro por dois medianos, e explicar isso na tela seria impossível.
export function casar(pecas, midias, opcoes = {}) {
  const jaUsados = new Set(opcoes.jaUsados || []);
  const listaP = Array.isArray(pecas) ? pecas : [];
  const listaM = (Array.isArray(midias) ? midias : []).filter(m => m && !jaUsados.has(m.id));

  const pares = [];
  for (const p of listaP) {
    for (const m of listaM) {
      const nota = pontuar(p, m);
      if (nota) pares.push({ peca: p, midia: m, nota });
    }
  }
  pares.sort((a, b) => b.nota.total - a.nota.total);

  const pecasFeitas = new Set();
  const midiasUsadas = new Set();
  const saida = [];

  for (const par of pares) {
    if (pecasFeitas.has(par.peca.id) || midiasUsadas.has(par.midia.id)) continue;

    // Existe outro candidato perto para ESTA peça? Se sim, não dá para ter
    // certeza de qual é — vira pergunta, não decisão.
    const concorrentes = pares.filter(
      o => o.peca.id === par.peca.id && o.midia.id !== par.midia.id
        && !midiasUsadas.has(o.midia.id) && o.nota.total >= LIMIAR_CONCORRENTE,
    );
    const sozinho = concorrentes.length === 0;
    const situacao = (par.nota.total >= LIMIAR_AUTOMATICO && sozinho) ? 'automatico' : 'sugerido';

    pecasFeitas.add(par.peca.id);
    midiasUsadas.add(par.midia.id);
    saida.push({
      peca_id: par.peca.id,
      ig_media_id: par.midia.id,
      ig_permalink: par.midia.permalink || null,
      ig_timestamp: par.midia.timestamp,
      ig_caption: par.midia.caption || '',
      ig_thumb: par.midia.thumbnail_url || par.midia.media_url || null,
      pontuacao: Number(par.nota.total.toFixed(4)),
      situacao,
      motivo: sozinho ? par.nota.motivo : `${par.nota.motivo} Há outro post parecido no mesmo período.`,
    });
  }

  return saida;
}
