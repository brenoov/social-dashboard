import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { traduzirCodigoDoPcsc, codigoDoPcsc } from './ponte-do-powershell.js';

/* ⚠️ O SERVIÇO DE CARTÃO INTELIGENTE DO WINDOWS PARANDO NO MEIO DO EXPEDIENTE.
 *
 * Aconteceu em 06/09/2026: tentaram resetar uma etiqueta, não resetou; tentaram
 * sobrescrever, não deu; e só depois apareceu a mensagem de que o serviço não
 * estava ativo. "Erro em cima de erro", nas palavras do dono.
 *
 * A causa: na ponte com o PowerShell, a primeira chamada de `SCardListReaders`
 * tinha o retorno DESCARTADO (`[void]`). Com o serviço parado ela falha, o
 * tamanho fica 0 e a ponte respondia OK COM LISTA VAZIA — e o programa
 * concluía "não achei nenhum leitor, confira o cabo USB e tente outra porta".
 * Conselho errado: o cabo estava bom.
 *
 * Falha não pode virar lista vazia. */

const PONTE = readFileSync(new URL('./ponte-do-powershell.js', import.meta.url), 'utf8');

test('⚠️ a primeira chamada de SCardListReaders NAO descarta o retorno', () => {
  assert.ok(!/\[void\]\[PcscPonte\]::SCardListReaders/.test(PONTE),
    'voltou o `[void]`: falha do servico vira lista vazia de novo');
  assert.match(PONTE, /\$r0 = \[PcscPonte\]::SCardListReaders/,
    'o retorno tem de ser guardado para poder ser conferido');
});

test('⚠️ codigo diferente de zero vira ERRO, e nao lista vazia', () => {
  assert.match(PONTE, /if \(\$r0 -ne 0\) \{ Responder \$n 'ERRO'/,
    'sem isto o programa segue como se nao houvesse leitor');
});

test('lista vazia DE VERDADE (retorno zero, tamanho zero) continua sendo lista vazia', () => {
  // Zero leitores com o servico bom e um estado legitimo — nao pode virar erro.
  assert.match(PONTE, /elseif \(\$tam -le 0\) \{ Responder \$n 'OK' ''/);
});

test('o serviço parado tem mensagem PROPRIA, e diz o que fazer', () => {
  for (const codigo of ['0x8010001D', '0x8010001E']) {
    const frase = traduzirCodigoDoPcsc(codigo);
    assert.match(frase, /Cartão Inteligente/, `${codigo} sem mensagem propria`);
    assert.match(frase, /Serviços/, `${codigo} nao diz onde religar`);
    assert.ok(!/USB|cabo|porta/i.test(frase),
      `${codigo} manda mexer no cabo — e o cabo nao e o problema`);
  }
});

test('⚠️ "nenhum leitor" e "serviço parado" NAO podem dar a mesma frase', () => {
  /* Foi essa confusao que fez a pessoa trocar de porta USB com o servico
   * parado. As duas causas pedem acoes diferentes. */
  assert.notEqual(traduzirCodigoDoPcsc('0x8010002E'), traduzirCodigoDoPcsc('0x8010001D'));
  assert.match(traduzirCodigoDoPcsc('0x8010002E'), /USB/, 'sem leitor: aí sim é cabo');
});

test('codigoDoPcsc acha o codigo no meio do texto do PowerShell', () => {
  assert.equal(codigoDoPcsc('SCardListReaders 0x8010001D'), '0X8010001D');
  assert.equal(codigoDoPcsc('sem codigo nenhum'), '');
});
