/* A TRAVA DA FICHA QUE JÁ EXISTE.
 *
 * Este teste guarda UMA coisa: a impressão digital da primeira ficha assinada
 * de verdade nesta empresa não pode mudar nunca mais.
 *
 * POR QUE ELE EXISTE
 * ------------------
 * Em 07/08/2026 às 23:16 BRT o dono assinou o checklist da BMW X1 — a primeira
 * assinatura real do sistema. O hash dela está gravado no banco e a corrente
 * do veículo parte dele.
 *
 * `textoParaAssinar()` monta o texto que a impressão digital cobre. Qualquer
 * mudança nesse texto — uma linha nova, um campo a mais, um separador
 * diferente — muda o hash de TODAS as fichas já assinadas. E aí
 * `conferirCorrente()` passa a acusar de ADULTERADA uma ficha que ninguém
 * tocou. Isso é o pior desfecho possível num recurso que existe justamente
 * para provar quem fez o quê: não é deixar passar uma fraude, é acusar um
 * inocente.
 *
 * Já aconteceu duas vezes nesta mesma fase (o instante reescrito pelo
 * Postgres, a ordem das respostas sem trava de unicidade). As duas foram
 * pegas antes de chegar no dono. Este teste é para não depender de sorte na
 * terceira: quem mexer em `textoParaAssinar` e quebrar o formato V1 vai ver
 * ESTE teste vermelho, com o nome do dono e a data na mensagem.
 *
 * COMO ACRESCENTAR CAMPO NOVO À ASSINATURA (o caminho certo)
 * ---------------------------------------------------------
 * NÃO edite as linhas do V1. Crie um formato NOVO (`FROTA-CHECKLIST-V2`),
 * grave a versão na ficha, e faça a conferência usar a versão gravada. Assim
 * as fichas antigas continuam sendo conferidas pela regra sob a qual foram
 * assinadas — que é o único jeito honesto de mudar um formato de assinatura.
 *
 * Os dados abaixo foram lidos do banco de produção, e o hash é o que está
 * gravado na coluna `assinatura_hash` daquela linha.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { textoParaAssinar, impressaoDigital } from './assinatura.js';

/* A ficha real, exatamente como saiu do banco. */
const FICHA_DA_BMW = {
  veiculo_id: '184f510f-92d6-424c-a891-30a969bc2f72',
  feita_em: '2026-08-07',
  pessoa_id: '0ac48eb9-c0ef-4c21-a813-883e2102e3b7',
  hodometro: 54000,
  hodometro_justificativa: null,
  cadencias: ['diario', 'semanal'],
  resultado: 'liberado',
  anomalias: null,
  // Como o Postgres devolve: `+00:00` e sem os milissegundos zerados que o
  // navegador mandou. É o formato que a conferência recebe de verdade.
  assinada_em: '2026-08-08T02:16:02.909+00:00',
};

const RESPOSTAS_DA_BMW = [
  'Painel — luzes de advertência',
  'Vazamentos sob o veículo',
  'Estado geral dos pneus',
  'Limpeza e condições gerais do veículo',
  'Faróis',
  'Lanternas',
  'Luzes de freio',
  'Setas / indicadores de direção',
  'Buzina',
  'Limpadores e lavador do para-brisa',
  'Retrovisores',
  'Freio de estacionamento',
  'Cintos de segurança',
  'Calibragem dos pneus',
  'Nível da água do limpador',
].map((item_texto) => ({ item_texto, estado: 'ok', observacao: null }));

/* O que está gravado em `frota_checklist.assinatura_hash`. */
const HASH_GRAVADO = '53c20b160f437d6edb095b4d38c5cb363a7a26bc988a21d51674dc8410e11948';

test('a ficha real da BMW continua com a MESMA impressão digital', async () => {
  const texto = textoParaAssinar({
    ficha: FICHA_DA_BMW,
    respostas: RESPOSTAS_DA_BMW,
    hashAnterior: null, // é a primeira da BMW
  });
  const calculado = await impressaoDigital(texto);

  assert.equal(
    calculado, HASH_GRAVADO,
    'O texto assinado MUDOU. A ficha que o dono assinou em 07/08/2026 23:16 ' +
    'passaria a ser acusada de adulterada.\n\n' +
    'Se você acrescentou um campo à assinatura: NÃO edite o formato V1. ' +
    'Crie o V2, grave a versão na ficha, e confira cada ficha pela versão sob ' +
    'a qual ela foi assinada. Ver o cabeçalho deste arquivo.',
  );
});

test('o texto V1 tem o cabeçalho e o número de linhas de sempre', () => {
  const texto = textoParaAssinar({
    ficha: FICHA_DA_BMW, respostas: RESPOSTAS_DA_BMW, hashAnterior: null,
  });
  const linhas = texto.split('\n');

  // Cabeçalho: é ele que diz sob qual regra a ficha foi assinada. Mudar o
  // texto do cabeçalho já muda o hash — está guardado aqui de propósito.
  assert.equal(linhas[0], 'FROTA-CHECKLIST-V1');

  // 12 linhas de cabeçalho/campos + uma por resposta. Se este número mudar,
  // alguém acrescentou ou tirou um campo do que a assinatura cobre.
  assert.equal(linhas.length, 12 + RESPOSTAS_DA_BMW.length);
});
