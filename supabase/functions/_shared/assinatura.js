/* A ASSINATURA DO CHECKLIST — o texto que se assina, e a impressão digital dele.
 *
 * Desenho: docs/superpowers/specs/2026-08-06-frota-checklist-assinatura-design.md
 *
 * POR QUE UM TEXTO CANÔNICO: assinar "a ficha" não quer dizer nada — é preciso
 * assinar uma SEQUÊNCIA DE BYTES exata, que dê pra recalcular igualzinha daqui a
 * dois anos pra provar que nada mudou. Este arquivo é a definição dessa
 * sequência, e por isso o formato dele não pode mudar sem invalidar tudo que já
 * foi assinado.
 *
 * MORA NO _shared porque a mesma função precisa rodar no navegador (assinar) e
 * no Deno (conferir, e um dia calcular do lado do servidor). Duas cópias dessa
 * função seriam duas verdades sobre o que foi assinado. */

// 4 itens em menos disto não foram olhados (D20). Não bloqueia nada — só fica
// visível pra quem administra.
export const SEGUNDOS_SUSPEITOS = 10;

// JSON.stringify escapa aspas, quebra de linha e qualquer caractere de
// controle — inclusive o próprio separador que este arquivo usa entre campos
// e entre linhas. Sem isso, um campo de TEXTO LIVRE (a pessoa aperta Enter
// numa observação, ou o texto carrega por acaso o mesmo byte do separador)
// levava o separador pra dentro do próprio conteúdo, e dois conteúdos
// DIFERENTES davam o MESMO texto canônico — a assinatura deixava de provar
// o que devia provar. De brinde: `JSON.stringify(null)` dá `null` e
// `JSON.stringify('')` dá `""` — já saem diferentes sozinhos, então nenhum
// campo (não só `hashAnterior`) precisa mais de um byte à parte pra
// distinguir nulo de vazio.
const campo = (v) => JSON.stringify(v === undefined ? null : v);

/**
 * O texto exato que a assinatura cobre. A ORDEM faz parte da prova — trocar
 * dois itens de lugar tem que dar texto diferente.
 *
 * `hashAnterior` é a impressão digital da ficha anterior DESTE CARRO. Vazio
 * significa que é a primeira, e o texto diz isso com todas as letras em vez de
 * deixar um campo em branco ambíguo.
 */
export function textoParaAssinar({ ficha, respostas, hashAnterior }) {
  const linhas = [
    'FROTA-CHECKLIST-V1',
    campo(ficha.veiculo_id),
    campo(ficha.feita_em),
    campo(ficha.pessoa_id),
    campo(ficha.hodometro),
    campo(ficha.hodometro_justificativa),
    // O ARRAY INTEIRO, não `.join(',')`: cadências raramente têm vírgula, mas
    // se um dia tiverem, juntar por vírgula faria `['a,b']` e `['a','b']`
    // darem o mesmo texto. `campo` serializa o array certo — sem essa
    // ambiguidade — pelo mesmo motivo que serializa qualquer outro campo.
    campo(ficha.cadencias || []),
    campo(ficha.resultado),
    campo(ficha.anomalias),
    campo(ficha.assinada_em),
    // `hashAnterior` PASSA POR `campo()` também: sem isso era o único campo
    // que ia cru pro texto, e um hash real que por acaso valesse a palavra
    // "PRIMEIRA" dava o mesmo texto que "não há ficha anterior" — a marca
    // que devia provar exatamente o contrário. `campo()` sempre entre aspas
    // pra qualquer string (JSON.stringify), então nenhum valor real se
    // parece com o literal `PRIMEIRA` sem aspas usado só quando não há hash.
    `ANTERIOR:${hashAnterior ? campo(hashAnterior) : 'PRIMEIRA'}`,
    `ITENS:${(respostas || []).length}`,
  ];
  for (const r of respostas || []) {
    linhas.push([campo(r.item_texto), campo(r.estado), campo(r.observacao)].join(''));
  }
  return linhas.join('\n');
}

/**
 * SHA-256 em hexadecimal. Usa Web Crypto, que existe igual no navegador e no
 * Deno — a mesma entrada tem de dar a mesma saída nos dois, senão a corrente
 * fica impossível de conferir do outro lado.
 */
export async function impressaoDigital(texto) {
  // TextEncoder produz UTF-8. Os itens têm acento ("advertência"), e converter
  // por caractere em vez de UTF-8 mudaria o hash conforme a máquina.
  const bytes = new TextEncoder().encode(String(texto));
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* ── O tempo de preenchimento (D20) ───────────────────────────────────────── */

const instante = (v) => {
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
};

/**
 * Quanto tempo a pessoa levou. NUNCA inventa: sem os dois instantes, devolve
 * nulo em vez de zero — zero significaria "instantâneo", que é uma acusação.
 *
 * O SINAL É ASSIMÉTRICO, e quem consome precisa saber: tempo curto PROVA
 * desatenção; tempo longo NÃO PROVA zelo, porque a pessoa pode ter aberto o
 * cartão e ido tomar café.
 */
export function tempoDePreenchimento(abertaEm, assinadaEm) {
  const a = instante(abertaEm), b = instante(assinadaEm);
  if (a === null || b === null) return { segundos: null, rapidoDemais: false };
  const segundos = Math.round((b - a) / 1000);
  return { segundos, rapidoDemais: segundos >= 0 && segundos < SEGUNDOS_SUSPEITOS };
}

/* ── A conferência da corrente ────────────────────────────────────────────── */

/**
 * Percorre a corrente de um carro e recalcula tudo.
 *
 * SEM ISTO O ENCADEAMENTO É ENFEITE: garantia que ninguém verifica não é
 * garantia. Devolve a PRIMEIRA quebra, não todas — depois da primeira, tudo o
 * que vem é consequência, e listar dez linhas vermelhas esconderia onde o
 * problema começou.
 *
 * `fichas` vem da mais antiga pra mais nova. Ficha sem assinatura é pulada
 * (D22): quem não tem login preenche e não assina, e isso não pode fazer a
 * corrente parecer adulterada.
 */
export async function conferirCorrente(fichas, respostasPorFicha) {
  const lista = fichas || [];
  let anterior = null, conferidas = 0;
  for (const ficha of lista) {
    if (!ficha || !ficha.assinada_em || !ficha.assinatura_hash) continue;

    if ((ficha.assinatura_hash_anterior || null) !== anterior) {
      return { ok: false, total: lista.length, conferidas,
        primeiraQuebra: { id: ficha.id, feita_em: ficha.feita_em,
          motivo: 'Esta ficha aponta para uma ficha anterior diferente da que está no histórico. '
            + 'Ou alguma ficha foi apagada, ou a ordem mudou.' } };
    }

    const texto = textoParaAssinar({
      ficha, respostas: respostasPorFicha ? respostasPorFicha[ficha.id] : [],
      hashAnterior: ficha.assinatura_hash_anterior,
    });
    if (await impressaoDigital(texto) !== ficha.assinatura_hash) {
      return { ok: false, total: lista.length, conferidas,
        primeiraQuebra: { id: ficha.id, feita_em: ficha.feita_em,
          motivo: 'O conteúdo desta ficha não corresponde ao que foi assinado. '
            + 'Alguma coisa foi alterada depois da assinatura.' } };
    }

    anterior = ficha.assinatura_hash;
    conferidas++;
  }
  return { ok: true, total: lista.length, conferidas, primeiraQuebra: null };
}
