import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizarBusca, montarArvore, filtrarArvore, listarLocais,
  caminhoDoLocal, rotuloDoCaminho, estadoDaEscolha, SEM_MARCA, SEM_LOCAL,
} from './arvore-de-locais.js'

// Recorte FIEL do banco de produção (medido, não inventado): as 5 marcas de
// patrimonio_empresas e os locais que provam o caso que manda no desenho —
// "Fábrica Conchal" existe DUAS vezes (Vessel e RB Builders) e "Sede Limeira"
// também (RBV Company e Vessel). Mesmo endereço, empresas diferentes: não são
// duplicatas, e juntar embolaria o patrimônio de duas empresas.
const EMPRESAS = [
  { id: 'e-vessel', nome: 'Vessel' },
  { id: 'e-rbb', nome: 'RB Builders' },
  { id: 'e-rbv', nome: 'RBV Company' },
  { id: 'e-moto', nome: 'Moto Easy' },
  { id: 'e-mantova', nome: 'Mantova' },
]

const LOCAIS = [
  { id: 'l-conchal-vessel', nome: 'Fábrica Conchal', empresa_id: 'e-vessel' },
  { id: 'l-conchal-rbb', nome: 'Fábrica Conchal', empresa_id: 'e-rbb' },
  { id: 'l-limeira-rbv', nome: 'Sede Limeira', empresa_id: 'e-rbv' },
  { id: 'l-limeira-vessel', nome: 'Sede Limeira', empresa_id: 'e-vessel' },
  { id: 'l-casa-rb', nome: 'Casa RB', empresa_id: 'e-rbb' },
  // Existe de verdade, e é o que prova que sugestão NÃO pode virar escolha:
  // "Casa RB" também casa aqui ("casa" no nome, "rb" dentro de "RBV Company").
  { id: 'l-casa-breno', nome: 'Escritório Casa Breno', empresa_id: 'e-rbv' },
  { id: 'l-piracicaba', nome: 'Piracicaba', empresa_id: 'e-moto' },
  { id: 'l-showroom', nome: 'Showroom Limeira', empresa_id: 'e-mantova' },
]

const COMODOS = [
  { id: 'c-estoque', nome: 'Estoque', local_id: 'l-conchal-vessel' },
  { id: 'c-producao', nome: 'Produção', local_id: 'l-conchal-vessel' },
  { id: 'c-ti', nome: 'Sala de TI', local_id: 'l-limeira-rbv' },
  { id: 'c-recepcao', nome: 'Recepção', local_id: 'l-limeira-vessel' },
]

const BASE = { empresas: EMPRESAS, locais: LOCAIS, comodos: COMODOS }

function localPorId(arvore, id) {
  return listarLocais(arvore).find((l) => l.id === id)
}

test('normalizarBusca: acento e caixa não podem separar o que é a mesma coisa', () => {
  assert.equal(normalizarBusca('  FÁBRICA Conchal '), 'fabrica conchal')
  assert.equal(normalizarBusca('Produção'), 'producao')
  assert.equal(normalizarBusca(null), '')
  assert.equal(normalizarBusca(undefined), '')
})

// ─────────────────────────────────────────────────────────────────────────────
// O CASO OBRIGATÓRIO: mesmo nome, marcas diferentes.
// ─────────────────────────────────────────────────────────────────────────────

test('dois locais de mesmo nome e marcas diferentes saem como DUAS opções distintas', () => {
  const arvore = montarArvore(BASE)
  const conchais = listarLocais(arvore).filter((l) => l.nome === 'Fábrica Conchal')

  assert.equal(conchais.length, 2, 'as duas Fábrica Conchal têm de sobreviver — juntar embolaria duas empresas')
  assert.notEqual(conchais[0].id, conchais[1].id)

  // E distinguíveis: cada uma carrega a marca dona, sempre.
  const marcas = conchais.map((l) => l.empresaNome).sort()
  assert.deepEqual(marcas, ['RB Builders', 'Vessel'])
})

test('local de nome repetido vem marcado, para a tela poder gritar', () => {
  const arvore = montarArvore(BASE)
  assert.equal(localPorId(arvore, 'l-conchal-vessel').nomeRepetido, true)
  assert.equal(localPorId(arvore, 'l-limeira-rbv').nomeRepetido, true)
  assert.equal(localPorId(arvore, 'l-casa-rb').nomeRepetido, false)
})

test('o rótulo do caminho põe a marca NA FRENTE — sem ela, "Fábrica Conchal" não identifica nada', () => {
  const arvore = montarArvore(BASE)
  const a = caminhoDoLocal(arvore, 'l-conchal-vessel')
  const b = caminhoDoLocal(arvore, 'l-conchal-rbb')

  assert.equal(a.rotulo, 'Vessel › Fábrica Conchal')
  assert.equal(b.rotulo, 'RB Builders › Fábrica Conchal')
  assert.notEqual(a.rotulo, b.rotulo, 'os dois locais reais não podem exibir o mesmo texto')
})

test('busca por "conchal" devolve as DUAS — ambíguo é ambíguo, e a tela mostra as duas', () => {
  const arvore = montarArvore(BASE)
  const achados = listarLocais(filtrarArvore(arvore, 'conchal'))
  assert.equal(achados.length, 2)
})

test('busca por marca + local separa uma da outra', () => {
  const arvore = montarArvore(BASE)
  const so = listarLocais(filtrarArvore(arvore, 'conchal vessel'))
  assert.equal(so.length, 1)
  assert.equal(so[0].id, 'l-conchal-vessel')
})

// ─────────────────────────────────────────────────────────────────────────────
// Montar a árvore
// ─────────────────────────────────────────────────────────────────────────────

test('montarArvore: três níveis, marca → local → ambiente', () => {
  const arvore = montarArvore(BASE)
  const vessel = arvore.find((e) => e.id === 'e-vessel')

  assert.equal(vessel.nome, 'Vessel')
  assert.deepEqual(vessel.locais.map((l) => l.nome), ['Fábrica Conchal', 'Sede Limeira'])
  assert.deepEqual(vessel.locais[0].comodos.map((c) => c.nome), ['Estoque', 'Produção'])
})

test('montarArvore: marca sem nenhum local não vira linha vazia na tela', () => {
  const arvore = montarArvore({ empresas: EMPRESAS, locais: [LOCAIS[0]], comodos: [] })
  assert.deepEqual(arvore.map((e) => e.id), ['e-vessel'])
})

test('montarArvore: a ordem de entrada é preservada (as consultas já vêm ordenadas)', () => {
  const arvore = montarArvore(BASE)
  assert.deepEqual(arvore.map((e) => e.nome), ['Vessel', 'RB Builders', 'RBV Company', 'Moto Easy', 'Mantova'])
})

test('montarArvore: aguenta entrada vazia ou nenhuma entrada', () => {
  assert.deepEqual(montarArvore(), [])
  assert.deepEqual(montarArvore({}), [])
  assert.deepEqual(montarArvore({ empresas: null, locais: undefined, comodos: [null] }), [])
})

test('montarArvore: local com marca que não existe não some — vai pro grupo "Sem marca", e continua escolhível', () => {
  const arvore = montarArvore({
    ...BASE,
    locais: [...LOCAIS, { id: 'l-orfao', nome: 'Depósito Novo', empresa_id: 'e-que-nao-existe' }],
  })
  const grupo = arvore.find((e) => e.id === SEM_MARCA)
  assert.ok(grupo, 'sumir com o órfão esconde justamente o que precisa de conserto')
  const orfao = grupo.locais.find((l) => l.id === 'l-orfao')
  assert.equal(orfao.selecionavel, true)
})

test('montarArvore: ambiente cujo local não existe aparece, mas NÃO pode ser escolhido', () => {
  const arvore = montarArvore({
    ...BASE,
    comodos: [...COMODOS, { id: 'c-solto', nome: 'Mezanino', local_id: 'l-que-nao-existe' }],
  })
  const grupo = arvore.find((e) => e.id === SEM_MARCA)
  const semLocal = grupo.locais.find((l) => l.id === SEM_LOCAL)

  assert.equal(semLocal.selecionavel, false, 'escolher isso gravaria comodo_id sem local_id — dado quebrado')
  assert.deepEqual(semLocal.comodos.map((c) => c.nome), ['Mezanino'])
})

// ─────────────────────────────────────────────────────────────────────────────
// Filtrar: digitar PENEIRA, não cria
// ─────────────────────────────────────────────────────────────────────────────

test('filtrar com texto vazio devolve a árvore inteira — o padrão é MOSTRAR TUDO', () => {
  const arvore = montarArvore(BASE)
  assert.equal(filtrarArvore(arvore, ''), arvore)
  assert.equal(filtrarArvore(arvore, '   '), arvore)
  assert.equal(filtrarArvore(arvore, null), arvore)
})

test('filtrar pelo nome da marca traz tudo daquela marca', () => {
  const arvore = montarArvore(BASE)
  const r = filtrarArvore(arvore, 'moto easy')
  assert.deepEqual(r.map((e) => e.nome), ['Moto Easy'])
  assert.deepEqual(listarLocais(r).map((l) => l.nome), ['Piracicaba'])
})

test('filtrar ignora acento e caixa', () => {
  const arvore = montarArvore(BASE)
  assert.equal(listarLocais(filtrarArvore(arvore, 'FABRICA')).length, 2)
  assert.equal(listarLocais(filtrarArvore(arvore, 'fábrica')).length, 2)
})

test('ambiente que bate segura o local pai, mas o local mostra só o que bateu', () => {
  const arvore = montarArvore(BASE)
  const r = filtrarArvore(arvore, 'estoque')

  const locais = listarLocais(r)
  assert.deepEqual(locais.map((l) => l.id), ['l-conchal-vessel'])
  assert.deepEqual(locais[0].comodos.map((c) => c.nome), ['Estoque'],
    'sem isto o resultado apareceria junto com Produção, que não bateu')
})

test('filtrar não modifica a árvore original', () => {
  const arvore = montarArvore(BASE)
  const antes = JSON.stringify(arvore)
  filtrarArvore(arvore, 'estoque')
  assert.equal(JSON.stringify(arvore), antes)
})

test('filtrar sem nenhum resultado devolve lista vazia — é a hora do "+"', () => {
  const arvore = montarArvore(BASE)
  assert.deepEqual(filtrarArvore(arvore, 'Barracão'), [])
})

// ─────────────────────────────────────────────────────────────────────────────
// Caminho e estado do campo
// ─────────────────────────────────────────────────────────────────────────────

test('caminhoDoLocal com ambiente monta os três níveis', () => {
  const arvore = montarArvore(BASE)
  const c = caminhoDoLocal(arvore, 'l-conchal-vessel', 'c-estoque')
  assert.equal(c.rotulo, 'Vessel › Fábrica Conchal › Estoque')
  assert.equal(c.comodo.id, 'c-estoque')
})

test('caminhoDoLocal ignora ambiente que não é daquele local, em vez de inventar caminho', () => {
  const arvore = montarArvore(BASE)
  const c = caminhoDoLocal(arvore, 'l-conchal-vessel', 'c-ti')
  assert.equal(c.comodo, null)
  assert.equal(c.rotulo, 'Vessel › Fábrica Conchal')
})

test('caminhoDoLocal devolve null para local sem id ou fora da árvore', () => {
  const arvore = montarArvore(BASE)
  assert.equal(caminhoDoLocal(arvore, null), null)
  assert.equal(caminhoDoLocal(arvore, 'l-apagado'), null)
})

test('rotuloDoCaminho aguenta pedaço faltando', () => {
  assert.equal(rotuloDoCaminho({}), '')
  assert.equal(rotuloDoCaminho({ empresa: { nome: 'Vessel' } }), 'Vessel')
})

test('estadoDaEscolha: campo nunca preenchido', () => {
  const arvore = montarArvore(BASE)
  assert.deepEqual(estadoDaEscolha({ arvore }), { tipo: 'vazio' })
  assert.deepEqual(estadoDaEscolha({ arvore, textoLivre: '   ' }), { tipo: 'vazio' })
})

test('estadoDaEscolha: local escolhido de verdade', () => {
  const arvore = montarArvore(BASE)
  const e = estadoDaEscolha({ arvore, localId: 'l-limeira-vessel' })
  assert.equal(e.tipo, 'escolhido')
  assert.equal(e.caminho.rotulo, 'Vessel › Sede Limeira')
})

test('estadoDaEscolha: local_id que não está mais na árvore NÃO vira "vazio"', () => {
  const arvore = montarArvore(BASE)
  const e = estadoDaEscolha({ arvore, localId: 'l-apagado' })
  assert.equal(e.tipo, 'local-sumiu', 'campo que esvazia sozinho é a mentira mais cara')
  assert.equal(e.localId, 'l-apagado')
})

// ─────────────────────────────────────────────────────────────────────────────
// O texto livre que já existe na Frota. NUNCA some, NUNCA é adivinhado.
// Os três valores abaixo são os que estão gravados hoje em frota_veiculos.
// ─────────────────────────────────────────────────────────────────────────────

test('"Casa RB": texto livre segue texto livre, mesmo batendo com um local real', () => {
  const arvore = montarArvore(BASE)
  const e = estadoDaEscolha({ arvore, textoLivre: 'Casa RB' })

  assert.equal(e.tipo, 'texto-livre')
  assert.equal(e.texto, 'Casa RB', 'o que a pessoa digitou não pode sumir')
  assert.equal(e.localId, undefined, 'sugerir é convite; escolher é da pessoa')

  // Medido no banco real: "Casa RB" traz DUAS — a certa (RB Builders › Casa RB)
  // e uma quase ("casa" bate no nome e "rb" bate dentro de "RBV Company"). É
  // por isso que sugestão não vira escolha nem quando parece óbvia: quem sabe
  // qual é a certa é quem cuida do carro, não a comparação de texto.
  assert.deepEqual(e.sugestoes.map((l) => l.id).sort(), ['l-casa-breno', 'l-casa-rb'])
})

test('"Conchal": duas sugestões, nenhuma escolhida — chutar erraria metade das vezes', () => {
  const arvore = montarArvore(BASE)
  const e = estadoDaEscolha({ arvore, textoLivre: 'Conchal' })

  assert.equal(e.tipo, 'texto-livre')
  assert.equal(e.texto, 'Conchal')
  assert.equal(e.sugestoes.length, 2)
  assert.deepEqual(e.sugestoes.map((l) => l.empresaNome).sort(), ['RB Builders', 'Vessel'])
})

test('"Barracão": não existe local nenhum assim — zero sugestão, e o texto continua à vista', () => {
  const arvore = montarArvore(BASE)
  const e = estadoDaEscolha({ arvore, textoLivre: 'Barracão' })

  assert.equal(e.tipo, 'texto-livre')
  assert.equal(e.texto, 'Barracão')
  assert.deepEqual(e.sugestoes, [])
})

test('escolher um local não apaga o texto antigo: ele volta em textoAntigo', () => {
  const arvore = montarArvore(BASE)
  const e = estadoDaEscolha({ arvore, localId: 'l-conchal-vessel', textoLivre: 'Conchal' })

  assert.equal(e.tipo, 'escolhido')
  assert.equal(e.textoAntigo, 'Conchal', 'a tela tem de poder dizer o que está sendo substituído')
})
