// COMO A SUGESTÃO É DITA — não o que ela é.
//
// PEDIDO DO DONO (04/08/2026): "dá pra ser melhor com a forma de apresentar o
// que a IA sugere".
//
// O QUE ESTAVA ERRADO, visto na tela: a sugestão saía como um parágrafo cinza
// de cinco linhas, com os números no meio do texto. O achado — "a faixa 35–64
// custa 2,5× menos" — ficava do mesmo tamanho e da mesma cor que a ressalva
// sobre amostra pequena. Quem bate o olho não via nada; quem lia inteiro
// levava meio minuto para chegar ao ponto.
//
// A REGRA QUE ESTE ARQUIVO IMPÕE: primeiro o veredito com o número, depois a
// comparação lado a lado, e só então a prosa. A frase longa não some — ela vira
// o segundo plano, que é o lugar dela.
//
// Puro de propósito: aqui não se desenha nada, só se decide o que é manchete,
// o que é comparação e o que é rodapé. Assim dá para provar a ordem sem abrir
// navegador — e a tela não fica com regra escondida no meio do estilo.

const reais = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Quantas vezes mais caro, escrito como gente fala. "2,5×" e não "2.5x".
export function vezesEmTexto(v) {
  const n = Number(v);
  if (!isFinite(n) || n <= 1) return '';
  // Acima de 10× a casa decimal só polui: "12×" diz o mesmo que "12,3×".
  return (n >= 10 ? Math.round(n) : n.toFixed(1).replace('.', ',')) + '×';
}

// A MANCHETE: o achado em uma linha, com o número dentro.
//
// Devolve null quando não há comparação que justifique manchete — e nesse caso
// a tela mostra só a evidência, sem inventar destaque para o que é morno.
export function manchete(sugestao) {
  const s = sugestao || {};
  const i = s.idade;
  if (!i || !(Number(i.vezes) > 1)) return null;
  return {
    // O que fazer, curto.
    titulo: `Mire de ${i.idadeMin} a ${i.idadeMax} anos`,
    // Por quê, com o número — é este pedaço que ganha destaque na tela.
    numero: vezesEmTexto(i.vezes) + ' mais barato',
    // O que a decisão está deixando na mesa, quando há.
    custou: Number(i.desperdicio) > 0
      ? `${reais(i.desperdicio)} foram para as faixas caras nos últimos 90 dias`
      : '',
  };
}

// A COMPARAÇÃO, em linhas alinháveis. Duas colunas: o que é, quanto custa.
// A tela desenha; a ordem e o rótulo saem daqui.
export function comparacao(sugestao) {
  const i = (sugestao || {}).idade;
  if (!i || i.custoMelhor == null || i.custoPior == null) return [];
  return [
    { rotulo: i.faixaMelhor, valor: reais(i.custoMelhor), tom: 'bom' },
    { rotulo: i.faixaPior, valor: reais(i.custoPior), tom: 'ruim' },
  ];
}

// O QUE MAIS APARECEU nos conjuntos que performam. Vira lista, não parágrafo:
// oito interesses numa frase separada por vírgula é uma frase que ninguém lê.
export function repetidos(sugestao) {
  const s = sugestao || {};
  const out = [];
  if ((s.cidades || []).length) {
    out.push({ titulo: 'Cidades que se repetem nos melhores', itens: s.cidades.map((c) => c.nome) });
  }
  if ((s.interesses || []).length) {
    out.push({ titulo: 'Interesses que se repetem nos melhores', itens: s.interesses.map((i) => i.nome) });
  }
  return out;
}

// A LEITURA DA IA, cortada em parágrafos.
//
// O modelo devolve um bloco corrido. Quebrar em frases e agrupar de duas em
// duas dá respiro sem picotar o raciocínio — e o `cuidado` sai separado porque
// é ressalva, não conclusão.
export function paragrafosDaLeitura(texto, porBloco = 2) {
  const t = String(texto || '').trim();
  if (!t) return [];
  const frases = t.split(/(?<=[.!?])\s+/).filter(Boolean);
  const out = [];
  for (let i = 0; i < frases.length; i += porBloco) out.push(frases.slice(i, i + porBloco).join(' '));
  return out;
}

// QUANTO DA SUGESTÃO É OPINIÃO. A tela marca a caixa da IA; este número existe
// para ela poder dizer "1 de 3 vem da leitura da IA" quando fizer sentido —
// e para o teste provar que evidência e opinião nunca são contadas juntas.
export function contarPartes(sugestao) {
  const s = sugestao || {};
  return {
    medido: (s.idade ? 1 : 0) + (s.cidades || []).length + (s.interesses || []).length,
    daIA: (s.interessesIA || []).length + (s.leitura ? 1 : 0),
  };
}
