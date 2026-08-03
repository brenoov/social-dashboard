import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PASSOS, estadoInicial, faltaNoPasso, podeAvancar, primeiroPassoIncompleto,
  imagemServe, resumoDoQueVaiSerCriado, payloadsDoAssistente, publicoParaFabrica,
  LADO_MINIMO_PX, ORCAMENTO_MINIMO_CENTAVOS, horarioDeTermino, pedeWhatsapp,
  numerosJaUsados, numerosParaPagina,
} from './criar-campanha.js'

const cheio = () => ({
  ...estadoInicial(),
  objetivo: 'engajamento', nome: 'Bolsas — Campinas',
  pageId: '324679337390168', igId: '17841462952561833', whatsapp: '5519999999999',
  publico: { cidades: [{ key: '267873', nome: 'Campinas', raio: 20, unidade: 'kilometer' }], idadeMin: 25, idadeMax: 45, interesses: [{ id: '6003', name: 'Bolsas' }] },
  imagemHash: 'abc123', texto: 'Bolsas com 30% OFF',
})

test('sao cinco passos, na ordem da decisao', () => {
  // "de quem é" entra em SEGUNDO, logo depois do objetivo: é o objetivo que
  // decide se o número de WhatsApp vai ser pedido.
  assert.deepEqual(PASSOS.map((p) => p.chave), ['objetivo', 'identidade', 'orcamento', 'publico', 'anuncio'])
})

test('o estado novo nao avanca em nada — e diz o que falta, em portugues', () => {
  const e = estadoInicial()
  assert.match(faltaNoPasso('objetivo', e)[0], /Escolha o que você quer/)
  assert.match(faltaNoPasso('anuncio', e)[0], /Escolha uma imagem/)
  assert.equal(podeAvancar('objetivo', e), false)
})

test('nome vazio segura o passo 1 — sem nome ninguem acha a campanha depois', () => {
  const e = { ...estadoInicial(), objetivo: 'engajamento' }
  assert.equal(podeAvancar('objetivo', e), false)
  assert.ok(faltaNoPasso('objetivo', e).some((f) => /nome/i.test(f)))
})

test('orcamento abaixo do minimo e barrado ANTES de a Meta recusar', () => {
  const e = { ...cheio(), orcamentoCentavos: ORCAMENTO_MINIMO_CENTAVOS - 1 }
  assert.match(faltaNoPasso('orcamento', e)[0], /não aceita menos de/)
  assert.equal(podeAvancar('orcamento', { ...cheio(), orcamentoCentavos: ORCAMENTO_MINIMO_CENTAVOS }), true)
})

test('sem lugar nao avanca — e a Meta EXIGE lugar', () => {
  const e = { ...cheio(), publico: { cidades: [] } }
  assert.match(faltaNoPasso('publico', e)[0], /pelo menos uma cidade ou região/)
  // Região ou país também servem: o editor gerencia cidade, mas o conjunto pode
  // ter outras localidades que ele preserva sem desenhar.
  assert.equal(podeAvancar('publico', { ...cheio(), publico: { cidades: [], outrasLocalizacoes: [{ tipo: 'pais' }] } }), true)
})

test('primeiroPassoIncompleto aponta ONDE parar, nao so que falta algo', () => {
  assert.equal(primeiroPassoIncompleto(estadoInicial()), 'objetivo')
  assert.equal(primeiroPassoIncompleto({ ...cheio(), imagemHash: '' }), 'anuncio')
  assert.equal(primeiroPassoIncompleto(cheio()), null)
})

// ── A imagem, conferida ANTES de subir ──────────────────────────────────────

test('imagem pequena e barrada no navegador, antes do envio', () => {
  // Medido: um PNG de 95 bytes voltou 100/2446496 da Meta. Descobrir isso depois
  // de esperar o upload é o pior momento possível.
  const r = imagemServe({ bytes: 95, largura: 8, altura: 8 })
  assert.equal(r.ok, false)
  assert.equal(r.problemas.length, 2)
  assert.match(r.problemas[1], new RegExp(`${LADO_MINIMO_PX}×${LADO_MINIMO_PX}`))
})

test('imagem boa passa', () => {
  assert.equal(imagemServe({ bytes: 104223, largura: 600, altura: 600 }).ok, true)
})

test('o que nao se sabe NAO vira acusacao', () => {
  // Nem todo navegador entrega dimensão de todo formato. Faltar dado não pode
  // barrar uma imagem que talvez esteja boa.
  assert.equal(imagemServe({}).ok, true)
  assert.equal(imagemServe({ bytes: 500000 }).ok, true)
})

// ── O resumo da confirmação ────────────────────────────────────────────────

test('o resumo lista o que vai ser criado, com nome de gente', () => {
  const l = resumoDoQueVaiSerCriado(cheio(), 'Conversas no WhatsApp')
  assert.match(l[0], /"Bolsas — Campinas" — Conversas no WhatsApp/)
  assert.ok(l.some((x) => /1 conjunto com R\$\s?50,00 por dia/.test(x)))
  assert.ok(l.some((x) => /Em Campinas/.test(x)))
  assert.ok(l.some((x) => /Idade 25–45/.test(x)))
  assert.ok(l.some((x) => /Interesses: Bolsas/.test(x)))
})

// ── A tradução entre o editor e a Fábrica ──────────────────────────────────

test('traduz a cidade do editor para a forma da Fabrica', () => {
  const f = publicoParaFabrica(cheio().publico)
  assert.deepEqual(f.geo.cities, [{ key: '267873', radius: 20, distance_unit: 'kilometer' }])
  assert.deepEqual(f.interesses, [{ id: '6003', name: 'Bolsas' }])
})

test('cidade inteira (raio 0) vai SEM radius — nao inventa um raio', () => {
  const f = publicoParaFabrica({ cidades: [{ key: '1', raio: 0 }] })
  assert.deepEqual(f.geo.cities, [{ key: '1' }])
})

// ── O payload final ────────────────────────────────────────────────────────

const ROW = { chave: 'engajamento', rotulo: 'Conversas', meta_objective: 'OUTCOME_ENGAGEMENT', optimization_goal: 'CONVERSATIONS', billing_event: 'IMPRESSIONS', destination_type: 'WHATSAPP', promoted_object_tipo: 'page' }
const MARCA = { nome: 'La Vessel', pageId: '324679337390168', igId: '17841462952561833' }
const LOJA = { nome: 'Tivoli', geoCities: ['267873'], whatsapp: '5519999999999' }

test('o payload sai do montador COMPARTILHADO, com os campos que a Meta exige', () => {
  // Os dois campos abaixo foram justamente os que faltaram nas recusas 4834011 e
  // 1870227 quando eu escrevi payload próprio. Vêm de graça ao reusar.
  const { campaign, adset } = payloadsDoAssistente({ estado: cheio(), objetivoRow: ROW, nomeDaConta: 'Vessel' })
  assert.equal(campaign.objective, 'OUTCOME_ENGAGEMENT')
  assert.equal(campaign.status, 'PAUSED')
  assert.equal(campaign.is_adset_budget_sharing_enabled, false)
  assert.equal(adset.status, 'PAUSED')
  assert.equal(adset.destination_type, 'WHATSAPP')
  assert.ok(adset.targeting)
})

test('o nome DIGITADO manda sobre o nome automatico', () => {
  const { campaign, adset } = payloadsDoAssistente({ estado: cheio(), objetivoRow: ROW, nomeDaConta: 'Vessel' })
  assert.equal(campaign.name, 'Bolsas — Campinas')
  assert.match(adset.name, /^Bolsas — Campinas · conjunto$/)
})

test('tudo nasce PAUSED — a promessa que garante que nada gasta', () => {
  const { campaign, adset } = payloadsDoAssistente({ estado: cheio(), objetivoRow: ROW, nomeDaConta: 'Vessel' })
  assert.equal(campaign.status, 'PAUSED')
  assert.equal(adset.status, 'PAUSED')
})

test('sem objetivo, marca ou loja nao monta payload nenhum', () => {
  assert.equal(payloadsDoAssistente({ estado: cheio(), objetivoRow: null }), null)
  // SEM PÁGINA não monta: a página é o que assina o anúncio, e a Meta recusa
  // criativo sem ela. Antes o bloqueio era "sem marca cadastrada", que exigia
  // cadastro da Fábrica para criar campanha numa conta qualquer.
  assert.equal(payloadsDoAssistente({ estado: { ...cheio(), pageId: '' }, objetivoRow: ROW }), null)
})

// ─────────────────────────────────────────────────────────────────────────────
// ORÇAMENTO TOTAL NÃO PODE VIRAR ORÇAMENTO DIÁRIO.
//
// O DEFEITO REAL (achado antes de subir, 2026-08-03): `payloadsDoAssistente`
// montava `{ tipo: 'lifetime', valorCentavos }`, mas `normalizarOrcamento` só
// conhece `'total'` e `valor` — os dois nomes errados caíam no padrão em
// silêncio. Quem escolhesse "Total R$ 500" criava um conjunto de R$ 500 POR DIA.
//
// Nenhum erro, nenhum aviso: a Meta aceita, a campanha nasce pausada e correta
// aos olhos, e a diferença só aparece na fatura. É o formato de falha mais caro
// que esta tela pode ter, porque é o único em que ela mexe em dinheiro.
test('orçamento TOTAL vira lifetime_budget, e nunca daily_budget', () => {
  const e = {
    ...estadoInicial(), objetivo: 'conversao', nome: 'X', pageId: '324679337390168',
    orcamentoCentavos: 50000, tipoOrcamento: 'total', terminaEm: '2026-09-30',
  };
  const { adset } = payloadsDoAssistente({ estado: e, objetivoRow: ROW, nomeDaConta: 'Vessel' });
  assert.equal(adset.daily_budget, undefined, 'total NÃO pode virar orçamento diário');
  assert.equal(adset.lifetime_budget, 50000);
  // A data vira o FIM do dia escolhido: quem marca 30 quer o dia 30 inteiro.
  assert.equal(adset.end_time, '2026-09-30T23:59:59');
});

test('orçamento POR DIA continua daily_budget, sem data nenhuma', () => {
  const e = { ...estadoInicial(), objetivo: 'conversao', nome: 'X', pageId: '324679337390168', orcamentoCentavos: 8000 };
  const { adset } = payloadsDoAssistente({ estado: e, objetivoRow: ROW, nomeDaConta: 'Vessel' });
  assert.equal(adset.daily_budget, 8000);
  assert.equal(adset.lifetime_budget, undefined);
  assert.equal(adset.end_time, undefined);
});

test('total SEM data de término não deixa avançar', () => {
  const e = { ...estadoInicial(), orcamentoCentavos: 50000, tipoOrcamento: 'total' };
  const faltas = faltaNoPasso('orcamento', e);
  assert.equal(faltas.length, 1);
  assert.match(faltas[0], /término/);
  assert.ok(podeAvancar('orcamento', { ...e, terminaEm: '2026-09-30' }));
});

test('data mal formada não vira end_time inventado', () => {
  assert.equal(horarioDeTermino('30/09/2026'), '');
  assert.equal(horarioDeTermino(''), '');
  assert.equal(horarioDeTermino('2026-09-30'), '2026-09-30T23:59:59');
});

// ─────────────────────────────────────────────────────────────────────────────
// DE QUEM É O ANÚNCIO — escolhido na tela, não herdado do cadastro.
//
// O DEFEITO DE DESENHO (apontado pelo dono, 03/08/2026): o assistente exigia
// que a conta tivesse uma loja cadastrada na Fábrica, e tirava dela a página, o
// Instagram e o WhatsApp. Só que criar campanha do zero não tem nada a ver com
// a Fábrica — em conta sem cadastro o botão simplesmente não funcionava, e
// mesmo com cadastro não dava para usar OUTRA página.
test('sem pagina escolhida, o passo de identidade nao avanca', () => {
  const faltas = faltaNoPasso('identidade', estadoInicial(), ROW)
  assert.ok(faltas.some((f) => /página do Facebook/.test(f)))
})

test('o WhatsApp so e cobrado quando o objetivo leva pra la', () => {
  const semWa = { chave: 'trafego', destination_type: '', promoted_object_tipo: 'page' }
  const comWa = { chave: 'conversao', destination_type: 'WHATSAPP', promoted_object_tipo: 'whatsapp' }
  assert.equal(pedeWhatsapp(semWa), false)
  assert.equal(pedeWhatsapp(comWa), true)
  // As DUAS evidências contam, e sozinhas: um objetivo pode declarar uma e não a outra.
  assert.equal(pedeWhatsapp({ promoted_object_tipo: 'whatsapp' }), true)
  assert.equal(pedeWhatsapp({ destination_type: 'WHATSAPP_MESSENGER' }), true)

  const estado = { ...estadoInicial(), pageId: '123' }
  assert.equal(podeAvancar('identidade', estado, semWa), true, 'cobrou WhatsApp num objetivo que não usa')
  assert.equal(podeAvancar('identidade', estado, comWa), false)
  assert.ok(faltaNoPasso('identidade', estado, comWa)[0].includes('DDI'))
})

test('numero curto demais e recusado — link morto gasta e nao conversa', () => {
  const comWa = { destination_type: 'WHATSAPP' }
  const curto = { ...estadoInicial(), pageId: '123', whatsapp: '99999' }
  assert.equal(podeAvancar('identidade', curto, comWa), false)
  // Aceita o que a pessoa digitar com pontuação: 55 (19) 99999-9999 são 13 dígitos.
  assert.equal(podeAvancar('identidade', { ...curto, whatsapp: '55 (19) 99999-9999' }, comWa), true)
})

test('a pagina e o Instagram escolhidos vao PRO PAYLOAD, e nao um cadastro', () => {
  const e = { ...cheio(), pageId: '999', igId: '888', whatsapp: '5511988887777' }
  const { adset } = payloadsDoAssistente({ estado: e, objetivoRow: ROW, nomeDaConta: 'Qualquer conta' })
  assert.deepEqual(adset.promoted_object, { page_id: '999' }, 'usou a página do cadastro em vez da escolhida')
})

test('objetivo de WhatsApp leva o numero DIGITADO pro promoted_object', () => {
  const row = { ...ROW, promoted_object_tipo: 'whatsapp', destination_type: 'WHATSAPP' }
  const e = { ...cheio(), pageId: '999', whatsapp: '55 11 98888-7777' }
  const { adset } = payloadsDoAssistente({ estado: e, objetivoRow: row, nomeDaConta: 'X' })
  assert.equal(adset.promoted_object.page_id, '999')
  assert.equal(adset.promoted_object.whatsapp_phone_number, '55 11 98888-7777')
})

test('a confirmacao diz QUAL pagina assina — e avisa quando nao ha Instagram', () => {
  const linhas = resumoDoQueVaiSerCriado(cheio(), 'Engajamento', { pagina: 'La Vessel', instagram: 'vessel.brasil' })
  assert.ok(linhas.some((l) => /La Vessel/.test(l) && /vessel\.brasil/.test(l)))

  const semIg = resumoDoQueVaiSerCriado(cheio(), 'Engajamento', { pagina: 'La Vessel Hortolândia' })
  assert.ok(semIg.some((l) => /sem Instagram ligado/.test(l)))
})

// ─────────────────────────────────────────────────────────────────────────────
// OS NÚMEROS DE WHATSAPP QUE A META JÁ ACEITOU
//
// DESCOBERTO DO JEITO CARO (03/08/2026): criei uma campanha com um número
// inventado e a Meta recusou o CONJUNTO depois de a campanha já existir —
// "This WhatsApp phone number is not linked to your account". Não há endpoint
// que liste os números permitidos; o que há é a prova pelo uso, no
// `promoted_object` dos conjuntos que já rodam.
const CONJUNTOS = [
  { promoted_object: { page_id: '324679337390168', whatsapp_phone_number: '5519971092194' } },
  { promoted_object: { page_id: '1015508584968115', whatsapp_phone_number: '5519971124217' } },
  { promoted_object: { page_id: '1015508584968115', whatsapp_phone_number: '5519971124217' } }, // repetido
  { promoted_object: { page_id: '324679337390168' } },                                          // sem número
  { },                                                                                          // sem nada
]

test('colhe os numeros dos conjuntos que existem, sem repetir', () => {
  assert.deepEqual(numerosJaUsados(CONJUNTOS), [
    { pageId: '324679337390168', numero: '5519971092194' },
    { pageId: '1015508584968115', numero: '5519971124217' },
  ])
  assert.deepEqual(numerosJaUsados(null), [])
})

test('mostra os numeros DA PAGINA escolhida', () => {
  const n = numerosParaPagina(numerosJaUsados(CONJUNTOS), '1015508584968115')
  assert.deepEqual(n.map((x) => x.numero), ['5519971124217'])
})

test('pagina sem numero conhecido mostra os da conta, em vez de lista vazia', () => {
  // Palpite útil vale mais que nada: a pessoa vê de qual página cada um é.
  const n = numerosParaPagina(numerosJaUsados(CONJUNTOS), '999999')
  assert.equal(n.length, 2)
})
