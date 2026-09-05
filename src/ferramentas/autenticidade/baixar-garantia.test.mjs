import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const TELA = readFileSync(new URL('./tela-de-autenticidade.vue', import.meta.url), 'utf8')
const script = TELA.slice(TELA.indexOf('<script'))

test('⚠️ TROCAR DE DONO e ENCERRAR GARANTIA sao acoes DIFERENTES e visiveis', () => {
  /* Bolsa que mudou de mao TROCA de dono e a garantia segue; bolsa que VOLTOU
   * tem a garantia encerrada. Quem confunde as duas apaga a garantia de uma
   * cliente que continua com a bolsa. Por isso os rotulos dizem o que ACONTECE. */
  assert.match(TELA, /Trocar de dono/)
  assert.match(TELA, /Encerrar garantia \(devolução\)/,
    'o rotulo tem de dizer que e devolucao, e nao "editar" ou "excluir"')
})

test('⚠️ a baixa exige MOTIVO e SENHA — as duas', () => {
  // Isto apaga o vinculo de uma pessoa de verdade com a bolsa dela.
  const bloco = TELA.slice(TELA.indexOf('v-if="baixandoGarantia === r.codigo"'))
  const ate = bloco.slice(0, bloco.indexOf('</div>\n'))
  assert.match(bloco, /motivoDaBaixaDeGarantia/, 'sem campo de motivo')
  assert.match(bloco, /senhaDaBaixa/, 'sem campo de senha')
  assert.match(bloco, /:disabled="baixaDeGarantiaEmVoo \|\| !senhaDaBaixa \|\| !motivoDaBaixaDeGarantia\.trim\(\)"/,
    'o botao tem de nascer travado sem motivo e sem senha')
})

test('a TELA cobra o motivo ANTES do banco', () => {
  /* Sem isto a pessoa digita a senha, espera a rede, e descobre que faltava um
   * campo que estava na tela o tempo todo. */
  const corpo = script.slice(script.indexOf('async function confirmarBaixaDeGarantia'))
  const ate = corpo.slice(0, corpo.indexOf('vessel_baixar_garantia'))
  assert.match(ate, /if \(!motivo\)/, 'o motivo tem de ser conferido antes da chamada')
  assert.match(ate, /conferirASenha/, 'a senha e conferida no servidor antes de apagar')
})

test('⚠️ a pergunta NASCE LIMPA — motivo e senha nao sobrevivem', () => {
  /* Motivo da vez anterior sobrando seria a baixa seguinte acontecendo com a
   * justificativa da anterior, e ninguem veria. */
  const abrir = script.slice(script.indexOf('function abrirBaixaDeGarantia'))
  const ate = abrir.slice(0, abrir.indexOf('\n}'))
  assert.match(ate, /motivoDaBaixaDeGarantia\.value = ''/)
  assert.match(ate, /senhaDaBaixa\.value = ''/)
  assert.match(ate, /trocando\.value = null/, 'as duas perguntas nunca ficam abertas juntas')
})

test('as duas perguntas nao aparecem ao mesmo tempo', () => {
  assert.match(TELA, /trocando !== r\.codigo && baixandoGarantia !== r\.codigo/,
    'os botoes somem enquanto qualquer uma das perguntas esta aberta')
})

test('⚠️ NOMES PROPRIOS: a baixa de GARANTIA nao reusa o estado da baixa de PECA', () => {
  /* `baixaEmVoo` e `motivoDaBaixa` ja existiam para dar baixa numa PECA. Reusar
   * faria as duas perguntas se atrapalharem — e o build reprova com nome
   * duplicado, que foi como isto apareceu. Sao fluxos diferentes: um tira a peca
   * de circulacao, o outro encerra a garantia de uma cliente. */
  for (const n of ['baixaEmVoo', 'motivoDaBaixa', 'baixaDeGarantiaEmVoo',
                   'motivoDaBaixaDeGarantia', 'baixandoGarantia']) {
    const quantas = (script.match(new RegExp('const ' + n + ' *=', 'g')) || []).length
    assert.equal(quantas, 1, `${n} declarado ${quantas} vezes`)
  }
})
