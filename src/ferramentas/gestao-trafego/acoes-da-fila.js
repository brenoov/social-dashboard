// AS TRÊS ESCOLHAS DE CADA LINHA DA FILA — subir, baixar, manter.
//
// POR QUE MUDOU (pedido do dono, 2026-08-03): a fila oferecia UMA ação, a que o
// robô tinha escolhido. Quem discordava do robô não tinha caminho: para baixar
// uma verba que o robô mandou subir, era preciso dispensar a sugestão e ir
// mexer na aba Campanhas. Na prática, a fila decidia por ele.
//
// Agora as três aparecem sempre, e cada uma diz o que acontece se for escolhida.
//
// O TAMANHO DO PASSO ESPELHA O ROBÔ (decisão do dono): se ele sugere subir 25%,
// o botão de baixar oferece 25% para baixo. A vantagem sobre um degrau fixo é
// que o tamanho vem do julgamento do robô sobre AQUELA campanha — quando ele
// propõe pouco, as duas opções são pequenas; quando propõe muito, as duas são
// grandes.
//
// PURO: sem rede, sem tela. Recebe o item da fila, devolve o que mostrar.

// Quando não há sugestão do robô para espelhar (item vindo da saúde, ou veredito
// de pausar), o passo cai para 20%. É chute, e por isso a tela DIZ que é —
// `passoPadrao` existe só para ela poder avisar.
export const PASSO_PADRAO = 0.20;

// Piso de orçamento diário. A Meta recusa valores muito baixos, e o número exato
// varia com moeda e objetivo — este é conservador de propósito. Sem ele, uma
// campanha de R$ 6 com passo de 50% ofereceria "baixar para R$ 3" e o dono só
// descobriria a recusa depois de aprovar.
export const MINIMO_CENTAVOS = 500;

// Quantos dias o mês tem para efeito de conta. 30 é o número que o dono usa
// quando fala de verba mensal, e a conta aqui é para dar ORDEM DE GRANDEZA — não
// é fatura.
const DIAS_NO_MES = 30;

const centavos = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : null);
const reais = (c) => (Number(c) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// A distância proporcional que o robô propôs, sempre positiva.
// Devolve null quando não há como espelhar.
export function passoDoRobo(item) {
  const de = centavos(item && item.budget_atual_centavos);
  const para = centavos(item && item.budget_sugerido_centavos);
  if (!de || de <= 0 || !para || para <= 0) return null;
  const p = Math.abs(para / de - 1);
  // Sugestão igual ao valor atual não é passo: seria oferecer "subir para o
  // mesmo valor", que é um botão que não faz nada.
  return p > 0.001 ? p : null;
}

// AS TRÊS ESCOLHAS, prontas para virar botão.
//
// Devolve sempre as três chaves; `subir` e `baixar` vêm null quando não há
// orçamento conhecido (campanha sem valor atual não tem o que multiplicar).
// `manter` existe sempre — é sempre possível não mexer.
export function opcoesDaLinha(item) {
  const de = centavos(item && item.budget_atual_centavos);
  const doRobo = passoDoRobo(item);
  const passo = doRobo == null ? PASSO_PADRAO : doRobo;
  const passoPadrao = doRobo == null;
  const veredito = item && item.veredito;

  const manter = {
    chave: 'manter',
    rotulo: 'Manter como está',
    // O texto diz as DUAS consequências: nada muda agora, e a sugestão volta.
    // Sem a segunda, "manter" parece desligar o aviso para sempre.
    impacto: 'Nada muda no orçamento. A sugestão sai da fila e volta a aparecer daqui a 7 dias se a situação continuar.',
  };

  if (!de || de <= 0) return { subir: null, baixar: null, manter, passo, passoPadrao, recomendada: null };

  // O VALOR DO ROBÔ VAI INTEIRO no lado que ele recomendou. Recalcular pelo
  // percentual arredondado daria um número um pouco diferente do que ele
  // propôs, e a linha mostraria "→ R$ 62,50" com o botão dizendo R$ 62,49.
  const sugerido = centavos(item && item.budget_sugerido_centavos);
  const subiuOrobo = veredito === 'escalar' && sugerido && sugerido > de;
  const baixouOrobo = veredito === 'reduzir' && sugerido && sugerido > 0 && sugerido < de;

  const alvoSubir = subiuOrobo ? sugerido : Math.round(de * (1 + passo));
  const cru = baixouOrobo ? sugerido : Math.round(de * (1 - passo));
  const alvoBaixar = Math.max(cru, MINIMO_CENTAVOS);

  const opcao = (chave, alvo, verbo) => {
    const dif = alvo - de;
    const pct = Math.round((dif / de) * 100);
    const mes = Math.abs(dif) * DIAS_NO_MES;
    return {
      chave,
      alvoCentavos: alvo,
      pct,
      rotulo: `${verbo} para ${reais(alvo)}`,
      // O impacto fala em DIA e em MÊS: o valor diário é o que se aprova, mas é
      // o mensal que a pessoa sente. Um "+R$ 12,50 por dia" parece pouco até
      // virar "R$ 375 a mais no mês".
      impacto: `De ${reais(de)} para ${reais(alvo)} por dia (${pct > 0 ? '+' : ''}${pct}%). `
        + `No mês, cerca de ${reais(mes)} ${dif > 0 ? 'a mais' : 'a menos'}.`,
      // Marca quando o piso mordeu: sem isso o botão mostraria um número que não
      // corresponde ao passo anunciado, e ninguém entenderia por quê.
      noPiso: chave === 'baixar' && alvo > cru,
    };
  };

  return {
    subir: opcao('subir', alvoSubir, 'Subir'),
    baixar: opcao('baixar', alvoBaixar, 'Baixar'),
    manter,
    passo,
    passoPadrao,
    // Qual delas o robô aconselhou — a tela destaca esta, mas as três clicam.
    recomendada: veredito === 'escalar' ? 'subir' : veredito === 'reduzir' ? 'baixar' : null,
  };
}

// A FRASE QUE EXPLICA DE ONDE VEIO O PASSO.
//
// Aparece uma vez por linha, não em cada botão: repetir "o robô sugeriu 25%" em
// três lugares é ruído. Quando o passo é chute, ela DIZ que é chute — a pessoa
// merece saber que aquele número não saiu de análise nenhuma.
export function frasePasso(opcoes) {
  const o = opcoes || {};
  if (!o.subir && !o.baixar) return '';
  const pct = Math.round((o.passo || 0) * 100);
  return o.passoPadrao
    ? `O robô não sugeriu um valor para esta linha, então os dois botões usam ${pct}% para cada lado.`
    : `Os dois lados usam ${pct}%, o mesmo tamanho de passo que o robô propôs.`;
}
