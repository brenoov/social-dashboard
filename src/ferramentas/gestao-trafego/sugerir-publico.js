// SUGERIR PÚBLICO A PARTIR DO QUE JÁ ACONTECEU NESTA CONTA.
//
// PEDIDO DO DONO (2026-08-03): "na parte do público quero que use IA para
// sugerir, principalmente em relação a interesses, localização e idade".
//
// ESTE ARQUIVO É A EVIDÊNCIA, não a opinião. Ele transforma os números da conta
// em recomendações com o porquê ao lado. A camada de IA vem depois e escreve a
// leitura em cima disto — mas ela precisa deste chão, senão vira palpite bonito.
//
// É a mesma regra que o dono já tinha dado sobre a Fila: "senão conta de
// porcentagem eu mesmo fazia". A conta é aqui; o julgamento é depois.
//
// PURO: sem rede, sem tela.

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const reais = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ─────────────────────────────────────────────────────────────────────────────
// IDADE — o dado mais forte que a conta tem.
//
// MEDIDO na conta Vessel (90 dias, 03/08/2026): 18–24 custou R$ 3,42 por
// conversa e 55–64 custou R$ 13,68. Quatro vezes mais caro — e a conta gastou
// SEIS VEZES MAIS na faixa cara. Isso não é opinião, é subtração.
//
// `resultado` é o número de resultados daquela faixa (conversas, cliques, o que
// o objetivo comprar). Quem escolhe qual ação contar é quem chama: a mesma
// campanha pode comprar coisas diferentes.

// Abaixo disto a faixa não decide nada: 3 resultados podem ser sorte.
export const MINIMO_DE_RESULTADOS = 10;

export function lerFaixasDeIdade(linhas, contarResultado) {
  const conta = typeof contarResultado === 'function' ? contarResultado : () => 0;
  return (Array.isArray(linhas) ? linhas : [])
    .filter((l) => l && l.age && String(l.age).toLowerCase() !== 'unknown')
    .map((l) => {
      const gasto = num(l.spend);
      const resultados = num(conta(l));
      return {
        faixa: String(l.age),
        gasto,
        resultados,
        custo: resultados > 0 ? gasto / resultados : null,
        // Poucos resultados = número que não sustenta decisão. Marcado, e não
        // escondido: sumir com a faixa faria parecer que ela não existe.
        confiavel: resultados >= MINIMO_DE_RESULTADOS,
      };
    })
    .sort((a, b) => faixaEmNumero(a.faixa) - faixaEmNumero(b.faixa));
}

const faixaEmNumero = (f) => num(String(f).split(/[-+]/)[0]);

// A RECOMENDAÇÃO DE IDADE: a faixa contígua que concentra o resultado barato.
//
// Contígua de propósito — a Meta segmenta por intervalo (age_min/age_max), não
// por faixas soltas. Recomendar "18–24 e 45–54" seria recomendar algo que a
// ferramenta não sabe pedir.
export function recomendarIdade(faixas) {
  const uteis = (faixas || []).filter((f) => f.confiavel && f.custo != null);
  if (uteis.length < 2) return null;

  const custos = uteis.map((f) => f.custo);
  const melhor = Math.min(...custos);
  const pior = Math.max(...custos);
  // Diferença pequena não justifica mexer: cortar faixa por 15% de variação é
  // apertar o público em troca de ruído.
  if (pior < melhor * 1.5) return null;

  // As faixas até 50% acima da melhor entram; o resto fica de fora.
  const dentro = uteis.filter((f) => f.custo <= melhor * 1.5);
  const primeira = dentro[0];
  const ultima = dentro[dentro.length - 1];
  const idadeMin = faixaEmNumero(primeira.faixa);
  const idadeMax = ultima.faixa.includes('+') ? 65 : num(String(ultima.faixa).split('-')[1]) || 65;

  const fora = uteis.filter((f) => f.custo > melhor * 1.5);
  const gastoFora = fora.reduce((s, f) => s + f.gasto, 0);

  return {
    idadeMin,
    idadeMax,
    porque: `Nesta conta, ${primeira.faixa === ultima.faixa ? `a faixa ${primeira.faixa}` : `as faixas de ${idadeMin} a ${idadeMax} anos`} `
      + `custam a partir de ${reais(melhor)} por resultado, enquanto ${fora.length === 1 ? `a faixa ${fora[0].faixa} custa` : 'as demais custam'} `
      + `até ${reais(pior)} — ${(pior / melhor).toFixed(1)}× mais caro.`,
    // O número que dói: quanto foi para as faixas caras no período medido.
    desperdicio: gastoFora,
    fraseDoDesperdicio: gastoFora > 0
      ? `Nos últimos 90 dias, ${reais(gastoFora)} foram para faixas que custam mais caro.`
      : '',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// LOCALIZAÇÃO E INTERESSES — pelos CONJUNTOS que performam.
//
// POR QUE NÃO PELO `breakdowns=region` DA META: medido em 03/08/2026 e
// descartado. Ele devolve 500 linhas em ordem alfabética, das quais só 23 têm
// gasto, e o topo é Nepal, Bihar e Argélia — sobra de entrega, não a cidade
// onde a campanha rodou. São Paulo nem aparece. Somar essas linhas daria uma
// recomendação errada com cara de dado.
//
// O que responde de verdade: as cidades e os interesses dos CONJUNTOS que
// tiveram o melhor custo por resultado. É a mesma informação, vista do lado que
// a ferramenta controla.

export function lerConjuntos(conjuntos, insightsPorConjunto, contarResultado) {
  const conta = typeof contarResultado === 'function' ? contarResultado : () => 0;
  const porId = insightsPorConjunto || {};
  return (Array.isArray(conjuntos) ? conjuntos : [])
    .filter((cj) => cj && cj.id)
    .map((cj) => {
      const ins = porId[String(cj.id)] || {};
      const gasto = num(ins.spend);
      const resultados = num(conta(ins));
      const t = cj.targeting || {};
      return {
        id: String(cj.id),
        nome: cj.name || '',
        gasto,
        resultados,
        custo: resultados > 0 ? gasto / resultados : null,
        cidades: (((t.geo_locations || {}).cities) || []).map((c) => ({
          key: String(c.key), nome: c.name || String(c.key),
        })),
        interesses: interessesDoTargeting(t),
      };
    })
    .filter((c) => c.custo != null && c.resultados >= MINIMO_DE_RESULTADOS);
}

function interessesDoTargeting(t) {
  const achados = [];
  for (const grupo of (Array.isArray(t.flexible_spec) ? t.flexible_spec : [])) {
    for (const i of (Array.isArray(grupo && grupo.interests) ? grupo.interests : [])) {
      if (i && i.id != null) achados.push({ id: String(i.id), name: i.name || String(i.id) });
    }
  }
  return achados;
}

// A METADE MAIS BARATA dos conjuntos manda. Não o melhor sozinho: um conjunto
// só pode ter dado certo por causa do criativo, e aí a cidade dele não explica
// nada. O que se repete entre os bons é o que vale copiar.
export function recomendarDosConjuntos(conjuntos) {
  const lista = (conjuntos || []).slice().sort((a, b) => a.custo - b.custo);
  if (lista.length < 2) return null;
  const metade = lista.slice(0, Math.max(1, Math.floor(lista.length / 2)));

  const cidades = frequencia(metade.flatMap((c) => c.cidades), (c) => c.key, (c) => c.nome);
  const interesses = frequencia(metade.flatMap((c) => c.interesses), (i) => i.id, (i) => i.name);
  const custoBom = media(metade.map((c) => c.custo));
  const custoRuim = media(lista.slice(metade.length).map((c) => c.custo));

  return {
    cidades: cidades.filter((c) => c.vezes >= 2),
    interesses: interesses.filter((i) => i.vezes >= 2),
    baseadoEm: metade.length,
    deQuantos: lista.length,
    porque: custoRuim > 0
      ? `Isto vem dos ${metade.length} conjuntos mais baratos de ${lista.length} — eles custam ${reais(custoBom)} por resultado, contra ${reais(custoRuim)} dos outros.`
      : `Isto vem dos ${metade.length} conjuntos com melhor custo por resultado.`,
  };
}

function frequencia(itens, chaveDe, nomeDe) {
  const mapa = new Map();
  for (const it of itens) {
    const k = chaveDe(it);
    if (!k) continue;
    const atual = mapa.get(k) || { key: k, nome: nomeDe(it), vezes: 0 };
    atual.vezes += 1;
    mapa.set(k, atual);
  }
  return [...mapa.values()].sort((a, b) => b.vezes - a.vezes);
}

const media = (ns) => (ns.length ? ns.reduce((s, n) => s + n, 0) / ns.length : 0);

// ─────────────────────────────────────────────────────────────────────────────
// A SUGESTÃO INTEIRA, pronta para a tela — e para a IA ler depois.
//
// Devolve SEMPRE a evidência junto: sem ela isto é um palpite com cara de
// número, e o dono já disse que palpite ele mesmo dá.
export function montarSugestao({ faixasDeIdade, conjuntos }) {
  const idade = recomendarIdade(faixasDeIdade || []);
  const doConjunto = recomendarDosConjuntos(conjuntos || []);
  const nada = !idade && (!doConjunto || (!doConjunto.cidades.length && !doConjunto.interesses.length));
  return {
    temAlgo: !nada,
    idade,
    cidades: (doConjunto && doConjunto.cidades) || [],
    interesses: (doConjunto && doConjunto.interesses) || [],
    porqueDosConjuntos: (doConjunto && doConjunto.porque) || '',
    // Por que NÃO veio nada — é o que evita a tela dizer "sem sugestões" e a
    // pessoa achar que quebrou.
    motivoVazio: nada
      ? 'Ainda não há resultado suficiente nesta conta para sugerir com segurança. '
        + `Uma faixa ou um conjunto só conta a partir de ${MINIMO_DE_RESULTADOS} resultados.`
      : '',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// QUAL RESULTADO CONTAR — e dizer qual foi.
//
// A mesma conta compra coisas diferentes: conversa no WhatsApp, clique no site,
// visita ao perfil. Escolher errado inverte a recomendação inteira, então a
// escolha é feita por evidência (o que a conta mais produziu) e o nome do que
// foi contado aparece na tela.
//
// A ordem é a de VALOR, não a de volume: conversa vale mais que clique, e se a
// conta tem as duas é pela conversa que ela deve ser julgada.
const ACOES = [
  { teste: /messaging_conversation_started/, rotulo: 'conversas iniciadas' },
  { teste: /^offsite_conversion\.fb_pixel_purchase$|^purchase$/, rotulo: 'compras' },
  { teste: /^lead$|^offsite_conversion\.fb_pixel_lead$/, rotulo: 'cadastros' },
  { teste: /^landing_page_view$/, rotulo: 'visitas que carregaram' },
  { teste: /^link_click$/, rotulo: 'cliques no link' },
  { teste: /^post_engagement$/, rotulo: 'engajamentos na publicação' },
];

// Qual ação esta conta produz mais — decidida uma vez, e usada em tudo.
export function escolherAcao(linhas) {
  const total = new Map();
  for (const l of (Array.isArray(linhas) ? linhas : [])) {
    for (const a of (Array.isArray(l && l.actions) ? l.actions : [])) {
      if (!a || !a.action_type) continue;
      const achou = ACOES.find((x) => x.teste.test(a.action_type));
      if (!achou) continue;
      total.set(achou.rotulo, (total.get(achou.rotulo) || 0) + num(a.value));
    }
  }
  // Ordem de VALOR entre as que existem, e não a maior quantidade: clique
  // sempre ganharia de conversa no volume, e julgar por clique premiaria quem
  // compra clique barato.
  for (const { rotulo } of ACOES) if ((total.get(rotulo) || 0) > 0) return rotulo;
  return null;
}

// O contador para um rótulo escolhido. Devolve função, para casar com a
// assinatura que `lerFaixasDeIdade` e `lerConjuntos` já esperam.
export function contadorDe(rotulo) {
  const def = ACOES.find((x) => x.rotulo === rotulo);
  if (!def) return () => 0;
  return (linha) => {
    let n = 0;
    for (const a of (Array.isArray(linha && linha.actions) ? linha.actions : [])) {
      if (a && a.action_type && def.teste.test(a.action_type)) n += num(a.value);
    }
    return n;
  };
}
