// A árvore Marca → Local → Ambiente, montada e peneirada. Lógica pura: não
// toca banco nem tela.
//
// POR QUE ESTE ARQUIVO EXISTE
// ---------------------------
// A árvore já está no banco há tempo — 5 marcas (patrimonio_empresas), 18
// locais (patrimonio_locais, com empresa_id) e 55 ambientes
// (patrimonio_comodos, com local_id) — e o Patrimônio já aponta 342 dos 350
// bens para um local de verdade. A Frota não: `frota_veiculos.local_texto` é
// texto livre. Quem edita a ficha de um carro digita às cegas, sem ver nada do
// que já existe. Foi a queixa do dono, com as palavras dele: "fui editar a
// ficha de carro BMW, aí tem lá campo local, eu digito ao invés de já mostrar
// tudo o que já temos em banco".
//
// O DEFEITO QUE MANDA NO DESENHO DESTE MÓDULO
// -------------------------------------------
// Dois locais da base têm o MESMO NOME e marcas DIFERENTES:
//
//   Fábrica Conchal (Vessel)      15 ambientes, 148 bens
//   Fábrica Conchal (RB Builders)  0 ambientes,   2 bens
//   Sede Limeira    (RBV Company) 13 ambientes,  40 bens
//   Sede Limeira    (Vessel)       5 ambientes,  10 bens
//
// Não são duplicatas para juntar: juntar embolaria o patrimônio de duas
// empresas. E uma lista que mostra "Fábrica Conchal" duas vezes sem dizer de
// quem é deixa quem escolhe sem meio de acertar — é cara ou coroa. Por isso a
// marca anda GRUDADA no local em tudo que sai daqui (`empresaNome`,
// `nomeRepetido`, o rótulo do caminho) e a busca casa marca+local juntos, para
// "conchal vessel" achar exatamente um.
//
// E O QUE JÁ FOI DIGITADO À MÃO
// -----------------------------
// Os `local_texto` que existem hoje na Frota são "Casa RB" (que bate com um
// local real da RB Builders), "Conchal" (o local real chama "Fábrica Conchal"
// — parecido, não igual) e "Barracão" (não existe local nenhum com esse nome).
// Nada aqui adivinha por conta própria: `estadoDaEscolha` devolve SUGESTÕES,
// nunca uma escolha. "Conchal" devolve DUAS sugestões justamente porque chutar
// erraria metade das vezes, e "Barracão" devolve zero — que é a hora do "+".

/** Tira acento e caixa alta, para "Fábrica" e "fabrica" baterem. */
export function normalizarBusca(texto) {
  return String(texto ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

// Sentinelas dos grupos de órfão. São string (e não null) porque viram :key de
// v-for e valor de estado de navegação, onde null não serve. Mesmo motivo e
// mesmo formato do SEM_VALOR de patrimonio/arvore-de-bens.js.
export const SEM_MARCA = '__sem_marca__'
export const SEM_LOCAL = '__sem_local__'

/** Quebra o que foi digitado em termos. "conchal vessel" → dois termos, e os
 * dois têm de aparecer — é assim que se separa uma Fábrica Conchal da outra. */
function termosDaBusca(texto) {
  const limpo = normalizarBusca(texto)
  return limpo ? limpo.split(/\s+/) : []
}

function todosOsTermosBatem(termos, palheiro) {
  return termos.every((t) => palheiro.includes(t))
}

/**
 * Monta a árvore a partir das três listas cruas do banco (as mesmas que a tela
 * de Patrimônio já busca: `id,nome` / `id,nome,empresa_id` / `id,nome,local_id`).
 * A ordem de entrada é preservada — as consultas já vêm ordenadas por `ordem` e
 * depois `nome`, e essa é a ordem que o dono conhece.
 *
 * Órfão nunca some, pelo mesmo motivo de arvore-de-bens.js: some do mapa
 * justamente o que mais precisa de atenção.
 *  - local sem marca (ou com marca que não existe) → grupo "Sem marca", e
 *    continua selecionável, porque local é o que se guarda na ficha;
 *  - ambiente sem local (ou com local que não existe) → aparece dentro de "Sem
 *    marca", num grupo "Sem local" marcado como NÃO selecionável: escolher um
 *    ambiente solto gravaria um comodo_id sem local_id, que é dado quebrado.
 *    Ele aparece para ser visto e consertado, não para ser usado.
 */
export function montarArvore({ empresas, locais, comodos } = {}) {
  const listaEmpresas = (Array.isArray(empresas) ? empresas : []).filter(Boolean)
  const listaLocais = (Array.isArray(locais) ? locais : []).filter(Boolean)
  const listaComodos = (Array.isArray(comodos) ? comodos : []).filter(Boolean)

  const empresaPorId = new Map(listaEmpresas.map((e) => [e.id, e]))

  // Quantas vezes cada nome de local se repete na base INTEIRA. É o que marca
  // "Fábrica Conchal" e "Sede Limeira" como nome ambíguo — não dá para saber
  // isso olhando um local sozinho, só contando a base.
  const vezesPorNome = new Map()
  for (const l of listaLocais) {
    const chave = normalizarBusca(l.nome)
    vezesPorNome.set(chave, (vezesPorNome.get(chave) || 0) + 1)
  }

  const localPorId = new Map(listaLocais.map((l) => [l.id, l]))
  const comodosPorLocal = new Map()
  const comodosSoltos = []
  for (const c of listaComodos) {
    if (!c.local_id || !localPorId.has(c.local_id)) { comodosSoltos.push(c); continue }
    if (!comodosPorLocal.has(c.local_id)) comodosPorLocal.set(c.local_id, [])
    comodosPorLocal.get(c.local_id).push(c)
  }

  function montarLocal(l, empresaNome) {
    return {
      id: l.id,
      nome: l.nome,
      empresaId: l.empresa_id || SEM_MARCA,
      empresaNome,
      // Verdadeiro quando existe outro local com o mesmo nome em outra marca.
      // A marca aparece sempre; isto é o extra para gritar no caso ambíguo.
      nomeRepetido: (vezesPorNome.get(normalizarBusca(l.nome)) || 0) > 1,
      selecionavel: true,
      ehSemValor: false,
      comodos: (comodosPorLocal.get(l.id) || []).map((c) => ({
        id: c.id, nome: c.nome, localId: l.id,
      })),
    }
  }

  const arvore = []
  for (const emp of listaEmpresas) {
    const daMarca = listaLocais.filter((l) => l.empresa_id === emp.id)
    if (!daMarca.length) continue
    arvore.push({
      id: emp.id,
      nome: emp.nome,
      ehSemValor: false,
      locais: daMarca.map((l) => montarLocal(l, emp.nome)),
    })
  }

  const locaisSemMarca = listaLocais.filter((l) => !l.empresa_id || !empresaPorId.has(l.empresa_id))
  if (locaisSemMarca.length || comodosSoltos.length) {
    const grupo = {
      id: SEM_MARCA,
      nome: 'Sem marca',
      ehSemValor: true,
      locais: locaisSemMarca.map((l) => montarLocal(l, 'Sem marca')),
    }
    if (comodosSoltos.length) {
      grupo.locais.push({
        id: SEM_LOCAL,
        nome: 'Sem local',
        empresaId: SEM_MARCA,
        empresaNome: 'Sem marca',
        nomeRepetido: false,
        selecionavel: false,
        ehSemValor: true,
        comodos: comodosSoltos.map((c) => ({ id: c.id, nome: c.nome, localId: null })),
      })
    }
    arvore.push(grupo)
  }

  return arvore
}

/**
 * Peneira a árvore pelo que foi digitado. FILTRA, não cria — este é o ponto do
 * pedido: em vez de digitar às cegas, a pessoa vê encolher o que já existe.
 *
 * O palheiro de um local inclui o nome da MARCA, então:
 *  - "vessel"          → tudo da Vessel;
 *  - "conchal"         → as duas Fábrica Conchal (é ambíguo mesmo, e a tela
 *                        mostra as duas com a marca do lado);
 *  - "conchal vessel"  → uma só.
 * Ambiente que bate segura o local pai na tela (senão o resultado apareceria
 * sem dizer onde fica), mas aí o local mostra só os ambientes que bateram.
 * Texto vazio devolve a árvore inteira: o padrão é MOSTRAR TUDO.
 */
export function filtrarArvore(arvore, texto) {
  const lista = Array.isArray(arvore) ? arvore : []
  const termos = termosDaBusca(texto)
  if (!termos.length) return lista

  const saida = []
  for (const emp of lista) {
    const locaisQueFicam = []
    for (const loc of emp.locais || []) {
      const palheiroLocal = normalizarBusca(`${emp.nome} ${loc.nome}`)
      if (todosOsTermosBatem(termos, palheiroLocal)) { locaisQueFicam.push(loc); continue }

      const comodosQueBatem = (loc.comodos || []).filter((c) =>
        todosOsTermosBatem(termos, normalizarBusca(`${emp.nome} ${loc.nome} ${c.nome}`)))
      if (comodosQueBatem.length) locaisQueFicam.push({ ...loc, comodos: comodosQueBatem })
    }
    if (locaisQueFicam.length) saida.push({ ...emp, locais: locaisQueFicam })
  }
  return saida
}

/** Todos os locais da árvore numa lista só, na ordem em que aparecem. */
export function listarLocais(arvore) {
  const saida = []
  for (const emp of Array.isArray(arvore) ? arvore : []) {
    for (const loc of emp.locais || []) saida.push(loc)
  }
  return saida
}

/** "Vessel › Fábrica Conchal › Estoque". A marca vem SEMPRE na frente — sem
 * ela, "Fábrica Conchal" não identifica nada, porque existem duas. */
export function rotuloDoCaminho({ empresa, local, comodo } = {}) {
  return [empresa?.nome, local?.nome, comodo?.nome].filter(Boolean).join(' › ')
}

/**
 * De qual marca/local/ambiente são os ids guardados na ficha. Devolve `null`
 * quando o local não está na árvore — quem chama tem de tratar isso, não fingir
 * que o campo está vazio (o local pode ter sido apagado, ou a pessoa pode não
 * enxergá-lo).
 *
 * `comodoId` que não pertence ao local achado é IGNORADO (volta `comodo: null`)
 * em vez de devolver um caminho impossível — mesma regra do "a tela nunca
 * mente": melhor mostrar só o local do que inventar um ambiente.
 */
export function caminhoDoLocal(arvore, localId, comodoId) {
  if (!localId) return null
  for (const empresa of Array.isArray(arvore) ? arvore : []) {
    for (const local of empresa.locais || []) {
      if (local.id !== localId) continue
      const comodo = comodoId ? (local.comodos || []).find((c) => c.id === comodoId) || null : null
      return { empresa, local, comodo, rotulo: rotuloDoCaminho({ empresa, local, comodo }) }
    }
  }
  return null
}

/**
 * O que o campo tem hoje, em quatro desfechos — e nenhum deles apaga nada:
 *
 *  - 'escolhido'   → aponta para um local de verdade. Vem com o caminho pronto.
 *  - 'local-sumiu' → tem um local_id que não está na árvore. Não vira "vazio":
 *                    campo que esvazia sozinho é a mentira mais cara.
 *  - 'texto-livre' → não tem local_id, mas alguém já digitou algo ("Conchal",
 *                    "Barracão"). O texto é devolvido para ser MOSTRADO, com
 *                    `sugestoes` = os locais que aquele texto poderia ser.
 *                    Sugestão é convite, não decisão: "Conchal" devolve duas
 *                    (Vessel e RB Builders) e nenhuma é escolhida sozinha;
 *                    "Barracão" devolve zero, e aí o caminho é o "+".
 *  - 'vazio'       → nunca foi preenchido.
 */
export function estadoDaEscolha({ arvore, localId, comodoId, textoLivre } = {}) {
  if (localId) {
    const caminho = caminhoDoLocal(arvore, localId, comodoId)
    if (caminho) return { tipo: 'escolhido', caminho, textoAntigo: (textoLivre || '').trim() || null }
    return { tipo: 'local-sumiu', localId, textoAntigo: (textoLivre || '').trim() || null }
  }

  const texto = (textoLivre || '').trim()
  if (texto) return { tipo: 'texto-livre', texto, sugestoes: listarLocais(filtrarArvore(arvore, texto)) }

  return { tipo: 'vazio' }
}
