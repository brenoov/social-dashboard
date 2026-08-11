//
// O QUE CADA NÍVEL PERMITE, NAQUELA FERRAMENTA, EM PORTUGUÊS.
//
// POR QUE EXISTE (desenho de 11/08/2026, D2): a escada escreve "Ver e mexer"
// com a mesma cara em toda linha, e o significado é incomparável:
//   Frota           → pega e devolve carro, faz o checklist
//   Gestão de Tráfego → muda orçamento de campanha que está gastando AGORA
// Quem concede não tinha como saber a diferença sem conhecer a ferramenta por
// dentro. O dono pediu literalmente "um detalhamento maior do que é cada
// permissão".
//
// REGRA QUE NÃO SE NEGOCIA: frase errada é pior que frase nenhuma — ela vai ser
// lida como verdade na hora de dar acesso. Ferramenta cuja mecânica não foi
// conferida NÃO ganha frase inventada; cai no texto neutro.
//
// A segunda metade da frase (o que a pessoa NÃO consegue) costuma valer mais
// que a primeira: é ela que responde a dúvida de quem está decidindo.
//
// PURO: sem rede, sem DOM.

export const FRASES = {
  frota: {
    sem: 'A Frota não aparece no menu dela.',
    ver: 'Enxerga os carros e de quem é cada um. Não registra nada.',
    mexer: 'Pega e devolve carro, faz o checklist do dia e pede requisição. '
      + 'Não cadastra veículo novo nem apaga.',
    tudo: 'Cadastra e apaga veículo, edita o plano de revisão, e preenche o '
      + 'checklist pelos outros — inclusive pelos motoristas que não têm login.',
  },
  'frota.aprovar': {
    sem: 'Não decide requisição de carro; só pede.',
    ver: 'Aprova e recusa os pedidos de carro de todo mundo.',
  },
  'meta.gestor': {
    sem: 'A Gestão de Tráfego não aparece no menu dela.',
    ver: 'Acompanha o gasto e o resultado das campanhas. Não altera nada.',
    mexer: 'Muda o orçamento de campanha que está gastando agora, pausa e '
      + 'reativa anúncio no ar, aprova as sugestões do robô, e cria e duplica '
      + 'campanha na conta de anúncios.',
  },
  'meta.fabrica': {
    sem: 'A Fábrica de Anúncios não aparece no menu dela.',
    ver: 'Vê os criativos e as campanhas que a Fábrica montou. Não gera nem sobe.',
    mexer: 'Gera criativo com IA e monta campanha. O que sobe para a Meta '
      + 'nasce pausado, e alguém precisa ativar.',
  },
  acessos: {
    sem: 'Colaboradores e Acessos não aparece no menu dela.',
    ver: 'Consulta a ficha dos colaboradores e o que cada um acessa.',
    mexer: 'Edita a ficha, liga contas do Zoho e do OneDrive e registra termos. '
      + 'Não desliga nem apaga colaborador.',
    tudo: 'Tudo do anterior, mais desligar e apagar colaborador do cadastro.',
  },
  patrimonio: {
    sem: 'O Patrimônio não aparece no menu dela.',
    ver: 'Consulta os bens, onde estão e com quem.',
    mexer: 'Registra troca de posse e corrige a ficha do bem. Não cadastra bem novo.',
    tudo: 'Cadastra e apaga bem, e imprime as etiquetas.',
  },
  social: {
    sem: 'As Redes Sociais não aparecem no menu dela.',
    ver: 'Vê os números dos perfis. É painel de leitura: nada aqui se altera.',
    exportar: 'Vê os números dos perfis e baixa a planilha. '
      + 'É painel de leitura: nada aqui se altera.',
  },
  conteudo: {
    sem: 'A Central de Conteúdo não aparece no menu dela.',
    ver: 'Vê o calendário de posts e as artes já aprovadas.',
    mexer: 'Cria peça, sobe a arte e agenda. Não aprova a própria peça — '
      + 'aprovar é a chave separada, logo abaixo.',
    tudo: 'Tudo do anterior, mais apagar peça agendada.',
  },
}

// O que se diz quando a mecânica daquela ferramenta ainda não foi conferida
// com o dono. Descreve o EFEITO do nível, que é verdade em qualquer ferramenta,
// e não afirma nada sobre o que ela faz por dentro.
export const NEUTRO = {
  sem: 'Não aparece no menu dela.',
  ver: 'Abre e consulta, sem alterar nada.',
  exportar: 'Abre, consulta e baixa a planilha, sem alterar nada.',
  mexer: 'Abre e altera o que já existe. Não cria nem apaga.',
  tudo: 'Abre, altera, cria e apaga.',
}

export function temFraseConferida(recursoKey) {
  return Object.prototype.hasOwnProperty.call(FRASES, recursoKey)
}

export function oQueONivelFaz(recursoKey, degrauChave) {
  const d = degrauChave || 'sem'
  const doRecurso = FRASES[recursoKey]
  if (doRecurso && doRecurso[d]) return doRecurso[d]
  return NEUTRO[d] || NEUTRO.sem
}
