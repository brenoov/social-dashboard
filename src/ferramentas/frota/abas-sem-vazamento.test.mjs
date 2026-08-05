import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

/* A tela da Frota tem quatro áreas que se alternam por `area === '...'`. Um
 * `v-else` SOLTO no fim dessa corrente vaza: ele vira "qualquer outra aba".
 *
 * Aconteceu de verdade — a lista de carros da Gestão estava com `v-else` e
 * aparecia também em Revisões e em Plano de manutenção. O dono relatou duas
 * vezes; na primeira eu respondi que era cache, e estava errado.
 *
 * Este teste lê o template e exige que todo bloco de área diga QUAL área é. */
const TELA = readFileSync(new URL('./tela-de-frota.vue', import.meta.url), 'utf8')
const TEMPLATE = TELA.slice(TELA.indexOf('<template>'), TELA.indexOf('</template>\n\n<style'))

test('nenhum bloco de área usa v-else solto', () => {
  // Só olha o primeiro nível de indentação do template (4 espaços): é onde as
  // áreas se alternam. Dentro dos cartões, v-else é legítimo e comum.
  const soltos = TEMPLATE.split('\n')
    .map((l, i) => ({ l, n: i + 1 }))
    .filter(({ l }) => /^ {4}<[a-z-]+[^>]*\sv-else(\s|>)/.test(l))
  assert.deepEqual(soltos.map((x) => x.l.trim().slice(0, 60)), [],
    'bloco de primeiro nível com v-else solto: ele vira "qualquer outra aba" e vaza entre elas')
})

test('cada área tem um bloco que a nomeia', () => {
  for (const area of ['motorista', 'gestao', 'revisoes', 'plano']) {
    assert.ok(TEMPLATE.includes(`area === '${area}'`),
      `nenhum bloco do template menciona a área "${area}" — ela abriria vazia ou herdaria outra`)
  }
})
