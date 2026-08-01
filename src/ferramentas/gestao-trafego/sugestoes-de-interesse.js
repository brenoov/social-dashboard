// AS SUGESTÕES DE INTERESSE DENTRO DO GESTOR — qual mostrar, e quando não mostrar.
//
// POR QUE ESTE ARQUIVO EXISTE: o robô semanal já grava sugestões boas em
// `interesses_sugeridos` (uma linha por marca × objetivo), mas elas só apareciam
// na Fábrica — na hora de CRIAR campanha. O Gestor é onde se mexe no público de
// campanha que JÁ ESTÁ RODANDO, e ali a pessoa ficava sem nada, digitando na
// busca da Meta de memória.
//
// PURO: sem rede e sem tela. Quem busca no banco é a tela; aqui só mora a
// decisão do que mostrar — que é a parte que dá pra errar em silêncio e a parte
// que merece teste.

// O QUE SE MOSTRA NO MÁXIMO. A faixa é um atalho, não um catálogo: ela divide
// espaço com a busca da Meta logo abaixo, e uma parede de trinta quadradinhos
// esconderia o campo de busca em vez de ajudar.
export const MAXIMO_DE_CHIPS = 8;

const texto = (v) => (typeof v === 'string' ? v.trim() : '');

// AS SUGESTÕES DESTA CAMPANHA, prontas pra virar quadradinho.
//
// `sugeridos` são as linhas de `interesses_sugeridos` (marca_id, objetivo, itens).
// `objetivo` é o balde da campanha (baldes.js) — 'vendas', 'mensagens'...
// `jaEscolhidos` são os interesses que já estão no público sendo editado.
//
// TRÊS RECUSAS, e nenhuma delas é erro:
//   1. objetivo 'padrao' (a Meta mandou objetivo que não conhecemos) — sem
//      objetivo não há linha, e mostrar a de outro seria pior que não mostrar.
//   2. marca sem rodada para aquele objetivo — acontece de verdade: a rodada
//      pula objetivo cujo pedido falhou.
//   3. tudo que a sugestão tinha já está no público — a faixa some em vez de
//      aparecer vazia, que é o estado que faz a pessoa achar que quebrou.
//
// O QUE JÁ ESTÁ ESCOLHIDO NUNCA APARECE: quadradinho que não faz nada ao ser
// clicado é o tipo de detalhe que corrói a confiança na tela inteira.
export function sugestoesParaOConjunto(sugeridos, objetivo, jaEscolhidos, maximo = MAXIMO_DE_CHIPS) {
  const alvo = texto(objetivo);
  if (!alvo || alvo === 'padrao') return [];

  const linha = (Array.isArray(sugeridos) ? sugeridos : [])
    .find((l) => l && texto(l.objetivo) === alvo);
  if (!linha) return [];

  // Comparação por ID, não por nome: o nome que a Meta devolve na busca e o que
  // o robô gravou saem do mesmo catálogo, mas o id é o que a Meta usa pra
  // segmentar de verdade — e é o único que não muda de grafia.
  const dentro = new Set(
    (Array.isArray(jaEscolhidos) ? jaEscolhidos : [])
      .map((i) => texto(i && i.id))
      .filter(Boolean),
  );

  const saida = [];
  for (const bruto of (Array.isArray(linha.itens) ? linha.itens : [])) {
    if (!bruto || typeof bruto !== 'object') continue;
    const id = texto(bruto.id);
    const nome = texto(bruto.nome);
    // Sem id não dá pra segmentar; sem nome não dá pra mostrar. Os dois são
    // obrigatórios, e faltar um deles é linha estragada, não caso de uso.
    if (!id || !nome || dentro.has(id)) continue;
    saida.push({ id, nome, audience_size: typeof bruto.audience_size === 'number' ? bruto.audience_size : null });
    if (Number.isFinite(maximo) && saida.length >= maximo) break;
  }
  return saida;
}

// A FRASE QUE EXPLICA DE ONDE ISSO VEIO.
//
// Sem ela a faixa é um punhado de quadradinhos sem procedência, e a pessoa não
// sabe se é sugestão da Meta, da ferramenta ou lembrança de outra campanha —
// nem por que mudou de uma semana pra outra.
export function linhaDeOrigem(objetivo, quando) {
  const nome = texto(objetivo);
  if (!nome) return '';
  const d = quando instanceof Date ? quando : (quando ? new Date(quando) : null);
  const data = d && !Number.isNaN(d.getTime())
    ? ` (${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')})`
    : '';
  return `Sugestões da IA para campanhas de ${nome}${data}. Clique para acrescentar.`;
}
