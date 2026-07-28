// Veredito único do cartão. NÃO existem dois selos disputando: existe UM veredito,
// decidido em ordem fixa de precedência (decisão do dono, 2026-07-28):
//   1. saúde manda pausar OU reduzir -> vale a leitura de saúde, por mais barato
//      que a ponderada esteja mostrando (frequência alta queima audiência; barato
//      não conserta isso). O veredito devolvido é o da PRÓPRIA saúde ('pausar' ou
//      'reduzir') — não existe conversão automática pra 'pausar' aqui;
//   2. saúde ok (nem pausar, nem reduzir) e há análise do Opus -> vale o Opus
//      (precedência que já existia);
//   3. saúde ok e sem Opus -> vale a ponderada;
//   4. ponderada sem faixa aproveitável (ex.: volume baixo demais) e há uma
//      leitura de saúde com veredito -> vale a saúde, com a explicação dela
//      (é o caso de campanha de baixo gasto: a ponderada não tem dado
//      suficiente, mas a saúde ainda sabe dizer algo específico).
// Quando quem decide é o Opus, o veredito dele passa direto, sem filtro nem validação
// aqui — o robô Opus emite valores próprios que vão ALÉM do conjunto deste módulo
// (ex.: 'reduzir', que já é real hoje e a tela já sabe tratar). Não restrinja essa lista.
// PURO: sem rede, sem tela.

const VEREDITO_POR_FAIXA = {
  'escalar-forte': 'escalar',
  'dentro-da-meta': 'escalar',
  'manter': 'manter',
  'otimizar': 'otimizar',
};

const reais = (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Só é seguro formatar um valor em dinheiro se ele for um número finito e positivo.
// Sem essa checagem, custoPorPonto/meta ausentes viram "R$ NaN" na frase mostrada ao dono.
const numeroValido = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;

function porqueDaPonderada(p) {
  const temNumeros = numeroValido(p.custoPorPonto) && numeroValido(p.meta);
  const custo = temNumeros ? reais(p.custoPorPonto) : null;
  const meta = temNumeros ? reais(p.meta) : null;

  if (p.faixa === 'escalar-forte') {
    return temNumeros
      ? `Barato por ponto: ${custo} contra a meta de ${meta}. Há espaço claro para escalar.`
      : 'Barato por ponto, mas não consegui mostrar os números exatos. Há espaço claro para escalar.';
  }
  if (p.faixa === 'dentro-da-meta') {
    return temNumeros
      ? `Dentro da meta: ${custo} por ponto contra ${meta}. Pode escalar.`
      : 'Dentro da meta, mas não consegui mostrar os números exatos. Pode escalar.';
  }
  if (p.faixa === 'manter') {
    return temNumeros
      ? `Um pouco acima da meta: ${custo} por ponto contra ${meta}. Observar antes de mexer.`
      : 'Um pouco acima da meta, mas não consegui mostrar os números exatos. Observar antes de mexer.';
  }
  return temNumeros
    ? `Caro por ponto: ${custo} contra a meta de ${meta}. Revisar criativo ou público.`
    : 'Caro por ponto, mas não consegui mostrar os números exatos. Revisar criativo ou público.';
}

export function decidirVeredito(entrada) {
  const e = entrada || {};
  const saude = e.saude, opus = e.opus, ponderada = e.ponderada;

  // Veto de saúde: pausar OU reduzir vetam a ponderada e o Opus. 'reduzir' é o
  // caso da frequência alta (audiência saturada) — barato por ponto não conserta
  // isso, então a ponderada nunca pode sobrepor esse sinal com um "escalar" verde.
  if (saude && (saude.veredito === 'pausar' || saude.veredito === 'reduzir')) {
    return { veredito: saude.veredito, origem: 'saude', porque: saude.justificativa || 'Sinal de saúde ruim na campanha.' };
  }
  if (opus && opus.veredito) {
    return { veredito: opus.veredito, origem: 'opus', porque: opus.justificativa || 'Análise da IA.' };
  }
  if (ponderada && VEREDITO_POR_FAIXA[ponderada.faixa]) {
    return { veredito: VEREDITO_POR_FAIXA[ponderada.faixa], origem: 'ponderada', porque: porqueDaPonderada(ponderada) };
  }
  // Ponderada não teve faixa aproveitável (ex.: 'sem-dados' por volume baixo).
  // Antes de desistir, ainda vale a leitura de saúde — ela já tem, hoje, uma
  // frase específica pra volume baixo ("sem recomendação confiável ainda").
  if (saude && saude.veredito) {
    return { veredito: saude.veredito, origem: 'saude', porque: saude.justificativa || 'Sinal de saúde da campanha.' };
  }
  return { veredito: 'sem-dados', origem: 'nenhuma', porque: 'Ainda não há dado suficiente para recomendar.' };
}
