/* O QUE A TELA DO GESTOR DIZ SOBRE AS ASSINATURAS DE UM CARRO.
 *
 * Desenho: docs/superpowers/specs/2026-08-06-frota-checklist-assinatura-design.md
 * (D19b, D20, D22).
 *
 * A conta em si é do `conferirCorrente()`, no _shared. Aqui mora só a TRADUÇÃO
 * do resultado dele pra uma frase que o dono entenda — e é aqui que fica a
 * lógica pura, testada, em vez de espalhada num `?:` dentro do template.
 *
 * SÃO QUATRO ESTADOS, NÃO DOIS, e a diferença entre eles é o ponto:
 *
 *   ruim        — alguma coisa mudou depois de assinada. É ACUSAÇÃO. Só aqui.
 *   incompleto  — não deu pra conferir tudo (as respostas não chegaram, ou a
 *                 leitura falhou). NÃO é acusação: é falha nossa, não da ficha.
 *   ok          — conferiu tudo e fecha.
 *   nada        — não há ficha assinada pra conferir.
 *
 * Juntar "incompleto" com "ruim" seria acusar alguém de adulterar por causa de
 * uma queda de internet — o pior defeito possível nesta ferramenta, porque
 * acusa inocente. Juntar "incompleto" com "ok" seria dizer "está tudo certo"
 * sobre o que ninguém olhou.
 */

// 'YYYY-MM-DD' vira '07/08/2026'. Texto puro, sem `Date`: data de calendário
// passada por `new Date()` volta um dia atrás em qualquer fuso a oeste de
// Greenwich, e o dono leria a ficha do dia errado.
export function dataBR(d) {
  const t = String(d || '');
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t.split('-').reverse().join('/') : t;
}

const plural = (n, um, muitos) => (n === 1 ? um : muitos);

/**
 * Traduz o resultado de `conferirCorrente()` pra tela.
 *
 * `r` é o objeto de lá: { ok, total, conferidas, naoConferida, primeiraQuebra }.
 */
export function textoDaConferencia(r) {
  if (!r) {
    return { nivel: 'incompleto',
      texto: 'Não consegui ler o histórico deste carro. Tente de novo.' };
  }
  const total = r.total || 0;
  const conferidas = r.conferidas || 0;

  // A LACUNA DE LEITURA ANDA JUNTO DA ACUSAÇÃO, nunca no lugar dela: existindo
  // as duas, quem lê precisa saber que, além da ficha alterada, houve pedaço
  // que nem chegou a ser olhado.
  const lacuna = r.naoConferida
    ? `Além disso, as respostas da ficha de ${dataBR(r.naoConferida.feita_em)} não chegaram, `
      + 'e essa ficha não pôde ser conferida — o que é falha de leitura, não indício de nada.'
    : '';

  if (r.primeiraQuebra) {
    return { nivel: 'ruim',
      texto: `A ficha de ${dataBR(r.primeiraQuebra.feita_em)} não confere. ${r.primeiraQuebra.motivo} `
        + 'Não apague nem tente corrigir essa ficha: avise quem administra a Central primeiro. '
        + (lacuna ? lacuna + ' ' : '')
        + 'As fichas seguintes a ela não foram conferidas, porque tudo depois da primeira quebra '
        + 'é consequência dela.' };
  }

  if (r.naoConferida) {
    return { nivel: 'incompleto',
      texto: `Não deu pra conferir tudo: as respostas da ficha de ${dataBR(r.naoConferida.feita_em)} `
        + 'não chegaram. Isso NÃO é sinal de que alguém mexeu na ficha — é falha ao ler os dados. '
        + (conferidas
          ? `As outras ${conferidas} ${plural(conferidas, 'ficha assinada confere', 'fichas assinadas conferem')}. `
          : 'Nenhuma outra ficha assinada chegou a ser conferida. ')
        + 'Clique de novo; se continuar assim, avise quem administra a Central.' };
  }

  if (conferidas) {
    return { nivel: 'ok',
      texto: (conferidas === 1
        ? 'A única ficha assinada deste carro confere: nada foi alterado depois de assinado.'
        : `As ${conferidas} fichas assinadas deste carro conferem: nada foi alterado depois de assinado.`)
        // D19b: a promessa de "assinatura conferida" convida a achar que o
        // carro foi olhado de verdade. Não foi conferido nada disso — o que
        // isto prova é só que o papel não mudou.
        + ' Isto prova que o conteúdo das fichas não mudou depois de assinado. Não prova que a '
        + 'pessoa olhou o carro.' };
  }

  // Zero assinadas. NUNCA dizer "tudo certo" sobre o que não foi conferido.
  if (!total) {
    return { nivel: 'nada',
      texto: 'Este carro ainda não tem nenhuma ficha de checklist, então não há o que conferir.' };
  }
  return { nivel: 'nada',
    texto: `Este carro tem ${total} ${plural(total, 'ficha de checklist', 'fichas de checklist')}, e `
      + `${plural(total, 'ela não foi assinada', 'nenhuma delas foi assinada')} — não há o que conferir. `
      // D22: três dos donos de carro não têm login. Deixar "sem assinatura"
      // parecendo suspeito acusaria essas pessoas de uma falta que é do
      // cadastro, não do zelo delas.
      + 'Ficha sem assinatura não é sinal de problema: quem não tem login próprio no aplicativo '
      + 'preenche a ficha e não consegue assinar.' };
}

/* ── A assinatura de UMA ficha, na tela de detalhe ────────────────────────── */

/**
 * O que mostrar no lugar de "Assinatura" quando o gestor abre uma ficha.
 * Distingue os dois "sem assinatura" que existem, porque só um deles é
 * pendência: quem não tem login não podia assinar (D22), e apresentar isso
 * igual a "esqueceram de assinar" seria cobrar a pessoa errada.
 */
export function resumoDaAssinatura(ficha) {
  const f = ficha || {};
  if (f.assinada_em) {
    return { assinada: true, texto: 'Assinada',
      ajuda: 'A assinatura prova que esta ficha não mudou depois de gravada. Ela não prova que '
        + 'o carro foi olhado.' };
  }
  if (f.sem_assinatura_motivo === 'sem_login') {
    return { assinada: false, texto: 'Sem assinatura',
      ajuda: 'Quem preencheu não tem login próprio no aplicativo e por isso não pôde assinar. '
        + 'A ficha vale do mesmo jeito.' };
  }
  return { assinada: false, texto: 'Sem assinatura',
    ajuda: 'Esta ficha foi gravada sem assinatura.' };
}

/**
 * O sinal de D20, e SÓ o caso curto.
 *
 * A assimetria é o desenho inteiro: tempo curto PROVA desatenção — não se
 * confere seis itens de um carro em oito segundos. Tempo longo NÃO PROVA zelo,
 * porque a pessoa pode ter aberto o cartão e ido tomar café. Por isso não
 * existe "selo de bem-feito" aqui: elogiar o demorado seria inventar um
 * atestado que o número não dá.
 *
 * `tempo` é o que `tempoDePreenchimento()` devolve.
 */
export function avisoDeTempo(tempo) {
  if (!tempo || !tempo.rapidoDemais) return null;
  const s = tempo.segundos;
  return `Esta ficha foi preenchida em ${s} ${plural(s, 'segundo', 'segundos')}, do abrir ao assinar. `
    + 'É pouco tempo para olhar os itens um a um — vale conversar com quem preencheu.';
}
