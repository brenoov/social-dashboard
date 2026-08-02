import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  lerPosicionamentos, gravarPosicionamentos, resumoDosPosicionamentos, estreitou,
  montarSecaoPosicionamentos, CAMPOS_GERENCIADOS, PLATAFORMAS, POSICOES,
} from './posicionamentos.js'

// O conjunto real que a sonda leu em 2026-08-01 (uma das vagas de emprego).
// Serve de gabarito: é o formato que a Meta devolve de verdade nesta conta.
const REAL = {
  publisher_platforms: ['facebook', 'instagram', 'whatsapp'],
  facebook_positions: ['feed', 'instream_video', 'marketplace', 'story', 'search', 'facebook_reels', 'profile_feed', 'notification'],
  instagram_positions: ['stream', 'story', 'reels', 'explore_home', 'profile_feed'],
  whatsapp_positions: ['status'],
  device_platforms: ['mobile'],
  age_min: 18,
  geo_locations: { cities: [{ key: '267873' }] },
}

// ── Ler ─────────────────────────────────────────────────────────────────────

test('AUSENTE e AUTOMATICO — o estado de 44 dos 50 conjuntos', () => {
  // Ler ausente como "nada marcado" faria a tela mostrar tudo desmarcado e, ao
  // salvar, DESLIGAR a entrega de um conjunto que ninguém pediu pra mexer.
  const r = lerPosicionamentos({ age_min: 25 })
  assert.equal(r.automatico, true)
  assert.deepEqual(r.plataformas, [])
})

test('le o conjunto real da conta, com as tres plataformas', () => {
  const r = lerPosicionamentos(REAL)
  assert.equal(r.automatico, false)
  assert.deepEqual(r.plataformas, ['facebook', 'instagram', 'whatsapp'])
  assert.equal(r.posicoes.facebook.length, 8)
  assert.equal(r.posicoes.instagram.length, 5)
})

test('targeting torto nao estoura: vira automatico', () => {
  for (const ruim of [null, undefined, 'texto', 42, { publisher_platforms: 'facebook' }, { publisher_platforms: [] }]) {
    assert.equal(lerPosicionamentos(ruim).automatico, true, JSON.stringify(ruim))
  }
})

// ── Gravar ──────────────────────────────────────────────────────────────────

test('PRESERVA o que a tela nao desenha — a divida do geo_locations', () => {
  // whatsapp_positions e device_platforms existem na conta e esta tela não os
  // desenha. Montar o objeto do zero apagaria os dois.
  const t = gravarPosicionamentos(REAL, lerPosicionamentos(REAL))
  assert.deepEqual(t.whatsapp_positions, ['status'])
  assert.deepEqual(t.device_platforms, ['mobile'])
  assert.deepEqual(t.geo_locations, REAL.geo_locations)
  assert.equal(t.age_min, 18)
})

test('ida e volta sem mexer devolve os mesmos campos gerenciados', () => {
  const t = gravarPosicionamentos(REAL, lerPosicionamentos(REAL))
  for (const c of CAMPOS_GERENCIADOS) assert.deepEqual(t[c], REAL[c], c)
})

test('voltar para AUTOMATICO apaga os tres campos, e so eles', () => {
  const t = gravarPosicionamentos(REAL, { automatico: true })
  for (const c of CAMPOS_GERENCIADOS) assert.equal(c in t, false, c + ' devia ter sumido')
  assert.deepEqual(t.whatsapp_positions, ['status'], 'o que não é gerenciado FICA')
  assert.deepEqual(t.device_platforms, ['mobile'])
})

test('lista de plataformas VAZIA vira automatico — nunca "nenhuma"', () => {
  // Gravar publisher_platforms:[] desliga a entrega. Nenhuma tela pode produzir
  // isso por engano, então a decisão mora aqui e não lá.
  const t = gravarPosicionamentos(REAL, { automatico: false, plataformas: [], posicoes: {} })
  assert.equal('publisher_platforms' in t, false)
})

test('plataforma desmarcada leva as posicoes dela junto', () => {
  // Deixar facebook_positions para trás sem facebook em publisher_platforms é um
  // estado que a Meta não lê como nenhum dos dois.
  const t = gravarPosicionamentos(REAL, {
    automatico: false, plataformas: ['instagram'],
    posicoes: { facebook: ['feed'], instagram: ['story'] },
  })
  assert.deepEqual(t.publisher_platforms, ['instagram'])
  assert.equal('facebook_positions' in t, false)
  assert.deepEqual(t.instagram_positions, ['story'])
})

test('plataforma marcada SEM posicao escolhida = todas (campo ausente)', () => {
  const t = gravarPosicionamentos(REAL, {
    automatico: false, plataformas: ['facebook', 'instagram'], posicoes: { facebook: [], instagram: [] },
  })
  assert.deepEqual(t.publisher_platforms, ['facebook', 'instagram'])
  assert.equal('facebook_positions' in t, false, 'ausente = todas, e é como a Meta lê')
  assert.equal('instagram_positions' in t, false)
})

test('nao modifica o targeting original (sem efeito colateral)', () => {
  const copia = JSON.parse(JSON.stringify(REAL))
  gravarPosicionamentos(REAL, { automatico: true })
  assert.deepEqual(REAL, copia)
})

// ── O que a confirmação mostra ──────────────────────────────────────────────

test('sem mudanca, nenhuma linha', () => {
  const p = lerPosicionamentos(REAL)
  assert.deepEqual(resumoDosPosicionamentos(p, p), [])
  assert.deepEqual(resumoDosPosicionamentos({ automatico: true }, { automatico: true }), [])
})

test('sair do automatico e voltar aparecem com frases diferentes', () => {
  const manual = lerPosicionamentos(REAL)
  assert.match(resumoDosPosicionamentos({ automatico: true }, manual)[0], /automático → escolhido à mão/)
  assert.match(resumoDosPosicionamentos(manual, { automatico: true })[0], /escolhido à mão → automático/)
})

test('plataforma que sai e que entra, com nome de gente', () => {
  const antes = { automatico: false, plataformas: ['facebook', 'instagram'], posicoes: {} }
  const depois = { automatico: false, plataformas: ['instagram', 'whatsapp'], posicoes: {} }
  const l = resumoDosPosicionamentos(antes, depois)
  assert.ok(l.some((x) => /retiradas: Facebook/.test(x)))
  assert.ok(l.some((x) => /incluídas: WhatsApp/.test(x)))
})

test('posicao retirada aparece com o nome que a pessoa reconhece', () => {
  const antes = { automatico: false, plataformas: ['instagram'], posicoes: { instagram: ['stream', 'story', 'reels'] } }
  const depois = { automatico: false, plataformas: ['instagram'], posicoes: { instagram: ['stream'] } }
  const l = resumoDosPosicionamentos(antes, depois)
  assert.ok(l.some((x) => /Instagram — retiradas: Stories, Reels/.test(x)), l.join(' | '))
})

test('de TODAS para uma lista tem frase propria — nao apareceria na conta de entrou/saiu', () => {
  const antes = { automatico: false, plataformas: ['facebook'], posicoes: { facebook: [] } }
  const depois = { automatico: false, plataformas: ['facebook'], posicoes: { facebook: ['feed'] } }
  assert.ok(resumoDosPosicionamentos(antes, depois).some((x) => /de todas as posições para Feed/.test(x)))
  assert.ok(resumoDosPosicionamentos(depois, antes).some((x) => /para TODAS/.test(x)))
})

// ── O aviso vermelho ────────────────────────────────────────────────────────

test('sair do automatico SEMPRE estreita', () => {
  assert.equal(estreitou({ automatico: true }, lerPosicionamentos(REAL)), true)
})

test('voltar para o automatico nunca estreita', () => {
  assert.equal(estreitou(lerPosicionamentos(REAL), { automatico: true }), false)
})

test('tirar plataforma ou posicao estreita; acrescentar nao', () => {
  const base = { automatico: false, plataformas: ['facebook', 'instagram'], posicoes: { facebook: ['feed', 'story'], instagram: [] } }
  const menosPlat = { ...base, plataformas: ['facebook'] }
  const menosPos = { ...base, posicoes: { ...base.posicoes, facebook: ['feed'] } }
  const maisPos = { ...base, posicoes: { ...base.posicoes, facebook: ['feed', 'story', 'facebook_reels'] } }
  assert.equal(estreitou(base, menosPlat), true)
  assert.equal(estreitou(base, menosPos), true)
  assert.equal(estreitou(base, maisPos), false)
  assert.equal(estreitou(base, base), false)
})

test('de "todas" para uma lista estreita, mesmo sem tirar nada nominalmente', () => {
  const antes = { automatico: false, plataformas: ['instagram'], posicoes: { instagram: [] } }
  const depois = { automatico: false, plataformas: ['instagram'], posicoes: { instagram: ['stream'] } }
  assert.equal(estreitou(antes, depois), true)
  assert.equal(estreitou(depois, antes), false, 'o contrário amplia')
})

// ── O vocabulário ───────────────────────────────────────────────────────────

test('o vocabulario cobre o que a conta REALMENTE tem', () => {
  // Se a tela oferecesse menos do que a conta tem, marcar "tudo" já estreitaria.
  const chavesFb = POSICOES.facebook.map((p) => p.chave)
  for (const v of REAL.facebook_positions) assert.ok(chavesFb.includes(v), 'falta no vocabulário: ' + v)
  const chavesIg = POSICOES.instagram.map((p) => p.chave)
  for (const v of REAL.instagram_positions) assert.ok(chavesIg.includes(v), 'falta no vocabulário: ' + v)
  const plats = PLATAFORMAS.map((p) => p.chave)
  for (const v of REAL.publisher_platforms) assert.ok(plats.includes(v), 'falta plataforma: ' + v)
})

test('whatsapp esta no vocabulario — o valor que o criativo NAO conhecia', () => {
  assert.ok(PLATAFORMAS.some((p) => p.chave === 'whatsapp'))
})

// ── O aviso, já dentro do editor ────────────────────────────────────────────

test('conjunto ATIVO que estreita ganha aviso; pausado nao', async () => {
  const { avisosDe, lerPublico } = await import('./publico-alvo.js')
  const antes = lerPublico({ ...REAL, publisher_platforms: undefined })
  const depois = lerPublico(REAL)
  const tipo = (avisos) => avisos.map((x) => x.tipo)

  assert.ok(tipo(avisosDe(antes, depois, { ativo: true })).includes('posicionamento-estreitou'))
  assert.ok(!tipo(avisosDe(antes, depois, { ativo: false })).includes('posicionamento-estreitou'))
  // Ampliar (voltar pro automático) não avisa nem estando ativo.
  assert.ok(!tipo(avisosDe(depois, antes, { ativo: true })).includes('posicionamento-estreitou'))
})

test('o aviso NAO bloqueia — estreitar de proposito e uso legitimo', () => {
  // Foi o que os seis conjuntos de vaga de emprego fizeram. O que não pode é
  // acontecer sem ninguém ler.
  return import('./publico-alvo.js').then(({ avisosDe, lerPublico }) => {
    const a = avisosDe(lerPublico({}), lerPublico(REAL), { ativo: true })
      .find((x) => x.tipo === 'posicionamento-estreitou')
    assert.equal(a.bloqueia, false)
  })
})

test('mudanca de posicionamento aparece na janela de confirmacao', async () => {
  const { resumoDasMudancas, lerPublico } = await import('./publico-alvo.js')
  const linhas = resumoDasMudancas(lerPublico({}), lerPublico(REAL))
  assert.ok(linhas.some((l) => /automático → escolhido à mão/.test(l)), linhas.join(' | '))
})

test('salvar sem tocar em posicionamento devolve o targeting igual', async () => {
  const { montarTargeting, lerPublico } = await import('./publico-alvo.js')
  const { targeting } = montarTargeting(lerPublico(REAL), REAL)
  for (const c of [...CAMPOS_GERENCIADOS, 'whatsapp_positions', 'device_platforms']) {
    assert.deepEqual(targeting[c], REAL[c], c)
  }
})

// ── A seção da tela, com um document de mentira ─────────────────────────────

function docFalso() {
  const criar = (tag) => ({
    tag, filhos: [], style: { cssText: '' }, textContent: '', type: '', checked: false, onchange: null,
    appendChild(f) { this.filhos.push(f); return f },
    get texto() { return (this.textContent || '') + this.filhos.map((f) => f.texto).join(' ') },
    get caixas() { return this.filhos.flatMap((f) => (f.tag === 'input' ? [f] : f.caixas)) },
    // O rótulo de cada caixa: o <span> irmão dentro do mesmo <label>.
    get rotulados() {
      const meus = this.tag === 'label' && this.caixas.length ? [{ caixa: this.caixas[0], rotulo: this.texto.trim() }] : []
      return meus.concat(this.filhos.flatMap((f) => f.rotulados))
    },
  })
  return { createElement: criar }
}
const secao = (pos, aoMudar) => montarSecaoPosicionamentos({
  doc: docFalso(), pos, aoMudar,
  titulo: (t) => { const d = docFalso().createElement('div'); d.textContent = t; return d },
  ajuda: (t) => { const d = docFalso().createElement('div'); d.textContent = t; return d },
  linha: () => docFalso().createElement('div'),
})

test('no automatico mostra UMA caixa so — nada de lista de plataformas', () => {
  const el = secao({ automatico: true })
  assert.equal(el.caixas.length, 1)
  assert.equal(el.caixas[0].checked, true)
  assert.match(el.texto, /A Meta está escolhendo sozinha/)
})

test('sair do automatico comeca com TODAS as plataformas — o 1o clique nao estreita', () => {
  // Começar vazio faria o primeiro clique desligar a entrega sem ninguém pedir.
  let novo = null
  const auto = secao({ automatico: true }, (n) => { novo = n }).caixas[0]
  // O navegador vira o `checked` ANTES de disparar o evento — o de mentira
  // também tem de virar, senão o teste conta uma história que o mouse não conta.
  auto.checked = false
  auto.onchange()
  assert.equal(novo.automatico, false)
  assert.deepEqual(novo.plataformas, PLATAFORMAS.map((p) => p.chave))
  assert.deepEqual(novo.posicoes, {})
})

test('no manual, plataforma marcada mostra as posicoes dela; desmarcada nao', () => {
  const so = secao({ automatico: false, plataformas: ['instagram'], posicoes: {} })
  const rot = so.rotulados.map((r) => r.rotulo)
  assert.ok(rot.includes('Instagram'))
  assert.ok(rot.includes('Explorar'), 'posição do Instagram tem de aparecer')
  assert.ok(!rot.includes('Marketplace'), 'posição do Facebook não, que está desmarcado')
})

test('sem posicao escolhida, TODAS aparecem marcadas — e e o que vale', () => {
  const el = secao({ automatico: false, plataformas: ['instagram'], posicoes: { instagram: [] } })
  const posIg = el.rotulados.filter((r) => POSICOES.instagram.some((p) => p.rotulo === r.rotulo))
  assert.equal(posIg.length, 7)
  for (const r of posIg) assert.equal(r.caixa.checked, true, r.rotulo + ' devia estar marcada')
})

test('desmarcar UMA posicao transforma "todas" na lista sem ela', () => {
  let novo = null
  const el = secao({ automatico: false, plataformas: ['instagram'], posicoes: { instagram: [] } }, (n) => { novo = n })
  const explorar = el.rotulados.find((r) => r.rotulo === 'Explorar')
  explorar.caixa.checked = false
  explorar.caixa.onchange()
  assert.equal(novo.posicoes.instagram.length, 6)
  assert.ok(!novo.posicoes.instagram.includes('explore'))
})

test('remarcar tudo VOLTA a ser "todas" (lista vazia), nao a lista cheia', () => {
  // Gravar a lista inteira à mão faria a Meta tratar como escolha fixa, que
  // envelhece quando ela criar uma posição nova.
  let novo = null
  const el = secao({ automatico: false, plataformas: ['facebook'], posicoes: { facebook: ['feed', 'story', 'facebook_reels', 'profile_feed', 'marketplace', 'instream_video', 'search'] } }, (n) => { novo = n })
  const falta = el.rotulados.find((r) => r.rotulo === 'Notificações')
  falta.caixa.checked = true
  falta.caixa.onchange()
  assert.deepEqual(novo.posicoes.facebook, [])
})

test('desmarcar plataforma leva as posicoes dela junto no estado', () => {
  let novo = null
  const el = secao({ automatico: false, plataformas: ['facebook', 'instagram'], posicoes: { facebook: ['feed'], instagram: ['story'] } }, (n) => { novo = n })
  const fb = el.rotulados.find((r) => r.rotulo === 'Facebook')
  fb.caixa.checked = false
  fb.caixa.onchange()
  assert.deepEqual(novo.plataformas, ['instagram'])
  assert.equal('facebook' in novo.posicoes, false)
})

test('WhatsApp entra como plataforma inteira, sem caixinha de posicao inventada', () => {
  // A conta não tem posição editável nele; inventar caixinha para o que não se
  // mediu é como se estreita entrega sem querer.
  const el = secao({ automatico: false, plataformas: ['whatsapp'], posicoes: {} })
  assert.ok(el.rotulados.some((r) => r.rotulo === 'WhatsApp'))
  assert.equal(el.rotulados.length, 1 + PLATAFORMAS.length, 'só o automático + as plataformas')
})

test('sem document devolve null em vez de estourar', () => {
  assert.equal(montarSecaoPosicionamentos({ doc: null }), null)
  assert.equal(montarSecaoPosicionamentos(), null)
})
