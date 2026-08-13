// O painel da régua PRECISA montar sem estourar.
//
// POR QUE ESTE ARQUIVO EXISTE (13/08/2026): a aba "A régua" ficou COMPLETAMENTE
// quebrada por um dia inteiro e ninguém viu. Ao clicar nela, o navegador dava
//
//     ReferenceError: Cannot access 'campo' before initialization
//
// e a aba não pintava nada. A causa: `montarPainelRegua` usa o ajudante
// `campo(...)` do módulo lá em cima (para desenhar os pesos), e lá embaixo, na
// parte da persona, declarava `const campo = document.getElementById(...)`. Um
// `const` vale para a FUNÇÃO INTEIRA, inclusive antes da linha onde aparece —
// então o uso de cima passou a apontar para o `const` de baixo, que ainda não
// existia. Zona morta.
//
// Isso entrou junto com a persona (commit ebf162d, 12/08) e passou porque este
// arquivo não tinha teste NENHUM: `npm test` ficava verde, o build ficava verde,
// e a tela estava morta. É o mesmo buraco que o B4b das pendências apontava —
// "subiu sem ninguém ver na tela".
//
// A guarda é grosseira de propósito: montar o painel e conferir que ele monta.
// Qualquer sombra de variável, qualquer erro em tempo de execução no caminho de
// montagem, cai aqui antes de chegar ao dono.

import test from 'node:test';
import assert from 'node:assert/strict';
import { montarPainelRegua } from './painel-regua.js';
import { normalizarRegua } from './regua.js';

// DOM de mentira, o mínimo que o painel encosta. `getElementById` devolvendo
// null é o cenário mais duro: todos os `if (x && ...)` do painel têm que
// aguentar. Se o painel passar a exigir um elemento de verdade, é aqui que se
// descobre.
function comDomFalso(rodar) {
  const antes = globalThis.document;
  globalThis.document = { getElementById: () => null };
  try {
    return rodar();
  } finally {
    if (antes === undefined) delete globalThis.document;
    else globalThis.document = antes;
  }
}

function alvoFalso() {
  return { innerHTML: '', querySelectorAll: () => [] };
}

const OPCOES_BASE = {
  regua: normalizarRegua({}),
  editavel: true,
  carregouOk: true,
  nomeConta: 'Mantova Móveis',
  // Sem `contaId` o bloco da persona vira o convite "escolha uma conta lá em
  // cima" — é o estado legítimo de quem abriu a aba antes de escolher conta, e
  // não serve para testar o editor.
  contaId: 'de592c37-9a0e-40a3-98c3-2b44a5db57ac',
};

test('monta o painel sem estourar — a zona morta do `campo` cai aqui', () => {
  comDomFalso(() => {
    const alvo = alvoFalso();
    // Se alguém voltar a sombrear um ajudante do módulo, isto lança.
    assert.doesNotThrow(() => montarPainelRegua(alvo, OPCOES_BASE));
    assert.ok(alvo.innerHTML.length > 0, 'o painel tem que pintar alguma coisa');
  });
});

test('os campos de peso saem desenhados — era o uso que estourava', () => {
  comDomFalso(() => {
    const alvo = alvoFalso();
    montarPainelRegua(alvo, OPCOES_BASE);
    for (const k of ['curtidas', 'comentarios', 'salvamentos', 'compartilhamentos']) {
      assert.ok(alvo.innerHTML.includes('pnd-peso-' + k), `faltou o campo do peso "${k}"`);
    }
  });
});

test('o bloco da persona aparece quando há conta escolhida', () => {
  comDomFalso(() => {
    const alvo = alvoFalso();
    montarPainelRegua(alvo, { ...OPCOES_BASE, persona: 'Quem a marca atende.', personaEditavel: true });
    assert.ok(alvo.innerHTML.includes('id="pnd-persona"'), 'faltou o campo da persona');
    assert.ok(alvo.innerHTML.includes('pnd-persona-salvar'), 'faltou o botão de salvar a persona');
  });
});

test('quem NÃO é administrador vê a persona sem botão de salvar', () => {
  comDomFalso(() => {
    const alvo = alvoFalso();
    montarPainelRegua(alvo, { ...OPCOES_BASE, persona: 'Texto.', personaEditavel: false });
    assert.ok(alvo.innerHTML.includes('id="pnd-persona"'), 'o campo continua à vista');
    assert.ok(!alvo.innerHTML.includes('pnd-persona-salvar'), 'não pode oferecer salvar a quem não pode');
  });
});

test('o botão de trazer de um arquivo aceita Word, PDF e texto', () => {
  comDomFalso(() => {
    const alvo = alvoFalso();
    montarPainelRegua(alvo, { ...OPCOES_BASE, persona: '', personaEditavel: true });
    // O dono pediu upload "como pdf, word, enfim" (12/08). Se alguém tirar um
    // formato da lista sem querer, o caminho some da tela sem aviso.
    assert.ok(alvo.innerHTML.includes('pnd-persona-upload'), 'faltou o campo de arquivo');
    for (const ext of ['.docx', '.pdf', '.txt', '.md']) {
      assert.ok(alvo.innerHTML.includes(ext), `o upload deixou de aceitar ${ext}`);
    }
  });
});
