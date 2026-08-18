/* O EXTRATO DE IA, e a diferença entre "R$ 0" e "não sei".
 *
 * O DEFEITO (medido em 18/08/2026): a tela dizia, em letras, que "tarefas que
 * criam imagens não usam a API paga, então custam R$ 0". Isso deixou de ser
 * verdade quando a Fábrica passou a gerar criativos com **gpt-image-2**, que é
 * API PAGA da OpenAI. Havia **473 criativos** gravados como US$ 0,00.
 *
 * A armadilha que faz isso voltar sozinho: em JavaScript, `Number(null) === 0` é
 * **true**. Então basta um `Number(e.usd) === 0` espalhado pela tela para "não
 * sei" virar "R$ 0" de novo, sem ninguém notar. É por isso que a decisão mora
 * aqui, com teste, e não solta no `.vue` — lá dentro ela não teria como quebrar
 * teste nenhum.
 *
 * AS TRÊS SITUAÇÕES, e elas são diferentes:
 *   - número  → custou isso
 *   - 0       → não custou mesmo (subir campanha não chama IA)
 *   - nulo    → ainda não se sabe (motor pago sem preço conhecido)
 *
 * PURO: sem tela, sem rede. */

const ANTHROPIC = /claude|opus|sonnet|haiku/i;
const OPENAI = /gpt|dall|openai/i;

const numero = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : (v == null ? null : Number(v)));

/** Só é zero quando é zero MESMO. Nulo não é zero. */
export function ehZeroDeVerdade(usd) {
  const n = numero(usd);
  return n === 0;
}

export function fraseDoCusto(usd, cambio = 5.5) {
  const n = numero(usd);
  if (n === null || !Number.isFinite(n)) return 'custo ainda não conhecido';
  if (n === 0) return 'R$ 0 · sem API paga';
  const brl = (n * cambio).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  return `${brl} · US$ ${n.toFixed(4)}`;
}

/** Soma o que se sabe e CONTA o que não se sabe, em vez de misturar os dois. */
export function somarCustos(execucoes) {
  let usd = 0, execucoesSemCusto = 0, itensSemCusto = 0;
  for (const e of (execucoes || [])) {
    if (!e) continue;
    const n = numero(e.usd);
    if (n === null || !Number.isFinite(n)) {
      execucoesSemCusto++;
      itensSemCusto += Number(e.itens) || 0;
      continue;
    }
    usd += n;
  }
  return { usd, execucoesSemCusto, itensSemCusto };
}

/** Segmentado por fornecedor — pedido do dono em 18/08. */
export function porFornecedor(execucoes) {
  const baldes = { anthropic: [], openai: [], semIa: [], outros: [] };
  for (const e of (execucoes || [])) {
    if (!e) continue;
    const m = String(e.modelo || '');
    if (!m) baldes.semIa.push(e);
    else if (ANTHROPIC.test(m)) baldes.anthropic.push(e);
    else if (OPENAI.test(m)) baldes.openai.push(e);
    // Motor novo que ninguém classificou NÃO some: aparece como "outros", que é
    // o que faz alguém perguntar em vez de o gasto sumir do extrato.
    else baldes.outros.push(e);
  }
  const saida = {};
  for (const chave of Object.keys(baldes)) {
    saida[chave] = { ...somarCustos(baldes[chave]), execucoes: baldes[chave].length };
  }
  return saida;
}
