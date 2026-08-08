/* O RABISCO DA ASSINATURA — o que sai do dedo, arrumado pra virar dado.
 *
 * Desenho: docs/superpowers/specs/2026-08-06-frota-checklist-assinatura-design.md
 *
 * O QUE ESTE ARQUIVO É: lógica pura, sem tela e sem banco. O campo de desenho
 * (campo-de-rabisco.vue) coleta pontos crus enquanto o dedo anda; aqui eles
 * viram a forma exata que é GRAVADA e que entra na impressão digital.
 *
 * MORA NO _shared PELO MESMO MOTIVO QUE assinatura.js: a mesma arrumação roda
 * no navegador (na hora de assinar) e no Deno (na hora de imprimir o papel).
 * Duas cópias seriam duas verdades sobre onde o traço passa.
 *
 * O FORMATO, que é o mesmo da coluna `frota_checklist.assinatura_rabisco`:
 *
 *   [ [ [x,y], [x,y], … ],   ← um traço (o dedo desceu … e levantou)
 *     [ [x,y], … ] ]          ← outro traço
 *
 * `x` e `y` vão de 0 a 1, RELATIVOS ao tamanho da área de desenho. Relativos de
 * propósito: o mesmo rabisco sai igual num celular pequeno, num tablet e no
 * papel, e não depende do aparelho de quem assinou.
 *
 * POR QUE ARREDONDAR AQUI, E NÃO SÓ NA HORA DE CONFERIR: `assinatura.js` já
 * arredonda em 3 casas pra montar o texto assinado. Se o banco guardasse o
 * ponto cru (0.5234891…), o valor gravado e o valor assinado seriam textos
 * diferentes da mesma coisa — e bastaria uma diferença de serialização no
 * caminho de volta pra conferência acusar de adulterada uma ficha intacta.
 * Gravando já arredondado, o que está no banco É o que foi assinado. */

// As mesmas 3 casas de `rabiscoCanonico` em assinatura.js. Se um dia mudar lá,
// tem de mudar aqui junto — por isso o teste ao lado compara os dois.
export const CASAS = 3;

const arredondar = (n) => Math.round(n * 10 ** CASAS) / 10 ** CASAS;
const entre0e1 = (n) => Math.min(1, Math.max(0, n));

/**
 * Os traços crus, arrumados: coordenadas presas entre 0 e 1, arredondadas, sem
 * ponto repetido e sem traço vazio.
 *
 * DEVOLVE `null` QUANDO NÃO HÁ DESENHO — nunca `[]`. Os dois seriam "não
 * desenhou nada", mas `null` é o que a coluna guarda pra ficha assinada só com
 * senha, e ter uma forma só evita que duas fichas iguais gerem impressões
 * digitais diferentes.
 *
 * Ponto repetido sai fora porque o dedo parado gera dezenas de leituras no
 * mesmo lugar: elas não mudam o traço, só engordam o que é gravado e assinado.
 * Coordenada que não é número (o navegador entregou algo estranho) é
 * DESCARTADA em vez de virar zero — zero é um canto da área de desenho, e
 * inventar um traço até o canto seria chutar dado.
 */
export function normalizarRabisco(tracos) {
  if (!Array.isArray(tracos)) return null;
  const limpos = [];
  for (const traco of tracos) {
    if (!Array.isArray(traco)) continue;
    const pontos = [];
    for (const p of traco) {
      if (!Array.isArray(p) || p.length < 2) continue;
      const [x, y] = p;
      // NÚMERO DE VERDADE, sem converter. `Number(null)` e `Number('')` dão
      // ZERO — e zero é um canto da área de desenho: um valor estranho viraria,
      // caladinho, um traço até o canto que a pessoa nunca fez.
      if (typeof x !== 'number' || typeof y !== 'number') continue;
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      const ponto = [arredondar(entre0e1(x)), arredondar(entre0e1(y))];
      const ultimo = pontos[pontos.length - 1];
      if (ultimo && ultimo[0] === ponto[0] && ultimo[1] === ponto[1]) continue;
      pontos.push(ponto);
    }
    if (pontos.length) limpos.push(pontos);
  }
  return limpos.length ? limpos : null;
}

/** Quantos pontos o rabisco tem no total. Usado só pra tela saber se há desenho. */
export function pontosDoRabisco(tracos) {
  if (!Array.isArray(tracos)) return 0;
  let n = 0;
  for (const traco of tracos) if (Array.isArray(traco)) n += traco.length;
  return n;
}
