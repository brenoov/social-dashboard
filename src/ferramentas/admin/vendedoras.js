// PUXAR AS VENDEDORAS DAS VENDAS.
//
// PEDIDO DO DONO (04/08/2026): "logicamente dá para puxar pelas vendas as
// vendedoras existentes e jogar no time de vendas".
//
// Dá — mas o cadastro do Bling não é uma lista limpa de pessoas. Medido nos 22
// registros de `bling_vendedores`:
//
//   • "Elen Simone Lopes" aparece com DOIS ids diferentes, e ainda existe
//     "Elen Lopes" — três cadastros que parecem ser a mesma pessoa.
//   • "Najla Souza" e "Najla Rocha" podem ser a mesma, ou não.
//   • "Fábrica" (35 pedidos) e "loja tivoli" (14) NÃO são pessoas: são a loja
//     vendendo sem vendedora identificada.
//
// Criar conta para os 22 como estão faria contas duplicadas e uma conta para
// "Fábrica". Este arquivo separa o que é pessoa do que é balcão, e agrupa o que
// parece ser a mesma pessoa — sempre com o número de pedidos ao lado, porque
// quem decide juntar ou não é quem conhece a equipe.
//
// PURO: não fala com banco e não desenha. As decisões que ele toma são as que
// mais doem se estiverem erradas (juntar duas pessoas diferentes dá acesso de
// uma à venda da outra), então precisam ser prováveis sem navegador.

// Sem acento, sem caixa, sem pontuação e sem espaço repetido.
export function normalizar(nome) {
  return String(nome || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// O QUE NÃO É PESSOA.
//
// O dono pediu para "considerar os que não são pessoas também" — eles não
// somem: viram uma linha marcada como BALCÃO. A venda deles é real e precisa
// cair num time; o que eles não ganham é conta de acesso, porque não há alguém
// para entrar nela.
const SINAIS_DE_BALCAO = [
  /^fabrica$/,
  /^loja\b/,
  /^atacado\b/,
  /^varejo\b/,
  /^institucional$/,
  /\bbalcao\b/,
  /^canal\b/,
  /^private label$/,
];

export function ehBalcao(nome) {
  const n = normalizar(nome);
  return SINAIS_DE_BALCAO.some((re) => re.test(n));
}

// ─────────────────────────────────────────────────────────────────────────────
// AGRUPAR O QUE PARECE SER A MESMA PESSOA
//
// A regra é conservadora de propósito: só junta quando os nomes são idênticos,
// ou quando o PRIMEIRO nome e o ÚLTIMO sobrenome batem nos dois ("Elen Lopes" e
// "Elen Simone Lopes").
//
// POR QUE NÃO ALGO MAIS ESPERTO: distância de edição juntaria "Najla Souza" com
// "Najla Rocha", que são sobrenomes DIFERENTES — e juntar duas mulheres
// diferentes numa conta só dá a uma o faturamento da outra. Quando a máquina
// não tem certeza, quem decide é quem conhece a equipe; por isso os quase-iguais
// saem marcados como `parecidos`, e não juntos.
function palavras(nome) {
  return normalizar(nome).split(' ').filter(Boolean);
}

// "Elen Lopes" é a mesma pessoa que "Elen Simone Lopes"? Só quando o PRIMEIRO
// nome e o ÚLTIMO sobrenome batem nos dois.
//
// A primeira versão desta função aceitava as palavras da menor aparecendo na
// maior "na mesma ordem", e o teste pegou o estrago: "Maria Cristina" caía
// dentro de "Maria Eduarda Cristina Schettini" — maria… cristina… estão lá, em
// ordem. Seriam duas mulheres diferentes numa conta só, uma vendo o
// faturamento da outra. Foi a fusão perigosa que este arquivo existe para
// evitar, escrita por descuido dentro dele mesmo.
//
// Primeiro nome + último sobrenome é o par que as pessoas usam para se
// identificar, e é o que separa os dois casos:
//   Elen Lopes      → elen … lopes      = Elen Simone Lopes ✓
//   Maria Cristina  → maria … cristina  ≠ Maria … Schettini ✗
function mesmaPessoa(a, b) {
  const x = palavras(a);
  const y = palavras(b);
  if (!x.length || !y.length) return false;
  if (x[0] !== y[0]) return false;
  // Nome de uma palavra só não basta para afirmar que é a mesma pessoa: duas
  // "Ana" continuam sendo duas Anas.
  if (x.length === 1 || y.length === 1) return x.length === y.length && x[0] === y[0];
  return x[x.length - 1] === y[y.length - 1];
}

export function agruparVendedores(vendedores) {
  const lista = (vendedores || []).filter((v) => v && v.vendor_id != null);
  const grupos = [];

  for (const v of lista) {
    const balcao = ehBalcao(v.nome);
    // Balcão nunca entra em grupo de pessoa: "loja tivoli" não é a Tivoli
    // vendedora.
    const achou = balcao ? null : grupos.find(
      (g) => !g.balcao && (normalizar(g.nome) === normalizar(v.nome) || mesmaPessoa(g.nome, v.nome)),
    );
    if (achou) {
      achou.ids.push(v.vendor_id);
      achou.pedidos += Number(v.pedidos) || 0;
      // O nome mais COMPLETO manda: "Elen Simone Lopes" diz mais que "Elen Lopes".
      if (palavras(v.nome).length > palavras(achou.nome).length) achou.nome = v.nome;
      if (v.ultima_venda && (!achou.ultima_venda || v.ultima_venda > achou.ultima_venda)) achou.ultima_venda = v.ultima_venda;
    } else {
      grupos.push({
        nome: v.nome,
        ids: [v.vendor_id],
        pedidos: Number(v.pedidos) || 0,
        ultima_venda: v.ultima_venda || null,
        balcao,
      });
    }
  }

  // OS QUASE-IGUAIS ficam marcados, não juntos. É a diferença entre ajudar e
  // decidir no lugar de quem sabe.
  // AVISAR DEMAIS É NÃO AVISAR. A primeira versão marcava como parecido tudo
  // que dividia o PRIMEIRO nome, e na tela isso deu seis avisos — "Maria
  // Eduarda Florêncio" parecida com "Maria Paula Pellet Almeida", que são
  // obviamente duas pessoas. Aviso que aparece onde não devia ensina a ignorar
  // aviso, e aí ele não serve mais para o caso em que importa.
  //
  // Vale a pena avisar em dois casos, e só neles:
  //   • os dois primeiros nomes batem  → "Maria Eduarda F." x "Maria Eduarda C."
  //   • os dois têm só nome e sobrenome, e o primeiro bate → "Najla Souza" x
  //     "Najla Rocha" (o caso real que motivou o aviso)
  for (const g of grupos) {
    if (g.balcao) { g.parecidos = []; continue; }
    const a = palavras(g.nome);
    g.parecidos = grupos
      .filter((o) => {
        if (o === g || o.balcao) return false;
        const b = palavras(o.nome);
        if (a[0] !== b[0]) return false;
        if (a.length >= 2 && b.length >= 2 && a[1] === b[1]) return true;
        return a.length === 2 && b.length === 2;
      })
      .map((o) => o.nome);
  }

  return grupos.sort((a, b) => b.pedidos - a.pedidos || String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
}

// ─────────────────────────────────────────────────────────────────────────────
// DE QUAL LOJA É CADA UMA
//
// Pela loja onde ela mais vendeu. Uma venda avulsa noutra loja (cobrindo folga,
// por exemplo) não muda o time dela — mas a tela mostra a proporção, porque
// "vendeu nas duas" é informação, não ruído.
export function lojaDaVendedora(pedidosDaPessoa) {
  const todos = (pedidosDaPessoa || []).filter(Boolean);
  const porLoja = {};
  for (const p of todos) {
    if (p.loja_id == null) continue;
    porLoja[p.loja_id] = (porLoja[p.loja_id] || 0) + 1;
  }
  const linhas = Object.entries(porLoja).map(([loja_id, n]) => ({ loja_id: Number(loja_id), pedidos: n }))
    .sort((a, b) => b.pedidos - a.pedidos);
  // `pedidosDela` é o TOTAL dela; `comLoja` é quantos desses têm loja gravada.
  // Os dois são necessários, e confundi-los foi o erro da primeira versão: ela
  // calculava a certeza só sobre os que têm loja, então UM pedido decidia a
  // loja de quem tem cento e cinquenta.
  const base = { pedidosDela: todos.length, comLoja: linhas.reduce((s, l) => s + l.pedidos, 0) };
  if (!linhas.length) return { ...base, loja_id: null, pedidos: 0, total: 0, certeza: 0, outras: [] };
  return {
    ...base,
    loja_id: linhas[0].loja_id,
    pedidos: linhas[0].pedidos,
    total: base.comLoja,
    // Quanto das vendas COM LOJA saiu dessa loja.
    certeza: linhas[0].pedidos / base.comLoja,
    // Quanto da vida dela o palpite enxerga. Medido em 05/08/2026: só 30 dos
    // 713 pedidos do cache tinham loja (4%), porque a coluna acabou de nascer.
    // Sem este número, a tela dizia "Loja Dom Pedro" com a cara de quem sabe,
    // olhando 12 dos 153 pedidos da pessoa.
    cobertura: todos.length ? base.comLoja / todos.length : 0,
    outras: linhas.slice(1),
  };
}

// A frase que a tela mostra. Sem loja gravada, DIZ isso — porque "sem loja" e
// "loja desconhecida" levam a ações diferentes: a primeira se resolve abrindo a
// tela de vendas uma vez, a segunda não.
export function comoDizerALoja(escolha, nomeDaLoja) {
  const e = escolha || {};
  if (!e.total) return 'ainda sem loja registrada nas vendas';
  const nome = nomeDaLoja || 'loja ' + e.loja_id;
  // AMOSTRA FINA FALA BAIXO. Com menos de um terço dos pedidos dela carregando
  // loja, o palpite continua sendo mostrado — ele ajuda — mas dizendo em cima
  // de quantos pedidos ele foi feito. Número confiante sobre amostra fina é a
  // maneira mais fácil de fazer alguém confiar no que não deveria.
  if ((e.cobertura || 0) < 0.34) {
    return `talvez ${nome} — só ${e.comLoja} dos ${e.pedidosDela} pedidos dela têm loja registrada`;
  }
  const pct = Math.round((e.certeza || 0) * 100);
  if (e.certeza >= 0.9) return nome;
  return `${nome} (${pct}% das vendas dela)`;
}

// Quem vira CONTA de acesso: pessoa, e que vendeu alguma coisa. Balcão não —
// não há ninguém para entrar nela.
export function viraConta(grupo) {
  return !!grupo && !grupo.balcao && grupo.pedidos > 0;
}

// O e-mail sugerido, a partir do nome. Só sugestão: a tela deixa editar, e o
// e-mail é o que casa a pessoa com o cadastro do RH depois.
export function emailSugerido(nome, dominio = 'rbvcompany.com') {
  const p = palavras(nome);
  if (!p.length) return '';
  const primeiro = p[0];
  const ultimo = p.length > 1 ? p[p.length - 1] : '';
  return (ultimo ? `${primeiro}.${ultimo}` : primeiro) + '@' + dominio;
}
