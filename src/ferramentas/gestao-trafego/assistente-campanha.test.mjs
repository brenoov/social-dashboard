import { test } from 'node:test'
import assert from 'node:assert/strict'
import { montarAssistente, textoDaConfirmacao } from './assistente-campanha.js'
import { estadoInicial } from './criar-campanha.js'

// Um `document` de mentira do tamanho exato do que o assistente usa. Existe
// porque a tela real exige login e dados ao vivo — e o que não se abre sozinho
// ninguém confere.
function docFalso() {
  const criar = (tag) => ({
    tag, filhos: [], style: { cssText: '' }, textContent: '', value: '', placeholder: '',
    title: '', type: '', disabled: false, selected: false, className: '',
    onclick: null, oninput: null, onblur: null, onchange: null,
    appendChild(f) { this.filhos.push(f); return f },
    get texto() { return (this.textContent || '') + this.filhos.map((f) => f.texto).join(' ') },
    get botoes() { return this.filhos.flatMap((f) => (f.tag === 'button' ? [f, ...f.botoes] : f.botoes)) },
    // `select` entra na lista de campos junto com input e textarea: o passo de
    // identidade escolhe a página por um, e sem isso o teste não o alcança.
    get campos() { return this.filhos.flatMap((f) => (['input', 'textarea', 'select'].includes(f.tag) ? [f, ...f.campos] : f.campos)) },
  })
  return { createElement: criar }
}

const OBJETIVOS = [
  { chave: 'engajamento', rotulo: 'Conversas no WhatsApp' },
  { chave: 'conversao', rotulo: 'Vendas' },
]
// As páginas vêm da Meta (/me/accounts) — a forma é a mesma que a tela monta.
const PAGINAS = [
  { id: '946991068499592', nome: 'La Vessel Tivoli', igId: '17841405371693083', igNome: 'lavesseltivoli' },
  { id: '959648637231934', nome: 'La Vessel Hortolândia', igId: '', igNome: '' },
]
const cheio = () => ({
  ...estadoInicial(), objetivo: 'engajamento', nome: 'Bolsas',
  pageId: '946991068499592', igId: '17841405371693083', whatsapp: '5519999999999',
  publico: { cidades: [{ key: '1', nome: 'Campinas' }], idadeMin: 25, idadeMax: 45, interesses: [{ id: '9', name: 'Bolsas' }] },
  imagemHash: 'h1', texto: 'Oi',
})
const montar = (extra = {}) => montarAssistente({
  doc: docFalso(), estado: estadoInicial(), passo: 0, objetivos: OBJETIVOS,
  paginas: PAGINAS,
  imagens: [{ hash: 'h1', url: 'u1' }, { hash: 'h2', url: 'u2' }],
  aoMudar() {}, aoPasso() {}, aoCriar() {}, aoMostrarFaltas() {}, aoIrPara() {},
  ...extra,
})

test('o passo 1 mostra os objetivos com nome de gente, nao o codigo da Meta', () => {
  const { corpo } = montar()
  assert.match(corpo.texto, /Conversas no WhatsApp/)
  assert.match(corpo.texto, /Vendas/)
  assert.ok(!/OUTCOME_/.test(corpo.texto))
})

test('a trilha diz onde se esta', () => {
  assert.match(montar({ passo: 0 }).corpo.texto, /passo 1 de 5/)
  assert.match(montar({ passo: 3, estado: cheio() }).corpo.texto, /passo 4 de 5/)
})

test('passo fora da faixa nao estoura — encaixa no limite', () => {
  assert.match(montar({ passo: 99, estado: cheio() }).corpo.texto, /passo 5 de 5/)
  assert.match(montar({ passo: -5 }).corpo.texto, /passo 1 de 5/)
})

test('escolher objetivo avisa quem chama, sem redesenhar por conta propria', () => {
  let mudou = null
  const { corpo } = montar({ aoMudar: (m) => { mudou = m } })
  corpo.botoes[0].onclick({ preventDefault() {} })
  assert.deepEqual(mudou, { objetivo: 'engajamento' })
})

test('digitar o nome NAO redesenha — senao o campo perde o foco a cada letra', () => {
  let opcoes = null
  const { corpo } = montar({ aoMudar: (m, o) => { opcoes = o } })
  const nome = corpo.campos[0]
  nome.value = 'Bolsas'
  nome.oninput()
  assert.equal(opcoes.semRedesenhar, true)
})

test('o orcamento aceita qualquer formato de digitacao', () => {
  // "R$ 1.234,56", "1234,56" e "123456" têm de virar o mesmo número: quem digita
  // não devia precisar saber o formato certo.
  for (const escrito of ['R$ 1.234,56', '1234,56', '123456']) {
    let mudou = null
    const { corpo } = montar({ passo: 2, aoMudar: (m) => { mudou = m } })
    const campo = corpo.campos[0]
    campo.value = escrito
    campo.oninput()
    assert.equal(mudou.orcamentoCentavos, 123456, escrito)
  }
})

test('o passo 3 resume o publico escolhido, e diz quando nao ha', () => {
  assert.match(montar({ passo: 3, estado: cheio() }).corpo.texto, /Onde: Campinas/)
  assert.match(montar({ passo: 3 }).corpo.texto, /Ainda não escolhido/)
})

test('o passo 4 marca a imagem escolhida e oferece enviar', () => {
  const { corpo } = montar({ passo: 4, estado: { ...cheio(), imagemHash: 'h2' }, aoEnviarImagem() {} })
  assert.match(corpo.texto, /enviar imagem/)
  const marcadas = corpo.botoes.filter((b) => /outline:3px solid var\(--accent\)/.test(b.style.cssText))
  assert.equal(marcadas.length, 1, 'exatamente uma marcada')
})

test('sem callback de envio, o botao de enviar nao aparece', () => {
  // A tela pode não ter o caminho de upload pronto; não prometer é melhor que
  // oferecer um botão que não faz nada.
  assert.ok(!/enviar imagem/.test(montar({ passo: 4, estado: cheio() }).corpo.texto))
})

// ── O rodapé ────────────────────────────────────────────────────────────────

test('o primeiro passo nao tem Voltar; o ultimo troca Avancar por Criar', () => {
  const rot = (r) => r.botoes.map((b) => b.textContent)
  assert.ok(!rot(montar().rodape).includes('Voltar'))
  assert.ok(rot(montar().rodape).includes('Avançar'))
  const fim = montar({ passo: 4, estado: cheio() })
  assert.ok(rot(fim.rodape).includes('Criar campanha'))
  assert.ok(!rot(fim.rodape).includes('Avançar'))
})

test('Avancar com passo incompleto MOSTRA o que falta, nao trava calado', () => {
  // Botão morto sem explicação prende a pessoa sem dizer por quê.
  let mostrou = false, foi = null
  const { rodape } = montar({ aoMostrarFaltas: () => { mostrou = true }, aoPasso: (n) => { foi = n } })
  rodape.botoes.find((b) => b.textContent === 'Avançar').onclick({ preventDefault() {} })
  assert.equal(mostrou, true)
  assert.equal(foi, null, 'não avança')
})

test('Avancar com o passo completo AVANCA', () => {
  let foi = null
  const { rodape } = montar({ estado: cheio(), aoPasso: (n) => { foi = n } })
  rodape.botoes.find((b) => b.textContent === 'Avançar').onclick({ preventDefault() {} })
  assert.equal(foi, 1)
})

test('Criar com algo faltando LEVA ate o passo que falta, em vez de recusar', () => {
  let levou = null
  const { rodape } = montar({ passo: 4, estado: { ...cheio(), nome: '' }, aoIrPara: (p) => { levou = p }, aoCriar() { throw new Error('não podia criar') } })
  rodape.botoes.find((b) => /Criar/.test(b.textContent)).onclick({ preventDefault() {} })
  assert.equal(levou, 'objetivo')
})

test('enquanto cria, o botao trava e avisa', () => {
  const { rodape } = montar({ passo: 4, estado: cheio(), criando: true })
  const b = rodape.botoes.find((x) => /Criando/.test(x.textContent))
  assert.ok(b)
  assert.equal(b.disabled, true)
})

test('o rodape diz SEMPRE que nasce pausado', () => {
  for (const p of [0, 1, 2, 3, 4]) assert.match(montar({ passo: p, estado: cheio() }).rodape.texto, /nasce pausado/)
})

test('sem document devolve null em vez de estourar', () => {
  assert.equal(montarAssistente({ doc: null }), null)
  assert.equal(montarAssistente(), null)
})

// ── A confirmação ───────────────────────────────────────────────────────────

test('a confirmacao lista tudo E avisa que nasce pausado', () => {
  const h = textoDaConfirmacao(cheio(), 'Conversas no WhatsApp')
  assert.match(h, /Vou criar na Meta/)
  assert.match(h, /Conversas no WhatsApp/)
  assert.match(h, /nasce <b>pausado<\/b>/)
})

test('a confirmacao ESCAPA o que vem de fora — nome digitado e dados da Meta', () => {
  // O nome é digitado pela pessoa; cidade e interesse vêm da Meta. Nenhum é
  // nosso, e esta é a janela onde se aperta o botão que gasta dinheiro.
  const veneno = '<img src=x onerror="alert(1)">'
  const h = textoDaConfirmacao({
    ...cheio(), nome: veneno,
    publico: { cidades: [{ key: '1', nome: veneno }], idadeMin: 25, idadeMax: 45, interesses: [{ id: '9', name: veneno }] },
  }, veneno)
  // O que importa é o `<` não chegar cru: dentro de texto escapado, a palavra
  // "onerror=" é só palavra — não vira atributo de nada.
  assert.ok(!h.includes('<img'), 'a tag não pode chegar crua no HTML')
  assert.ok(!/<[a-z]+ [^>]*onerror/i.test(h), 'e não pode existir tag nenhuma com onerror')
  assert.ok(h.includes('&lt;img'), 'tem de aparecer escapado, e não sumir')
  // O HTML que é NOSSO continua funcionando — escapar não pode virar texto puro.
  assert.match(h, /<b>Vou criar na Meta:<\/b>/)
  assert.match(h, /nasce <b>pausado<\/b>/)
})

// ─────────────────────────────────────────────────────────────────────────────
// O PRIMEIRO CLIQUE EM "CRIAR CAMPANHA" TEM QUE VALER.
//
// O DEFEITO REAL, visto ao vivo na conta do dono (03/08/2026) depois de 34
// testes verdes: `primeiroPassoIncompleto` era calculado no DESENHO do rodapé.
// O último passo muda o estado SEM redesenhar (senão o campo de texto perderia
// o foco a cada letra), então a resposta guardada ficava velha: o primeiro
// clique achava que a peça estava incompleta e mandava a pessoa para o passo em
// que ela já estava.
//
// O sintoma era o pior formato possível — NADA acontecia. Sem erro, sem aviso,
// sem mudança na tela. Só o segundo clique funcionava.
test('completar o ultimo passo SEM redesenhar nao rouba o primeiro clique', () => {
  const doc = docFalso();
  // O estado como ele fica ao ENTRAR no passo 4: tudo pronto, menos imagem e texto.
  const estado = {
    ...estadoInicial(), objetivo: 'engajamento', nome: 'Campanha',
    pageId: '946991068499592', igId: '17841405371693083',
    publico: { cidades: [{ key: '267873', nome: 'Campinas' }] },
  };
  let criou = false, mandouPara = null;
  const desenhar = () => montarAssistente({
    doc, estado, passo: 4, objetivos: [{ chave: 'engajamento', rotulo: 'Engajamento' }], paginas: PAGINAS,
    imagens: [{ hash: 'h1', nome: 'a.jpg' }],
    aoMudar: (m, op) => { Object.assign(estado, m); if (!(op && op.semRedesenhar)) throw new Error('redesenhou'); },
    aoPasso: () => {}, aoIrPara: (c) => { mandouPara = c; }, aoMostrarFaltas: () => {},
    aoAbrirPublico: () => {}, aoEnviarImagem: () => {}, aoCriar: () => { criou = true },
  });

  const { corpo, rodape } = desenhar();
  // Escolhe a imagem e escreve o texto — sem NENHUM redesenho, como na tela real.
  estado.imagemHash = 'h1';
  const area = corpo.campos.find((c) => c.tag === 'textarea');
  area.value = 'Texto do anúncio';
  area.oninput();

  // O MESMO rodapé desenhado antes, agora clicado.
  const criar = rodape.botoes.find((b) => b.textContent === 'Criar campanha');
  criar.onclick();

  assert.equal(criou, true, 'o primeiro clique não criou — foi o defeito de 03/08')
  assert.equal(mandouPara, null, 'mandou de volta para um passo que já estava completo')
});

// ─────────────────────────────────────────────────────────────────────────────
// O PASSO "DE QUEM É O ANÚNCIO"
//
// Existe porque o assistente nascia amarrado ao cadastro da Fábrica: tirava
// página, Instagram e WhatsApp da marca da conta, e sem esse cadastro o botão
// não funcionava. Criar campanha do zero não tem nada a ver com a Fábrica.

test('o passo 2 lista as paginas da conta, com nome de gente', () => {
  const { corpo } = montar({ passo: 1 })
  assert.match(corpo.texto, /La Vessel Tivoli/)
  assert.match(corpo.texto, /La Vessel Hortolândia/)
  // NÃO mostra o número de 17 dígitos do Instagram: ninguém sabe isso de cor.
  assert.ok(!/17841405371693083/.test(corpo.texto))
})

test('escolher a pagina TRAZ o Instagram junto — sem segunda pergunta', () => {
  let mudou = null
  const { corpo } = montar({ passo: 1, aoMudar: (m) => { mudou = m } })
  const sel = corpo.campos.find((c) => c.tag === 'select')
  sel.value = '946991068499592'
  sel.onchange()
  assert.deepEqual(mudou, { pageId: '946991068499592', igId: '17841405371693083' })
})

test('pagina SEM Instagram avisa, em vez de deixar a pessoa descobrir depois', () => {
  const semIg = { ...estadoInicial(), pageId: '959648637231934' }
  const { corpo } = montar({ passo: 1, estado: semIg })
  assert.match(corpo.texto, /não tem perfil do Instagram ligado/)
  assert.match(corpo.texto, /só no Facebook/)
})

test('o perfil escolhido aparece pelo @, nao pelo numero', () => {
  const { corpo } = montar({ passo: 1, estado: cheio() })
  assert.match(corpo.texto, /@lavesseltivoli/)
})

test('o campo de WhatsApp so aparece quando o objetivo leva pra la', () => {
  const semWa = { chave: 'engajamento', destination_type: '', promoted_object_tipo: 'page' }
  const comWa = { chave: 'engajamento', destination_type: 'WHATSAPP', promoted_object_tipo: 'whatsapp' }
  assert.ok(!/WhatsApp que vai receber/.test(montar({ passo: 1, objetivoRow: semWa }).corpo.texto),
    'mostrou campo de WhatsApp num objetivo que não usa — campo sem uso faz duvidar')
  assert.match(montar({ passo: 1, objetivoRow: comWa }).corpo.texto, /WhatsApp que vai receber/)
})

test('digitar o numero NAO redesenha — senao o campo perde o foco', () => {
  // A mesma armadilha do nome e do texto do anúncio: redesenhar a cada letra
  // tira o cursor do campo no meio da digitação.
  let op = null
  const { corpo } = montar({
    passo: 1, objetivoRow: { destination_type: 'WHATSAPP' },
    aoMudar: (m, o) => { op = o },
  })
  const campo = corpo.campos.find((c) => c.type === 'tel')
  campo.value = '5519'
  campo.oninput()
  assert.equal(op && op.semRedesenhar, true)
})

test('sem pagina nenhuma, o passo diz isso em vez de mostrar lista vazia', () => {
  const { corpo } = montar({ passo: 1, paginas: [] })
  assert.match(corpo.texto, /Não consegui carregar as páginas/)
})
