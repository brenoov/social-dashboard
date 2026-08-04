/* O que fazer com o que a câmera leu.
 *
 * A etiqueta da RBV & Co. traz um código de barras Code 128 cujo conteúdo é o
 * número de patrimônio com zeros à esquerda até seis casas — a de nº 19 guarda
 * exatamente "000019". Confirmado lendo uma etiqueta de verdade, não suposto.
 *
 * Este arquivo não sabe o que é câmera nem o que é tela: recebe o texto que foi
 * lido e devolve o que a tela deve fazer. É o que permite testar as decisões
 * (código torto, item que não existe, zero à esquerda) sem apontar um celular
 * pra nada. */

// Ninguém tem patrimônio zero, e seis dígitos é o que a etiqueta imprime.
// O teto existe pra recusar código de OUTRA coisa (nota fiscal, código de
// barras de produto) que por acaso seja só número: se vier um EAN de 13
// dígitos, isso não é uma etiqueta nossa.
const MAIOR_NUMERO = 999999;

/** Extrai o número de patrimônio do texto lido. Devolve null se não for um. */
export function numeroDoCodigo(texto) {
  if (texto === null || texto === undefined) return null;
  // Code 39 embrulha o conteúdo em asteriscos (início e fim). Nenhuma etiqueta
  // nossa usa esse padrão hoje, mas leitor que devolve "*19*" é comum o
  // bastante pra não valer a pena descobrir isso no meio do corredor.
  const limpo = String(texto).trim().replace(/^\*/, '').replace(/\*$/, '');
  if (!/^\d+$/.test(limpo)) return null;
  const n = Number(limpo);
  if (!Number.isInteger(n) || n <= 0 || n > MAIOR_NUMERO) return null;
  return n;
}

/**
 * Decide o que aconteceu com uma leitura.
 * Devolve { ok, motivo, numero, bem } — `motivo` só vem quando ok é falso.
 */
export function resultadoDaLeitura(bens, texto) {
  const numero = numeroDoCodigo(texto);
  if (numero === null) return { ok: false, motivo: 'ilegivel', numero: null, bem: null };
  const bem = (bens || []).find((b) => b && b.numero === numero) || null;
  if (!bem) return { ok: false, motivo: 'nao-cadastrado', numero, bem: null };
  return { ok: true, motivo: null, numero, bem };
}

/** A frase que a pessoa lê na tela. Sem jargão: quem escaneia está de pé, com
 *  o celular numa mão e a caixa na outra — tem que entender de primeira. */
export function mensagemDoResultado(r) {
  if (!r) return '';
  if (r.ok) return `Etiqueta ${etiqueta(r.numero)} — ${r.bem.nome || 'sem nome'}`;
  if (r.motivo === 'nao-cadastrado') {
    return `Etiqueta ${etiqueta(r.numero)} lida, mas não existe nenhum item com esse número. `
      + 'Ou ele ainda não foi cadastrado, ou a etiqueta foi colada em outra coisa.';
  }
  return 'Não consegui ler essa etiqueta. Aproxime um pouco mais e evite reflexo em cima do código.';
}

/** O número do jeito que está impresso na etiqueta: seis casas, com zeros. */
export function etiqueta(numero) {
  return String(numero).padStart(6, '0');
}
